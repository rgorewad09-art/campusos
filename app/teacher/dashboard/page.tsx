'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  CalendarCheck,
  CalendarDays,
  Users,
  BookOpen,
  Clock,
  MapPin,
  Plus,
  AlertCircle,
  CheckCircle2,
  LogOut,
  Loader2,
  X,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import { logoutAction } from '@/app/actions/auth';
import { getTeacherPortalDataAction } from '@/app/actions/teachers';
import { createTimetableEntryAction } from '@/app/actions/academic';
import type { Teacher } from '@/src/types/teacher';
import type {
  TeacherSubjectAssignment,
  TimetableEntry,
  TimetableFormData,
  TimetableConflict,
} from '@/src/types/academic';
import type { Student } from '@/src/types/student';
import { DAYS_OF_WEEK, DEFAULT_ACADEMIC_TERM } from '@/src/types/academic';
import SessionTimeoutWarning from '@/app/components/SessionTimeoutWarning';

export default function TeacherDashboardPage() {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [assignments, setAssignments] = useState<TeacherSubjectAssignment[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [todayClasses, setTodayClasses] = useState<TimetableEntry[]>([]);
  const [rosterStudents, setRosterStudents] = useState<Student[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<'overview' | 'schedule' | 'subjects' | 'roster'>('overview');

  // Propose Slot Modal
  const [isProposeModalOpen, setIsProposeModalOpen] = useState(false);
  const [selectedAssignmentIndex, setSelectedAssignmentIndex] = useState(0);
  const [slotDay, setSlotDay] = useState(1);
  const [slotStartTime, setSlotStartTime] = useState('09:00');
  const [slotEndTime, setSlotEndTime] = useState('10:30');
  const [slotRoom, setSlotRoom] = useState('Room 101');
  const [isSubmittingSlot, setIsSubmittingSlot] = useState(false);
  const [conflicts, setConflicts] = useState<TimetableConflict[]>([]);
  const [proposeError, setProposeError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getTeacherPortalDataAction();
      if (!res.success || !res.data) {
        setError(res.error || 'Failed to load faculty portal data.');
      } else {
        setTeacher(res.data.teacher);
        setAssignments(res.data.assignments);
        setTimetable(res.data.timetable);
        setTodayClasses(res.data.todayClasses);
        setRosterStudents(res.data.rosterStudents);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading faculty portal.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    await logoutAction('/teacher/login?error=logged_out');
  }

  async function handleProposeSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!teacher || assignments.length === 0) return;

    const assignment = assignments[selectedAssignmentIndex];
    if (!assignment) return;

    setIsSubmittingSlot(true);
    setConflicts([]);
    setProposeError(null);

    const payload: TimetableFormData = {
      academic_term: assignment.academic_term,
      course_id: assignment.course_id,
      subject_id: assignment.subject_id,
      teacher_id: teacher.id,
      section: assignment.section,
      semester: assignment.semester,
      day_of_week: Number(slotDay),
      start_time: slotStartTime,
      end_time: slotEndTime,
      room: slotRoom.trim(),
    };

    try {
      // Call createTimetableEntryAction with asTeacher = true
      const res = await createTimetableEntryAction(payload, true);
      if (!res.success) {
        if (res.conflicts && res.conflicts.length > 0) {
          setConflicts(res.conflicts);
        } else {
          setProposeError(res.error || 'Failed to propose schedule slot.');
        }
      } else {
        setIsProposeModalOpen(false);
        setSuccessBanner('Class slot proposed successfully. Awaiting administrator review.');
        fetchData();
      }
    } catch (err: unknown) {
      setProposeError(err instanceof Error ? err.message : 'Error submitting schedule proposal.');
    } finally {
      setIsSubmittingSlot(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-[#171717]" />
          <p className="text-xs text-[#737373]">Loading Faculty Portal...</p>
        </div>
      </div>
    );
  }

  if (error || !teacher) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-sm text-center">
          <AlertCircle size={28} className="mx-auto text-red-600 mb-3" />
          <h2 className="text-base font-semibold text-[#171717]">Faculty Portal Error</h2>
          <p className="text-xs text-[#737373] mt-2 mb-6">{error || 'Unable to load teacher profile.'}</p>
          <button
            onClick={handleSignOut}
            className="rounded-md bg-[#111111] px-4 py-2 text-xs font-medium text-white hover:bg-[#262626]"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <SessionTimeoutWarning />

      {/* Header */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#E5E5E5] bg-white px-6">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold tracking-tight text-[#171717] select-none">
            Campus<span className="text-[#737373]">OS</span>
          </span>
          <span className="rounded border border-[#E5E5E5] bg-[#F7F7F7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#737373]">
            Faculty Portal
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[#737373] hidden sm:inline">
            Logged in as <strong className="text-[#171717]">{teacher.first_name} {teacher.last_name}</strong>
          </span>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs font-medium text-[#737373] hover:text-[#171717] hover:border-[#171717] transition-colors"
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-6">
        {/* Banner Alert */}
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

        {/* Welcome / Profile Summary */}
        <div className="rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-medium text-[#737373] uppercase tracking-wider">
                  Teacher ID
                </span>
                <span className="rounded bg-[#171717] px-2 py-0.5 font-mono text-xs font-semibold text-white">
                  {teacher.teacher_code}
                </span>
                <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold uppercase">
                  {teacher.status}
                </span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-[#171717]">
                Professor {teacher.first_name} {teacher.last_name}
              </h1>
              <p className="mt-1 text-xs text-[#737373]">
                {teacher.department} Department &bull; {teacher.email}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/teacher/attendance"
                className="inline-flex items-center gap-1.5 rounded-md bg-[#111111] px-4 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors"
              >
                <CalendarCheck size={14} />
                <span>Take Attendance</span>
              </Link>
              <button
                onClick={() => {
                  setConflicts([]);
                  setProposeError(null);
                  setIsProposeModalOpen(true);
                }}
                disabled={assignments.length === 0}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#E5E5E5] bg-white px-4 py-2 text-xs font-medium text-[#171717] hover:border-[#171717] transition-colors disabled:opacity-50"
              >
                <Plus size={14} />
                <span>Propose Class Slot</span>
              </button>
            </div>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[#E5E5E5] bg-white p-5 shadow-xs">
            <span className="text-xs font-medium uppercase tracking-wider text-[#737373]">
              Today&apos;s Lectures
            </span>
            <div className="mt-3 text-2xl font-bold text-[#171717]">
              {todayClasses.length}
            </div>
            <p className="mt-1 text-[11px] text-[#737373]">Scheduled for today</p>
          </div>

          <div className="rounded-xl border border-[#E5E5E5] bg-white p-5 shadow-xs">
            <span className="text-xs font-medium uppercase tracking-wider text-[#737373]">
              Assigned Subjects
            </span>
            <div className="mt-3 text-2xl font-bold text-[#171717]">
              {assignments.length}
            </div>
            <p className="mt-1 text-[11px] text-[#737373]">Across authorized sections</p>
          </div>

          <div className="rounded-xl border border-[#E5E5E5] bg-white p-5 shadow-xs">
            <span className="text-xs font-medium uppercase tracking-wider text-[#737373]">
              Weekly Sessions
            </span>
            <div className="mt-3 text-2xl font-bold text-[#171717]">
              {timetable.filter((t) => t.status === 'approved').length}
            </div>
            <p className="mt-1 text-[11px] text-[#737373]">Approved timetable slots</p>
          </div>

          <div className="rounded-xl border border-[#E5E5E5] bg-white p-5 shadow-xs">
            <span className="text-xs font-medium uppercase tracking-wider text-[#737373]">
              Enrolled Students
            </span>
            <div className="mt-3 text-2xl font-bold text-[#171717]">
              {rosterStudents.length}
            </div>
            <p className="mt-1 text-[11px] text-[#737373]">In your assigned classes</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#E5E5E5] overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'overview'
                ? 'border-[#171717] text-[#171717]'
                : 'border-transparent text-[#737373] hover:text-[#171717]'
            }`}
          >
            <CalendarCheck size={14} />
            <span>Today&apos;s Lectures ({todayClasses.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'schedule'
                ? 'border-[#171717] text-[#171717]'
                : 'border-transparent text-[#737373] hover:text-[#171717]'
            }`}
          >
            <CalendarDays size={14} />
            <span>Weekly Timetable ({timetable.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('subjects')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'subjects'
                ? 'border-[#171717] text-[#171717]'
                : 'border-transparent text-[#737373] hover:text-[#171717]'
            }`}
          >
            <BookOpen size={14} />
            <span>Assigned Coursework ({assignments.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('roster')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'roster'
                ? 'border-[#171717] text-[#171717]'
                : 'border-transparent text-[#737373] hover:text-[#171717]'
            }`}
          >
            <Users size={14} />
            <span>Student Roster ({rosterStudents.length})</span>
          </button>
        </div>

        {/* Tab 1: Today's Classes & Quick Attendance */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#E5E5E5] bg-white p-5 shadow-xs">
              <h3 className="text-sm font-semibold text-[#171717]">Today&apos;s Schedule</h3>
              <p className="text-[11px] text-[#737373] mt-0.5">
                Active classes for today. Record daily attendance directly from each class card.
              </p>
            </div>

            {todayClasses.length === 0 ? (
              <div className="rounded-xl border border-[#E5E5E5] bg-white p-12 text-center text-xs text-[#737373]">
                <CalendarDays size={32} className="mx-auto mb-2 text-[#A3A3A3]" />
                <p className="font-medium text-[#171717]">No classes scheduled for today</p>
                <p className="text-[11px] mt-1">Check your weekly timetable or propose a schedule slot.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {todayClasses.map((cls) => (
                  <div
                    key={cls.id}
                    className="rounded-xl border border-[#E5E5E5] bg-white p-5 shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <span className="font-semibold text-sm text-[#171717]">
                          {cls.subject?.name}
                        </span>
                        <span className="font-mono text-xs text-[#737373]">
                          {cls.subject?.code}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1.5 text-xs text-[#525252]">
                        <div className="flex items-center gap-2">
                          <Clock size={13} className="text-[#A3A3A3]" />
                          <span className="font-mono font-medium text-[#171717]">
                            {cls.start_time.slice(0, 5)} - {cls.end_time.slice(0, 5)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin size={13} className="text-[#A3A3A3]" />
                          <span>{cls.room}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <GraduationCap size={13} className="text-[#A3A3A3]" />
                          <span>
                            {cls.course?.code} &bull; Sem {cls.semester} (Section {cls.section})
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 border-t border-[#F0F0F0] pt-3 flex justify-between items-center">
                      <span className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wider">
                        {cls.status}
                      </span>
                      <Link
                        href="/teacher/attendance"
                        className="inline-flex items-center gap-1 rounded bg-[#111111] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#262626] transition-colors"
                      >
                        <CalendarCheck size={12} />
                        <span>Take Attendance</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Weekly Timetable & Proposal */}
        {activeTab === 'schedule' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-[#E5E5E5] bg-white p-5 shadow-xs">
              <div>
                <h3 className="text-sm font-semibold text-[#171717]">Faculty Weekly Timetable</h3>
                <p className="text-[11px] text-[#737373] mt-0.5">
                  View scheduled sessions and proposed slots across all days of the week.
                </p>
              </div>
              <button
                onClick={() => {
                  setConflicts([]);
                  setProposeError(null);
                  setIsProposeModalOpen(true);
                }}
                disabled={assignments.length === 0}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#111111] px-4 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors disabled:opacity-50"
              >
                <Plus size={14} />
                <span>Propose Class Slot</span>
              </button>
            </div>

            {DAYS_OF_WEEK.map((day) => {
              const daySlots = timetable.filter((s) => s.day_of_week === day.value);

              return (
                <div
                  key={day.value}
                  className="rounded-xl border border-[#E5E5E5] bg-white shadow-xs overflow-hidden"
                >
                  <div className="flex items-center justify-between border-b border-[#E5E5E5] bg-[#FAFAFA] px-5 py-2.5">
                    <span className="text-xs font-bold text-[#171717]">{day.label}</span>
                    <span className="text-[11px] text-[#737373]">
                      {daySlots.length} {daySlots.length === 1 ? 'session' : 'sessions'}
                    </span>
                  </div>

                  <div className="p-4">
                    {daySlots.length === 0 ? (
                      <p className="text-center py-2 text-xs text-[#A3A3A3]">
                        No teaching sessions scheduled for {day.label}.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {daySlots.map((slot) => (
                          <div
                            key={slot.id}
                            className={`rounded-lg border p-3 text-xs ${
                              slot.status === 'proposed'
                                ? 'border-amber-200 bg-amber-50/40'
                                : 'border-[#E5E5E5] bg-white'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <span className="font-semibold text-[#171717]">
                                {slot.subject?.code} - {slot.subject?.name}
                              </span>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                                  slot.status === 'approved'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {slot.status}
                              </span>
                            </div>

                            <div className="mt-2 space-y-1 text-[11px] text-[#525252]">
                              <div className="flex items-center gap-1.5">
                                <Clock size={12} className="text-[#A3A3A3]" />
                                <span className="font-mono">
                                  {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <MapPin size={12} className="text-[#A3A3A3]" />
                                <span>
                                  {slot.room} &bull; {slot.course?.code} Sem {slot.semester} (Sec {slot.section})
                                </span>
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

        {/* Tab 3: Assigned Coursework */}
        {activeTab === 'subjects' && (
          <div className="rounded-xl border border-[#E5E5E5] bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E5E5E5]">
              <h3 className="text-sm font-semibold text-[#171717]">Authorized Subject Assignments</h3>
              <p className="text-[11px] text-[#737373] mt-0.5">
                Programs and subjects assigned to your teaching workload by the administrator.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#E5E5E5] bg-[#FAFAFA] text-[#737373] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-6 py-3">Subject</th>
                    <th className="px-6 py-3">Program</th>
                    <th className="px-6 py-3">Semester & Section</th>
                    <th className="px-6 py-3">Academic Term</th>
                    <th className="px-6 py-3">Credits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5]">
                  {assignments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-[#737373]">
                        No subject assignments recorded. Contact administration to assign subjects.
                      </td>
                    </tr>
                  ) : (
                    assignments.map((a) => (
                      <tr key={a.id} className="hover:bg-[#FAFAFA]">
                        <td className="px-6 py-3.5">
                          <span className="font-semibold text-[#171717]">{a.subject?.name}</span>
                          <span className="ml-2 font-mono text-[11px] text-[#737373]">
                            ({a.subject?.code})
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-[#171717]">
                          {a.course?.code} - {a.course?.name}
                        </td>
                        <td className="px-6 py-3.5 text-[#525252]">
                          Semester {a.semester} &bull; Section {a.section}
                        </td>
                        <td className="px-6 py-3.5 text-[#737373]">
                          {a.academic_term}
                        </td>
                        <td className="px-6 py-3.5 text-[#525252]">
                          {a.subject?.credits} Credits
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Student Roster */}
        {activeTab === 'roster' && (
          <div className="rounded-xl border border-[#E5E5E5] bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E5E5E5]">
              <h3 className="text-sm font-semibold text-[#171717]">Authorized Student Roster</h3>
              <p className="text-[11px] text-[#737373] mt-0.5">
                Students currently enrolled in the programs and sections assigned to you.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#E5E5E5] bg-[#FAFAFA] text-[#737373] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-6 py-3">College ID</th>
                    <th className="px-6 py-3">Student Name</th>
                    <th className="px-6 py-3">Email Address</th>
                    <th className="px-6 py-3">Enrollment Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5]">
                  {rosterStudents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-[#737373]">
                        No approved enrolled students found for your assigned sections.
                      </td>
                    </tr>
                  ) : (
                    rosterStudents.map((s) => (
                      <tr key={s.id} className="hover:bg-[#FAFAFA]">
                        <td className="px-6 py-3.5 font-mono font-medium text-[#171717]">
                          {s.student_code}
                        </td>
                        <td className="px-6 py-3.5 font-medium text-[#171717]">
                          {s.first_name} {s.last_name}
                        </td>
                        <td className="px-6 py-3.5 text-[#525252]">
                          {s.email || '—'}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold uppercase">
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal: Propose Schedule Slot */}
        {isProposeModalOpen && assignments.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-[#E5E5E5]">
                <div className="flex items-center gap-2">
                  <CalendarDays size={18} className="text-[#171717]" />
                  <h2 className="text-sm font-semibold text-[#171717]">
                    Propose Lecture Schedule Slot
                  </h2>
                </div>
                <button
                  onClick={() => setIsProposeModalOpen(false)}
                  className="text-[#737373] hover:text-[#171717]"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Conflict Warnings */}
              {conflicts.length > 0 && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-red-800">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>Booking Conflict Detected</span>
                  </div>
                  {conflicts.map((c, i) => (
                    <p key={i} className="text-[11px] leading-relaxed pl-5">
                      • {c.message}
                    </p>
                  ))}
                </div>
              )}

              {proposeError && (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-800 flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{proposeError}</span>
                </div>
              )}

              <form onSubmit={handleProposeSlot} className="space-y-3 pt-4 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-[#171717] mb-1">
                    Assigned Course & Subject *
                  </label>
                  <select
                    value={selectedAssignmentIndex}
                    onChange={(e) => setSelectedAssignmentIndex(Number(e.target.value))}
                    required
                    className="w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                  >
                    {assignments.map((a, idx) => (
                      <option key={a.id} value={idx}>
                        {a.subject?.name} ({a.course?.code} Sem {a.semester} Sec {a.section})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#171717] mb-1">
                      Day of Week *
                    </label>
                    <select
                      value={slotDay}
                      onChange={(e) => setSlotDay(Number(e.target.value))}
                      className="w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    >
                      {DAYS_OF_WEEK.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#171717] mb-1">
                      Lecture Classroom / Room *
                    </label>
                    <input
                      type="text"
                      required
                      value={slotRoom}
                      onChange={(e) => setSlotRoom(e.target.value)}
                      placeholder="e.g. Lab 201 or Room 102"
                      className="w-full rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#171717] mb-1">
                      Start Time (HH:mm) *
                    </label>
                    <input
                      type="time"
                      required
                      value={slotStartTime}
                      onChange={(e) => setSlotStartTime(e.target.value)}
                      className="w-full rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#171717] mb-1">
                      End Time (HH:mm) *
                    </label>
                    <input
                      type="time"
                      required
                      value={slotEndTime}
                      onChange={(e) => setSlotEndTime(e.target.value)}
                      className="w-full rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-[#737373] leading-relaxed pt-1">
                  Proposed slots are checked against institutional hours and teacher/room/section conflicts before submission.
                  Once proposed, your administrator will review and activate the slot.
                </p>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E5E5]">
                  <button
                    type="button"
                    onClick={() => setIsProposeModalOpen(false)}
                    className="rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs font-medium text-[#525252] hover:bg-[#F7F7F7]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingSlot}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#111111] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#262626] disabled:opacity-50"
                  >
                    {isSubmittingSlot && <Loader2 size={13} className="animate-spin" />}
                    <span>Submit Proposal</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
