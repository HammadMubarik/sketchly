interface ConnectionStatusProps {
  status: 'connecting' | 'connected' | 'disconnected'
}

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  const colors = {
    connecting: '#f59e0b',
    connected: '#10b981',
    disconnected: '#ef4444',
  }

  const labels = {
    connecting: 'Connecting...',
    connected: 'Live',
    disconnected: 'Offline',
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '1rem',
        left: '1rem',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        background: 'white',
        padding: '0.5rem 0.75rem',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: colors[status],
          animation: status === 'connecting' ? 'pulse 1.5s infinite' : undefined,
        }}
      />
      <span style={{ fontSize: '0.75rem', color: '#666' }}>{labels[status]}</span>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
