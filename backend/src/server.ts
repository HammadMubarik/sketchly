import express from 'express'
import cors from 'cors'
import { geometricRecognize } from './recognizer.js'

const app = express()
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5000

app.use(express.json())
// Allow cross-origin requests during development (adjust origin in prod)
app.use(cors({ origin: process.env.CORS_ORIGIN || true }))

// Root shows a small message so GET / doesn't return 404
app.get('/', (req, res) => res.send('Sketchly recognizer backend is up. Use POST /api/recognize'))

app.get('/health', (req, res) => res.json({ status: 'ok' }))

app.post('/api/recognize', async (req, res) => {
  try {
    const points = req.body?.points
    if (!Array.isArray(points) || points.length === 0) {
      return res.status(400).json({ error: 'points array required' })
    }

    // If a remote recognizer URL is provided via env, proxy the request
    const remote = process.env.RECOGNIZER_URL
    if (remote) {
      const resp = await fetch(remote, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.RECOGNIZER_API_KEY ? { Authorization: `Bearer ${process.env.RECOGNIZER_API_KEY}` } : {}),
        },
        body: JSON.stringify({ points }),
      })
      const data = await resp.json()
      return res.json(data)
    }

    // Fallback to local geometric recognizer
    const result = geometricRecognize(points)
    return res.json(result)
  } catch (err) {
    console.error('recognize error', err)
    res.status(500).json({ error: 'recognition failed' })
  }
})

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))