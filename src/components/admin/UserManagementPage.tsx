import React, { useState, useMemo } from 'react';
import { Family, FamilyMembership, Invitation, Role, UserProfile } from '../../types';
import {
  createInvitationAction,
  revokeInvitationAction,
  revokeMembershipAction,
  updateMemberRoleAction,
} from '../../services/dataActions';
import { isSupabaseConfigured } from '../../services/supabase';
import { storage } from '../../services/storage';
import {
  Shield, UserPlus, UserCheck, Mail, Clock, Check, Copy,
  MoreHorizontal, AlertTriangle, Loader2, Ban, RefreshCw, Send,
} from 'lucide-react';

interface UserManagementPageProps {
  family: Family;
  memberships: FamilyMembership[];
  invitations: Invitation[];
  currentUser: UserProfile;
  currentRole: Role;
  onRefresh: () => void;
}

type Tab = 'active' | 'invited' | 'pending';

export const UserManagementPage: React.FC<UserManagementPageProps> = ({
  family,
  memberships,
  invitations,
  currentUser,
  currentRole,
  onRefresh,
}) => {
  const [activeTab, setActiveTab]       = useState<Tab>('active');
  const [showInvite, setShowInvite]     = useState(false);
  const [inviteEmail, setInviteEmail]   = useState('');
  const [inviteRole, setInviteRole]     = useState<Role>('viewer');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError]   = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink]     = useState(false);
  const [roleError, setRoleError]       = useState<{ id: string; msg: string } | null>(null);
  const [revokeError, setRevokeError]   = useState<{ id: string; msg: string } | null>(null);
  const [resendLinks, setResendLinks]   = useState<Record<string, string>>({});
  const [resendCopied, setResendCopied] = useState<Record<string, boolean>>({});
  const [regeneratedInvite, setRegeneratedInvite] = useState<{
    email: string;
    link: string;
    warning?: string;
  } | null>(null);
  const [regeneratedCopied, setRegeneratedCopied] = useState(false);
  const [invitationError, setInvitationError] = useState<{ id: string; msg: string } | null>(null);

  const isAdmin = currentRole === 'admin';

  const activeMembers  = useMemo(() => memberships.filter(m => m.status === 'active'), [memberships]);
  const invitedMembers = useMemo(() => memberships.filter(m => m.status === 'invited'), [memberships]);
  const pendingMembers = useMemo(() => memberships.filter(m => m.status === 'pending' || m.status === 'suspended'), [memberships]);

  const pendingInvitations = useMemo(
    () =>
      invitations
        .filter(
          (inv) =>
            !inv.accepted_at &&
            !inv.revoked_at &&
            new Date(inv.expires_at).getTime() > Date.now() &&
            !activeMembers.some(
              (m) => m.user_email.toLowerCase() === inv.email.toLowerCase(),
            ),
        )
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
    [invitations, activeMembers],
  );

  const adminCount = activeMembers.filter(m => m.role === 'admin').length;

  // ── Invite ──────────────────────────────────────────────────────────────────
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    if (!inviteEmail.trim()) { setInviteError('Please enter an email address.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
      setInviteError('Please enter a valid email address.');
      return;
    }
    // Prevent duplicate active/invited memberships for the same email IN THIS FAMILY
    const alreadyMember = memberships.some(
      m => m.family_id === family.id  // ← ensure we're only checking THIS family
          && m.user_email.toLowerCase() === inviteEmail.trim().toLowerCase()
          && (m.status === 'active' || m.status === 'invited')
    );
    if (alreadyMember) {
      setInviteError('This person already has access to the family.');
      return;
    }

    setInviteLoading(true);
    try {
      const token = await createInvitationAction(
        family.id,
        inviteEmail.trim(),
        inviteRole,
        7, // 7-day expiry
      );

      // Demo mode keeps an invited membership for the local members tab.
      // Supabase stores the invitation in the invitations table; Phase 4
      // wires that list into the UI.
      if (!isSupabaseConfigured) {
        storage.addMembership({
          family_id: family.id,
          user_id: `usr_invited_${token.substring(0, 12)}`,
          user_email: inviteEmail.trim(),
          user_name: inviteEmail.split('@')[0],
          role: inviteRole,
          status: 'invited',
        });
      }

      // Build the link from the current origin (not hardcoded localhost)
      const appOrigin = (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '')
        || window.location.origin;
      const link = `${appOrigin}/#invite=${token}`;
      setGeneratedLink(link);
      onRefresh();
    } catch (error) {
      setInviteError(
        error instanceof Error
          ? error.message
          : 'Could not create invitation. Please try again.',
      );
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleResetInvite = () => {
    setShowInvite(false);
    setInviteEmail('');
    setInviteRole('viewer');
    setGeneratedLink(null);
    setInviteError(null);
  };

  // ── Role change ─────────────────────────────────────────────────────────────
  const handleRoleChange = async (mem: FamilyMembership, newRole: Role) => {
    setRoleError(null);
    try {
      await updateMemberRoleAction(mem.id, newRole);
      onRefresh();
    } catch (err) {
      setRoleError({
        id: mem.id,
        msg: err instanceof Error ? err.message : 'Could not change role.',
      });
    }
  };

  // ── Revoke ──────────────────────────────────────────────────────────────────
  const handleRevoke = async (mem: FamilyMembership) => {
    setRevokeError(null);
    const result = await revokeMembershipAction(mem.id);
    if (!result.success) {
      setRevokeError({
        id: mem.id,
        msg: result.error ?? 'Could not revoke access.',
      });
    } else {
      onRefresh();
    }
  };

  // ── Resend invite ────────────────────────────────────────────────────────────
  const handleResend = async (mem: FamilyMembership) => {
    try {
      const token = await createInvitationAction(
        family.id,
        mem.user_email,
        mem.role,
        7,
      );
      const appOrigin =
        (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '') ||
        window.location.origin;
      const link = `${appOrigin}/#invite=${token}`;
      setResendLinks(prev => ({ ...prev, [mem.id]: link }));
      onRefresh();
    } catch (error) {
      console.error('[UserManagementPage] resend failed:', error);
      setRoleError({
        id: mem.id,
        msg:
          error instanceof Error
            ? error.message
            : 'Could not regenerate the invitation.',
      });
    }
  };

  const handleCopyResend = (memId: string) => {
    const link = resendLinks[memId];
    if (!link) return;
    navigator.clipboard.writeText(link);
    setResendCopied(prev => ({ ...prev, [memId]: true }));
    setTimeout(() => setResendCopied(prev => ({ ...prev, [memId]: false })), 2500);
  };

  // ── Pending invitation links ────────────────────────────────────────────────
  const buildInviteLink = (token: string) => {
    const appOrigin =
      (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '') ||
      window.location.origin;
    return `${appOrigin}/#invite=${token}`;
  };

  const handleRegenerateInvitation = async (inv: Invitation) => {
    setInvitationError(null);
    try {
      const token = await createInvitationAction(family.id, inv.email, inv.role, 7);
      let warning: string | undefined;
      try {
        await revokeInvitationAction(inv.id);
      } catch (error) {
        console.error('[UserManagementPage] could not revoke old invite:', error);
        warning =
          'The previous link could not be revoked. It stays valid until it expires.';
      }
      setRegeneratedInvite({
        email: inv.email,
        link: buildInviteLink(token),
        warning,
      });
      setRegeneratedCopied(false);
      onRefresh();
    } catch (error) {
      setInvitationError({
        id: inv.id,
        msg:
          error instanceof Error
            ? error.message
            : 'Could not regenerate the invitation.',
      });
    }
  };

  const handleCopyRegenerated = () => {
    if (!regeneratedInvite) return;
    navigator.clipboard.writeText(regeneratedInvite.link);
    setRegeneratedCopied(true);
    setTimeout(() => setRegeneratedCopied(false), 2500);
  };

  const handleRevokeInvitation = async (inv: Invitation) => {
    setInvitationError(null);
    try {
      await revokeInvitationAction(inv.id);
      if (regeneratedInvite?.email === inv.email) setRegeneratedInvite(null);
      onRefresh();
    } catch (error) {
      setInvitationError({
        id: inv.id,
        msg:
          error instanceof Error
            ? error.message
            : 'Could not revoke the invitation.',
      });
    }
  };

  // ── Role badge ───────────────────────────────────────────────────────────────
  const RoleBadge = ({ role }: { role: Role }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
      role === 'admin'
        ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
        : 'bg-stone-100 text-stone-600 border border-stone-200'
    }`}>
      {role === 'admin' && <Shield className="w-2.5 h-2.5" />}
      {role}
    </span>
  );

  const StatusBadge = ({ status }: { status: FamilyMembership['status'] }) => (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium capitalize ${
      status === 'active'    ? 'text-emerald-700' :
      status === 'invited'   ? 'text-amber-700' :
      status === 'suspended' ? 'text-rose-700' : 'text-stone-500'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        status === 'active'    ? 'bg-emerald-500' :
        status === 'invited'   ? 'bg-amber-500' :
        status === 'suspended' ? 'bg-rose-500' : 'bg-stone-400'
      }`} />
      {status}
    </span>
  );

  const tabCount = (tab: Tab) => {
    if (tab === 'active')  return activeMembers.length;
    if (tab === 'invited') return invitedMembers.length + pendingInvitations.length;
    return pendingMembers.length;
  };

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto p-5 flex flex-col items-center justify-center min-h-64 gap-3">
        <Shield className="w-10 h-10 text-stone-300" />
        <h2 className="text-base font-bold text-stone-600">Admin access required</h2>
        <p className="text-xs text-stone-500 text-center max-w-xs">
          Only administrators can manage family members and permissions.
        </p>
      </div>
    );
  }

  const displayedMembers = activeTab === 'active' ? activeMembers : activeTab === 'invited' ? invitedMembers : pendingMembers;

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1">
            <Shield className="w-4 h-4" />
            Access Management
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">User Management</h1>
          <p className="text-sm text-stone-600 mt-1">
            Manage who can access <strong>{family.name}</strong> and what they can do.
          </p>
        </div>

        {!showInvite && (
          <button
            onClick={() => setShowInvite(true)}
            className="px-4 py-2 bg-emerald-800 text-white rounded-xl text-xs font-semibold hover:bg-emerald-900 transition-colors shadow-xs flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            Invite User
          </button>
        )}
      </div>

      {/* Role legend */}
      <div className="flex flex-wrap gap-3 p-3.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-700">
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-emerald-800" />
          <strong>Admin:</strong> full access — add/edit people, manage members, invite users
        </div>
        <div className="text-stone-300 hidden sm:block">·</div>
        <div className="flex items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5 text-stone-500" />
          <strong>Viewer:</strong> read-only — browse tree, search, view memories &amp; events
        </div>
      </div>

      {/* Invite panel */}
      {showInvite && (
        <div className="bg-white border border-stone-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 bg-stone-50/60 flex items-center justify-between">
            <h2 className="text-sm font-bold text-stone-900">Invite a New User</h2>
            <button onClick={handleResetInvite} className="text-xs text-stone-500 hover:text-stone-800">Cancel</button>
          </div>

          {!generatedLink ? (
            <form onSubmit={handleSendInvite} className="p-5 space-y-4">
              {inviteError && (
                <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {inviteError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Email address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      placeholder="relative@example.com"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-stone-300 rounded-xl outline-none focus:border-emerald-700 transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Assign role</label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as Role)}
                    className="w-full px-3 py-2.5 text-sm border border-stone-300 rounded-xl outline-none focus:border-emerald-700 bg-white transition-colors"
                  >
                    <option value="viewer">Viewer — read-only access</option>
                    <option value="admin">Admin — full management access</option>
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-stone-500 leading-relaxed">
                {inviteRole === 'viewer'
                  ? 'Viewers can browse the family tree, search members, and view authorized memories and events. They cannot add, edit, or delete any records.'
                  : 'Admins have full access to add and edit family members, manage relationships, upload memories, invite users, and change roles. Only invite trusted family members as admins.'}
              </p>
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleResetInvite}
                  className="px-4 py-2 border border-stone-300 text-stone-700 hover:bg-stone-50 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  {inviteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Generate Invite Link
                </button>
              </div>
            </form>
          ) : (
            <div className="p-5 space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-900 font-semibold text-xs">
                  <Check className="w-4 h-4 text-emerald-700" />
                  Invitation created for <strong>{inviteEmail}</strong> as <strong>{inviteRole}</strong>
                </div>
                <p className="text-[11px] text-stone-600">
                  Share this secure link. It expires in 7 days.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={generatedLink}
                    className="flex-1 px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-[11px] font-mono text-stone-700 min-w-0"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-3 py-1.5 bg-emerald-800 text-white rounded-lg hover:bg-emerald-900 transition-colors shrink-0 flex items-center gap-1 text-xs"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedLink ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setInviteEmail(''); setInviteRole('viewer'); setGeneratedLink(null); setInviteError(null); }}
                  className="px-4 py-2 border border-stone-300 text-stone-700 hover:bg-stone-50 rounded-xl text-xs font-semibold transition-colors"
                >
                  Invite another
                </button>
                <button
                  onClick={handleResetInvite}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-stone-200 text-xs font-medium pb-px overflow-x-auto">
        {(['active', 'invited', 'pending'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-3 px-3.5 border-b-2 font-semibold transition-colors capitalize whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === tab
                ? 'border-emerald-800 text-emerald-950'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            {tab === 'active' && <UserCheck className="w-4 h-4" />}
            {tab === 'invited' && <Mail className="w-4 h-4" />}
            {tab === 'pending' && <Clock className="w-4 h-4" />}
            {tab === 'active' ? 'Active Members' : tab === 'invited' ? 'Pending Invitations' : 'Other'}
            <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === tab ? 'bg-emerald-100 text-emerald-900' : 'bg-stone-100 text-stone-500'
            }`}>
              {tabCount(tab)}
            </span>
          </button>
        ))}
      </div>

      {/* Pending invitations (Supabase) */}
      {activeTab === 'invited' && regeneratedInvite && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-emerald-900">
                New invitation link for {regeneratedInvite.email}
              </p>
              <p className="text-[11px] text-emerald-800/80 mt-0.5">
                Share this link. It expires in 7 days.
              </p>
            </div>
            <button
              onClick={() => setRegeneratedInvite(null)}
              className="text-[11px] text-emerald-800/70 hover:text-emerald-950"
            >
              Dismiss
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={regeneratedInvite.link}
              className="flex-1 px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-[11px] font-mono text-stone-700 min-w-0"
            />
            <button
              onClick={handleCopyRegenerated}
              className="px-3 py-1.5 bg-emerald-800 text-white rounded-lg hover:bg-emerald-900 transition-colors shrink-0 flex items-center gap-1 text-xs"
            >
              {regeneratedCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {regeneratedCopied ? 'Copied' : 'Copy'}
            </button>
          </div>
          {regeneratedInvite.warning && (
            <p className="text-[11px] text-amber-800 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {regeneratedInvite.warning}
            </p>
          )}
        </div>
      )}

      {activeTab === 'invited' && pendingInvitations.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50/70 border-b border-stone-200 text-stone-600 font-semibold">
                  <th className="py-3 px-4">Invited email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4 hidden sm:table-cell">Expires</th>
                  <th className="py-3 px-4 hidden md:table-cell">Created</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {pendingInvitations.map(inv => {
                  const daysLeft = Math.max(
                    0,
                    Math.ceil(
                      (new Date(inv.expires_at).getTime() - Date.now()) /
                        86_400_000,
                    ),
                  );
                  return (
                    <tr key={inv.id} className="hover:bg-stone-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-900 font-bold text-[11px] flex items-center justify-center shrink-0">
                            {inv.email.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-stone-900 truncate">
                              {inv.email.split('@')[0]}
                            </p>
                            <p className="text-stone-400 text-[11px] truncate">
                              {inv.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <RoleBadge role={inv.role} />
                      </td>
                      <td className="py-3 px-4 text-stone-500 hidden sm:table-cell">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-stone-400" />
                          {daysLeft <= 0 ? 'Expired' : `${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-stone-400 tabular-nums hidden md:table-cell">
                        {inv.created_at.substring(0, 10)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleRegenerateInvitation(inv)}
                            className="px-2.5 py-1 bg-stone-50 border border-stone-200 text-stone-700 hover:bg-stone-100 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors"
                          >
                            <RefreshCw className="w-3 h-3" />
                            New link
                          </button>
                          <button
                            onClick={() => handleRevokeInvitation(inv)}
                            className="px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors"
                          >
                            <Ban className="w-3 h-3" />
                            Revoke
                          </button>
                          {invitationError?.id === inv.id && (
                            <p className="text-[10px] text-rose-600 w-full text-right">
                              {invitationError.msg}
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Members table */}
      {!(activeTab === 'invited' && invitedMembers.length === 0 && pendingInvitations.length > 0) && (
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs">
        {displayedMembers.length === 0 ? (
          <div className="p-10 text-center text-xs text-stone-400">
            {activeTab === 'active' ? 'No active members yet.' :
             activeTab === 'invited' ? 'No pending invitations.' : 'Nothing here.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50/70 border-b border-stone-200 text-stone-600 font-semibold">
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4 hidden sm:table-cell">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4 hidden md:table-cell">Status</th>
                  <th className="py-3 px-4 hidden lg:table-cell">Joined</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {displayedMembers.map(mem => {
                  const isCurrentUser = mem.user_id === currentUser.id;
                  const wouldRemoveLastAdmin = mem.role === 'admin' && adminCount === 1;
                  return (
                    <tr key={mem.id} className="hover:bg-stone-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-900 font-bold text-[11px] flex items-center justify-center shrink-0">
                            {mem.user_name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-stone-900 truncate">
                              {mem.user_name}
                              {isCurrentUser && (
                                <span className="ml-1.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded-md">you</span>
                              )}
                            </p>
                            <p className="text-stone-400 text-[11px] truncate sm:hidden">{mem.user_email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-stone-500 hidden sm:table-cell truncate max-w-[160px]">
                        {mem.user_email}
                      </td>
                      <td className="py-3 px-4">
                        {activeTab === 'active' && !isCurrentUser ? (
                          <div className="space-y-1">
                            <select
                              value={mem.role}
                              onChange={e => handleRoleChange(mem, e.target.value as Role)}
                              disabled={wouldRemoveLastAdmin && mem.role === 'admin'}
                              className="px-2.5 py-1 bg-stone-50 border border-stone-300 rounded-lg text-xs font-medium text-stone-800 outline-none focus:border-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              title={wouldRemoveLastAdmin ? 'Cannot demote the last admin' : undefined}
                            >
                              <option value="viewer">Viewer</option>
                              <option value="admin">Admin</option>
                            </select>
                            {roleError?.id === mem.id && (
                              <p className="text-[10px] text-rose-600">{roleError.msg}</p>
                            )}
                          </div>
                        ) : (
                          <RoleBadge role={mem.role} />
                        )}
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <StatusBadge status={mem.status} />
                      </td>
                      <td className="py-3 px-4 text-stone-400 tabular-nums hidden lg:table-cell">
                        {mem.created_at.substring(0, 10)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {activeTab === 'invited' && (
                            <>
                              {resendLinks[mem.id] ? (
                                <button
                                  onClick={() => handleCopyResend(mem.id)}
                                  className="px-2.5 py-1 bg-stone-50 border border-stone-200 text-stone-700 hover:bg-stone-100 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors"
                                >
                                  {resendCopied[mem.id] ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
                                  {resendCopied[mem.id] ? 'Copied' : 'Copy link'}
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleResend(mem)}
                                  className="px-2.5 py-1 bg-stone-50 border border-stone-200 text-stone-700 hover:bg-stone-100 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  Resend
                                </button>
                              )}
                            </>
                          )}
                          {!isCurrentUser && activeTab !== 'pending' && (
                            <button
                              onClick={() => handleRevoke(mem)}
                              disabled={wouldRemoveLastAdmin}
                              className="px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              title={wouldRemoveLastAdmin ? 'Cannot revoke the last admin' : `Revoke ${mem.user_name}'s access`}
                            >
                              <Ban className="w-3 h-3" />
                              Revoke
                            </button>
                          )}
                          {revokeError?.id === mem.id && (
                            <p className="text-[10px] text-rose-600 w-full text-right">{revokeError.msg}</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* Last-admin warning */}
      {adminCount === 1 && activeMembers.length > 0 && (
        <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <p className="font-semibold">You are the only administrator.</p>
            <p className="text-amber-700 mt-0.5">
              Invite or promote another admin before changing your own role, to prevent accidental lock-out.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
