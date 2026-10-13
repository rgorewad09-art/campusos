import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  description: string;
}

/**
 * PlaceholderPage – rendered for routes that are not yet implemented.
 * Replace the contents of each route's page.tsx with real UI as the
 * feature is built out.
 */
export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[#E5E5E5] bg-white text-[#737373]">
        <Construction size={22} />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-[#171717]">{title}</h2>
        <p className="mt-1.5 max-w-sm text-sm text-[#737373]">{description}</p>
      </div>
      <span className="inline-block rounded-full border border-[#E5E5E5] bg-white px-3 py-1 text-xs font-medium text-[#737373]">
        Coming soon
      </span>
    </div>
  );
}
