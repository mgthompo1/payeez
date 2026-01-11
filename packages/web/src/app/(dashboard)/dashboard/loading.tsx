export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-white/5 rounded-lg" />
          <div className="h-4 w-64 bg-white/5 rounded" />
        </div>
        <div className="h-10 w-32 bg-white/5 rounded-lg" />
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-4 rounded-xl bg-charcoal border border-white/10">
            <div className="h-4 w-20 bg-white/5 rounded mb-3" />
            <div className="h-8 w-28 bg-white/5 rounded mb-2" />
            <div className="h-3 w-16 bg-white/5 rounded" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="p-6 rounded-xl bg-charcoal border border-white/10">
        <div className="h-5 w-32 bg-white/5 rounded mb-4" />
        <div className="h-64 bg-white/5 rounded-lg" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl bg-charcoal border border-white/10 overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <div className="h-5 w-40 bg-white/5 rounded" />
        </div>
        <div className="divide-y divide-white/5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 bg-white/5 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 bg-white/5 rounded" />
                <div className="h-3 w-32 bg-white/5 rounded" />
              </div>
              <div className="h-6 w-20 bg-white/5 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
