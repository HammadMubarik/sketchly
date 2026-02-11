import { useState, useEffect } from 'react'
import { useAuth } from '../../../Contexts/AuthContext'
import { Login } from '../Auth/Login'
import { LandingPage } from '../Landing/LandingPage'
import { ChevronLeft, Loader2 } from 'lucide-react'

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
      <div className="flex flex-col justify-center items-center min-h-screen bg-neutral-50 dark:bg-neutral-900 gap-3">
        <Loader2 className="h-8 w-8 text-neutral-900 dark:text-neutral-200 animate-spin" />
        <div className="text-neutral-400 text-sm font-medium">Loading...</div>
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
        className="fixed top-4 left-4 z-[1001] flex items-center gap-1.5 bg-white/90 backdrop-blur-md text-neutral-600 py-2 px-3.5 rounded-full border border-neutral-200/80 text-sm font-medium cursor-pointer shadow-sm hover:shadow-md hover:bg-white hover:text-neutral-800 transition-all active:scale-95"
      >
        <ChevronLeft className="h-4 w-4" />
        Home
      </button>
      {children}
    </>
  )
}
