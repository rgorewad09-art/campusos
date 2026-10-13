'use server';

import { createClient } from '@/src/lib/supabase/server';
import { logAuditAction } from '@/src/lib/audit';
import { isValidUuid, sanitizePostgrestSearch, isAuthError } from '@/src/lib/security';
import type {
  Guardian,
  StudentGuardianLink,
  GuardianFormData,
} from '@/src/types/guardian';

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
 * Fetch all guardians linked to a specific student.
 */
export async function getStudentGuardiansAction(
  studentId: string
): Promise<{ success: boolean; data?: StudentGuardianLink[]; error?: string }> {
  try {
    const { supabase } = await requireAdmin();

    if (!isValidUuid(studentId)) {
      return { success: false, error: 'Invalid student ID format.' };
    }

    const { data, error } = await supabase
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
      .eq('student_id', studentId)
      .order('is_primary', { ascending: false });

    if (error) {
      console.error('[CampusOS Guardians] getStudentGuardiansAction query error:', error);
      return { success: false, error: 'Failed to retrieve linked guardians.' };
    }

    return {
      success: true,
      data: (data as unknown as StudentGuardianLink[]) || [],
    };
  } catch (err: unknown) {
    console.error('[CampusOS Guardians] getStudentGuardiansAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to retrieve linked guardians.';
    return { success: false, error: message };
  }
}

/**
 * Search existing guardians to enable linking without duplicate records.
 */
export async function searchGuardiansAction(
  query: string
): Promise<{ success: boolean; guardians?: Guardian[]; error?: string }> {
  try {
    const { supabase } = await requireAdmin();

    const clean = sanitizePostgrestSearch(query);

    if (!clean || clean.length === 0) {
      // Return most recent 10 guardians if no query or after stripping invalid characters
      const { data, error } = await supabase
        .from('guardians')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('[CampusOS Guardians] searchGuardiansAction default query error:', error);
        return { success: false, error: 'Unable to search guardians. Please try again.' };
      }
      return { success: true, guardians: (data as Guardian[]) || [] };
    }

    const { data, error } = await supabase
      .from('guardians')
      .select('*')
      .or(`full_name.ilike.%${clean}%,phone.ilike.%${clean}%,email.ilike.%${clean}%`)
      .order('full_name', { ascending: true })
      .limit(15);

    if (error) {
      console.error('[CampusOS Guardians] searchGuardiansAction filtered query error:', error);
      return { success: false, error: 'Unable to search guardians. Please try again.' };
    }

    return { success: true, guardians: (data as Guardian[]) || [] };
  } catch (err: unknown) {
    console.error('[CampusOS Guardians] searchGuardiansAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error ? err.message : 'Search failed. Please try again.';
    return { success: false, error: message };
  }
}

/**
 * Create a new guardian and link them to the student.
 */
export async function addGuardianAction(
  studentId: string,
  formData: GuardianFormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, user } = await requireAdmin();

    if (!isValidUuid(studentId)) {
      return { success: false, error: 'Invalid student ID format.' };
    }

    if (!formData.full_name || formData.full_name.trim().length === 0) {
      return { success: false, error: 'Guardian full name is required.' };
    }

    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        return { success: false, error: 'Please enter a valid email address.' };
      }
    }

    // 1. Insert guardian record
    const { data: newGuardian, error: guardianError } = await supabase
      .from('guardians')
      .insert({
        full_name: formData.full_name.trim(),
        relationship: formData.relationship?.trim() || 'Guardian',
        email: formData.email?.trim() || null,
        phone: formData.phone?.trim() || null,
      })
      .select()
      .single();

    if (guardianError || !newGuardian) {
      console.error('[CampusOS Guardians] addGuardianAction insert error:', guardianError);
      return {
        success: false,
        error: 'Failed to create guardian record. Please verify fields and try again.',
      };
    }

    // 2. If marked primary, unset existing primary for this student
    if (formData.is_primary) {
      await supabase
        .from('student_guardians')
        .update({ is_primary: false })
        .eq('student_id', studentId);
    }

    // 3. Link student and guardian
    const { error: linkError } = await supabase
      .from('student_guardians')
      .insert({
        student_id: studentId,
        guardian_id: newGuardian.id,
        is_primary: Boolean(formData.is_primary),
      });

    if (linkError) {
      console.error('[CampusOS Guardians] addGuardianAction link error:', linkError);
      return {
        success: false,
        error: 'Guardian was created but could not be linked to the student.',
      };
    }

    // 4. Audit log
    await logAuditAction({
      actorId: user.id,
      action: 'GUARDIAN_ADDED',
      entityType: 'guardian',
      entityId: newGuardian.id,
      details: {
        student_id: studentId,
        guardian_name: newGuardian.full_name,
        relationship: newGuardian.relationship,
        is_primary: Boolean(formData.is_primary),
      },
    });

    return { success: true };
  } catch (err: unknown) {
    console.error('[CampusOS Guardians] addGuardianAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to add guardian. Please try again.';
    return { success: false, error: message };
  }
}

/**
 * Link an existing guardian to a student.
 */
