export default function SettingsLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-8 w-32 bg-white/5 rounded-lg" />
        <div className="h-4 w-64 bg-white/5 rounded" />
      </div>

      {/* Settings sections */}
      <div className="space-y-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-6 rounded-xl bg-charcoal border border-white/10">
            <div className="h-5 w-40 bg-white/5 rounded mb-4" />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="h-4 w-32 bg-white/5 rounded" />
                  <div className="h-3 w-56 bg-white/5 rounded" />
                </div>
                <div className="h-6 w-12 bg-white/5 rounded-full" />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="h-4 w-40 bg-white/5 rounded" />
                  <div className="h-3 w-48 bg-white/5 rounded" />
                </div>
                <div className="h-10 w-48 bg-white/5 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
