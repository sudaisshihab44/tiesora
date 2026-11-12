import { supabase } from './supabase';
import type {
  ExtractedFamilyMember,
  ExtractedRelationship,
  FamilyImportJob,
} from '../types';

/**
 * Import Transaction Service
 * Handles the secure, atomic import of approved family data from staging tables
 * into the main family database with full RLS enforcement and transaction safety.
 */

interface ImportResult {
  success: boolean;
  importedPeople: number;
  importedRelationships: number;
  errors: string[];
  personIdMapping: Record<string, string>; // extracted_id -> family_people.id
}

/**
 * Execute the complete import transaction for an approved job.
 * This function calls the PostgreSQL function to perform atomic import.
 * 
 * Flow:
 * 1. Verify job status is 'ready_to_import'
 * 2. Call PostgreSQL function import_approved_family_data
 * 3. Handle results and return detailed import information
 */
export async function executeImportTransaction(
  jobId: string,
  familyId: string
): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    importedPeople: 0,
    importedRelationships: 0,
    errors: [],
    personIdMapping: {},
  };

  try {
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    // Verify job is ready to import
    const { data: job, error: jobError } = await supabase
      .from('family_import_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('family_id', familyId)
      .single();

    if (jobError) throw new Error(`Failed to load import job: ${jobError.message}`);
    if (!job) throw new Error('Import job not found');
    if (job.status !== 'ready_to_import') {
      throw new Error(`Import job is not ready (status: ${job.status})`);
    }

    // Call PostgreSQL function to perform atomic import
    const { data, error } = await supabase.rpc('import_approved_family_data', {
      p_job_id: jobId,
      p_family_id: familyId,
    });

    if (error) {
      throw new Error(`Import transaction failed: ${error.message}`);
    }

    // Parse result from PostgreSQL function
    if (data) {
      result.success = data.success || false;
      result.importedPeople = data.importedPeople || 0;
      result.importedRelationships = data.importedRelationships || 0;
      result.errors = data.errors || [];
      result.personIdMapping = data.personIdMapping || {};
    }

    return result;
  } catch (err) {
    // Fatal error
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    result.errors.push(errorMsg);

    // Try to update job status to failed (best effort)
    if (supabase) {
      try {
        await supabase
          .from('family_import_jobs')
          .update({
            status: 'failed',
            import_summary: { error: errorMsg },
          })
          .eq('id', jobId);
      } catch {
        // Ignore secondary error
      }
    }

    return result;
  }
}

/**
 * Get import job history for a family
 */
export async function getImportHistory(familyId: string): Promise<FamilyImportJob[]> {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  const { data, error } = await supabase
    .from('family_import_jobs')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get detailed import statistics
 */
export async function getImportStatistics(jobId: string) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  const { data: job, error: jobError } = await supabase
    .from('family_import_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobError) throw jobError;

  const { count: totalMembers } = await supabase
    .from('extracted_family_members')
    .select('*', { count: 'exact', head: true })
    .eq('import_job_id', jobId);

  const { count: verifiedMembers } = await supabase
    .from('extracted_family_members')
    .select('*', { count: 'exact', head: true })
    .eq('import_job_id', jobId)
    .eq('verification_status', 'verified');

  const { count: totalRelationships } = await supabase
    .from('extracted_relationships')
    .select('*', { count: 'exact', head: true })
    .eq('import_job_id', jobId);

  const { count: unresolvedConflicts } = await supabase
    .from('import_conflicts')
    .select('*', { count: 'exact', head: true })
    .eq('import_job_id', jobId)
    .eq('resolved', false);

  return {
    job,
    totalMembers: totalMembers || 0,
    verifiedMembers: verifiedMembers || 0,
    totalRelationships: totalRelationships || 0,
    unresolvedConflicts: unresolvedConflicts || 0,
  };
}

/**
 * Cancel an import job and clean up staging data
 */
export async function cancelImportJob(jobId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  // Delete all related data
  await supabase.from('import_review_history').delete().eq('import_job_id', jobId);
  await supabase.from('import_conflicts').delete().eq('import_job_id', jobId);
  await supabase.from('extracted_relationships').delete().eq('import_job_id', jobId);
  await supabase.from('extracted_family_members').delete().eq('import_job_id', jobId);
  await supabase.from('family_import_pages').delete().eq('import_job_id', jobId);

  // Update job status
  await supabase
    .from('family_import_jobs')
    .update({ status: 'cancelled' })
    .eq('id', jobId);
}

/**
 * Rollback an import (admin only, use with caution)
 * This removes all people and relationships that were imported from a specific job
 */
export async function rollbackImport(jobId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  // Get all linked person IDs
  const { data: linkedMembers, error } = await supabase
    .from('extracted_family_members')
    .select('linked_person_id')
    .eq('import_job_id', jobId)
    .not('linked_person_id', 'is', null);

  if (error) throw error;

  if (linkedMembers && linkedMembers.length > 0) {
    const personIds = linkedMembers.map(m => m.linked_person_id).filter(Boolean);

    // Delete relationships involving these people
    for (const personId of personIds) {
      await supabase
        .from('relationships')
        .delete()
        .or(`source_person_id.eq.${personId},target_person_id.eq.${personId}`);
    }

    // Delete the people
    await supabase.from('family_people').delete().in('id', personIds as string[]);

    // Clear linked_person_id in extracted members
    await supabase
      .from('extracted_family_members')
      .update({ linked_person_id: null })
      .eq('import_job_id', jobId);

    // Update job status
    await supabase
      .from('family_import_jobs')
      .update({
        status: 'rolled_back',
        import_summary: { rollback_date: new Date().toISOString() },
      })
      .eq('id', jobId);
  }
}
