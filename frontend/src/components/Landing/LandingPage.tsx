import { useState } from 'react'
import { useAuth } from '../../../Contexts/AuthContext'
import { Sidebar, SidebarBody, SidebarLink } from '@/components/ui/sidebar'
import { LayoutDashboard, Plus, LogIn, LogOut, Settings, UserCog } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { PreviousRooms } from './PreviousRooms'

interface LandingPageProps {
  onJoinRoom: (roomId: string) => void
  onCreateRoom: () => void
}

export function LandingPage({ onJoinRoom, onCreateRoom }: LandingPageProps) {
  const { user, signOut } = useAuth()
  const [roomIdInput, setRoomIdInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

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

  const sidebarLinks = [
    {
      label: 'Dashboard',
      href: '#',
      icon: <LayoutDashboard className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />,
    },
    {
      label: 'Profile',
      href: '#',
      icon: <UserCog className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />,
    },
    {
      label: 'Settings',
      href: '#',
      icon: <Settings className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />,
    },
  ]

  return (
    <div className={cn(
      "flex flex-col md:flex-row bg-gray-100 dark:bg-neutral-800 w-full overflow-hidden h-screen"
    )}>
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen}>
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            {sidebarOpen ? <Logo /> : <LogoIcon />}
            <div className="mt-8 flex flex-col gap-2">
              {sidebarLinks.map((link, idx) => (
                <SidebarLink key={idx} link={link} />
              ))}
            </div>
          </div>
          <div>
            <SidebarLink
              link={{
                label: user?.email?.split('@')[0] || 'User',
                href: '#',
                icon: (
                  <div className="h-7 w-7 flex-shrink-0 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                    {user?.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                ),
              }}
            />
            <SidebarLink
              link={{
                label: 'Logout',
                href: '#',
                icon: <LogOut className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />,
              }}
              onClick={handleSignOut}
            />
          </div>
        </SidebarBody>
      </Sidebar>

      {/* Main Content */}
      <div className="flex flex-1">
        <div className="p-4 md:p-10 rounded-tl-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex flex-col flex-1 w-full h-full">
          <div className="flex items-start justify-center flex-1 overflow-y-auto py-10">
            <div className="w-full max-w-lg">
              <h1 className="text-4xl font-bold text-neutral-800 dark:text-white mb-2 text-center">
                Sketchly
              </h1>
              <p className="text-neutral-500 dark:text-neutral-400 mb-10 text-center">
                Collaborative UML diagramming with AI shape recognition
              </p>

              {/* Create Room */}
              <div className="mb-8">
                <button
                  onClick={onCreateRoom}
                  className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white py-4 px-6 rounded-xl text-lg font-semibold transition-colors cursor-pointer"
                >
                  <Plus className="h-6 w-6" />
                  Create New Room
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center mb-8">
                <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
                <span className="px-4 text-neutral-400 text-sm">or</span>
                <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
              </div>

              {/* Join Room */}
              <div>
                <h3 className="text-base font-semibold text-neutral-700 dark:text-neutral-200 mb-3 text-left">
                  Join Existing Room
                </h3>

                {error && (
                  <div className="p-3 mb-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm text-left">
                    {error}
                  </div>
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
                    className="flex-1 py-3 px-4 border-2 border-neutral-200 dark:border-neutral-700 rounded-xl text-base outline-none focus:border-indigo-500 dark:focus:border-indigo-400 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 transition-colors"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleJoinRoom()
                    }}
                  />
                  <button
                    onClick={handleJoinRoom}
                    className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-3 px-6 rounded-xl text-base font-semibold transition-colors cursor-pointer"
                  >
                    <LogIn className="h-5 w-5" />
                    Join
                  </button>
                </div>
              </div>

              {/* Previous Rooms */}
              <PreviousRooms onJoinRoom={onJoinRoom} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const Logo = () => {
  return (
    <a
      href="#"
      className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20"
    >
      <div className="h-5 w-6 bg-black dark:bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-medium text-black dark:text-white whitespace-pre"
      >
        Sketchly
      </motion.span>
    </a>
  )
}

const LogoIcon = () => {
  return (
    <a
      href="#"
      className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20"
    >
      <div className="h-5 w-6 bg-black dark:bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
    </a>
  )
}