export async function linkExistingGuardianAction(
  studentId: string,
  guardianId: string,
  isPrimary: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, user } = await requireAdmin();

    if (!isValidUuid(studentId) || !isValidUuid(guardianId)) {
      return { success: false, error: 'Invalid student or guardian ID format.' };
    }

    // Check if relationship already exists
    const { data: existing, error: existingError } = await supabase
      .from('student_guardians')
      .select('student_id')
      .eq('student_id', studentId)
      .eq('guardian_id', guardianId)
      .maybeSingle();

    if (existingError) {
      console.error('[CampusOS Guardians] linkExistingGuardianAction check error:', existingError);
      return { success: false, error: 'Could not check existing guardian link.' };
    }

    if (existing) {
      return {
        success: false,
        error: 'This guardian is already linked to this student.',
      };
    }

    // If marked primary, unset existing primary
    if (isPrimary) {
      await supabase
        .from('student_guardians')
        .update({ is_primary: false })
        .eq('student_id', studentId);
    }

    const { error: linkError } = await supabase
      .from('student_guardians')
      .insert({
        student_id: studentId,
        guardian_id: guardianId,
        is_primary: isPrimary,
      });

    if (linkError) {
      console.error('[CampusOS Guardians] linkExistingGuardianAction insert error:', linkError);
      return {
        success: false,
        error: 'Failed to link guardian. Please try again.',
      };
    }

    // Audit log
    await logAuditAction({
      actorId: user.id,
      action: 'GUARDIAN_LINKED',
      entityType: 'guardian',
      entityId: guardianId,
      details: {
        student_id: studentId,
        is_primary: isPrimary,
      },
    });

    return { success: true };
  } catch (err: unknown) {
    console.error('[CampusOS Guardians] linkExistingGuardianAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to link guardian. Please try again.';
    return { success: false, error: message };
  }
}

/**
 * Update guardian information.
 */
export async function updateGuardianAction(
  guardianId: string,
  formData: GuardianFormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, user } = await requireAdmin();

    if (!isValidUuid(guardianId)) {
      return { success: false, error: 'Invalid guardian ID format.' };
    }

    if (!formData.full_name || formData.full_name.trim().length === 0) {
      return { success: false, error: 'Guardian full name is required.' };
    }

    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        return { success: false, error: 'Please enter a valid email address.' };
      }
    }

    const { error } = await supabase
      .from('guardians')
      .update({
        full_name: formData.full_name.trim(),
        relationship: formData.relationship?.trim() || 'Guardian',
        email: formData.email?.trim() || null,
        phone: formData.phone?.trim() || null,
      })
      .eq('id', guardianId);

    if (error) {
      console.error('[CampusOS Guardians] updateGuardianAction error:', error);
      return {
        success: false,
        error: 'Failed to update guardian details. Please try again.',
      };
    }

    // Audit log
    await logAuditAction({
      actorId: user.id,
      action: 'GUARDIAN_UPDATED',
      entityType: 'guardian',
      entityId: guardianId,
      details: {
        full_name: formData.full_name,
      },
    });

    return { success: true };
  } catch (err: unknown) {
    console.error('[CampusOS Guardians] updateGuardianAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to update guardian. Please try again.';
    return { success: false, error: message };
  }
}

/**
 * Designate a specific guardian as the primary contact for a student.
 */
export async function setPrimaryGuardianAction(
  studentId: string,
  guardianId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, user } = await requireAdmin();

    if (!isValidUuid(studentId) || !isValidUuid(guardianId)) {
      return { success: false, error: 'Invalid student or guardian ID format.' };
    }

    // 1. Unset all primaries for this student
    const { error: unsetError } = await supabase
      .from('student_guardians')
      .update({ is_primary: false })
      .eq('student_id', studentId);

    if (unsetError) {
      console.error('[CampusOS Guardians] setPrimaryGuardianAction unset error:', unsetError);
      return { success: false, error: 'Failed to update primary contact status.' };
    }

    // 2. Set the designated guardian as primary
    const { error: setError } = await supabase
      .from('student_guardians')
      .update({ is_primary: true })
      .eq('student_id', studentId)
      .eq('guardian_id', guardianId);

    if (setError) {
      console.error('[CampusOS Guardians] setPrimaryGuardianAction set error:', setError);
      return { success: false, error: 'Failed to set primary guardian.' };
    }

    // Audit log
    await logAuditAction({
      actorId: user.id,
      action: 'GUARDIAN_PRIMARY_SET',
      entityType: 'guardian',
      entityId: guardianId,
      details: {
        student_id: studentId,
      },
    });

    return { success: true };
  } catch (err: unknown) {
    console.error('[CampusOS Guardians] setPrimaryGuardianAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to set primary guardian. Please try again.';
    return { success: false, error: message };
  }
}

/**
 * Remove the link between a student and a guardian.
 */
export async function unlinkGuardianAction(
  studentId: string,
  guardianId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, user } = await requireAdmin();

    if (!isValidUuid(studentId) || !isValidUuid(guardianId)) {
      return { success: false, error: 'Invalid student or guardian ID format.' };
    }

    const { error } = await supabase
      .from('student_guardians')
      .delete()
      .eq('student_id', studentId)
      .eq('guardian_id', guardianId);

    if (error) {
      console.error('[CampusOS Guardians] unlinkGuardianAction error:', error);
      return {
        success: false,
        error: 'Failed to remove guardian link. Please try again.',
      };
    }

    // Audit log
    await logAuditAction({
      actorId: user.id,
      action: 'GUARDIAN_REMOVED',
      entityType: 'guardian',
      entityId: guardianId,
      details: {
        student_id: studentId,
      },
    });

    return { success: true };
  } catch (err: unknown) {
    console.error('[CampusOS Guardians] unlinkGuardianAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to remove guardian. Please try again.';
    return { success: false, error: message };
  }
}
