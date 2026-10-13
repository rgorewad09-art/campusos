'use client';

import { useState, useEffect } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import {
  formatLocalDateWithWeekday,
  addDaysToDateString,
  getLocalTodayString,
} from '@/src/lib/dateUtils';

interface AttendanceDatePickerProps {
  selectedDate: string;
  onDateChange: (newDate: string) => void;
  disabled?: boolean;
}

export default function AttendanceDatePicker({
  selectedDate,
  onDateChange,
  disabled,
}: AttendanceDatePickerProps) {
  const [todayStr, setTodayStr] = useState<string>('');

  useEffect(() => {
    setTodayStr(getLocalTodayString());
  }, []);

  const isToday = selectedDate && todayStr ? selectedDate === todayStr : false;

  function handlePrevDay() {
    onDateChange(addDaysToDateString(selectedDate, -1));
  }

  function handleNextDay() {
    onDateChange(addDaysToDateString(selectedDate, 1));
  }

  function handleGoToday() {
    onDateChange(todayStr);
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-[#E5E5E5] bg-white p-4">
      {/* Date display & native input */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F7F7F7] border border-[#E5E5E5] text-[#171717]">
          <Calendar size={18} />
        </div>
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#737373]">
            Attendance Session Date
          </span>
          <p className="text-sm font-semibold text-[#171717]">
            {formatLocalDateWithWeekday(selectedDate)}
          </p>
        </div>
      </div>

      {/* Date picker controls */}
      <div className="flex items-center gap-2 self-start sm:self-auto">
        {/* Quick Today button */}
        {!isToday && (
          <button
            type="button"
            onClick={handleGoToday}
            disabled={disabled}
            className="flex items-center gap-1.5 rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#F7F7F7] transition-colors disabled:opacity-50"
          >
            <RotateCcw size={12} />
            <span>Today</span>
          </button>
        )}

        {/* Prev day */}
        <button
          type="button"
          onClick={handlePrevDay}
          disabled={disabled}
          className="rounded-md border border-[#E5E5E5] bg-white p-1.5 text-[#171717] hover:bg-[#F7F7F7] transition-colors disabled:opacity-50"
          aria-label="Previous day"
          title="Previous day"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Native HTML5 date input */}
        <input
          type="date"
          value={selectedDate}
          max={todayStr}
          disabled={disabled}
          onChange={(e) => {
            if (e.target.value) onDateChange(e.target.value);
          }}
          className="rounded-md border border-[#E5E5E5] bg-white px-2.5 py-1.5 text-xs font-medium text-[#171717] focus:border-[#171717] focus:outline-none transition-colors"
        />

        {/* Next day */}
        <button
          type="button"
          onClick={handleNextDay}
          disabled={disabled}
          className="rounded-md border border-[#E5E5E5] bg-white p-1.5 text-[#171717] hover:bg-[#F7F7F7] transition-colors disabled:opacity-50"
          aria-label="Next day"
          title="Next day"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
