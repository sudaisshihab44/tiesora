import React, { useState } from 'react';
import { Family, Role, UserProfile } from '../../types';
import { createInvitationAction } from '../../services/dataActions';
import { isSupabaseConfigured } from '../../services/supabase';
import { storage } from '../../services/storage';
import { X, Send, Copy, Check, ShieldCheck, Mail } from 'lucide-react';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  family: Family;
  currentUser: UserProfile;
  onInviteSent: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  onClose,
  family,
  currentUser,
  onInviteSent,
}) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [copiedLink, setCopiedLink] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || saving) return;
    setError(null);

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setSaving(true);

    try {
      const token = await createInvitationAction(
        family.id,
        email.trim(),
        role,
        7,
      );

      const link = `${window.location.origin}/#invite=${token}`;
      setGeneratedInviteLink(link);

      // Demo mode keeps an invited membership for the local members list.
      if (!isSupabaseConfigured) {
        storage.addMembership({
          family_id: family.id,
          user_id: `usr_invited_${token.substring(0, 12)}`,
          user_email: email.trim(),
          user_name: email.split('@')[0],
          role,
          status: 'invited',
        });
      }

      onInviteSent();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not create the invitation. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    if (!generatedInviteLink) return;
    navigator.clipboard.writeText(generatedInviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl border border-stone-200 shadow-xl max-w-md w-full overflow-hidden sm:my-8 animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 bg-stone-50/70">
          <div>
            <h3 className="text-base font-bold text-stone-900">Invite Family Relative</h3>
            <p className="text-xs text-stone-500 mt-0.5">Generate a secure invite link to collaborate</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800">
              {error}
            </div>
          )}

          {!generatedInviteLink ? (
            <form onSubmit={handleGenerateInvite} className="space-y-4">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Relative's Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="relative@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border border-stone-300 rounded-lg outline-none focus:border-emerald-700 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Access Role & Permissions
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full px-3 py-2.5 border border-stone-300 rounded-lg outline-none focus:border-emerald-700 bg-white text-sm"
                >
                  <option value="viewer">Viewer (Read-only access)</option>
                  <option value="admin">Administrator (Full management access)</option>
                </select>
                <p className="text-[11px] text-stone-500 mt-1.5 leading-relaxed">
                  {role === 'viewer' && 'Viewers can explore the family tree and view permitted memories and events. They cannot add, edit, or delete any family records.'}
                  {role === 'admin' && 'Administrators have full management access including adding people, managing relationships, and controlling user access.'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
                <button type="button" onClick={onClose} className="px-4 py-2 border border-stone-300 text-stone-700 rounded-xl hover:bg-stone-100">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 text-white rounded-xl font-semibold shadow-xs flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  {saving ? 'Generating…' : 'Generate Invite Link'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-900 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  Invitation Created!
                </div>
                <p className="text-stone-600">
                  Share this secure link with <strong>{email}</strong> ({role} access). The link expires in 7 days.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    readOnly
                    value={generatedInviteLink}
                    className="w-full px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-[11px] font-mono text-stone-700"
                  />
                  <button
                    onClick={handleCopy}
                    className="px-3 py-1.5 bg-emerald-800 text-white rounded-lg hover:bg-emerald-900 transition-colors shrink-0 flex items-center gap-1"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedLink ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <button onClick={onClose} className="w-full py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl font-medium">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
