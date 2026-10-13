/**
 * src/types/document.ts
 *
 * TypeScript types for CampusOS student document management and verification.
 */

export type DocumentCategory =
  | 'student_photograph'
  | 'identity_document'
  | 'academic_marksheet'
  | 'enrollment_document'
  | 'other';

export interface DocumentCategoryOption {
  value: DocumentCategory;
  label: string;
  description: string;
}

export const DOCUMENT_CATEGORIES: DocumentCategoryOption[] = [
  {
    value: 'student_photograph',
    label: 'Student Photograph',
    description: 'Recent passport-style photograph for identification',
  },
  {
    value: 'identity_document',
    label: 'Identity Document',
    description: 'Government ID, passport, or national identity card',
  },
  {
    value: 'academic_marksheet',
    label: 'Academic Marksheet',
    description: 'Previous transcripts, marksheets, or grade certificates',
  },
  {
    value: 'enrollment_document',
    label: 'Enrollment Document',
    description: 'Admission letter, registration confirmation, or transfer certificate',
  },
  {
    value: 'other',
    label: 'Other Document',
    description: 'Supporting certificates, medical records, or affidavits',
  },
];

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface StudentDocument {
  id: string;
  student_id: string;
  document_type: DocumentCategory | string;
  storage_path: string;
  original_filename: string;
  file_name?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  verification_status: VerificationStatus;
  verified_by?: string | null;
  verified_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
}

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
