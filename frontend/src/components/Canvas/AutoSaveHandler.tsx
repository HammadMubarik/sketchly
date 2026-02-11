import { useEffect, useRef } from 'react'
import { track, useEditor } from '@tldraw/tldraw'
import type { TLEditorSnapshot } from '@tldraw/tldraw'
import { useAuth } from '../../../Contexts/AuthContext'
import { saveDrawingSnapshot, getDrawingById } from '../../lib/drawingStorage'

interface AutoSaveHandlerProps {
  onSaveStatusChange?: (status: { isSaving: boolean; lastSavedAt: Date | null }) => void
  onDrawingLoaded?: (drawingId: string) => void
  roomId?: string | null
  debounceMs?: number
}

export const AutoSaveHandler = track(function AutoSaveHandler({
  onSaveStatusChange,
  onDrawingLoaded,
  roomId,
  debounceMs = 2000,
}: AutoSaveHandlerProps) {
  const editor = useEditor()
  const { user } = useAuth()

  const timeoutRef = useRef<number | null>(null)
  const drawingIdRef = useRef<string | null>(null)
  const isSavingRef = useRef(false)
  const isLoadedRef = useRef(false)
  const pendingSnapshotRef = useRef<TLEditorSnapshot | null>(null)

  // Load existing drawing on mount
  useEffect(() => {
    if (!user?.id || isLoadedRef.current) return

    async function loadDrawing() {
      try {
        let existingDrawing = null

        // If we have a roomId, load that specific drawing
        if (roomId) {
          existingDrawing = await getDrawingById(roomId)
          console.log('Loading drawing by room ID:', roomId, existingDrawing ? 'found' : 'not found')
        }

        // No roomId means "Create New Room" — start with a blank canvas

        if (existingDrawing) {
          console.log('Loading existing drawing:', existingDrawing.id)
          drawingIdRef.current = existingDrawing.id

          editor.loadSnapshot(existingDrawing.snapshot)

          onSaveStatusChange?.({
            isSaving: false,
            lastSavedAt: new Date(existingDrawing.updated_at),
          })
          onDrawingLoaded?.(existingDrawing.id)
        } else {
          console.log('No existing drawing found, starting fresh')
        }

        isLoadedRef.current = true
      } catch (error) {
        console.error('Failed to load drawing:', error)
        isLoadedRef.current = true
      }
    }

    loadDrawing()
  }, [user?.id, editor, onSaveStatusChange, roomId])

  // Save function
  const performSave = async (snapshot: TLEditorSnapshot) => {
    if (!user?.id || isSavingRef.current) return

    isSavingRef.current = true
    onSaveStatusChange?.({ isSaving: true, lastSavedAt: null })

    try {
      const savedDrawing = await saveDrawingSnapshot(user.id, drawingIdRef.current, snapshot)

      if (!drawingIdRef.current) {
        drawingIdRef.current = savedDrawing.id
        console.log('Created new drawing:', savedDrawing.id)
        onDrawingLoaded?.(savedDrawing.id)
      }

      onSaveStatusChange?.({
        isSaving: false,
        lastSavedAt: new Date(),
      })

      console.log('Auto-saved at', new Date().toLocaleTimeString())
    } catch (error) {
      console.error('Auto-save failed:', error)
      onSaveStatusChange?.({ isSaving: false, lastSavedAt: null })
    } finally {
      isSavingRef.current = false

      if (pendingSnapshotRef.current) {
        const pending = pendingSnapshotRef.current
        pendingSnapshotRef.current = null
        performSave(pending)
      }
    }
  }

  // Listen to store changes for auto-save
  useEffect(() => {
    if (!user?.id) return

    // Wait for initial load before enabling auto-save
    const checkLoaded = setInterval(() => {
      if (isLoadedRef.current) {
        clearInterval(checkLoaded)
        setupListener()
      }
    }, 100)

    function setupListener() {
      const removeListener = editor.store.listen(
        () => {
          if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current)
          }

          const snapshot = editor.getSnapshot()

          if (isSavingRef.current) {
            pendingSnapshotRef.current = snapshot
            return
          }

          timeoutRef.current = window.setTimeout(() => {
            performSave(snapshot)
          }, debounceMs)
        },
        { source: 'user', scope: 'document' }
      )

      return removeListener
    }

    return () => {
      clearInterval(checkLoaded)
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [user?.id, editor, debounceMs])

  // Save before page unload
  useEffect(() => {
    if (!user?.id) return

    const handleBeforeUnload = () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
      }
      const snapshot = editor.getSnapshot()
      saveDrawingSnapshot(user.id, drawingIdRef.current, snapshot).catch(console.error)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [editor, user?.id])

  return null
})
