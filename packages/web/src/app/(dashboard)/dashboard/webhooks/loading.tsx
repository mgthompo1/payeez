export default function WebhooksLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-36 bg-white/5 rounded-lg" />
          <div className="h-4 w-72 bg-white/5 rounded" />
        </div>
        <div className="h-10 w-40 bg-white/5 rounded-lg" />
      </div>

      {/* Endpoint cards */}
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="p-5 rounded-xl bg-charcoal border border-white/10">
            <div className="flex items-start justify-between mb-4">
              <div className="space-y-2">
                <div className="h-5 w-64 bg-white/5 rounded" />
                <div className="h-4 w-40 bg-white/5 rounded" />
              </div>
              <div className="h-6 w-16 bg-white/5 rounded-full" />
            </div>
            <div className="flex gap-2">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="h-6 w-24 bg-white/5 rounded-full" />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Recent deliveries */}
      <div className="rounded-xl bg-charcoal border border-white/10 overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <div className="h-5 w-40 bg-white/5 rounded" />
        </div>
        <div className="divide-y divide-white/5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-4 flex items-center gap-4">
              <div className="h-3 w-3 bg-white/5 rounded-full" />
              <div className="h-4 w-32 bg-white/5 rounded" />
              <div className="h-4 w-48 bg-white/5 rounded" />
              <div className="flex-1" />
              <div className="h-4 w-20 bg-white/5 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
