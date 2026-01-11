export default function DocsLoading() {
  return (
    <div className="flex min-h-screen animate-pulse">
      {/* Sidebar skeleton */}
      <aside className="w-64 border-r border-white/10 p-4 space-y-6 hidden lg:block">
        <div className="h-10 bg-white/5 rounded-lg" />
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-8 bg-white/5 rounded" />
          ))}
        </div>
        <div className="pt-4 border-t border-white/10 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 bg-white/5 rounded" />
          ))}
        </div>
      </aside>

      {/* Main content skeleton */}
      <main className="flex-1 p-8 space-y-8">
        <div className="space-y-2">
          <div className="h-10 w-64 bg-white/5 rounded-lg" />
          <div className="h-5 w-96 bg-white/5 rounded" />
        </div>

        {/* Code block skeleton */}
        <div className="rounded-xl bg-charcoal border border-white/10 overflow-hidden">
          <div className="flex gap-2 p-3 border-b border-white/10">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-8 w-20 bg-white/5 rounded" />
            ))}
          </div>
          <div className="p-4 space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-4 bg-white/5 rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
            ))}
          </div>
        </div>

        {/* Endpoint cards skeleton */}
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-4 rounded-xl bg-charcoal border border-white/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-6 w-16 bg-white/5 rounded" />
                <div className="h-5 w-48 bg-white/5 rounded" />
              </div>
              <div className="h-4 w-72 bg-white/5 rounded" />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
