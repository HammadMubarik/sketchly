import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

/**
 * YjsStore - CRDT-based collaborative store for tldraw
 * 
 * This implements Conflict-free Replicated Data Types using Yjs
 * to enable real-time collaboration without conflicts
 */

export interface YjsStoreConfig {
  roomId: string
  userId?: string
  userName?: string
  userColor?: string
  websocketUrl?: string
}

export class YjsStore {
  private ydoc: Y.Doc
  private provider: WebsocketProvider
  private yShapes: Y.Map<any>
  public awareness: any

  constructor(config: YjsStoreConfig) {
    // Create Yjs document - this is the CRDT
    this.ydoc = new Y.Doc()
    
    // Create a Y.Map for storing shapes - each shape is a CRDT
    this.yShapes = this.ydoc.getMap('shapes')
    
    // Connect to WebSocket server for syncing
    const wsUrl = config.websocketUrl || 'ws://localhost:1234'
    
    this.provider = new WebsocketProvider(
      wsUrl,
      `sketchly-${config.roomId}`,
      this.ydoc,
      {
        connect: true,
      }
    )

    // Awareness - tracks who's online and their cursor positions
    this.awareness = this.provider.awareness
    this.awareness.setLocalState({
      user: {
        id: config.userId,
        name: config.userName || 'Anonymous',
        color: config.userColor || this.getRandomColor(),
      },
    })

    console.log('Yjs CRDT store initialized for room:', config.roomId)
  }

  /**
   * Get the Yjs document
   */
  getDoc() {
    return this.ydoc
  }

  /**
   * Get the shapes map
   */
  getShapesMap() {
    return this.yShapes
  }

  /**
   * Get awareness data (who's online, cursors, etc.)
   */
  getAwareness() {
    return this.awareness
  }

  /**
   * Get the WebSocket provider
   */
  getProvider() {
    return this.provider
  }

  /**
   * Get local client ID
   */
  getClientId(): number {
    return this.ydoc.clientID
  }

  /**
   * Update local user's cursor position
   */
  updateCursor(x: number, y: number, pageId?: string) {
    const localState = this.awareness.getLocalState()
    this.awareness.setLocalState({
      ...localState,
      cursor: { x, y, pageId },
    })
  }

  /**
   * Listen for connection status changes
   */
  onConnectionStatusChange(callback: (status: 'connecting' | 'connected' | 'disconnected') => void) {
    this.provider.on('status', ({ status }: { status: string }) => {
      callback(status as 'connecting' | 'connected' | 'disconnected')
    })
  }

  /**
   * Check if synced with server
   */
  isSynced(): boolean {
    return this.provider.synced
  }

  /**
   * Wait for initial sync
   */
  waitForSync(): Promise<void> {
    return new Promise((resolve) => {
      if (this.provider.synced) {
        resolve()
      } else {
        this.provider.once('sync', () => resolve())
      }
    })
  }

  /**
   * Get all connected users
   */
  getUsers() {
    const states = this.awareness.getStates()
    const users: any[] = []

    states.forEach((state: any, clientId: number) => {
      if (state.user) {
        users.push({
          id: clientId,
          userId: state.user.id,
          name: state.user.name,
          color: state.user.color,
          cursor: state.cursor,
        })
      }
    })

    return users
  }

  /**
   * Generate random color for user
   */
  private getRandomColor(): string {
    const colors = [
      '#ef4444', '#f59e0b', '#10b981', '#3b82f6', 
      '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
    ]
    return colors[Math.floor(Math.random() * colors.length)]
  }

  /**
   * Clean up connections
   */
  destroy() {
    this.provider.destroy()
    this.ydoc.destroy()
  }
}