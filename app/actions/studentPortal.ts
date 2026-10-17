'use server';

import { createClient } from '@/src/lib/supabase/server';
import { createAdminClient } from '@/src/lib/supabase/admin';
import { isValidUuid, isAuthError, detectMimeTypeFromBuffer } from '@/src/lib/security';
import { logAuditAction } from '@/src/lib/audit';
import type { Student } from '@/src/types/student';
import type { AttendanceRecord } from '@/src/types/attendance';
import {
  DOCUMENT_CATEGORIES,
  MAX_FILE_SIZE_BYTES,
  type DocumentCategory,
  type StudentDocument,
} from '@/src/types/document';
import type { StudentGuardianLink } from '@/src/types/guardian';

import type {
  Course,
  StudentAcademicEnrollment,
  StudentSelectedSubject,
  TimetableEntry,
} from '@/src/types/academic';

export interface StudentDashboardData {
  student: Student;
  attendance: {
    totalSessions: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    percentage: number | null;
    recentRecords: AttendanceRecord[];
  };
  documents: StudentDocument[];
  guardians: StudentGuardianLink[];
  academic?: {
    enrollment?: StudentAcademicEnrollment;
    selectedSubjects?: StudentSelectedSubject[];
    personalTimetable?: TimetableEntry[];
    availableCourses?: (Course & { curriculum?: any[] })[];
  };
}

/**
 * Server-side authorization check for Student Portal.
 * Verifies caller is authenticated, possesses an active linked student record in public.students,
 * and maintains consistent role = 'student' in public.profiles.
 */
async function requireStudent() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized: Please sign in to access the Student Portal.');
  }

  const adminClient = createAdminClient();
  const dbClient = adminClient || supabase;

  // 1. Check existing linked student record via user_id
  let { data: student } = await dbClient
    .from('students')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  // 2. If not yet linked, verify unambiguous match against verified email
  const isEmailVerified = Boolean(user.email_confirmed_at || user.confirmed_at);
  if (!student && user.email && isEmailVerified) {
    const cleanEmail = user.email.trim().toLowerCase();
    const { data: matchedStudents } = await dbClient
      .from('students')
      .select('*')
      .ilike('email', cleanEmail)
      .neq('status', 'graduated');

    if (matchedStudents && matchedStudents.length === 1) {
      const candidate = matchedStudents[0];
      if (!candidate.user_id || candidate.user_id === user.id) {
        if (adminClient && candidate.user_id !== user.id) {
          await adminClient
            .from('students')
            .update({ user_id: user.id })
            .eq('id', candidate.id);
        }
        student = { ...candidate, user_id: user.id };
      }
    }
  }

  // 3. Confirm student record exists and is active
  if (!student || student.status !== 'active') {
    throw new Error('Forbidden: Only authorized students can access this area.');
  }

  // 4. Verify and repair profile role in public.profiles using adminClient
  let { data: profile } = await dbClient
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();

  // Preserve existing administrator and teacher account boundaries
  if (profile?.role === 'admin' || profile?.role === 'teacher') {
    throw new Error('Forbidden: Only authorized students can access this area.');
  }

  if (profile?.role !== 'student' && adminClient) {
    const displayName =
      [student.first_name, student.last_name]
        .filter(Boolean)
        .join(' ') ||
      user.user_metadata?.full_name ||
      user.email?.split('@')[0] ||
      'Student';

    const { error: upsertError } = await adminClient.from('profiles').upsert({
      id: user.id,
      display_name: displayName,
      role: 'student',
    });

    if (upsertError) {
      console.error('[CampusOS StudentPortal] Error repairing profile role:', upsertError.message);
    } else {
      profile = { id: user.id, role: 'student' };
    }
  }

  if (profile?.role !== 'student' && !student) {
    throw new Error('Forbidden: Only authorized students can access this area.');
  }

  return { supabase, user, student: student as Student };
}

/**
 * Retrieves the student's personal dashboard data (attendance, documents, profile, guardians).
 */
