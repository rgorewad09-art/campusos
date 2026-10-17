export default function StudentLoading() {
  return (
    <div className="min-h-screen bg-[#F7F7F7] text-[#171717]">
      {/* Student Header Skeleton */}
      <header className="sticky top-0 z-30 border-b border-[#E5E5E5] bg-white/80 backdrop-blur-md px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold tracking-tight text-[#171717]">
              Campus<span className="text-[#737373]">OS</span>
            </span>
            <span className="rounded border border-[#E5E5E5] bg-[#F7F7F7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#737373]">
              Student Portal
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-24 bg-[#E5E5E5] rounded animate-pulse" />
          </div>
        </div>
      </header>

      {/* Main Content Skeleton */}
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Welcome card skeleton */}
        <div className="rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="h-6 w-48 bg-[#E5E5E5] rounded animate-pulse" />
              <div className="h-4 w-72 bg-[#E5E5E5] rounded animate-pulse" />
            </div>
            <div className="h-9 w-32 bg-[#E5E5E5] rounded-md animate-pulse" />
          </div>
        </div>

        {/* Metrics Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-[#E5E5E5] bg-white p-5 shadow-sm space-y-2">
              <div className="h-3 w-20 bg-[#E5E5E5] rounded animate-pulse" />
              <div className="h-7 w-24 bg-[#E5E5E5] rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Tab & Table Skeleton */}
        <div className="rounded-xl border border-[#E5E5E5] bg-white shadow-sm overflow-hidden p-6 space-y-4">
          <div className="h-5 w-40 bg-[#E5E5E5] rounded animate-pulse" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 w-full bg-[#FAFAFA] rounded border border-[#E5E5E5] animate-pulse" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
