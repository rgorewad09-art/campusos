'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Library,
  Layers,
  Calendar,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Edit2,
  Archive,
  RotateCcw,
} from 'lucide-react';
import AppShell from '@/app/components/AppShell';
import {
  getCoursesAction,
  getCourseByIdAction,
  createCourseAction,
  updateCourseAction,
  archiveCourseAction,
  getSubjectsAction,
  addSubjectToCourseAction,
  removeSubjectFromCourseAction,
} from '@/app/actions/academic';
import type { Course, CourseFormData, Subject, CourseSubject } from '@/src/types/academic';

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Create Course Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [courseForm, setCourseForm] = useState<CourseFormData>({
    code: '',
    name: '',
    department: 'Computer Applications',
    duration_years: 3,
    total_semesters: 6,
    description: '',
    status: 'active',
  });

  // Curriculum Management Modal
  const [isCurriculumModalOpen, setIsCurriculumModalOpen] = useState(false);
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [curriculum, setCurriculum] = useState<CourseSubject[]>([]);
  const [selectedSemester, setSelectedSemester] = useState(1);
  const [addSubjectId, setAddSubjectId] = useState('');
  const [isMandatory, setIsMandatory] = useState(true);
  const [electiveGroup, setElectiveGroup] = useState('');
  const [curriculumLoading, setCurriculumLoading] = useState(false);

  const fetchCourses = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [cRes, sRes] = await Promise.all([
        getCoursesAction(),
        getSubjectsAction(),
      ]);

      if (cRes.success && cRes.courses) {
        setCourses(cRes.courses);
      } else {
        setErrorMessage(cRes.error || 'Failed to load courses.');
      }

      if (sRes.success && sRes.subjects) {
        setSubjects(sRes.subjects);
        if (sRes.subjects.length > 0) setAddSubjectId(sRes.subjects[0].id);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error loading courses.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  async function handleCreateCourse(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await createCourseAction(courseForm);
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to create course.');
      } else {
        setIsCreateModalOpen(false);
        setSuccessBanner(`Course ${courseForm.code} - ${courseForm.name} created successfully.`);
        fetchCourses();
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create course.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function openCurriculumModal(course: Course) {
    setActiveCourse(course);
    setSelectedSemester(1);
    setIsCurriculumModalOpen(true);
    setCurriculumLoading(true);

    try {
      const res = await getCourseByIdAction(course.id);
      if (res.success && res.curriculum) {
        setCurriculum(res.curriculum);
      }
    } catch (err) {
      console.error('Error fetching curriculum:', err);
    } finally {
      setCurriculumLoading(false);
    }
  }

  async function handleAddCurriculumSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCourse || !addSubjectId) return;

    try {
      const res = await addSubjectToCourseAction({
        course_id: activeCourse.id,
        subject_id: addSubjectId,
        semester: selectedSemester,
        is_mandatory: isMandatory,
        elective_group: electiveGroup.trim() || undefined,
      });

      if (!res.success) {
        alert(res.error || 'Failed to add subject.');
      } else {
        // Refresh curriculum
        const refreshed = await getCourseByIdAction(activeCourse.id);
        if (refreshed.success && refreshed.curriculum) {
          setCurriculum(refreshed.curriculum);
        }
        fetchCourses();
      }
    } catch (err) {
      alert('Error adding subject to curriculum.');
    }
  }

  async function handleRemoveCurriculumSubject(id: string) {
    if (!activeCourse) return;
    try {
      const res = await removeSubjectFromCourseAction(id);
      if (res.success) {
        const refreshed = await getCourseByIdAction(activeCourse.id);
        if (refreshed.success && refreshed.curriculum) {
          setCurriculum(refreshed.curriculum);
        }
        fetchCourses();
      } else {
        alert(res.error || 'Failed to remove subject.');
      }
    } catch {
      alert('Error removing subject.');
    }
  }

  async function handleToggleArchive(course: Course) {
    try {
      const res = await archiveCourseAction(course.id);
      if (res.success) {
        fetchCourses();
      } else {
        alert(res.error || 'Failed to toggle status.');
      }
    } catch {
      alert('Error toggling status.');
    }
  }

  const semesterCurriculum = curriculum.filter((c) => c.semester === selectedSemester);

  return (
    <AppShell pageTitle="Academic Programs & Courses">
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

        {/* Action Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#171717]">Academic Course Catalog</h2>
            <p className="text-xs text-[#737373]">
              Configure degree programs, duration, semester mappings, and subject curriculums.
            </p>
          </div>
          <button
            onClick={() => {
              setCourseForm({
                code: '',
                name: '',
                department: 'Computer Applications',
                duration_years: 3,
                total_semesters: 6,
                description: '',
                status: 'active',
              });
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#111111] px-4 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors"
          >
            <Plus size={14} />
            <span>Create Course</span>
          </button>
        </div>

        {/* Courses Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {isLoading ? (
            <div className="col-span-full py-12 text-center text-xs text-[#737373]">
              <Loader2 size={18} className="animate-spin inline mr-2 text-[#171717]" />
              Loading courses...
            </div>
          ) : courses.length === 0 ? (
            <div className="col-span-full rounded-xl border border-[#E5E5E5] bg-white p-12 text-center text-xs text-[#737373]">
              <BookOpen size={32} className="mx-auto mb-2 text-[#A3A3A3]" />
              <p className="font-medium text-[#171717]">No courses configured</p>
              <p className="text-[11px] mt-1">Create programs like BCA, BBA, B.Com, or B.Sc. to begin.</p>
            </div>
          ) : (
            courses.map((course) => (
              <div
                key={course.id}
                className="rounded-xl border border-[#E5E5E5] bg-white p-5 shadow-xs flex flex-col justify-between hover:border-[#171717] transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-[#171717]">
                        {course.code}
                      </span>
                      <h3 className="text-sm font-semibold text-[#171717] mt-0.5">
                        {course.name}
                      </h3>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        course.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                      }`}
                    >
                      {course.status}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-[#737373] line-clamp-2">
                    {course.description || `${course.department} Department program.`}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#F0F0F0] pt-3 text-[11px] text-[#525252]">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-[#A3A3A3]" />
                      <span>{course.duration_years} Years ({course.total_semesters} Sem)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Library size={13} className="text-[#A3A3A3]" />
                      <span>{course.subjects_count || 0} Subjects Mapped</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-[#F0F0F0] pt-3">
                  <button
                    onClick={() => openCurriculumModal(course)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#111111] hover:underline"
                  >
                    <Layers size={13} />
                    <span>Manage Curriculum</span>
                  </button>
                  <button
                    onClick={() => handleToggleArchive(course)}
                    title={course.status === 'active' ? 'Archive program' : 'Activate program'}
                    className="text-[#737373] hover:text-[#171717] transition-colors"
                  >
                    {course.status === 'active' ? <Archive size={14} /> : <RotateCcw size={14} />}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal: Create Course */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-[#E5E5E5]">
                <div className="flex items-center gap-2">
                  <BookOpen size={18} className="text-[#171717]" />
                  <h2 className="text-sm font-semibold text-[#171717]">Create Academic Program</h2>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-[#737373] hover:text-[#171717]"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateCourse} className="space-y-3 pt-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#171717] mb-1">
                      Course Code *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. BCA"
                      value={courseForm.code}
                      onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value.toUpperCase() })}
                      className="w-full rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#171717] mb-1">
                      Department *
                    </label>
                    <input
                      type="text"
                      required
                      value={courseForm.department}
                      onChange={(e) => setCourseForm({ ...courseForm, department: e.target.value })}
                      className="w-full rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#171717] mb-1">
                    Course Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bachelor of Computer Applications"
                    value={courseForm.name}
                    onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
                    className="w-full rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#171717] mb-1">
                      Duration (Years) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={6}
                      required
                      value={courseForm.duration_years}
                      onChange={(e) => setCourseForm({ ...courseForm, duration_years: Number(e.target.value) })}
                      className="w-full rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#171717] mb-1">
                      Total Semesters *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      required
                      value={courseForm.total_semesters}
                      onChange={(e) => setCourseForm({ ...courseForm, total_semesters: Number(e.target.value) })}
                      className="w-full rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#171717] mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    rows={2}
                    value={courseForm.description}
                    onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                    className="w-full rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E5E5]">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
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
                    <span>Save Course</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Curriculum Management */}
        {isCurriculumModalOpen && activeCourse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-2xl rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-[#E5E5E5]">
                <div className="flex items-center gap-2">
                  <Layers size={18} className="text-[#171717]" />
                  <div>
                    <h2 className="text-sm font-semibold text-[#171717]">
                      Curriculum: {activeCourse.code} - {activeCourse.name}
                    </h2>
                    <p className="text-[11px] text-[#737373]">
                      Define mandatory and elective subjects across all {activeCourse.total_semesters} semesters.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCurriculumModalOpen(false)}
                  className="text-[#737373] hover:text-[#171717]"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Semester Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto border-b border-[#E5E5E5] py-2 mt-2">
                {Array.from({ length: activeCourse.total_semesters }, (_, i) => i + 1).map((sem) => (
                  <button
                    key={sem}
                    onClick={() => setSelectedSemester(sem)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      selectedSemester === sem
                        ? 'bg-[#111111] text-white'
                        : 'text-[#737373] hover:bg-[#F7F7F7] hover:text-[#171717]'
                    }`}
                  >
                    Sem {sem}
                  </button>
                ))}
              </div>

              {/* Add Subject to Semester Form */}
              <form onSubmit={handleAddCurriculumSubject} className="mt-4 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-medium text-[#737373] mb-1">
                      Select Subject to Add to Sem {selectedSemester}
                    </label>
                    <select
                      value={addSubjectId}
                      onChange={(e) => setAddSubjectId(e.target.value)}
                      required
                      className="w-full rounded-md border border-[#E5E5E5] bg-white px-2.5 py-1 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    >
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code} - {s.name} ({s.credits} cr)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-[#737373] mb-1">
                      Subject Type
                    </label>
                    <select
                      value={isMandatory ? 'true' : 'false'}
                      onChange={(e) => setIsMandatory(e.target.value === 'true')}
                      className="w-full rounded-md border border-[#E5E5E5] bg-white px-2.5 py-1 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    >
                      <option value="true">Mandatory</option>
                      <option value="false">Elective</option>
                    </select>
                  </div>
                  <div>
                    <button
                      type="submit"
                      className="w-full rounded-md bg-[#111111] py-1 text-xs font-medium text-white hover:bg-[#262626]"
                    >
                      + Add to Sem {selectedSemester}
                    </button>
                  </div>
                </div>
              </form>

              {/* Mapped Subjects List */}
              <div className="mt-4 max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E5E5E5] text-[10px] uppercase tracking-wider text-[#737373]">
                    <tr>
                      <th className="py-2">Code</th>
                      <th className="py-2">Subject Name</th>
                      <th className="py-2">Credits</th>
                      <th className="py-2">Requirement</th>
                      <th className="py-2 text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0F0]">
                    {semesterCurriculum.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-[#737373]">
                          No subjects mapped to Semester {selectedSemester} yet.
                        </td>
                      </tr>
                    ) : (
                      semesterCurriculum.map((cs) => (
                        <tr key={cs.id} className="hover:bg-[#FAFAFA]">
                          <td className="py-2.5 font-mono font-medium text-[#171717]">
                            {cs.subject?.code}
                          </td>
                          <td className="py-2.5 text-[#171717]">
                            {cs.subject?.name}
                          </td>
                          <td className="py-2.5 text-[#525252]">
                            {cs.subject?.credits}
                          </td>
                          <td className="py-2.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                                cs.is_mandatory
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-purple-50 text-purple-700 border border-purple-200'
                              }`}
                            >
                              {cs.is_mandatory ? 'Mandatory' : 'Elective'}
                            </span>
                          </td>
                          <td className="py-2.5 text-right">
                            <button
                              onClick={() => handleRemoveCurriculumSubject(cs.id)}
                              className="text-[#A3A3A3] hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 flex justify-end border-t border-[#E5E5E5] pt-3">
                <button
                  onClick={() => setIsCurriculumModalOpen(false)}
                  className="rounded-md bg-[#111111] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#262626]"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
