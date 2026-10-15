'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CalendarDays,
  Plus,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  X,
  Loader2,
  User,
  MapPin,
  Check,
} from 'lucide-react';
import AppShell from '@/app/components/AppShell';
import {
  getTimetablesAction,
  createTimetableEntryAction,
  reviewTimetableEntryAction,
  deleteTimetableEntryAction,
  getCoursesAction,
  getSubjectsAction,
} from '@/app/actions/academic';
import { getTeachersAction } from '@/app/actions/teachers';
import type {
  TimetableEntry,
  TimetableFormData,
  Course,
  Subject,
  TimetableConflict,
} from '@/src/types/academic';
import type { Teacher } from '@/src/types/teacher';
import { DAYS_OF_WEEK, DEFAULT_ACADEMIC_TERM } from '@/src/types/academic';

export default function AdminTimetablePage() {
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Filters
  const [selectedTerm, setSelectedTerm] = useState(DEFAULT_ACADEMIC_TERM);
  const [filterCourseId, setFilterCourseId] = useState('all');
  const [filterTeacherId, setFilterTeacherId] = useState('all');
  const [filterDay, setFilterDay] = useState<number | 'all'>('all');

  // Add Slot Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflicts, setConflicts] = useState<TimetableConflict[]>([]);
  const [slotForm, setSlotForm] = useState<TimetableFormData>({
    academic_term: DEFAULT_ACADEMIC_TERM,
    course_id: '',
    subject_id: '',
    teacher_id: '',
    section: 'A',
    semester: 1,
    day_of_week: 1,
    start_time: '09:00',
    end_time: '10:30',
    room: 'Room 101',
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [ttRes, cRes, sRes, tRes] = await Promise.all([
        getTimetablesAction({
          term: selectedTerm,
          course_id: filterCourseId !== 'all' ? filterCourseId : undefined,
          teacher_id: filterTeacherId !== 'all' ? filterTeacherId : undefined,
        }),
        getCoursesAction(),
        getSubjectsAction(),
        getTeachersAction({ pageSize: 100 }),
      ]);

      if (ttRes.success && ttRes.timetable) {
        setTimetable(ttRes.timetable);
      } else {
        setErrorMessage(ttRes.error || 'Failed to load timetables.');
      }

      if (cRes.success && cRes.courses) {
        setCourses(cRes.courses);
        if (cRes.courses.length > 0 && !slotForm.course_id) {
          setSlotForm((prev) => ({ ...prev, course_id: cRes.courses![0].id }));
        }
      }

      if (sRes.success && sRes.subjects) {
        setSubjects(sRes.subjects);
        if (sRes.subjects.length > 0 && !slotForm.subject_id) {
          setSlotForm((prev) => ({ ...prev, subject_id: sRes.subjects![0].id }));
        }
      }

      if (tRes.success && tRes.data?.teachers) {
        setTeachers(tRes.data.teachers);
        if (tRes.data.teachers.length > 0 && !slotForm.teacher_id) {
          setSlotForm((prev) => ({ ...prev, teacher_id: tRes.data!.teachers[0].id }));
        }
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error fetching timetable data.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedTerm, filterCourseId, filterTeacherId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleCreateSlot(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setConflicts([]);
    setErrorMessage(null);

    try {
      const res = await createTimetableEntryAction(slotForm, false);
      if (!res.success) {
        if (res.conflicts && res.conflicts.length > 0) {
          setConflicts(res.conflicts);
        } else {
          setErrorMessage(res.error || 'Failed to schedule class slot.');
        }
      } else {
        setIsModalOpen(false);
        setSuccessBanner('Class slot scheduled successfully without conflicts.');
        fetchData();
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to schedule slot.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleApproveSlot(id: string) {
    try {
      const res = await reviewTimetableEntryAction(id, 'approved');
      if (res.success) {
        setSuccessBanner('Proposed timetable slot approved.');
        fetchData();
      } else {
        alert(res.error || 'Failed to approve slot.');
      }
    } catch {
      alert('Error approving timetable slot.');
    }
  }

  async function handleDeleteSlot(id: string) {
    if (!confirm('Are you sure you want to remove this schedule slot?')) return;
    try {
      const res = await deleteTimetableEntryAction(id);
      if (res.success) {
        fetchData();
      } else {
        alert(res.error || 'Failed to delete slot.');
      }
    } catch {
      alert('Error deleting schedule slot.');
    }
  }

  const filteredSlots = timetable.filter(
    (slot) => filterDay === 'all' || slot.day_of_week === filterDay
  );

  return (
    <AppShell pageTitle="Institutional Timetable & Scheduling">
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

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5E5E5] bg-white p-4 shadow-xs">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div>
              <label className="block text-[10px] font-medium text-[#737373] mb-1">
                Academic Term
              </label>
              <input
                type="text"
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="w-32 rounded-md border border-[#E5E5E5] px-2.5 py-1 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-medium text-[#737373] mb-1">
                Program / Course
              </label>
              <select
                value={filterCourseId}
                onChange={(e) => setFilterCourseId(e.target.value)}
                className="rounded-md border border-[#E5E5E5] bg-white px-2.5 py-1 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
              >
                <option value="all">All Programs</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-medium text-[#737373] mb-1">
                Faculty Member
              </label>
              <select
                value={filterTeacherId}
                onChange={(e) => setFilterTeacherId(e.target.value)}
                className="rounded-md border border-[#E5E5E5] bg-white px-2.5 py-1 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
              >
                <option value="all">All Faculty</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.first_name} {t.last_name} ({t.teacher_code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-medium text-[#737373] mb-1">
                Day of Week
              </label>
              <select
                value={filterDay}
                onChange={(e) => setFilterDay(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="rounded-md border border-[#E5E5E5] bg-white px-2.5 py-1 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
              >
                <option value="all">All Days (Mon - Sun)</option>
                {DAYS_OF_WEEK.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={() => {
              setConflicts([]);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#111111] px-4 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors"
          >
            <Plus size={14} />
            <span>Add Schedule Slot</span>
          </button>
        </div>

        {/* Schedule Grid by Day */}
        <div className="space-y-4">
          {DAYS_OF_WEEK.map((day) => {
            const daySlots = filteredSlots.filter((s) => s.day_of_week === day.value);
            if (filterDay !== 'all' && filterDay !== day.value) return null;

            return (
              <div
                key={day.value}
                className="rounded-xl border border-[#E5E5E5] bg-white shadow-xs overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-[#E5E5E5] bg-[#FAFAFA] px-5 py-3">
                  <div className="flex items-center gap-2">
                    <CalendarDays size={16} className="text-[#171717]" />
                    <h3 className="text-xs font-bold text-[#171717]">{day.label}</h3>
                  </div>
                  <span className="text-[11px] text-[#737373]">
                    {daySlots.length} {daySlots.length === 1 ? 'class' : 'classes'} scheduled
                  </span>
                </div>

                <div className="p-4">
                  {daySlots.length === 0 ? (
                    <p className="text-center py-4 text-xs text-[#A3A3A3]">
                      No classes scheduled for {day.label}.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {daySlots.map((slot) => (
                        <div
                          key={slot.id}
                          className={`rounded-lg border p-3 text-xs transition-colors ${
                            slot.status === 'proposed'
                              ? 'border-amber-200 bg-amber-50/40'
                              : 'border-[#E5E5E5] bg-white hover:border-[#171717]'
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
                              <User size={12} className="text-[#A3A3A3]" />
                              <span>
                                {slot.teacher ? `${slot.teacher.first_name} ${slot.teacher.last_name}` : 'Unassigned'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <MapPin size={12} className="text-[#A3A3A3]" />
                              <span>
                                {slot.room} • {slot.course?.code} Sem {slot.semester} (Sec {slot.section})
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between border-t border-[#F0F0F0] pt-2">
                            {slot.status === 'proposed' ? (
                              <button
                                onClick={() => handleApproveSlot(slot.id)}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-900"
                              >
                                <Check size={12} />
                                <span>Approve Slot</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-emerald-700 font-medium">
                                Active Schedule
                              </span>
                            )}
                            <button
                              onClick={() => handleDeleteSlot(slot.id)}
                              className="text-[#A3A3A3] hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
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

        {/* Modal: Add Timetable Slot */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-[#E5E5E5]">
                <div className="flex items-center gap-2">
                  <CalendarDays size={18} className="text-[#171717]" />
                  <h2 className="text-sm font-semibold text-[#171717]">
                    Schedule Class Session
                  </h2>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-[#737373] hover:text-[#171717]"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Conflict Alert Warning */}
              {conflicts.length > 0 && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-red-800">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>Scheduling Conflict Detected</span>
                  </div>
                  {conflicts.map((c, i) => (
                    <p key={i} className="text-[11px] leading-relaxed pl-5">
                      • {c.message}
                    </p>
                  ))}
                </div>
              )}

              <form onSubmit={handleCreateSlot} className="space-y-3 pt-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#171717] mb-1">
                      Program / Course *
                    </label>
                    <select
                      value={slotForm.course_id}
                      onChange={(e) => setSlotForm({ ...slotForm, course_id: e.target.value })}
                      required
                      className="w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    >
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} - {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#171717] mb-1">
                      Subject *
                    </label>
                    <select
                      value={slotForm.subject_id}
                      onChange={(e) => setSlotForm({ ...slotForm, subject_id: e.target.value })}
                      required
                      className="w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    >
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code} - {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#171717] mb-1">
                      Faculty Member *
                    </label>
                    <select
                      value={slotForm.teacher_id}
                      onChange={(e) => setSlotForm({ ...slotForm, teacher_id: e.target.value })}
                      required
                      className="w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    >
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.first_name} {t.last_name} ({t.teacher_code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#171717] mb-1">
                      Classroom / Lecture Room *
                    </label>
                    <input
                      type="text"
                      required
                      value={slotForm.room}
                      onChange={(e) => setSlotForm({ ...slotForm, room: e.target.value })}
                      placeholder="e.g. Lab 204 or Room 101"
                      className="w-full rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#171717] mb-1">
                      Semester *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      required
                      value={slotForm.semester}
                      onChange={(e) => setSlotForm({ ...slotForm, semester: Number(e.target.value) })}
                      className="w-full rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#171717] mb-1">
                      Section *
                    </label>
                    <input
                      type="text"
                      maxLength={5}
                      required
                      value={slotForm.section}
                      onChange={(e) => setSlotForm({ ...slotForm, section: e.target.value.toUpperCase() })}
                      className="w-full rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#171717] mb-1">
                      Day of Week *
                    </label>
                    <select
                      value={slotForm.day_of_week}
                      onChange={(e) => setSlotForm({ ...slotForm, day_of_week: Number(e.target.value) })}
                      className="w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    >
                      {DAYS_OF_WEEK.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
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
                      value={slotForm.start_time}
                      onChange={(e) => setSlotForm({ ...slotForm, start_time: e.target.value })}
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
                      value={slotForm.end_time}
                      onChange={(e) => setSlotForm({ ...slotForm, end_time: e.target.value })}
                      className="w-full rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E5E5]">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
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
                    <span>Confirm & Schedule</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
