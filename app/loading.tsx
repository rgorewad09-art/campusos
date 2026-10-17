export default function RootLoading() {
  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col items-center justify-center p-6 select-none">
      <div className="flex flex-col items-center space-y-4 max-w-sm w-full text-center">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-[#171717]">
            Campus<span className="text-[#737373]">OS</span>
          </span>
        </div>
        <div className="w-48 h-1 bg-[#E5E5E5] rounded-full overflow-hidden relative">
          <div className="h-full bg-[#171717] rounded-full animate-pulse w-3/4" />
        </div>
        <p className="text-[11px] font-medium text-[#737373] tracking-wide">
          Verifying session & loading portal...
        </p>
      </div>
    </div>
  );
}
