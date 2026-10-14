'use server';

import { headers } from 'next/headers';
import { createClient } from '@/src/lib/supabase/server';
import { createAdminClient } from '@/src/lib/supabase/admin';
import { logAuditAction } from '@/src/lib/audit';
import {
  isValidUuid,
  sanitizePostgrestSearch,
  isAuthError,
  getPublicAppUrl,
  buildActivationLink,
} from '@/src/lib/security';
import type {
  Student,
  StudentFormData,
  GetStudentsOptions,
  StudentsListResponse,
} from '@/src/types/student';

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
 * Validates student form fields.
 */
function validateStudentData(data: StudentFormData): { valid: boolean; error?: string } {
  if (!data.first_name || data.first_name.trim().length === 0) {
    return { valid: false, error: 'First name is required.' };
  }
  if (!data.last_name || data.last_name.trim().length === 0) {
    return { valid: false, error: 'Last name is required.' };
  }
  if (!data.date_of_birth) {
    return { valid: false, error: 'Date of birth is required.' };
  }
  const birthDate = new Date(data.date_of_birth);
  if (isNaN(birthDate.getTime()) || birthDate >= new Date()) {
    return { valid: false, error: 'Date of birth must be a valid date in the past.' };
  }
  if (!data.enrollment_date) {
    return { valid: false, error: 'Enrollment date is required.' };
  }
  if (!data.email || data.email.trim().length === 0) {
    return { valid: false, error: 'Student email is required for account activation.' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email.trim())) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }
  const validStatuses = ['active', 'inactive', 'pending', 'suspended', 'graduated'];
  if (!validStatuses.includes(data.status)) {
    return { valid: false, error: 'Invalid status value.' };
  }

  return { valid: true };
}

/**
 * Fetch paginated students with optional search and status filtering.
 */
export async function getStudentsAction(
  options: GetStudentsOptions = {}
): Promise<{ success: boolean; data?: StudentsListResponse; error?: string }> {
  try {
    const { supabase } = await requireAdmin();

    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(50, Math.max(1, options.pageSize || 10));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('students')
      .select('*', { count: 'exact' });

    // Status filter
    if (options.status && options.status !== 'all') {
      query = query.eq('status', options.status);
    }

    // Search filter across student_code, first_name, last_name (sanitized against filter injection)
    if (options.search && options.search.trim().length > 0) {
      const cleanSearch = sanitizePostgrestSearch(options.search);
      if (cleanSearch.length > 0) {
        query = query.or(
          `student_code.ilike.%${cleanSearch}%,first_name.ilike.%${cleanSearch}%,last_name.ilike.%${cleanSearch}%`
        );
      }
    }

    // Order newest first
    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error('[CampusOS Students] getStudentsAction query error:', error);
      return { success: false, error: 'Failed to retrieve students. Please try again.' };
    }

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    return {
      success: true,
      data: {
        students: (data as Student[]) || [],
        totalCount,
        page,
        pageSize,
        totalPages,
      },
    };
  } catch (err: unknown) {
    console.error('[CampusOS Students] getStudentsAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to retrieve students. Please try again.';
    return { success: false, error: message };
  }
}

/**
 * Fetch a single student record by ID.
 */
export async function getStudentByIdAction(
  id: string
): Promise<{ success: boolean; student?: Student; error?: string }> {
  try {
    const { supabase } = await requireAdmin();

    if (!isValidUuid(id)) {
      return { success: false, error: 'Invalid student ID format.' };
    }

    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      if (error) {
        console.error('[CampusOS Students] getStudentByIdAction query error:', error);
      }
      return { success: false, error: 'Student not found or could not be loaded.' };
    }

    return { success: true, student: data as Student };
  } catch (err: unknown) {
    console.error('[CampusOS Students] getStudentByIdAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to retrieve student.';
    return { success: false, error: message };
  }
}

/**
 * Enroll a new student record manually.
 * Uses the database-generated student_code and captures created_by.
 */
