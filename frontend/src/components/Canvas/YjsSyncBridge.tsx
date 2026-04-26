import { useEffect, useRef, useCallback } from 'react'
import { track, useEditor } from '@tldraw/tldraw'
import type { TLRecord } from '@tldraw/tldraw'
import { YjsStore } from '../../lib/yjsStore'
import { useAuth } from '../../../Contexts/AuthContext'

export interface Collaborator {
  id: number
  userId?: string
  name: string
  color: string
  cursor: { x: number; y: number; pageId?: string } | null
}

// Module-level cache so a transient unmount/remount of YjsSyncBridge (e.g.
// triggered by tldraw re-running children after a shape edit) doesn't
// tear down the live WebSocket. We hold the store for a grace period and
// either reuse it on remount or actually destroy it if no one comes back.
type CachedStore = { store: YjsStore; destroyTimer: ReturnType<typeof setTimeout> | null }
const storeCache = new Map<string, CachedStore>()
const DESTROY_GRACE_MS = 2000

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
  console.log('[YjsSyncBridge] render, roomId:', roomId)
  const editor = useEditor()
  const { user } = useAuth()

  useEffect(() => {
    console.log('[YjsSyncBridge] MOUNTED')
    return () => console.log('[YjsSyncBridge] UNMOUNTED')
  }, [])

  const yjsStoreRef = useRef<YjsStore | null>(null)
  const isApplyingRemoteRef = useRef(false)
  const initializedRef = useRef(false)

  // Stash unstable inputs in refs so the WS-init effect can depend only on
  // roomId. Without this, every parent re-render (auth resolves, tldraw
  // signals fire, etc.) re-fires the effect and graceful-closes the WS.
  const editorRef = useRef(editor)
  const userRef = useRef(user)
  const onCollabRef = useRef(onCollaboratorsChange)
  const onStatusRef = useRef(onConnectionStatusChange)
  useEffect(() => { editorRef.current = editor }, [editor])
  useEffect(() => { userRef.current = user }, [user])
  useEffect(() => { onCollabRef.current = onCollaboratorsChange }, [onCollaboratorsChange])
  useEffect(() => { onStatusRef.current = onConnectionStatusChange }, [onConnectionStatusChange])

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
    console.log('[YjsSyncBridge] init effect running for room:', roomId)

    const editor = editorRef.current
    const user = userRef.current
    const userName = user?.email?.split('@')[0] || 'Anonymous'

    // Reuse a cached YjsStore if a remount happened within the grace period.
    // This keeps the WS alive across React unmount/remount cycles caused by
    // tldraw's reactive children rebuilding after shape edits.
    const cached = storeCache.get(roomId)
    let yjsStore: YjsStore
    if (cached) {
      console.log('[YjsSyncBridge] reusing cached YjsStore for room:', roomId)
      if (cached.destroyTimer) {
        clearTimeout(cached.destroyTimer)
        cached.destroyTimer = null
      }
      yjsStore = cached.store
    } else {
      yjsStore = new YjsStore({
        roomId,
        userId: user?.id,
        userName,
      })
      storeCache.set(roomId, { store: yjsStore, destroyTimer: null })

      // Register status listener once per store. The callback reads from a ref
      // so it always sees the latest parent setter without re-registering.
      yjsStore.onConnectionStatusChange((status) => {
        console.log('Y.js connection status:', status)
        onStatusRef.current?.(status)
      })
    }
    yjsStoreRef.current = yjsStore

    const yShapes = yjsStore.getShapesMap()
    const awareness = yjsStore.getAwareness()

    // Wait for sync, then initialize
    yjsStore.waitForSync().then(() => {
      console.log('Y.js synced with server')

      // If Y.js has shapes, load them into tldraw
      if (yShapes.size > 0) {
        console.log(`Loading ${yShapes.size} shapes from Y.js`)
        isApplyingRemoteRef.current = true
        editor.store.mergeRemoteChanges(() => {
          yShapes.forEach((record) => {
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
      onCollabRef.current?.(others)
    }
    awareness.on('change', handleAwarenessChange)
    handleAwarenessChange() // Initial call

    return () => {
      console.log('[YjsSyncBridge] cleanup — scheduling destroy for room:', roomId)
      // Detach component-scoped listeners immediately so we don't double-handle
      // events while the WS lingers in the cache.
      removeStoreListener()
      yShapes.unobserve(observeHandler)
      window.removeEventListener('pointermove', handlePointerMove)
      awareness.off('change', handleAwarenessChange)
      yjsStoreRef.current = null
      initializedRef.current = false

      // Defer the actual WS destroy so a remount within the grace period
      // can reclaim the same store (and its live WebSocket).
      const entry = storeCache.get(roomId)
      if (entry) {
        if (entry.destroyTimer) clearTimeout(entry.destroyTimer)
        entry.destroyTimer = setTimeout(() => {
          console.warn('[YjsSyncBridge] grace expired — destroying WS for room:', roomId)
          entry.store.destroy()
          storeCache.delete(roomId)
        }, DESTROY_GRACE_MS)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  return null
})
