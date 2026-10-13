'use client';

import { X, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { AttendanceStatus } from '@/src/types/attendance';

interface BulkActionModalProps {
  isOpen: boolean;
  targetStatus: AttendanceStatus;
  totalVisible: number;
  alreadyMarkedCount: number;
  onConfirm: (mode: 'unmarked_only' | 'overwrite_all') => void;
  onClose: () => void;
}

export default function BulkActionModal({
  isOpen,
  targetStatus,
  totalVisible,
  alreadyMarkedCount,
  onConfirm,
  onClose,
}: BulkActionModalProps) {
  if (!isOpen) return null;

  const statusLabel = targetStatus === 'present' ? 'Present' : 'Absent';
  const hasExisting = alreadyMarkedCount > 0;
  const unmarkedCount = Math.max(0, totalVisible - alreadyMarkedCount);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-action-title"
    >
      <div className="relative w-full max-w-md rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#171717] text-white">
              {hasExisting ? <AlertTriangle size={15} /> : <CheckCircle2 size={16} />}
            </div>
            <div>
              <h3 id="bulk-action-title" className="text-base font-semibold text-[#171717]">
                Bulk Mark as {statusLabel}
              </h3>
              <p className="text-xs text-[#737373]">
                Applies to {totalVisible} visible eligible students
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[#737373] hover:text-[#171717] hover:bg-[#F7F7F7] transition-colors"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-3 text-xs text-[#737373] leading-relaxed">
          {hasExisting ? (
            <>
              <p>
                <span className="font-semibold text-[#171717]">{alreadyMarkedCount}</span> out of{' '}
                <span className="font-semibold text-[#171717]">{totalVisible}</span> visible students already have attendance recorded for this date.
              </p>
              <div className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-3 text-xs text-[#171717]">
                Please choose how you want to apply the bulk action:
              </div>
            </>
          ) : (
            <p>
              Are you sure you want to mark all <span className="font-semibold text-[#171717]">{totalVisible}</span> visible eligible students as <span className="font-semibold text-[#171717]">{statusLabel}</span>?
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-2 border-t border-[#E5E5E5] pt-4">
          {hasExisting ? (
            <>
              {/* Option 1: Safe unmarked only */}
              <button
                type="button"
                onClick={() => {
                  onConfirm('unmarked_only');
                  onClose();
                }}
                disabled={unmarkedCount === 0}
                className="w-full flex items-center justify-between rounded-md border border-[#171717] bg-[#171717] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#262626] transition-colors disabled:opacity-50"
              >
                <span>Mark Unmarked Only ({unmarkedCount} students)</span>
                <span className="text-[10px] bg-[#333333] px-2 py-0.5 rounded">Safe</span>
              </button>

              {/* Option 2: Overwrite all */}
              <button
                type="button"
                onClick={() => {
                  onConfirm('overwrite_all');
                  onClose();
                }}
                className="w-full flex items-center justify-between rounded-md border border-[#E5E5E5] bg-white px-4 py-2.5 text-xs font-medium text-[#171717] hover:bg-[#F7F7F7] transition-colors"
              >
                <span>Overwrite All ({totalVisible} students)</span>
                <span className="text-[10px] text-[#737373]">Replaces existing</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                onConfirm('overwrite_all');
                onClose();
              }}
              className="w-full rounded-md border border-[#171717] bg-[#171717] px-4 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors"
            >
              Confirm and Mark All {statusLabel}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-md border border-[#E5E5E5] bg-white px-4 py-2 text-xs font-medium text-[#737373] hover:text-[#171717] hover:bg-[#F7F7F7] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
