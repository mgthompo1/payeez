export default function TeamLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-24 bg-white/5 rounded-lg" />
          <div className="h-4 w-56 bg-white/5 rounded" />
        </div>
        <div className="h-10 w-36 bg-white/5 rounded-lg" />
      </div>

      {/* Team members */}
      <div className="rounded-xl bg-charcoal border border-white/10 overflow-hidden">
        <div className="divide-y divide-white/5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 bg-white/5 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-36 bg-white/5 rounded" />
                <div className="h-3 w-48 bg-white/5 rounded" />
              </div>
              <div className="h-6 w-20 bg-white/5 rounded-full" />
              <div className="h-8 w-8 bg-white/5 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Pending invites */}
      <div className="space-y-2">
        <div className="h-5 w-32 bg-white/5 rounded" />
        <div className="rounded-xl bg-charcoal border border-white/10 p-4">
          <div className="flex items-center gap-4">
            <div className="h-4 w-48 bg-white/5 rounded" />
            <div className="flex-1" />
            <div className="h-6 w-16 bg-white/5 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
