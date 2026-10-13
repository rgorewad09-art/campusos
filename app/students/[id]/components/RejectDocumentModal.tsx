'use client';

import { useState } from 'react';
import { X, AlertOctagon, Loader2, AlertCircle } from 'lucide-react';
import { rejectDocumentAction } from '@/app/actions/documents';
import { DOCUMENT_CATEGORIES, type StudentDocument } from '@/src/types/document';

interface RejectDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: StudentDocument) => void;
  document: StudentDocument | null;
  studentName: string;
}

export default function RejectDocumentModal({
  isOpen,
  onClose,
  onSuccess,
  document: doc,
  studentName,
}: RejectDocumentModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !doc) return null;

  const categoryLabel =
    DOCUMENT_CATEGORIES.find((c) => c.value === doc.document_type)?.label ||
    doc.document_type;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!doc) return;
    setError(null);

    const trimmed = reason.trim();
    if (!trimmed) {
      setError('Please provide a specific reason for rejecting this document.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await rejectDocumentAction(doc.id, trimmed);
      if (!res.success || !res.document) {
        setError(res.error || 'Failed to reject document.');
      } else {
        onSuccess(res.document);
        handleClose();
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    if (isSubmitting) return;
    setReason('');
    setError(null);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-doc-title"
    >
      <div className="relative w-full max-w-md rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#171717] text-white">
              <AlertOctagon size={16} />
            </div>
            <div>
              <h3 id="reject-doc-title" className="text-base font-semibold text-[#171717]">
                Reject Document
              </h3>
              <p className="text-xs text-[#737373]">
                {categoryLabel} for {studentName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded p-1 text-[#737373] hover:text-[#171717] hover:bg-[#F7F7F7] transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-[#171717] bg-[#F7F7F7] p-3 text-xs text-[#171717]">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-[#171717]" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="rejection-reason"
              className="block text-xs font-medium text-[#171717] mb-1.5"
            >
              Rejection Reason <span className="font-bold">*</span>
            </label>
            <textarea
              id="rejection-reason"
              rows={4}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting}
              placeholder="e.g. Document is expired, image is blurry, or name does not match enrollment record."
              className="w-full rounded-md border border-[#E5E5E5] bg-white p-3 text-xs text-[#171717] placeholder:text-[#A3A3A3] focus:border-[#171717] focus:outline-none transition-colors"
            />
            <p className="mt-1 text-[11px] text-[#737373]">
              This reason will be recorded in the audit trail and visible to administrators reviewing this profile.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-[#E5E5E5] pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-md border border-[#E5E5E5] bg-white px-4 py-2 text-xs font-medium text-[#171717] hover:bg-[#F7F7F7] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              className="flex items-center gap-1.5 rounded-md border border-[#171717] bg-[#171717] px-5 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Recording Rejection...</span>
                </>
              ) : (
                <span>Confirm Rejection</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
