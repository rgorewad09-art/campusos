'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import type { Student } from '@/src/types/student';

interface DeleteConfirmModalProps {
  student: Student | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (studentId: string) => Promise<void>;
}

export default function DeleteConfirmModal({
  student,
  isOpen,
  onClose,
  onConfirm,
}: DeleteConfirmModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !student) return null;

  const fullName = [student.first_name, student.middle_name, student.last_name]
    .filter(Boolean)
    .join(' ');

  async function handleDelete() {
    if (!student) return;
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm(student.id);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete student.');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div className="relative w-full max-w-md rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#171717] bg-[#F7F7F7] text-[#171717]">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h2
                id="delete-dialog-title"
                className="text-base font-semibold text-[#171717]"
              >
                Delete Student Record
              </h2>
              <p className="text-xs text-[#737373]">Permanent action</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="rounded p-1 text-[#737373] hover:text-[#171717] transition-colors"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Warning text */}
        <div className="mt-4 rounded-md border border-[#E5E5E5] bg-[#F7F7F7] p-3 text-xs text-[#171717]">
          <p className="font-medium">
            You are about to delete:
          </p>
          <p className="mt-1 font-semibold text-sm">
            {fullName}{' '}
            <span className="font-mono text-xs font-normal text-[#737373]">
              ({student.student_code})
            </span>
          </p>
        </div>

        <p className="mt-3 text-xs text-[#737373] leading-relaxed">
          Warning: This action is permanent and cannot be undone. Removing this student profile
          may permanently delete or disassociate their attendance records, assignments, and submitted documents.
        </p>

        {error && (
          <div className="mt-3 rounded border border-[#171717] bg-[#F7F7F7] p-2 text-xs text-[#171717]">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#E5E5E5] pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-xs font-medium text-[#171717] hover:bg-[#F7F7F7] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-1.5 rounded-md border border-[#171717] bg-[#171717] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <span>Confirm & Delete Student</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
