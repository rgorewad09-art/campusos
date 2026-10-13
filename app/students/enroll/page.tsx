'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import AppShell from '../../components/AppShell';
import { enrollStudentAction } from '@/app/actions/students';
import type { Student, StudentFormData, StudentStatus } from '@/src/types/student';

const defaultStatusOptions: { value: StudentStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'pending', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'graduated', label: 'Graduated' },
];

export default function EnrollStudentPage() {
  const router = useRouter();
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

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setTodayStr(today);
    setFormData((prev) => ({
      ...prev,
      enrollment_date: prev.enrollment_date || today,
    }));
  }, []);

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
      const result = await enrollStudentAction(formData);
      if (!result.success || !result.student) {
        setGeneralError(result.error || 'Failed to enroll student.');
      } else {
        setEnrolledStudent(result.student);
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
    <AppShell pageTitle="Enroll Student">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        {/* Navigation link */}
        <div>
          <Link
            href="/students"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#737373] hover:text-[#171717] transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Back to Student Directory</span>
          </Link>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-[#E5E5E5] bg-white p-6 sm:p-8">
          {/* Header */}
          <div className="border-b border-[#E5E5E5] pb-5">
            <h1 className="text-lg font-semibold text-[#171717]">
              Manual Student Enrollment
            </h1>
            <p className="mt-1 text-xs text-[#737373]">
              Add a new student profile to CampusOS. A unique Student ID will be generated upon submission.
            </p>
          </div>

          {/* Success Screen */}
          {enrolledStudent ? (
            <div className="py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#171717] bg-[#F7F7F7] text-[#171717]">
                <CheckCircle2 size={24} />
              </div>
              <h2 className="mt-4 text-base font-semibold text-[#171717]">
                Enrollment Completed Successfully
              </h2>
              <p className="mt-1 text-xs text-[#737373]">
                The student record has been committed to the database.
              </p>

              {/* Unique Student Code Callout */}
              <div className="mt-6 inline-block rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] px-8 py-5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                  Generated Student ID
                </span>
                <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-[#171717]">
                  {enrolledStudent.student_code}
                </p>
                <p className="mt-1.5 text-xs font-medium text-[#171717]">
                  {enrolledStudent.first_name} {enrolledStudent.last_name}
                </p>
              </div>

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleEnrollAnother}
                  className="w-full sm:w-auto rounded-md border border-[#E5E5E5] bg-white px-4 py-2 text-xs font-medium text-[#171717] hover:bg-[#F7F7F7] transition-colors"
                >
                  Enroll Another Student
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/students')}
                  className="w-full sm:w-auto rounded-md border border-[#171717] bg-[#171717] px-5 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors"
                >
                  View in Directory
                </button>
              </div>
            </div>
          ) : (
            /* Enrollment Form */
            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              {generalError && (
                <div className="flex items-start gap-2.5 rounded-md border border-[#171717] bg-[#F7F7F7] p-3 text-xs text-[#171717]">
                  <AlertCircle size={15} className="mt-0.5 shrink-0 text-[#171717]" />
                  <span className="flex-1">{generalError}</span>
                </div>
              )}

              {/* Name Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="first_name"
                    className="block text-xs font-medium text-[#171717] mb-1.5"
                  >
                    First Name <span className="text-[#171717] font-bold">*</span>
                  </label>
                  <input
                    id="first_name"
                    type="text"
                    required
                    placeholder="e.g. Maya"
                    value={formData.first_name}
                    onChange={(e) =>
                      setFormData({ ...formData, first_name: e.target.value })
                    }
                    className={`w-full rounded-md border bg-white px-3 py-2 text-xs text-[#171717] placeholder:text-[#A3A3A3] focus:border-[#171717] focus:outline-none transition-colors ${
                      errors.first_name ? 'border-[#171717]' : 'border-[#E5E5E5]'
                    }`}
                  />
                  {errors.first_name && (
                    <p className="mt-1 text-[11px] text-[#171717]">
                      {errors.first_name}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="middle_name"
                    className="block text-xs font-medium text-[#737373] mb-1.5"
                  >
                    Middle Name
                  </label>
                  <input
                    id="middle_name"
                    type="text"
                    placeholder="Optional"
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
                    className="block text-xs font-medium text-[#171717] mb-1.5"
                  >
                    Last Name <span className="text-[#171717] font-bold">*</span>
                  </label>
                  <input
                    id="last_name"
                    type="text"
                    required
                    placeholder="e.g. Patel"
                    value={formData.last_name}
                    onChange={(e) =>
                      setFormData({ ...formData, last_name: e.target.value })
                    }
                    className={`w-full rounded-md border bg-white px-3 py-2 text-xs text-[#171717] placeholder:text-[#A3A3A3] focus:border-[#171717] focus:outline-none transition-colors ${
                      errors.last_name ? 'border-[#171717]' : 'border-[#E5E5E5]'
                    }`}
                  />
                  {errors.last_name && (
                    <p className="mt-1 text-[11px] text-[#171717]">
                      {errors.last_name}
                    </p>
                  )}
                </div>
              </div>

              {/* DOB & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="date_of_birth"
                    className="block text-xs font-medium text-[#171717] mb-1.5"
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
                    className="block text-xs font-medium text-[#171717] mb-1.5"
                  >
                    Enrollment Status <span className="text-[#171717] font-bold">*</span>
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

              {/* Contact Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-medium text-[#737373] mb-1.5"
                  >
                    Email Address (Optional)
                  </label>
                  <input
                    id="email"
                    type="email"
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
                    className="block text-xs font-medium text-[#737373] mb-1.5"
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
                  className="block text-xs font-medium text-[#171717] mb-1.5"
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

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-[#E5E5E5] pt-5">
                <Link
                  href="/students"
                  className="rounded-md border border-[#E5E5E5] bg-white px-4 py-2 text-xs font-medium text-[#171717] hover:bg-[#F7F7F7] transition-colors"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 rounded-md border border-[#171717] bg-[#171717] px-5 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Enrolling Student...</span>
                    </>
                  ) : (
                    <span>Enroll Student</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </AppShell>
  );
}
