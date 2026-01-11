export default function TransactionsLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-40 bg-white/5 rounded-lg" />
          <div className="h-4 w-56 bg-white/5 rounded" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-32 bg-white/5 rounded-lg" />
          <div className="h-10 w-28 bg-white/5 rounded-lg" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="h-10 w-64 bg-white/5 rounded-lg" />
        <div className="h-10 w-32 bg-white/5 rounded-lg" />
        <div className="h-10 w-32 bg-white/5 rounded-lg" />
      </div>

      {/* Table */}
      <div className="rounded-xl bg-charcoal border border-white/10 overflow-hidden">
        <div className="grid grid-cols-6 gap-4 p-4 border-b border-white/10">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-4 bg-white/5 rounded" />
          ))}
        </div>
        <div className="divide-y divide-white/5">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="grid grid-cols-6 gap-4 p-4">
              <div className="h-4 bg-white/5 rounded" />
              <div className="h-4 bg-white/5 rounded" />
              <div className="h-4 w-20 bg-white/5 rounded" />
              <div className="h-4 bg-white/5 rounded" />
              <div className="h-6 w-16 bg-white/5 rounded-full" />
              <div className="h-4 w-24 bg-white/5 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
