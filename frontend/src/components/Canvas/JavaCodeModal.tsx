import { useState } from 'react'

interface JavaCodeModalProps {
  code: string
  onClose: () => void
}

export function JavaCodeModal({ code, onClose }: JavaCodeModalProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
