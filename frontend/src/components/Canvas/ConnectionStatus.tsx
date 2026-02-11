interface ConnectionStatusProps {
  status: 'connecting' | 'connected' | 'disconnected'
}

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  const config = {
    connecting: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)', label: 'Connecting...' },
    connected: { color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.15)', label: 'Live' },
    disconnected: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.15)', label: 'Offline' },
  }

  const { color, bg, border, label } = config[status]

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '1rem',
        left: '1rem',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        background: bg,
        backdropFilter: 'blur(8px)',
        padding: '0.4rem 0.75rem',
        borderRadius: '9999px',
        border: `1px solid ${border}`,
      }}
    >
      <div
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 6px ${color}`,
          animation: status === 'connecting' ? 'pulse 1.5s infinite' : undefined,
        }}
      />
      <span style={{ fontSize: '0.7rem', fontWeight: 500, color }}>{label}</span>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
