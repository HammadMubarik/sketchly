interface Point {
  x: number
  y: number
}

interface VisionPrediction {
  category: string
  confidence: number
  topPredictions: Array<{ category: string; confidence: number }>
  processingTime: number
}

export class GoogleVisionRecognizer {
  private apiKey: string
  private apiUrl = 'https://vision.googleapis.com/v1/images:annotate'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  private pointsToBase64Image(points: Point[]): string {
    const canvas = document.createElement('canvas')
    canvas.width = 300
    canvas.height = 300
    const ctx = canvas.getContext('2d')!

    // White background
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Get bounds
    const bounds = this.getBounds(points)
    const padding = 20
    const scale = Math.min(
      (canvas.width - 2 * padding) / bounds.width,
      (canvas.height - 2 * padding) / bounds.height
    )

    const offsetX = (canvas.width - bounds.width * scale) / 2 - bounds.x * scale
    const offsetY = (canvas.height - bounds.height * scale) / 2 - bounds.y * scale

    // Draw shape
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctx.beginPath()
    points.forEach((point, i) => {
      const x = point.x * scale + offsetX
      const y = point.y * scale + offsetY
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()

    // Convert to base64
    return canvas.toDataURL('image/png').split(',')[1]
  }

  private getBounds(points: Point[]): { x: number; y: number; width: number; height: number } {
    const xs = points.map(p => p.x)
    const ys = points.map(p => p.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    return {
      x: minX,
      y: minY,
      width: maxX - minX || 1,
      height: maxY - minY || 1,
    }
  }

  async predict(points: Point[]): Promise<VisionPrediction> {
    const startTime = performance.now()

    try {
      const base64Image = this.pointsToBase64Image(points)

      const requestBody = {
        requests: [
          {
            image: {
              content: base64Image,
            },
            features: [
              {
                type: 'LABEL_DETECTION',
                maxResults: 5,
              },
            ],
          },
        ],
      }

      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }

      const data = await response.json()
      const labels = data.responses[0].labelAnnotations || []

      const topPredictions = labels.map((label: any) => ({
        category: label.description.toLowerCase(),
        confidence: label.score,
      }))

      const processingTime = performance.now() - startTime

      return {
        category: topPredictions[0]?.category || 'unknown',
        confidence: topPredictions[0]?.confidence || 0,
        topPredictions,
        processingTime,
      }
    } catch (error) {
      console.error('Google Vision API error:', error)
      throw error
    }
  }

  isReady(): boolean {
    return true
  }

  getCategories(): string[] {
    return ['circle', 'square', 'triangle', 'star', 'heart', 'rectangle', 'line', 'arrow']
  }

  dispose(): void {
    // Nothing to dispose
  }
}

let recognizerInstance: GoogleVisionRecognizer | null = null

export function getGoogleVisionRecognizer(apiKey: string): GoogleVisionRecognizer {
  if (!recognizerInstance) {
    recognizerInstance = new GoogleVisionRecognizer(apiKey)
  }
  return recognizerInstance
}