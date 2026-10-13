import type { StudentStatus } from '@/src/types/student';

interface StatusBadgeProps {
  status: StudentStatus;
  className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const normalized = status?.toLowerCase() as StudentStatus;

  switch (normalized) {
    case 'active':
      return (
        <span
          className={`inline-flex items-center rounded-full border border-[#171717] bg-[#171717] px-2.5 py-0.5 text-[11px] font-medium text-white ${className}`}
        >
          Active
        </span>
      );
    case 'inactive':
      return (
        <span
          className={`inline-flex items-center rounded-full border border-[#E5E5E5] bg-[#F7F7F7] px-2.5 py-0.5 text-[11px] font-medium text-[#737373] ${className}`}
        >
          Inactive
        </span>
      );
    case 'pending':
      return (
        <span
          className={`inline-flex items-center rounded-full border border-[#D4D4D4] bg-white px-2.5 py-0.5 text-[11px] font-medium text-[#171717] ${className}`}
        >
          Pending
        </span>
      );
    case 'suspended':
      return (
        <span
          className={`inline-flex items-center rounded-full border border-[#171717] bg-[#F7F7F7] px-2.5 py-0.5 text-[11px] font-semibold text-[#171717] ${className}`}
        >
          Suspended
        </span>
      );
    case 'graduated':
      return (
        <span
          className={`inline-flex items-center rounded-full border border-[#E5E5E5] bg-white px-2.5 py-0.5 text-[11px] font-medium text-[#525252] ${className}`}
        >
          Graduated
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center rounded-full border border-[#E5E5E5] bg-[#F7F7F7] px-2.5 py-0.5 text-[11px] font-medium text-[#737373] ${className}`}
        >
          {status}
        </span>
      );
  }
}
