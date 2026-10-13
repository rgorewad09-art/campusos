'use client';

import { useState } from 'react';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import type { StudentGuardianLink } from '@/src/types/guardian';
import { unlinkGuardianAction } from '@/app/actions/guardians';

interface UnlinkGuardianModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  studentId: string;
  studentName: string;
  link: StudentGuardianLink | null;
}

export default function UnlinkGuardianModal({
  isOpen,
  onClose,
  onSuccess,
  studentId,
  studentName,
  link,
}: UnlinkGuardianModalProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !link || !link.guardians) return null;

  const guardianName = link.guardians.full_name;

  async function handleUnlink() {
    if (!link) return;
    setIsRemoving(true);
    setError(null);
    try {
      const res = await unlinkGuardianAction(studentId, link.guardian_id);
      if (!res.success) {
        setError(res.error || 'Failed to remove guardian.');
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unlink-dialog-title"
    >
      <div className="relative w-full max-w-md rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#171717] bg-[#F7F7F7] text-[#171717]">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h2 id="unlink-dialog-title" className="text-base font-semibold text-[#171717]">
                Remove Guardian Relationship
              </h2>
              <p className="text-xs text-[#737373]">Unlink contact</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isRemoving}
            className="rounded p-1 text-[#737373] hover:text-[#171717] transition-colors"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 rounded-md border border-[#E5E5E5] bg-[#F7F7F7] p-3 text-xs text-[#171717]">
          <p className="text-[#737373]">Student:</p>
          <p className="font-semibold text-[#171717]">{studentName}</p>
          <p className="mt-2 text-[#737373]">Guardian to unlink:</p>
          <p className="font-semibold text-[#171717]">{guardianName}</p>
        </div>

        <p className="mt-3 text-xs text-[#737373] leading-relaxed">
          This will unlink <strong>{guardianName}</strong> from <strong>{studentName}</strong>. The guardian record will remain saved in the system, but will no longer appear on this student's profile.
        </p>

        {error && (
          <div className="mt-3 rounded border border-[#171717] bg-[#F7F7F7] p-2 text-xs text-[#171717]">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#E5E5E5] pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isRemoving}
            className="rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-xs font-medium text-[#171717] hover:bg-[#F7F7F7] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUnlink}
            disabled={isRemoving}
            className="flex items-center gap-1.5 rounded-md border border-[#171717] bg-[#171717] px-4 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors disabled:opacity-50"
          >
            {isRemoving ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Removing...</span>
              </>
            ) : (
              <span>Confirm & Remove Link</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
