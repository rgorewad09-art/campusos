'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap,
  Plus,
  Search,
  BookOpen,
  Mail,
  Phone,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  X,
  Loader2,
  UserCheck,
  UserX,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import {
  getTeachersAction,
  createTeacherAction,
  updateTeacherAction,
  assignTeacherSubjectAction,
  resendTeacherInviteAction,
} from '@/app/actions/teachers';
import { getCoursesAction, getSubjectsAction } from '@/app/actions/academic';
import type { Teacher, TeacherFormData } from '@/src/types/teacher';
import type { Course, Subject } from '@/src/types/academic';
import { DEFAULT_ACADEMIC_TERM } from '@/src/types/academic';

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Add Teacher Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createdTeacherResult, setCreatedTeacherResult] = useState<{
    teacher: Teacher;
    activationLink?: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [resendingTeacherId, setResendingTeacherId] = useState<string | null>(null);

  const [formData, setFormData] = useState<TeacherFormData>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    department: 'Computer Science',
    status: 'active',
  });

  // Assign Subject Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedTeacherForAssign, setSelectedTeacherForAssign] = useState<Teacher | null>(null);
  const [assignCourseId, setAssignCourseId] = useState('');
  const [assignSubjectId, setAssignSubjectId] = useState('');
  const [assignSemester, setAssignSemester] = useState(1);
  const [assignSection, setAssignSection] = useState('A');
  const [assignTerm, setAssignTerm] = useState(DEFAULT_ACADEMIC_TERM);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [tRes, cRes, sRes] = await Promise.all([
        getTeachersAction({ search: searchQuery }),
        getCoursesAction(),
        getSubjectsAction(),
      ]);

      if (tRes.success && tRes.data) {
        setTeachers(tRes.data.teachers);
      } else {
        setErrorMessage(tRes.error || 'Failed to load faculty roster.');
      }

      if (cRes.success && cRes.courses) {
        setCourses(cRes.courses);
        if (cRes.courses.length > 0) setAssignCourseId(cRes.courses[0].id);
      }
      if (sRes.success && sRes.subjects) {
        setSubjects(sRes.subjects);
        if (sRes.subjects.length > 0) setAssignSubjectId(sRes.subjects[0].id);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error fetching data.');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleCreateTeacher(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      const res = await createTeacherAction(formData);
      if (!res.success || !res.teacher) {
        setFormError(res.error || 'Failed to create teacher.');
      } else {
        setCreatedTeacherResult({
          teacher: res.teacher,
          activationLink: res.activationLink,
        });
        setSuccessBanner(`Faculty member ${res.teacher.first_name} ${res.teacher.last_name} created successfully.`);
        fetchData();
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create teacher.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAssignSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTeacherForAssign) return;

    setAssignSubmitting(true);
    setAssignError(null);

    try {
      const res = await assignTeacherSubjectAction({
        teacher_id: selectedTeacherForAssign.id,
        course_id: assignCourseId,
        subject_id: assignSubjectId,
        semester: Number(assignSemester),
        section: assignSection,
        academic_term: assignTerm,
      });

      if (!res.success) {
        setAssignError(res.error || 'Failed to assign subject.');
      } else {
        setIsAssignModalOpen(false);
        setSuccessBanner(`Subject successfully assigned to ${selectedTeacherForAssign.first_name} ${selectedTeacherForAssign.last_name}.`);
        fetchData();
      }
    } catch (err: unknown) {
      setAssignError(err instanceof Error ? err.message : 'Failed to assign subject.');
    } finally {
      setAssignSubmitting(false);
    }
  }

  async function handleToggleStatus(teacher: Teacher) {
    const nextStatus = teacher.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await updateTeacherAction(teacher.id, { status: nextStatus });
      if (res.success) {
        fetchData();
      } else {
        alert(res.error || 'Failed to update status.');
      }
    } catch {
      alert('Error updating status.');
    }
  }

  function handleCopyActivation(url: string) {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  async function handleResendInvite(teacher: Teacher) {
    setResendingTeacherId(teacher.id);
    setErrorMessage(null);
    setSuccessBanner(null);
    try {
      const res = await resendTeacherInviteAction(teacher.id);
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to dispatch activation invitation.');
      } else {
        setSuccessBanner(res.message || `Activation invitation dispatched to ${teacher.email}.`);
        if (res.activationLink) {
          setCreatedTeacherResult({
            teacher,
            activationLink: res.activationLink,
          });
          setIsAddModalOpen(true);
        }
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error dispatching invitation.');
    } finally {
      setResendingTeacherId(null);
    }
  }

  return (
    <AppShell pageTitle="Faculty Management">
      <div className="space-y-6">
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

        {errorMessage && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
            <AlertCircle size={16} className="text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Top Control Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737373]"
            />
            <input
              type="text"
              placeholder="Search faculty by name, ID (TCH-...), or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-[#E5E5E5] bg-white py-2 pl-9 pr-4 text-xs text-[#171717] placeholder:text-[#A3A3A3] focus:border-[#171717] focus:outline-none"
            />
          </div>

          <button
            onClick={() => {
              setCreatedTeacherResult(null);
              setFormError(null);
              setFormData({
                first_name: '',
                last_name: '',
                email: '',
                phone: '',
                department: 'Computer Science',
                status: 'active',
              });
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#111111] px-4 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors"
          >
            <Plus size={14} />
            <span>Add Faculty Member</span>
          </button>
        </div>

        {/* Faculty Table */}
        <div className="rounded-xl border border-[#E5E5E5] bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E5E5E5] bg-[#FAFAFA] text-[#737373] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-3">Teacher ID</th>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Department</th>
                  <th className="px-6 py-3">Contact</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-[#737373]">
                      <Loader2 size={18} className="animate-spin inline mr-2 text-[#171717]" />
                      Loading faculty members...
                    </td>
                  </tr>
                ) : teachers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-[#737373]">
                      <GraduationCap size={32} className="mx-auto mb-2 text-[#A3A3A3]" />
                      <p className="font-medium text-[#171717]">No faculty members found</p>
                      <p className="text-[11px] mt-1">Add teachers to assign coursework and manage schedules.</p>
                    </td>
                  </tr>
                ) : (
                  teachers.map((t) => (
                    <tr key={t.id} className="hover:bg-[#FAFAFA] transition-colors">
                      <td className="px-6 py-3.5 font-mono font-medium text-[#171717]">
                        {t.teacher_code}
                      </td>
                      <td className="px-6 py-3.5 font-medium text-[#171717]">
                        {t.first_name} {t.last_name}
                      </td>
                      <td className="px-6 py-3.5 text-[#525252]">
                        {t.department}
                      </td>
                      <td className="px-6 py-3.5 text-[#525252]">
                        <div className="flex items-center gap-1.5">
                          <Mail size={12} className="text-[#A3A3A3]" />
                          <span>{t.email}</span>
                        </div>
                        {t.phone && (
                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[#737373]">
                            <Phone size={11} className="text-[#A3A3A3]" />
                            <span>{t.phone}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                            t.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right space-x-2">
                        <button
                          onClick={() => handleResendInvite(t)}
                          disabled={resendingTeacherId === t.id}
                          title="Generate fresh activation link or resend invitation"
                          className="inline-flex items-center gap-1 rounded border border-[#E5E5E5] bg-white px-2.5 py-1 text-[11px] font-medium text-[#171717] hover:border-[#171717] transition-colors disabled:opacity-50"
                        >
                          {resendingTeacherId === t.id ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <Mail size={11} />
                          )}
                          <span>Activation Link</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedTeacherForAssign(t);
                            setAssignError(null);
                            setIsAssignModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 rounded border border-[#E5E5E5] bg-white px-2.5 py-1 text-[11px] font-medium text-[#171717] hover:border-[#171717] transition-colors"
                        >
                          <BookOpen size={11} />
                          <span>Assign Subject</span>
                        </button>
                        <button
                          onClick={() => handleToggleStatus(t)}
                          title={t.status === 'active' ? 'Deactivate faculty account' : 'Activate faculty account'}
                          className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
                            t.status === 'active'
                              ? 'border-neutral-200 text-[#737373] hover:text-red-600 hover:border-red-300'
                              : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {t.status === 'active' ? <UserX size={12} /> : <UserCheck size={12} />}
                          <span>{t.status === 'active' ? 'Deactivate' : 'Activate'}</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Add Faculty */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-[#E5E5E5]">
                <div className="flex items-center gap-2">
                  <GraduationCap size={18} className="text-[#171717]" />
                  <h2 className="text-sm font-semibold text-[#171717]">
                    {createdTeacherResult ? 'Faculty Member Created' : 'Add Faculty Member'}
                  </h2>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-[#737373] hover:text-[#171717]"
                >
                  <X size={16} />
                </button>
              </div>

              {createdTeacherResult ? (
                <div className="space-y-4 pt-4 text-xs">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                    <p className="font-semibold">Account Initialized Successfully</p>
                    <p className="mt-1 text-[11px] leading-relaxed">
                      Faculty record created with ID{' '}
                      <strong className="font-mono text-emerald-950">
                        {createdTeacherResult.teacher.teacher_code}
                      </strong>
                      . An invitation email was sent to{' '}
                      <strong>{createdTeacherResult.teacher.email}</strong> to set up their password.
                    </p>
                  </div>

                  {createdTeacherResult.activationLink && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-[#737373]">
                        Manual Activation Link (Testing / Fallback):
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          readOnly
                          value={createdTeacherResult.activationLink}
                          className="flex-1 rounded-md border border-[#E5E5E5] bg-[#F7F7F7] px-2.5 py-1.5 font-mono text-[10px] text-[#525252]"
                        />
                        <button
                          onClick={() => handleCopyActivation(createdTeacherResult.activationLink!)}
                          className="flex items-center gap-1 rounded-md border border-[#E5E5E5] px-2.5 py-1.5 text-[11px] font-medium text-[#171717] hover:border-[#171717]"
                        >
                          {copiedLink ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => setIsAddModalOpen(false)}
                      className="rounded-md bg-[#111111] px-4 py-2 text-xs font-medium text-white hover:bg-[#262626]"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreateTeacher} className="space-y-3 pt-4 text-xs">
                  {formError && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-red-800 flex items-center gap-2">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-[#171717] mb-1">
                        First Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        className="w-full rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#171717] mb-1">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        className="w-full rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#171717] mb-1">
                      Faculty Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="faculty@campusos.com"
                      className="w-full rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-[#171717] mb-1">
                        Department
                      </label>
                      <input
                        type="text"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        placeholder="e.g. Computer Science"
                        className="w-full rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#171717] mb-1">
                        Phone (optional)
                      </label>
                      <input
                        type="tel"
                        value={formData.phone || ''}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+1 555-0199"
                        className="w-full rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-[#737373] leading-relaxed pt-1">
                    A unique Teacher ID (e.g. TCH-2026-0001) will be generated automatically.
                    CampusOS will dispatch an invitation email allowing the faculty member to activate their portal account.
                  </p>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E5E5]">
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(false)}
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
                      <span>Save & Invite</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Modal: Assign Subject */}
        {isAssignModalOpen && selectedTeacherForAssign && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-[#E5E5E5]">
                <div className="flex items-center gap-2">
                  <BookOpen size={18} className="text-[#171717]" />
                  <div>
                    <h2 className="text-sm font-semibold text-[#171717]">
                      Assign Academic Coursework
                    </h2>
                    <p className="text-[11px] text-[#737373]">
                      Faculty: {selectedTeacherForAssign.first_name} {selectedTeacherForAssign.last_name} ({selectedTeacherForAssign.teacher_code})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAssignModalOpen(false)}
                  className="text-[#737373] hover:text-[#171717]"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAssignSubject} className="space-y-3 pt-4 text-xs">
                {assignError && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-red-800 flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{assignError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-medium text-[#171717] mb-1">
                    Course / Academic Program *
                  </label>
                  <select
                    value={assignCourseId}
                    onChange={(e) => setAssignCourseId(e.target.value)}
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
                    value={assignSubjectId}
                    onChange={(e) => setAssignSubjectId(e.target.value)}
                    required
                    className="w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} - {s.name} ({s.credits} credits)
                      </option>
                    ))}
                  </select>
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
                      value={assignSemester}
                      onChange={(e) => setAssignSemester(Number(e.target.value))}
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
                      value={assignSection}
                      onChange={(e) => setAssignSection(e.target.value.toUpperCase())}
                      className="w-full rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#171717] mb-1">
                      Academic Term *
                    </label>
                    <input
                      type="text"
                      value={assignTerm}
                      onChange={(e) => setAssignTerm(e.target.value)}
                      className="w-full rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E5E5]">
                  <button
                    type="button"
                    onClick={() => setIsAssignModalOpen(false)}
                    className="rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs font-medium text-[#525252] hover:bg-[#F7F7F7]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={assignSubmitting}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#111111] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#262626] disabled:opacity-50"
                  >
                    {assignSubmitting && <Loader2 size={13} className="animate-spin" />}
                    <span>Confirm Assignment</span>
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
