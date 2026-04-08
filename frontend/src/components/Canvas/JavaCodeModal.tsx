import { useState } from 'react'

interface JavaCodeModalProps {
  code: string
  onClose: () => void
}

function parseJavaFiles(code: string): { name: string; content: string }[] {
  const pattern = /(?:public\s+)?(?:class|interface|enum)\s+(\w+)/g
  const matches = [...code.matchAll(pattern)]

  if (matches.length === 0) return [{ name: 'Main.java', content: code }]

  return matches.map((m, i) => {
    const start = m.index!
    const end = matches[i + 1]?.index ?? code.length
    return { name: `${m[1]}.java`, content: code.slice(start, end).trim() }
  })
}

export function JavaCodeModal({ code, onClose }: JavaCodeModalProps) {
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSaveFiles = async () => {
    try {
      const dirHandle = await (window as any).showDirectoryPicker()
      const files = parseJavaFiles(code)
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
          {code}
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
