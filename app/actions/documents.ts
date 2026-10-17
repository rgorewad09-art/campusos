'use server';

import { createClient } from '@/src/lib/supabase/server';
import { logAuditAction } from '@/src/lib/audit';
import { isValidUuid, isAuthError } from '@/src/lib/security';
import {
  DOCUMENT_CATEGORIES,
  MAX_FILE_SIZE_BYTES,
  type DocumentCategory,
  type StudentDocument,
} from '@/src/types/document';

/**
 * Server-side authorization check.
 * Verifies that the caller is authenticated and holds role = 'admin' in public.profiles.
 */
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized: You must be signed in to perform this action.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== 'admin') {
    throw new Error('Forbidden: Only authorized administrators can perform this action.');
  }

  return { supabase, user };
}

/**
 * Inspects binary magic bytes from the file header to determine genuine MIME type.
 * Protects against disguised or malicious file extensions.
 */
function detectMimeTypeFromBuffer(buffer: Uint8Array): string | null {
  if (buffer.length < 4) return null;

  // PDF: %PDF- (0x25 0x50 0x44 0x46)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return 'application/pdf';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // WEBP: RIFF....WEBP (0x52 0x49 0x46 0x46 ... 0x57 0x45 0x42 0x50)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Fetch all documents associated with a student.
 */
export async function getStudentDocumentsAction(
  studentId: string
): Promise<{ success: boolean; documents?: StudentDocument[]; error?: string }> {
  try {
    const { supabase } = await requireAdmin();

    if (!isValidUuid(studentId)) {
      return { success: false, error: 'Invalid student ID format.' };
    }

    const { data, error } = await supabase
      .from('student_documents')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[CampusOS Documents] getStudentDocumentsAction query error:', error);
      return { success: false, error: 'Failed to retrieve student documents. Please try again.' };
    }

    return {
      success: true,
      documents: (data as StudentDocument[]) || [],
    };
  } catch (err: unknown) {
    console.error('[CampusOS Documents] getStudentDocumentsAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to retrieve student documents. Please try again.';
    return { success: false, error: message };
  }
}

/**
 * Fetch all student documents with student details for Document Management.
 */
export async function getAllDocumentsAction(options?: {
  status?: string;
  search?: string;
}): Promise<{
  success: boolean;
  documents?: (StudentDocument & {
    student?: {
      id: string;
      first_name: string;
      last_name: string;
      student_code: string;
    };
  })[];
  error?: string;
}> {
  try {
    const { supabase } = await requireAdmin();

    let query = supabase
      .from('student_documents')
      .select(`
        *,
        student:students(
          id,
          first_name,
          last_name,
          student_code
        )
      `)
      .order('created_at', { ascending: false });

    if (options?.status && options.status !== 'all') {
      query = query.eq('verification_status', options.status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[CampusOS Documents] getAllDocumentsAction query error:', error);
      return { success: false, error: 'Failed to retrieve documents.' };
    }

    let docs = (data as any[]) || [];
    if (options?.search && options.search.trim().length > 0) {
      const q = options.search.trim().toLowerCase();
      docs = docs.filter((d) => {
        const studentName = `${d.student?.first_name || ''} ${d.student?.last_name || ''}`.toLowerCase();
        const studentCode = (d.student?.student_code || '').toLowerCase();
        const filename = (d.original_filename || '').toLowerCase();
        return studentName.includes(q) || studentCode.includes(q) || filename.includes(q);
      });
    }

    return {
      success: true,
      documents: docs,
    };
  } catch (err: unknown) {
    console.error('[CampusOS Documents] getAllDocumentsAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to retrieve documents.';
    return { success: false, error: message };
  }
}

/**
 * Upload a new student document to private Storage and create database record.
 * Handles orphaned storage files if the database insert fails.
 */
export async function uploadStudentDocumentAction(
  formData: FormData
): Promise<{ success: boolean; document?: StudentDocument; error?: string }> {
  let uploadedStoragePath: string | null = null;
  let supabaseClientRef: Awaited<ReturnType<typeof createClient>> | null = null;

  try {
    const { supabase, user } = await requireAdmin();
    supabaseClientRef = supabase;

    const studentId = formData.get('student_id')?.toString()?.trim();
    const category = formData.get('category')?.toString()?.trim() as DocumentCategory;
    const file = formData.get('file') as File | null;

    if (!studentId || !isValidUuid(studentId)) {
      return { success: false, error: 'A valid student ID is required.' };
    }

    // Verify student exists in database before proceeding with storage upload
    const { data: studentRecord, error: studentCheckError } = await supabase
      .from('students')
      .select('id')
      .eq('id', studentId)
      .maybeSingle();

    if (studentCheckError || !studentRecord) {
      if (studentCheckError) {
        console.error('[CampusOS Documents] Student existence check error:', studentCheckError);
      }
      return { success: false, error: 'Specified student does not exist.' };
    }

    // Validate category
    const validCategory = DOCUMENT_CATEGORIES.some((c) => c.value === category);
    if (!validCategory) {
      return {
        success: false,
        error: 'Please select a valid document category.',
      };
    }

    // Validate file presence
    if (!file || !(file instanceof File) || file.size === 0) {
      return { success: false, error: 'Please select a valid, non-empty file to upload.' };
    }

    // Validate original filename (explicitly from formData or file object)
    const originalFilename = (
      formData.get('original_filename')?.toString() ||
      file.name ||
      ''
    ).trim();

    if (!originalFilename || originalFilename.length === 0) {
      return {
        success: false,
        error: 'The uploaded file must have a valid, non-empty filename.',
      };
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        success: false,
        error: `File size exceeds the 10 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
      };
    }

    // Read file buffer and validate magic bytes on server
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const verifiedMimeType = detectMimeTypeFromBuffer(buffer);

    if (!verifiedMimeType) {
      return {
        success: false,
        error:
          'Unsupported file format. Please upload a genuine PDF, JPEG, PNG, or WebP document.',
      };
    }

    // Derive file extension
    const extMap: Record<string, string> = {
      'application/pdf': 'pdf',
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
    };
    const extension = extMap[verifiedMimeType] || 'bin';

    // Generate unique, non-guessable storage path strictly scoped to student UUID
    const docId = crypto.randomUUID();
    const sanitizedName = originalFilename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 60);
    const storagePath = `students/${studentId}/${docId}_${sanitizedName}`;
    uploadedStoragePath = storagePath;

    // 1. Upload to Supabase Storage bucket 'student-documents'
    const { error: storageError } = await supabase.storage
      .from('student-documents')
      .upload(storagePath, buffer, {
        contentType: verifiedMimeType,
        upsert: false,
      });

    if (storageError) {
      console.error('[CampusOS Documents] Storage upload failed:', storageError);
      return {
        success: false,
        error: 'Failed to upload document file. Please try again.',
      };
    }

    // 2. Insert metadata into public.student_documents
    // Ensure original_filename is always explicitly provided to satisfy NOT NULL constraint
    let insertResult = await supabase
      .from('student_documents')
      .insert({
        id: docId,
        student_id: studentId,
        document_type: category,
        storage_path: storagePath,
        original_filename: originalFilename,
        file_name: originalFilename,
        file_size: file.size,
        mime_type: verifiedMimeType,
        verification_status: 'pending',
      })
      .select('*')
      .single();

    // If enhanced insert fails due to optional columns (file_name, file_size, mime_type) not in schema, fall back
    if (insertResult.error && insertResult.error.message.includes('column')) {
      insertResult = await supabase
        .from('student_documents')
        .insert({
          id: docId,
          student_id: studentId,
          document_type: category,
          storage_path: storagePath,
          original_filename: originalFilename,
          verification_status: 'pending',
        })
        .select('*')
        .single();
    }

    // If database insertion failed, roll back the storage upload to prevent orphaned files
    if (insertResult.error || !insertResult.data) {
      console.error(
        '[CampusOS Documents] Database insert failed, cleaning up orphaned storage file:',
        insertResult.error
      );
      try {
        await supabase.storage.from('student-documents').remove([storagePath]);
      } catch (cleanupErr) {
        console.error('[CampusOS Documents] Rollback cleanup error:', cleanupErr);
      }
      return {
        success: false,
        error: 'Could not save document record. The upload was cleanly cancelled.',
      };
    }

    // 3. Log audit event
    await logAuditAction({
      actorId: user.id,
      action: 'upload_document',
      entityType: 'student_document',
      entityId: docId,
      details: {
        student_id: studentId,
        category,
        original_filename: originalFilename,
        file_size: file.size,
        mime_type: verifiedMimeType,
        storage_path: storagePath,
      },
    });

    return {
      success: true,
      document: insertResult.data as StudentDocument,
    };
  } catch (err: unknown) {
    // Safety cleanup in case of unhandled exception
    if (uploadedStoragePath && supabaseClientRef) {
      try {
        await supabaseClientRef.storage
          .from('student-documents')
          .remove([uploadedStoragePath]);
      } catch (cleanupErr) {
        console.error('[CampusOS Documents] Rollback cleanup error:', cleanupErr);
      }
    }

    console.error('[CampusOS Documents] uploadStudentDocumentAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'An unexpected error occurred during upload. Please try again.';
    return { success: false, error: message };
  }
}

/**
 * Generate a short-lived signed URL for an authorized administrator to view/download a document.
 * Avoids exposing public URLs for private documents.
 */
export async function getDocumentSignedUrlAction(
  documentId: string
): Promise<{ success: boolean; signedUrl?: string; error?: string }> {
  try {
    const { supabase } = await requireAdmin();

    if (!isValidUuid(documentId)) {
      return { success: false, error: 'Invalid document ID format.' };
    }

    // Look up document record to obtain storage_path
    const { data: doc, error: docError } = await supabase
      .from('student_documents')
      .select('storage_path')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      if (docError) {
        console.error('[CampusOS Documents] getDocumentSignedUrlAction query error:', docError);
      }
      return { success: false, error: 'Document record not found.' };
    }

    // Generate signed URL valid for 60 seconds
    const { data: signedData, error: signError } = await supabase.storage
      .from('student-documents')
      .createSignedUrl(doc.storage_path, 60);

    if (signError || !signedData?.signedUrl) {
      console.error('[CampusOS Documents] getDocumentSignedUrlAction sign error:', signError);
      return {
        success: false,
        error: 'Could not generate secure view URL.',
      };
    }

    return {
      success: true,
      signedUrl: signedData.signedUrl,
    };
  } catch (err: unknown) {
    console.error('[CampusOS Documents] getDocumentSignedUrlAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to generate document access link.';
    return { success: false, error: message };
  }
}

/**
 * Mark a document as verified.
 * Records the verifying administrator UUID and timestamp.
 */
export async function verifyDocumentAction(
  documentId: string
): Promise<{ success: boolean; document?: StudentDocument; error?: string }> {
  try {
    const { supabase, user } = await requireAdmin();

    if (!isValidUuid(documentId)) {
      return { success: false, error: 'Invalid document ID format.' };
    }

    const timestamp = new Date().toISOString();

    // Attempt update with rejection_reason cleared
    let updateResult = await supabase
      .from('student_documents')
      .update({
        verification_status: 'verified',
        verified_by: user.id,
        verified_at: timestamp,
        rejection_reason: null,
      })
      .eq('id', documentId)
      .select('*')
      .single();

    // Fallback if rejection_reason column is not in initial schema
    if (updateResult.error && updateResult.error.message.includes('column')) {
      updateResult = await supabase
        .from('student_documents')
        .update({
          verification_status: 'verified',
          verified_by: user.id,
          verified_at: timestamp,
        })
        .eq('id', documentId)
        .select('*')
        .single();
    }

    if (updateResult.error || !updateResult.data) {
      console.error('[CampusOS Documents] verifyDocumentAction error:', updateResult.error);
      return {
        success: false,
        error: 'Failed to verify document. Please try again.',
      };
    }

    // Audit log
    await logAuditAction({
      actorId: user.id,
      action: 'verify_document',
      entityType: 'student_document',
      entityId: documentId,
      details: {
        outcome: 'verified',
        verified_at: timestamp,
        student_id: updateResult.data.student_id,
      },
    });

    return {
      success: true,
      document: updateResult.data as StudentDocument,
    };
  } catch (err: unknown) {
    console.error('[CampusOS Documents] verifyDocumentAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to verify document. Please try again.';
    return { success: false, error: message };
  }
}

/**
 * Reject a document with a mandatory rejection reason.
 * Records the reviewing administrator, timestamp, and rejection reason.
 */
export async function rejectDocumentAction(
  documentId: string,
  reason: string
): Promise<{ success: boolean; document?: StudentDocument; error?: string }> {
  try {
    const { supabase, user } = await requireAdmin();

    if (!isValidUuid(documentId)) {
      return { success: false, error: 'Invalid document ID format.' };
    }

    const trimmedReason = reason?.trim();
    if (!trimmedReason) {
      return { success: false, error: 'A rejection reason is required.' };
    }

    const timestamp = new Date().toISOString();

    // Attempt update including rejection_reason
    let updateResult = await supabase
      .from('student_documents')
      .update({
        verification_status: 'rejected',
        verified_by: user.id,
        verified_at: timestamp,
        rejection_reason: trimmedReason,
      })
      .eq('id', documentId)
      .select('*')
      .single();

    // Fallback if rejection_reason column is not yet present in database
    if (updateResult.error && updateResult.error.message.includes('column')) {
      updateResult = await supabase
        .from('student_documents')
        .update({
          verification_status: 'rejected',
          verified_by: user.id,
          verified_at: timestamp,
        })
        .eq('id', documentId)
        .select('*')
        .single();
    }

    if (updateResult.error || !updateResult.data) {
      console.error('[CampusOS Documents] rejectDocumentAction error:', updateResult.error);
      return {
        success: false,
        error: 'Failed to reject document. Please try again.',
      };
    }

    // Always log full rejection reason into audit_logs regardless of column existence
    await logAuditAction({
      actorId: user.id,
      action: 'reject_document',
      entityType: 'student_document',
      entityId: documentId,
      details: {
        outcome: 'rejected',
        reason: trimmedReason,
        verified_at: timestamp,
        student_id: updateResult.data.student_id,
      },
    });

    return {
      success: true,
      document: updateResult.data as StudentDocument,
    };
  } catch (err: unknown) {
    console.error('[CampusOS Documents] rejectDocumentAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to reject document. Please try again.';
    return { success: false, error: message };
  }
}

/**
 * Delete a student document from both PostgreSQL and Supabase Storage.
 * Handles partial failures cleanly.
 */
export async function deleteDocumentAction(
  documentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, user } = await requireAdmin();

    if (!isValidUuid(documentId)) {
      return { success: false, error: 'Invalid document ID format.' };
    }

    // 1. Fetch document to obtain storage_path before deleting
    const { data: doc, error: fetchError } = await supabase
      .from('student_documents')
      .select('id, student_id, storage_path, original_filename')
      .eq('id', documentId)
      .single();

    if (fetchError || !doc) {
      if (fetchError) {
        console.error('[CampusOS Documents] deleteDocumentAction fetch error:', fetchError);
      }
      return { success: false, error: 'Document not found.' };
    }

    // 2. Delete database record
    const { error: deleteDbError } = await supabase
      .from('student_documents')
      .delete()
      .eq('id', documentId);

    if (deleteDbError) {
      console.error('[CampusOS Documents] deleteDocumentAction DB delete error:', deleteDbError);
      return {
        success: false,
        error: 'Could not delete document record. Please try again.',
      };
    }

    // 3. Delete file from Storage bucket if safe path
    if (doc.storage_path && !doc.storage_path.includes('..')) {
      const { error: storageDeleteError } = await supabase.storage
        .from('student-documents')
        .remove([doc.storage_path]);

      if (storageDeleteError) {
        console.warn(
          `[CampusOS Documents] Notice: Database record for ${documentId} was removed, but storage removal encountered: ${storageDeleteError.message}`
        );
      }
    }

    // 4. Audit logging
    await logAuditAction({
      actorId: user.id,
      action: 'delete_document',
      entityType: 'student_document',
      entityId: documentId,
      details: {
        student_id: doc.student_id,
        storage_path: doc.storage_path,
        original_filename: doc.original_filename,
      },
    });

    return { success: true };
  } catch (err: unknown) {
    console.error('[CampusOS Documents] deleteDocumentAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to delete document. Please try again.';
    return { success: false, error: message };
  }
}
