'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  CalendarCheck,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Clock3,
  ExternalLink,
  Copy,
  Check,
  LogOut,
  RotateCw,
  Phone,
  Mail,
  Shield,
  Loader2,
  Info,
  Calendar,
  UploadCloud,
  X,
  BookOpen,
  GraduationCap,
  CalendarDays,
  Layers,
  MapPin,
} from 'lucide-react';
import { logoutAction } from '@/app/actions/auth';
import {
  getStudentDashboardDataAction,
  getStudentDocumentSignedUrlAction,
  type StudentDashboardData,
} from '@/app/actions/studentPortal';
import { submitStudentEnrollmentAction } from '@/app/actions/academic';
import { DAYS_OF_WEEK } from '@/src/types/academic';
import { DOCUMENT_CATEGORIES, type StudentDocument } from '@/src/types/document';
import StudentUploadModal from './components/StudentUploadModal';
import SessionTimeoutWarning from '@/app/components/SessionTimeoutWarning';

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  DOCUMENT_CATEGORIES.map((c) => [c.value, c.label])
);

export default function StudentDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeTab, setActiveTab] = useState<'academics' | 'timetable' | 'attendance' | 'documents' | 'profile'>('academics');
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Academic Onboarding State
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedSemester, setSelectedSemester] = useState(1);
  const [selectedElectives, setSelectedElectives] = useState<string[]>([]);
  const [isOnboardingSubmitting, setIsOnboardingSubmitting] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);
    try {
      const res = await getStudentDashboardDataAction();
      if (!res.success || !res.data) {
        setError(res.error || 'Failed to load student data.');
      } else {
        setData(res.data);
        if (res.data.academic?.availableCourses && res.data.academic.availableCourses.length > 0) {
          setSelectedCourseId((prev) => prev || res.data!.academic!.availableCourses![0].id);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading dashboard.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  async function handleSubmitOnboarding(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCourseId) return;

    setIsOnboardingSubmitting(true);
    setOnboardingError(null);

    try {
      const res = await submitStudentEnrollmentAction({
        course_id: selectedCourseId,
        semester: Number(selectedSemester),
        elective_subject_ids: selectedElectives,
      });

      if (!res.success) {
        setOnboardingError(res.error || 'Failed to submit enrollment choices.');
      } else {
        setSuccessBanner('Academic enrollment choices submitted for administrator review.');
        fetchData(true);
      }
    } catch (err: unknown) {
      setOnboardingError(err instanceof Error ? err.message : 'Error submitting enrollment.');
    } finally {
      setIsOnboardingSubmitting(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleCopyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback
    }
  }

  async function handleViewDocument(docId: string) {
    setViewingDocId(docId);
    try {
      const res = await getStudentDocumentSignedUrlAction(docId);
      if (res.success && res.signedUrl) {
        window.open(res.signedUrl, '_blank', 'noopener,noreferrer');
      } else {
        alert(res.error || 'Could not open document.');
      }
    } finally {
      setViewingDocId(null);
    }
  }

  function handleUploadSuccess(newDoc: StudentDocument) {
    setSuccessBanner(
      `Document "${newDoc.original_filename}" uploaded successfully and submitted for administrator review.`
    );
    fetchData(true);
    setTimeout(() => setSuccessBanner(null), 6000);
  }

  async function handleSignOut() {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('campusos_session_sync');
        channel.postMessage({ type: 'LOGOUT', timestamp: Date.now() });
        channel.close();
      }
      localStorage.setItem('campusos_tab_logout', String(Date.now()));
    } catch {
      // Fallback
    }
    await logoutAction('/student/login?error=logged_out');
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-[#171717]" />
          <p className="text-xs text-[#737373]">Loading personal dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-xl border border-[#E5E5E5] bg-white p-6 text-center shadow-sm">
          <AlertCircle size={28} className="mx-auto text-[#171717] mb-3" />
          <h2 className="text-base font-semibold text-[#171717]">Unable to Access Dashboard</h2>
          <p className="mt-1 text-xs text-[#737373]">{error || 'Student record could not be loaded.'}</p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => fetchData()}
              className="rounded-md border border-[#171717] bg-[#171717] px-4 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors"
            >
              Retry
            </button>
            <button
              onClick={handleSignOut}
              className="rounded-md border border-[#E5E5E5] bg-white px-4 py-2 text-xs font-medium text-[#171717] hover:bg-[#F7F7F7] transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { student, attendance, documents, guardians } = data;
  const fullName = [student.first_name, student.middle_name, student.last_name]
    .filter(Boolean)
    .join(' ');

  const verifiedDocsCount = documents.filter((d) => d.verification_status === 'verified').length;
  const pendingDocsCount = documents.filter((d) => d.verification_status === 'pending').length;
  const rejectedDocsCount = documents.filter((d) => d.verification_status === 'rejected').length;

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <SessionTimeoutWarning />
      {/* Top Header */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#E5E5E5] bg-white px-6">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold tracking-tight text-[#171717] select-none">
            Campus<span className="text-[#737373]">OS</span>
          </span>
          <span className="rounded border border-[#E5E5E5] bg-[#F7F7F7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#737373]">
            Student Portal
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData(true)}
            title="Refresh Data"
            disabled={isRefreshing}
            className="rounded-md border border-[#E5E5E5] bg-white p-2 text-[#737373] hover:text-[#171717] hover:border-[#171717] transition-colors disabled:opacity-50"
          >
            <RotateCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs font-medium text-[#737373] hover:text-[#171717] hover:border-[#171717] transition-colors"
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Welcome Banner */}
        <div className="mb-8 rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-medium text-[#737373] uppercase tracking-wider">
                  College ID
                </span>
                <span className="inline-flex items-center gap-1.5 rounded bg-[#171717] px-2.5 py-0.5 font-mono text-xs font-semibold text-white">
                  {student.student_code}
                  <button
                    onClick={() => handleCopyCode(student.student_code)}
                    className="opacity-70 hover:opacity-100 transition-opacity ml-1"
                    title="Copy College ID"
                  >
                    {copiedCode ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  </button>
                </span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-[#171717] sm:text-2xl">
                Welcome, {fullName}
              </h1>
              <p className="mt-1 text-xs text-[#737373]">
                Enrolled on{' '}
                <span className="font-medium text-[#171717]">{student.enrollment_date}</span> &bull;{' '}
                Status:{' '}
                <span className="inline-block capitalize font-medium text-[#171717]">
                  {student.status}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full border border-[#E5E5E5] bg-[#F7F7F7] px-3 py-1 text-xs font-medium text-[#171717]">
                Student Account Active
              </span>
            </div>
          </div>
        </div>

        {/* 4 Primary Metric Cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Attendance Rate */}
          <div className="rounded-xl border border-[#E5E5E5] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-[#737373]">
              <span className="text-xs font-medium uppercase tracking-wider">Attendance Rate</span>
              <CalendarCheck size={16} />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#171717]">
                {attendance.percentage !== null ? `${attendance.percentage}%` : 'N/A'}
              </span>
              <span className="text-[11px] text-[#737373]">of recorded sessions</span>
            </div>
            <div className="mt-2 text-[11px]">
              {attendance.percentage !== null ? (
                attendance.percentage >= 75 ? (
                  <span className="font-medium text-[#166534]">Good Standing (&ge;75%)</span>
                ) : (
                  <span className="font-medium text-[#991B1B]">Requirement Warning (&lt;75%)</span>
                )
              ) : (
                <span className="text-[#737373]">No attendance records yet</span>
              )}
            </div>
          </div>

          {/* Card 2: Present Sessions */}
          <div className="rounded-xl border border-[#E5E5E5] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-[#737373]">
              <span className="text-xs font-medium uppercase tracking-wider">Present Sessions</span>
              <CheckCircle2 size={16} />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#171717]">
                {attendance.presentCount}
              </span>
              <span className="text-[11px] text-[#737373]">
                / {attendance.totalSessions} total sessions
              </span>
            </div>
            <div className="mt-2 text-[11px] text-[#737373]">
              Recorded by course faculty
            </div>
          </div>

          {/* Card 3: Absent / Late */}
          <div className="rounded-xl border border-[#E5E5E5] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-[#737373]">
              <span className="text-xs font-medium uppercase tracking-wider">Absences & Lates</span>
              <Clock3 size={16} />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#171717]">
                {attendance.absentCount}
              </span>
              <span className="text-[11px] text-[#737373]">
                absent &bull; {attendance.lateCount} late
              </span>
            </div>
            <div className="mt-2 text-[11px] text-[#737373]">
              Excuses subject to faculty approval
            </div>
          </div>

          {/* Card 4: Documents Uploaded */}
          <div className="rounded-xl border border-[#E5E5E5] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-[#737373]">
              <span className="text-xs font-medium uppercase tracking-wider">Official Documents</span>
              <FileText size={16} />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#171717]">
                {documents.length}
              </span>
              <span className="text-[11px] text-[#737373]">
                {verifiedDocsCount} verified
              </span>
            </div>
            <div className="mt-2 text-[11px] text-[#737373]">
              {pendingDocsCount > 0 ? `${pendingDocsCount} under review` : 'All records processed'}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6 flex border-b border-[#E5E5E5] overflow-x-auto">
          <button
            onClick={() => setActiveTab('academics')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'academics'
                ? 'border-[#171717] text-[#171717]'
                : 'border-transparent text-[#737373] hover:text-[#171717]'
            }`}
          >
            <BookOpen size={14} />
            <span>Academic Profile & Curriculum</span>
          </button>
          <button
            onClick={() => setActiveTab('timetable')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'timetable'
                ? 'border-[#171717] text-[#171717]'
                : 'border-transparent text-[#737373] hover:text-[#171717]'
            }`}
          >
            <CalendarDays size={14} />
            <span>My Timetable</span>
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'attendance'
                ? 'border-[#171717] text-[#171717]'
                : 'border-transparent text-[#737373] hover:text-[#171717]'
            }`}
          >
            <CalendarCheck size={14} />
            <span>Attendance History ({attendance.totalSessions})</span>
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'documents'
                ? 'border-[#171717] text-[#171717]'
                : 'border-transparent text-[#737373] hover:text-[#171717]'
            }`}
          >
            <FileText size={14} />
            <span>My Documents ({documents.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'profile'
                ? 'border-[#171717] text-[#171717]'
                : 'border-transparent text-[#737373] hover:text-[#171717]'
            }`}
          >
            <User size={14} />
            <span>Personal Record</span>
          </button>
        </div>

        {/* Tab: Academic Profile & Curriculum */}
        {activeTab === 'academics' && (
          <div className="space-y-6">
            {data?.academic?.enrollment ? (
              <div className="rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E5E5E5] pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <GraduationCap size={18} className="text-[#171717]" />
                      <h3 className="text-base font-bold text-[#171717]">
                        {data.academic.enrollment.course?.code} - {data.academic.enrollment.course?.name}
                      </h3>
                    </div>
                    <p className="text-xs text-[#737373] mt-1">
                      Semester {data.academic.enrollment.semester} &bull; Section {data.academic.enrollment.section} &bull; Academic Term: {data.academic.enrollment.academic_term}
                    </p>
                  </div>
                  <div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                        data.academic.enrollment.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : data.academic.enrollment.status === 'pending'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {data.academic.enrollment.status === 'approved' && <CheckCircle2 size={13} />}
                      {data.academic.enrollment.status === 'pending' && <Clock size={13} />}
                      {data.academic.enrollment.status === 'rejected' && <AlertCircle size={13} />}
                      <span>Enrollment {data.academic.enrollment.status}</span>
                    </span>
                  </div>
                </div>

                {data.academic.enrollment.status === 'pending' && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
                    <Clock size={15} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold">Academic Enrollment Under Review</p>
                      <p className="text-[11px] mt-0.5 leading-relaxed">
                        Your program and subject selections have been submitted and are awaiting administrator verification and section assignment.
                      </p>
                    </div>
                  </div>
                )}

                {data.academic.enrollment.status === 'rejected' && (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                    <p className="font-semibold">Enrollment Selection Rejected</p>
                    <p className="text-[11px] mt-0.5">
                      Reason: {data.academic.enrollment.rejection_reason || 'Please adjust your subject choices or contact administration.'}
                    </p>
                  </div>
                )}

                {/* Enrolled Subjects List */}
                <div className="mt-6">
                  <h4 className="text-xs font-semibold text-[#171717] uppercase tracking-wider mb-3">
                    Coursework & Enrolled Subjects ({data.academic.selectedSubjects?.length || 0})
                  </h4>
                  <div className="rounded-lg border border-[#E5E5E5] overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-[#E5E5E5] bg-[#FAFAFA] text-[#737373] uppercase tracking-wider font-semibold">
                        <tr>
                          <th className="px-4 py-2.5">Code</th>
                          <th className="px-4 py-2.5">Subject Name</th>
                          <th className="px-4 py-2.5">Credits</th>
                          <th className="px-4 py-2.5">Classification</th>
                          <th className="px-4 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E5E5]">
                        {data.academic.selectedSubjects?.map((sub) => (
                          <tr key={sub.id} className="hover:bg-[#FAFAFA]">
                            <td className="px-4 py-3 font-mono font-medium text-[#171717]">
                              {sub.subject?.code}
                            </td>
                            <td className="px-4 py-3 text-[#171717]">
                              {sub.subject?.name}
                            </td>
                            <td className="px-4 py-3 text-[#525252]">
                              {sub.subject?.credits} Credits
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                  sub.is_mandatory
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'bg-purple-50 text-purple-700'
                                }`}
                              >
                                {sub.is_mandatory ? 'Mandatory' : 'Elective'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                  sub.status === 'approved'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-amber-50 text-amber-700'
                                }`}
                              >
                                {sub.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              /* Onboarding Form for Unenrolled Students */
              <div className="rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <GraduationCap size={20} className="text-[#171717]" />
                  <h3 className="text-base font-bold text-[#171717]">Academic Onboarding</h3>
                </div>
                <p className="text-xs text-[#737373] leading-relaxed mb-6">
                  Select your academic degree program, semester, and approved elective coursework to initialize your student academic records.
                </p>

                {onboardingError && (
                  <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{onboardingError}</span>
                  </div>
                )}

                <form onSubmit={handleSubmitOnboarding} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#171717] mb-1.5">
                      1. Select Degree Program *
                    </label>
                    <select
                      value={selectedCourseId}
                      onChange={(e) => setSelectedCourseId(e.target.value)}
                      required
                      className="w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    >
                      {data?.academic?.availableCourses?.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} - {c.name} ({c.duration_years} Years, {c.department})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#171717] mb-1.5">
                      2. Current Semester *
                    </label>
                    <select
                      value={selectedSemester}
                      onChange={(e) => setSelectedSemester(Number(e.target.value))}
                      className="w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    >
                      {Array.from({ length: 8 }, (_, i) => i + 1).map((s) => (
                        <option key={s} value={s}>
                          Semester {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Curriculum Preview */}
                  {selectedCourseId && (
                    <div className="rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-4 space-y-3">
                      <h4 className="text-xs font-semibold text-[#171717]">
                        Semester {selectedSemester} Curriculum Preview
                      </h4>
                      {(() => {
                        const chosenCourse = data?.academic?.availableCourses?.find((c) => c.id === selectedCourseId);
                        const currList = ((chosenCourse as any)?.course_subjects || []).filter((cs: any) => cs.semester === selectedSemester);
                        const mandatoryList = currList.filter((cs: any) => cs.is_mandatory);
                        const electiveList = currList.filter((cs: any) => !cs.is_mandatory);

                        return (
                          <div className="space-y-3">
                            <div>
                              <p className="text-[11px] font-medium text-[#525252] mb-1">
                                Mandatory Subjects (Automatically Included):
                              </p>
                              {mandatoryList.length === 0 ? (
                                <p className="text-[11px] text-[#A3A3A3] italic">No mandatory subjects defined for this semester.</p>
                              ) : (
                                <ul className="space-y-1">
                                  {mandatoryList.map((cs: any) => (
                                    <li key={cs.id} className="text-[11px] text-[#171717] flex items-center gap-1.5">
                                      <CheckCircle2 size={13} className="text-emerald-600" />
                                      <span className="font-mono">{cs.subject?.code}</span> - {cs.subject?.name} ({cs.subject?.credits} cr)
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>

                            {electiveList.length > 0 && (
                              <div>
                                <p className="text-[11px] font-medium text-[#525252] mb-1">
                                  Optional Electives (Select desired subjects):
                                </p>
                                <div className="space-y-1.5">
                                  {electiveList.map((cs: any) => (
                                    <label key={cs.id} className="flex items-center gap-2 text-[11px] text-[#171717] cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={selectedElectives.includes(cs.subject_id)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedElectives([...selectedElectives, cs.subject_id]);
                                          } else {
                                            setSelectedElectives(selectedElectives.filter((id) => id !== cs.subject_id));
                                          }
                                        }}
                                        className="rounded border-[#E5E5E5] text-[#111111] focus:ring-0"
                                      />
                                      <span className="font-mono">{cs.subject?.code}</span> - {cs.subject?.name} ({cs.subject?.credits} cr)
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <div className="pt-3 flex justify-end">
                    <button
                      type="submit"
                      disabled={isOnboardingSubmitting}
                      className="inline-flex items-center gap-1.5 rounded-md bg-[#111111] px-5 py-2 text-xs font-medium text-white hover:bg-[#262626] disabled:opacity-50"
                    >
                      {isOnboardingSubmitting && <Loader2 size={13} className="animate-spin" />}
                      <span>Submit Academic Choices for Approval</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Tab: Weekly Timetable */}
        {activeTab === 'timetable' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#E5E5E5] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[#171717]">My Weekly Class Timetable</h3>
                  <p className="text-[11px] text-[#737373] mt-0.5">
                    Synchronized schedule for your enrolled program and assigned section.
                  </p>
                </div>
                {data?.academic?.enrollment && (
                  <span className="rounded-md border border-[#E5E5E5] bg-[#F7F7F7] px-2.5 py-1 text-[11px] font-medium text-[#171717]">
                    Sec {data.academic.enrollment.section} &bull; Sem {data.academic.enrollment.semester}
                  </span>
                )}
              </div>
            </div>

            {DAYS_OF_WEEK.map((day) => {
              const daySlots = (data?.academic?.personalTimetable || []).filter(
                (s) => s.day_of_week === day.value
              );

              return (
                <div
                  key={day.value}
                  className="rounded-xl border border-[#E5E5E5] bg-white shadow-xs overflow-hidden"
                >
                  <div className="flex items-center justify-between border-b border-[#E5E5E5] bg-[#FAFAFA] px-5 py-2.5">
                    <span className="text-xs font-bold text-[#171717]">{day.label}</span>
                    <span className="text-[11px] text-[#737373]">
                      {daySlots.length} {daySlots.length === 1 ? 'class' : 'classes'}
                    </span>
                  </div>

                  <div className="p-4">
                    {daySlots.length === 0 ? (
                      <p className="text-center py-2 text-xs text-[#A3A3A3]">
                        No classes scheduled for {day.label}.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {daySlots.map((slot) => (
                          <div
                            key={slot.id}
                            className="rounded-lg border border-[#E5E5E5] bg-white p-3 text-xs hover:border-[#171717] transition-colors"
                          >
                            <span className="font-semibold text-[#171717]">
                              {slot.subject?.code} - {slot.subject?.name}
                            </span>
                            <div className="mt-2 space-y-1 text-[11px] text-[#525252]">
                              <div className="flex items-center gap-1.5">
                                <Clock size={12} className="text-[#A3A3A3]" />
                                <span className="font-mono">
                                  {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <GraduationCap size={12} className="text-[#A3A3A3]" />
                                <span>
                                  {slot.teacher ? `${slot.teacher.first_name} ${slot.teacher.last_name}` : 'Faculty Member'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <MapPin size={12} className="text-[#A3A3A3]" />
                                <span>{slot.room}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 1: Attendance History */}
        {activeTab === 'attendance' && (
          <div className="rounded-xl border border-[#E5E5E5] bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#171717]">Attendance Log</h3>
                <p className="text-[11px] text-[#737373] mt-0.5">
                  Daily recorded class and lecture attendance sessions.
                </p>
              </div>
              <span className="text-[11px] text-[#737373]">
                Showing {attendance.recentRecords.length} recorded session{attendance.recentRecords.length === 1 ? '' : 's'}
              </span>
            </div>

            {attendance.recentRecords.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#737373]">
                No attendance sessions have been recorded for your account yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E5E5E5] bg-[#FAFAFA] text-[#737373]">
                    <tr>
                      <th className="px-6 py-3 font-medium">Date</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5E5]">
                    {attendance.recentRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-[#F7F7F7] transition-colors">
                        <td className="px-6 py-3.5 font-medium text-[#171717]">
                          {rec.attendance_date}
                        </td>
                        <td className="px-6 py-3.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                              rec.status === 'present'
                                ? 'bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]'
                                : rec.status === 'absent'
                                ? 'bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]'
                                : 'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]'
                            }`}
                          >
                            {rec.status}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-[#737373]">
                          {rec.remarks || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: My Documents */}
        {activeTab === 'documents' && (
          <div className="space-y-4">
            {/* Success notification banner */}
            {successBanner && (
              <div
                role="status"
                className="flex items-start gap-2.5 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] p-3.5 text-xs text-[#166534] shadow-sm animate-in fade-in"
              >
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#166534]" />
                <span className="flex-1 leading-relaxed">{successBanner}</span>
                <button
                  onClick={() => setSuccessBanner(null)}
                  className="text-[#166534] hover:opacity-75 transition-opacity"
                  aria-label="Dismiss banner"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Informational banner about document management */}
            <div className="flex items-start gap-2.5 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-3 text-xs text-[#737373]">
              <Info size={15} className="mt-0.5 shrink-0 text-[#171717]" />
              <div className="leading-relaxed">
                Upload your official documents (identity cards, academic marksheets, enrollment letters) for administrative review.
                Supported file formats: PDF, JPEG, PNG, and WebP (up to 10 MB).
              </div>
            </div>

            <div className="rounded-xl border border-[#E5E5E5] bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-[#E5E5E5] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#171717]">Submitted Documents</h3>
                  <p className="text-[11px] text-[#737373] mt-0.5">
                    Official certificates and verification documents on file with CampusOS.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="hidden sm:inline text-[11px] text-[#737373]">
                    {verifiedDocsCount} verified &bull; {pendingDocsCount} pending &bull; {rejectedDocsCount} rejected
                  </span>
                  <button
                    onClick={() => setIsUploadModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-md bg-[#111111] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#262626] transition-colors shadow-sm"
                  >
                    <UploadCloud size={14} />
                    <span>Upload Document</span>
                  </button>
                </div>
              </div>

              {documents.length === 0 ? (
                <div className="p-12 text-center text-xs text-[#737373]">
                  <FileText size={28} className="mx-auto text-[#A3A3A3] mb-2" />
                  <p className="font-semibold text-[#171717]">No documents uploaded yet</p>
                  <p className="mt-1 text-[11px] text-[#737373] max-w-sm mx-auto">
                    You have not uploaded any verification documents yet. Upload your identification, transcripts, or enrollment documents to initiate review.
                  </p>
                  <button
                    onClick={() => setIsUploadModalOpen(true)}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[#111111] px-4 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors"
                  >
                    <UploadCloud size={14} />
                    <span>Upload First Document</span>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-[#E5E5E5]">
                  {documents.map((doc) => {
                    const categoryTitle =
                      CATEGORY_LABELS[doc.document_type] ||
                      doc.document_type.replace(/_/g, ' ');

                    return (
                      <div
                        key={doc.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-5 gap-3 hover:bg-[#F7F7F7] transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="rounded-lg border border-[#E5E5E5] bg-white p-2.5 text-[#171717]">
                            <FileText size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-[#171717]">
                              {doc.original_filename}
                            </p>
                            <p className="text-[11px] text-[#737373] mt-0.5">
                              Category: <span className="font-medium text-[#171717] capitalize">{categoryTitle}</span> &bull; Submitted on{' '}
                              {new Date(doc.created_at).toLocaleDateString()}
                            </p>
                            {doc.verification_status === 'verified' && doc.verified_at && (
                              <p className="text-[11px] text-[#166534] mt-1">
                                Verified by administration on {new Date(doc.verified_at).toLocaleDateString()}
                              </p>
                            )}
                            {doc.rejection_reason && (
                              <div className="mt-1.5 rounded border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1 text-[11px] text-[#991B1B]">
                                <span className="font-semibold">Verification note:</span> {doc.rejection_reason}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-auto">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                              doc.verification_status === 'verified'
                                ? 'bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]'
                                : doc.verification_status === 'rejected'
                                ? 'bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]'
                                : 'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]'
                            }`}
                          >
                            {doc.verification_status}
                          </span>

                          <button
                            onClick={() => handleViewDocument(doc.id)}
                            disabled={viewingDocId === doc.id}
                            className="flex items-center gap-1.5 rounded border border-[#E5E5E5] bg-white px-2.5 py-1 text-xs font-medium text-[#171717] hover:border-[#171717] transition-colors disabled:opacity-50"
                          >
                            {viewingDocId === doc.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <ExternalLink size={12} />
                            )}
                            <span>View</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Personal Profile Record */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-[#171717] mb-4">
                Student Profile Information
              </h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <dt className="text-[#737373]">Full Name</dt>
                  <dd className="font-semibold text-[#171717] mt-0.5">{fullName}</dd>
                </div>
                <div>
                  <dt className="text-[#737373]">College ID</dt>
                  <dd className="font-semibold text-[#171717] mt-0.5">{student.student_code}</dd>
                </div>
                <div>
                  <dt className="text-[#737373]">Date of Birth</dt>
                  <dd className="font-semibold text-[#171717] mt-0.5">{student.date_of_birth}</dd>
                </div>
                <div>
                  <dt className="text-[#737373]">Email Address</dt>
                  <dd className="font-semibold text-[#171717] mt-0.5">{student.email || '—'}</dd>
                </div>
                <div>
                  <dt className="text-[#737373]">Phone Number</dt>
                  <dd className="font-semibold text-[#171717] mt-0.5">{student.phone || '—'}</dd>
                </div>
                <div>
                  <dt className="text-[#737373]">Enrollment Date</dt>
                  <dd className="font-semibold text-[#171717] mt-0.5">{student.enrollment_date}</dd>
                </div>
                <div>
                  <dt className="text-[#737373]">Academic Status</dt>
                  <dd className="font-semibold text-[#171717] mt-0.5 capitalize">{student.status}</dd>
                </div>
              </dl>
            </div>

            {/* Guardians Section */}
            <div className="rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-[#171717] mb-4">
                Guardian / Emergency Contacts
              </h3>
              {guardians.length === 0 ? (
                <p className="text-xs text-[#737373]">No guardian details linked to this record.</p>
              ) : (
                <div className="divide-y divide-[#E5E5E5]">
                  {guardians.map((g, idx) => (
                    <div key={idx} className="py-3 text-xs flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-[#171717]">
                          {g.guardians?.full_name}{' '}
                          {g.is_primary && (
                            <span className="ml-1 text-[10px] bg-[#171717] text-white px-1.5 py-0.2 rounded font-normal">
                              Primary
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-[#737373] mt-0.5">
                          {g.guardians?.relationship || 'Guardian'} &bull; {g.guardians?.phone || 'No phone'} &bull; {g.guardians?.email || 'No email'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Student Document Upload Modal */}
      <StudentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
}
