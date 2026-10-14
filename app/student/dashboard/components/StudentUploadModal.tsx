'use client';

import { useState, useRef, useEffect } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import {
  DOCUMENT_CATEGORIES,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
  type DocumentCategory,
  type StudentDocument,
} from '@/src/types/document';
import { uploadStudentDocumentSelfAction } from '@/app/actions/studentPortal';

interface StudentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (document: StudentDocument) => void;
}

export default function StudentUploadModal({
  isOpen,
  onClose,
  onSuccess,
}: StudentUploadModalProps) {
  const [category, setCategory] = useState<DocumentCategory>('identity_document');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStep, setUploadStep] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Close on Escape key press
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        handleClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting]);

  if (!isOpen) return null;

  function validateFile(file: File): string | null {
    if (file.size === 0) {
      return 'The selected file is empty. Please choose a valid file.';
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `File exceeds the 10 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`;
    }
    const isAllowed =
      (ALLOWED_MIME_TYPES as readonly string[]).includes(file.type) ||
      file.name.match(/\.(pdf|jpe?g|png|webp)$/i);
    if (!isAllowed) {
      return 'Only PDF, JPEG, PNG, and WebP files are supported.';
    }
    return null;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (file) {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        setSelectedFile(file);
      }
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isSubmitting) setDragActive(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (isSubmitting) return;

    setError(null);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        setSelectedFile(null);
      } else {
        setSelectedFile(file);
      }
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedFile) {
      setError('Please select a document file to upload.');
      return;
    }

    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setUploadStep('Inspecting and validating file...');

    try {
      const formData = new FormData();
      formData.append('category', category);
      formData.append('file', selectedFile, selectedFile.name);
      formData.append('original_filename', selectedFile.name);

      setUploadStep('Uploading to encrypted storage...');
      const res = await uploadStudentDocumentSelfAction(formData);

      if (!res.success || !res.document) {
        setError(res.error || 'Failed to complete document upload.');
      } else {
        onSuccess(res.document);
        handleClose();
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred during upload.'
      );
    } finally {
      setIsSubmitting(false);
      setUploadStep('');
    }
  }

  function handleClose() {
    if (isSubmitting) return;
    setSelectedFile(null);
    setError(null);
    setCategory('identity_document');
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-upload-doc-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          handleClose();
        }
      }}
    >
      <div className="relative w-full max-w-lg rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-4">
          <div>
            <h3 id="student-upload-doc-title" className="text-base font-semibold text-[#171717]">
              Upload Verification Document
            </h3>
            <p className="mt-0.5 text-xs text-[#737373]">
              Upload an official document to be reviewed and verified by the college registrar.
            </p>
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
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-lg border border-[#171717] bg-[#F7F7F7] p-3 text-xs text-[#171717]"
          >
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-[#171717]" />
            <span className="flex-1 leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Category Selector */}
          <div>
            <label
              htmlFor="student-doc-category"
              className="block text-xs font-medium text-[#171717] mb-1.5"
            >
              Document Category <span className="font-bold">*</span>
            </label>
            <select
              id="student-doc-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as DocumentCategory)}
              disabled={isSubmitting}
              className="w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-xs text-[#171717] focus:border-[#171717] focus:outline-none transition-colors"
            >
              {DOCUMENT_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label} — {cat.description}
                </option>
              ))}
            </select>
          </div>

          {/* File Upload Drop Zone */}
          <div>
            <label className="block text-xs font-medium text-[#171717] mb-1.5">
              File Attachment <span className="font-bold">*</span>
            </label>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => {
                if (!isSubmitting) fileInputRef.current?.click();
              }}
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
                dragActive
                  ? 'border-[#171717] bg-[#F7F7F7]'
                  : selectedFile
                  ? 'border-[#171717] bg-white'
                  : 'border-[#E5E5E5] bg-[#F7F7F7] hover:border-[#737373]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                className="hidden"
                disabled={isSubmitting}
              />

              {selectedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#171717] text-white">
                    <FileText size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#171717] break-all max-w-xs">
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-[#737373]">
                      {formatFileSize(selectedFile.size)} &bull; {selectedFile.type || 'Document'}
                    </p>
                  </div>
                  {!isSubmitting && (
                    <span className="text-[11px] font-medium text-[#737373] underline mt-1">
                      Click to choose a different file
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-[#E5E5E5] text-[#737373]">
                    <UploadCloud size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#171717]">
                      Click to browse or drag and drop file here
                    </p>
                    <p className="text-[11px] text-[#737373] mt-0.5">
                      Supported formats: PDF, JPEG, PNG, WebP (Max 10 MB)
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Privacy & Verification Note */}
          <div className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-3 text-[11px] text-[#737373] leading-relaxed">
            <span className="font-semibold text-[#171717]">Privacy Notice:</span> Documents are stored in an encrypted private bucket accessible only to you and authorized administrators. Newly submitted files receive a <span className="font-semibold text-[#171717]">Pending</span> status until reviewed.
          </div>

          {/* Progress Indicator */}
          {isSubmitting && uploadStep && (
            <div className="flex items-center gap-2 text-xs text-[#737373]">
              <Loader2 size={13} className="animate-spin text-[#171717]" />
              <span>{uploadStep}</span>
            </div>
          )}

          {/* Footer Actions */}
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
              disabled={isSubmitting || !selectedFile}
              className="flex items-center gap-1.5 rounded-md border border-[#171717] bg-[#171717] px-5 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <span>Upload Document</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
