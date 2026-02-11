import { useState, useRef, useEffect } from 'react'

interface ShareButtonProps {
  roomId: string
}

export function ShareButton({ roomId }: ShareButtonProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      ref={panelRef}
      style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 1000 }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: '#3b82f6',
          color: 'white',
          padding: '0.5rem 1rem',
          borderRadius: '6px',
          border: 'none',
          fontSize: '0.875rem',
          fontWeight: 500,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
          <polyline points="16,6 12,2 8,6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        Share
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 0.5rem)',
            right: 0,
            background: 'white',
            borderRadius: '10px',
            padding: '1rem',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            border: '1px solid #e5e7eb',
            width: '280px',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.5rem' }}>
            Room ID
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              readOnly
              value={roomId}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '2px solid #e5e7eb',
                fontSize: '0.8rem',
                fontFamily: 'monospace',
                color: '#1f2937',
                background: '#f9fafb',
                outline: 'none',
                minWidth: 0,
              }}
              onFocus={(e) => e.target.select()}
            />
            <button
              onClick={copyRoomId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
                background: copied ? '#10b981' : '#3b82f6',
                color: 'white',
                whiteSpace: 'nowrap',
                transition: 'background 0.2s',
              }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.5rem' }}>
            Share this ID so others can join your room
          </div>
        </div>
      )}
    </div>
  )
}
