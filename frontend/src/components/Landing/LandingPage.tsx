import { useState } from 'react'
import { useAuth } from '../../../Contexts/AuthContext'
import { Plus, LogIn, LogOut, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { PreviousRooms } from './PreviousRooms'

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
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex flex-col">
      {/* Header with User Info and Logout */}
      <div className="w-full flex justify-between items-center p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-neutral-900 flex items-center justify-center text-white text-sm font-bold">
            {user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {user?.email || 'User'}
          </span>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer border border-neutral-200 dark:border-neutral-700"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          {/* Header with gradient */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-medium mb-4 border border-neutral-200 dark:border-neutral-700">
              <Sparkles className="h-3 w-3" />
              AI-Powered Diagramming
            </div>
            <h1
              className="text-4xl font-extrabold mb-2 tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #171717, #404040, #171717)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Sketchly
            </h1>
            <p className="text-neutral-500 dark:text-neutral-400">
              Collaborative UML diagramming with AI shape recognition
            </p>
          </motion.div>

          {/* Create Room */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-8"
          >
            <button
              onClick={onCreateRoom}
              className="w-full flex items-center justify-center gap-3 bg-neutral-900 hover:bg-neutral-800 text-white py-4 px-6 rounded-xl text-lg font-semibold transition-all cursor-pointer hover:shadow-xl hover:shadow-neutral-900/25 active:scale-[0.98]"
              style={{ animation: 'pulse-glow 3s ease-in-out infinite' }}
            >
              <Plus className="h-6 w-6" />
              Create New Room
            </button>
          </motion.div>

          {/* Divider */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex items-center mb-8"
          >
            <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
            <span className="px-4 text-neutral-400 text-sm">or</span>
            <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
          </motion.div>

          {/* Join Room */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
          >
            <h3 className="text-base font-semibold text-neutral-700 dark:text-neutral-200 mb-3 text-left">
              Join Existing Room
            </h3>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 mb-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm text-left border border-red-200 dark:border-red-800"
              >
                {error}
              </motion.div>
            )}

            <div className="flex gap-3">
              <input
                type="text"
                value={roomIdInput}
                onChange={(e) => {
                  setRoomIdInput(e.target.value)
                  setError(null)
                }}
                placeholder="Enter room ID..."
                className="flex-1 py-3 px-4 border-2 border-neutral-200 dark:border-neutral-700 rounded-xl text-base outline-none focus:border-neutral-900 dark:focus:border-neutral-400 focus:ring-4 focus:ring-neutral-900/10 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 transition-all placeholder:text-neutral-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleJoinRoom()
                }}
              />
              <button
                onClick={handleJoinRoom}
                className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 active:bg-black text-white py-3 px-6 rounded-xl text-base font-semibold transition-all cursor-pointer hover:shadow-lg hover:shadow-neutral-900/25 active:scale-[0.98]"
              >
                <LogIn className="h-5 w-5" />
                Join
              </button>
            </div>
          </motion.div>

          {/* Previous Rooms */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
          >
            <PreviousRooms onJoinRoom={onJoinRoom} />
          </motion.div>
        </div>
      </div>
    </div>
  )
}
