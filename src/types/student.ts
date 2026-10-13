/**
 * src/types/student.ts
 *
 * TypeScript types for CampusOS student management.
 */

export type StudentStatus = 'active' | 'inactive' | 'pending' | 'suspended' | 'graduated';

export interface Student {
  id: string;
  student_code: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string;
  email: string | null;
  phone: string | null;
  enrollment_date: string;
  status: StudentStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentFormData {
  first_name: string;
  middle_name?: string;
  last_name: string;
  date_of_birth: string;
  email?: string;
  phone?: string;
  enrollment_date: string;
  status: StudentStatus;
}

export interface GetStudentsOptions {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface StudentsListResponse {
  students: Student[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
