import * as tf from '@tensorflow/tfjs'

interface Point {
  x: number
  y: number
}

interface QuickDrawPrediction {
  category: string
  confidence: number
  topPredictions: Array<{ category: string; confidence: number }>
  processingTime: number
}

export class QuickDrawRecognizer {
  private model: tf.LayersModel | null = null
  private categories: string[] = []
  private isLoaded = false
  private readonly IMAGE_SIZE = 28

  constructor() {
    this.initialize()
  }

  private async initialize(): Promise<void> {
    try {
      console.log('Loading Quick Draw model...')
      
      this.model = await tf.loadLayersModel('/models/quickdraw/model.json')
      this.categories = await this.loadCategories()
      
  
      const dummy = tf.zeros([1, this.IMAGE_SIZE, this.IMAGE_SIZE, 1])
      this.model.predict(dummy)
      dummy.dispose()
      
      this.isLoaded = true
      console.log(`Model loaded! (${this.categories.length} categories)`)
      
    } catch (error) {
      console.error('Failed to load model:', error)
      throw error
    }
  }

  private async loadCategories(): Promise<string[]> {
    try {
      const response = await fetch(
        'https://raw.githubusercontent.com/googlecreativelab/quickdraw-dataset/master/categories.txt'
      )
      const text = await response.text()
      return text.split('\n').filter(cat => cat.trim().length > 0)
    } catch (error) {
      console.warn('Using subset of categories')
      return [
        'circle', 'square', 'triangle', 'star', 'heart', 'line',
        'rectangle', 'diamond', 'pentagon', 'hexagon', 'arrow',
        'zigzag', 'spiral', 'cloud', 'lightning'
      ]
    }
  }

  private pointsToImageTensor(points: Point[]): tf.Tensor4D {
    return tf.tidy(() => {
      const canvas = document.createElement('canvas')
      canvas.width = this.IMAGE_SIZE
      canvas.height = this.IMAGE_SIZE
      const ctx = canvas.getContext('2d')!
      
      ctx.fillStyle = 'black'
      ctx.fillRect(0, 0, this.IMAGE_SIZE, this.IMAGE_SIZE)
      
      const bounds = this.getBounds(points)
      const padding = 2
      const scale = Math.min(
        (this.IMAGE_SIZE - 2 * padding) / bounds.width,
        (this.IMAGE_SIZE - 2 * padding) / bounds.height
      )
      
      const offsetX = (this.IMAGE_SIZE - bounds.width * scale) / 2 - bounds.x * scale
      const offsetY = (this.IMAGE_SIZE - bounds.height * scale) / 2 - bounds.y * scale
      
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 2
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
      
      let tensor = tf.browser.fromPixels(canvas, 1)
      tensor = tensor.toFloat().div(255.0)
      return tensor.expandDims(0) as tf.Tensor4D
    })
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

  async predict(points: Point[]): Promise<QuickDrawPrediction> {
    if (!this.isLoaded || !this.model) {
      await this.waitForModel()
    }

    const startTime = performance.now()

    return await tf.tidy(async () => {
      const imageTensor = this.pointsToImageTensor(points)
      const predictions = this.model!.predict(imageTensor) as tf.Tensor
      const probabilities = await predictions.data()
      
      const topPredictions = this.categories
        .map((category, i) => ({
          category,
          confidence: probabilities[i],
        }))
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5)
      
      const processingTime = performance.now() - startTime
      
      return {
        category: topPredictions[0].category,
        confidence: topPredictions[0].confidence,
        topPredictions,
        processingTime,
      }
    })
  }

  isReady(): boolean {
    return this.isLoaded
  }

  private async waitForModel(): Promise<void> {
    if (this.isLoaded) return
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.isLoaded) {
          clearInterval(checkInterval)
          resolve()
        }
      }, 100)
    })
  }

  getCategories(): string[] {
    return [...this.categories]
  }

  dispose(): void {
    if (this.model) {
      this.model.dispose()
      this.model = null
      this.isLoaded = false
    }
  }
}

let recognizerInstance: QuickDrawRecognizer | null = null

export function getQuickDrawRecognizer(): QuickDrawRecognizer {
  if (!recognizerInstance) {
    recognizerInstance = new QuickDrawRecognizer()
  }
  return recognizerInstance
}