export async function enrollStudentAction(
  formData: StudentFormData
): Promise<{
  success: boolean;
  student?: Student;
  invitationSent?: boolean;
  activationLink?: string;
  error?: string;
}> {
  try {
    const { supabase, user } = await requireAdmin();

    const validation = validateStudentData(formData);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const cleanEmail = formData.email.trim().toLowerCase();

    // Check if a student with this email is already registered
    const { data: existingStudent } = await supabase
      .from('students')
      .select('id, student_code')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (existingStudent) {
      return {
        success: false,
        error: `A student with email "${cleanEmail}" is already registered (College ID: ${existingStudent.student_code}).`,
      };
    }

    const payload = {
      first_name: formData.first_name.trim(),
      middle_name: formData.middle_name?.trim() || null,
      last_name: formData.last_name.trim(),
      date_of_birth: formData.date_of_birth,
      email: cleanEmail,
      phone: formData.phone?.trim() || null,
      enrollment_date: formData.enrollment_date,
      status: formData.status,
      created_by: user.id,
    };

    const { data, error } = await supabase
      .from('students')
      .insert(payload)
      .select()
      .single();

    if (error || !data) {
      console.error('[CampusOS Students] enrollStudentAction error:', error);
      return {
        success: false,
        error: 'Failed to enroll student. Please verify all fields and try again.',
      };
    }

    const enrolled = data as Student;
    let inviteSent = false;
    let activationLink: string | undefined;

    // Secure server-side Supabase Auth account invitation (Option 1)
    const adminClient = createAdminClient();
    if (adminClient) {
      try {
        const headerList = await headers();
        const origin = getPublicAppUrl(headerList);
        const redirectTo = `${origin}/auth/confirm?next=/activate/password`;

        const { data: inviteData, error: inviteError } =
          await adminClient.auth.admin.inviteUserByEmail(cleanEmail, {
            data: {
              student_id: enrolled.id,
              student_code: enrolled.student_code,
              role: 'student',
            },
            redirectTo,
          });

        if (inviteError) {
          console.warn('[CampusOS Students] Supabase invitation notice:', inviteError.message);

          // In development mode or if email delivery is restricted, generate safe link
          if (process.env.NODE_ENV !== 'production' || inviteError.message.includes('rate')) {
            const { data: linkData } = await adminClient.auth.admin.generateLink({
              type: 'invite',
              email: cleanEmail,
              options: {
                data: {
                  student_id: enrolled.id,
                  student_code: enrolled.student_code,
                  role: 'student',
                },
                redirectTo,
              },
            });
            if (linkData?.properties) {
              activationLink = buildActivationLink(origin, linkData.properties);
              if (linkData.user) {
                await adminClient
                  .from('students')
                  .update({ user_id: linkData.user.id })
                  .eq('id', enrolled.id);

                const studentDisplayName = [formData.first_name.trim(), formData.last_name.trim()]
                  .filter(Boolean)
                  .join(' ');

                await adminClient.from('profiles').upsert({
                  id: linkData.user.id,
                  display_name: studentDisplayName || 'Student',
                  role: 'student',
                });
              }
            }
          }
        } else if (inviteData?.user) {
          inviteSent = true;

          // Link student record to the newly provisioned auth account
          await adminClient
            .from('students')
            .update({ user_id: inviteData.user.id })
            .eq('id', enrolled.id);

          const studentDisplayName = [formData.first_name.trim(), formData.last_name.trim()]
            .filter(Boolean)
            .join(' ');

          // Ensure profile is assigned role = 'student' with required display_name
          await adminClient
            .from('profiles')
            .upsert({
              id: inviteData.user.id,
              display_name: studentDisplayName || 'Student',
              role: 'student',
            });

          // Provide direct activation link for immediate setup and copying
          const { data: devLink } = await adminClient.auth.admin.generateLink({
            type: 'magiclink',
            email: cleanEmail,
            options: { redirectTo },
          });
          if (devLink?.properties) {
            activationLink = buildActivationLink(origin, devLink.properties);
          }
        }
      } catch (inviteEx) {
        console.error('[CampusOS Students] Server-side invite dispatch error:', inviteEx);
      }
    } else {
      console.info(
        `[CampusOS Students] Enrolled ${enrolled.student_code}. SUPABASE_SERVICE_ROLE_KEY is pending in .env.local; invite will be dispatched once configured.`
      );
    }

    // Record server-side audit log
    await logAuditAction({
      actorId: user.id,
      action: 'STUDENT_ENROLLED',
      entityType: 'student',
      entityId: enrolled.id,
      details: {
        student_code: enrolled.student_code,
        name: `${enrolled.first_name} ${enrolled.last_name}`,
        email: cleanEmail,
        invite_dispatched: inviteSent,
      },
    });

    return {
      success: true,
      student: enrolled,
      invitationSent: inviteSent,
      activationLink,
    };
  } catch (err: unknown) {
    console.error('[CampusOS Students] enrollStudentAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to enroll student. Please try again.';
    return { success: false, error: message };
  }
}

/**
 * Update an existing student record.
 */
export async function updateStudentAction(
  id: string,
  formData: StudentFormData
): Promise<{ success: boolean; student?: Student; error?: string }> {
  try {
    const { supabase, user } = await requireAdmin();

    if (!isValidUuid(id)) {
      return { success: false, error: 'Invalid student ID format.' };
    }

    const validation = validateStudentData(formData);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const payload = {
      first_name: formData.first_name.trim(),
      middle_name: formData.middle_name?.trim() || null,
      last_name: formData.last_name.trim(),
      date_of_birth: formData.date_of_birth,
      email: formData.email?.trim() || null,
      phone: formData.phone?.trim() || null,
      enrollment_date: formData.enrollment_date,
      status: formData.status,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('students')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      console.error('[CampusOS Students] updateStudentAction error:', error);
      return {
        success: false,
        error: 'Failed to update student details. Please try again.',
      };
    }

    const updated = data as Student;

    // Record server-side audit log
    await logAuditAction({
      actorId: user.id,
      action: 'STUDENT_UPDATED',
      entityType: 'student',
      entityId: updated.id,
      details: {
        student_code: updated.student_code,
        name: `${updated.first_name} ${updated.last_name}`,
      },
    });

    return { success: true, student: updated };
  } catch (err: unknown) {
    console.error('[CampusOS Students] updateStudentAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to update student. Please try again.';
    return { success: false, error: message };
  }
}

/**
 * Delete a student record with explicit administrator confirmation.
 */
export async function deleteStudentAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, user } = await requireAdmin();

    if (!isValidUuid(id)) {
      return { success: false, error: 'Invalid student ID format.' };
    }

    // Fetch existing student info for audit trail
    const { data: student } = await supabase
      .from('students')
      .select('student_code, first_name, last_name')
      .eq('id', id)
      .maybeSingle();

    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[CampusOS Students] deleteStudentAction error:', error);
      return {
        success: false,
        error: 'Failed to delete student record. Please try again.',
      };
    }

    // Record server-side audit log
    await logAuditAction({
      actorId: user.id,
      action: 'STUDENT_DELETED',
      entityType: 'student',
      entityId: id,
      details: {
        student_code: student?.student_code,
        name: student ? `${student.first_name} ${student.last_name}` : undefined,
      },
    });

    return { success: true };
  } catch (err: unknown) {
    console.error('[CampusOS Students] deleteStudentAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to delete student. Please try again.';
    return { success: false, error: message };
  }
}

