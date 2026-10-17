'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  BookOpen,
  GraduationCap,
  Users,
  Search,
  RotateCw,
  Plus,
  Info,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  getAssignmentsOverviewAction,
  type EnrichedAssignment,
} from '@/app/actions/assignments';

export default function AssignmentsView() {
  const [assignments, setAssignments] = useState<EnrichedAssignment[]>([]);
  const [stats, setStats] = useState({
    totalAssignments: 0,
    totalSubjects: 0,
    assignedFacultyCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'allocations' | 'homework'>('allocations');
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getAssignmentsOverviewAction();
      if (!res.success || !res.data) {
        setError(res.error || 'Failed to load assignments.');
      } else {
        setAssignments(res.data.assignments);
        setStats(res.data.stats);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error retrieving assignments data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = assignments.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const subName = (a.subject?.name || '').toLowerCase();
    const subCode = (a.subject?.code || '').toLowerCase();
    const courseCode = (a.course?.code || '').toLowerCase();
    const teacherName = `${a.teacher?.first_name || ''} ${a.teacher?.last_name || ''}`.toLowerCase();
    return subName.includes(q) || subCode.includes(q) || courseCode.includes(q) || teacherName.includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-[#171717]">
            Academic Coursework & Teaching Assignments
          </h2>
          <p className="text-xs text-[#737373] mt-0.5">
            Monitor faculty teaching allocations, subject coursework, and student assignment distribution.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchData()}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs font-medium text-[#737373] hover:text-[#171717] hover:border-[#171717] transition-colors"
          >
            <RotateCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <Link
            href="/teachers"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#111111] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#262626] transition-colors"
          >
            <Plus size={13} />
            <span>Assign Faculty</span>
          </Link>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#141414] p-4 shadow-xs">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#737373] dark:text-[#8C8C8C]">
            Total Allocations
          </span>
          <div className="mt-2 text-xl font-bold text-[#171717] dark:text-[#EDEDED]">{stats.totalAssignments}</div>
          <p className="text-[10px] text-[#737373] dark:text-[#8C8C8C] mt-1">Faculty-subject links</p>
        </div>

        <div className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#141414] p-4 shadow-xs">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#737373] dark:text-[#8C8C8C]">
            Curriculum Subjects
          </span>
          <div className="mt-2 text-xl font-bold text-[#171717] dark:text-[#EDEDED]">{stats.totalSubjects}</div>
          <p className="text-[10px] text-[#737373] dark:text-[#8C8C8C] mt-1">Active courses taught</p>
        </div>

        <div className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#141414] p-4 shadow-xs">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#737373] dark:text-[#8C8C8C]">
            Assigned Faculty
          </span>
          <div className="mt-2 text-xl font-bold text-[#171717] dark:text-[#EDEDED]">{stats.assignedFacultyCount}</div>
          <p className="text-[10px] text-[#737373] dark:text-[#8C8C8C] mt-1">Teachers with active loads</p>
        </div>

        <div className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#141414] p-4 shadow-xs">
          <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Grading Module
          </span>
          <div className="mt-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">Scheduled v1.1</div>
          <p className="text-[10px] text-[#737373] dark:text-[#8C8C8C] mt-1">Assignment submission pipeline</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E5E5E5] dark:border-[#262626]">
        <button
          onClick={() => setActiveTab('allocations')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === 'allocations'
              ? 'border-[#171717] dark:border-[#EDEDED] text-[#171717] dark:text-[#EDEDED]'
              : 'border-transparent text-[#737373] dark:text-[#8C8C8C] hover:text-[#171717] dark:hover:text-[#EDEDED]'
          }`}
        >
          <GraduationCap size={14} />
          <span>Faculty Teaching Allocations ({assignments.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('homework')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === 'homework'
              ? 'border-[#171717] dark:border-[#EDEDED] text-[#171717] dark:text-[#EDEDED]'
              : 'border-transparent text-[#737373] dark:text-[#8C8C8C] hover:text-[#171717] dark:hover:text-[#EDEDED]'
          }`}
        >
          <ClipboardList size={14} />
          <span>Student Homework Submissions & Grading</span>
        </button>
      </div>

      {/* Tab 1: Faculty Allocations */}
      {activeTab === 'allocations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 rounded-md border border-[#E5E5E5] dark:border-[#333333] bg-white dark:bg-[#171717] px-3 py-1.5 text-xs text-[#737373] dark:text-[#8C8C8C] sm:w-72 focus-within:border-[#171717] dark:focus-within:border-[#EDEDED] focus-within:text-[#171717] dark:focus-within:text-[#EDEDED]">
              <Search size={14} className="shrink-0" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search teacher, subject, course..."
                className="w-full bg-transparent text-xs text-[#171717] outline-none placeholder:text-[#737373]"
              />
            </div>
          </div>

          <div className="rounded-xl border border-[#E5E5E5] bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#E5E5E5] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#737373] dark:text-[#8C8C8C] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-6 py-3">Faculty Instructor</th>
                    <th className="px-6 py-3">Assigned Subject</th>
                    <th className="px-6 py-3">Academic Program</th>
                    <th className="px-6 py-3">Semester & Section</th>
                    <th className="px-6 py-3">Scheduled Slots</th>
                    <th className="px-6 py-3">Academic Term</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5] dark:divide-[#262626]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-[#737373] dark:text-[#8C8C8C]">
                        <Loader2 size={20} className="animate-spin mx-auto mb-2 text-[#171717] dark:text-[#EDEDED]" />
                        <span>Loading assignments...</span>
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-[#737373] dark:text-[#8C8C8C]">
                        <BookOpen size={28} className="mx-auto mb-2 text-[#A3A3A3]" />
                        <p className="font-medium text-[#171717] dark:text-[#EDEDED]">No faculty subject allocations found</p>
                        <p className="text-[11px] mt-1 text-[#737373] dark:text-[#8C8C8C]">Assign subjects to teachers from the Faculty management tab.</p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((a) => (
                      <tr key={a.id} className="hover:bg-[#FAFAFA] dark:hover:bg-[#1A1A1A] transition-colors">
                        <td className="px-6 py-3.5">
                          <span className="font-semibold text-[#171717] dark:text-[#EDEDED]">
                            {a.teacher ? `${a.teacher.first_name} ${a.teacher.last_name}` : 'Faculty Member'}
                          </span>
                          <span className="block font-mono text-[11px] text-[#737373] dark:text-[#8C8C8C]">
                            {a.teacher?.teacher_code || '—'}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="font-semibold text-[#171717] dark:text-[#EDEDED]">{a.subject?.name}</span>
                          <span className="ml-1.5 font-mono text-[11px] text-[#737373] dark:text-[#8C8C8C]">
                            ({a.subject?.code})
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-[#171717] dark:text-[#EDEDED]">
                          {a.course?.code} - {a.course?.name}
                        </td>
                        <td className="px-6 py-3.5 text-[#525252] dark:text-[#B0B0B0]">
                          Sem {a.semester} &bull; Section {a.section}
                        </td>
                        <td className="px-6 py-3.5">
                          {a.scheduled_slots && a.scheduled_slots.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {a.scheduled_slots.map((slot, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="inline-flex items-center rounded border border-[#E5E5E5] dark:border-[#333333] bg-[#F7F7F7] dark:bg-[#1E1E1E] px-1.5 py-0.5 text-[10px] font-mono text-[#171717] dark:text-[#EDEDED]"
                                >
                                  {slot}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#A3A3A3] dark:text-[#666666] italic">
                              Unscheduled
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-[#737373] dark:text-[#8C8C8C]">
                          {a.academic_term}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Homework & Grading Status */}
      {activeTab === 'homework' && (
        <div className="rounded-xl border border-[#E5E5E5] bg-white p-8 text-center shadow-xs">
          <ClipboardList size={36} className="mx-auto mb-3 text-[#A3A3A3]" />
          <h3 className="text-sm font-semibold text-[#171717]">
            Student Assignment Submissions & Digital Grading
          </h3>
          <p className="text-xs text-[#737373] max-w-lg mx-auto mt-2 leading-relaxed">
            The student assignment distribution, digital homework submission portal, and grading rubrics
            are scheduled for the next academic release.
          </p>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 text-xs font-medium">
            <Info size={13} />
            <span>Currently, teaching allocations and course curriculum are active and synchronized.</span>
          </div>
        </div>
      )}
    </div>
  );
}
