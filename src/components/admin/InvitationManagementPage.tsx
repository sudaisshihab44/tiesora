import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  Copy,
  Mail,
  MessageCircle,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Share2,
  MoreVertical,
  Trash2,
  RefreshCw,
  Shield
} from 'lucide-react';
import {
  createInvitationWithCode,
  listFamilyInvitations,
  revokeInvitation
} from '../../services/auth';
import type { Family } from '../../types';

interface InvitationManagementPageProps {
  family: Family;
  onRefresh: () => void;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  invitation_code: string;
  token: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  status: 'pending' | 'accepted' | 'cancelled' | 'expired';
}

export const InvitationManagementPage: React.FC<InvitationManagementPageProps> = ({
  family,
  onRefresh,
}) => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Create invitation form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [inviteeEmail, setInviteeEmail] = useState('');
  const [inviteeRole, setInviteeRole] = useState<'admin' | 'viewer'>('viewer');
  const [expiryDays, setExpiryDays] = useState(7);
  const [creating, setCreating] = useState(false);
  
  // New invitation result
  const [newInvitation, setNewInvitation] = useState<{
    code: string;
    email: string;
    role: string;
  } | null>(null);
  
  // Copy feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // LOAD INVITATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const loadInvitations = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await listFamilyInvitations(family.id);
      
      if (!result.ok) {
        setError(result.error || 'Failed to load invitations');
        return;
      }

      setInvitations(result.invitations || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load invitations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvitations();
  }, [family.id]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE INVITATION
  // ═══════════════════════════════════════════════════════════════════════════

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!inviteeEmail.trim()) {
      setError('Please enter an email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteeEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    setCreating(true);

    try {
      const result = await createInvitationWithCode(
        family.id,
        inviteeEmail.trim(),
        inviteeRole,
        expiryDays
      );

      if (!result.ok) {
        setError(result.error || 'Failed to create invitation');
        setCreating(false);
        return;
      }

      // Success!
      setNewInvitation({
        code: result.invitation_code!,
        email: inviteeEmail,
        role: inviteeRole
      });

      // Reset form
      setInviteeEmail('');
      setInviteeRole('viewer');
      setExpiryDays(7);
      setShowCreateForm(false);

      // Reload invitations list
      await loadInvitations();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to create invitation');
    } finally {
      setCreating(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // COPY TO CLIPBOARD
  // ═══════════════════════════════════════════════════════════════════════════

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SHARE VIA WEB SHARE API
  // ═══════════════════════════════════════════════════════════════════════════

  const handleShare = async (code: string, email: string) => {
    const text = `You've been invited to join the ${family.name} family tree on Tiesora!\n\nYour invitation code: ${code}\n\nVisit the app and use this code to join: ${window.location.origin}`;

    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      // Fallback: copy to clipboard
      await handleCopyCode(text);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // REVOKE INVITATION
  // ═══════════════════════════════════════════════════════════════════════════

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation? The code will no longer work.')) {
      return;
    }

    try {
      const result = await revokeInvitation(invitationId);
      
      if (!result.ok) {
        setError(result.error || 'Failed to revoke invitation');
        return;
      }

      // Reload invitations
      await loadInvitations();
    } catch (err: any) {
      setError(err.message || 'Failed to revoke invitation');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS BADGE
  // ═══════════════════════════════════════════════════════════════════════════

  const StatusBadge: React.FC<{ status: Invitation['status'] }> = ({ status }) => {
    const configs = {
      pending: {
        icon: Clock,
        label: 'Pending',
        className: 'bg-amber-50 text-amber-800 border-amber-200'
      },
      accepted: {
        icon: CheckCircle2,
        label: 'Accepted',
        className: 'bg-emerald-50 text-emerald-800 border-emerald-200'
      },
      cancelled: {
        icon: XCircle,
        label: 'Cancelled',
        className: 'bg-stone-100 text-stone-600 border-stone-200'
      },
      expired: {
        icon: AlertCircle,
        label: 'Expired',
        className: 'bg-red-50 text-red-800 border-red-200'
      }
    };

    const config = configs[status];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.className}`}>
        <Icon className="w-3.5 h-3.5" />
        {config.label}
      </span>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="max-w-5xl mx-auto p-3 sm:p-5 space-y-5">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">
            Family Invitations
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Invite family members to view or collaborate on your family tree
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all"
        >
          <UserPlus className="w-5 h-5" />
          <span>Invite Member</span>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800">{error}</p>
          </div>
          <button
            onClick={() => setError('')}
            className="text-red-600 hover:text-red-800"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* New Invitation Success Card */}
      {newInvitation && (
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-emerald-900">
                Invitation Created!
              </h3>
              <p className="text-sm text-emerald-800 mt-1">
                Share this invitation code with <span className="font-semibold">{newInvitation.email}</span>
              </p>
            </div>
            <button
              onClick={() => setNewInvitation(null)}
              className="text-emerald-600 hover:text-emerald-800"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          {/* Invitation Code Display */}
          <div className="bg-white rounded-xl border border-emerald-300 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-600 uppercase tracking-wide">
                Invitation Code
              </span>
              <span className="text-xs font-semibold text-emerald-800 capitalize">
                {newInvitation.role} Access
              </span>
            </div>
            <div className="flex items-center gap-3">
              <code className="flex-1 px-4 py-3 bg-stone-50 border border-stone-200 rounded-lg text-lg font-mono font-bold text-stone-900 tracking-widest">
                {newInvitation.code}
              </code>
              <button
                onClick={() => handleCopyCode(newInvitation.code)}
                className="px-4 py-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg transition-colors"
              >
                {copiedCode === newInvitation.code ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Share Buttons */}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={() => handleShare(newInvitation.code, newInvitation.email)}
                className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-900 rounded-lg text-sm font-medium transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </button>
              <a
                href={`mailto:${newInvitation.email}?subject=Join ${family.name} on Tiesora&body=You've been invited to join our family tree!%0A%0AYour invitation code: ${newInvitation.code}%0A%0AVisit ${window.location.origin} and use this code to join.`}
                className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-900 rounded-lg text-sm font-medium transition-colors"
              >
                <Mail className="w-4 h-4" />
                <span>Email</span>
              </a>
              <a
                href={`https://wa.me/?text=You've been invited to join ${family.name} on Tiesora!%0A%0AInvitation code: ${newInvitation.code}%0A%0AVisit ${window.location.origin}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-green-100 hover:bg-green-200 text-green-900 rounded-lg text-sm font-medium transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Create Invitation Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-stone-900">
                Create Invitation
              </h2>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-stone-400 hover:text-stone-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateInvitation} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteeEmail}
                  onChange={(e) => setInviteeEmail(e.target.value)}
                  placeholder="family.member@example.com"
                  className="w-full px-4 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  disabled={creating}
                  autoFocus
                />
                <p className="text-xs text-stone-500 mt-1">
                  The person you're inviting to your family tree
                </p>
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Access Level
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setInviteeRole('viewer')}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      inviteeRole === 'viewer'
                        ? 'border-emerald-600 bg-emerald-50'
                        : 'border-stone-200 hover:border-stone-300'
                    }`}
                    disabled={creating}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Eye className={`w-5 h-5 ${inviteeRole === 'viewer' ? 'text-emerald-700' : 'text-stone-400'}`} />
                      <span className="font-semibold text-sm text-stone-900">Viewer</span>
                    </div>
                    <p className="text-xs text-stone-600">
                      Can view family tree, memories, and events
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInviteeRole('admin')}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      inviteeRole === 'admin'
                        ? 'border-emerald-600 bg-emerald-50'
                        : 'border-stone-200 hover:border-stone-300'
                    }`}
                    disabled={creating}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className={`w-5 h-5 ${inviteeRole === 'admin' ? 'text-emerald-700' : 'text-stone-400'}`} />
                      <span className="font-semibold text-sm text-stone-900">Admin</span>
                    </div>
                    <p className="text-xs text-stone-600">
                      Can edit tree, add members, and manage invitations
                    </p>
                  </button>
                </div>
              </div>

              {/* Expiry */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Expires In
                </label>
                <select
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(Number(e.target.value))}
                  className="w-full px-4 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  disabled={creating}
                >
                  <option value={1}>1 day</option>
                  <option value={3}>3 days</option>
                  <option value={7}>7 days (recommended)</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                </select>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={creating}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Creating Invitation...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    <span>Create Invitation</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Invitations List */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-stone-900">
              All Invitations
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              {invitations.length} total invitation{invitations.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={loadInvitations}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-800" />
          </div>
        ) : invitations.length === 0 ? (
          <div className="text-center py-12 px-4">
            <UserPlus className="w-12 h-12 text-stone-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-stone-900 mb-1">
              No invitations yet
            </p>
            <p className="text-xs text-stone-500 mb-4">
              Invite family members to start collaborating
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              Create First Invitation
            </button>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {invitations.map((invitation) => (
              <div key={invitation.id} className="px-5 py-4 hover:bg-stone-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="font-semibold text-sm text-stone-900">
                        {invitation.email}
                      </p>
                      <StatusBadge status={invitation.status} />
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
                      <span className="flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5" />
                        <span className="capitalize">{invitation.role}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          Expires {new Date(invitation.expires_at).toLocaleDateString()}
                        </span>
                      </span>
                      {invitation.status === 'pending' && (
                        <span className="flex items-center gap-1">
                          <code className="px-2 py-0.5 bg-stone-100 rounded font-mono font-semibold text-stone-900">
                            {invitation.invitation_code}
                          </code>
                        </span>
                      )}
                    </div>
                  </div>

                  {invitation.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyCode(invitation.invitation_code)}
                        className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
                        title="Copy code"
                      >
                        {copiedCode === invitation.invitation_code ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                        ) : (
                          <Copy className="w-5 h-5 text-stone-600" />
                        )}
                      </button>
                      <button
                        onClick={() => handleRevokeInvitation(invitation.id)}
                        className="p-2 hover:bg-red-50 text-stone-600 hover:text-red-700 rounded-lg transition-colors"
                        title="Cancel invitation"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
