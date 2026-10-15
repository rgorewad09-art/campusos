'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Library,
  Plus,
  Search,
  BookOpen,
  Edit2,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import AppShell from '@/app/components/AppShell';
import {
  getSubjectsAction,
  createSubjectAction,
  updateSubjectAction,
} from '@/app/actions/academic';
import type { Subject, SubjectFormData } from '@/src/types/academic';

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subjectForm, setSubjectForm] = useState<SubjectFormData>({
    code: '',
    name: '',
    department: 'Computer Science',
    credits: 4,
    description: '',
    status: 'active',
  });

  const fetchSubjects = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await getSubjectsAction();
      if (res.success && res.subjects) {
        setSubjects(res.subjects);
      } else {
        setErrorMessage(res.error || 'Failed to load subjects.');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error fetching subjects.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (editingSubject) {
        const res = await updateSubjectAction(editingSubject.id, subjectForm);
        if (!res.success) {
          setErrorMessage(res.error || 'Failed to update subject.');
        } else {
          setIsModalOpen(false);
          setSuccessBanner(`Subject ${subjectForm.code} updated successfully.`);
          fetchSubjects();
        }
      } else {
        const res = await createSubjectAction(subjectForm);
        if (!res.success) {
          setErrorMessage(res.error || 'Failed to create subject.');
        } else {
          setIsModalOpen(false);
          setSuccessBanner(`Subject ${subjectForm.code} created successfully.`);
          fetchSubjects();
        }
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error submitting subject.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const filtered = subjects.filter(
    (s) =>
      s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppShell pageTitle="Academic Subjects Catalog">
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

        {/* Top Control Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737373]"
            />
            <input
              type="text"
              placeholder="Search subjects by code or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-[#E5E5E5] bg-white py-2 pl-9 pr-4 text-xs text-[#171717] placeholder:text-[#A3A3A3] focus:border-[#171717] focus:outline-none"
            />
          </div>

          <button
            onClick={() => {
              setEditingSubject(null);
              setSubjectForm({
                code: '',
                name: '',
                department: 'Computer Science',
                credits: 4,
                description: '',
                status: 'active',
              });
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#111111] px-4 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors"
          >
            <Plus size={14} />
            <span>Add Subject</span>
          </button>
        </div>

        {/* Subjects Table */}
        <div className="rounded-xl border border-[#E5E5E5] bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E5E5E5] bg-[#FAFAFA] text-[#737373] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-3">Subject Code</th>
                  <th className="px-6 py-3">Title</th>
                  <th className="px-6 py-3">Department</th>
                  <th className="px-6 py-3">Credits</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-[#737373]">
                      <Loader2 size={18} className="animate-spin inline mr-2 text-[#171717]" />
                      Loading subjects...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-[#737373]">
                      <Library size={32} className="mx-auto mb-2 text-[#A3A3A3]" />
                      <p className="font-medium text-[#171717]">No subjects found</p>
                      <p className="text-[11px] mt-1">Add academic subjects to map into course curriculums.</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((subject) => (
                    <tr key={subject.id} className="hover:bg-[#FAFAFA] transition-colors">
                      <td className="px-6 py-3.5 font-mono font-medium text-[#171717]">
                        {subject.code}
                      </td>
                      <td className="px-6 py-3.5 font-medium text-[#171717]">
                        {subject.name}
                      </td>
                      <td className="px-6 py-3.5 text-[#525252]">
                        {subject.department}
                      </td>
                      <td className="px-6 py-3.5 text-[#525252]">
                        {subject.credits} Credits
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                            subject.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                          }`}
                        >
                          {subject.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={() => {
                            setEditingSubject(subject);
                            setSubjectForm({
                              code: subject.code,
                              name: subject.name,
                              department: subject.department,
                              credits: subject.credits,
                              description: subject.description || '',
                              status: subject.status,
                            });
                            setIsModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 rounded border border-[#E5E5E5] bg-white px-2 py-1 text-[11px] font-medium text-[#171717] hover:border-[#171717] transition-colors"
                        >
                          <Edit2 size={11} />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Create / Edit Subject */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-[#E5E5E5]">
                <div className="flex items-center gap-2">
                  <Library size={18} className="text-[#171717]" />
                  <h2 className="text-sm font-semibold text-[#171717]">
                    {editingSubject ? 'Edit Subject' : 'Add Academic Subject'}
                  </h2>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-[#737373] hover:text-[#171717]"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3 pt-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#171717] mb-1">
                      Subject Code *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CS101"
                      value={subjectForm.code}
                      onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value.toUpperCase() })}
                      className="w-full rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#171717] mb-1">
                      Credits *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      required
                      value={subjectForm.credits}
                      onChange={(e) => setSubjectForm({ ...subjectForm, credits: Number(e.target.value) })}
                      className="w-full rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#171717] mb-1">
                    Subject Name / Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Database Management Systems"
                    value={subjectForm.name}
                    onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
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
                    value={subjectForm.department}
                    onChange={(e) => setSubjectForm({ ...subjectForm, department: e.target.value })}
                    className="w-full rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#171717] mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    rows={2}
                    value={subjectForm.description}
                    onChange={(e) => setSubjectForm({ ...subjectForm, description: e.target.value })}
                    className="w-full rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                  />
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
                    <span>{editingSubject ? 'Update Subject' : 'Save Subject'}</span>
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
