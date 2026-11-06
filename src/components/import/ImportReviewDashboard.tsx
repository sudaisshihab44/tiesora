import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  GitBranch,
  AlertTriangle,
  Eye,
  CheckCircle,
  X,
  Save,
  Trash2,
  Link,
  Edit2,
  ChevronRight,
  AlertCircle,
  HelpCircle,
  Download,
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import {
  ExtractedFamilyMember,
  ExtractedRelationship,
  ImportConflict,
  VerificationStatus,
  FamilyImportJob,
} from '../../types';
import { ExtractedTreePreview } from './ExtractedTreePreview';
import {
  calculatePersonConfidence,
  calculateRelationshipConfidence,
  updatePersonVerificationStatus,
  mergeExtractedPeople,
  resolveConflict,
  getVerificationStats,
} from '../../services/extractionVerification';

interface ImportReviewDashboardProps {
  jobId: string;
  familyId: string;
  onClose: () => void;
  onApprove: () => void;
}

type TabType = 'members' | 'relationships' | 'conflicts' | 'preview';

interface EditingMember extends ExtractedFamilyMember {
  isEditing?: boolean;
}

interface EditingRelationship extends ExtractedRelationship {
  isEditing?: boolean;
}

export const ImportReviewDashboard: React.FC<ImportReviewDashboardProps> = ({
  jobId,
  familyId,
  onClose,
  onApprove,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('members');
  const [job, setJob] = useState<FamilyImportJob | null>(null);
  const [members, setMembers] = useState<EditingMember[]>([]);
  const [relationships, setRelationships] = useState<EditingRelationship[]>([]);
  const [conflicts, setConflicts] = useState<ImportConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([]);

  useEffect(() => {
    loadReviewData();
  }, [jobId]);

  const loadReviewData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 [ImportReview] Starting data load for jobId:', jobId);
      console.log('🔍 [ImportReview] familyId:', familyId);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      console.log('🔍 [ImportReview] Current user ID:', user?.id);

      // Load job details
      console.log('🔍 [ImportReview] Querying family_import_jobs...');
      const { data: jobData, error: jobError } = await supabase
        .from('family_import_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobError) {
        console.error('❌ [ImportReview] Job query error:', {
          message: jobError.message,
          code: jobError.code,
          details: jobError.details,
          hint: jobError.hint,
        });
        throw new Error(`Failed to load import job: ${jobError.message} (${jobError.code})`);
      }
      
      console.log('✅ [ImportReview] Job loaded:', jobData);
      setJob(jobData);

      // Load extracted members
      console.log('🔍 [ImportReview] Querying extracted_family_members...');
      const { data: membersData, error: membersError } = await supabase
        .from('extracted_family_members')
        .select('*')
        .eq('import_job_id', jobId)
        .order('generation_level', { ascending: true, nullsFirst: false })
        .order('full_name', { ascending: true });

      if (membersError) {
        console.error('❌ [ImportReview] Members query error:', {
          message: membersError.message,
          code: membersError.code,
          details: membersError.details,
          hint: membersError.hint,
        });
        throw new Error(`Failed to load extracted members: ${membersError.message} (${membersError.code})`);
      }

      console.log('✅ [ImportReview] Members loaded:', membersData?.length || 0, 'records');
      setMembers(membersData || []);

      // Load extracted relationships
      console.log('🔍 [ImportReview] Querying extracted_relationships...');
      const { data: relationshipsData, error: relationshipsError } = await supabase
        .from('extracted_relationships')
        .select('*')
        .eq('import_job_id', jobId)
        .order('created_at', { ascending: true });

      if (relationshipsError) {
        console.error('❌ [ImportReview] Relationships query error:', {
          message: relationshipsError.message,
          code: relationshipsError.code,
          details: relationshipsError.details,
          hint: relationshipsError.hint,
        });
        throw new Error(`Failed to load extracted relationships: ${relationshipsError.message} (${relationshipsError.code})`);
      }

      console.log('✅ [ImportReview] Relationships loaded:', relationshipsData?.length || 0, 'records');
      setRelationships(relationshipsData || []);

      // Load conflicts
      console.log('🔍 [ImportReview] Querying import_conflicts...');
      const { data: conflictsData, error: conflictsError } = await supabase
        .from('import_conflicts')
        .select('*')
        .eq('import_job_id', jobId)
        .eq('resolved', false)
        .order('severity', { ascending: false });

      if (conflictsError) {
        console.error('❌ [ImportReview] Conflicts query error:', {
          message: conflictsError.message,
          code: conflictsError.code,
          details: conflictsError.details,
          hint: conflictsError.hint,
        });
        // Don't throw for conflicts - they might not exist yet
        console.warn('⚠️ [ImportReview] Conflicts query failed, continuing...');
      } else {
        console.log('✅ [ImportReview] Conflicts loaded:', conflictsData?.length || 0, 'records');
      }
      
      setConflicts(conflictsData || []);
      
      console.log('✅ [ImportReview] All data loaded successfully');
    } catch (err) {
      console.error('❌ [ImportReview] Error loading review data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load review data';
      console.error('❌ [ImportReview] Final error message:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMember = async (memberId: string, updates: Partial<ExtractedFamilyMember>) => {
    try {
      setSaving(true);

      // Recalculate confidence if data changed
      const member = members.find(m => m.id === memberId);
      if (member) {
        const updatedMember = { ...member, ...updates };
        const newConfidence = calculatePersonConfidence(updatedMember);
        updates.confidence_score = newConfidence;

        // Auto-update verification status based on new confidence
        if (newConfidence >= 0.90) {
          updates.verification_status = 'verified';
        } else if (newConfidence >= 0.60) {
          updates.verification_status = 'needs_review';
        }
      }

      const { error } = await supabase
        .from('extracted_family_members')
        .update(updates)
        .eq('id', memberId);

      if (error) throw error;

      // Update local state
      setMembers(prev =>
        prev.map(m => (m.id === memberId ? { ...m, ...updates, isEditing: false } : m))
      );

      // Record review history
      await supabase.from('import_review_history').insert({
        import_job_id: jobId,
        action_type: 'edit_person',
        entity_id: memberId,
        changes: updates,
        notes: 'Manual edit by admin',
      });
    } catch (err) {
      console.error('Error updating member:', err);
      setError(err instanceof Error ? err.message : 'Failed to update member');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRelationship = async (
    relationshipId: string,
    updates: Partial<ExtractedRelationship>
  ) => {
    try {
      setSaving(true);

      // Recalculate confidence if data changed
      const relationship = relationships.find(r => r.id === relationshipId);
      if (relationship) {
        const updatedRelationship = { ...relationship, ...updates };
        const newConfidence = calculateRelationshipConfidence(updatedRelationship, members);
        updates.confidence_score = newConfidence;

        if (newConfidence >= 0.85) {
          updates.verification_status = 'verified';
        } else if (newConfidence >= 0.60) {
          updates.verification_status = 'needs_review';
        }
      }

      const { error } = await supabase
        .from('extracted_relationships')
        .update(updates)
        .eq('id', relationshipId);

      if (error) throw error;

      setRelationships(prev =>
        prev.map(r => (r.id === relationshipId ? { ...r, ...updates, isEditing: false } : r))
      );

      await supabase.from('import_review_history').insert({
        import_job_id: jobId,
        action_type: 'edit_relationship',
        entity_id: relationshipId,
        changes: updates,
        notes: 'Manual edit by admin',
      });
    } catch (err) {
      console.error('Error updating relationship:', err);
      setError(err instanceof Error ? err.message : 'Failed to update relationship');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to delete this person? This will also remove related relationships.')) {
      return;
    }

    try {
      setSaving(true);

      // Delete relationships involving this person
      await supabase
        .from('extracted_relationships')
        .delete()
        .eq('import_job_id', jobId)
        .or(`person1_id.eq.${memberId},person2_id.eq.${memberId}`);

      // Delete the person
      const { error } = await supabase
        .from('extracted_family_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      setMembers(prev => prev.filter(m => m.id !== memberId));
      setRelationships(prev =>
        prev.filter(r => r.person1_id !== memberId && r.person2_id !== memberId)
      );

      await supabase.from('import_review_history').insert({
        import_job_id: jobId,
        action_type: 'delete_person',
        entity_id: memberId,
        notes: 'Deleted by admin',
      });
    } catch (err) {
      console.error('Error deleting member:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete member');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRelationship = async (relationshipId: string) => {
    if (!confirm('Are you sure you want to delete this relationship?')) {
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('extracted_relationships')
        .delete()
        .eq('id', relationshipId);

      if (error) throw error;

      setRelationships(prev => prev.filter(r => r.id !== relationshipId));

      await supabase.from('import_review_history').insert({
        import_job_id: jobId,
        action_type: 'delete_relationship',
        entity_id: relationshipId,
        notes: 'Deleted by admin',
      });
    } catch (err) {
      console.error('Error deleting relationship:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete relationship');
    } finally {
      setSaving(false);
    }
  };

  const handleMergeMembers = async () => {
    if (selectedForMerge.length < 2) {
      alert('Please select at least 2 people to merge');
      return;
    }

    try {
      setSaving(true);

      const peopleToMerge = members.filter(m => selectedForMerge.includes(m.id));
      const merged = await mergeExtractedPeople(peopleToMerge, 'prefer_higher_confidence');

      // Update the first selected member with merged data
      await handleUpdateMember(selectedForMerge[0], merged);

      // Delete the other members
      for (let i = 1; i < selectedForMerge.length; i++) {
        await handleDeleteMember(selectedForMerge[i]);
      }

      setMergeMode(false);
      setSelectedForMerge([]);
      await loadReviewData();
    } catch (err) {
      console.error('Error merging members:', err);
      setError(err instanceof Error ? err.message : 'Failed to merge members');
    } finally {
      setSaving(false);
    }
  };

  const handleResolveConflict = async (conflict: ImportConflict, resolution: 'keep_extracted' | 'keep_existing' | 'merge') => {
    try {
      setSaving(true);

      await resolveConflict(conflict, resolution);

      setConflicts(prev => prev.filter(c => c.id !== conflict.id));

      await supabase.from('import_review_history').insert({
        import_job_id: jobId,
        action_type: 'resolve_conflict',
        entity_id: conflict.id,
        changes: { resolution },
        notes: `Conflict resolved: ${resolution}`,
      });
    } catch (err) {
      console.error('Error resolving conflict:', err);
      setError(err instanceof Error ? err.message : 'Failed to resolve conflict');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyMember = async (memberId: string, status: VerificationStatus) => {
    await handleUpdateMember(memberId, { verification_status: status });
  };

  const handleApproveImport = async () => {
    // Check for unresolved conflicts
    if (conflicts.length > 0) {
      if (!confirm(`There are ${conflicts.length} unresolved conflicts. Approve anyway?`)) {
        return;
      }
    }

    // Check for uncertain members
    const uncertainMembers = members.filter(m => m.verification_status === 'uncertain');
    if (uncertainMembers.length > 0) {
      if (!confirm(`There are ${uncertainMembers.length} uncertain members. Approve anyway?`)) {
        return;
      }
    }

    try {
      setSaving(true);

      // Update job status to ready_to_import
      const { error: updateError } = await supabase
        .from('family_import_jobs')
        .update({
          status: 'ready_to_import',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (updateError) throw updateError;

      await supabase.from('import_review_history').insert({
        import_job_id: jobId,
        action_type: 'approve_import',
        notes: 'Import approved by admin',
      });

      onApprove();
    } catch (err) {
      console.error('Error approving import:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve import');
    } finally {
      setSaving(false);
    }
  };

  const getVerificationIcon = (status: VerificationStatus) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'needs_review':
        return <HelpCircle className="w-4 h-4 text-yellow-600" />;
      case 'uncertain':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.85) return 'text-green-600 bg-green-50';
    if (confidence >= 0.60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const stats = useMemo(() => {
    const verifiedCount = members.filter(m => m.verification_status === 'verified').length;
    const needsReviewCount = members.filter(m => m.verification_status === 'needs_review').length;
    const uncertainCount = members.filter(m => m.verification_status === 'uncertain').length;
    
    // Calculate average confidence
    const allConfidences = [
      ...members.map(m => m.confidence_score || 0),
      ...relationships.map(r => r.confidence_score || 0),
    ].filter(c => c > 0);
    
    const averageConfidence = allConfidences.length > 0
      ? allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length
      : 0;

    return {
      verifiedCount,
      needsReviewCount,
      uncertainCount,
      averageConfidence,
    };
  }, [members, relationships]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading review data...</p>
        </div>
      </div>
    );
  }

  // Show error state if data failed to load
  if (error && members.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-8">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Failed to Load Review Data</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={loadReviewData}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Retry
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show empty state if no data extracted
  if (members.length === 0 && relationships.length === 0 && !loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-8">
          <div className="text-center">
            <AlertTriangle className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No Data Extracted</h2>
            <p className="text-gray-600 mb-2">The PDF processing completed but no family members or relationships were found.</p>
            <p className="text-sm text-gray-500 mb-4">
              This could happen if:
              <ul className="list-disc list-inside text-left max-w-md mx-auto mt-2">
                <li>The PDF contains only images without text</li>
                <li>The document format is not recognized</li>
                <li>The AI extraction failed</li>
              </ul>
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Review Import</h2>
              <p className="text-sm text-gray-600 mt-1">
                {job?.file_name} • {members.length} people • {relationships.length} relationships
              </p>
              {conflicts.length > 0 && (
                <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  {conflicts.length} unresolved conflict{conflicts.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mt-4">
            <div className="bg-green-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-green-800">Verified</span>
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-900 mt-1">{stats.verifiedCount}</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-yellow-800">Needs Review</span>
                <HelpCircle className="w-4 h-4 text-yellow-600" />
              </div>
              <p className="text-2xl font-bold text-yellow-900 mt-1">{stats.needsReviewCount}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-red-800">Uncertain</span>
                <AlertCircle className="w-4 h-4 text-red-600" />
              </div>
              <p className="text-2xl font-bold text-red-900 mt-1">{stats.uncertainCount}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-800">Avg Confidence</span>
              </div>
              <p className="text-2xl font-bold text-blue-900 mt-1">
                {(stats.averageConfidence * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex gap-4 px-6">
            <button
              onClick={() => setActiveTab('members')}
              className={`py-3 px-4 border-b-2 font-medium transition-colors ${
                activeTab === 'members'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>Members ({members.length})</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('relationships')}
              className={`py-3 px-4 border-b-2 font-medium transition-colors ${
                activeTab === 'relationships'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4" />
                <span>Relationships ({relationships.length})</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('conflicts')}
              className={`py-3 px-4 border-b-2 font-medium transition-colors ${
                activeTab === 'conflicts'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Conflicts ({conflicts.length})</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`py-3 px-4 border-b-2 font-medium transition-colors ${
                activeTab === 'preview'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                <span>Preview</span>
              </div>
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'members' && (
            <MembersTab
              members={members}
              onUpdate={handleUpdateMember}
              onDelete={handleDeleteMember}
              onVerify={handleVerifyMember}
              mergeMode={mergeMode}
              selectedForMerge={selectedForMerge}
              onToggleMergeMode={() => {
                setMergeMode(!mergeMode);
                setSelectedForMerge([]);
              }}
              onToggleSelect={(id) => {
                setSelectedForMerge(prev =>
                  prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                );
              }}
              onMerge={handleMergeMembers}
              getVerificationIcon={getVerificationIcon}
              getConfidenceColor={getConfidenceColor}
            />
          )}

          {activeTab === 'relationships' && (
            <RelationshipsTab
              relationships={relationships}
              members={members}
              onUpdate={handleUpdateRelationship}
              onDelete={handleDeleteRelationship}
              getVerificationIcon={getVerificationIcon}
              getConfidenceColor={getConfidenceColor}
            />
          )}

          {activeTab === 'conflicts' && (
            <ConflictsTab
              conflicts={conflicts}
              members={members}
              onResolve={handleResolveConflict}
            />
          )}

          {activeTab === 'preview' && (
            <ExtractedTreePreview members={members} relationships={relationships} />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
            <button
              onClick={handleApproveImport}
              disabled={saving}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Approve & Import</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Members Tab Component
interface MembersTabProps {
  members: EditingMember[];
  onUpdate: (id: string, updates: Partial<ExtractedFamilyMember>) => void;
  onDelete: (id: string) => void;
  onVerify: (id: string, status: VerificationStatus) => void;
  mergeMode: boolean;
  selectedForMerge: string[];
  onToggleMergeMode: () => void;
  onToggleSelect: (id: string) => void;
  onMerge: () => void;
  getVerificationIcon: (status: VerificationStatus) => React.ReactNode;
  getConfidenceColor: (confidence: number) => string;
}

const MembersTab: React.FC<MembersTabProps> = ({
  members,
  onUpdate,
  onDelete,
  onVerify,
  mergeMode,
  selectedForMerge,
  onToggleMergeMode,
  onToggleSelect,
  onMerge,
  getVerificationIcon,
  getConfidenceColor,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ExtractedFamilyMember>>({});

  const handleStartEdit = (member: EditingMember) => {
    setEditingId(member.id);
    setEditForm(member);
  };

  const handleSaveEdit = () => {
    if (editingId) {
      onUpdate(editingId, editForm);
      setEditingId(null);
      setEditForm({});
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Family Members</h3>
        <div className="flex gap-2">
          {mergeMode && selectedForMerge.length >= 2 && (
            <button
              onClick={onMerge}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Link className="w-4 h-4" />
              Merge {selectedForMerge.length} Selected
            </button>
          )}
          <button
            onClick={onToggleMergeMode}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              mergeMode
                ? 'bg-gray-600 text-white hover:bg-gray-700'
                : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Link className="w-4 h-4" />
            {mergeMode ? 'Cancel Merge' : 'Merge Mode'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {members.map(member => (
          <div
            key={member.id}
            className={`border rounded-lg p-4 transition-colors ${
              mergeMode && selectedForMerge.includes(member.id)
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            {editingId === member.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={editForm.full_name || ''}
                      onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Gender
                    </label>
                    <select
                      value={editForm.gender || ''}
                      onChange={e => setEditForm({ ...editForm, gender: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Unknown</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Birth Date
                    </label>
                    <input
                      type="text"
                      value={editForm.birth_date || ''}
                      onChange={e => setEditForm({ ...editForm, birth_date: e.target.value })}
                      placeholder="YYYY-MM-DD"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Death Date
                    </label>
                    <input
                      type="text"
                      value={editForm.death_date || ''}
                      onChange={e => setEditForm({ ...editForm, death_date: e.target.value })}
                      placeholder="YYYY-MM-DD"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Generation
                    </label>
                    <input
                      type="text"
                      value={editForm.generation_label || ''}
                      onChange={e => setEditForm({ ...editForm, generation_label: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Branch
                    </label>
                    <input
                      type="text"
                      value={editForm.branch_label || ''}
                      onChange={e => setEditForm({ ...editForm, branch_label: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  {mergeMode && (
                    <input
                      type="checkbox"
                      checked={selectedForMerge.includes(member.id)}
                      onChange={() => onToggleSelect(member.id)}
                      className="mt-1 w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-gray-900">{member.full_name}</h4>
                      {getVerificationIcon(member.verification_status)}
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getConfidenceColor(
                          member.confidence_score
                        )}`}
                      >
                        {(member.confidence_score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
                      {member.gender && <div>Gender: {member.gender}</div>}
                      {member.birth_date && <div>Born: {member.birth_date}</div>}
                      {member.death_date && <div>Died: {member.death_date}</div>}
                      {member.generation_label && <div>Generation: {member.generation_label}</div>}
                      {member.branch_label && <div>Branch: {member.branch_label}</div>}
                    </div>
                    {member.notes && (
                      <p className="mt-2 text-sm text-gray-500 italic">{member.notes}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {member.verification_status !== 'verified' && (
                    <button
                      onClick={() => onVerify(member.id, 'verified')}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Verify"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleStartEdit(member)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(member.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Relationships Tab Component
interface RelationshipsTabProps {
  relationships: EditingRelationship[];
  members: ExtractedFamilyMember[];
  onUpdate: (id: string, updates: Partial<ExtractedRelationship>) => void;
  onDelete: (id: string) => void;
  getVerificationIcon: (status: VerificationStatus) => React.ReactNode;
  getConfidenceColor: (confidence: number) => string;
}

const RelationshipsTab: React.FC<RelationshipsTabProps> = ({
  relationships,
  members,
  onUpdate,
  onDelete,
  getVerificationIcon,
  getConfidenceColor,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ExtractedRelationship>>({});

  const getMemberName = (id: string) => {
    const member = members.find(m => m.id === id);
    return member?.full_name || 'Unknown';
  };

  const handleStartEdit = (relationship: ExtractedRelationship) => {
    setEditingId(relationship.id);
    setEditForm(relationship);
  };

  const handleSaveEdit = () => {
    if (editingId) {
      onUpdate(editingId, editForm);
      setEditingId(null);
      setEditForm({});
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Relationships</h3>
      <div className="space-y-3">
        {relationships.map(relationship => (
          <div key={relationship.id} className="border border-gray-200 rounded-lg p-4 bg-white">
            {editingId === relationship.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Relationship Type
                    </label>
                    <select
                      value={editForm.relationship_type || ''}
                      onChange={e =>
                        setEditForm({ ...editForm, relationship_type: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="parent_child">Parent-Child</option>
                      <option value="spouse">Spouse</option>
                      <option value="sibling">Sibling</option>
                      <option value="adoption">Adoption</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <input
                      type="text"
                      value={editForm.notes || ''}
                      onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setEditingId(null);
                      setEditForm({});
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-gray-900">
                      {getMemberName(relationship.person1_id)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                    <span className="text-emerald-600 font-medium">
                      {relationship.relationship_type.replace('_', ' ')}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-gray-900">
                      {getMemberName(relationship.person2_id)}
                    </span>
                    {getVerificationIcon(relationship.verification_status)}
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${getConfidenceColor(
                        relationship.confidence_score
                      )}`}
                    >
                      {(relationship.confidence_score * 100).toFixed(0)}%
                    </span>
                  </div>
                  {relationship.notes && (
                    <p className="text-sm text-gray-500 italic">{relationship.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleStartEdit(relationship)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(relationship.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Conflicts Tab Component
interface ConflictsTabProps {
  conflicts: ImportConflict[];
  members: ExtractedFamilyMember[];
  onResolve: (
    conflict: ImportConflict,
    resolution: 'keep_extracted' | 'keep_existing' | 'merge'
  ) => void;
}

const ConflictsTab: React.FC<ConflictsTabProps> = ({ conflicts, members, onResolve }) => {
  if (conflicts.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
        <p className="text-lg font-medium text-gray-900">No Conflicts</p>
        <p className="text-gray-600">All extracted data is ready for import</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Conflicts to Resolve</h3>
      <div className="space-y-4">
        {conflicts.map(conflict => (
          <div
            key={conflict.id}
            className="border-2 border-orange-200 bg-orange-50 rounded-lg p-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-gray-900">
                    {conflict.conflict_type.replace('_', ' ').toUpperCase()}
                  </span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      conflict.severity === 'high'
                        ? 'bg-red-100 text-red-800'
                        : conflict.severity === 'medium'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {conflict.severity} severity
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-3">{conflict.description}</p>
                <div className="bg-white rounded border border-orange-200 p-3 mb-3">
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                    {JSON.stringify(conflict.conflicting_data, null, 2)}
                  </pre>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onResolve(conflict, 'keep_extracted')}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    Keep Extracted
                  </button>
                  <button
                    onClick={() => onResolve(conflict, 'keep_existing')}
                    className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
                  >
                    Keep Existing
                  </button>
                  <button
                    onClick={() => onResolve(conflict, 'merge')}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  >
                    Merge Both
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