/**
 * Resends the account activation invitation for an existing enrolled student.
 * Uses the server-only admin client to dispatch via Supabase Auth Admin.
 * In development, returns the direct activation link for safe testing.
 */
export async function resendStudentInviteAction(studentId: string): Promise<{
  success: boolean;
  message?: string;
  activationLink?: string;
  error?: string;
}> {
  try {
    const { supabase, user } = await requireAdmin();

    const adminClient = createAdminClient();
    if (!adminClient) {
      return {
        success: false,
        error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is not configured.',
      };
    }

    // 1. Fetch student record
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, student_code, first_name, last_name, email, status, user_id')
      .eq('id', studentId)
      .maybeSingle();

    if (studentError || !student) {
      return { success: false, error: 'Student record not found.' };
    }

    if (!student.email) {
      return {
        success: false,
        error: 'This student does not have an email address on file. Please edit the student profile to add an email first.',
      };
    }

    if (student.status === 'graduated') {
      return {
        success: false,
        error: 'Cannot dispatch activation for a graduated student.',
      };
    }

    const headerList = await headers();
    const origin = getPublicAppUrl(headerList);
    const redirectTo = `${origin}/auth/confirm?next=/activate/password`;
    const cleanEmail = student.email.trim().toLowerCase();

    let activationLink: string | undefined;
    let inviteSent = false;

    // Check if the user already exists in auth.users
    if (student.user_id) {
      // User exists in auth.users -> generate recovery/magiclink for password setup
      const { data: linkData, error: linkError } =
        await adminClient.auth.admin.generateLink({
          type: 'magiclink',
          email: cleanEmail,
          options: { redirectTo },
        });

      if (!linkError && linkData?.properties) {
        activationLink = buildActivationLink(origin, linkData.properties);
        inviteSent = true;
      }
    } else {
      // User does not exist in auth.users -> generate invite
      const { data: inviteData, error: inviteError } =
        await adminClient.auth.admin.inviteUserByEmail(cleanEmail, {
          data: {
            student_id: student.id,
            student_code: student.student_code,
            role: 'student',
          },
          redirectTo,
        });

      if (!inviteError && inviteData?.user) {
        inviteSent = true;
        // Link user_id
        await adminClient
          .from('students')
          .update({ user_id: inviteData.user.id })
          .eq('id', student.id);

        const studentDisplayName = [student.first_name, student.last_name]
          .filter(Boolean)
          .join(' ');

        await adminClient.from('profiles').upsert({
          id: inviteData.user.id,
          display_name: studentDisplayName || 'Student',
          role: 'student',
        });

        // Provide direct activation link for immediate setup and copying
        const { data: devLink } = await adminClient.auth.admin.generateLink({
          type: 'magiclink',
          email: cleanEmail,
          options: { redirectTo },
        });
        if (devLink?.properties) {
          activationLink = buildActivationLink(origin, devLink.properties);
        }
      } else {
        // Fallback to generateLink
        const { data: linkData } = await adminClient.auth.admin.generateLink({
          type: 'invite',
          email: cleanEmail,
          options: {
            data: {
              student_id: student.id,
              student_code: student.student_code,
              role: 'student',
            },
            redirectTo,
          },
        });
        if (linkData?.properties) {
          activationLink = buildActivationLink(origin, linkData.properties);
          inviteSent = true;
          if (linkData.user) {
            await adminClient
              .from('students')
              .update({ user_id: linkData.user.id })
              .eq('id', student.id);

            const studentDisplayName = [student.first_name, student.last_name]
              .filter(Boolean)
              .join(' ');

            await adminClient.from('profiles').upsert({
              id: linkData.user.id,
              display_name: studentDisplayName || 'Student',
              role: 'student',
            });
          }
        }
      }
    }

    // Audit log
    await logAuditAction({
      actorId: user.id,
      action: 'STUDENT_INVITE_DISPATCHED',
      entityType: 'student',
      entityId: student.id,
      details: {
        student_code: student.student_code,
        email: cleanEmail,
        invite_sent: inviteSent,
      },
    });

    return {
      success: true,
      message: `Activation invitation successfully processed for ${student.student_code} (${cleanEmail}).`,
      activationLink: activationLink || undefined,
    };
  } catch (err: unknown) {
    console.error('[CampusOS Students] resendStudentInviteAction error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to dispatch activation invitation.',
    };
  }
}

