'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  KeyRound,
  Clock,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  Wifi,
  Sparkles,
  ShieldCheck,
  Building,
  User,
} from 'lucide-react';
import {
  getStudentActiveAttendanceSessionsAction,
  submitStudentOtpAttendanceAction,
} from '@/app/actions/studentAttendance';

interface ActiveSessionItem {
  id: string;
  courseCode: string;
  courseName: string;
  subjectCode: string;
  subjectName: string;
  section: string;
  semester: number;
  teacherName: string;
  expiresAt: string;
  alreadyMarked: boolean;
}

interface StudentOtpCheckInProps {
  onAttendanceRecorded?: () => void;
}

export default function StudentOtpCheckIn({ onAttendanceRecorded }: StudentOtpCheckInProps) {
  const [sessions, setSessions] = useState<ActiveSessionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [otpValues, setOtpValues] = useState<Record<string, string>>({});
  const [submittingSessionId, setSubmittingSessionId] = useState<string | null>(null);
  const [errorFeedback, setErrorFeedback] = useState<Record<string, string>>({});
  const [successFeedback, setSuccessFeedback] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState<Record<string, number>>({});
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchSessions = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const res = await getStudentActiveAttendanceSessionsAction();
      if (res.success && res.sessions) {
        setSessions(res.sessions);
      }
    } catch (err: unknown) {
      console.error('[StudentOtpCheckIn] fetchSessions error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Tick countdown timer every second
  useEffect(() => {
    if (!isMounted || sessions.length === 0) return;

    const updateTimers = () => {
      const now = Date.now();
      const updated: Record<string, number> = {};
      sessions.forEach((s) => {
        const diff = Math.max(0, Math.floor((new Date(s.expiresAt).getTime() - now) / 1000));
        updated[s.id] = diff;
      });
      setTimeRemaining(updated);
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);
    return () => clearInterval(interval);
  }, [isMounted, sessions]);

  // Auto-refresh sessions every 30 seconds
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      fetchSessions(true);
    }, 30000);
    return () => clearInterval(refreshInterval);
  }, [fetchSessions]);

  const handleOtpChange = (sessionId: string, value: string) => {
    // Only numbers, max 6 digits
    const clean = value.replace(/\D/g, '').slice(0, 6);
    setOtpValues((prev) => ({ ...prev, [sessionId]: clean }));
    if (errorFeedback[sessionId]) {
      setErrorFeedback((prev) => {
        const copy = { ...prev };
        delete copy[sessionId];
        return copy;
      });
    }
  };

  const handleSubmit = async (sessionId: string) => {
    const code = otpValues[sessionId]?.trim();
    if (!code || code.length !== 6) {
      setErrorFeedback((prev) => ({
        ...prev,
        [sessionId]: 'Please enter a complete 6-digit attendance code.',
      }));
      return;
    }

    setSubmittingSessionId(sessionId);
    setErrorFeedback((prev) => {
      const copy = { ...prev };
      delete copy[sessionId];
      return copy;
    });

    try {
      const res = await submitStudentOtpAttendanceAction({
        sessionId,
        otpCode: code,
      });

      if (!res.success) {
        setErrorFeedback((prev) => ({
          ...prev,
          [sessionId]: res.error || 'Failed to submit attendance.',
        }));
      } else {
        setSuccessFeedback((prev) => ({
          ...prev,
          [sessionId]: res.message || 'Attendance recorded successfully!',
        }));
        // Update session in-place
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, alreadyMarked: true } : s))
        );
        if (onAttendanceRecorded) {
          onAttendanceRecorded();
        }
      }
    } catch (err: unknown) {
      setErrorFeedback((prev) => ({
        ...prev,
        [sessionId]: err instanceof Error ? err.message : 'Submission failed.',
      }));
    } finally {
      setSubmittingSessionId(null);
    }
  };

  const formatSeconds = (sec: number | undefined) => {
    if (sec === undefined || sec <= 0) return 'Expired';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white shadow-sm overflow-hidden mb-6">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#E5E5E5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-white via-[#FAFAFA] to-white">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[#111111] text-white flex items-center justify-center shrink-0 shadow-sm">
            <KeyRound size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[#171717]">
                Live Attendance Check-In
              </h3>
              {sessions.filter((s) => !s.alreadyMarked && (timeRemaining[s.id] ?? 1) > 0).length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  Session Active
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#737373] mt-0.5">
              Enter the 6-digit one-time code broadcasted by your instructor during class.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => fetchSessions(true)}
            disabled={isLoading || isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs font-medium text-[#737373] hover:text-[#171717] hover:border-[#171717] transition-colors disabled:opacity-50"
            title="Refresh active sessions"
          >
            <RotateCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {isLoading ? (
          <div className="py-8 text-center text-xs text-[#737373] flex items-center justify-center gap-2">
            <RotateCw size={14} className="animate-spin text-[#171717]" />
            <span>Checking for live attendance sessions...</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-8 px-4 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center text-[#737373] mb-3">
              <Sparkles size={20} />
            </div>
            <h4 className="text-xs font-semibold text-[#171717]">No Active Sessions</h4>
            <p className="text-[11px] text-[#737373] max-w-md mx-auto mt-1 leading-relaxed">
              There are currently no active attendance sessions open for your enrolled courses.
              When your instructor initiates a session, it will automatically appear here.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-[#737373]">
              <Wifi size={12} className="text-emerald-600" />
              <span>Campus network verification is active</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => {
              const secondsLeft = timeRemaining[session.id];
              const isExpired = secondsLeft !== undefined && secondsLeft <= 0;
              const isSubmitting = submittingSessionId === session.id;
              const hasError = Boolean(errorFeedback[session.id]);
              const hasSuccess = Boolean(successFeedback[session.id]);
              const code = otpValues[session.id] || '';

              return (
                <div
                  key={session.id}
                  className={`rounded-lg border p-5 transition-all ${
                    session.alreadyMarked
                      ? 'border-[#BBF7D0] bg-[#F0FDF4]/30'
                      : isExpired
                      ? 'border-[#E5E5E5] bg-[#FAFAFA] opacity-70'
                      : 'border-[#171717]/20 bg-white shadow-sm ring-1 ring-[#171717]/5'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    {/* Class & Subject Details */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#171717] bg-[#F5F5F5] px-2 py-0.5 rounded border border-[#E5E5E5]">
                          {session.subjectCode}
                        </span>
                        <h4 className="text-sm font-semibold text-[#171717]">
                          {session.subjectName}
                        </h4>
                        <span className="text-[11px] text-[#737373]">
                          &bull; {session.courseCode} (Section {session.section}, Sem {session.semester})
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-[#737373] pt-0.5">
                        <span className="inline-flex items-center gap-1.5">
                          <User size={13} className="text-[#171717]" />
                          <span>{session.teacherName}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Building size={13} className="text-[#171717]" />
                          <span>Section {session.section}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock size={13} className="text-[#171717]" />
                          {session.alreadyMarked ? (
                            <span className="text-emerald-700 font-medium">Session recorded</span>
                          ) : isExpired ? (
                            <span className="text-rose-600 font-medium">Expired</span>
                          ) : (
                            <span className="text-amber-700 font-medium">
                              Expires in {formatSeconds(secondsLeft)}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Action Area */}
                    <div className="md:w-80 shrink-0">
                      {session.alreadyMarked ? (
                        <div className="rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] p-3 text-xs text-[#166534] flex items-center gap-2.5">
                          <CheckCircle2 size={18} className="shrink-0 text-[#166534]" />
                          <div>
                            <p className="font-semibold">Attendance Confirmed</p>
                            <p className="text-[11px] opacity-90">
                              {successFeedback[session.id] || 'Your presence has been recorded for this session.'}
                            </p>
                          </div>
                        </div>
                      ) : isExpired ? (
                        <div className="rounded-lg border border-[#E5E5E5] bg-[#F5F5F5] p-3 text-xs text-[#737373] flex items-center gap-2">
                          <Clock size={16} />
                          <span>This attendance session has ended.</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleSubmit(session.id);
                            }}
                            className="flex items-center gap-2"
                          >
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={6}
                              value={code}
                              onChange={(e) => handleOtpChange(session.id, e.target.value)}
                              placeholder="6-digit OTP"
                              disabled={isSubmitting}
                              className="w-full text-center font-mono text-base tracking-widest font-bold rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-[#171717] placeholder:text-[#A3A3A3] placeholder:tracking-normal placeholder:font-sans placeholder:text-xs focus:border-[#171717] focus:outline-none focus:ring-1 focus:ring-[#171717]"
                            />
                            <button
                              type="submit"
                              disabled={code.length !== 6 || isSubmitting}
                              className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-md bg-[#111111] px-4 py-2 text-xs font-semibold text-white hover:bg-[#262626] transition-colors disabled:opacity-40"
                            >
                              {isSubmitting ? (
                                <RotateCw size={13} className="animate-spin" />
                              ) : (
                                <ShieldCheck size={14} />
                              )}
                              <span>Check In</span>
                            </button>
                          </form>

                          {hasError && (
                            <div className="rounded-md border border-[#FECACA] bg-[#FEF2F2] p-2 text-[11px] text-[#991B1B] flex items-start gap-1.5">
                              <AlertCircle size={13} className="shrink-0 mt-0.5" />
                              <span className="leading-tight">{errorFeedback[session.id]}</span>
                            </div>
                          )}

                          {hasSuccess && (
                            <div className="rounded-md border border-[#BBF7D0] bg-[#F0FDF4] p-2 text-[11px] text-[#166534] flex items-start gap-1.5">
                              <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
                              <span className="leading-tight">{successFeedback[session.id]}</span>
                            </div>
                          )}

                          <div className="flex items-center justify-between text-[10px] text-[#737373] px-1">
                            <span className="inline-flex items-center gap-1">
                              <Wifi size={10} className="text-emerald-600" />
                              <span>Campus Wi-Fi</span>
                            </span>
                            <span>Max 5 attempts allowed</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
