/**
 * CNN Shape Recognizer for Production
 * Loads trained model and performs inference on hand-drawn shapes
 */

import * as tf from '@tensorflow/tfjs'

export interface Point {
  x: number
  y: number
}

export interface CNNRecognitionResult {
  name: string
  confidence: number
  allPredictions?: Array<{ name: string; confidence: number }>
}

export class CNNShapeRecognizer {
  private model: tf.LayersModel | null = null
  private readonly modelUrl = '/models/shape-recognizer/model.json'
  private readonly shapeNames = [
    'circle',
    'square',
    'arrow-left',
    'arrow-right',
    'arrow-up',
    'arrow-down',
    'diamond',
    'line',
  ]

  async loadModel(): Promise<void> {
    if (this.model) {
      console.log('CNN model already loaded')
      return
    }

    try {
      console.log('Loading CNN shape recognition model...')
      const startTime = performance.now()

      this.model = await tf.loadLayersModel(this.modelUrl)

      const loadTime = performance.now() - startTime
      console.log(`CNN model loaded successfully in ${loadTime.toFixed(0)}ms`)

      // Warm up the model with a dummy prediction
      const dummyInput = tf.zeros([1, 28, 28, 1])
      this.model.predict(dummyInput)
      ;(dummyInput as tf.Tensor).dispose()

      console.log('CNN model ready for inference')
    } catch (error) {
      console.error('Failed to load CNN model:', error)
      throw new Error('CNN model not available. Please ensure the model is trained and saved.')
    }
  }

  async recognize(points: Point[]): Promise<CNNRecognitionResult> {
    if (!this.model) {
      await this.loadModel()
    }

    if (points.length < 3) {
      return {
        name: 'unknown',
        confidence: 0,
      }
    }

    try {
      // Convert points to image tensor
      const imageTensor = this.pointsToTensor(points, 28)

      // Predict
      const startTime = performance.now()
      const prediction = this.model!.predict(imageTensor) as tf.Tensor
      const probabilities = await prediction.data()
      const inferenceTime = performance.now() - startTime

      // Clean up tensors
      imageTensor.dispose()
      prediction.dispose()

      // Get top prediction
      const maxIdx = Array.from(probabilities).indexOf(Math.max(...Array.from(probabilities)))
      const confidence = probabilities[maxIdx]

      // Get all predictions sorted by confidence
      const allPredictions = this.shapeNames
        .map((name, idx) => ({
          name,
          confidence: probabilities[idx],
        }))
        .sort((a, b) => b.confidence - a.confidence)

      console.log(
        `CNN inference: ${this.shapeNames[maxIdx]} (${(confidence * 100).toFixed(1)}%) in ${inferenceTime.toFixed(1)}ms`
      )

      return {
        name: this.shapeNames[maxIdx],
        confidence,
        allPredictions,
      }
    } catch (error) {
      console.error('CNN recognition failed:', error)
      return {
        name: 'unknown',
        confidence: 0,
      }
    }
  }

  private pointsToTensor(points: Point[], size: number): tf.Tensor4D {
    // 1. Normalize points to bounding box
    const normalized = this.normalizePoints(points, size)

    // 2. Rasterize to image
    const imageData = new Float32Array(size * size)
    this.drawStroke(normalized, imageData, size)

    // 3. Convert to tensor [1, 28, 28, 1]
    return tf.tensor4d(imageData, [1, size, size, 1])
  }

  private normalizePoints(points: Point[], targetSize: number): Point[] {
    // Find bounding box
    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const maxX = Math.max(...xs)
    const maxY = Math.max(...ys)
    const width = maxX - minX
    const height = maxY - minY

    if (width === 0 || height === 0) {
      // Degenerate case - return centered point
      return [{ x: targetSize / 2, y: targetSize / 2 }]
    }

    // Scale to fit in canvas with padding
    const padding = targetSize * 0.1 // 10% padding
    const scale = (targetSize - 2 * padding) / Math.max(width, height)

    // Center in canvas
    const offsetX = (targetSize - width * scale) / 2
    const offsetY = (targetSize - height * scale) / 2

    return points.map((p) => ({
      x: (p.x - minX) * scale + offsetX,
      y: (p.y - minY) * scale + offsetY,
    }))
  }

  private drawStroke(points: Point[], imageData: Float32Array, size: number): void {
    // Draw anti-aliased line
    for (let i = 1; i < points.length; i++) {
      this.drawLine(points[i - 1], points[i], imageData, size, 2.0)
    }
  }

  private drawLine(p1: Point, p2: Point, imageData: Float32Array, size: number, width: number): void {
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const steps = Math.max(Math.abs(dx), Math.abs(dy)) * 2

    if (steps === 0) return

    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = p1.x + t * dx
      const y = p1.y + t * dy

      // Draw thick line with width
      for (let wx = -width; wx <= width; wx++) {
        for (let wy = -width; wy <= width; wy++) {
          const dist = Math.sqrt(wx * wx + wy * wy)
          if (dist <= width) {
            const px = Math.round(x + wx)
            const py = Math.round(y + wy)
            if (px >= 0 && px < size && py >= 0 && py < size) {
              const idx = py * size + px
              imageData[idx] = 1.0 // White pixel
            }
          }
        }
      }
    }
  }

  getModelInfo(): string {
    if (!this.model) {
      return 'Model not loaded'
    }

    return `CNN Model: ${this.shapeNames.length} classes, loaded from ${this.modelUrl}`
  }
}

// Singleton instance
export const cnnRecognizer = new CNNShapeRecognizer()

// Export for console debugging
if (typeof window !== 'undefined') {
  ;(window as any).cnnRecognizer = cnnRecognizer
}
