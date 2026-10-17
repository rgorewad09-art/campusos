'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Trash2,
  Check,
  X,
  Search,
  Loader2,
  Filter,
  ShieldCheck,
  RotateCw,
} from 'lucide-react';
import {
  getAllDocumentsAction,
  getDocumentSignedUrlAction,
  verifyDocumentAction,
} from '@/app/actions/documents';
import { DOCUMENT_CATEGORIES, type StudentDocument } from '@/src/types/document';
import RejectDocumentModal from '@/app/students/[id]/components/RejectDocumentModal';
import DeleteDocumentModal from '@/app/students/[id]/components/DeleteDocumentModal';

interface ExtendedDocument extends StudentDocument {
  student?: {
    id: string;
    first_name: string;
    last_name: string;
    student_code: string;
  };
}

interface DocumentsViewProps {
  initialStatus?: 'all' | 'pending' | 'verified' | 'rejected';
  pageTitle?: string;
  pageSubtitle?: string;
}

export default function DocumentsView({
  initialStatus = 'all',
  pageTitle = 'Document Management',
  pageSubtitle = 'Review, verify, and manage official student certificates and identity records.',
}: DocumentsViewProps) {
  const [documents, setDocuments] = useState<ExtendedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>(
    initialStatus
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Modals state
  const [selectedDocForReject, setSelectedDocForReject] = useState<ExtendedDocument | null>(null);
  const [selectedDocForDelete, setSelectedDocForDelete] = useState<ExtendedDocument | null>(null);
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);
  const [verifyingDocId, setVerifyingDocId] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const res = await getAllDocumentsAction({
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: searchQuery,
      });

      if (!res.success || !res.documents) {
        setFeedback({ type: 'error', message: res.error || 'Failed to load documents.' });
      } else {
        setDocuments(res.documents as ExtendedDocument[]);
      }
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error retrieving document records.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  async function handleView(doc: ExtendedDocument) {
    setViewingDocId(doc.id);
    try {
      const res = await getDocumentSignedUrlAction(doc.id);
      if (res.success && res.signedUrl) {
        window.open(res.signedUrl, '_blank', 'noopener,noreferrer');
      } else {
        setFeedback({ type: 'error', message: res.error || 'Could not open document.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Failed to generate secure link.' });
    } finally {
      setViewingDocId(null);
    }
  }

  async function handleVerify(doc: ExtendedDocument) {
    setVerifyingDocId(doc.id);
    setFeedback(null);
    try {
      const res = await verifyDocumentAction(doc.id);
      if (res.success && res.document) {
        setFeedback({
          type: 'success',
          message: `Document "${doc.original_filename}" verified successfully.`,
        });
        setDocuments((prev) =>
          prev.map((d) => (d.id === doc.id ? { ...d, verification_status: 'verified' } : d))
        );
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to verify document.' });
      }
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error verifying document.',
      });
    } finally {
      setVerifyingDocId(null);
    }
  }

  function formatBytes(bytes?: number | null): string {
    if (!bytes || bytes === 0) return '—';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  const totalCount = documents.length;
  const pendingCount = documents.filter((d) => d.verification_status === 'pending').length;
  const verifiedCount = documents.filter((d) => d.verification_status === 'verified').length;
  const rejectedCount = documents.filter((d) => d.verification_status === 'rejected').length;

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-[#171717]">{pageTitle}</h2>
          <p className="text-xs text-[#737373] mt-0.5">{pageSubtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchDocs()}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs font-medium text-[#737373] hover:text-[#171717] hover:border-[#171717] transition-colors"
          >
            <RotateCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between rounded-lg border p-3 text-xs ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle size={15} className="text-red-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 shadow-xs">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#737373]">
            Total Records
          </span>
          <div className="mt-2 text-xl font-bold text-[#171717]">{totalCount}</div>
        </div>

        <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 shadow-xs">
          <span className="text-[11px] font-medium uppercase tracking-wider text-amber-600">
            Pending Review
          </span>
          <div className="mt-2 text-xl font-bold text-amber-600">{pendingCount}</div>
        </div>

        <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 shadow-xs">
          <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-600">
            Verified
          </span>
          <div className="mt-2 text-xl font-bold text-emerald-600">{verifiedCount}</div>
        </div>

        <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 shadow-xs">
          <span className="text-[11px] font-medium uppercase tracking-wider text-red-600">
            Rejected
          </span>
          <div className="mt-2 text-xl font-bold text-red-600">{rejectedCount}</div>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#E5E5E5] bg-white p-4 shadow-xs">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'pending', 'verified', 'rejected'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-colors ${
                statusFilter === st
                  ? 'bg-[#171717] text-white'
                  : 'bg-[#F7F7F7] text-[#737373] hover:text-[#171717]'
              }`}
            >
              {st === 'all' ? 'All' : st}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs text-[#737373] sm:w-72 focus-within:border-[#171717] focus-within:text-[#171717]">
          <Search size={14} className="shrink-0" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student or filename..."
            className="w-full bg-transparent text-xs text-[#171717] outline-none placeholder:text-[#737373]"
          />
        </div>
      </div>

      {/* Documents Table */}
      <div className="rounded-xl border border-[#E5E5E5] bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E5E5E5] bg-[#FAFAFA] text-[#737373] uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-3">Student</th>
                <th className="px-6 py-3">Document Type</th>
                <th className="px-6 py-3">File Details</th>
                <th className="px-6 py-3">Uploaded</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[#737373]">
                    <Loader2 size={20} className="animate-spin mx-auto mb-2 text-[#171717]" />
                    <span>Loading documents...</span>
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[#737373]">
                    <FileText size={28} className="mx-auto mb-2 text-[#A3A3A3]" />
                    <p className="font-medium text-[#171717]">No documents found</p>
                    <p className="text-[11px] mt-1">
                      {statusFilter !== 'all'
                        ? `No documents matching status "${statusFilter}".`
                        : 'No official documents uploaded yet.'}
                    </p>
                  </td>
                </tr>
              ) : (
                documents.map((doc) => {
                  const studentName = doc.student
                    ? `${doc.student.first_name} ${doc.student.last_name}`
                    : 'Unassigned Student';
                  const studentCode = doc.student?.student_code || '—';
                  const categoryLabel =
                    DOCUMENT_CATEGORIES.find((c) => c.value === doc.document_type)?.label ||
                    doc.document_type;

                  return (
                    <tr key={doc.id} className="hover:bg-[#FAFAFA] transition-colors">
                      <td className="px-6 py-3.5">
                        {doc.student ? (
                          <Link
                            href={`/students/${doc.student.id}`}
                            className="font-semibold text-[#171717] hover:underline"
                          >
                            {studentName}
                          </Link>
                        ) : (
                          <span className="font-semibold text-[#171717]">{studentName}</span>
                        )}
                        <span className="block font-mono text-[11px] text-[#737373]">
                          {studentCode}
                        </span>
                      </td>

                      <td className="px-6 py-3.5">
                        <span className="rounded bg-[#F7F7F7] px-2 py-0.5 text-[11px] font-medium text-[#171717]">
                          {categoryLabel}
                        </span>
                      </td>

                      <td className="px-6 py-3.5">
                        <span className="font-medium text-[#171717] truncate max-w-[200px] block">
                          {doc.original_filename}
                        </span>
                        <span className="text-[11px] text-[#737373]">
                          {formatBytes(doc.file_size)} &bull; {doc.mime_type || 'Document'}
                        </span>
                      </td>

                      <td className="px-6 py-3.5 text-[#525252]">
                        {doc.created_at ? doc.created_at.split('T')[0] : '—'}
                      </td>

                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                            doc.verification_status === 'verified'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : doc.verification_status === 'pending'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {doc.verification_status === 'verified' && <CheckCircle2 size={11} />}
                          {doc.verification_status === 'pending' && <Clock size={11} />}
                          {doc.verification_status === 'rejected' && <AlertCircle size={11} />}
                          <span>{doc.verification_status}</span>
                        </span>
                      </td>

                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleView(doc)}
                            disabled={viewingDocId === doc.id}
                            className="rounded p-1 text-[#737373] hover:text-[#171717] hover:bg-[#E5E5E5] transition-colors"
                            title="View / Download Document"
                          >
                            {viewingDocId === doc.id ? (
                              <Loader2 size={14} className="animate-spin text-[#171717]" />
                            ) : (
                              <ExternalLink size={14} />
                            )}
                          </button>

                          {doc.verification_status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleVerify(doc)}
                                disabled={verifyingDocId === doc.id}
                                className="rounded p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 transition-colors"
                                title="Approve & Verify"
                              >
                                {verifyingDocId === doc.id ? (
                                  <Loader2 size={14} className="animate-spin text-emerald-600" />
                                ) : (
                                  <Check size={14} />
                                )}
                              </button>
                              <button
                                onClick={() => setSelectedDocForReject(doc)}
                                className="rounded p-1 text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                                title="Reject with Reason"
                              >
                                <X size={14} />
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => setSelectedDocForDelete(doc)}
                            className="rounded p-1 text-[#737373] hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete Document"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Modal */}
      {selectedDocForReject && (
        <RejectDocumentModal
          isOpen={true}
          onClose={() => setSelectedDocForReject(null)}
          onSuccess={(updated) => {
            setFeedback({
              type: 'success',
              message: `Document "${selectedDocForReject.original_filename}" marked as rejected.`,
            });
            setDocuments((prev) =>
              prev.map((d) => (d.id === updated.id ? { ...d, verification_status: 'rejected' } : d))
            );
            setSelectedDocForReject(null);
          }}
          document={selectedDocForReject}
          studentName={
            selectedDocForReject.student
              ? `${selectedDocForReject.student.first_name} ${selectedDocForReject.student.last_name}`
              : 'Student'
          }
        />
      )}

      {/* Delete Modal */}
      {selectedDocForDelete && (
        <DeleteDocumentModal
          isOpen={true}
          onClose={() => setSelectedDocForDelete(null)}
          onSuccess={(deletedId) => {
            setFeedback({
              type: 'success',
              message: 'Document permanently deleted.',
            });
            setDocuments((prev) => prev.filter((d) => d.id !== deletedId));
            setSelectedDocForDelete(null);
          }}
          document={selectedDocForDelete}
          studentName={
            selectedDocForDelete.student
              ? `${selectedDocForDelete.student.first_name} ${selectedDocForDelete.student.last_name}`
              : 'Student'
          }
        />
      )}
    </div>
  );
}
