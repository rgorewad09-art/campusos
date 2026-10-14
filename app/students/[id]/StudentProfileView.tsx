'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Mail,
  Phone,
  Hash,
  Clock,
  Edit2,
  Loader2,
  AlertCircle,
  Lock,
  UserX,
  Send,
  Check,
} from 'lucide-react';
import AppShell from '../../components/AppShell';
import StatusBadge from '../components/StatusBadge';
import EditStudentModal from './components/EditStudentModal';
import GuardianSection from './components/GuardianSection';
import DocumentSection from './components/DocumentSection';
import StudentAttendanceSection from './components/StudentAttendanceSection';
import { getStudentByIdAction, resendStudentInviteAction } from '@/app/actions/students';
import type { Student } from '@/src/types/student';
import StudentProfileSkeleton from '@/src/components/skeletons/StudentProfileSkeleton';

interface StudentProfileViewProps {
  studentId: string;
}

export default function StudentProfileView({ studentId }: StudentProfileViewProps) {
  const router = useRouter();

  const [student, setStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendDevLink, setResendDevLink] = useState<string | null>(null);
  const [copiedResendLink, setCopiedResendLink] = useState(false);

  async function handleResendInvite() {
    if (!student) return;

    setResendError(null);
    setResendSuccess(null);
    setResendDevLink(null);

    // Validate email presence before submitting
    if (!student.email || student.email.trim() === '') {
      setResendError(
        'This student does not have an email address on file. Please click "Edit Profile" and provide an email address before sending an activation invitation.'
      );
      return;
    }

    if (student.status === 'graduated') {
      setResendError('Cannot send an activation invitation to a graduated student.');
      return;
    }

    setIsResending(true);

    try {
      const res = await resendStudentInviteAction(student.id);
      if (res.success) {
        setResendSuccess(
          res.message || `Activation invitation successfully processed for ${student.first_name} (${student.email}).`
        );
        if (res.activationLink) {
          setResendDevLink(res.activationLink);
        }
      } else {
        setResendError(res.error || 'Failed to dispatch activation invitation. Please try again.');
      }
    } catch (err: unknown) {
      setResendError(
        err instanceof Error ? err.message : 'An unexpected error occurred while sending the activation invitation.'
      );
    } finally {
      setIsResending(false);
    }
  }

  const fetchStudent = useCallback(async () => {
    if (!studentId) return;
    setIsLoading(true);
    setErrorMessage(null);
    setNotFound(false);

    try {
      const res = await getStudentByIdAction(studentId);
      if (!res.success || !res.student) {
        setNotFound(true);
      } else {
        setStudent(res.student);
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to retrieve student profile.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchStudent();
  }, [fetchStudent]);

  function formatDate(dateStr: string) {
    if (!dateStr) return '—';
    const clean = dateStr.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      const m = parseInt(month, 10) - 1;
      if (m >= 0 && m < 12) {
        return `${monthNames[m]} ${parseInt(day, 10)}, ${year}`;
      }
    }
    return dateStr;
  }

  const fullName = student
    ? [student.first_name, student.middle_name, student.last_name]
        .filter(Boolean)
        .join(' ')
    : 'Student Profile';

  const initials = student
    ? `${student.first_name?.[0] || ''}${student.last_name?.[0] || ''}`.toUpperCase()
    : 'ST';

  if (isLoading) {
    return (
      <AppShell pageTitle="Student Profile">
        <StudentProfileSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell pageTitle={fullName}>
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        {/* Back navigation */}
        <div>
          <Link
            href="/students"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#737373] hover:text-[#171717] transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Back to Student Directory</span>
          </Link>
        </div>

        {/* Not Found state */}
        {!isLoading && notFound && (
          <div className="rounded-xl border border-[#E5E5E5] bg-white p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F7F7] text-[#737373] mb-3">
              <UserX size={24} />
            </div>
            <h2 className="text-base font-semibold text-[#171717]">
              Student Profile Not Found
            </h2>
            <p className="mt-1 text-xs text-[#737373] max-w-sm mx-auto">
              No student record was found corresponding to ID: <span className="font-mono">{studentId}</span>. The record may have been removed.
            </p>
            <button
              onClick={() => router.push('/students')}
              className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-[#111111] px-4 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors"
            >
              Return to Student Directory
            </button>
          </div>
        )}

        {/* Error state */}
        {!isLoading && !notFound && errorMessage && (
          <div className="flex items-start gap-3 rounded-lg border border-[#171717] bg-white p-4 text-xs text-[#171717]">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-[#171717]" />
            <div className="flex-1">
              <p className="font-semibold">Unable to load student profile</p>
              <p className="mt-0.5 text-[#737373]">{errorMessage}</p>
            </div>
            <button
              onClick={fetchStudent}
              className="rounded border border-[#171717] bg-[#171717] px-3 py-1 text-xs text-white hover:bg-[#262626] transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Profile Content */}
        {!isLoading && !notFound && student && (
          <>
            {/* Header Hero Card */}
            <div className="rounded-xl border border-[#E5E5E5] bg-white p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#171717] text-base font-bold text-white select-none">
                    {initials}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h1 className="text-xl font-bold tracking-tight text-[#171717]">
                        {fullName}
                      </h1>
                      <StatusBadge status={student.status} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#737373]">
                      <span className="flex items-center gap-1 font-mono font-medium text-[#171717]">
                        <Hash size={12} className="text-[#737373]" />
                        {student.student_code}
                      </span>
                      <span>•</span>
                      <span>Enrolled: {formatDate(student.enrollment_date)}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
                  {/* Send Activation Invite Button */}
                  <button
                    type="button"
                    disabled={isResending}
                    onClick={handleResendInvite}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#E5E5E5] bg-white px-3.5 py-2 text-xs font-medium text-[#171717] hover:bg-[#F7F7F7] hover:border-[#171717] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    title={
                      !student.email
                        ? 'Student has no email address on file'
                        : 'Send account activation invitation and generate password setup link'
                    }
                  >
                    {isResending ? (
                      <Loader2 size={13} className="animate-spin text-[#171717]" />
                    ) : (
                      <Send size={13} />
                    )}
                    <span>{isResending ? 'Sending Invite...' : 'Send Activation Invite'}</span>
                  </button>

                  {/* Edit Action Button */}
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#171717] bg-[#171717] px-4 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors shadow-sm"
                  >
                    <Edit2 size={13} />
                    <span>Edit Profile</span>
                  </button>
                </div>
              </div>

              {/* Activation Error Alert */}
              {resendError && (
                <div className="mt-4 flex items-start justify-between gap-3 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] p-3 text-xs text-[#991B1B]">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-[#DC2626]" />
                    <div>
                      <p className="font-semibold">Activation Notice</p>
                      <p className="mt-0.5 text-[#B91C1C]">{resendError}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setResendError(null)}
                    className="text-[#991B1B] hover:text-[#7F1D1D] text-xs font-semibold px-1"
                    title="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Activation Success & Link Card */}
              {resendSuccess && (
                <div className="mt-4 rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-4 text-xs text-[#171717]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 text-emerald-800">
                      <Check size={16} className="text-emerald-600 shrink-0" />
                      <span className="font-semibold">{resendSuccess}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setResendSuccess(null);
                        setResendDevLink(null);
                      }}
                      className="text-[#737373] hover:text-[#171717] text-xs font-semibold px-1"
                      title="Dismiss"
                    >
                      ✕
                    </button>
                  </div>

                  {resendDevLink && (
                    <div className="mt-3 rounded-md border border-[#E5E5E5] bg-white p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-[#171717]">
                          Activation Link (Direct / Development Setup)
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            await navigator.clipboard.writeText(resendDevLink);
                            setCopiedResendLink(true);
                            setTimeout(() => setCopiedResendLink(false), 2000);
                          }}
                          className="inline-flex items-center gap-1.5 rounded bg-[#171717] px-3 py-1 text-[11px] font-medium text-white hover:bg-[#262626] transition-colors"
                        >
                          {copiedResendLink ? (
                            <>
                              <Check size={12} className="text-emerald-400" />
                              <span>Copied Link!</span>
                            </>
                          ) : (
                            <>
                              <span>Copy Link</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="font-mono text-[11px] text-[#525252] break-all select-all bg-[#FAFAFA] p-2.5 rounded border border-[#F0F0F0]">
                        {resendDevLink}
                      </p>
                      <p className="mt-2 text-[11px] text-[#737373]">
                        Share this link with the student to verify their email and set their CampusOS password.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Academic & Personal Details Card */}
            <div className="rounded-xl border border-[#E5E5E5] bg-white p-6 sm:p-8">
              <div className="border-b border-[#E5E5E5] pb-4 mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-[#171717]">
                    Student Information
                  </h2>
                  <p className="text-xs text-[#737373]">
                    Personal demographics, contact lines, and enrollment metrics.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                {/* Student Code (Read-Only) */}
                <div className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-3.5">
                  <div className="flex items-center justify-between text-[#737373] mb-1">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Hash size={13} />
                      <span>Student Code</span>
                    </span>
                    <span className="flex items-center gap-1 text-[10px] bg-white border border-[#E5E5E5] px-1.5 py-0.5 rounded text-[#737373]">
                      <Lock size={10} />
                      <span>Read-only</span>
                    </span>
                  </div>
                  <span className="font-mono font-semibold text-sm text-[#171717]">
                    {student.student_code}
                  </span>
                </div>

                {/* Enrollment Date */}
                <div className="rounded-lg border border-[#E5E5E5] bg-white p-3.5">
                  <span className="flex items-center gap-1.5 text-[#737373] mb-1 font-medium">
                    <Calendar size={13} />
                    <span>Enrollment Date</span>
                  </span>
                  <span className="font-semibold text-sm text-[#171717]">
                    {formatDate(student.enrollment_date)}
                  </span>
                </div>

                {/* Status */}
                <div className="rounded-lg border border-[#E5E5E5] bg-white p-3.5">
                  <span className="flex items-center gap-1.5 text-[#737373] mb-1 font-medium">
                    <span>Enrollment Status</span>
                  </span>
                  <div className="mt-1">
                    <StatusBadge status={student.status} />
                  </div>
                </div>

                {/* Date of Birth */}
                <div className="rounded-lg border border-[#E5E5E5] bg-white p-3.5">
                  <span className="flex items-center gap-1.5 text-[#737373] mb-1 font-medium">
                    <Calendar size={13} />
                    <span>Date of Birth</span>
                  </span>
                  <span className="font-medium text-[#171717]">
                    {formatDate(student.date_of_birth)}
                  </span>
                </div>

                {/* Email */}
                <div className="rounded-lg border border-[#E5E5E5] bg-white p-3.5">
                  <span className="flex items-center gap-1.5 text-[#737373] mb-1 font-medium">
                    <Mail size={13} />
                    <span>Email Address</span>
                  </span>
                  <span className="font-medium text-[#171717] break-all">
                    {student.email || 'Not provided'}
                  </span>
                </div>

                {/* Phone */}
                <div className="rounded-lg border border-[#E5E5E5] bg-white p-3.5">
                  <span className="flex items-center gap-1.5 text-[#737373] mb-1 font-medium">
                    <Phone size={13} />
                    <span>Phone Number</span>
                  </span>
                  <span className="font-medium text-[#171717]">
                    {student.phone || 'Not provided'}
                  </span>
                </div>

                {/* Record Created */}
                <div className="rounded-lg border border-[#E5E5E5] bg-white p-3.5">
                  <span className="flex items-center gap-1.5 text-[#737373] mb-1 font-medium">
                    <Clock size={13} />
                    <span>Created Date</span>
                  </span>
                  <span className="font-medium text-[#171717]">
                    {formatDate(student.created_at)}
                  </span>
                </div>

                {/* Record Updated */}
                <div className="rounded-lg border border-[#E5E5E5] bg-white p-3.5">
                  <span className="flex items-center gap-1.5 text-[#737373] mb-1 font-medium">
                    <Clock size={13} />
                    <span>Last Updated</span>
                  </span>
                  <span className="font-medium text-[#171717]">
                    {formatDate(student.updated_at)}
                  </span>
                </div>
              </div>
            </div>

            {/* Guardians Section */}
            <GuardianSection
              studentId={student.id}
              studentName={fullName}
            />

            {/* Documents Section */}
            <DocumentSection
              studentId={student.id}
              studentName={fullName}
            />

            {/* Attendance Metrics Section */}
            <StudentAttendanceSection student={student} />

            {/* Edit Modal */}
            <EditStudentModal
              isOpen={isEditModalOpen}
              onClose={() => setIsEditModalOpen(false)}
              onSuccess={(updated) => setStudent(updated)}
              student={student}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}
