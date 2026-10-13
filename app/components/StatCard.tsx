import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  /** Value is intentionally typed as string to allow future DB-driven formatting */
  value: string;
  icon: LucideIcon;
  /** Optional sublabel for extra context */
  sublabel?: string;
}

/**
 * StatCard – visual-only dashboard statistic card.
 *
 * NOTE: All values passed here are TEMPORARY placeholders for visual
 * development only. Replace `value` props with real database queries
 * when the data layer is connected.
 */
export default function StatCard({ label, value, icon: Icon, sublabel }: StatCardProps) {
  return (
    <article className="flex flex-col gap-4 rounded-lg border border-[#E5E5E5] bg-white p-5">
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-[#737373]">{label}</span>
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#F7F7F7] text-[#171717]">
          <Icon size={16} strokeWidth={2} />
        </div>
      </div>
      <div>
        <p className="text-3xl font-semibold tracking-tight text-[#171717]">{value}</p>
        {sublabel && (
          <p className="mt-1 text-xs text-[#737373]">{sublabel}</p>
        )}
      </div>
    </article>
  );
}
