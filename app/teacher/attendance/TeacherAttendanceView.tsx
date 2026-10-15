'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  CalendarCheck,
  Clock,
  Users,
  BookOpen,
  ArrowLeft,
  Copy,
  Check,
  RotateCw,
  LogOut,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  Lock,
  StopCircle,
  Edit3,
} from 'lucide-react';
import { logoutAction } from '@/app/actions/auth';
import {
  getTeacherAttendanceContextAction,
  getTeacherSessionRosterAction,
  createAttendanceSessionAction,
  closeAttendanceSessionAction,
  overrideStudentAttendanceAction,
} from '@/app/actions/teacherAttendance';
import type { Teacher } from '@/src/types/teacher';
import type { TeacherSubjectAssignment, TimetableEntry } from '@/src/types/academic';
import type {
  AttendanceSession,
  AttendanceRosterStudent,
  AttendanceStatus,
} from '@/src/types/attendance';
import SessionTimeoutWarning from '@/app/components/SessionTimeoutWarning';

export default function TeacherAttendanceView() {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [assignments, setAssignments] = useState<TeacherSubjectAssignment[]>([]);
  const [timetables, setTimetables] = useState<TimetableEntry[]>([]);
  const [activeSessions, setActiveSessions] = useState<AttendanceSession[]>([]);

  // Selection State
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
  const [selectedTimetableId, setSelectedTimetableId] = useState<string>('');

  // Active Session State
  const [currentSession, setCurrentSession] = useState<AttendanceSession | null>(null);
  const [otpCode, setOtpCode] = useState<string | null>(null);
  const [copiedOtp, setCopiedOtp] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState<number>(10);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isMounted, setIsMounted] = useState(false);

  // Roster State
  const [roster, setRoster] = useState<AttendanceRosterStudent[]>([]);
  const [presentCount, setPresentCount] = useState<number>(0);
  const [totalEnrolled, setTotalEnrolled] = useState<number>(0);

  // Loading & Feedback
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isClosingSession, setIsClosingSession] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Override Modal
  const [overrideTarget, setOverrideTarget] = useState<AttendanceRosterStudent | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<AttendanceStatus>('present');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Load Initial Context
  const loadContext = useCallback(async () => {
    setIsLoadingContext(true);
    setErrorMessage(null);
    try {
      const res = await getTeacherAttendanceContextAction();
      if (!res.success || !res.data) {
        setErrorMessage(res.error || 'Failed to initialize attendance portal.');
      } else {
        setTeacher(res.data.teacher);
        setAssignments(res.data.assignments);
        setTimetables(res.data.timetables);
        setActiveSessions(res.data.activeSessions);

        if (res.data.assignments.length > 0) {
          setSelectedAssignmentId((prev) => prev || res.data!.assignments[0].id);
        }
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error initializing attendance.');
    } finally {
      setIsLoadingContext(false);
    }
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  // Selected assignment helper
  const activeAssignment = assignments.find((a) => a.id === selectedAssignmentId) || assignments[0] || null;

  // 2. Load Roster for Selected Assignment & Session
  const loadRoster = useCallback(
    async (sessionId?: string) => {
      if (!activeAssignment) return;
      setIsLoadingRoster(true);
      try {
        const res = await getTeacherSessionRosterAction({
          courseId: activeAssignment.course_id,
          subjectId: activeAssignment.subject_id,
          section: activeAssignment.section,
          semester: activeAssignment.semester,
          sessionId: sessionId || currentSession?.id,
        });

        if (res.success && res.roster) {
          setRoster(res.roster);
          setPresentCount(res.presentCount || 0);
          setTotalEnrolled(res.totalEnrolled || 0);
          if (res.session) {
            setCurrentSession(res.session);
            if (res.session.otp_code) {
              setOtpCode(res.session.otp_code);
            }
          }
        } else if (res.error) {
          setErrorMessage(res.error);
        }
      } catch (err: unknown) {
        console.error('Error fetching roster:', err);
      } finally {
        setIsLoadingRoster(false);
      }
    },
    [activeAssignment, currentSession?.id]
  );

  // Trigger roster load when assignment changes or active sessions change
  useEffect(() => {
    if (activeAssignment) {
      // Find if an active session already exists for this assignment
      const existingSession = activeSessions.find(
        (s) =>
          s.subject_id === activeAssignment.subject_id &&
          s.course_id === activeAssignment.course_id &&
          s.section === activeAssignment.section &&
          s.status === 'active'
      );

      if (existingSession) {
        setCurrentSession(existingSession);
        setOtpCode(existingSession.otp_code || null);
        loadRoster(existingSession.id);
      } else {
        setCurrentSession(null);
        setOtpCode(null);
        loadRoster();
      }
    }
  }, [activeAssignment?.id, activeSessions]);

  // 3. Countdown Timer Engine
  useEffect(() => {
    if (!isMounted) return;

    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }

    if (currentSession && currentSession.status === 'active') {
      const updateTimer = () => {
        const remaining = Math.max(
          0,
          Math.floor((new Date(currentSession.expires_at).getTime() - Date.now()) / 1000)
        );
        setRemainingSeconds(remaining);

        if (remaining <= 0) {
          setCurrentSession((prev) => (prev ? { ...prev, status: 'expired' } : null));
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        }
      };

      updateTimer();
      countdownTimerRef.current = setInterval(updateTimer, 1000);
    } else {
      setRemainingSeconds(0);
    }

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [isMounted, currentSession?.expires_at, currentSession?.status]);

  // 4. Create Session & Generate OTP
  async function handleGenerateOtp() {
    if (!activeAssignment) return;
    setIsCreatingSession(true);
    setErrorMessage(null);
    setSuccessBanner(null);

    try {
      const res = await createAttendanceSessionAction({
        courseId: activeAssignment.course_id,
        subjectId: activeAssignment.subject_id,
        section: activeAssignment.section,
        semester: activeAssignment.semester,
        timetableId: selectedTimetableId || undefined,
        durationMinutes,
      });

      if (!res.success || !res.session) {
        setErrorMessage(res.error || 'Failed to initiate attendance session.');
      } else {
        setCurrentSession(res.session);
        setOtpCode(res.otpCode || null);
        setSuccessBanner(`Attendance session created! Verification code: ${res.otpCode}`);
        loadRoster(res.session.id);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error creating session.');
    } finally {
      setIsCreatingSession(false);
    }
  }

  // 5. Close Session Early
  async function handleCloseSession() {
    if (!currentSession) return;
    setIsClosingSession(true);
    try {
      const res = await closeAttendanceSessionAction(currentSession.id);
      if (res.success) {
        setCurrentSession({ ...currentSession, status: 'closed' });
        setSuccessBanner('Attendance session closed. The OTP code has been invalidated.');
        loadRoster(currentSession.id);
      } else {
        setErrorMessage(res.error || 'Failed to close session.');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error closing session.');
    } finally {
      setIsClosingSession(false);
    }
  }

  // 6. Submit Manual Override
  async function handleConfirmOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!overrideTarget || !activeAssignment) return;

    if (!overrideReason.trim() || overrideReason.trim().length < 3) {
      setOverrideError('Please provide a specific override reason (min. 3 characters).');
      return;
    }

    setIsSubmittingOverride(true);
    setOverrideError(null);

    try {
      const res = await overrideStudentAttendanceAction({
        studentId: overrideTarget.student.id,
        status: overrideStatus,
        reason: overrideReason.trim(),
        sessionId: currentSession?.id,
        courseId: activeAssignment.course_id,
        subjectId: activeAssignment.subject_id,
        section: activeAssignment.section,
        semester: activeAssignment.semester,
      });

      if (!res.success) {
        setOverrideError(res.error || 'Failed to record manual override.');
      } else {
        setSuccessBanner(
          `Attendance for ${overrideTarget.student.first_name} ${overrideTarget.student.last_name} updated to ${overrideStatus}.`
        );
        setOverrideTarget(null);
        loadRoster(currentSession?.id);
      }
    } catch (err: unknown) {
      setOverrideError(err instanceof Error ? err.message : 'Error saving override.');
    } finally {
      setIsSubmittingOverride(false);
    }
  }

  function handleCopyOtp() {
    if (!otpCode) return;
    navigator.clipboard.writeText(otpCode);
    setCopiedOtp(true);
    setTimeout(() => setCopiedOtp(false), 2000);
  }

  async function handleSignOut() {
    await logoutAction('/teacher/login?error=logged_out');
  }

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-16 font-sans">
      <SessionTimeoutWarning />

      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-[#E5E5E5] bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/teacher/dashboard"
              className="flex items-center gap-1.5 text-xs text-[#737373] hover:text-[#171717] transition-colors"
            >
              <ArrowLeft size={14} />
              <span>Faculty Dashboard</span>
            </Link>
            <span className="text-[#E5E5E5]">|</span>
            <div className="flex items-center gap-2">
              <CalendarCheck size={16} className="text-[#171717]" />
              <h1 className="text-sm font-semibold text-[#171717]">Class Attendance</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {teacher && (
              <span className="hidden sm:inline text-xs text-[#737373]">
                Prof. {teacher.first_name} {teacher.last_name} &bull;{' '}
                <span className="font-mono text-[11px] text-[#171717]">{teacher.teacher_code}</span>
              </span>
            )}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-md border border-[#E5E5E5] px-2.5 py-1 text-xs text-[#737373] hover:text-[#171717] hover:border-[#171717] transition-colors"
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 space-y-6">
        {/* Banner Messages */}
        {errorMessage && (
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-red-600 hover:text-red-900">
              <X size={14} />
            </button>
          </div>
        )}

        {successBanner && (
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
              <span>{successBanner}</span>
            </div>
            <button onClick={() => setSuccessBanner(null)} className="text-emerald-600 hover:text-emerald-900">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Section 1: Subject & Class Selector */}
        <div className="rounded-xl border border-[#E5E5E5] bg-white p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-[#171717]">Select Course & Subject</h2>
              <p className="text-xs text-[#737373] mt-0.5">
                Choose from your authorized faculty subject allocations for this semester.
              </p>
            </div>

            {assignments.length > 0 ? (
              <div className="flex items-center gap-3">
                <select
                  value={selectedAssignmentId}
                  onChange={(e) => setSelectedAssignmentId(e.target.value)}
                  className="rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                >
                  {assignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.course?.code} &bull; {a.subject?.code} - {a.subject?.name} (Sem {a.semester}, Sec {a.section})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => loadRoster()}
                  disabled={isLoadingRoster}
                  title="Refresh roster and submission counts"
                  className="flex items-center gap-1 rounded-md border border-[#E5E5E5] px-2.5 py-1.5 text-xs text-[#737373] hover:text-[#171717] hover:border-[#171717] transition-colors"
                >
                  <RotateCw size={13} className={isLoadingRoster ? 'animate-spin' : ''} />
                  <span>Refresh</span>
                </button>
              </div>
            ) : (
              <span className="text-xs text-[#737373]">No subjects currently assigned to your account.</span>
            )}
          </div>
        </div>

        {/* Section 2: Live Attendance Session Card / OTP Generator */}
        {activeAssignment && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* OTP Status & Control Card */}
            <div className="lg:col-span-1 rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#737373]">
                    OTP Verification
                  </span>
                  {currentSession?.status === 'active' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live Session
                    </span>
                  ) : (
                    <span className="rounded-full bg-neutral-100 border border-neutral-200 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                      Idle
                    </span>
                  )}
                </div>

                {currentSession?.status === 'active' && otpCode ? (
                  <div className="mt-6 text-center">
                    <p className="text-xs text-[#737373]">Provide this 6-digit code to students in class:</p>
                    <div className="mt-3 flex items-center justify-center gap-2">
                      <div className="rounded-lg border border-[#171717] bg-[#F7F7F7] px-6 py-3 font-mono text-3xl font-extrabold tracking-widest text-[#171717] select-all shadow-inner">
                        {otpCode}
                      </div>
                      <button
                        onClick={handleCopyOtp}
                        title="Copy OTP to clipboard"
                        className="rounded-md border border-[#E5E5E5] p-3 text-[#737373] hover:text-[#171717] hover:border-[#171717] transition-colors"
                      >
                        {copiedOtp ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} />}
                      </button>
                    </div>

                    <div className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-[#737373]">
                      <Clock size={14} className="text-amber-600" />
                      <span>Expires in:</span>
                      <span className="font-mono text-sm font-bold text-[#171717]">
                        {isMounted ? formatTimer(remainingSeconds) : '--:--'}
                      </span>
                    </div>

                    <div className="mt-6 pt-4 border-t border-[#F0F0F0]">
                      <button
                        onClick={handleCloseSession}
                        disabled={isClosingSession}
                        className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        {isClosingSession ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <StopCircle size={13} />
                        )}
                        <span>End Session & Invalidate OTP</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-[#171717]">Start Attendance Window</h3>
                    <p className="text-xs text-[#737373] mt-1 leading-relaxed">
                      Generate a short-lived cryptographic OTP for students attending this lecture.
                    </p>

                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="block text-[11px] font-medium text-[#171717] mb-1">
                          OTP Duration Window
                        </label>
                        <select
                          value={durationMinutes}
                          onChange={(e) => setDurationMinutes(Number(e.target.value))}
                          className="w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                        >
                          <option value={5}>5 Minutes (Quick Check-in)</option>
                          <option value={10}>10 Minutes (Standard Class)</option>
                          <option value={15}>15 Minutes (Extended Lecture)</option>
                        </select>
                      </div>

                      <button
                        onClick={handleGenerateOtp}
                        disabled={isCreatingSession}
                        className="w-full flex items-center justify-center gap-2 rounded-md bg-[#111111] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#262626] transition-colors disabled:opacity-50"
                      >
                        {isCreatingSession ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>Generating Secure OTP...</span>
                          </>
                        ) : (
                          <>
                            <CalendarCheck size={14} />
                            <span>Generate Attendance OTP</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-[#F0F0F0] text-[11px] text-[#A3A3A3]">
                <span>OTPs expire automatically. Duplicate student submissions are blocked by server constraints.</span>
              </div>
            </div>

            {/* Attendance Progress & Summary */}
            <div className="lg:col-span-2 rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-[#F0F0F0]">
                  <div>
                    <h3 className="text-sm font-semibold text-[#171717]">Class Submission Progress</h3>
                    <p className="text-xs text-[#737373] mt-0.5">
                      {activeAssignment.subject?.name} &bull; Section {activeAssignment.section}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-extrabold text-[#171717]">
                      {presentCount} / {totalEnrolled}
                    </span>
                    <p className="text-[11px] text-[#737373]">Students Verified Present</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-[#737373] mb-1">
                    <span>Attendance Rate</span>
                    <span className="font-semibold text-[#171717]">
                      {totalEnrolled > 0 ? Math.round((presentCount / totalEnrolled) * 100) : 0}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-[#F0F0F0] overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                      style={{
                        width: `${totalEnrolled > 0 ? (presentCount / totalEnrolled) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Quick Info Grid */}
                <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-3">
                    <span className="text-xs text-[#737373]">Present (OTP + Manual)</span>
                    <p className="text-lg font-bold text-emerald-700 mt-1">{presentCount}</p>
                  </div>
                  <div className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-3">
                    <span className="text-xs text-[#737373]">Unmarked / Pending</span>
                    <p className="text-lg font-bold text-[#737373] mt-1">{totalEnrolled - presentCount}</p>
                  </div>
                  <div className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-3">
                    <span className="text-xs text-[#737373]">Total Enrolled</span>
                    <p className="text-lg font-bold text-[#171717] mt-1">{totalEnrolled}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between text-xs text-[#737373] pt-4 border-t border-[#F0F0F0]">
                <span>Need to adjust an individual student? Use the Manual Override button in the roster below.</span>
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Enrolled Student Roster Table */}
        <div className="rounded-xl border border-[#E5E5E5] bg-white shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#171717]">Class Roster & Attendance Status</h3>
              <p className="text-xs text-[#737373] mt-0.5">
                Students officially enrolled in {activeAssignment?.course?.code} (Section {activeAssignment?.section})
              </p>
            </div>
            <span className="text-xs text-[#737373]">
              {roster.length} student{roster.length === 1 ? '' : 's'} enrolled
            </span>
          </div>

          {isLoadingRoster ? (
            <div className="p-12 text-center text-xs text-[#737373] flex flex-col items-center gap-2">
              <Loader2 size={18} className="animate-spin text-[#171717]" />
              <span>Loading student roster and verification records...</span>
            </div>
          ) : roster.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#737373]">
              No students are currently enrolled in this subject, semester, and section.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA] text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                    <th className="px-6 py-3">College ID</th>
                    <th className="px-6 py-3">Student Name</th>
                    <th className="px-6 py-3">Attendance Status</th>
                    <th className="px-6 py-3">Verification Method</th>
                    <th className="px-6 py-3">Remarks / Reason</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F0F0]">
                  {roster.map((item) => (
                    <tr key={item.student.id} className="hover:bg-[#FAFAFA] transition-colors">
                      <td className="px-6 py-3.5 font-mono text-[11px] text-[#171717]">
                        {item.student.student_code}
                      </td>
                      <td className="px-6 py-3.5 font-medium text-[#171717]">
                        {item.student.first_name} {item.student.last_name}
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                            item.status === 'present'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : item.status === 'late'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : item.status === 'absent'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                          }`}
                        >
                          {item.status === 'present' && <Check size={11} />}
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-[#525252]">
                        {item.attendance?.verification_method === 'otp' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                            <Lock size={11} />
                            <span>OTP Verified</span>
                          </span>
                        ) : item.attendance?.verification_method === 'override' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-medium">
                            <Edit3 size={11} />
                            <span>Manual Override</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#A3A3A3]">&mdash;</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-[#737373] text-[11px] max-w-xs truncate">
                        {item.attendance?.override_reason || item.attendance?.remarks || '&mdash;'}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={() => {
                            setOverrideTarget(item);
                            setOverrideStatus(item.status === 'unmarked' ? 'present' : (item.status as AttendanceStatus));
                            setOverrideReason('');
                            setOverrideError(null);
                          }}
                          className="inline-flex items-center gap-1 rounded border border-[#E5E5E5] bg-white px-2.5 py-1 text-[11px] font-medium text-[#171717] hover:border-[#171717] transition-colors"
                        >
                          <Edit3 size={11} />
                          <span>Override</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Manual Override Modal */}
      {overrideTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#E5E5E5]">
              <div className="flex items-center gap-2">
                <Edit3 size={18} className="text-[#171717]" />
                <h3 className="text-sm font-semibold text-[#171717]">Manual Attendance Override</h3>
              </div>
              <button
                onClick={() => setOverrideTarget(null)}
                className="text-[#737373] hover:text-[#171717]"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleConfirmOverride} className="mt-4 space-y-4 text-xs">
              {overrideError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-red-800 flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{overrideError}</span>
                </div>
              )}

              <div className="rounded-md border border-[#E5E5E5] bg-[#F7F7F7] p-3">
                <span className="text-[#737373] text-[11px]">Student:</span>
                <p className="font-semibold text-[#171717] text-sm">
                  {overrideTarget.student.first_name} {overrideTarget.student.last_name}
                </p>
                <span className="font-mono text-[11px] text-[#737373]">
                  {overrideTarget.student.student_code}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#171717] mb-1">
                  Corrected Attendance Status *
                </label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value as AttendanceStatus)}
                  className="w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                >
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#171717] mb-1">
                  Mandatory Override Reason * <span className="text-[#737373] font-normal">(min. 3 characters)</span>
                </label>
                <textarea
                  required
                  minLength={3}
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Student arrived with verified medical note; mobile network connection failed."
                  className="w-full rounded-md border border-[#E5E5E5] px-3 py-2 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E5E5E5]">
                <button
                  type="button"
                  onClick={() => setOverrideTarget(null)}
                  className="rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs font-medium text-[#737373] hover:text-[#171717]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOverride}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#111111] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#262626] disabled:opacity-50"
                >
                  {isSubmittingOverride && <Loader2 size={13} className="animate-spin" />}
                  <span>Save Override</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
