import { useState, useEffect } from 'react'
import { useAuth } from '../../../Contexts/AuthContext'
import { getUserRoomVisits, deleteRoomVisit } from '../../lib/drawingStorage'
import type { RoomVisit } from '../../lib/drawingStorage'
import { Clock, Trash2, ArrowRight } from 'lucide-react'

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

  if (loading) {
    return (
      <div className="mt-8">
        <h3 className="text-base font-semibold text-neutral-700 dark:text-neutral-200 mb-3 text-left">
          My Previous Rooms
        </h3>
        <div className="text-neutral-400 text-sm">Loading...</div>
      </div>
    )
  }

  if (visits.length === 0) {
    return null
  }

  return (
    <div className="mt-8">
      <h3 className="text-base font-semibold text-neutral-700 dark:text-neutral-200 mb-3 text-left">
        My Previous Rooms
      </h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {visits.map((visit) => (
          <button
            key={visit.id}
            onClick={() => onJoinRoom(visit.drawing_id)}
            className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors cursor-pointer text-left group"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">
                {visit.room_name}
              </div>
              <div className="flex items-center gap-1 text-xs text-neutral-400">
                <Clock className="h-3 w-3" />
                {formatDate(visit.last_visited_at)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div
                role="button"
                onClick={(e) => handleDelete(e, visit.id)}
                className="p-1 rounded-md text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                title="Remove from history"
              >
                <Trash2 className="h-4 w-4" />
              </div>
              <ArrowRight className="h-4 w-4 text-neutral-400 group-hover:text-indigo-500 transition-colors" />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