export async function getStudentDashboardDataAction(): Promise<{
  success: boolean;
  data?: StudentDashboardData;
  error?: string;
}> {
  try {
    const { supabase, student } = await requireStudent();

    const adminClient = createAdminClient();
    const dbClient = adminClient || supabase;

    // Run independent student data queries concurrently in parallel
    const [attRes, docRes, guardRes, enrollRes, coursesRes] = await Promise.all([
      supabase
        .from('attendance')
        .select('*')
        .eq('student_id', student.id)
        .order('attendance_date', { ascending: false }),
      supabase
        .from('student_documents')
        .select('*')
        .eq('student_id', student.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('student_guardians')
        .select(`
          student_id,
          guardian_id,
          is_primary,
          guardians (
            id,
            full_name,
            email,
            phone,
            relationship,
            created_at
          )
        `)
        .eq('student_id', student.id),
      dbClient
        .from('student_academic_enrollments')
        .select(`
          *,
          course:courses(*)
        `)
        .eq('student_id', student.id)
        .order('enrolled_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      dbClient
        .from('courses')
        .select(`
          *,
          course_subjects(
            *,
            subject:subjects(*)
          )
        `)
        .eq('status', 'active'),
    ]);

    if (attRes.error) {
      console.error('[CampusOS Student Portal] Attendance fetch error:', attRes.error);
    }
    if (docRes.error) {
      console.error('[CampusOS Student Portal] Documents fetch error:', docRes.error);
    }
    if (guardRes.error) {
      console.error('[CampusOS Student Portal] Guardians fetch error:', guardRes.error);
    }

    const records = (attRes.data as AttendanceRecord[]) || [];
    const totalSessions = records.length;
    const presentCount = records.filter((r) => r.status === 'present').length;
    const absentCount = records.filter((r) => r.status === 'absent').length;
    const lateCount = records.filter((r) => r.status === 'late').length;
    const percentage =
      totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : null;

    // Process Academic enrollment and secondary timetable/subjects
    let academicData: StudentDashboardData['academic'] = undefined;
    const enrollment = enrollRes.data;
    let selectedSubjects: StudentSelectedSubject[] = [];
    let personalTimetable: TimetableEntry[] = [];

    if (enrollment) {
      const [subsRes, ttRes] = await Promise.all([
        dbClient
          .from('student_selected_subjects')
          .select(`
            *,
            subject:subjects(*)
          `)
          .eq('enrollment_id', enrollment.id),
        enrollment.status === 'approved'
          ? dbClient
              .from('timetables')
              .select(`
                *,
                course:courses(*),
                subject:subjects(*),
                teacher:teachers(*)
              `)
              .eq('course_id', enrollment.course_id)
              .eq('semester', enrollment.semester)
              .eq('section', enrollment.section)
              .eq('academic_term', enrollment.academic_term)
              .eq('status', 'approved')
              .order('day_of_week', { ascending: true })
              .order('start_time', { ascending: true })
          : Promise.resolve({ data: [] }),
      ]);

      if (subsRes.data) selectedSubjects = subsRes.data as StudentSelectedSubject[];
      if (ttRes.data) personalTimetable = ttRes.data as TimetableEntry[];
    }

    academicData = {
      enrollment: enrollment as StudentAcademicEnrollment | undefined,
      selectedSubjects,
      personalTimetable,
      availableCourses: coursesRes.data || [],
    };

    return {
      success: true,
      data: {
        student,
        attendance: {
          totalSessions,
          presentCount,
          absentCount,
          lateCount,
          percentage,
          recentRecords: records.slice(0, 50),
        },
        documents: (docRes.data as StudentDocument[]) || [],
        guardians: (guardRes.data as unknown as StudentGuardianLink[]) || [],
        academic: academicData,
      },
    };
  } catch (err: unknown) {
    console.error('[CampusOS Student Portal] getStudentDashboardDataAction error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to load your personal dashboard.';
    return { success: false, error: message };
  }
}

/**
 * Generates a time-limited signed URL for the student to view their own document.
 */
export async function getStudentDocumentSignedUrlAction(
  documentId: string
): Promise<{ success: boolean; signedUrl?: string; error?: string }> {
  try {
    const { supabase, student } = await requireStudent();

    if (!isValidUuid(documentId)) {
      return { success: false, error: 'Invalid document ID format.' };
    }

    // Confirm the document belongs strictly to this student
    const { data: doc, error: docError } = await supabase
      .from('student_documents')
      .select('id, storage_path')
      .eq('id', documentId)
      .eq('student_id', student.id)
      .single();

    if (docError || !doc) {
      return { success: false, error: 'Document not found or access denied.' };
    }

    const { data, error: signError } = await supabase.storage
      .from('student-documents')
      .createSignedUrl(doc.storage_path, 120);

    if (signError || !data?.signedUrl) {
      return { success: false, error: 'Could not generate secure document link.' };
    }

    return { success: true, signedUrl: data.signedUrl };
  } catch (err: unknown) {
    const message =
      isAuthError(err) && err instanceof Error ? err.message : 'Failed to view document.';
    return { success: false, error: message };
  }
}

/**
 * Allows the authenticated student to self-upload a document for administrative verification.
 * Strictly derives student ownership from the authenticated session (never trusts client-supplied student IDs).
 * Validates file size (max 10 MB) and binary magic bytes on the server.
 * Stores in the private 'student-documents' bucket under a sanitized, unique path.
 * Creates a record in public.student_documents with verification_status = 'pending'.
 */
export async function uploadStudentDocumentSelfAction(
  formData: FormData
): Promise<{ success: boolean; document?: StudentDocument; error?: string }> {
  let uploadedStoragePath: string | null = null;
  let adminClientRef: ReturnType<typeof createAdminClient> | null = null;

  try {
    // 1. Authorize: verify user is authenticated and linked to a student record
    const { user, student } = await requireStudent();

    const category = formData.get('category')?.toString()?.trim() as DocumentCategory;
    const file = formData.get('file') as File | null;

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

    // Validate original filename
    const originalFilename = (
      formData.get('original_filename')?.toString() ||
      file.name ||
      ''
    ).trim();

    if (!originalFilename || originalFilename.length === 0) {
      return {
        success: false,
        error: 'The uploaded file must have a valid filename.',
      };
    }

    // Validate file size (10 MB max)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        success: false,
        error: `File size exceeds the 10 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
      };
    }

    // Read buffer and inspect binary magic bytes on the server
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

    // Generate unique storage path strictly scoped to authenticated student UUID
    const docId = crypto.randomUUID();
    const sanitizedName = originalFilename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 60);
    const storagePath = `students/${student.id}/${docId}_${sanitizedName}`;
    uploadedStoragePath = storagePath;

    const adminClient = createAdminClient();
    adminClientRef = adminClient;
    if (!adminClient) {
      return { success: false, error: 'Storage service temporarily unavailable. Please try again.' };
    }

    // 2. Upload to private Storage bucket 'student-documents'
    const { error: storageError } = await adminClient.storage
      .from('student-documents')
      .upload(storagePath, buffer, {
        contentType: verifiedMimeType,
        upsert: false,
      });

    if (storageError) {
      console.error('[CampusOS Student Portal] Storage upload error:', storageError);
      return {
        success: false,
        error: 'Failed to upload document file. Please try again.',
      };
    }

    // 3. Insert metadata into public.student_documents with status = 'pending'
    let insertResult = await adminClient
      .from('student_documents')
      .insert({
        id: docId,
        student_id: student.id,
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

    // Fallback if optional schema columns differ
    if (insertResult.error && insertResult.error.message.includes('column')) {
      insertResult = await adminClient
        .from('student_documents')
        .insert({
          id: docId,
          student_id: student.id,
          document_type: category,
          storage_path: storagePath,
          original_filename: originalFilename,
          verification_status: 'pending',
        })
        .select('*')
        .single();
    }

    // Roll back storage file if database insert fails
    if (insertResult.error || !insertResult.data) {
      console.error(
        '[CampusOS Student Portal] DB insert failed, rolling back storage file:',
        insertResult.error
      );
      try {
        await adminClient.storage.from('student-documents').remove([storagePath]);
      } catch (cleanupErr) {
        console.error('[CampusOS Student Portal] Rollback cleanup error:', cleanupErr);
      }
      return {
        success: false,
        error: 'Could not record document submission. The upload was safely cancelled.',
      };
    }

    // 4. Log audit event
    await logAuditAction({
      actorId: user.id,
      action: 'student_upload_document',
      entityType: 'student_document',
      entityId: docId,
      details: {
        student_id: student.id,
        category,
        original_filename: originalFilename,
        file_size: file.size,
        mime_type: verifiedMimeType,
        storage_path: storagePath,
        verification_status: 'pending',
      },
    });

    return {
      success: true,
      document: insertResult.data as StudentDocument,
    };
  } catch (err: unknown) {
    if (uploadedStoragePath && adminClientRef) {
      try {
        await adminClientRef.storage.from('student-documents').remove([uploadedStoragePath]);
      } catch (cleanupErr) {
        console.error('[CampusOS Student Portal] Rollback cleanup error:', cleanupErr);
      }
    }

    console.error('[CampusOS Student Portal] uploadStudentDocumentSelfAction error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'An unexpected error occurred while uploading your document. Please try again.';
    return { success: false, error: message };
  }
}

