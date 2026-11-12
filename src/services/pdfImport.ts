import { supabase, isSupabaseConfigured } from './supabase';
import type { 
  FamilyImportJob, 
  ExtractedFamilyMember, 
  ExtractedRelationship,
  ImportConflict,
  ImportReviewHistory 
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// PDF UPLOAD
// ─────────────────────────────────────────────────────────────────────────────

export interface UploadPDFResult {
  ok: boolean;
  jobId?: string;
  error?: string;
}

/**
 * Upload a PDF file to Supabase Storage and create an import job.
 * 
 * @param familyId - The family to import into
 * @param file - The PDF file to upload
 * @param onProgress - Optional callback for upload progress (0-100)
 * @returns Upload result with job ID or error
 */
export async function uploadPDFForImport(
  familyId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadPDFResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: 'Supabase is not configured' };
  }

  try {
    // Validate file
    if (file.type !== 'application/pdf') {
      return { ok: false, error: 'Only PDF files are supported' };
    }

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return { ok: false, error: 'File size exceeds 50MB limit' };
    }

    // Generate unique file path
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${familyId}/${timestamp}_${sanitizedFileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('family-import-pdfs')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return { ok: false, error: uploadError.message };
    }

    if (onProgress) onProgress(50);

    // Create import job record
    const { data: jobData, error: jobError } = await supabase
      .rpc('create_import_job', {
        p_family_id: familyId,
        p_file_name: file.name,
        p_file_size_bytes: file.size,
        p_file_path: filePath,
        p_mime_type: file.type,
      });

    if (jobError) {
      console.error('Job creation error:', jobError);
      // Clean up uploaded file
      await supabase.storage
        .from('family-import-pdfs')
        .remove([filePath]);
      return { ok: false, error: jobError.message };
    }

    if (onProgress) onProgress(100);

    return { ok: true, jobId: jobData };

  } catch (error: any) {
    console.error('Upload error:', error);
    return { ok: false, error: error.message || 'Upload failed' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT JOBS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all import jobs for a family
 */
export async function getImportJobs(
  familyId: string
): Promise<{ ok: boolean; jobs?: FamilyImportJob[]; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: 'Supabase is not configured' };
  }

  try {
    const { data, error } = await supabase
      .from('family_import_jobs')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching import jobs:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true, jobs: data as FamilyImportJob[] };
  } catch (error: any) {
    console.error('Error:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Get a single import job by ID
 */
export async function getImportJob(
  jobId: string
): Promise<{ ok: boolean; job?: FamilyImportJob; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: 'Supabase is not configured' };
  }

  try {
    const { data, error } = await supabase
      .from('family_import_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      console.error('Error fetching import job:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true, job: data as FamilyImportJob };
  } catch (error: any) {
    console.error('Error:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Update import job status
 */
export async function updateImportJobStatus(
  jobId: string,
  status: FamilyImportJob['status'],
  updates?: Partial<FamilyImportJob>
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: 'Supabase is not configured' };
  }

  try {
    const { error } = await supabase
      .from('family_import_jobs')
      .update({
        status,
        updated_at: new Date().toISOString(),
        ...updates,
      })
      .eq('id', jobId);

    if (error) {
      console.error('Error updating job status:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error: any) {
    console.error('Error:', error);
    return { ok: false, error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACTED MEMBERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get extracted family members for an import job
 */
export async function getExtractedMembers(
  jobId: string
): Promise<{ ok: boolean; members?: ExtractedFamilyMember[]; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: 'Supabase is not configured' };
  }

  try {
    const { data, error } = await supabase
      .from('extracted_family_members')
      .select('*')
      .eq('import_job_id', jobId)
      .order('generation_level', { ascending: true })
      .order('child_number', { ascending: true });

    if (error) {
      console.error('Error fetching extracted members:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true, members: data as ExtractedFamilyMember[] };
  } catch (error: any) {
    console.error('Error:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Update an extracted family member
 */
export async function updateExtractedMember(
  memberId: string,
  updates: Partial<ExtractedFamilyMember>
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: 'Supabase is not configured' };
  }

  try {
    const { error } = await supabase
      .from('extracted_family_members')
      .update({
        ...updates,
        admin_edited: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', memberId);

    if (error) {
      console.error('Error updating extracted member:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error: any) {
    console.error('Error:', error);
    return { ok: false, error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACTED RELATIONSHIPS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get extracted relationships for an import job
 */
export async function getExtractedRelationships(
  jobId: string
): Promise<{ ok: boolean; relationships?: ExtractedRelationship[]; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: 'Supabase is not configured' };
  }

  try {
    const { data, error } = await supabase
      .from('extracted_relationships')
      .select('*')
      .eq('import_job_id', jobId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching extracted relationships:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true, relationships: data as ExtractedRelationship[] };
  } catch (error: any) {
    console.error('Error:', error);
    return { ok: false, error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFLICTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get import conflicts for a job
 */
export async function getImportConflicts(
  jobId: string
): Promise<{ ok: boolean; conflicts?: ImportConflict[]; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: 'Supabase is not configured' };
  }

  try {
    const { data, error } = await supabase
      .from('import_conflicts')
      .select('*')
      .eq('import_job_id', jobId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching conflicts:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true, conflicts: data as ImportConflict[] };
  } catch (error: any) {
    console.error('Error:', error);
    return { ok: false, error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REVIEW HISTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add a review history entry
 */
export async function addReviewHistoryEntry(
  jobId: string,
  action: ImportReviewHistory['action'],
  targetType?: ImportReviewHistory['target_type'],
  targetId?: string,
  changes?: any,
  notes?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: 'Supabase is not configured' };
  }

  try {
    const { error } = await supabase
      .from('import_review_history')
      .insert({
        import_job_id: jobId,
        reviewed_by: (await supabase.auth.getUser()).data.user?.id,
        action,
        target_type: targetType,
        target_id: targetId,
        changes,
        notes,
      });

    if (error) {
      console.error('Error adding review history:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error: any) {
    console.error('Error:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Get PDF download URL (signed URL for private bucket)
 */
export async function getPDFDownloadUrl(
  filePath: string
): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: 'Supabase is not configured' };
  }

  try {
    const { data, error } = await supabase.storage
      .from('family-import-pdfs')
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (error) {
      console.error('Error creating signed URL:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true, url: data.signedUrl };
  } catch (error: any) {
    console.error('Error:', error);
    return { ok: false, error: error.message };
  }
}
