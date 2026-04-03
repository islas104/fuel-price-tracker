export default function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-20 rounded-full bg-gray-200" />
            <div className="h-3.5 w-40 rounded bg-gray-100" />
            <div className="h-3 w-32 rounded bg-gray-100" />
          </div>
        </div>
        <div className="flex-shrink-0 space-y-1 text-right">
          <div className="h-7 w-16 rounded bg-gray-200 ml-auto" />
          <div className="h-3 w-10 rounded bg-gray-100 ml-auto" />
        </div>
      </div>
    </div>
  );
}
