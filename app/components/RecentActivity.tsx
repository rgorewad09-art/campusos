'use client';

import { useState, useEffect } from 'react';
import {
  Clock,
  UserPlus,
  Edit2,
  Trash2,
  UploadCloud,
  CheckCircle2,
  XCircle,
  CalendarCheck,
  Users,
  Activity,
  Loader2,
} from 'lucide-react';
import type { AuditLogEvent } from '@/src/types/analytics';
import { getRecentActivityAction } from '@/app/actions/analytics';

export default function RecentActivity() {
  const [activities, setActivities] = useState<AuditLogEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    getRecentActivityAction(8)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.events) {
          setActivities(res.events);
        }
      })
      .catch((err) => {
        console.error('Error fetching recent activity:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function getActionDetails(event: AuditLogEvent) {
    let title = event.action.replace(/_/g, ' ');
    let subtitle = '';
    let Icon = Activity;

    let parsedDetails: Record<string, unknown> = {};
    if (typeof event.details === 'string') {
      try {
        parsedDetails = JSON.parse(event.details);
      } catch {
        parsedDetails = { raw: event.details };
      }
    } else if (typeof event.details === 'object' && event.details !== null) {
      parsedDetails = event.details as Record<string, unknown>;
    }

    switch (event.action) {
      case 'enroll_student':
        title = 'Enrolled New Student';
        subtitle = parsedDetails.student_code
          ? `Generated ID: ${parsedDetails.student_code}`
          : 'Added student profile';
        Icon = UserPlus;
        break;
      case 'update_student':
        title = 'Updated Student Record';
        subtitle = parsedDetails.student_code ? `ID: ${parsedDetails.student_code}` : 'Saved details';
        Icon = Edit2;
        break;
      case 'delete_student':
        title = 'Deleted Student Record';
        subtitle = parsedDetails.student_code ? `ID: ${parsedDetails.student_code}` : 'Record removed';
        Icon = Trash2;
        break;
      case 'add_guardian':
        title = 'Added Guardian Contact';
        subtitle = String(parsedDetails.guardian_name || 'Associated contact');
        Icon = Users;
        break;
      case 'link_guardian':
        title = 'Linked Guardian';
        subtitle = 'Associated existing guardian to student';
        Icon = Users;
        break;
      case 'unlink_guardian':
        title = 'Unlinked Guardian';
        subtitle = 'Removed student-guardian relationship';
        Icon = Trash2;
        break;
      case 'upload_document':
        title = 'Uploaded Student Document';
        subtitle = String(parsedDetails.original_filename || parsedDetails.category || 'Uploaded file');
        Icon = UploadCloud;
        break;
      case 'verify_document':
        title = 'Verified Document';
        subtitle = 'Document marked as authentic and verified';
        Icon = CheckCircle2;
        break;
      case 'reject_document':
        title = 'Rejected Document';
        subtitle = parsedDetails.reason ? `Reason: ${parsedDetails.reason}` : 'Marked rejected';
        Icon = XCircle;
        break;
      case 'delete_document':
        title = 'Deleted Document';
        subtitle = 'File purged from secure storage';
        Icon = Trash2;
        break;
      case 'save_attendance_batch':
        title = 'Recorded Daily Attendance';
        subtitle = parsedDetails.totalSaved
          ? `Saved ${parsedDetails.totalSaved} student records for ${parsedDetails.attendance_date || 'date'}`
          : 'Attendance batch saved';
        Icon = CalendarCheck;
        break;
      default:
        title = event.action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        subtitle = `Entity: ${event.entity_type}`;
        Icon = Activity;
    }

    return { title, subtitle, Icon };
  }

  function formatRelativeTime(dateStr: string): string {
    try {
      const past = new Date(dateStr).getTime();
      const now = Date.now();
      const diffSec = Math.floor((now - past) / 1000);

      if (diffSec < 60) return 'Just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;

      return dateStr.split('T')[0];
    } catch {
      return dateStr;
    }
  }

  return (
    <section
      aria-labelledby="recent-activity-heading"
      className="rounded-xl border border-[#E5E5E5] bg-white p-5 flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3 mb-3">
          <div className="flex items-center gap-2">
            <h2
              id="recent-activity-heading"
              className="text-sm font-semibold text-[#171717]"
            >
              Recent Audit Activity
            </h2>
          </div>
          <span className="rounded-full bg-[#F7F7F7] border border-[#E5E5E5] px-2 py-0.5 text-[11px] font-medium text-[#737373]">
            {activities.length} recorded
          </span>
        </div>

        {isLoading ? (
          <div aria-busy="true" aria-label="Loading recent audit activity" className="divide-y divide-[#E5E5E5]">
            <span className="sr-only">Loading activity stream...</span>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} aria-hidden="true" className="py-3 flex items-start gap-3">
                <div className="h-7 w-7 rounded-md shimmer-effect shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="h-3.5 w-32 shimmer-effect rounded" />
                    <div className="h-3 w-12 shimmer-effect rounded" />
                  </div>
                  <div className="h-3 w-48 shimmer-effect rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#737373]">
            <Clock size={20} className="mx-auto text-[#737373] mb-1.5" />
            <p className="font-medium text-[#171717]">No Activity Logged Yet</p>
            <p className="text-[11px] text-[#737373] mt-0.5">
              Administrative actions such as enrollments and attendance saves will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E5E5E5]">
            {activities.map((item) => {
              const { title, subtitle, Icon } = getActionDetails(item);
              return (
                <div
                  key={item.id}
                  className="py-3 flex items-start gap-3 text-xs hover:bg-[#F7F7F7]/50 transition-colors"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#F7F7F7] border border-[#E5E5E5] text-[#171717]">
                    <Icon size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-[#171717] truncate">{title}</p>
                      <span className="text-[10px] text-[#737373] shrink-0 font-mono">
                        {formatRelativeTime(item.created_at)}
                      </span>
                    </div>
                    {subtitle && (
                      <p className="text-[11px] text-[#737373] truncate mt-0.5">
                        {subtitle}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Audit Limitation Disclaimer */}
      <div className="mt-4 border-t border-[#E5E5E5] pt-2 text-[10px] text-[#A3A3A3] text-right">
        Activity reflects administrative operations logged in public.audit_logs.
      </div>
    </section>
  );
}
