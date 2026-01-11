export default function ProcessorsLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-40 bg-white/5 rounded-lg" />
          <div className="h-4 w-64 bg-white/5 rounded" />
        </div>
        <div className="h-10 w-40 bg-white/5 rounded-lg" />
      </div>

      {/* Processor grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="p-5 rounded-xl bg-charcoal border border-white/10">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-12 w-12 bg-white/5 rounded-lg" />
              <div className="space-y-2">
                <div className="h-5 w-24 bg-white/5 rounded" />
                <div className="h-4 w-16 bg-white/5 rounded" />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <div className="h-6 w-20 bg-white/5 rounded-full" />
              <div className="h-8 w-20 bg-white/5 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
