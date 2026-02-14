import { useEffect, useState, useRef } from 'react'
import { track, useEditor } from '@tldraw/tldraw'
import { useAuth } from '../../../Contexts/AuthContext'
import { getDrawingById, getUserEditPermission } from '../../lib/drawingStorage'
import type { Collaborator } from './YjsSyncBridge'

interface EditPermissionHandlerProps {
  roomId: string | null
  collaborators: Collaborator[]
}

export const EditPermissionHandler = track(function EditPermissionHandler({
  roomId,
  collaborators,
}: EditPermissionHandlerProps) {
  const editor = useEditor()
  const { user } = useAuth()
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const lastReadOnlyStateRef = useRef<boolean | null>(null)
  const [permissionCheckTrigger, setPermissionCheckTrigger] = useState(0)

  // Fetch the room owner when roomId changes
  useEffect(() => {
    if (!roomId) return

    async function fetchOwner() {
      const drawing = await getDrawingById(roomId!)
      if (drawing) {
        setOwnerId(drawing.user_id)
      }
    }

    fetchOwner()
  }, [roomId])

  // Periodically re-check permissions (in case owner changes them in the database)
  useEffect(() => {
    if (!roomId || !user?.id || !ownerId) return
    // Don't poll if current user is the owner
    if (user.id === ownerId) return

    const intervalId = setInterval(() => {
      setPermissionCheckTrigger(prev => prev + 1)
    }, 3000) // Check every 3 seconds

    return () => clearInterval(intervalId)
  }, [roomId, user?.id, ownerId])

  // Check permissions whenever collaborators change or owner is set
  useEffect(() => {
    if (!roomId || !user?.id || !ownerId) return

    async function checkAndApplyPermissions() {
      // If current user is the owner, they always have edit permission
      if (user.id === ownerId) {
        if (lastReadOnlyStateRef.current !== false) {
          editor.updateInstanceState({ isReadonly: false })
          lastReadOnlyStateRef.current = false
        }
        return
      }

      // Check if owner is present in collaborators
      const ownerIsPresent = collaborators.some((collab) => collab.userId === ownerId)

      if (ownerIsPresent) {
        // Owner is present, everyone can edit
        if (lastReadOnlyStateRef.current !== false) {
          editor.updateInstanceState({ isReadonly: false })
          lastReadOnlyStateRef.current = false
        }
      } else {
        // Owner is not present, check user's edit permission
        const canEdit = await getUserEditPermission(user.id, roomId)
        const shouldBeReadOnly = !canEdit

        if (lastReadOnlyStateRef.current !== shouldBeReadOnly) {
          editor.updateInstanceState({ isReadonly: shouldBeReadOnly })
          lastReadOnlyStateRef.current = shouldBeReadOnly
        }
      }
    }

    checkAndApplyPermissions()
  }, [roomId, user?.id, ownerId, collaborators, editor, permissionCheckTrigger])

  return null
})
