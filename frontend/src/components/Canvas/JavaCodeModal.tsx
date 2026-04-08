import { useState } from 'react'

interface JavaCodeModalProps {
  code: string
  onClose: () => void
}

// Strip markdown code fences Claude sometimes wraps output in
function stripMarkdown(code: string): string {
  return code
    .replace(/^```[a-zA-Z]*\n?/gm, '')
    .replace(/^```\s*$/gm, '')
    .trim()
}

// Known Java types that need imports
const IMPORT_MAP: Record<string, string> = {
  Date: 'java.util.Date',
  List: 'java.util.List',
  ArrayList: 'java.util.ArrayList',
  Map: 'java.util.Map',
  HashMap: 'java.util.HashMap',
  Set: 'java.util.Set',
  HashSet: 'java.util.HashSet',
  LinkedList: 'java.util.LinkedList',
  LocalDate: 'java.time.LocalDate',
  LocalDateTime: 'java.time.LocalDateTime',
  Optional: 'java.util.Optional',
}

function addMissingImports(content: string): string {
  // Strip existing imports first to avoid double-detecting them
  const existingImports = content.match(/^import .+;$/gm) ?? []
  const bodyOnly = content.replace(/^import .+;$/gm, '').trim()

  const needed: string[] = []
  for (const [type, importPath] of Object.entries(IMPORT_MAP)) {
    const used = new RegExp(`\\b${type}\\b`).test(bodyOnly)
    const alreadyImported = existingImports.some(i => i.includes(importPath))
    if (used && !alreadyImported) {
      needed.push(`import ${importPath};`)
    }
  }

  const allImports = [...existingImports, ...needed]
  if (allImports.length === 0) return content
  return allImports.join('\n') + '\n\n' + bodyOnly
}

function ensurePublic(content: string): string {
  // Add `public` to top-level class/interface/enum if missing
  return content.replace(
    /^(?!public\s)((?:abstract\s+)?(?:class|interface|enum)\s+\w+)/m,
    'public $1'
  )
}

function parseJavaFiles(raw: string): { name: string; content: string }[] {
  const code = stripMarkdown(raw)
  const pattern = /(?:public\s+)?(?:abstract\s+)?(?:class|interface|enum)\s+(\w+)/g
  const matches = [...code.matchAll(pattern)]

  if (matches.length === 0) return [{ name: 'Main.java', content: code }]

  return matches.map((m, i) => {
    const start = m.index!
    const end = matches[i + 1]?.index ?? code.length
    const content = ensurePublic(addMissingImports(code.slice(start, end).trim()))
    return { name: `${m[1]}.java`, content }
  })
}

export function JavaCodeModal({ code, onClose }: JavaCodeModalProps) {
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)

  const displayCode = stripMarkdown(code)

  const handleCopy = () => {
    navigator.clipboard.writeText(displayCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSaveFiles = async () => {
    const files = parseJavaFiles(code)

    // Chrome/Edge: use File System Access API to write into a chosen folder
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker()
        for (const file of files) {
          const fileHandle = await dirHandle.getFileHandle(file.name, { create: true })
          const writable = await fileHandle.createWritable()
          await writable.write(file.content)
          await writable.close()
        }
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } catch (err: any) {
        if (err.name !== 'AbortError') console.error('Save failed:', err)
      }
      return
    }

    // Firefox fallback: download each file individually
    for (const file of files) {
      const blob = new Blob([file.content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.click()
      URL.revokeObjectURL(url)
      // Small delay between downloads so Firefox doesn't block them
      await new Promise(r => setTimeout(r, 200))
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1e1e2e',
          borderRadius: '10px',
          width: '660px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid #313244' }}>
          <span style={{ color: '#cdd6f4', fontWeight: 600, fontSize: '0.95rem' }}>Generated Java Code</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#6c7086', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <pre
          style={{
            margin: 0,
            padding: '1.25rem',
            overflowY: 'auto',
            flex: 1,
            fontSize: '0.8rem',
            lineHeight: 1.6,
            color: '#cdd6f4',
            fontFamily: "'Fira Code', 'Cascadia Code', monospace",
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {displayCode}
        </pre>

        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #313244', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            onClick={handleCopy}
            style={{
              background: copied ? '#a6e3a1' : '#3b82f6',
              color: copied ? '#1e1e2e' : 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '0.4rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={handleSaveFiles}
            style={{
              background: saved ? '#a6e3a1' : '#6366f1',
              color: saved ? '#1e1e2e' : 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '0.4rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {saved ? 'Saved!' : 'Save Files'}
          </button>
          <button
            onClick={onClose}
            style={{
              background: '#313244',
              color: '#cdd6f4',
              border: 'none',
              borderRadius: '6px',
              padding: '0.4rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
