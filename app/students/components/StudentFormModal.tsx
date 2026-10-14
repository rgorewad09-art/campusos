'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Student, StudentFormData, StudentStatus } from '@/src/types/student';
import { enrollStudentAction, updateStudentAction } from '@/app/actions/students';

interface StudentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (student: Student) => void;
  initialData?: Student | null;
  mode: 'enroll' | 'edit';
}

const defaultStatusOptions: { value: StudentStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'pending', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'graduated', label: 'Graduated' },
];

export default function StudentFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  mode,
}: StudentFormModalProps) {
  const isEdit = mode === 'edit';
  const [todayStr, setTodayStr] = useState<string>('');

  const [formData, setFormData] = useState<StudentFormData>({
    first_name: '',
    middle_name: '',
    last_name: '',
    date_of_birth: '',
    email: '',
    phone: '',
    enrollment_date: '',
    status: 'active',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enrolledStudent, setEnrolledStudent] = useState<Student | null>(null);
  const [inviteDispatched, setInviteDispatched] = useState<boolean | null>(null);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setTodayStr(today);

    if (initialData && isEdit) {
      setFormData({
        first_name: initialData.first_name || '',
        middle_name: initialData.middle_name || '',
        last_name: initialData.last_name || '',
        date_of_birth: initialData.date_of_birth ? initialData.date_of_birth.split('T')[0] : '',
        email: initialData.email || '',
        phone: initialData.phone || '',
        enrollment_date: initialData.enrollment_date
          ? initialData.enrollment_date.split('T')[0]
          : today,
        status: initialData.status || 'active',
      });
    } else {
      setFormData({
        first_name: '',
        middle_name: '',
        last_name: '',
        date_of_birth: '',
        email: '',
        phone: '',
        enrollment_date: today,
        status: 'active',
      });
    }
    setErrors({});
    setGeneralError(null);
    setEnrolledStudent(null);
  }, [initialData, isEdit, isOpen]);

  if (!isOpen) return null;

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.first_name.trim()) {
      newErrors.first_name = 'First name is required.';
    }
    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Last name is required.';
    }
    if (!formData.date_of_birth) {
      newErrors.date_of_birth = 'Date of birth is required.';
    } else if (todayStr && formData.date_of_birth >= todayStr) {
      newErrors.date_of_birth = 'Date of birth must be a past date.';
    }
    if (!formData.enrollment_date) {
      newErrors.enrollment_date = 'Enrollment date is required.';
    }
    if (!formData.email || !formData.email.trim()) {
      newErrors.email = 'Student email is required for account activation.';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = 'Please enter a valid email address.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGeneralError(null);

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      if (isEdit && initialData) {
        const result = await updateStudentAction(initialData.id, formData);
        if (!result.success || !result.student) {
          setGeneralError(result.error || 'Failed to update student profile.');
        } else {
          onSuccess(result.student);
          onClose();
        }
      } else {
        const result = await enrollStudentAction(formData);
        if (!result.success || !result.student) {
          setGeneralError(result.error || 'Failed to enroll student.');
        } else {
          setEnrolledStudent(result.student);
          setInviteDispatched(Boolean(result.invitationSent));
          onSuccess(result.student);
        }
      }
    } catch (err: unknown) {
      setGeneralError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEnrollAnother() {
    setEnrolledStudent(null);
    setFormData({
      first_name: '',
      middle_name: '',
      last_name: '',
      date_of_birth: '',
      email: '',
      phone: '',
      enrollment_date: todayStr,
      status: 'active',
    });
    setErrors({});
    setGeneralError(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="relative w-full max-w-xl rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-xl my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-4">
          <div>
            <h2 id="modal-title" className="text-base font-semibold text-[#171717]">
              {isEdit ? 'Edit Student Details' : 'Enroll New Student'}
            </h2>
            <p className="text-xs text-[#737373] mt-0.5">
              {isEdit
                ? `Editing record for ${initialData?.student_code}`
                : 'Enter student personal and enrollment information.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-[#737373] hover:text-[#171717] transition-colors"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Success Confirmation View (After Enrollment) */}
        {enrolledStudent && !isEdit ? (
          <div className="py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#171717] bg-[#F7F7F7] text-[#171717]">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="mt-4 text-base font-semibold text-[#171717]">
              Student Successfully Enrolled
            </h3>
            <p className="mt-1 text-xs text-[#737373]">
              The student profile has been created in the database.
            </p>

            {/* Generated Student Code Callout */}
            <div className="mt-5 inline-block rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] px-6 py-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                Assigned Student ID
              </span>
              <p className="mt-1 font-mono text-xl font-bold tracking-tight text-[#171717]">
                {enrolledStudent.student_code}
              </p>
              <p className="mt-1 text-xs font-medium text-[#171717]">
                {enrolledStudent.first_name} {enrolledStudent.last_name}
              </p>
            </div>

            {/* Account Activation Notice */}
            <div className="mt-4 max-w-sm mx-auto rounded-lg border border-[#E5E5E5] bg-white p-3 text-left shadow-sm">
              <p className="text-xs font-semibold text-[#171717]">
                {inviteDispatched ? '✓ Activation Email Dispatched' : '• Account Activation Notice'}
              </p>
              <p className="text-[11px] text-[#737373] mt-1 leading-relaxed">
                {inviteDispatched
                  ? `An account activation email was sent to ${enrolledStudent.email}.`
                  : `Student record created with ID ${enrolledStudent.student_code}. Account activation invitation is pending external SMTP or redirect URL configuration.`}
              </p>
            </div>

            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleEnrollAnother}
                className="rounded-md border border-[#E5E5E5] bg-white px-4 py-2 text-xs font-medium text-[#171717] hover:bg-[#F7F7F7] transition-colors"
              >
                Enroll Another Student
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-[#171717] bg-[#171717] px-4 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Form View */
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {generalError && (
              <div className="flex items-start gap-2 rounded-md border border-[#171717] bg-[#F7F7F7] p-3 text-xs text-[#171717]">
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-[#171717]" />
                <span className="flex-1">{generalError}</span>
              </div>
            )}

            {/* Name row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="first_name"
                  className="block text-xs font-medium text-[#171717] mb-1"
                >
                  First Name <span className="text-[#171717] font-bold">*</span>
                </label>
                <input
                  id="first_name"
                  type="text"
                  required
                  placeholder="e.g. John"
                  value={formData.first_name}
                  onChange={(e) =>
                    setFormData({ ...formData, first_name: e.target.value })
                  }
                  className={`w-full rounded-md border bg-white px-3 py-2 text-xs text-[#171717] placeholder:text-[#A3A3A3] focus:border-[#171717] focus:outline-none transition-colors ${
                    errors.first_name ? 'border-[#171717]' : 'border-[#E5E5E5]'
                  }`}
                />
                {errors.first_name && (
                  <p className="mt-1 text-[11px] text-[#171717]">{errors.first_name}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="middle_name"
                  className="block text-xs font-medium text-[#737373] mb-1"
                >
                  Middle Name (Optional)
                </label>
                <input
                  id="middle_name"
                  type="text"
                  placeholder="e.g. Robert"
                  value={formData.middle_name || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, middle_name: e.target.value })
                  }
                  className="w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-xs text-[#171717] placeholder:text-[#A3A3A3] focus:border-[#171717] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label
                  htmlFor="last_name"
                  className="block text-xs font-medium text-[#171717] mb-1"
                >
                  Last Name <span className="text-[#171717] font-bold">*</span>
                </label>
                <input
                  id="last_name"
                  type="text"
                  required
                  placeholder="e.g. Doe"
                  value={formData.last_name}
                  onChange={(e) =>
                    setFormData({ ...formData, last_name: e.target.value })
                  }
                  className={`w-full rounded-md border bg-white px-3 py-2 text-xs text-[#171717] placeholder:text-[#A3A3A3] focus:border-[#171717] focus:outline-none transition-colors ${
                    errors.last_name ? 'border-[#171717]' : 'border-[#E5E5E5]'
                  }`}
                />
                {errors.last_name && (
                  <p className="mt-1 text-[11px] text-[#171717]">{errors.last_name}</p>
                )}
              </div>
            </div>

            {/* Date of Birth & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="date_of_birth"
                  className="block text-xs font-medium text-[#171717] mb-1"
                >
                  Date of Birth <span className="text-[#171717] font-bold">*</span>
                </label>
                <input
                  id="date_of_birth"
                  type="date"
                  required
                  max={todayStr}
                  value={formData.date_of_birth}
                  onChange={(e) =>
                    setFormData({ ...formData, date_of_birth: e.target.value })
                  }
                  className={`w-full rounded-md border bg-white px-3 py-2 text-xs text-[#171717] focus:border-[#171717] focus:outline-none transition-colors ${
                    errors.date_of_birth ? 'border-[#171717]' : 'border-[#E5E5E5]'
                  }`}
                />
                {errors.date_of_birth && (
                  <p className="mt-1 text-[11px] text-[#171717]">
                    {errors.date_of_birth}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="status"
                  className="block text-xs font-medium text-[#171717] mb-1"
                >
                  Status <span className="text-[#171717] font-bold">*</span>
                </label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value as StudentStatus,
                    })
                  }
                  className="w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-xs text-[#171717] focus:border-[#171717] focus:outline-none transition-colors"
                >
                  {defaultStatusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Contact row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-medium text-[#171717] mb-1"
                >
                  Email Address <span className="text-[#171717] font-bold">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="student@example.com"
                  value={formData.email || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className={`w-full rounded-md border bg-white px-3 py-2 text-xs text-[#171717] placeholder:text-[#A3A3A3] focus:border-[#171717] focus:outline-none transition-colors ${
                    errors.email ? 'border-[#171717]' : 'border-[#E5E5E5]'
                  }`}
                />
                {errors.email && (
                  <p className="mt-1 text-[11px] text-[#171717]">{errors.email}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="block text-xs font-medium text-[#737373] mb-1"
                >
                  Phone Number (Optional)
                </label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={formData.phone || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-xs text-[#171717] placeholder:text-[#A3A3A3] focus:border-[#171717] focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Enrollment Date */}
            <div>
              <label
                htmlFor="enrollment_date"
                className="block text-xs font-medium text-[#171717] mb-1"
              >
                Enrollment Date <span className="text-[#171717] font-bold">*</span>
              </label>
              <input
                id="enrollment_date"
                type="date"
                required
                value={formData.enrollment_date}
                onChange={(e) =>
                  setFormData({ ...formData, enrollment_date: e.target.value })
                }
                className={`w-full rounded-md border bg-white px-3 py-2 text-xs text-[#171717] focus:border-[#171717] focus:outline-none transition-colors ${
                  errors.enrollment_date ? 'border-[#171717]' : 'border-[#E5E5E5]'
                }`}
              />
              {errors.enrollment_date && (
                <p className="mt-1 text-[11px] text-[#171717]">
                  {errors.enrollment_date}
                </p>
              )}
            </div>

            {/* Note on Student Code */}
            {!isEdit && (
              <p className="text-[11px] text-[#737373] bg-[#F7F7F7] p-2.5 rounded border border-[#E5E5E5]">
                Note: A unique Student ID will be automatically generated by the database sequence upon successful enrollment.
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-[#E5E5E5] pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-xs font-medium text-[#171717] hover:bg-[#F7F7F7] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 rounded-md border border-[#171717] bg-[#171717] px-4 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>{isEdit ? 'Saving...' : 'Enrolling...'}</span>
                  </>
                ) : (
                  <span>{isEdit ? 'Save Changes' : 'Enroll Student'}</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
