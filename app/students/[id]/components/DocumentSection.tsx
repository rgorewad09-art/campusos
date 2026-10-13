'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Trash2,
  Check,
  X,
  Loader2,
  AlertCircle,
  FileCheck,
  ShieldCheck,
  GraduationCap,
  Camera,
  File,
} from 'lucide-react';
import {
  DOCUMENT_CATEGORIES,
  type StudentDocument,
  type DocumentCategory,
  type VerificationStatus,
} from '@/src/types/document';
import {
  getStudentDocumentsAction,
  getDocumentSignedUrlAction,
  verifyDocumentAction,
} from '@/app/actions/documents';
import UploadDocumentModal from './UploadDocumentModal';
import RejectDocumentModal from './RejectDocumentModal';
import DeleteDocumentModal from './DeleteDocumentModal';
import DocumentListSkeleton from '@/src/components/skeletons/DocumentListSkeleton';

interface DocumentSectionProps {
  studentId: string;
  studentName: string;
}

export default function DocumentSection({
  studentId,
  studentName,
}: DocumentSectionProps) {
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedDocForReject, setSelectedDocForReject] =
    useState<StudentDocument | null>(null);
  const [selectedDocForDelete, setSelectedDocForDelete] =
    useState<StudentDocument | null>(null);

  // Action loaders
  const [verifyingDocId, setVerifyingDocId] = useState<string | null>(null);
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await getStudentDocumentsAction(studentId);
      if (!res.success || !res.documents) {
        setErrorMessage(res.error || 'Failed to load documents.');
      } else {
        setDocuments(res.documents);
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'An error occurred while loading documents.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  function formatDate(dateStr: string | null | undefined): string {
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
        // also extract time if present
        const timePart = dateStr.includes('T') ? dateStr.split('T')[1].slice(0, 5) : '';
        return `${monthNames[m]} ${parseInt(day, 10)}, ${year}${timePart ? ` at ${timePart}` : ''}`;
      }
    }
    return dateStr;
  }

  function formatFileSize(bytes?: number | null): string {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getCategoryInfo(categoryValue: string) {
    const found = DOCUMENT_CATEGORIES.find((c) => c.value === categoryValue);
    return found || {
      value: categoryValue as DocumentCategory,
      label: categoryValue.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      description: 'Document record',
    };
  }

  function renderCategoryIcon(categoryValue: string) {
    switch (categoryValue) {
      case 'student_photograph':
        return <Camera size={16} />;
      case 'identity_document':
        return <ShieldCheck size={16} />;
      case 'academic_marksheet':
        return <GraduationCap size={16} />;
      case 'enrollment_document':
        return <FileCheck size={16} />;
      default:
        return <File size={16} />;
    }
  }

  function renderStatusBadge(status: VerificationStatus) {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#171717] px-2.5 py-0.5 text-[11px] font-medium text-white">
            <CheckCircle2 size={11} />
            <span>Verified</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#171717] bg-white px-2.5 py-0.5 text-[11px] font-medium text-[#171717]">
            <XCircle size={11} />
            <span>Rejected</span>
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-[#F7F7F7] px-2.5 py-0.5 text-[11px] font-medium text-[#737373]">
            <Clock size={11} />
            <span>Pending Review</span>
          </span>
        );
    }
  }

  async function handleViewDocument(doc: StudentDocument) {
    setViewingDocId(doc.id);
    setActionNotice(null);

    try {
      const res = await getDocumentSignedUrlAction(doc.id);
      if (!res.success || !res.signedUrl) {
        setActionNotice(`Could not access document: ${res.error || 'Unknown error'}`);
      } else {
        window.open(res.signedUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err: unknown) {
      setActionNotice(
        err instanceof Error ? err.message : 'Error generating secure document link.'
      );
    } finally {
      setViewingDocId(null);
    }
  }

  async function handleQuickVerify(doc: StudentDocument) {
    setVerifyingDocId(doc.id);
    setActionNotice(null);

    try {
      const res = await verifyDocumentAction(doc.id);
      if (!res.success || !res.document) {
        setActionNotice(`Verification failed: ${res.error || 'Unknown error'}`);
      } else {
        setDocuments((prev) =>
          prev.map((d) => (d.id === doc.id ? (res.document as StudentDocument) : d))
        );
      }
    } catch (err: unknown) {
      setActionNotice(
        err instanceof Error ? err.message : 'Error marking document as verified.'
      );
    } finally {
      setVerifyingDocId(null);
    }
  }

  function handleUploadSuccess(newDoc: StudentDocument) {
    setDocuments((prev) => [newDoc, ...prev]);
  }

  function handleRejectSuccess(updatedDoc: StudentDocument) {
    setDocuments((prev) =>
      prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d))
    );
  }

  function handleDeleteSuccess(deletedId: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== deletedId));
  }

  return (
    <section
      aria-labelledby="student-documents-heading"
      className="rounded-xl border border-[#E5E5E5] bg-white p-6 sm:p-8"
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E5E5E5] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h2
              id="student-documents-heading"
              className="text-base font-semibold text-[#171717]"
            >
              Student Documents
            </h2>
            <span className="rounded-full bg-[#F7F7F7] border border-[#E5E5E5] px-2 py-0.5 text-[11px] font-medium text-[#737373]">
              {documents.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#737373]">
            Verified identity documents, photographs, academic marksheets, and enrollment files.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsUploadOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#171717] bg-[#171717] px-4 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors self-start sm:self-auto"
        >
          <UploadCloud size={14} />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Action Notice / Inline alert */}
      {actionNotice && (
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-[#171717] bg-[#F7F7F7] p-3 text-xs text-[#171717]">
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-[#171717]" />
          <span className="flex-1">{actionNotice}</span>
          <button
            onClick={() => setActionNotice(null)}
            className="text-[#737373] hover:text-[#171717]"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="mt-6">
          <DocumentListSkeleton count={2} />
        </div>
      )}

      {/* Error state */}
      {!isLoading && errorMessage && (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-[#171717] bg-white p-4 text-xs text-[#171717]">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-[#171717]" />
          <div className="flex-1">
            <p className="font-semibold">Unable to load documents</p>
            <p className="mt-0.5 text-[#737373]">{errorMessage}</p>
          </div>
          <button
            onClick={fetchDocuments}
            className="rounded border border-[#171717] bg-[#171717] px-3 py-1 text-xs text-white hover:bg-[#262626] transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !errorMessage && documents.length === 0 && (
        <div className="py-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F7F7] border border-[#E5E5E5] text-[#737373] mb-3">
            <FileText size={22} />
          </div>
          <h3 className="text-sm font-semibold text-[#171717]">
            No Documents Uploaded Yet
          </h3>
          <p className="mt-1 text-xs text-[#737373] max-w-sm mx-auto">
            Upload the student’s photograph, government identity proofs, or previous academic marksheets.
          </p>
          <button
            type="button"
            onClick={() => setIsUploadOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-[#171717] bg-[#171717] px-4 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors"
          >
            <UploadCloud size={13} />
            <span>Upload First Document</span>
          </button>
        </div>
      )}

      {/* Document List */}
      {!isLoading && !errorMessage && documents.length > 0 && (
        <div className="mt-6 space-y-4">
          {documents.map((doc) => {
            const cat = getCategoryInfo(doc.document_type);
            const sizeStr = formatFileSize(doc.file_size);
            const isVerifying = verifyingDocId === doc.id;
            const isViewing = viewingDocId === doc.id;

            return (
              <div
                key={doc.id}
                className="rounded-xl border border-[#E5E5E5] bg-white p-5 hover:border-[#171717] transition-all flex flex-col gap-4"
              >
                {/* Main Row */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  {/* Left: Icon and Details */}
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F7F7F7] border border-[#E5E5E5] text-[#171717]">
                      {renderCategoryIcon(doc.document_type)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-[#171717] truncate">
                          {cat.label}
                        </h4>
                        {renderStatusBadge(doc.verification_status)}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[#737373]">
                        {(doc.original_filename || doc.file_name) && (
                          <span className="font-mono text-[11px] truncate max-w-xs text-[#171717]">
                            {doc.original_filename || doc.file_name}
                          </span>
                        )}
                        {(doc.original_filename || doc.file_name) && sizeStr && <span>•</span>}
                        {sizeStr && <span>{sizeStr}</span>}
                        <span>•</span>
                        <span>Uploaded {formatDate(doc.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E5E5E5] w-full sm:w-auto">
                    {/* View / Download Button */}
                    <button
                      type="button"
                      onClick={() => handleViewDocument(doc)}
                      disabled={isViewing}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#F7F7F7] transition-colors disabled:opacity-50"
                      title="Open short-lived secure view link"
                    >
                      {isViewing ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <ExternalLink size={12} />
                      )}
                      <span>View</span>
                    </button>

                    {/* Mark as Verified (if not verified) */}
                    {doc.verification_status !== 'verified' && (
                      <button
                        type="button"
                        onClick={() => handleQuickVerify(doc)}
                        disabled={isVerifying}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[#171717] bg-[#171717] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#262626] transition-colors disabled:opacity-50"
                        title="Mark document as authentic and verified"
                      >
                        {isVerifying ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Check size={12} />
                        )}
                        <span>Verify</span>
                      </button>
                    )}

                    {/* Reject Button (if not rejected) */}
                    {doc.verification_status !== 'rejected' && (
                      <button
                        type="button"
                        onClick={() => setSelectedDocForReject(doc)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs font-medium text-[#737373] hover:text-[#171717] hover:border-[#171717] transition-colors"
                        title="Reject document with reason"
                      >
                        <X size={12} />
                        <span>Reject</span>
                      </button>
                    )}

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedDocForDelete(doc)}
                      className="p-1.5 text-[#737373] hover:text-[#171717] hover:bg-[#F7F7F7] rounded transition-colors"
                      title="Delete document"
                      aria-label="Delete document"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Verification Metadata Footnote */}
                {doc.verification_status === 'verified' && (
                  <div className="rounded-md border border-[#E5E5E5] bg-[#F7F7F7] px-3.5 py-2 text-[11px] text-[#737373] flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-[#171717]" />
                    <span>
                      Verified by administrator on{' '}
                      <span className="font-medium text-[#171717]">
                        {formatDate(doc.verified_at)}
                      </span>
                    </span>
                  </div>
                )}

                {doc.verification_status === 'rejected' && (
                  <div className="rounded-md border border-[#171717] bg-[#F7F7F7] p-3 text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-[#171717] mb-1">
                      <XCircle size={13} />
                      <span>
                        Document Rejected on {formatDate(doc.verified_at)}
                      </span>
                    </div>
                    {doc.rejection_reason ? (
                      <p className="text-[#737373] text-[11px] pl-4">
                        <span className="font-medium text-[#171717]">Reason: </span>
                        {doc.rejection_reason}
                      </p>
                    ) : (
                      <p className="text-[#737373] text-[11px] pl-4">
                        Rejection reason recorded in audit trail.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <UploadDocumentModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={handleUploadSuccess}
        studentId={studentId}
        studentName={studentName}
      />

      <RejectDocumentModal
        isOpen={Boolean(selectedDocForReject)}
        onClose={() => setSelectedDocForReject(null)}
        onSuccess={handleRejectSuccess}
        document={selectedDocForReject}
        studentName={studentName}
      />

      <DeleteDocumentModal
        isOpen={Boolean(selectedDocForDelete)}
        onClose={() => setSelectedDocForDelete(null)}
        onSuccess={handleDeleteSuccess}
        document={selectedDocForDelete}
        studentName={studentName}
      />
    </section>
  );
}
