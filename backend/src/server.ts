import express from 'express'
import cors from 'cors'
import http from 'http'
import { WebSocketServer } from 'ws'
import Anthropic from '@anthropic-ai/sdk'
import { setupWSConnection } from 'y-websocket/bin/utils'

const app = express()
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5000

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

app.use(express.json({ limit: '10mb' }))
app.use(cors({ origin: process.env.CORS_ORIGIN || true }))

app.get('/', (_req, res) => res.send('Sketchly recognizer backend is up. Use POST /api/recognize'))
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.post('/api/generate-java', async (req, res) => {
  try {
    const { image } = req.body
    if (!image) return res.status(400).json({ error: 'image required' })

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4096,
      temperature: 0,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: image } },
          { type: 'text', text: 'This is a UML class diagram. Generate valid Java code for all classes shown. Use inheritance/implementation relationships shown by the arrows. Return only the Java code, no explanation.' }
        ]
      }]
    })

    const first = response.content[0]
    const code = first?.type === 'text' ? first.text : ''
    res.json({ code })
  } catch (err: any) {
    console.error('generate-java error', err)
    res.status(500).json({ error: err?.message ?? 'code generation failed' })
  }
})

// Combine HTTP + WebSocket on a single port: Railway (and most PaaS) expose
// only one $PORT per service, so the yjs WS server has to share with Express.
const server = http.createServer(app)
const wss = new WebSocketServer({ noServer: true })

wss.on('connection', (conn, req) => {
  setupWSConnection(conn, req, { gc: true })
})

server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req)
  })
})

server.listen(PORT, () => console.log(`Server listening on port ${PORT}`))
