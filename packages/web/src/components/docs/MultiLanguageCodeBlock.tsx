'use client'

import { useState, useEffect } from 'react'
import { Check, Copy } from 'lucide-react'
import { highlightCode, type SupportedLanguage } from './highlighter'
import { LanguageIcon, languageLabels, type LanguageKey } from './LanguageIcon'

const STORAGE_KEY = 'atlas-docs-preferred-language'

type LanguageExamples = Partial<Record<LanguageKey, string>>

interface MultiLanguageCodeBlockProps {
  title?: string
  examples: LanguageExamples
  defaultLanguage?: LanguageKey
}

export function MultiLanguageCodeBlock({
  title,
  examples,
  defaultLanguage = 'curl'
}: MultiLanguageCodeBlockProps) {
  const [selectedLang, setSelectedLang] = useState<LanguageKey>(defaultLanguage)
  const [copied, setCopied] = useState(false)
  const [highlightedCode, setHighlightedCode] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)

  const availableLanguages = Object.keys(examples) as LanguageKey[]

  // Load preferred language from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && availableLanguages.includes(stored as LanguageKey)) {
      setSelectedLang(stored as LanguageKey)
    } else if (!availableLanguages.includes(selectedLang)) {
      setSelectedLang(availableLanguages[0])
    }
  }, [availableLanguages])

  // Highlight all code examples
  useEffect(() => {
    let mounted = true

    async function highlightAll() {
      const highlighted: Record<string, string> = {}

      // Map language keys to Shiki language identifiers
      const langMap: Record<LanguageKey, SupportedLanguage> = {
        curl: 'bash',
        bash: 'bash',
        javascript: 'javascript',
        typescript: 'typescript',
        python: 'python',
        ruby: 'ruby',
        go: 'go',
        php: 'php',
        json: 'json'
      }

      for (const [lang, code] of Object.entries(examples)) {
        if (code) {
          try {
            const shikiLang = langMap[lang as LanguageKey] || 'bash'
            highlighted[lang] = await highlightCode(code, shikiLang)
          } catch (error) {
            console.error(`Failed to highlight ${lang}:`, error)
          }
        }
      }

      if (mounted) {
        setHighlightedCode(highlighted)
        setIsLoading(false)
      }
    }

    highlightAll()

    return () => {
      mounted = false
    }
  }, [examples])

  const handleLanguageChange = (lang: LanguageKey) => {
    setSelectedLang(lang)
    localStorage.setItem(STORAGE_KEY, lang)
  }

  const handleCopy = async () => {
    const code = examples[selectedLang]
    if (code) {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const currentCode = examples[selectedLang] || ''
  const currentHighlighted = highlightedCode[selectedLang] || ''

  return (
    <div className="rounded-lg border border-white/10 bg-[#0d1117] overflow-hidden">
      {/* Header with title and copy button */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5">
        <span className="text-xs font-mono text-slate-400">{title || 'Request'}</span>
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

      {/* Language tabs */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-white/10 bg-white/[0.02] overflow-x-auto">
        {availableLanguages.map((lang) => (
          <button
            key={lang}
            onClick={() => handleLanguageChange(lang)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded transition-all ${
              selectedLang === lang
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <LanguageIcon language={lang} className="w-4 h-4" />
            <span>{languageLabels[lang]}</span>
          </button>
        ))}
      </div>

      {/* Code content */}
      <div className="overflow-x-auto">
        {isLoading ? (
          <pre className="p-4 text-sm font-mono text-slate-300">
            <code>{currentCode}</code>
          </pre>
        ) : (
          <div
            className="shiki-container text-sm [&_pre]:!bg-transparent [&_pre]:p-4 [&_pre]:m-0 [&_code]:font-mono"
            dangerouslySetInnerHTML={{ __html: currentHighlighted }}
          />
        )}
      </div>
    </div>
  )
}
