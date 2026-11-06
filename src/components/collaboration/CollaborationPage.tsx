import React, { useState } from 'react';
import { 
  FamilyMembership, 
  ChangeRequest, 
  AuditLog, 
  Role, 
  Family 
} from '../../types';
import { storage } from '../../services/storage';
import { InviteModal } from './InviteModal';
import { 
  Shield, 
  UserCheck, 
  UserPlus, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Eye, 
  Lock, 
  Sliders, 
  AlertCircle 
} from 'lucide-react';

interface CollaborationPageProps {
  family: Family;
  memberships: FamilyMembership[];
  changeRequests: ChangeRequest[];
  auditLogs: AuditLog[];
  onRefresh: () => void;
}

export const CollaborationPage: React.FC<CollaborationPageProps> = ({
  family,
  memberships,
  changeRequests,
  auditLogs,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'members' | 'change_requests' | 'audit_logs' | 'privacy'>('members');
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState<{ [id: string]: string }>({});
  const [privacySaved, setPrivacySaved] = useState(false);

  const currentUser = storage.getCurrentUser();
  const currentRole = storage.getUserRoleInFamily(currentUser.id, family.id);
  const canManage = currentRole === 'admin';
  const [privacySettings, setPrivacySettings] = useState(family.privacy_settings || {
    hideLivingDates: false,
    hideLivingBiographies: false,
    hidePrivateMemories: false,
    requireAdminApprovalForEdits: true,
    isPubliclySearchable: false,
  });

  const handlePrivacyToggle = (key: keyof typeof privacySettings) => {
    setPrivacySettings(prev => ({ ...prev, [key]: !prev[key] }));
    setPrivacySaved(false);
  };

  const handleSavePrivacy = () => {
    storage.updateFamily(family.id, { privacy_settings: privacySettings });
    onRefresh();
    setPrivacySaved(true);
    setTimeout(() => setPrivacySaved(false), 2500);
  };

  const handleRoleChange = (membershipId: string, newRole: Role) => {
    storage.updateMemberRole(membershipId, newRole);
    onRefresh();
  };

  const handleReview = (id: string, decision: 'approved' | 'rejected') => {
    storage.reviewChangeRequest(id, decision, reviewNotes[id]);
    onRefresh();
  };

  const pendingRequests = changeRequests.filter(cr => cr.status === 'pending');

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-5 space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1">
            <Shield className="w-4 h-4" />
            Security & Team Access Control
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
            Family Collaboration
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Manage who can view, edit, and contribute to {family.name}.
          </p>
        </div>

        <button
          onClick={() => setIsInviteOpen(true)}
          className="px-4 py-2 bg-emerald-800 text-white rounded-xl text-xs font-semibold hover:bg-emerald-900 transition-colors shadow-xs flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          Invite Relative
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200 text-xs font-medium pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab('members')}
          className={`py-3 px-3.5 border-b-2 font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'members'
              ? 'border-emerald-800 text-emerald-950'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Family Members ({memberships.length})
        </button>

        <button
          onClick={() => setActiveTab('change_requests')}
          className={`py-3 px-3.5 border-b-2 font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'change_requests'
              ? 'border-emerald-800 text-emerald-950'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Pending Edit Requests
          {pendingRequests.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
              {pendingRequests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('audit_logs')}
          className={`py-3 px-3.5 border-b-2 font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'audit_logs'
              ? 'border-emerald-800 text-emerald-950'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          Audit Trail History
        </button>

        <button
          onClick={() => setActiveTab('privacy')}
          className={`py-3 px-3.5 border-b-2 font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'privacy'
              ? 'border-emerald-800 text-emerald-950'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Lock className="w-4 h-4" />
          Privacy Controls
        </button>
      </div>

      {/* Tab: Memberships */}
      {activeTab === 'members' && (
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between text-xs text-stone-500">
            <span>Role Hierarchy: <strong className="text-stone-700">Admin</strong> (full access) &gt; <strong className="text-stone-700">Viewer</strong> (read-only)</span>
            <span>Your current role: <strong className="text-emerald-900 uppercase">{currentRole}</strong></span>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50/50 border-b border-stone-200 text-stone-600 font-semibold">
                <th className="py-3.5 px-5">Relative / Member</th>
                <th className="py-3.5 px-5">Email Address</th>
                <th className="py-3.5 px-5">Role Permission</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {memberships.map(mem => (
                <tr key={mem.id} className="hover:bg-stone-50/70 transition-colors">
                  <td className="py-3.5 px-5 font-semibold text-stone-900">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center justify-center">
                        {mem.user_name.substring(0, 2).toUpperCase()}
                      </div>
                      {mem.user_name}
                    </div>
                  </td>
                  <td className="py-3.5 px-5 text-stone-600">{mem.user_email}</td>
                  <td className="py-3.5 px-5">
                    {canManage && mem.role !== 'admin' || (canManage && currentUser.id !== mem.user_id) ? (
                      <select
                        value={mem.role}
                        onChange={(e) => handleRoleChange(mem.id, e.target.value as Role)}
                        className="px-2.5 py-1 bg-stone-50 border border-stone-300 rounded-lg text-xs font-medium text-stone-800 outline-none focus:border-emerald-700"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span className="font-semibold capitalize text-stone-800">
                        {mem.role}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-5">
                    <span className={`inline-flex items-center gap-1 font-medium capitalize ${
                      mem.status === 'active' ? 'text-emerald-700' : 'text-amber-700'
                    }`}>
                      {mem.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 tabular-nums text-stone-500">
                    {mem.created_at.substring(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Change Requests Queue */}
      {activeTab === 'change_requests' && (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50/60 border border-emerald-900/10 rounded-xl text-xs text-emerald-950 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Review & Approval Workflow</p>
              <p className="text-emerald-900/80 mt-0.5">
                Contributors submit edits and corrections to tree records. Administrators can verify and approve them to automatically apply changes to the live family records.
              </p>
            </div>
          </div>

          {changeRequests.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-stone-200 p-8">
              <CheckCircle className="w-8 h-8 text-stone-300 mx-auto mb-2" />
              <p className="text-xs text-stone-500">No change requests in queue.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {changeRequests.map(cr => {
                const isPending = cr.status === 'pending';
                return (
                  <div
                    key={cr.id}
                    className="p-5 bg-white rounded-2xl border border-stone-200 shadow-xs space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-stone-900">
                            Suggested by {cr.requested_by_name}
                          </span>
                          <span className="text-xs text-stone-300">·</span>
                          <span className="text-[11px] font-semibold uppercase text-emerald-800">
                            {cr.change_type.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-400 mt-0.5 tabular-nums">
                          Submitted on {cr.created_at.substring(0, 10)}
                        </p>
                      </div>

                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize ${
                        cr.status === 'pending'
                          ? 'bg-amber-100 text-amber-900'
                          : cr.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-rose-100 text-rose-900'
                      }`}>
                        {cr.status}
                      </span>
                    </div>

                    <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                      <p className="text-stone-500 font-medium mb-1">Proposed Updates:</p>
                      <pre className="text-[11px] text-stone-700 whitespace-pre-wrap font-sans">
                        {JSON.stringify(cr.payload, null, 2)}
                      </pre>
                    </div>

                    {isPending && canManage && (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-stone-100">
                        <input
                          type="text"
                          placeholder="Optional review note..."
                          value={reviewNotes[cr.id] || ''}
                          onChange={(e) => setReviewNotes({ ...reviewNotes, [cr.id]: e.target.value })}
                          className="text-xs px-3 py-1.5 border border-stone-300 rounded-lg outline-none focus:border-emerald-700 w-full sm:w-64"
                        />
                        <button
                          onClick={() => handleReview(cr.id, 'rejected')}
                          className="px-3.5 py-1.5 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                        <button
                          onClick={() => handleReview(cr.id, 'approved')}
                          className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 shadow-xs"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Approve & Apply
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Audit Log History */}
      {activeTab === 'audit_logs' && (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-stone-50 border-b border-stone-200 text-xs font-medium text-stone-600">
            Immutable audit record of modifications, additions, and access changes
          </div>
          <div className="divide-y divide-stone-100 text-xs">
            {auditLogs.map(log => (
              <div key={log.id} className="p-4 hover:bg-stone-50/70 transition-colors flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-900">{log.action}</span>
                    <span className="text-stone-300">·</span>
                    <span className="text-emerald-800 font-semibold">{log.target_name}</span>
                    <span className="text-stone-400 capitalize">({log.target_type})</span>
                  </div>
                  {log.details && (
                    <p className="text-stone-600 text-xs">{log.details}</p>
                  )}
                  <p className="text-[11px] text-stone-400">
                    Performed by {log.user_name}
                  </p>
                </div>
                <span className="text-[11px] text-stone-400 tabular-nums shrink-0">
                  {log.created_at.substring(0, 16).replace('T', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Privacy Controls */}
      {activeTab === 'privacy' && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-5 shadow-xs">
          <div>
            <h3 className="text-base font-bold text-stone-900">Privacy & Heritage Safeguards</h3>
            <p className="text-xs text-stone-500 mt-1">
              Configure data visibility rules for living family members and sensitive media.
            </p>
          </div>

          <div className="space-y-4 divide-y divide-stone-100 text-xs">
            <div className="pt-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-stone-800">Protect Living Relatives' Exact Birth Dates</p>
                <p className="text-stone-500 text-[11px] mt-0.5">
                  When enabled, exact day and month of birth are masked for living people unless viewed by administrators.
                </p>
              </div>
              <input
                type="checkbox"
                checked={privacySettings.hideLivingDates}
                onChange={() => handlePrivacyToggle('hideLivingDates')}
                disabled={!canManage}
                className="w-4 h-4 rounded text-emerald-800 focus:ring-emerald-700 cursor-pointer disabled:opacity-40"
              />
            </div>

            <div className="pt-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-stone-800">Mandate Review for Contributor Edits</p>
                <p className="text-stone-500 text-[11px] mt-0.5">
                  Edits by contributors must be approved before being merged into the master family tree.
                </p>
              </div>
              <input
                type="checkbox"
                checked={privacySettings.requireAdminApprovalForEdits}
                onChange={() => handlePrivacyToggle('requireAdminApprovalForEdits')}
                disabled={!canManage}
                className="w-4 h-4 rounded text-emerald-800 focus:ring-emerald-700 cursor-pointer disabled:opacity-40"
              />
            </div>

            <div className="pt-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-stone-800">Public Tree Searchability</p>
                <p className="text-stone-500 text-[11px] mt-0.5">
                  Family trees are strictly private by default. Only invited members can view records.
                </p>
              </div>
              <input
                type="checkbox"
                checked={privacySettings.isPubliclySearchable}
                onChange={() => handlePrivacyToggle('isPubliclySearchable')}
                disabled={!canManage}
                className="w-4 h-4 rounded text-emerald-800 focus:ring-emerald-700 cursor-pointer disabled:opacity-40"
              />
            </div>
          </div>

          {canManage && (
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
              {privacySaved && (
                <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Privacy settings saved!
                </span>
              )}
              <button
                onClick={handleSavePrivacy}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
              >
                Save Privacy Settings
              </button>
            </div>
          )}

          {!canManage && (
            <p className="text-[11px] text-stone-400 italic">
              Only family owners and administrators can modify privacy settings.
            </p>
          )}
        </div>
      )}

      {/* Invite Modal */}
      <InviteModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        onInviteSent={() => onRefresh()}
      />
    </div>
  );
};
