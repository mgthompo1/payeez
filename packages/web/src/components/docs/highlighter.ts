import { createHighlighter, type Highlighter } from 'shiki'

let highlighterPromise: Promise<Highlighter> | null = null

export type SupportedLanguage = 'bash' | 'javascript' | 'typescript' | 'python' | 'ruby' | 'go' | 'php' | 'json'

const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  'bash',
  'javascript',
  'typescript',
  'python',
  'ruby',
  'go',
  'php',
  'json'
]

export async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-dark'],
      langs: SUPPORTED_LANGUAGES,
    })
  }
  return highlighterPromise
}

export async function highlightCode(code: string, language: SupportedLanguage = 'bash'): Promise<string> {
  const highlighter = await getHighlighter()

  // Map common aliases
  const langMap: Record<string, SupportedLanguage> = {
    'curl': 'bash',
    'shell': 'bash',
    'sh': 'bash',
    'js': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'rb': 'ruby',
    'golang': 'go',
  }

  const resolvedLang = langMap[language] || language

  return highlighter.codeToHtml(code, {
    lang: resolvedLang,
    theme: 'github-dark',
  })
}

export { SUPPORTED_LANGUAGES }
