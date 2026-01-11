import Link from 'next/link'
import { ArrowLeft, Github, BookOpen } from 'lucide-react'

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-obsidian text-[#E5E5E5] font-sans antialiased">
      {/* Public Docs Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-charcoal/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-6 h-6 flex items-center justify-center rounded-sm transition-transform group-hover:scale-105">
                <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L1 21h22L12 2zm0 3.5L19.5 19h-15L12 5.5z"/>
                </svg>
              </div>
              <span className="font-medium tracking-tight text-sm text-white">Atlas</span>
            </Link>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <BookOpen className="w-4 h-4" />
              <span>API Reference</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://github.com/atlas-pay"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white transition-colors"
            >
              <Github className="w-5 h-5" />
            </a>
            <Link
              href="/login"
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-sm px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main>
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-charcoal py-8 mt-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L1 21h22L12 2zm0 3.5L19.5 19h-15L12 5.5z"/>
              </svg>
              <span>© 2024 Atlas. All rights reserved.</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/docs" className="hover:text-cyan-400 transition-colors">API Docs</Link>
              <Link href="/login" className="hover:text-cyan-400 transition-colors">Dashboard</Link>
              <a href="https://github.com/atlas-pay" className="hover:text-cyan-400 transition-colors">GitHub</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
