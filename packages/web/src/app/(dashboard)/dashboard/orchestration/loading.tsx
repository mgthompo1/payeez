export default function OrchestrationLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-44 bg-white/5 rounded-lg" />
          <div className="h-4 w-72 bg-white/5 rounded" />
        </div>
        <div className="h-10 w-32 bg-white/5 rounded-lg" />
      </div>

      {/* Rules cards */}
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-5 rounded-xl bg-charcoal border border-white/10">
            <div className="flex items-start justify-between mb-4">
              <div className="space-y-2">
                <div className="h-5 w-48 bg-white/5 rounded" />
                <div className="h-4 w-64 bg-white/5 rounded" />
              </div>
              <div className="flex gap-2">
                <div className="h-6 w-16 bg-white/5 rounded-full" />
                <div className="h-6 w-6 bg-white/5 rounded" />
              </div>
            </div>
            <div className="flex gap-4">
              <div className="h-8 w-32 bg-white/5 rounded-lg" />
              <div className="h-8 w-8 bg-white/5 rounded" />
              <div className="h-8 w-40 bg-white/5 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
