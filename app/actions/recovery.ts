'use server';

import { createAdminClient } from '@/src/lib/supabase/admin';
import { createClient } from '@/src/lib/supabase/server';
import {
  checkRequestRateLimit,
  generateRecoveryOtp,
  storeRecoveryOtp,
  verifyRecoveryOtp,
  validateAndConsumeResetTicket,
} from '@/src/lib/recovery';
import { logAuditAction } from '@/src/lib/audit';

export interface RecoveryActionState {
  success?: boolean;
  error?: string;
  message?: string;
  ticket?: string;
  email?: string;
  destination?: string;
}

/**
 * Initiates password recovery for an Administrator, Teacher, or Student.
 * Resolves College ID / Teacher ID if entered.
 * ALWAYS returns a generic success response to prevent account enumeration.
 */
export async function requestPasswordRecoveryAction(
  _prevState: RecoveryActionState | null,
  formData: FormData
): Promise<RecoveryActionState> {
  const rawIdentifier = (
    formData.get('identifier') ||
    formData.get('email')
  )?.toString().trim();

  if (!rawIdentifier) {
    return { error: 'Please enter your registered email address or institutional ID.' };
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    console.error('[CampusOS Recovery] Admin client unavailable for recovery lookup');
    return {
      success: true,
      message: 'If an account exists with this email, a verification code has been dispatched.',
      email: rawIdentifier,
    };
  }

  // 1. Resolve identifier to email address
  let targetEmail: string | null = null;

  if (rawIdentifier.includes('@')) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(rawIdentifier)) {
      targetEmail = rawIdentifier.toLowerCase();
    }
  } else {
    // Check Teacher or Student Code
    const cleanCode = rawIdentifier.replace(/[%_]/g, '').trim();
    if (cleanCode.toUpperCase().startsWith('TCH')) {
      const { data: teacher } = await adminClient
        .from('teachers')
        .select('email')
        .ilike('teacher_code', cleanCode)
        .maybeSingle();
      if (teacher?.email) targetEmail = teacher.email.toLowerCase();
    } else {
      const { data: student } = await adminClient
        .from('students')
        .select('email')
        .ilike('student_code', cleanCode)
        .maybeSingle();
      if (student?.email) {
        targetEmail = student.email.toLowerCase();
      } else {
        // Fallback check teacher table
        const { data: teacher } = await adminClient
          .from('teachers')
          .select('email')
          .ilike('teacher_code', cleanCode)
          .maybeSingle();
        if (teacher?.email) targetEmail = teacher.email.toLowerCase();
      }
    }
  }

  // Standard generic response for anti-enumeration
  const genericSuccessResponse: RecoveryActionState = {
    success: true,
    message: 'If an account exists with this email, a verification code has been dispatched.',
    email: targetEmail || rawIdentifier.toLowerCase(),
  };

  if (!targetEmail) {
    return genericSuccessResponse;
  }

  // 2. Check rate limit
  const rateCheck = checkRequestRateLimit(targetEmail);
  if (!rateCheck.allowed) {
    return {
      error: `Too many recovery requests. Please wait ${rateCheck.retryAfterSeconds || 60} seconds before requesting another code.`,
    };
  }

  // 3. Locate user in auth.users
  const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
  if (listError || !users) {
    console.error('[CampusOS Recovery] listUsers error:', listError?.message);
    return genericSuccessResponse;
  }

  const matchedUser = users.find(
    (u) => u.email && u.email.toLowerCase() === targetEmail.toLowerCase()
  );

  if (!matchedUser) {
    // Anti-enumeration: return success even if user not in auth.users
    return genericSuccessResponse;
  }

  // 4. Generate cryptographically secure OTP and store salted SHA-256 hash
  const rawOtp = generateRecoveryOtp();
  storeRecoveryOtp(targetEmail, matchedUser.id, rawOtp);

  // 5. Trigger Supabase native password recovery dispatch if configured
  try {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/confirm?next=/activate/password`,
    });
  } catch (err) {
    // Non-blocking: background dispatch failure does not leak error to user
    console.error('[CampusOS Recovery] resetPasswordForEmail dispatch note:', err);
  }

  // Audit log recovery request (omits OTP value)
  await logAuditAction({
    actorId: matchedUser.id,
    action: 'request_password_recovery',
    entityId: matchedUser.id,
    entityType: 'auth_user',
    details: { email_domain: targetEmail.split('@')[1] },
  });

  return genericSuccessResponse;
}

/**
 * Verifies the 6-digit recovery OTP entered by the user.
 * Timing-safe, single-use, protected against brute force.
 */
export async function verifyPasswordRecoveryOtpAction(
  _prevState: RecoveryActionState | null,
  formData: FormData
): Promise<RecoveryActionState> {
  const email = formData.get('email')?.toString().trim();
  const code = formData.get('code')?.toString().trim();

  if (!email || !code) {
    return { error: 'Please enter both your email address and the 6-digit verification code.' };
  }

  // Verify against server-side recovery engine
  const result = verifyRecoveryOtp(email, code);

  if (!result.success) {
    // Also check if Supabase verifyOtp accepts the code (fallback if dispatched via Supabase email template)
    try {
      const supabase = await createClient();
      const { data: supaVerify, error: supaErr } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'recovery',
      });

      if (!supaErr && supaVerify?.user) {
        const adminClient = createAdminClient();
        if (adminClient) {
          const { generateResetTicket } = await import('@/src/lib/recovery');
          const ticket = generateResetTicket(email, supaVerify.user.id);
          return {
            success: true,
            ticket,
            email,
            message: 'Code verified successfully. Please enter your new password.',
          };
        }
      }
    } catch {
      // Fall through to error
    }

    return { error: result.error || 'Invalid or expired verification code.' };
  }

  return {
    success: true,
    ticket: result.ticket,
    email,
    message: 'Code verified successfully. Please enter your new password.',
  };
}

/**
 * Finalizes the password reset using the cryptographically signed, single-use reset ticket.
 * Enforces minimum 8 characters, confirmation match, and updates password securely on server.
 */
export async function resetPasswordWithTicketAction(
  _prevState: RecoveryActionState | null,
  formData: FormData
): Promise<RecoveryActionState> {
  const ticket = formData.get('ticket')?.toString();
  const password = formData.get('password')?.toString();
  const confirmPassword = formData.get('confirm_password')?.toString();

  if (!ticket) {
    return { error: 'Missing recovery verification ticket. Please restart the recovery process.' };
  }

  if (!password || password.length < 8) {
    return { error: 'Password must be at least 8 characters in length.' };
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match. Please re-enter your password.' };
  }

  // Validate and consume the ticket
  const validation = validateAndConsumeResetTicket(ticket);
  if (!validation.valid || !validation.userId) {
    return { error: validation.error || 'Invalid or expired recovery ticket. Please request a new code.' };
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    return { error: 'Internal error: Administrator client unavailable.' };
  }

  // Update user's password securely via admin client
  const { error: updateErr } = await adminClient.auth.admin.updateUserById(
    validation.userId,
    { password }
  );

  if (updateErr) {
    console.error('[CampusOS Recovery] updateUserById error:', updateErr.message);
    return { error: 'Failed to update password. Please try again or contact your administrator.' };
  }

  // Determine user's authoritative role to provide the correct sign-in destination
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', validation.userId)
    .maybeSingle();

  const role = profile?.role || 'student';
  const destination =
    role === 'admin'
      ? '/login?recovered=true'
      : role === 'teacher'
      ? '/teacher/login?recovered=true'
      : '/student/login?recovered=true';

  await logAuditAction({
    actorId: validation.userId,
    action: 'password_reset_completed',
    entityId: validation.userId,
    entityType: 'auth_user',
    details: { role },
  });

  return {
    success: true,
    destination,
    message: 'Your password has been successfully updated. Redirecting to sign in...',
  };
}
