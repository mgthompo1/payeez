export default function CustomersLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-36 bg-white/5 rounded-lg" />
          <div className="h-4 w-48 bg-white/5 rounded" />
        </div>
        <div className="h-10 w-36 bg-white/5 rounded-lg" />
      </div>

      {/* Search */}
      <div className="h-10 w-80 bg-white/5 rounded-lg" />

      {/* Customer cards */}
      <div className="grid gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="p-4 rounded-xl bg-charcoal border border-white/10 flex items-center gap-4">
            <div className="h-12 w-12 bg-white/5 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-40 bg-white/5 rounded" />
              <div className="h-4 w-56 bg-white/5 rounded" />
            </div>
            <div className="text-right space-y-2">
              <div className="h-5 w-24 bg-white/5 rounded" />
              <div className="h-4 w-16 bg-white/5 rounded" />
            </div>
            <div className="h-8 w-8 bg-white/5 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
