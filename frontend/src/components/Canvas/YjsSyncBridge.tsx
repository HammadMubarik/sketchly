import { useEffect } from 'react'
import { track, useEditor } from '@tldraw/tldraw'
import type { TLRecord, Editor } from '@tldraw/tldraw'
import { YjsStore } from '../../lib/yjsStore'
import { useAuth } from '../../../Contexts/AuthContext'

export interface Collaborator {
  id: number
  userId?: string
  name: string
  color: string
  cursor: { x: number; y: number; pageId?: string } | null
}

type Status = 'connecting' | 'connected' | 'disconnected'

// The Yjs bridge (store + tldraw<->Yjs listeners + cursor/awareness wiring)
// lives at module scope, decoupled from React's component lifecycle. Tldraw
// can rebuild its children subtree spuriously (e.g. after the first batch of
// shapes flush into Y.js), and tying the WebSocket to that lifecycle caused
// the canvas to go "Offline" within seconds of opening.
//
// Bridges are explicitly disposed when (a) a different roomId becomes active
// on the page, or (b) the tab unloads.
type Bridge = {
  store: YjsStore
  // Latest parent setters — reassigned each render so updates always reach
  // the currently-mounted SketchlyCanvas instance.
  collabRef: { current: ((c: Collaborator[]) => void) | undefined }
  statusRef: { current: ((s: Status) => void) | undefined }
  // Last status pushed by the provider; replayed to a freshly-mounted
  // component so the UI doesn't show "connecting" indefinitely after a
  // spurious React remount.
  lastStatus: Status
  teardown: () => void
}

const bridges = new Map<string, Bridge>()

function disposeBridgesExcept(activeRoomId: string | null) {
  for (const [rid, bridge] of bridges) {
    if (rid !== activeRoomId) {
      bridge.teardown()
      bridge.store.destroy()
      bridges.delete(rid)
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    disposeBridgesExcept(null)
  })
}

function ensureBridge(
  roomId: string,
  editor: Editor,
  userId: string | undefined,
  userName: string,
): Bridge {
  // Only one room is active at a time on the page; tear down stragglers.
  disposeBridgesExcept(roomId)

  const existing = bridges.get(roomId)
  if (existing) return existing

  const store = new YjsStore({ roomId, userId, userName })
  const yShapes = store.getShapesMap()
  const awareness = store.getAwareness()

  const collabRef: Bridge['collabRef'] = { current: undefined }
  const statusRef: Bridge['statusRef'] = { current: undefined }

  // Build a partially-initialised bridge first so async callbacks below
  // can safely mutate it (no temporal dead-zone risk on `bridge`).
  const bridge: Bridge = {
    store,
    collabRef,
    statusRef,
    lastStatus: 'connecting',
    teardown: () => {},
  }

  let isApplyingRemote = false
  let initialized = false

  store.onConnectionStatusChange((status) => {
    console.log('Y.js connection status:', status)
    bridge.lastStatus = status
    statusRef.current?.(status)
  })

  store.waitForSync().then(() => {
    console.log('Y.js synced with server')

    if (yShapes.size > 0) {
      console.log(`Loading ${yShapes.size} shapes from Y.js`)
      isApplyingRemote = true
      editor.store.mergeRemoteChanges(() => {
        yShapes.forEach((record) => {
          editor.store.put([record])
        })
      })
      isApplyingRemote = false
    } else {
      const allRecords = editor.store.allRecords()
      allRecords.forEach((record) => {
        yShapes.set(record.id, record)
      })
      console.log(`Pushed ${allRecords.length} records to Y.js`)
    }

    initialized = true
  })

  // Local tldraw -> Y.js
  const removeStoreListener = editor.store.listen(
    (entry) => {
      if (isApplyingRemote) return
      if (!initialized) return

      const { added, updated, removed } = entry.changes
      Object.values(added).forEach((record) => {
        yShapes.set(record.id, record)
      })
      Object.values(updated).forEach(([, record]) => {
        yShapes.set(record.id, record)
      })
      Object.values(removed).forEach((record) => {
        yShapes.delete(record.id)
      })
    },
    { source: 'user', scope: 'document' },
  )

  // Y.js -> local tldraw
  const observeHandler = (event: any) => {
    if (event.transaction.local) return
    if (!initialized) return

    isApplyingRemote = true
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
    isApplyingRemote = false
  }
  yShapes.observe(observeHandler)

  // Throttled cursor broadcasting
  let lastPointerAt = 0
  const handlePointerMove = (event: PointerEvent) => {
    const now = Date.now()
    if (now - lastPointerAt < 50) return
    lastPointerAt = now
    const point = editor.screenToPage({ x: event.clientX, y: event.clientY })
    store.updateCursor(point.x, point.y, editor.getCurrentPageId())
  }
  window.addEventListener('pointermove', handlePointerMove)

  // Awareness -> collaborators
  const handleAwarenessChange = () => {
    const users = store.getUsers()
    const others = users.filter((u) => u.id !== store.getClientId())
    collabRef.current?.(others)
  }
  awareness.on('change', handleAwarenessChange)
  handleAwarenessChange()

  bridge.teardown = () => {
    removeStoreListener()
    yShapes.unobserve(observeHandler)
    window.removeEventListener('pointermove', handlePointerMove)
    awareness.off('change', handleAwarenessChange)
  }

  bridges.set(roomId, bridge)
  return bridge
}

interface YjsSyncBridgeProps {
  roomId: string
  onCollaboratorsChange?: (collaborators: Collaborator[]) => void
  onConnectionStatusChange?: (status: Status) => void
}

export const YjsSyncBridge = track(function YjsSyncBridge({
  roomId,
  onCollaboratorsChange,
  onConnectionStatusChange,
}: YjsSyncBridgeProps) {
  const editor = useEditor()
  const { user } = useAuth()

  // Initialise (or reuse) the module-level bridge for this room. Runs once
  // per (roomId, editor); spurious React unmounts don't tear down the WS.
  useEffect(() => {
    if (!roomId) return
    const userName = user?.email?.split('@')[0] || 'Anonymous'
    const bridge = ensureBridge(roomId, editor, user?.id, userName)

    bridge.collabRef.current = onCollaboratorsChange
    bridge.statusRef.current = onConnectionStatusChange

    // Replay current connection status so a freshly-mounted component
    // immediately reflects whatever the live WS is reporting.
    onConnectionStatusChange?.(bridge.lastStatus)

    // No teardown here — see Bridge docblock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, editor, user?.id])

  // Keep the refs pointing at the latest parent setters across re-renders.
  const bridge = roomId ? bridges.get(roomId) : null
  if (bridge) {
    bridge.collabRef.current = onCollaboratorsChange
    bridge.statusRef.current = onConnectionStatusChange
  }

  return null
})
