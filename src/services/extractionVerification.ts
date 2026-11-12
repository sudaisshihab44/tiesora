/**
 * Extraction Verification Service
 * 
 * Provides tools for verifying and managing AI-extracted family data.
 * Handles confidence scoring, verification status updates, duplicate merging,
 * and conflict resolution workflows.
 */

import { supabase } from './supabase';
import type {
  ExtractedFamilyMember,
  ExtractedRelationship,
  ImportConflict,
  VerificationStatus,
  FamilyPerson,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIDENCE SCORE UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

export interface ConfidenceMetrics {
  overall: number; // 0.0-1.0
  dataCompleteness: number;
  nameClarity: number;
  dateValidity: number;
  relationshipClarity: number;
  sourceVerification: number;
}

/**
 * Calculate comprehensive confidence metrics for an extracted person
 */
export function calculatePersonConfidence(
  person: ExtractedFamilyMember
): ConfidenceMetrics {
  let dataCompleteness = 0;
  let nameClarity = 1.0;
  let dateValidity = 1.0;
  let sourceVerification = person.source_page_numbers.length > 0 ? 1.0 : 0.5;

  // Data completeness (more complete data = higher confidence)
  const fields = [
    person.full_name,
    person.gender,
    person.birth_year || person.birth_date,
    person.generation_level,
    person.living_status,
  ];
  dataCompleteness = fields.filter(f => f !== null && f !== undefined).length / fields.length;

  // Name clarity (longer, well-formatted names are more confident)
  if (person.full_name) {
    const nameWords = person.full_name.trim().split(/\s+/);
    if (nameWords.length >= 2) {
      nameClarity = 1.0;
    } else if (nameWords.length === 1 && nameWords[0].length > 3) {
      nameClarity = 0.7;
    } else {
      nameClarity = 0.5;
    }
  }

  // Date validity
  if (person.birth_year && person.death_year) {
    if (person.death_year >= person.birth_year) {
      dateValidity = 1.0;
    } else {
      dateValidity = 0.3; // Contradictory dates
    }
  } else if (person.birth_year || person.death_year) {
    dateValidity = 0.8; // Partial date info
  } else {
    dateValidity = 0.6; // No date info
  }

  // Overall confidence (weighted average)
  const overall = (
    dataCompleteness * 0.3 +
    nameClarity * 0.25 +
    dateValidity * 0.25 +
    sourceVerification * 0.2
  );

  return {
    overall: Math.round(overall * 100) / 100,
    dataCompleteness: Math.round(dataCompleteness * 100) / 100,
    nameClarity: Math.round(nameClarity * 100) / 100,
    dateValidity: Math.round(dateValidity * 100) / 100,
    relationshipClarity: 1.0, // Will be calculated separately
    sourceVerification: Math.round(sourceVerification * 100) / 100,
  };
}

/**
 * Calculate confidence for a relationship
 */
export function calculateRelationshipConfidence(
  relationship: ExtractedRelationship,
  sourcePerson?: ExtractedFamilyMember,
  targetPerson?: ExtractedFamilyMember
): number {
  let confidence = relationship.confidence_score || 0.7;

  // Boost confidence if both people are verified
  if (sourcePerson?.verification_status === 'verified' && 
      targetPerson?.verification_status === 'verified') {
    confidence = Math.min(1.0, confidence + 0.1);
  }

  // Reduce confidence for uncertain relationship types
  if (relationship.verification_status === 'uncertain') {
    confidence = Math.max(0.3, confidence - 0.2);
  }

  // Boost confidence if there's supporting evidence
  if (relationship.source_page_numbers.length > 1) {
    confidence = Math.min(1.0, confidence + 0.05);
  }

  // Reduce confidence if there's conflicting information
  if (relationship.verification_status === 'conflicting') {
    confidence = Math.max(0.2, confidence - 0.3);
  }

  return Math.round(confidence * 100) / 100;
}

/**
 * Determine verification status based on confidence score
 */
export function suggestVerificationStatus(confidence: number): VerificationStatus {
  if (confidence >= 0.85) return 'verified';
  if (confidence >= 0.60) return 'needs_review';
  return 'uncertain';
}

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICATION ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update verification status for an extracted person
 */
export async function updatePersonVerificationStatus(
  personId: string,
  status: VerificationStatus,
  notes?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) {
    return { ok: false, error: 'Supabase not configured' };
  }

  try {
    const { error } = await supabase
      .from('extracted_family_members')
      .update({
        verification_status: status,
        admin_notes: notes || null,
        admin_edited: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', personId);

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

/**
 * Update verification status for a relationship
 */
export async function updateRelationshipVerificationStatus(
  relationshipId: string,
  status: ExtractedRelationship['verification_status'],
  notes?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) {
    return { ok: false, error: 'Supabase not configured' };
  }

  try {
    const { error } = await supabase
      .from('extracted_relationships')
      .update({
        verification_status: status,
        admin_notes: notes || null,
        admin_edited: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', relationshipId);

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

/**
 * Bulk verify multiple people at once
 */
export async function bulkVerifyPeople(
  personIds: string[],
  status: VerificationStatus = 'verified'
): Promise<{ ok: boolean; updated: number; error?: string }> {
  if (!supabase) {
    return { ok: false, updated: 0, error: 'Supabase not configured' };
  }

  try {
    const { error, count } = await supabase
      .from('extracted_family_members')
      .update({
        verification_status: status,
        admin_edited: true,
        updated_at: new Date().toISOString(),
      })
      .in('id', personIds);

    if (error) {
      return { ok: false, updated: 0, error: error.message };
    }

    return { ok: true, updated: count || 0 };
  } catch (error: any) {
    return { ok: false, updated: 0, error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DUPLICATE MERGING
// ─────────────────────────────────────────────────────────────────────────────

export interface MergeStrategy {
  keepPrimary: boolean; // Keep primary's data when conflicts
  preserveAllSources: boolean; // Combine source pages from both
  preferHigherConfidence: boolean; // Use data from higher confidence record
}

/**
 * Merge two extracted people (handles internal duplicates)
 */
export async function mergeExtractedPeople(
  primaryId: string,
  duplicateId: string,
  strategy: MergeStrategy = {
    keepPrimary: false,
    preserveAllSources: true,
    preferHigherConfidence: true,
  }
): Promise<{ ok: boolean; mergedId?: string; error?: string }> {
  if (!supabase) {
    return { ok: false, error: 'Supabase not configured' };
  }

  try {
    // Get both records
    const { data: people, error: fetchError } = await supabase
      .from('extracted_family_members')
      .select('*')
      .in('id', [primaryId, duplicateId]);

    if (fetchError || !people || people.length !== 2) {
      return { ok: false, error: 'Could not fetch both records' };
    }

    const primary = people.find(p => p.id === primaryId)!;
    const duplicate = people.find(p => p.id === duplicateId)!;

    // Merge data based on strategy
    const merged: Partial<ExtractedFamilyMember> = {};

    if (strategy.preferHigherConfidence) {
      // Use data from record with higher confidence
      const usePrimary = (primary.confidence_score || 0) >= (duplicate.confidence_score || 0);
      const source = usePrimary ? primary : duplicate;
      
      Object.assign(merged, source);
    } else if (strategy.keepPrimary) {
      Object.assign(merged, primary);
    } else {
      // Use most complete data
      Object.keys(primary).forEach(key => {
        const pVal = (primary as any)[key];
        const dVal = (duplicate as any)[key];
        (merged as any)[key] = pVal || dVal;
      });
    }

    // Always combine source pages
    if (strategy.preserveAllSources) {
      merged.source_page_numbers = Array.from(new Set([
        ...primary.source_page_numbers,
        ...duplicate.source_page_numbers,
      ])).sort((a, b) => a - b);
    }

    // Update primary record with merged data
    const { error: updateError } = await supabase
      .from('extracted_family_members')
      .update({
        ...merged,
        admin_edited: true,
        admin_notes: `Merged with duplicate record (${duplicateId})`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', primaryId);

    if (updateError) {
      return { ok: false, error: updateError.message };
    }

    // Mark duplicate as rejected
    const { error: rejectError } = await supabase
      .from('extracted_family_members')
      .update({
        verification_status: 'rejected',
        admin_notes: `Merged into ${primaryId}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', duplicateId);

    if (rejectError) {
      console.error('Error marking duplicate as rejected:', rejectError);
    }

    // Update relationships to point to primary
    await supabase
      .from('extracted_relationships')
      .update({ source_extracted_id: primaryId })
      .eq('source_extracted_id', duplicateId);

    await supabase
      .from('extracted_relationships')
      .update({ target_extracted_id: primaryId })
      .eq('target_extracted_id', duplicateId);

    return { ok: true, mergedId: primaryId };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

/**
 * Link extracted person to existing family member (resolves duplicate)
 */
export async function linkToExistingPerson(
  extractedPersonId: string,
  existingPersonId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) {
    return { ok: false, error: 'Supabase not configured' };
  }

  try {
    const { error } = await supabase
      .from('extracted_family_members')
      .update({
        verification_status: 'duplicate',
        potential_duplicate_of: existingPersonId,
        admin_edited: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', extractedPersonId);

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFLICT RESOLUTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a conflict by accepting one version
 */
export async function resolveConflict(
  conflictId: string,
  resolution: 'resolved' | 'ignored',
  notes?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) {
    return { ok: false, error: 'Supabase not configured' };
  }

  try {
    const { data: user } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('import_conflicts')
      .update({
        resolution_status: resolution,
        resolved_by: user.user?.id,
        resolved_at: new Date().toISOString(),
        resolution_notes: notes || null,
      })
      .eq('id', conflictId);

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICATION STATISTICS
// ─────────────────────────────────────────────────────────────────────────────

export interface VerificationStats {
  totalPeople: number;
  verifiedPeople: number;
  needsReviewPeople: number;
  uncertainPeople: number;
  duplicatePeople: number;
  rejectedPeople: number;
  totalRelationships: number;
  verifiedRelationships: number;
  needsReviewRelationships: number;
  uncertainRelationships: number;
  conflictingRelationships: number;
  totalConflicts: number;
  resolvedConflicts: number;
  pendingConflicts: number;
  averageConfidence: number;
  readyToImport: boolean;
}

/**
 * Get verification statistics for an import job
 */
export async function getVerificationStats(
  jobId: string
): Promise<{ ok: boolean; stats?: VerificationStats; error?: string }> {
  if (!supabase) {
    return { ok: false, error: 'Supabase not configured' };
  }

  try {
    // Fetch all extracted members
    const { data: people, error: peopleError } = await supabase
      .from('extracted_family_members')
      .select('verification_status, confidence_score')
      .eq('import_job_id', jobId);

    if (peopleError) {
      return { ok: false, error: peopleError.message };
    }

    // Fetch all relationships
    const { data: relationships, error: relsError } = await supabase
      .from('extracted_relationships')
      .select('verification_status, confidence_score')
      .eq('import_job_id', jobId);

    if (relsError) {
      return { ok: false, error: relsError.message };
    }

    // Fetch conflicts
    const { data: conflicts, error: conflictsError } = await supabase
      .from('import_conflicts')
      .select('resolution_status')
      .eq('import_job_id', jobId);

    if (conflictsError) {
      return { ok: false, error: conflictsError.message };
    }

    // Calculate statistics
    const stats: VerificationStats = {
      totalPeople: people?.length || 0,
      verifiedPeople: people?.filter(p => p.verification_status === 'verified').length || 0,
      needsReviewPeople: people?.filter(p => p.verification_status === 'needs_review').length || 0,
      uncertainPeople: people?.filter(p => p.verification_status === 'uncertain').length || 0,
      duplicatePeople: people?.filter(p => p.verification_status === 'duplicate').length || 0,
      rejectedPeople: people?.filter(p => p.verification_status === 'rejected').length || 0,
      
      totalRelationships: relationships?.length || 0,
      verifiedRelationships: relationships?.filter(r => r.verification_status === 'verified').length || 0,
      needsReviewRelationships: relationships?.filter(r => r.verification_status === 'needs_review').length || 0,
      uncertainRelationships: relationships?.filter(r => r.verification_status === 'uncertain').length || 0,
      conflictingRelationships: relationships?.filter(r => r.verification_status === 'conflicting').length || 0,
      
      totalConflicts: conflicts?.length || 0,
      resolvedConflicts: conflicts?.filter(c => c.resolution_status === 'resolved').length || 0,
      pendingConflicts: conflicts?.filter(c => c.resolution_status === 'pending').length || 0,
      
      averageConfidence: 0,
      readyToImport: false,
    };

    // Calculate average confidence
    const allConfidences = [
      ...(people?.map(p => p.confidence_score || 0) || []),
      ...(relationships?.map(r => r.confidence_score || 0) || []),
    ];
    stats.averageConfidence = allConfidences.length > 0
      ? Math.round((allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length) * 100) / 100
      : 0;

    // Determine if ready to import
    stats.readyToImport = 
      stats.verifiedPeople > 0 &&
      stats.uncertainPeople === 0 &&
      stats.pendingConflicts === 0 &&
      stats.averageConfidence >= 0.70;

    return { ok: true, stats };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Automatically verify high-confidence extractions
 * 
 * This can speed up the review process by auto-verifying obvious cases
 */
export async function autoVerifyHighConfidence(
  jobId: string,
  confidenceThreshold: number = 0.90
): Promise<{ ok: boolean; autoVerified: number; error?: string }> {
  if (!supabase) {
    return { ok: false, autoVerified: 0, error: 'Supabase not configured' };
  }

  try {
    // Auto-verify people with high confidence
    const { error: peopleError, count: peopleCount } = await supabase
      .from('extracted_family_members')
      .update({
        verification_status: 'verified',
        admin_notes: 'Auto-verified (high confidence)',
        updated_at: new Date().toISOString(),
      })
      .eq('import_job_id', jobId)
      .gte('confidence_score', confidenceThreshold)
      .eq('verification_status', 'needs_review');

    if (peopleError) {
      return { ok: false, autoVerified: 0, error: peopleError.message };
    }

    // Auto-verify relationships with high confidence
    const { error: relsError, count: relsCount } = await supabase
      .from('extracted_relationships')
      .update({
        verification_status: 'verified',
        admin_notes: 'Auto-verified (high confidence)',
        updated_at: new Date().toISOString(),
      })
      .eq('import_job_id', jobId)
      .gte('confidence_score', confidenceThreshold)
      .eq('verification_status', 'needs_review');

    if (relsError) {
      return { ok: false, autoVerified: 0, error: relsError.message };
    }

    return { 
      ok: true, 
      autoVerified: (peopleCount || 0) + (relsCount || 0)
    };
  } catch (error: any) {
    return { ok: false, autoVerified: 0, error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICATION RECOMMENDATIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface VerificationRecommendation {
  personId: string;
  personName: string;
  currentStatus: VerificationStatus;
  recommendedStatus: VerificationStatus;
  reason: string;
  confidence: number;
}

/**
 * Generate verification recommendations based on data quality
 */
export async function generateVerificationRecommendations(
  jobId: string
): Promise<{ ok: boolean; recommendations?: VerificationRecommendation[]; error?: string }> {
  if (!supabase) {
    return { ok: false, error: 'Supabase not configured' };
  }

  try {
    const { data: people, error } = await supabase
      .from('extracted_family_members')
      .select('*')
      .eq('import_job_id', jobId)
      .in('verification_status', ['needs_review', 'uncertain']);

    if (error || !people) {
      return { ok: false, error: error?.message || 'No data found' };
    }

    const recommendations: VerificationRecommendation[] = [];

    people.forEach(person => {
      const metrics = calculatePersonConfidence(person);
      const recommended = suggestVerificationStatus(metrics.overall);

      if (recommended !== person.verification_status) {
        let reason = '';
        
        if (recommended === 'verified') {
          reason = 'High data quality and confidence score';
        } else if (recommended === 'needs_review') {
          reason = 'Moderate confidence, manual review recommended';
        } else {
          reason = 'Low confidence or incomplete data';
        }

        recommendations.push({
          personId: person.id,
          personName: person.full_name,
          currentStatus: person.verification_status,
          recommendedStatus: recommended,
          reason,
          confidence: metrics.overall,
        });
      }
    });

    return { ok: true, recommendations };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}
