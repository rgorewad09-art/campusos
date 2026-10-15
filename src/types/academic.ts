/**
 * src/types/academic.ts
 *
 * TypeScript types for CampusOS Academic Management System.
 * Covers Courses, Subjects, Course-Subject curriculum, Faculty Allocations,
 * Student Academic Enrollments, Subject selections, and Timetables.
 */

import type { Student } from './student';
import type { Teacher } from './teacher';

export type AcademicStatus = 'active' | 'archived';

export interface Course {
  id: string;
  code: string;
  name: string;
  department: string;
  duration_years: number;
  total_semesters: number;
  description: string | null;
  status: AcademicStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  subjects_count?: number;
}

export interface CourseFormData {
  code: string;
  name: string;
  department: string;
  duration_years: number;
  total_semesters: number;
  description?: string;
  status: AcademicStatus;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  department: string;
  credits: number;
  description: string | null;
  status: AcademicStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubjectFormData {
  code: string;
  name: string;
  department: string;
  credits: number;
  description?: string;
  status: AcademicStatus;
}

export interface CourseSubject {
  id: string;
  course_id: string;
  subject_id: string;
  semester: number;
  is_mandatory: boolean;
  elective_group: string | null;
  created_at: string;
  subject?: Subject;
  course?: Course;
}

export interface TeacherSubjectAssignment {
  id: string;
  teacher_id: string;
  course_id: string;
  subject_id: string;
  semester: number;
  section: string;
  academic_term: string;
  assigned_by: string | null;
  assigned_at: string;
  teacher?: Teacher;
  course?: Course;
  subject?: Subject;
}

export type EnrollmentStatus = 'pending' | 'approved' | 'rejected' | 'completed';

export interface StudentAcademicEnrollment {
  id: string;
  student_id: string;
  course_id: string;
  semester: number;
  section: string;
  academic_term: string;
  status: EnrollmentStatus;
  enrolled_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  student?: Student;
  course?: Course;
  selected_subjects?: StudentSelectedSubject[];
}

export interface StudentSelectedSubject {
  id: string;
  enrollment_id: string;
  student_id: string;
  subject_id: string;
  is_mandatory: boolean;
  status: 'pending' | 'approved' | 'rejected';
  selected_at: string;
  subject?: Subject;
}

export type TimetableStatus = 'proposed' | 'approved' | 'rejected';

export interface TimetableEntry {
  id: string;
  academic_term: string;
  course_id: string;
  subject_id: string;
  teacher_id: string;
  class_id?: string | null;
  section: string;
  semester: number;
  day_of_week: number; // 1 = Monday, 2 = Tuesday, ..., 7 = Sunday
  start_time: string; // HH:mm:ss or HH:mm
  end_time: string;   // HH:mm:ss or HH:mm
  room: string;
  status: TimetableStatus;
  created_by: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  course?: Course;
  subject?: Subject;
  teacher?: Teacher;
}

export interface TimetableFormData {
  academic_term: string;
  course_id: string;
  subject_id: string;
  teacher_id: string;
  section: string;
  semester: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string;
}

export interface TimetableConflict {
  type: 'teacher_conflict' | 'section_conflict' | 'room_conflict' | 'hours_conflict';
  message: string;
  conflictingEntry?: Partial<TimetableEntry>;
}

export const DAYS_OF_WEEK = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 7, label: 'Sunday', short: 'Sun' },
] as const;

export const DEFAULT_ACADEMIC_TERM = '2026-Fall';
