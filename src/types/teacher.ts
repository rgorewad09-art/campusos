/**
 * src/types/teacher.ts
 *
 * TypeScript types for CampusOS Teacher / Faculty Management.
 */

export type TeacherStatus = 'active' | 'inactive' | 'on_leave' | 'suspended';

export interface Teacher {
  id: string;
  teacher_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  department: string;
  status: TeacherStatus;
  user_id?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeacherFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  department?: string;
  status?: TeacherStatus;
}

export interface GetTeachersOptions {
  search?: string;
  department?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface TeachersListResponse {
  teachers: Teacher[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
