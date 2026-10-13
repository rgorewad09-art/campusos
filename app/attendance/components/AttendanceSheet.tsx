'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Save,
  RotateCcw,
  Loader2,
  AlertCircle,
  Check,
  TrendingUp,
  MessageSquare,
  Users,
  ChevronDown,
} from 'lucide-react';
import type { Student } from '@/src/types/student';
import type {
  AttendanceRecord,
  AttendanceStatus,
  StudentAttendanceStats,
  AttendanceEntryPayload,
} from '@/src/types/attendance';
import { saveAttendanceBatchAction } from '@/app/actions/attendance';
import BulkActionModal from './BulkActionModal';
import StudentAttendanceHistoryModal from './StudentAttendanceHistoryModal';
import AttendanceTableSkeleton from '@/src/components/skeletons/AttendanceTableSkeleton';

interface RowState {
  status: AttendanceStatus | 'unmarked';
  remarks: string;
}

interface AttendanceSheetProps {
  selectedDate: string;
  students: Student[];
  records: AttendanceRecord[];
  statsMap: Record<string, StudentAttendanceStats>;
  onRefresh: () => Promise<void>;
  isLoading: boolean;
}

export default function AttendanceSheet({
  selectedDate,
  students,
  records,
  statsMap,
  onRefresh,
  isLoading,
}: AttendanceSheetProps) {
  // Staged edits: map studentId -> { status, remarks }
  const [stagedState, setStagedState] = useState<Record<string, RowState>>({});
  // Baseline loaded from DB: map studentId -> { status, remarks }
  const [baseState, setBaseState] = useState<Record<string, RowState>>({});

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus | 'unmarked'>('all');

  // Modals
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkTargetStatus, setBulkTargetStatus] = useState<AttendanceStatus>('present');
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<Student | null>(null);

  // Remarks row expansion
  const [expandedRemarksStudentId, setExpandedRemarksStudentId] = useState<string | null>(null);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  // Sync state whenever records or students change
  useEffect(() => {
    const recordMap = new Map<string, AttendanceRecord>();
    records.forEach((r) => recordMap.set(r.student_id, r));

    const initial: Record<string, RowState> = {};
    students.forEach((s) => {
      const rec = recordMap.get(s.id);
      initial[s.id] = {
        status: rec ? rec.status : 'unmarked',
        remarks: rec?.remarks || '',
      };
    });

    setBaseState(initial);
    setStagedState(initial);
    setSaveSuccessMessage(null);
    setSaveErrorMessage(null);
  }, [students, records, selectedDate]);

  // Compute dirty (modified) items
  const modifiedEntries = useMemo(() => {
    const dirty: Array<{ studentId: string; status: AttendanceStatus; remarks: string }> = [];
    for (const s of students) {
      const current = stagedState[s.id];
      const baseline = baseState[s.id];
      if (!current || !baseline) continue;

      const isChanged =
        current.status !== baseline.status || current.remarks !== baseline.remarks;
      // Only persist if marked as present, absent, or late
      if (isChanged && current.status !== 'unmarked') {
        dirty.push({
          studentId: s.id,
          status: current.status,
          remarks: current.remarks,
        });
      }
    }
    return dirty;
  }, [students, stagedState, baseState]);

  const hasUnsavedChanges = modifiedEntries.length > 0;

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // Search check
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const codeMatch = s.student_code.toLowerCase().includes(q);
        const nameMatch = `${s.first_name} ${s.middle_name || ''} ${s.last_name}`
          .toLowerCase()
          .includes(q);
        if (!codeMatch && !nameMatch) return false;
      }

      // Status filter check
      const currentStatus = stagedState[s.id]?.status || 'unmarked';
      if (statusFilter !== 'all' && currentStatus !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [students, searchQuery, statusFilter, stagedState]);

  // Status counts across ALL eligible students for current staged state
  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let unmarked = 0;

    students.forEach((s) => {
      const st = stagedState[s.id]?.status || 'unmarked';
      if (st === 'present') present++;
      else if (st === 'absent') absent++;
      else if (st === 'late') late++;
      else unmarked++;
    });

    return {
      all: students.length,
      present,
      absent,
      late,
      unmarked,
    };
  }, [students, stagedState]);

  function handleSetStatus(studentId: string, newStatus: AttendanceStatus) {
    setSaveSuccessMessage(null);
    setSaveErrorMessage(null);
    setStagedState((prev) => {
      const current = prev[studentId] || { status: 'unmarked', remarks: '' };
      return {
        ...prev,
        [studentId]: {
          ...current,
          status: current.status === newStatus ? 'unmarked' : newStatus,
        },
      };
    });
  }

  function handleSetRemarks(studentId: string, remarks: string) {
    setSaveSuccessMessage(null);
    setSaveErrorMessage(null);
    setStagedState((prev) => {
      const current = prev[studentId] || { status: 'unmarked', remarks: '' };
      return {
        ...prev,
        [studentId]: {
          ...current,
          remarks,
        },
      };
    });
  }

  function handleDiscardChanges() {
    setStagedState(baseState);
    setSaveSuccessMessage(null);
    setSaveErrorMessage(null);
  }

  function triggerBulkModal(target: AttendanceStatus) {
    setBulkTargetStatus(target);
    setBulkModalOpen(true);
  }

  function handleApplyBulkAction(mode: 'unmarked_only' | 'overwrite_all') {
    setSaveSuccessMessage(null);
    setSaveErrorMessage(null);
    setStagedState((prev) => {
      const next = { ...prev };
      filteredStudents.forEach((s) => {
        const cur = prev[s.id] || { status: 'unmarked', remarks: '' };
        if (mode === 'unmarked_only' && cur.status !== 'unmarked') {
          return; // Skip already marked
        }
        next[s.id] = {
          ...cur,
          status: bulkTargetStatus,
        };
      });
      return next;
    });
  }

  async function handleSaveAttendance() {
    if (modifiedEntries.length === 0) return;

    setIsSaving(true);
    setSaveErrorMessage(null);
    setSaveSuccessMessage(null);

    try {
      const payload: AttendanceEntryPayload[] = modifiedEntries.map((e) => ({
        studentId: e.studentId,
        status: e.status,
        remarks: e.remarks,
      }));

      const res = await saveAttendanceBatchAction(selectedDate, payload);

      if (!res.success) {
        setSaveErrorMessage(res.error || 'Failed to save attendance records.');
      } else {
        setSaveSuccessMessage(
          `Successfully saved ${res.savedCount ?? payload.length} attendance record${
            (res.savedCount ?? payload.length) === 1 ? '' : 's'
          } for ${selectedDate}.`
        );
        // Refresh live data from server to align base state
        await onRefresh();
      }
    } catch (err: unknown) {
      setSaveErrorMessage(
        err instanceof Error ? err.message : 'An unexpected error occurred while saving.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737373]"
          />
          <input
            type="text"
            placeholder="Search by student name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-[#E5E5E5] bg-white pl-9 pr-3 py-2 text-xs text-[#171717] placeholder:text-[#A3A3A3] focus:border-[#171717] focus:outline-none transition-colors"
          />
        </div>

        {/* Status filter tabs */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-[#171717] text-white'
                : 'border border-[#E5E5E5] bg-white text-[#737373] hover:text-[#171717]'
            }`}
          >
            All ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('present')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === 'present'
                ? 'bg-[#171717] text-white'
                : 'border border-[#E5E5E5] bg-white text-[#737373] hover:text-[#171717]'
            }`}
          >
            Present ({counts.present})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('absent')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === 'absent'
                ? 'bg-[#171717] text-white'
                : 'border border-[#E5E5E5] bg-white text-[#737373] hover:text-[#171717]'
            }`}
          >
            Absent ({counts.absent})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('late')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === 'late'
                ? 'bg-[#171717] text-white'
                : 'border border-[#E5E5E5] bg-white text-[#737373] hover:text-[#171717]'
            }`}
          >
            Late ({counts.late})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('unmarked')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === 'unmarked'
                ? 'bg-[#171717] text-white'
                : 'border border-[#E5E5E5] bg-white text-[#737373] hover:text-[#171717]'
            }`}
          >
            Unmarked ({counts.unmarked})
          </button>
        </div>
      </div>

      {/* Action / Notification Banner */}
      {saveSuccessMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-[#171717] bg-[#F7F7F7] p-3 text-xs text-[#171717]">
          <CheckCircle2 size={15} className="shrink-0 text-[#171717]" />
          <span className="flex-1 font-medium">{saveSuccessMessage}</span>
          <button
            onClick={() => setSaveSuccessMessage(null)}
            className="text-[#737373] hover:text-[#171717]"
          >
            ✕
          </button>
        </div>
      )}

      {saveErrorMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-[#171717] bg-white p-3 text-xs text-[#171717]">
          <AlertCircle size={15} className="shrink-0 text-[#171717]" />
          <span className="flex-1">{saveErrorMessage}</span>
          <button
            onClick={() => setSaveErrorMessage(null)}
            className="text-[#737373] hover:text-[#171717]"
          >
            ✕
          </button>
        </div>
      )}

      {/* Bulk and Save Action Bar */}
      <div className="rounded-xl border border-[#E5E5E5] bg-white p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Bulk buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#737373] mr-1">
            Bulk Actions:
          </span>
          <button
            type="button"
            onClick={() => triggerBulkModal('present')}
            disabled={filteredStudents.length === 0 || isSaving}
            className="rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#F7F7F7] transition-colors disabled:opacity-50"
          >
            Mark All Present
          </button>
          <button
            type="button"
            onClick={() => triggerBulkModal('absent')}
            disabled={filteredStudents.length === 0 || isSaving}
            className="rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#F7F7F7] transition-colors disabled:opacity-50"
          >
            Mark All Absent
          </button>
        </div>

        {/* Save & Discard Buttons */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          {hasUnsavedChanges && (
            <button
              type="button"
              onClick={handleDiscardChanges}
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs font-medium text-[#737373] hover:text-[#171717] hover:bg-[#F7F7F7] transition-colors disabled:opacity-50"
            >
              <RotateCcw size={12} />
              <span>Discard Changes</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveAttendance}
            disabled={!hasUnsavedChanges || isSaving}
            className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
              hasUnsavedChanges
                ? 'bg-[#171717] text-white hover:bg-[#262626]'
                : 'bg-[#F7F7F7] text-[#A3A3A3] border border-[#E5E5E5] cursor-not-allowed'
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save size={13} />
                <span>
                  {hasUnsavedChanges
                    ? `Save ${modifiedEntries.length} Change${modifiedEntries.length === 1 ? '' : 's'}`
                    : 'Save Attendance'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-xl border border-[#E5E5E5] bg-white overflow-hidden">
        {isLoading ? (
          <AttendanceTableSkeleton rows={8} />
        ) : filteredStudents.length === 0 ? (
          <div className="py-16 text-center">
            <Users size={24} className="mx-auto text-[#737373] mb-2" />
            <h3 className="text-sm font-semibold text-[#171717]">
              No Students Found
            </h3>
            <p className="mt-1 text-xs text-[#737373]">
              {searchQuery
                ? 'No students match your search criteria.'
                : statusFilter !== 'all'
                ? `No students currently have status "${statusFilter}".`
                : 'No active eligible students enrolled in the system.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E5E5E5] bg-[#F7F7F7] text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-5 py-3">
                    Student
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Code
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Historical Attendance
                  </th>
                  <th scope="col" className="px-5 py-3 text-center">
                    Mark Attendance
                  </th>
                  <th scope="col" className="px-5 py-3 text-right">
                    Remarks
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {filteredStudents.map((student) => {
                  const state = stagedState[student.id] || {
                    status: 'unmarked',
                    remarks: '',
                  };
                  const baseline = baseState[student.id] || {
                    status: 'unmarked',
                    remarks: '',
                  };
                  const isModified =
                    state.status !== baseline.status || state.remarks !== baseline.remarks;
                  const stats = statsMap[student.id];
                  const fullName = [student.first_name, student.middle_name, student.last_name]
                    .filter(Boolean)
                    .join(' ');
                  const isRemarksExpanded = expandedRemarksStudentId === student.id;

                  return (
                    <tr
                      key={student.id}
                      className={`hover:bg-[#F7F7F7]/60 transition-colors ${
                        isModified ? 'bg-[#F7F7F7]/40' : ''
                      }`}
                    >
                      {/* Student Name */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          {isModified && (
                            <span
                              className="h-1.5 w-1.5 rounded-full bg-[#171717]"
                              title="Unsaved change"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedStudentForHistory(student)}
                            className="font-medium text-[#171717] hover:underline text-left"
                            title="Click to view full attendance history"
                          >
                            {fullName}
                          </button>
                        </div>
                      </td>

                      {/* Code */}
                      <td className="px-5 py-3.5 font-mono text-[11px] text-[#737373]">
                        {student.student_code}
                      </td>

                      {/* Historical Attendance Rate */}
                      <td className="px-5 py-3.5">
                        {stats && stats.percentage !== null ? (
                          <button
                            type="button"
                            onClick={() => setSelectedStudentForHistory(student)}
                            className="inline-flex items-center gap-1.5 text-xs text-[#171717] hover:underline"
                            title="Attendance among recorded sessions"
                          >
                            <TrendingUp size={12} className="text-[#737373]" />
                            <span className="font-semibold font-mono">
                              {stats.percentage}%
                            </span>
                            <span className="text-[11px] text-[#737373]">
                              ({stats.presentCount}/{stats.totalSessions})
                            </span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-[#A3A3A3]">
                            No recorded sessions
                          </span>
                        )}
                      </td>

                      {/* Mark Status (3 Segment Buttons) */}
                      <td className="px-5 py-3.5 text-center">
                        <div className="inline-flex rounded-lg border border-[#E5E5E5] bg-white p-0.5 shadow-sm">
                          {/* Present Button */}
                          <button
                            type="button"
                            onClick={() => handleSetStatus(student.id, 'present')}
                            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                              state.status === 'present'
                                ? 'bg-[#171717] text-white shadow-sm'
                                : 'text-[#737373] hover:text-[#171717] hover:bg-[#F7F7F7]'
                            }`}
                          >
                            <CheckCircle2 size={12} />
                            <span>Present</span>
                          </button>

                          {/* Absent Button */}
                          <button
                            type="button"
                            onClick={() => handleSetStatus(student.id, 'absent')}
                            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                              state.status === 'absent'
                                ? 'bg-[#171717] text-white shadow-sm'
                                : 'text-[#737373] hover:text-[#171717] hover:bg-[#F7F7F7]'
                            }`}
                          >
                            <XCircle size={12} />
                            <span>Absent</span>
                          </button>

                          {/* Late Button */}
                          <button
                            type="button"
                            onClick={() => handleSetStatus(student.id, 'late')}
                            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                              state.status === 'late'
                                ? 'bg-[#171717] text-white shadow-sm'
                                : 'text-[#737373] hover:text-[#171717] hover:bg-[#F7F7F7]'
                            }`}
                          >
                            <Clock size={12} />
                            <span>Late</span>
                          </button>
                        </div>
                      </td>

                      {/* Remarks */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isRemarksExpanded ? (
                            <input
                              type="text"
                              value={state.remarks}
                              placeholder="Optional remarks..."
                              onChange={(e) => handleSetRemarks(student.id, e.target.value)}
                              className="rounded border border-[#171717] bg-white px-2 py-1 text-xs text-[#171717] focus:outline-none w-48"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedRemarksStudentId(
                                  isRemarksExpanded ? null : student.id
                                )
                              }
                              className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                                state.remarks
                                  ? 'border border-[#171717] bg-[#F7F7F7] text-[#171717]'
                                  : 'text-[#737373] hover:text-[#171717] hover:bg-[#F7F7F7]'
                              }`}
                              title={state.remarks ? `Remarks: ${state.remarks}` : 'Add remarks'}
                            >
                              <MessageSquare size={12} />
                              <span className="truncate max-w-[120px]">
                                {state.remarks ? state.remarks : 'Add Note'}
                              </span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk Action Modal */}
      <BulkActionModal
        isOpen={bulkModalOpen}
        targetStatus={bulkTargetStatus}
        totalVisible={filteredStudents.length}
        alreadyMarkedCount={
          filteredStudents.filter((s) => stagedState[s.id]?.status !== 'unmarked').length
        }
        onConfirm={handleApplyBulkAction}
        onClose={() => setBulkModalOpen(false)}
      />

      {/* History Modal */}
      <StudentAttendanceHistoryModal
        isOpen={Boolean(selectedStudentForHistory)}
        student={selectedStudentForHistory}
        onClose={() => setSelectedStudentForHistory(null)}
      />
    </div>
  );
}
