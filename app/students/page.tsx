'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import Link from 'next/link';
import {
  UserPlus,
  Search,
  RotateCw,
  Eye,
  Edit2,
  Trash2,
  Users,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  X,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import StatusBadge from './components/StatusBadge';
import StudentFormModal from './components/StudentFormModal';
import StudentDetailModal from './components/StudentDetailModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import { getStudentsAction, deleteStudentAction } from '@/app/actions/students';
import type { Student, StudentStatus } from '@/src/types/student';
import StudentListSkeleton from '@/src/components/skeletons/StudentListSkeleton';

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<'enroll' | 'edit'>('enroll');
  const [selectedStudentForForm, setSelectedStudentForForm] = useState<Student | null>(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<Student | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedStudentForDelete, setSelectedStudentForDelete] = useState<Student | null>(null);

  const [, startTransition] = useTransition();

  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await getStudentsAction({
        search: searchQuery,
        status: selectedStatus,
        page: currentPage,
        pageSize,
      });

      if (!result.success || !result.data) {
        setErrorMessage(result.error || 'Failed to load student directory.');
      } else {
        setStudents(result.data.students);
        setTotalCount(result.data.totalCount);
        setTotalPages(result.data.totalPages || 1);
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'An error occurred while loading students.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedStatus, currentPage, pageSize]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  function handleOpenEnroll() {
    setSelectedStudentForForm(null);
    setFormMode('enroll');
    setIsFormModalOpen(true);
  }

  function handleOpenEdit(student: Student) {
    setSelectedStudentForForm(student);
    setFormMode('edit');
    setIsFormModalOpen(true);
  }

  function handleOpenDetail(student: Student) {
    setSelectedStudentForDetail(student);
    setIsDetailModalOpen(true);
  }

  function handleOpenDelete(student: Student) {
    setSelectedStudentForDelete(student);
    setIsDeleteModalOpen(true);
  }

  async function handleConfirmDelete(studentId: string) {
    const result = await deleteStudentAction(studentId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete student.');
    }
    // Refresh student list
    fetchStudents();
  }

  function handleFormSuccess() {
    fetchStudents();
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return '—';
    const clean = dateStr.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      const m = parseInt(month, 10) - 1;
      if (m >= 0 && m < 12) {
        return `${monthNames[m]} ${parseInt(day, 10)}, ${year}`;
      }
    }
    return dateStr;
  }

  return (
    <AppShell pageTitle="Students">
      <div className="flex flex-col gap-6">
        {/* Top Header & Enroll Action */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[#171717]">
              Student Directory
            </h1>
            <p className="mt-0.5 text-xs text-[#737373]">
              Manage enrolled student records, profiles, and academic status.
            </p>
          </div>

          <button
            onClick={handleOpenEnroll}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-[#111111] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#262626] transition-colors self-start sm:self-auto"
          >
            <UserPlus size={15} />
            <span>Enroll Student</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-lg border border-[#E5E5E5] bg-white p-3">
          <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737373]"
              />
              <input
                type="text"
                placeholder="Search by student ID, first or last name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-md border border-[#E5E5E5] bg-white py-1.5 pl-9 pr-8 text-xs text-[#171717] placeholder:text-[#A3A3A3] focus:border-[#171717] focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#171717]"
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Status Filter Dropdown */}
            <div className="flex items-center gap-2">
              <label htmlFor="status-filter" className="text-xs text-[#737373] shrink-0 hidden sm:inline">
                Status:
              </label>
              <select
                id="status-filter"
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-md border border-[#E5E5E5] bg-white px-2.5 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none transition-colors"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
                <option value="graduated">Graduated</option>
              </select>
            </div>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchStudents()}
            disabled={isLoading}
            className="flex items-center justify-center gap-1.5 rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs font-medium text-[#737373] hover:text-[#171717] hover:border-[#171717] transition-colors disabled:opacity-50"
            aria-label="Refresh student list"
          >
            <RotateCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Error State */}
        {errorMessage && (
          <div className="flex items-start gap-3 rounded-lg border border-[#171717] bg-white p-4 text-xs text-[#171717]">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-[#171717]" />
            <div className="flex-1">
              <p className="font-semibold">Unable to load students</p>
              <p className="mt-0.5 text-[#737373]">{errorMessage}</p>
            </div>
            <button
              onClick={() => fetchStudents()}
              className="rounded border border-[#171717] bg-[#171717] px-2.5 py-1 text-xs text-white hover:bg-[#262626] transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && <StudentListSkeleton rows={pageSize} />}

        {/* Empty State */}
        {!isLoading && !errorMessage && students.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-[#E5E5E5] bg-white py-16 px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F7F7] text-[#737373] mb-3">
              <Users size={22} />
            </div>
            <h3 className="text-sm font-semibold text-[#171717]">
              {searchQuery || selectedStatus !== 'all'
                ? 'No matching students found'
                : 'No student records yet'}
            </h3>
            <p className="mt-1 max-w-sm text-xs text-[#737373]">
              {searchQuery || selectedStatus !== 'all'
                ? 'Try adjusting your search criteria or clearing filters to view all records.'
                : 'Get started by enrolling the first student into the CampusOS platform.'}
            </p>
            {searchQuery || selectedStatus !== 'all' ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedStatus('all');
                }}
                className="mt-4 rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#F7F7F7] transition-colors"
              >
                Clear Filters
              </button>
            ) : (
              <button
                onClick={handleOpenEnroll}
                className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[#111111] px-4 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors"
              >
                <UserPlus size={14} />
                <span>Enroll First Student</span>
              </button>
            )}
          </div>
        )}

        {/* Student Records List */}
        {!isLoading && !errorMessage && students.length > 0 && (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block rounded-lg border border-[#E5E5E5] bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E5E5E5] bg-[#F7F7F7] text-[#737373] uppercase font-semibold tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Student ID</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Contact</th>
                      <th className="py-3 px-4">Enrollment Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5E5]">
                    {students.map((student) => {
                      const fullName = [
                        student.first_name,
                        student.middle_name,
                        student.last_name,
                      ]
                        .filter(Boolean)
                        .join(' ');
                      const initials = `${student.first_name?.[0] || ''}${
                        student.last_name?.[0] || ''
                      }`.toUpperCase();

                      return (
                        <tr
                          key={student.id}
                          className="hover:bg-[#FAFAFA] transition-colors"
                        >
                          <td className="py-3.5 px-4 font-mono font-medium text-[#171717]">
                            <Link
                              href={`/students/${student.id}`}
                              className="hover:underline"
                            >
                              {student.student_code}
                            </Link>
                          </td>
                          <td className="py-3.5 px-4">
                            <Link
                              href={`/students/${student.id}`}
                              className="flex items-center gap-2.5 group"
                            >
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#171717] text-[11px] font-semibold text-white select-none">
                                {initials}
                              </div>
                              <span className="font-medium text-[#171717] group-hover:underline">
                                {fullName}
                              </span>
                            </Link>
                          </td>
                          <td className="py-3.5 px-4 text-[#737373]">
                            <div>{student.email || '—'}</div>
                            {student.phone && (
                              <div className="text-[11px] text-[#A3A3A3] mt-0.5">
                                {student.phone}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-[#737373]">
                            {formatDate(student.enrollment_date)}
                          </td>
                          <td className="py-3.5 px-4">
                            <StatusBadge status={student.status} />
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Link
                                href={`/students/${student.id}`}
                                className="rounded p-1.5 text-[#737373] hover:text-[#171717] hover:bg-[#F0F0F0] transition-colors"
                                title="View Full Profile"
                                aria-label={`View profile for ${fullName}`}
                              >
                                <Eye size={14} />
                              </Link>
                              <button
                                onClick={() => handleOpenEdit(student)}
                                className="rounded p-1.5 text-[#737373] hover:text-[#171717] hover:bg-[#F0F0F0] transition-colors"
                                title="Edit Student"
                                aria-label={`Edit ${fullName}`}
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleOpenDelete(student)}
                                className="rounded p-1.5 text-[#737373] hover:text-[#171717] hover:bg-[#F0F0F0] transition-colors"
                                title="Delete Student"
                                aria-label={`Delete ${fullName}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card List View (Strictly Responsive without horizontal overflow) */}
            <div className="md:hidden space-y-3">
              {students.map((student) => {
                const fullName = [
                  student.first_name,
                  student.middle_name,
                  student.last_name,
                ]
                  .filter(Boolean)
                  .join(' ');
                const initials = `${student.first_name?.[0] || ''}${
                  student.last_name?.[0] || ''
                }`.toUpperCase();

                return (
                  <div
                    key={student.id}
                    className="rounded-lg border border-[#E5E5E5] bg-white p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <Link
                        href={`/students/${student.id}`}
                        className="flex items-center gap-2.5"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#171717] text-xs font-semibold text-white select-none">
                          {initials}
                        </div>
                        <div>
                          <p className="font-semibold text-xs text-[#171717] hover:underline">
                            {fullName}
                          </p>
                          <p className="font-mono text-[11px] text-[#737373]">
                            {student.student_code}
                          </p>
                        </div>
                      </Link>
                      <StatusBadge status={student.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] border-t border-b border-[#F0F0F0] py-2">
                      <div>
                        <span className="text-[#737373]">Enrolled:</span>{' '}
                        <span className="text-[#171717] font-medium">
                          {formatDate(student.enrollment_date)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#737373]">Contact:</span>{' '}
                        <span className="text-[#171717] font-medium truncate block">
                          {student.email || student.phone || '—'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Link
                        href={`/students/${student.id}`}
                        className="inline-flex items-center gap-1 rounded border border-[#E5E5E5] px-2.5 py-1 text-[11px] font-medium text-[#171717] hover:bg-[#F7F7F7] transition-colors"
                      >
                        <Eye size={12} />
                        <span>Profile</span>
                      </Link>
                      <button
                        onClick={() => handleOpenEdit(student)}
                        className="inline-flex items-center gap-1 rounded border border-[#E5E5E5] px-2.5 py-1 text-[11px] font-medium text-[#171717] hover:bg-[#F7F7F7] transition-colors"
                      >
                        <Edit2 size={12} />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleOpenDelete(student)}
                        className="inline-flex items-center gap-1 rounded border border-[#171717] bg-[#171717] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#262626] transition-colors"
                      >
                        <Trash2 size={12} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#E5E5E5] pt-4 text-xs text-[#737373]">
              <p>
                Showing{' '}
                <span className="font-semibold text-[#171717]">
                  {Math.min((currentPage - 1) * pageSize + 1, totalCount)}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-[#171717]">
                  {Math.min(currentPage * pageSize, totalCount)}
                </span>{' '}
                of{' '}
                <span className="font-semibold text-[#171717]">{totalCount}</span>{' '}
                students
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1 || isLoading}
                  className="flex items-center gap-1 rounded-md border border-[#E5E5E5] bg-white px-2.5 py-1 text-xs font-medium text-[#171717] hover:bg-[#F7F7F7] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={13} />
                  <span>Previous</span>
                </button>

                <span className="px-2 text-xs font-medium text-[#171717]">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages || isLoading}
                  className="flex items-center gap-1 rounded-md border border-[#E5E5E5] bg-white px-2.5 py-1 text-xs font-medium text-[#171717] hover:bg-[#F7F7F7] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>Next</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Enrollment & Edit Modal */}
      <StudentFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSuccess={handleFormSuccess}
        initialData={selectedStudentForForm}
        mode={formMode}
      />

      {/* Details View Modal */}
      <StudentDetailModal
        student={selectedStudentForDetail}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        onEdit={(student) => {
          setSelectedStudentForDetail(null);
          handleOpenEdit(student);
        }}
        onDelete={(student) => {
          setSelectedStudentForDetail(null);
          handleOpenDelete(student);
        }}
      />

      {/* Explicit Delete Confirmation Dialog */}
      <DeleteConfirmModal
        student={selectedStudentForDelete}
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </AppShell>
  );
}
