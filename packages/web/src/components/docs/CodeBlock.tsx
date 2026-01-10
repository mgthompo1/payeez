'use client'

import { useState, useEffect } from 'react'
import { Check, Copy } from 'lucide-react'
import { highlightCode, type SupportedLanguage } from './highlighter'

interface CodeBlockProps {
  code: string
  language?: SupportedLanguage | 'tsx' | 'curl' | 'shell' | 'sh' | 'js' | 'ts' | 'py' | 'rb' | 'golang'
  title?: string
  showLineNumbers?: boolean
}

export function CodeBlock({
  code,
  language = 'bash',
  title,
  showLineNumbers = false
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const [highlightedHtml, setHighlightedHtml] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function highlight() {
      try {
        const html = await highlightCode(code, language as SupportedLanguage)
        if (mounted) {
          setHighlightedHtml(html)
          setIsLoading(false)
        }
      } catch (error) {
        console.error('Failed to highlight code:', error)
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    highlight()

    return () => {
      mounted = false
    }
  }, [code, language])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border border-white/10 bg-[#0d1117] overflow-hidden">
      {title && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5">
          <span className="text-xs font-mono text-slate-400">{title}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      )}
      <div className="relative group">
        {!title && (
          <button
            onClick={handleCopy}
            className="absolute right-3 top-3 flex items-center gap-1.5 text-xs text-slate-500 hover:text-cyan-400 transition-colors opacity-0 group-hover:opacity-100"
          >
            {copied ? (
              <Check className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        )}
        <div className="overflow-x-auto">
          {isLoading ? (
            <pre className="p-4 text-sm font-mono text-slate-300">
              <code>{code}</code>
            </pre>
          ) : (
            <div
              className="shiki-container text-sm [&_pre]:!bg-transparent [&_pre]:p-4 [&_pre]:m-0 [&_code]:font-mono"
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
