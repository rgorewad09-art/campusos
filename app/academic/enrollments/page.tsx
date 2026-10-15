'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  UserCheck,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  BookOpen,
  Filter,
  X,
  Loader2,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import AppShell from '@/app/components/AppShell';
import {
  getEnrollmentsAction,
  reviewEnrollmentAction,
} from '@/app/actions/academic';
import type { StudentAcademicEnrollment } from '@/src/types/academic';

export default function EnrollmentsReviewPage() {
  const [enrollments, setEnrollments] = useState<StudentAcademicEnrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Review Modal
  const [selectedEnrollment, setSelectedEnrollment] = useState<StudentAcademicEnrollment | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'rejected'>('approved');
  const [reviewSection, setReviewSection] = useState('A');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchEnrollments = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await getEnrollmentsAction();
      if (res.success && res.enrollments) {
        setEnrollments(res.enrollments);
      } else {
        setErrorMessage(res.error || 'Failed to load student enrollments.');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error fetching enrollments.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  async function handleReviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEnrollment) return;

    setIsSubmitting(true);
    try {
      const res = await reviewEnrollmentAction({
        enrollment_id: selectedEnrollment.id,
        status: reviewStatus,
        section: reviewStatus === 'approved' ? reviewSection : undefined,
        rejection_reason: reviewStatus === 'rejected' ? rejectionReason : undefined,
      });

      if (!res.success) {
        alert(res.error || 'Failed to review enrollment.');
      } else {
        setSelectedEnrollment(null);
        setSuccessBanner(`Enrollment marked as ${reviewStatus}.`);
        fetchEnrollments();
      }
    } catch (err) {
      alert('Error saving enrollment decision.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const filtered = enrollments.filter((e) => {
    const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
    const stu = e.student;
    const matchesSearch =
      !searchQuery ||
      stu?.student_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stu?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stu?.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.course?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <AppShell pageTitle="Academic Enrollments Review">
      <div className="space-y-6">
        {successBanner && (
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span>{successBanner}</span>
            </div>
            <button
              onClick={() => setSuccessBanner(null)}
              className="text-emerald-600 hover:text-emerald-900"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
            <AlertCircle size={16} className="text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737373]"
            />
            <input
              type="text"
              placeholder="Search by student name, College ID (STU-...), or program..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-[#E5E5E5] bg-white py-2 pl-9 pr-4 text-xs text-[#171717] placeholder:text-[#A3A3A3] focus:border-[#171717] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#737373]">Status:</span>
            <div className="flex items-center gap-1 rounded-md border border-[#E5E5E5] bg-white p-1">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                    statusFilter === s
                      ? 'bg-[#111111] text-white'
                      : 'text-[#737373] hover:text-[#171717]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-[#E5E5E5] bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E5E5E5] bg-[#FAFAFA] text-[#737373] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-3">Student</th>
                  <th className="px-6 py-3">Academic Program</th>
                  <th className="px-6 py-3">Semester & Section</th>
                  <th className="px-6 py-3">Subjects Chosen</th>
                  <th className="px-6 py-3">Term</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-[#737373]">
                      <Loader2 size={18} className="animate-spin inline mr-2 text-[#171717]" />
                      Loading enrollments...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-[#737373]">
                      <UserCheck size={32} className="mx-auto mb-2 text-[#A3A3A3]" />
                      <p className="font-medium text-[#171717]">No student enrollments found</p>
                      <p className="text-[11px] mt-1">Student academic program selections and elective submissions will appear here.</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((enr) => (
                    <tr key={enr.id} className="hover:bg-[#FAFAFA] transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="font-medium text-[#171717]">
                          {enr.student?.first_name} {enr.student?.last_name}
                        </div>
                        <div className="font-mono text-[11px] text-[#737373]">
                          {enr.student?.student_code}
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-[#171717]">
                        <span className="font-medium">{enr.course?.code}</span> - {enr.course?.name}
                      </td>
                      <td className="px-6 py-3.5 text-[#525252]">
                        Sem {enr.semester} • Section {enr.section}
                      </td>
                      <td className="px-6 py-3.5 text-[#525252]">
                        {enr.selected_subjects?.length || 0} subjects mapped
                      </td>
                      <td className="px-6 py-3.5 text-[#737373]">
                        {enr.academic_term}
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                            enr.status === 'approved'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : enr.status === 'pending'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {enr.status === 'approved' && <CheckCircle2 size={10} />}
                          {enr.status === 'pending' && <Clock size={10} />}
                          {enr.status === 'rejected' && <XCircle size={10} />}
                          <span>{enr.status}</span>
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={() => {
                            setSelectedEnrollment(enr);
                            setReviewStatus(enr.status === 'rejected' ? 'rejected' : 'approved');
                            setReviewSection(enr.section || 'A');
                            setRejectionReason(enr.rejection_reason || '');
                          }}
                          className="inline-flex items-center gap-1 rounded border border-[#E5E5E5] bg-white px-2.5 py-1 text-[11px] font-medium text-[#171717] hover:border-[#171717] transition-colors"
                        >
                          <span>Review</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Review Student Enrollment */}
        {selectedEnrollment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-[#E5E5E5]">
                <div className="flex items-center gap-2">
                  <UserCheck size={18} className="text-[#171717]" />
                  <div>
                    <h2 className="text-sm font-semibold text-[#171717]">
                      Review Academic Enrollment
                    </h2>
                    <p className="text-[11px] text-[#737373]">
                      {selectedEnrollment.student?.first_name} {selectedEnrollment.student?.last_name} ({selectedEnrollment.student?.student_code})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEnrollment(null)}
                  className="text-[#737373] hover:text-[#171717]"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 space-y-4 text-xs">
                {/* Academic Summary */}
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-3 text-[11px]">
                  <div>
                    <span className="text-[#737373]">Degree Program:</span>
                    <p className="font-semibold text-[#171717] mt-0.5">
                      {selectedEnrollment.course?.code} - {selectedEnrollment.course?.name}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#737373]">Term & Semester:</span>
                    <p className="font-semibold text-[#171717] mt-0.5">
                      Sem {selectedEnrollment.semester} ({selectedEnrollment.academic_term})
                    </p>
                  </div>
                </div>

                {/* Selected Subjects Breakdown */}
                <div>
                  <h4 className="text-[11px] font-semibold text-[#171717] mb-2">
                    Enrolled Subjects ({selectedEnrollment.selected_subjects?.length || 0})
                  </h4>
                  <div className="max-h-40 overflow-y-auto rounded-md border border-[#E5E5E5] divide-y divide-[#F0F0F0]">
                    {selectedEnrollment.selected_subjects?.map((sub) => (
                      <div key={sub.id} className="flex items-center justify-between p-2">
                        <div>
                          <span className="font-mono font-medium text-[#171717] mr-2">
                            {sub.subject?.code}
                          </span>
                          <span className="text-[#525252]">{sub.subject?.name}</span>
                        </div>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                            sub.is_mandatory
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-purple-50 text-purple-700'
                          }`}
                        >
                          {sub.is_mandatory ? 'Mandatory' : 'Elective'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Review Form */}
                <form onSubmit={handleReviewSubmit} className="space-y-3 pt-2 border-t border-[#E5E5E5]">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-[#171717] mb-1">
                        Enrollment Decision *
                      </label>
                      <select
                        value={reviewStatus}
                        onChange={(e) => setReviewStatus(e.target.value as 'approved' | 'rejected')}
                        className="w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                      >
                        <option value="approved">Approve Enrollment</option>
                        <option value="rejected">Reject Enrollment</option>
                      </select>
                    </div>

                    {reviewStatus === 'approved' && (
                      <div>
                        <label className="block text-[11px] font-medium text-[#171717] mb-1">
                          Assign Section *
                        </label>
                        <input
                          type="text"
                          required
                          value={reviewSection}
                          onChange={(e) => setReviewSection(e.target.value.toUpperCase())}
                          className="w-full rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {reviewStatus === 'rejected' && (
                    <div>
                      <label className="block text-[11px] font-medium text-[#171717] mb-1">
                        Rejection Reason
                      </label>
                      <textarea
                        rows={2}
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="State reason for rejecting selection..."
                        className="w-full rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E5E5]">
                    <button
                      type="button"
                      onClick={() => setSelectedEnrollment(null)}
                      className="rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs font-medium text-[#525252] hover:bg-[#F7F7F7]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1.5 rounded-md bg-[#111111] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#262626] disabled:opacity-50"
                    >
                      {isSubmitting && <Loader2 size={13} className="animate-spin" />}
                      <span>Save Review Decision</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
