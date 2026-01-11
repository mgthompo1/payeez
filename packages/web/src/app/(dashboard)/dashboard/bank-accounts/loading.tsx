export default function BankAccountsLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-44 bg-white/5 rounded-lg" />
          <div className="h-4 w-64 bg-white/5 rounded" />
        </div>
        <div className="h-10 w-44 bg-white/5 rounded-lg" />
      </div>

      {/* Bank account cards */}
      <div className="grid gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="p-5 rounded-xl bg-charcoal border border-white/10">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-white/5 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-48 bg-white/5 rounded" />
                <div className="h-4 w-32 bg-white/5 rounded" />
              </div>
              <div className="h-6 w-20 bg-white/5 rounded-full" />
              <div className="h-8 w-8 bg-white/5 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
