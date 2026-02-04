import { useState } from 'react'
import { useAuth } from '../../../Contexts/AuthContext'

interface LandingPageProps {
  onJoinRoom: (roomId: string) => void
  onCreateRoom: () => void
}

export function LandingPage({ onJoinRoom, onCreateRoom }: LandingPageProps) {
  const { user, signOut } = useAuth()
  const [roomIdInput, setRoomIdInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleJoinRoom = () => {
    const trimmedId = roomIdInput.trim()
    if (!trimmedId) {
      setError('Please enter a room ID')
      return
    }

    setError(null)
    onJoinRoom(trimmedId)
  }

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '1rem',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          background: 'rgba(255,255,255,0.95)',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <span style={{ fontSize: '0.875rem', color: '#666' }}>{user?.email}</span>
        <button
          onClick={handleSignOut}
          style={{
            padding: '0.5rem 1rem',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500',
          }}
        >
          Sign Out
        </button>
      </div>

      <div
        style={{
          background: 'white',
          padding: '3rem',
          borderRadius: '16px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          width: '100%',
          maxWidth: '500px',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontSize: '2.5rem',
            fontWeight: '700',
            color: '#333',
            marginBottom: '0.5rem',
          }}
        >
          Sketchly
        </h1>
        <p
          style={{
            color: '#666',
            marginBottom: '2.5rem',
            fontSize: '1rem',
          }}
        >
          Collaborative UML diagramming with AI shape recognition
        </p>

        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={onCreateRoom}
            style={{
              width: '100%',
              padding: '1rem 1.5rem',
              background: '#646cff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1.125rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            Create New Room
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '2rem',
          }}
        >
          <div style={{ flex: 1, height: '1px', background: '#e5e5e5' }} />
          <span
            style={{
              padding: '0 1rem',
              color: '#999',
              fontSize: '0.875rem',
            }}
          >
            or
          </span>
          <div style={{ flex: 1, height: '1px', background: '#e5e5e5' }} />
        </div>

        <div>
          <h3
            style={{
              fontSize: '1rem',
              fontWeight: '600',
              color: '#333',
              marginBottom: '1rem',
              textAlign: 'left',
            }}
          >
            Join Existing Room
          </h3>

          {error && (
            <div
              style={{
                padding: '0.75rem',
                marginBottom: '1rem',
                background: '#fef2f2',
                color: '#dc2626',
                borderRadius: '6px',
                fontSize: '0.875rem',
                textAlign: 'left',
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
            }}
          >
            <input
              type="text"
              value={roomIdInput}
              onChange={(e) => {
                setRoomIdInput(e.target.value)
                setError(null)
              }}
              placeholder="Enter room ID..."
              style={{
                flex: 1,
                padding: '0.875rem 1rem',
                border: '2px solid #e5e5e5',
                borderRadius: '8px',
                fontSize: '1rem',
                outline: 'none',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleJoinRoom()
              }}
            />
            <button
              onClick={handleJoinRoom}
              style={{
                padding: '0.875rem 1.5rem',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
                <polyline points="10,17 15,12 10,7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
