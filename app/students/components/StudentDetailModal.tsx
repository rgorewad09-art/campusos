'use client';

import Link from 'next/link';
import { X, Edit2, Trash2, Calendar, Mail, Phone, Hash, Clock, ArrowUpRight } from 'lucide-react';
import type { Student } from '@/src/types/student';
import StatusBadge from './StatusBadge';

interface StudentDetailModalProps {
  student: Student | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (student: Student) => void;
  onDelete: (student: Student) => void;
}

export default function StudentDetailModal({
  student,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}: StudentDetailModalProps) {
  if (!isOpen || !student) return null;

  const fullName = [student.first_name, student.middle_name, student.last_name]
    .filter(Boolean)
    .join(' ');

  const initials = `${student.first_name?.[0] || ''}${student.last_name?.[0] || ''}`.toUpperCase();

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-detail-title"
    >
      <div className="relative w-full max-w-lg rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#171717] text-sm font-semibold text-white">
              {initials}
            </div>
            <div>
              <h2
                id="student-detail-title"
                className="text-base font-semibold text-[#171717]"
              >
                {fullName}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-xs font-medium text-[#737373]">
                  {student.student_code}
                </span>
                <StatusBadge status={student.status} />
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-[#737373] hover:text-[#171717] transition-colors"
            aria-label="Close details"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content details grid */}
        <div className="mt-6 space-y-5">
          {/* Identification & Academic */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#737373] mb-3">
              Academic Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-3">
                <span className="flex items-center gap-1.5 text-[#737373] mb-1">
                  <Hash size={13} />
                  <span>Student Code</span>
                </span>
                <span className="font-mono font-medium text-sm text-[#171717]">
                  {student.student_code}
                </span>
              </div>
              <div className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-3">
                <span className="flex items-center gap-1.5 text-[#737373] mb-1">
                  <Calendar size={13} />
                  <span>Enrollment Date</span>
                </span>
                <span className="font-medium text-sm text-[#171717]">
                  {formatDate(student.enrollment_date)}
                </span>
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#737373] mb-3">
              Personal & Contact Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-[#E5E5E5] bg-white p-3">
                <span className="flex items-center gap-1.5 text-[#737373] mb-1">
                  <Calendar size={13} />
                  <span>Date of Birth</span>
                </span>
                <span className="font-medium text-[#171717]">
                  {formatDate(student.date_of_birth)}
                </span>
              </div>
              <div className="rounded-lg border border-[#E5E5E5] bg-white p-3">
                <span className="flex items-center gap-1.5 text-[#737373] mb-1">
                  <Mail size={13} />
                  <span>Email Address</span>
                </span>
                <span className="font-medium text-[#171717] break-all">
                  {student.email || 'Not provided'}
                </span>
              </div>
              <div className="rounded-lg border border-[#E5E5E5] bg-white p-3">
                <span className="flex items-center gap-1.5 text-[#737373] mb-1">
                  <Phone size={13} />
                  <span>Phone Number</span>
                </span>
                <span className="font-medium text-[#171717]">
                  {student.phone || 'Not provided'}
                </span>
              </div>
              <div className="rounded-lg border border-[#E5E5E5] bg-white p-3">
                <span className="flex items-center gap-1.5 text-[#737373] mb-1">
                  <Clock size={13} />
                  <span>Record Created</span>
                </span>
                <span className="font-medium text-[#171717]">
                  {formatDate(student.created_at)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-8 flex items-center justify-between border-t border-[#E5E5E5] pt-4">
          <button
            type="button"
            onClick={() => {
              onClose();
              onDelete(student);
            }}
            className="flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium text-[#737373] hover:text-[#171717] hover:bg-[#F7F7F7] transition-colors"
          >
            <Trash2 size={13} />
            <span>Delete Student</span>
          </button>

          <div className="flex items-center gap-2">
            <Link
              href={`/students/${student.id}`}
              onClick={onClose}
              className="flex items-center gap-1 rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-xs font-medium text-[#171717] hover:bg-[#F7F7F7] transition-colors"
            >
              <span>Full Profile & Guardians</span>
              <ArrowUpRight size={13} />
            </Link>
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(student);
              }}
              className="flex items-center gap-1.5 rounded-md border border-[#171717] bg-[#171717] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors"
            >
              <Edit2 size={13} />
              <span>Edit Details</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
