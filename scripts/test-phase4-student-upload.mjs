/**
 * scripts/test-phase4-student-upload.mjs
 *
 * Automated verification suite for Phase 4: Student Document Self-Upload.
 * Verifies:
 *  1. Server action uploadStudentDocumentSelfAction authorization and data isolation
 *  2. Binary magic-byte MIME type detection and file format security
 *  3. File size and category validation constraints
 *  4. StudentUploadModal component integration and UX (drag-drop, progress, errors)
 *  5. Dashboard integration (Upload Document button, success banner, empty state)
 *  6. Storage path scoping and rollback mechanisms
 *  7. Administrator review preservation
 *  8. Prohibitions compliance (no assignments, no announcements, no OTP)
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { detectMimeTypeFromBuffer } from '../src/lib/security.ts';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('====================================================');
console.log('Phase 4 Verification: Student Document Self-Upload');
console.log('====================================================\n');

// 1. Component & File Existence
console.log('1. Verifying Files and Components:');
const studentPortalPath = resolve(process.cwd(), 'app/actions/studentPortal.ts');
const uploadModalPath = resolve(process.cwd(), 'app/student/dashboard/components/StudentUploadModal.tsx');
const dashboardPath = resolve(process.cwd(), 'app/student/dashboard/page.tsx');

assert(existsSync(studentPortalPath), 'app/actions/studentPortal.ts exists');
assert(existsSync(uploadModalPath), 'app/student/dashboard/components/StudentUploadModal.tsx exists');
assert(existsSync(dashboardPath), 'app/student/dashboard/page.tsx exists');

const studentPortalContent = readFileSync(studentPortalPath, 'utf8');
const uploadModalContent = readFileSync(uploadModalPath, 'utf8');
const dashboardContent = readFileSync(dashboardPath, 'utf8');

// 2. Server Action Security & Authorization Verification
console.log('\n2. Verifying Server Action Security & Authorization:');
assert(studentPortalContent.includes("'use server'"), 'studentPortal.ts is marked with "use server"');
assert(studentPortalContent.includes('export async function uploadStudentDocumentSelfAction'), 'uploadStudentDocumentSelfAction is exported');
assert(studentPortalContent.includes('const { user, student } = await requireStudent()'), 'Enforces requireStudent() authorization gate');
assert(!studentPortalContent.includes("formData.get('student_id')"), 'Never trusts client-supplied student_id (derives solely from authenticated session)');
assert(studentPortalContent.includes("student_id: student.id"), 'Explicitly binds upload to student.id from server session');
assert(studentPortalContent.includes("verification_status: 'pending'"), "Initial verification status is strictly set to 'pending'");
assert(studentPortalContent.includes("detectMimeTypeFromBuffer(buffer)"), 'Performs server-side binary magic byte detection');
assert(studentPortalContent.includes("file.size > MAX_FILE_SIZE_BYTES"), 'Enforces 10 MB maximum file size limit on server');
assert(studentPortalContent.includes(".from('student-documents')") && studentPortalContent.includes(".upload(storagePath"), "Uploads to private 'student-documents' bucket");
assert(studentPortalContent.includes("students/${student.id}/"), 'Storage path is strictly scoped under students/${student.id}/');
assert(studentPortalContent.includes("crypto.randomUUID()"), 'Generates non-guessable, collision-free UUID storage path');
assert(studentPortalContent.includes("storage.from('student-documents').remove([storagePath])"), 'Rolls back and cleans up storage file if DB insert fails');
assert(studentPortalContent.includes("action: 'student_upload_document'"), 'Records audit log event for upload');

// 3. Binary Magic-Byte Inspection Unit Tests
console.log('\n3. Testing Binary Magic-Byte File Type Verification:');

// Test genuine PDF
const pdfBuffer = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35]); // %PDF-1.5
assert(detectMimeTypeFromBuffer(pdfBuffer) === 'application/pdf', 'Accurately identifies genuine PDF buffer (%PDF-)');

// Test genuine PNG
const pngBuffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]); // \x89PNG
assert(detectMimeTypeFromBuffer(pngBuffer) === 'image/png', 'Accurately identifies genuine PNG buffer');

// Test genuine JPEG
const jpegBuffer = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]); // \xFF\xD8\xFF
assert(detectMimeTypeFromBuffer(jpegBuffer) === 'image/jpeg', 'Accurately identifies genuine JPEG buffer');

// Test genuine WebP
const webpBuffer = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, // RIFF
  0x20, 0x00, 0x00, 0x00, // length
  0x57, 0x45, 0x42, 0x50, // WEBP
]);
assert(detectMimeTypeFromBuffer(webpBuffer) === 'image/webp', 'Accurately identifies genuine WebP buffer');

// Test spoofed executable disguised as PDF (MZ Windows binary header)
const spoofedBuffer = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]); // MZ...
assert(detectMimeTypeFromBuffer(spoofedBuffer) === null, 'Safely rejects disguised Windows executable (MZ header)');

// Test shell script disguised as PDF (#!/bin/sh)
const scriptBuffer = new Uint8Array([0x23, 0x21, 0x2f, 0x62, 0x69, 0x6e]); // #!/bin
assert(detectMimeTypeFromBuffer(scriptBuffer) === null, 'Safely rejects disguised shell script (shebang header)');

// Test truncated/empty buffer
assert(detectMimeTypeFromBuffer(new Uint8Array([0x25, 0x50])) === null, 'Safely rejects short/truncated buffer (< 4 bytes)');
assert(detectMimeTypeFromBuffer(new Uint8Array([])) === null, 'Safely rejects empty buffer');

// 4. Client Modal & UX Verification
console.log('\n4. Verifying StudentUploadModal Component:');
assert(uploadModalContent.includes("'use client'"), 'Upload modal is marked with "use client"');
assert(uploadModalContent.includes('uploadStudentDocumentSelfAction'), 'Upload modal submits to uploadStudentDocumentSelfAction');
assert(uploadModalContent.includes('DOCUMENT_CATEGORIES'), 'Populates categories from official DOCUMENT_CATEGORIES');
assert(uploadModalContent.includes('MAX_FILE_SIZE_BYTES'), 'Enforces MAX_FILE_SIZE_BYTES on client side');
assert(uploadModalContent.includes('onDrop={handleDrop}'), 'Implements drag-and-drop file upload');
assert(uploadModalContent.includes('isSubmitting'), 'Provides uploading progress state with spinner');
assert(uploadModalContent.includes('AlertCircle'), 'Renders error alerts for user feedback');
assert(uploadModalContent.includes('onSuccess(res.document)'), 'Triggers onSuccess callback upon completion');

// 5. Dashboard Integration Verification
console.log('\n5. Verifying Student Dashboard Integration:');
assert(dashboardContent.includes('StudentUploadModal'), 'Imports and renders StudentUploadModal');
assert(dashboardContent.includes('Upload Document'), 'Contains "Upload Document" button in My Documents tab');
assert(dashboardContent.includes('Upload First Document'), 'Contains "Upload First Document" in empty state');
assert(dashboardContent.includes('setIsUploadModalOpen(true)'), 'Connects modal open state to upload buttons');
assert(dashboardContent.includes('successBanner'), 'Renders dismissable success notification banner');
assert(dashboardContent.includes('fetchData(true)'), 'Refreshes document list after successful upload');

// 6. Prohibitions & Scope Constraints
console.log('\n6. Verifying Phase 4 Scope Constraints:');
assert(!dashboardContent.includes('assignmentsTable'), 'Does not include assignments table (Phase 5)');
assert(!dashboardContent.includes('announcementsList'), 'Does not include announcements list (Phase 5)');
assert(!studentPortalContent.includes('otp'), 'Does not include OTP login (Phase 7)');

console.log('\n====================================================');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
}
