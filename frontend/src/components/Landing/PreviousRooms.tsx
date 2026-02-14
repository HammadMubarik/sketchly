import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../../Contexts/AuthContext'
import { getUserRoomVisits, deleteRoomVisit } from '../../lib/drawingStorage'
import type { RoomVisit } from '../../lib/drawingStorage'
import { Clock, Trash2, ArrowRight, Palette } from 'lucide-react'

const ROOM_COLORS = [
  'from-neutral-800 to-neutral-900',
  'from-neutral-700 to-neutral-800',
  'from-neutral-600 to-neutral-800',
  'from-neutral-900 to-neutral-700',
  'from-neutral-800 to-neutral-600',
  'from-neutral-700 to-neutral-900',
]

function getRoomColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  return ROOM_COLORS[Math.abs(hash) % ROOM_COLORS.length]
}

interface PreviousRoomsProps {
  onJoinRoom: (roomId: string) => void
}

export function PreviousRooms({ onJoinRoom }: PreviousRoomsProps) {
  const { user } = useAuth()
  const [visits, setVisits] = useState<RoomVisit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return

    async function fetchVisits() {
      setLoading(true)
      const data = await getUserRoomVisits(user!.id)
      setVisits(data)
      setLoading(false)
    }

    fetchVisits()
  }, [user?.id])

  // Split visits into owned and joined rooms
  const { myRooms, joinedRooms } = useMemo(() => {
    const owned = visits.filter((v) => v.owner_id === user?.id)
    const joined = visits.filter((v) => v.owner_id !== user?.id)
    return { myRooms: owned, joinedRooms: joined }
  }, [visits, user?.id])

  const handleDelete = async (e: React.MouseEvent, visitId: string) => {
    e.stopPropagation()
    await deleteRoomVisit(visitId)
    setVisits((prev) => prev.filter((v) => v.id !== visitId))
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const renderRoomCard = (visit: RoomVisit, index: number) => (
    <button
      key={visit.id}
      onClick={() => onJoinRoom(visit.drawing_id)}
      className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-all cursor-pointer text-left group hover:shadow-md hover:shadow-neutral-900/5"
      style={{ animation: `fade-in-up 0.3s ease both ${index * 0.05}s` }}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${getRoomColor(visit.drawing_id)} flex items-center justify-center flex-shrink-0 shadow-sm`}>
          <Palette className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">
            {visit.room_name}
          </div>
          <div className="flex items-center gap-1 text-xs text-neutral-400">
            <Clock className="h-3 w-3" />
            {formatDate(visit.last_visited_at)}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <div
          role="button"
          onClick={(e) => handleDelete(e, visit.id)}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
          title="Remove from history"
        >
          <Trash2 className="h-4 w-4" />
        </div>
        <ArrowRight className="h-4 w-4 text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-white group-hover:translate-x-0.5 transition-all" />
      </div>
    </button>
  )

  if (loading) {
    return (
      <div className="mt-8 space-y-6">
        <div>
          <h3 className="text-base font-semibold text-neutral-700 dark:text-neutral-200 mb-3 text-left">
            My Rooms
          </h3>
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (visits.length === 0) {
    return null
  }

  return (
    <div className="mt-8 space-y-6">
      {/* My Rooms (Created by user) */}
      {myRooms.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-neutral-700 dark:text-neutral-200 mb-3 text-left">
            My Rooms
          </h3>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {myRooms.map((visit, index) => renderRoomCard(visit, index))}
          </div>
        </div>
      )}

      {/* Joined Rooms (Not owned by user) */}
      {joinedRooms.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-neutral-700 dark:text-neutral-200 mb-3 text-left">
            Joined Rooms
          </h3>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {joinedRooms.map((visit, index) => renderRoomCard(visit, index))}
          </div>
        </div>
      )}
    </div>
  )
}
