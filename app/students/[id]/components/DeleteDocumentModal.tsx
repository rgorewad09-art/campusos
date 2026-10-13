'use client';

import { useState } from 'react';
import { X, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { deleteDocumentAction } from '@/app/actions/documents';
import { DOCUMENT_CATEGORIES, type StudentDocument } from '@/src/types/document';

interface DeleteDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (deletedId: string) => void;
  document: StudentDocument | null;
  studentName: string;
}

export default function DeleteDocumentModal({
  isOpen,
  onClose,
  onSuccess,
  document: doc,
  studentName,
}: DeleteDocumentModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !doc) return null;

  const categoryLabel =
    DOCUMENT_CATEGORIES.find((c) => c.value === doc.document_type)?.label ||
    doc.document_type;

  async function handleDelete() {
    if (!doc) return;
    setError(null);
    setIsDeleting(true);

    try {
      const res = await deleteDocumentAction(doc.id);
      if (!res.success) {
        setError(res.error || 'Failed to delete document.');
      } else {
        onSuccess(doc.id);
        onClose();
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred.'
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-doc-title"
    >
      <div className="relative w-full max-w-md rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#171717] text-white">
              <Trash2 size={16} />
            </div>
            <div>
              <h3 id="delete-doc-title" className="text-base font-semibold text-[#171717]">
                Delete Document
              </h3>
              <p className="text-xs text-[#737373]">
                {studentName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
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

        {/* Content */}
        <div className="mt-4 space-y-3 text-xs text-[#737373] leading-relaxed">
          <p>
            Are you sure you want to permanently delete this document record?
          </p>

          <div className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-3.5 space-y-1.5 text-xs text-[#171717]">
            <div>
              <span className="text-[#737373]">Category: </span>
              <span className="font-semibold">{categoryLabel}</span>
            </div>
            {(doc.original_filename || doc.file_name) && (
              <div>
                <span className="text-[#737373]">Filename: </span>
                <span className="font-mono text-[11px] break-all">
                  {doc.original_filename || doc.file_name}
                </span>
              </div>
            )}
            <div>
              <span className="text-[#737373]">Verification Status: </span>
              <span className="capitalize font-medium">{doc.verification_status}</span>
            </div>
          </div>

          <p className="text-[11px] text-[#737373]">
            This will remove the file from secure storage and delete the database record. This action cannot be reversed.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-[#E5E5E5] pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-md border border-[#E5E5E5] bg-white px-4 py-2 text-xs font-medium text-[#171717] hover:bg-[#F7F7F7] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-1.5 rounded-md border border-[#171717] bg-[#171717] px-5 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <span>Delete Document</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
