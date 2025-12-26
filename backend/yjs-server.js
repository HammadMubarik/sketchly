/**
 * Yjs WebSocket Server
 * 
 * This server handles real-time synchronization between clients using CRDTs
 * Run this with: pnpm run yjs
 */

import { WebSocketServer } from 'ws'
import { setupWSConnection } from 'y-websocket/bin/utils'

const PORT = process.env.YJS_PORT || 1234

const wss = new WebSocketServer({ port: PORT })

console.log(` Yjs WebSocket server running on ws://localhost:${PORT}`)
console.log(' Waiting for connections...')
console.log(' Clients will sync CRDTs through this server')

// Store active documents in memory
const docs = new Map()

wss.on('connection', (conn, req) => {
  console.log('New client connected')
  
  setupWSConnection(conn, req, {
    gc: true, // Enable garbage collection for old data
  })

  conn.on('close', () => {
    console.log('Client disconnected')
  })

  conn.on('error', (error) => {
    console.error('WebSocket error:', error)
  })
})

// Periodic cleanup of old documents (rooms with no users)
setInterval(() => {
  let cleaned = 0
  docs.forEach((doc, name) => {
    if (doc.conns?.size === 0) {
      doc.destroy()
      docs.delete(name)
      cleaned++
    }
  })
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} empty room(s)`)
  }
}, 30000) // Check every 30 seconds

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n Shutting down gracefully...')
  wss.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down gracefully...')
  wss.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})