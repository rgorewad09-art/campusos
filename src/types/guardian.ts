/**
 * src/types/guardian.ts
 *
 * TypeScript types for CampusOS guardian and student-guardian relations.
 */

export interface Guardian {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  relationship: string | null;
  created_at: string;
}

export interface StudentGuardianLink {
  student_id: string;
  guardian_id: string;
  is_primary: boolean;
  guardians: Guardian | null;
}

export interface GuardianFormData {
  full_name: string;
  relationship: string;
  email?: string;
  phone?: string;
  is_primary?: boolean;
}
