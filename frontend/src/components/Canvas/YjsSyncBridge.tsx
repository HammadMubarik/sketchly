import { useEffect, useRef, useCallback } from 'react'
import { track, useEditor } from '@tldraw/tldraw'
import type { TLRecord } from '@tldraw/tldraw'
import { YjsStore } from '../../lib/yjsStore'
import { useAuth } from '../../../Contexts/AuthContext'

export interface Collaborator {
  id: number
  name: string
  color: string
  cursor: { x: number; y: number; pageId?: string } | null
}

interface YjsSyncBridgeProps {
  roomId: string
  onCollaboratorsChange?: (collaborators: Collaborator[]) => void
  onConnectionStatusChange?: (status: 'connecting' | 'connected' | 'disconnected') => void
}

export const YjsSyncBridge = track(function YjsSyncBridge({
  roomId,
  onCollaboratorsChange,
  onConnectionStatusChange,
}: YjsSyncBridgeProps) {
  const editor = useEditor()
  const { user } = useAuth()

  const yjsStoreRef = useRef<YjsStore | null>(null)
  const isApplyingRemoteRef = useRef(false)
  const initializedRef = useRef(false)

  // Throttle helper for cursor updates
  const throttle = useCallback((fn: (...args: any[]) => void, delay: number) => {
    let lastCall = 0
    return (...args: any[]) => {
      const now = Date.now()
      if (now - lastCall >= delay) {
        lastCall = now
        fn(...args)
      }
    }
  }, [])

  useEffect(() => {
    if (!roomId || initializedRef.current) return

    const userName = user?.email?.split('@')[0] || 'Anonymous'

    // Create Y.js store for this room
    const yjsStore = new YjsStore({
      roomId,
      userName,
    })
    yjsStoreRef.current = yjsStore

    const yShapes = yjsStore.getShapesMap()
    const awareness = yjsStore.getAwareness()

    // Connection status
    yjsStore.onConnectionStatusChange((status) => {
      console.log('Y.js connection status:', status)
      onConnectionStatusChange?.(status)
    })

    // Wait for sync, then initialize
    yjsStore.waitForSync().then(() => {
      console.log('Y.js synced with server')

      // If Y.js has shapes, load them into tldraw
      if (yShapes.size > 0) {
        console.log(`Loading ${yShapes.size} shapes from Y.js`)
        isApplyingRemoteRef.current = true
        editor.store.mergeRemoteChanges(() => {
          yShapes.forEach((record, id) => {
            editor.store.put([record])
          })
        })
        isApplyingRemoteRef.current = false
      } else {
        // Push current tldraw state to Y.js for other users
        const allRecords = editor.store.allRecords()
        allRecords.forEach((record) => {
          yShapes.set(record.id, record)
        })
        console.log(`Pushed ${allRecords.length} records to Y.js`)
      }

      initializedRef.current = true
    })

    // Listen to LOCAL tldraw changes -> push to Y.js
    const removeStoreListener = editor.store.listen(
      (entry) => {
        if (isApplyingRemoteRef.current) return
        if (!initializedRef.current) return

        const { added, updated, removed } = entry.changes

        // Add new records to Y.js
        Object.values(added).forEach((record) => {
          yShapes.set(record.id, record)
        })

        // Update changed records in Y.js
        Object.values(updated).forEach(([, record]) => {
          yShapes.set(record.id, record)
        })

        // Remove deleted records from Y.js
        Object.values(removed).forEach((record) => {
          yShapes.delete(record.id)
        })
      },
      { source: 'user', scope: 'document' }
    )

    // Listen to Y.js changes -> apply to tldraw
    const observeHandler = (event: any) => {
      if (event.transaction.local) return
      if (!initializedRef.current) return

      isApplyingRemoteRef.current = true
      editor.store.mergeRemoteChanges(() => {
        event.changes.keys.forEach((change: any, key: string) => {
          if (change.action === 'add' || change.action === 'update') {
            const record = yShapes.get(key) as TLRecord
            if (record) {
              editor.store.put([record])
            }
          } else if (change.action === 'delete') {
            editor.store.remove([key as TLRecord['id']])
          }
        })
      })
      isApplyingRemoteRef.current = false
    }
    yShapes.observe(observeHandler)

    // Track cursor movement
    const handlePointerMove = throttle((event: PointerEvent) => {
      if (!yjsStoreRef.current) return
      const point = editor.screenToPage({ x: event.clientX, y: event.clientY })
      yjsStoreRef.current.updateCursor(point.x, point.y, editor.getCurrentPageId())
    }, 50)
    window.addEventListener('pointermove', handlePointerMove)

    // Track awareness changes (collaborators)
    const handleAwarenessChange = () => {
      if (!yjsStoreRef.current) return
      const users = yjsStoreRef.current.getUsers()
      // Filter out self
      const others = users.filter((u) => u.id !== yjsStoreRef.current?.getClientId())
      onCollaboratorsChange?.(others)
    }
    awareness.on('change', handleAwarenessChange)
    handleAwarenessChange() // Initial call

    return () => {
      removeStoreListener()
      yShapes.unobserve(observeHandler)
      window.removeEventListener('pointermove', handlePointerMove)
      awareness.off('change', handleAwarenessChange)
      yjsStore.destroy()
      yjsStoreRef.current = null
      initializedRef.current = false
    }
  }, [roomId, editor, user, onCollaboratorsChange, onConnectionStatusChange, throttle])

  return null
})
