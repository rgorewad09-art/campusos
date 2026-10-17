'use server';

import { createClient } from '@/src/lib/supabase/server';
import { createAdminClient } from '@/src/lib/supabase/admin';
import { isAuthError } from '@/src/lib/security';
import type { TeacherSubjectAssignment, TimetableEntry } from '@/src/types/academic';

/**
 * Authorization helper for Admin.
 */
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized: You must be signed in.');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'admin') {
    throw new Error('Forbidden: Only authorized administrators can access this data.');
  }

  return { supabase, user };
}

export interface EnrichedAssignment extends TeacherSubjectAssignment {
  scheduled_slots?: string[];
}

const DAY_MAP: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
};

function formatSlot(tt: any): string {
  const day = DAY_MAP[tt.day_of_week] || `Day ${tt.day_of_week}`;
  const start = tt.start_time ? tt.start_time.slice(0, 5) : '';
  const end = tt.end_time ? tt.end_time.slice(0, 5) : '';
  const time = start && end ? `${start}-${end}` : '';
  const room = tt.room ? `(${tt.room})` : '';
  return [day, time, room].filter(Boolean).join(' ');
}

/**
 * Fetch institutional assignment overview for Administrators:
 * - All faculty-subject assignments
 * - Timetable scheduled allocations
 * - Aggregated coursework statistics
 */
export async function getAssignmentsOverviewAction(): Promise<{
  success: boolean;
  data?: {
    assignments: EnrichedAssignment[];
    stats: {
      totalAssignments: number;
      totalSubjects: number;
      assignedFacultyCount: number;
    };
  };
  error?: string;
}> {
  try {
    const { supabase } = await requireAdmin();
    const adminClient = createAdminClient();
    const dbClient = adminClient || supabase;

    // Fetch assignments, active curriculum subjects, and timetables in parallel
    const [assRes, subRes, ttRes] = await Promise.all([
      dbClient
        .from('teacher_subject_assignments')
        .select(`
          *,
          course:courses(*),
          subject:subjects(*),
          teacher:teachers(*)
        `)
        .order('assigned_at', { ascending: false }),
      dbClient.from('subjects').select('id, status').eq('status', 'active'),
      dbClient
        .from('timetables')
        .select(`
          *,
          course:courses(*),
          subject:subjects(*),
          teacher:teachers(*)
        `),
    ]);

    const rawAssignments = (assRes.data as (TeacherSubjectAssignment & { teacher?: any })[]) || [];
    const subjects = subRes.data || [];
    const timetables = ttRes.data || [];

    // Map direct assignments and associate their timetable slots
    const assignments: EnrichedAssignment[] = rawAssignments.map((a) => {
      const slots = timetables
        .filter(
          (tt: any) =>
            tt.teacher_id === a.teacher_id &&
            tt.subject_id === a.subject_id &&
            (!a.course_id || tt.course_id === a.course_id)
        )
        .map(formatSlot);
      return { ...a, scheduled_slots: slots };
    });

    // Synthesize active timetable allocations where no explicit teacher_subject_assignments row exists
    const existingKeys = new Set(
      rawAssignments.map(
        (a) => `${a.teacher_id}_${a.subject_id}_${a.course_id}_${a.semester}_${a.section}`
      )
    );

    for (const tt of timetables) {
      if (!tt.teacher_id || !tt.subject_id) continue;
      const key = `${tt.teacher_id}_${tt.subject_id}_${tt.course_id}_${tt.semester}_${tt.section}`;
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        const slots = timetables
          .filter(
            (t: any) =>
              t.teacher_id === tt.teacher_id &&
              t.subject_id === tt.subject_id &&
              t.course_id === tt.course_id &&
              t.semester === tt.semester &&
              t.section === tt.section
          )
          .map(formatSlot);

        assignments.push({
          id: `tt-${tt.id}`,
          teacher_id: tt.teacher_id,
          course_id: tt.course_id,
          subject_id: tt.subject_id,
          semester: tt.semester,
          section: tt.section,
          academic_term: tt.academic_term,
          assigned_by: tt.created_by,
          assigned_at: tt.created_at,
          teacher: tt.teacher,
          course: tt.course,
          subject: tt.subject,
          scheduled_slots: slots,
        });
      }
    }

    const assignedTeachers = new Set(assignments.map((a) => a.teacher_id).filter(Boolean));

    return {
      success: true,
      data: {
        assignments,
        stats: {
          totalAssignments: assignments.length,
          totalSubjects: subjects.length,
          assignedFacultyCount: assignedTeachers.size,
        },
      },
    };
  } catch (err: unknown) {
    console.error('[CampusOS Assignments] getAssignmentsOverviewAction error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to retrieve assignments overview.';
    return { success: false, error: message };
  }
}
