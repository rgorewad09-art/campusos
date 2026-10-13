'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, Lock } from 'lucide-react';
import type { Student, StudentFormData, StudentStatus } from '@/src/types/student';
import { updateStudentAction } from '@/app/actions/students';

interface EditStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: Student) => void;
  student: Student;
}

const statusOptions: { value: StudentStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'pending', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'graduated', label: 'Graduated' },
];

export default function EditStudentModal({
  isOpen,
  onClose,
  onSuccess,
  student,
}: EditStudentModalProps) {
  const [formData, setFormData] = useState<StudentFormData>({
    first_name: student.first_name || '',
    middle_name: student.middle_name || '',
    last_name: student.last_name || '',
    date_of_birth: student.date_of_birth ? student.date_of_birth.split('T')[0] : '',
    email: student.email || '',
    phone: student.phone || '',
    enrollment_date: student.enrollment_date ? student.enrollment_date.split('T')[0] : '',
    status: student.status || 'active',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setFormData({
      first_name: student.first_name || '',
      middle_name: student.middle_name || '',
      last_name: student.last_name || '',
      date_of_birth: student.date_of_birth ? student.date_of_birth.split('T')[0] : '',
      email: student.email || '',
      phone: student.phone || '',
      enrollment_date: student.enrollment_date ? student.enrollment_date.split('T')[0] : '',
      status: student.status || 'active',
    });
    setErrors({});
    setGeneralError(null);
  }, [student, isOpen]);

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
    }
    if (!formData.enrollment_date) {
      newErrors.enrollment_date = 'Enrollment date is required.';
    }
    if (formData.email && formData.email.trim()) {
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
      const res = await updateStudentAction(student.id, formData);
      if (!res.success || !res.student) {
        setGeneralError(res.error || 'Failed to update student profile.');
      } else {
        onSuccess(res.student);
        onClose();
      }
    } catch (err: unknown) {
      setGeneralError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-student-title"
    >
      <div className="relative w-full max-w-xl rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-xl my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-4">
          <div>
            <h2 id="edit-student-title" className="text-base font-semibold text-[#171717]">
              Edit Student Profile
            </h2>
            <p className="text-xs text-[#737373] mt-0.5">
              Modify personal details and academic status.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-[#737373] hover:text-[#171717] transition-colors"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {generalError && (
            <div className="flex items-start gap-2 rounded-md border border-[#171717] bg-[#F7F7F7] p-3 text-xs text-[#171717]">
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-[#171717]" />
              <span className="flex-1">{generalError}</span>
            </div>
          )}

          {/* Read-Only Student Code Callout */}
          <div className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#737373]">
                Student ID (System Generated)
              </span>
              <p className="font-mono text-sm font-semibold text-[#171717] mt-0.5">
                {student.student_code}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#737373] bg-white border border-[#E5E5E5] px-2.5 py-1 rounded">
              <Lock size={12} />
              <span>Read-only</span>
            </div>
          </div>

          {/* Name fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="edit_first_name" className="block text-xs font-medium text-[#171717] mb-1">
                First Name <span className="font-bold">*</span>
              </label>
              <input
                id="edit_first_name"
                type="text"
                required
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className={`w-full rounded-md border bg-white px-3 py-2 text-xs text-[#171717] focus:border-[#171717] focus:outline-none transition-colors ${
                  errors.first_name ? 'border-[#171717]' : 'border-[#E5E5E5]'
                }`}
              />
              {errors.first_name && (
                <p className="mt-1 text-[11px] text-[#171717]">{errors.first_name}</p>
              )}
            </div>

            <div>
              <label htmlFor="edit_middle_name" className="block text-xs font-medium text-[#737373] mb-1">
                Middle Name
              </label>
              <input
                id="edit_middle_name"
                type="text"
                placeholder="Optional"
                value={formData.middle_name || ''}
                onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
                className="w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-xs text-[#171717] focus:border-[#171717] focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label htmlFor="edit_last_name" className="block text-xs font-medium text-[#171717] mb-1">
                Last Name <span className="font-bold">*</span>
              </label>
              <input
                id="edit_last_name"
                type="text"
                required
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className={`w-full rounded-md border bg-white px-3 py-2 text-xs text-[#171717] focus:border-[#171717] focus:outline-none transition-colors ${
                  errors.last_name ? 'border-[#171717]' : 'border-[#E5E5E5]'
                }`}
              />
              {errors.last_name && (
                <p className="mt-1 text-[11px] text-[#171717]">{errors.last_name}</p>
              )}
            </div>
          </div>

          {/* DOB & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit_dob" className="block text-xs font-medium text-[#171717] mb-1">
                Date of Birth <span className="font-bold">*</span>
              </label>
              <input
                id="edit_dob"
                type="date"
                required
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                className={`w-full rounded-md border bg-white px-3 py-2 text-xs text-[#171717] focus:border-[#171717] focus:outline-none transition-colors ${
                  errors.date_of_birth ? 'border-[#171717]' : 'border-[#E5E5E5]'
                }`}
              />
              {errors.date_of_birth && (
                <p className="mt-1 text-[11px] text-[#171717]">{errors.date_of_birth}</p>
              )}
            </div>

            <div>
              <label htmlFor="edit_status" className="block text-xs font-medium text-[#171717] mb-1">
                Status <span className="font-bold">*</span>
              </label>
              <select
                id="edit_status"
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as StudentStatus })
                }
                className="w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-xs text-[#171717] focus:border-[#171717] focus:outline-none transition-colors"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit_email" className="block text-xs font-medium text-[#737373] mb-1">
                Email Address
              </label>
              <input
                id="edit_email"
                type="email"
                placeholder="student@example.com"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`w-full rounded-md border bg-white px-3 py-2 text-xs text-[#171717] focus:border-[#171717] focus:outline-none transition-colors ${
                  errors.email ? 'border-[#171717]' : 'border-[#E5E5E5]'
                }`}
              />
              {errors.email && (
                <p className="mt-1 text-[11px] text-[#171717]">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="edit_phone" className="block text-xs font-medium text-[#737373] mb-1">
                Phone Number
              </label>
              <input
                id="edit_phone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-xs text-[#171717] focus:border-[#171717] focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Enrollment Date */}
          <div>
            <label htmlFor="edit_enrollment_date" className="block text-xs font-medium text-[#171717] mb-1">
              Enrollment Date <span className="font-bold">*</span>
            </label>
            <input
              id="edit_enrollment_date"
              type="date"
              required
              value={formData.enrollment_date}
              onChange={(e) => setFormData({ ...formData, enrollment_date: e.target.value })}
              className={`w-full rounded-md border bg-white px-3 py-2 text-xs text-[#171717] focus:border-[#171717] focus:outline-none transition-colors ${
                errors.enrollment_date ? 'border-[#171717]' : 'border-[#E5E5E5]'
              }`}
            />
            {errors.enrollment_date && (
              <p className="mt-1 text-[11px] text-[#171717]">{errors.enrollment_date}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#E5E5E5] pt-4 mt-6">
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
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
