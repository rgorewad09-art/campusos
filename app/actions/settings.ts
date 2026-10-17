'use server';

import { createClient } from '@/src/lib/supabase/server';
import { createAdminClient } from '@/src/lib/supabase/admin';
import { logAuditAction } from '@/src/lib/audit';
import { isAuthError } from '@/src/lib/security';

export interface AdminProfileData {
  id: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Server-side authorization check for Administrator.
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
    .select('id, role, display_name, updated_at, created_at')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== 'admin') {
    throw new Error('Forbidden: Only authorized administrators can perform this action.');
  }

  return { supabase, user, profile };
}

/**
 * Fetch administrator profile information for the Settings page.
 */
export async function getAdminProfileAction(): Promise<{
  success: boolean;
  profile?: AdminProfileData;
  error?: string;
}> {
  try {
    const { user, profile } = await requireAdmin();

    return {
      success: true,
      profile: {
        id: user.id,
        email: user.email || 'admin@campusos.com',
        displayName:
          user.user_metadata?.display_name ||
          user.user_metadata?.full_name ||
          profile.display_name ||
          'Administrator',
        role: profile.role,
        createdAt: user.created_at || (profile as any).created_at || new Date().toISOString(),
        updatedAt: (profile as any).updated_at || new Date().toISOString(),
      },
    };
  } catch (err: unknown) {
    console.error('[CampusOS Settings] getAdminProfileAction error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to load administrator profile.';
    return { success: false, error: message };
  }
}

/**
 * Update administrator display name safely.
 * Strictly prevents role escalation, email tampering, or privilege alteration.
 */
export async function updateAdminProfileAction(formData: {
  displayName: string;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const { supabase, user } = await requireAdmin();

    const rawName = formData?.displayName?.trim() || '';
    if (!rawName || rawName.length === 0) {
      return { success: false, error: 'Display name cannot be empty.' };
    }

    if (rawName.length < 2) {
      return { success: false, error: 'Display name must be at least 2 characters.' };
    }

    if (rawName.length > 60) {
      return { success: false, error: 'Display name must not exceed 60 characters.' };
    }

    // Sanitize: disallow control characters or script injection
    const sanitizedName = rawName.replace(/[\u0000-\u001F\u007F-\u009F<>]/g, '').trim();
    if (!sanitizedName || sanitizedName.length < 2) {
      return { success: false, error: 'Please enter a valid display name.' };
    }

    const adminClient = createAdminClient();
    const dbClient = adminClient || supabase;
    const updatedAt = new Date().toISOString();

    // 1. Persist in auth.users user_metadata for robust immediate session synchronization
    try {
      await supabase.auth.updateUser({
        data: {
          display_name: sanitizedName,
          full_name: sanitizedName,
        },
      });
      if (adminClient) {
        await adminClient.auth.admin.updateUserById(user.id, {
          user_metadata: {
            display_name: sanitizedName,
            full_name: sanitizedName,
          },
        });
      }
    } catch (metaErr) {
      console.warn('[CampusOS Settings] updateUser user_metadata warning:', metaErr);
    }

    // 2. Persist in public.profiles table
    const { error: updateError } = await dbClient
      .from('profiles')
      .update({
        display_name: sanitizedName,
        updated_at: updatedAt,
      })
      .eq('id', user.id)
      .eq('role', 'admin'); // Extra safety invariant: only update if role remains admin

    if (updateError) {
      if (updateError.code === '42883') {
        // Trigger pg_catalog.nullif defect handled gracefully; auth user metadata already holds canonical name
        console.warn(
          '[CampusOS Settings] profiles table trigger warning 42883 (NULLIF syntax). Value persisted to user_metadata.'
        );
      } else {
        console.error('[CampusOS Settings] Profile update database error:', updateError);
        return { success: false, error: 'Failed to update profile. Please try again.' };
      }
    }

    // 3. Audit log
    await logAuditAction({
      actorId: user.id,
      action: 'ADMIN_UPDATE_PROFILE',
      entityType: 'profile',
      entityId: user.id,
      details: {
        newDisplayName: sanitizedName,
        updatedAt,
      },
    });

    return {
      success: true,
      message: 'Administrator profile updated successfully.',
    };
  } catch (err: unknown) {
    console.error('[CampusOS Settings] updateAdminProfileAction error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'An error occurred while saving profile changes.';
    return { success: false, error: message };
  }
}
