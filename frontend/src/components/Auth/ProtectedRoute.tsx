import { useState, useEffect } from 'react'
import { useAuth } from '../../../Contexts/AuthContext'
import { Login } from '../Auth/Login'
import { LandingPage } from '../Landing/LandingPage'

type AppView = 'landing' | 'canvas'

interface NavigationState {
  view: AppView
  roomId: string | null
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  const [navState, setNavState] = useState<NavigationState>(() => {
    const params = new URLSearchParams(window.location.search)
    const urlRoomId = params.get('room')

    if (urlRoomId) {
      return { view: 'canvas', roomId: urlRoomId }
    }

    return { view: 'landing', roomId: null }
  })

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      const urlRoomId = params.get('room')

      if (urlRoomId) {
        setNavState({ view: 'canvas', roomId: urlRoomId })
      } else {
        setNavState({ view: 'landing', roomId: null })
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const handleJoinRoom = (roomId: string) => {
    const newUrl = `${window.location.pathname}?room=${roomId}`
    window.history.pushState({}, '', newUrl)
    setNavState({ view: 'canvas', roomId })
  }

  const handleCreateRoom = () => {
    window.history.pushState({}, '', window.location.pathname)
    setNavState({ view: 'canvas', roomId: null })
  }

  const handleBackToLanding = () => {
    window.history.pushState({}, '', window.location.pathname)
    setNavState({ view: 'landing', roomId: null })
  }

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <div>Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  if (navState.view === 'landing') {
    return <LandingPage onJoinRoom={handleJoinRoom} onCreateRoom={handleCreateRoom} />
  }

  return (
    <>
      <button
        onClick={handleBackToLanding}
        style={{
          position: 'fixed',
          top: '1rem',
          left: '1rem',
          zIndex: 1001,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'white',
          color: '#333',
          padding: '0.5rem 1rem',
          borderRadius: '6px',
          border: '1px solid #ddd',
          fontSize: '0.875rem',
          fontWeight: 500,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15,18 9,12 15,6" />
        </svg>
        Home
      </button>
      {children}
    </>
  )
}
