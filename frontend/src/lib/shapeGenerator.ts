/**
 * Shape Data Generator for CNN Training
 * Programmatically generates synthetic training data for geometric shapes
 */

export interface Point {
  x: number
  y: number
}

export interface ShapeGenerationConfig {
  canvasSize: number // 28 or 64
  samplesPerClass: number // e.g., 4000
  augmentationPasses: number // e.g., 8
}

export interface AugmentationConfig {
  rotation: { min: number; max: number }
  scale: { min: number; max: number }
  translation: { max: number }
  noise: { stdDev: number }
  pointCount: { min: number; max: number }
}

export interface TrainingDataset {
  inputs: Float32Array[]
  labels: number[]
  shapeNames: string[]
}

export class ShapeDataGenerator {
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

  private readonly defaultAugmentation: AugmentationConfig = {
    rotation: { min: 0, max: 360 },
    scale: { min: 0.5, max: 2.0 },
    translation: { max: 0.2 },
    noise: { stdDev: 0.02 },
    pointCount: { min: 30, max: 100 },
  }

  generateDataset(config: ShapeGenerationConfig): TrainingDataset {
    const inputs: Float32Array[] = []
    const labels: number[] = []

    console.log(`Generating dataset: ${config.samplesPerClass} samples × ${this.shapeNames.length} shapes`)

    for (let classIdx = 0; classIdx < this.shapeNames.length; classIdx++) {
      const shapeName = this.shapeNames[classIdx]
      console.log(`Generating ${shapeName}...`)

      for (let i = 0; i < config.samplesPerClass; i++) {
        // Generate base shape
        const points = this.generateShape(shapeName)

        // Apply augmentation
        const augmented = this.applyAugmentation(points, this.defaultAugmentation)

        // Rasterize to image
        const imageData = this.rasterizeToImage(augmented, config.canvasSize)

        inputs.push(imageData)
        labels.push(classIdx)
      }
    }

    console.log(`Dataset generated: ${inputs.length} total samples`)

    return {
      inputs,
      labels,
      shapeNames: this.shapeNames,
    }
  }

  private generateShape(shapeName: string): Point[] {
    switch (shapeName) {
      case 'circle':
        return this.generateCircle()
      case 'square':
        return this.generateSquare()
      case 'arrow-left':
        return this.generateArrowLeft()
      case 'arrow-right':
        return this.generateArrowRight()
      case 'arrow-up':
        return this.generateArrowUp()
      case 'arrow-down':
        return this.generateArrowDown()
      case 'diamond':
        return this.generateDiamond()
      case 'line':
        return this.generateLine()
      default:
        return this.generateCircle()
    }
  }

  private generateCircle(): Point[] {
    const cx = 50
    const cy = 50
    const r = 30 + Math.random() * 10
    const points: Point[] = []
    const numPoints = 50 + Math.floor(Math.random() * 30)

    for (let i = 0; i <= numPoints; i++) {
      const theta = (i / numPoints) * 2 * Math.PI
      const x = cx + r * Math.cos(theta)
      const y = cy + r * Math.sin(theta)
      points.push({ x, y })
    }

    return points
  }

  private generateEllipse(): Point[] {
    const cx = 50
    const cy = 50
    const rx = 30 + Math.random() * 10
    const ry = rx * (1.5 + Math.random() * 1.5) // aspect ratio 1.5-3.0
    const points: Point[] = []
    const numPoints = 50 + Math.floor(Math.random() * 30)

    for (let i = 0; i <= numPoints; i++) {
      const theta = (i / numPoints) * 2 * Math.PI
      const x = cx + rx * Math.cos(theta)
      const y = cy + ry * Math.sin(theta)
      points.push({ x, y })
    }

    return points
  }

  private generateSquare(): Point[] {
    const size = 50 + Math.random() * 20
    const cx = 50
    const cy = 50
    const halfSize = size / 2

    return [
      { x: cx - halfSize, y: cy - halfSize },
      { x: cx + halfSize, y: cy - halfSize },
      { x: cx + halfSize, y: cy + halfSize },
      { x: cx - halfSize, y: cy + halfSize },
      { x: cx - halfSize, y: cy - halfSize },
    ]
  }

  private generateRectangle(): Point[] {
    const width = 50 + Math.random() * 20
    const height = width * (1.5 + Math.random() * 1.5) // aspect ratio 1.5-3.0
    const cx = 50
    const cy = 50
    const halfW = width / 2
    const halfH = height / 2

    return [
      { x: cx - halfW, y: cy - halfH },
      { x: cx + halfW, y: cy - halfH },
      { x: cx + halfW, y: cy + halfH },
      { x: cx - halfW, y: cy + halfH },
      { x: cx - halfW, y: cy - halfH },
    ]
  }

  private generateTriangle(): Point[] {
    const size = 50 + Math.random() * 20
    const cx = 50
    const cy = 50

    // Vary triangle type
    const type = Math.floor(Math.random() * 3)

    if (type === 0) {
      // Equilateral
      const h = (size * Math.sqrt(3)) / 2
      return [
        { x: cx, y: cy - (2 * h) / 3 },
        { x: cx - size / 2, y: cy + h / 3 },
        { x: cx + size / 2, y: cy + h / 3 },
        { x: cx, y: cy - (2 * h) / 3 },
      ]
    } else if (type === 1) {
      // Isosceles
      const h = size * (0.8 + Math.random() * 0.4)
      return [
        { x: cx, y: cy - h / 2 },
        { x: cx - size / 2, y: cy + h / 2 },
        { x: cx + size / 2, y: cy + h / 2 },
        { x: cx, y: cy - h / 2 },
      ]
    } else {
      // Right-angled
      return [
        { x: cx - size / 2, y: cy - size / 2 },
        { x: cx + size / 2, y: cy + size / 2 },
        { x: cx - size / 2, y: cy + size / 2 },
        { x: cx - size / 2, y: cy - size / 2 },
      ]
    }
  }

  private generateLine(): Point[] {
    const length = 50 + Math.random() * 30
    const cx = 50
    const cy = 50
    const angle = Math.random() * Math.PI

    return [
      { x: cx - (length / 2) * Math.cos(angle), y: cy - (length / 2) * Math.sin(angle) },
      { x: cx + (length / 2) * Math.cos(angle), y: cy + (length / 2) * Math.sin(angle) },
    ]
  }

  private generateArrowRight(): Point[] {
    const length = 50 + Math.random() * 20
    const cx = 50
    const cy = 50
    const arrowheadSize = 8 + Math.random() * 4
    const arrowheadAngle = (Math.PI / 6) + (Math.random() * Math.PI) / 12

    const points: Point[] = []

    // Shaft (left to right)
    points.push({ x: cx - length / 2, y: cy })
    points.push({ x: cx + length / 2, y: cy })

    // Arrowhead pointing right
    const tipX = cx + length / 2
    const tipY = cy
    points.push({
      x: tipX - arrowheadSize * Math.cos(arrowheadAngle),
      y: tipY - arrowheadSize * Math.sin(arrowheadAngle),
    })
    points.push({ x: tipX, y: tipY })
    points.push({
      x: tipX - arrowheadSize * Math.cos(arrowheadAngle),
      y: tipY + arrowheadSize * Math.sin(arrowheadAngle),
    })

    return points
  }

  private generateArrowLeft(): Point[] {
    const length = 50 + Math.random() * 20
    const cx = 50
    const cy = 50
    const arrowheadSize = 8 + Math.random() * 4
    const arrowheadAngle = (Math.PI / 6) + (Math.random() * Math.PI) / 12

    const points: Point[] = []

    // Shaft (right to left)
    points.push({ x: cx + length / 2, y: cy })
    points.push({ x: cx - length / 2, y: cy })

    // Arrowhead pointing left
    const tipX = cx - length / 2
    const tipY = cy
    points.push({
      x: tipX + arrowheadSize * Math.cos(arrowheadAngle),
      y: tipY - arrowheadSize * Math.sin(arrowheadAngle),
    })
    points.push({ x: tipX, y: tipY })
    points.push({
      x: tipX + arrowheadSize * Math.cos(arrowheadAngle),
      y: tipY + arrowheadSize * Math.sin(arrowheadAngle),
    })

    return points
  }

  private generateArrowUp(): Point[] {
    const length = 50 + Math.random() * 20
    const cx = 50
    const cy = 50
    const arrowheadSize = 8 + Math.random() * 4
    const arrowheadAngle = (Math.PI / 6) + (Math.random() * Math.PI) / 12

    const points: Point[] = []

    // Shaft (bottom to top)
    points.push({ x: cx, y: cy + length / 2 })
    points.push({ x: cx, y: cy - length / 2 })

    // Arrowhead pointing up
    const tipX = cx
    const tipY = cy - length / 2
    points.push({
      x: tipX - arrowheadSize * Math.sin(arrowheadAngle),
      y: tipY + arrowheadSize * Math.cos(arrowheadAngle),
    })
    points.push({ x: tipX, y: tipY })
    points.push({
      x: tipX + arrowheadSize * Math.sin(arrowheadAngle),
      y: tipY + arrowheadSize * Math.cos(arrowheadAngle),
    })

    return points
  }

  private generateArrowDown(): Point[] {
    const length = 50 + Math.random() * 20
    const cx = 50
    const cy = 50
    const arrowheadSize = 8 + Math.random() * 4
    const arrowheadAngle = (Math.PI / 6) + (Math.random() * Math.PI) / 12

    const points: Point[] = []

    // Shaft (top to bottom)
    points.push({ x: cx, y: cy - length / 2 })
    points.push({ x: cx, y: cy + length / 2 })

    // Arrowhead pointing down
    const tipX = cx
    const tipY = cy + length / 2
    points.push({
      x: tipX - arrowheadSize * Math.sin(arrowheadAngle),
      y: tipY - arrowheadSize * Math.cos(arrowheadAngle),
    })
    points.push({ x: tipX, y: tipY })
    points.push({
      x: tipX + arrowheadSize * Math.sin(arrowheadAngle),
      y: tipY - arrowheadSize * Math.cos(arrowheadAngle),
    })

    return points
  }

  private generateDoubleArrow(): Point[] {
    const length = 50 + Math.random() * 20
    const cx = 50
    const cy = 50
    const arrowheadSize = 8 + Math.random() * 4
    const arrowheadAngle = (Math.PI / 6) + (Math.random() * Math.PI) / 12

    const points: Point[] = []

    // Left arrowhead
    const leftTipX = cx - length / 2
    const leftTipY = cy
    points.push({
      x: leftTipX + arrowheadSize * Math.cos(arrowheadAngle),
      y: leftTipY - arrowheadSize * Math.sin(arrowheadAngle),
    })
    points.push({ x: leftTipX, y: leftTipY })
    points.push({
      x: leftTipX + arrowheadSize * Math.cos(arrowheadAngle),
      y: leftTipY + arrowheadSize * Math.sin(arrowheadAngle),
    })

    // Shaft
    points.push({ x: cx - length / 2, y: cy })
    points.push({ x: cx + length / 2, y: cy })

    // Right arrowhead
    const rightTipX = cx + length / 2
    const rightTipY = cy
    points.push({
      x: rightTipX - arrowheadSize * Math.cos(arrowheadAngle),
      y: rightTipY - arrowheadSize * Math.sin(arrowheadAngle),
    })
    points.push({ x: rightTipX, y: rightTipY })
    points.push({
      x: rightTipX - arrowheadSize * Math.cos(arrowheadAngle),
      y: rightTipY + arrowheadSize * Math.sin(arrowheadAngle),
    })

    return points
  }

  private generateStar(): Point[] {
    const cx = 50
    const cy = 50
    const outerRadius = 30 + Math.random() * 10
    const innerRadius = outerRadius * (0.4 + Math.random() * 0.2)
    const points: Point[] = []
    const numPoints = 5

    for (let i = 0; i < numPoints * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius
      const angle = (i * Math.PI) / numPoints - Math.PI / 2
      const x = cx + radius * Math.cos(angle)
      const y = cy + radius * Math.sin(angle)
      points.push({ x, y })
    }
    points.push(points[0]) // Close the shape

    return points
  }

  private generatePentagon(): Point[] {
    return this.generatePolygon(5, 30 + Math.random() * 10)
  }

  private generateHexagon(): Point[] {
    return this.generatePolygon(6, 30 + Math.random() * 10)
  }

  private generatePolygon(sides: number, radius: number): Point[] {
    const cx = 50
    const cy = 50
    const points: Point[] = []

    for (let i = 0; i <= sides; i++) {
      const angle = (i * 2 * Math.PI) / sides - Math.PI / 2
      const x = cx + radius * Math.cos(angle)
      const y = cy + radius * Math.sin(angle)
      points.push({ x, y })
    }

    return points
  }

  private generateDiamond(): Point[] {
    const size = 50 + Math.random() * 20
    const cx = 50
    const cy = 50

    return [
      { x: cx, y: cy - size / 2 },
      { x: cx + size / 2, y: cy },
      { x: cx, y: cy + size / 2 },
      { x: cx - size / 2, y: cy },
      { x: cx, y: cy - size / 2 },
    ]
  }

  private generateCheck(): Point[] {
    const size = 40 + Math.random() * 20
    const cx = 50
    const cy = 50

    return [
      { x: cx - size / 2, y: cy },
      { x: cx - size / 6, y: cy + size / 2 },
      { x: cx + size / 2, y: cy - size / 3 },
    ]
  }

  private generateX(): Point[] {
    const size = 40 + Math.random() * 20
    const cx = 50
    const cy = 50
    const halfSize = size / 2

    return [
      { x: cx - halfSize, y: cy - halfSize },
      { x: cx + halfSize, y: cy + halfSize },
      { x: cx, y: cy },
      { x: cx - halfSize, y: cy + halfSize },
      { x: cx + halfSize, y: cy - halfSize },
    ]
  }

  private generateHeart(): Point[] {
    const cx = 50
    const cy = 50
    const size = 30 + Math.random() * 10
    const points: Point[] = []
    const numPoints = 100

    for (let i = 0; i <= numPoints; i++) {
      const t = (i / numPoints) * 2 * Math.PI
      // Parametric heart equation
      const x = 16 * Math.pow(Math.sin(t), 3)
      const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))

      points.push({
        x: cx + (x * size) / 16,
        y: cy + (y * size) / 16,
      })
    }

    return points
  }

  private applyAugmentation(points: Point[], config: AugmentationConfig): Point[] {
    let augmented = [...points]

    // 1. Rotation
    const angle = config.rotation.min + Math.random() * (config.rotation.max - config.rotation.min)
    augmented = this.rotate(augmented, (angle * Math.PI) / 180)

    // 2. Scale
    const scale = config.scale.min + Math.random() * (config.scale.max - config.scale.min)
    augmented = this.scale(augmented, scale)

    // 3. Translation
    const tx = (Math.random() - 0.5) * 2 * config.translation.max * 100
    const ty = (Math.random() - 0.5) * 2 * config.translation.max * 100
    augmented = this.translate(augmented, tx, ty)

    // 4. Add noise
    augmented = this.addNoise(augmented, config.noise.stdDev)

    // 5. Resample points
    const targetPoints = config.pointCount.min + Math.floor(Math.random() * (config.pointCount.max - config.pointCount.min))
    augmented = this.resample(augmented, targetPoints)

    return augmented
  }

  private rotate(points: Point[], angle: number): Point[] {
    const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length
    const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length

    return points.map((p) => ({
      x: cx + (p.x - cx) * Math.cos(angle) - (p.y - cy) * Math.sin(angle),
      y: cy + (p.x - cx) * Math.sin(angle) + (p.y - cy) * Math.cos(angle),
    }))
  }

  private scale(points: Point[], factor: number): Point[] {
    const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length
    const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length

    return points.map((p) => ({
      x: cx + (p.x - cx) * factor,
      y: cy + (p.y - cy) * factor,
    }))
  }

  private translate(points: Point[], dx: number, dy: number): Point[] {
    return points.map((p) => ({
      x: p.x + dx,
      y: p.y + dy,
    }))
  }

  private addNoise(points: Point[], stdDev: number): Point[] {
    return points.map((p) => ({
      x: p.x + this.gaussianRandom() * stdDev * 100,
      y: p.y + this.gaussianRandom() * stdDev * 100,
    }))
  }

  private gaussianRandom(): number {
    // Box-Muller transform
    let u = 0,
      v = 0
    while (u === 0) u = Math.random()
    while (v === 0) v = Math.random()
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  }

  private resample(points: Point[], numPoints: number): Point[] {
    const pathLength = this.pathLength(points)
    const interval = pathLength / (numPoints - 1)
    const resampled: Point[] = [points[0]]
    let distSoFar = 0

    for (let i = 1; i < points.length; i++) {
      const d = this.distance(points[i - 1], points[i])

      if (distSoFar + d >= interval) {
        const qx = points[i - 1].x + ((interval - distSoFar) / d) * (points[i].x - points[i - 1].x)
        const qy = points[i - 1].y + ((interval - distSoFar) / d) * (points[i].y - points[i - 1].y)
        const q = { x: qx, y: qy }
        resampled.push(q)
        points.splice(i, 0, q)
        distSoFar = 0
      } else {
        distSoFar += d
      }
    }

    // Pad or trim to exact count
    while (resampled.length < numPoints) {
      resampled.push(points[points.length - 1])
    }
    return resampled.slice(0, numPoints)
  }

  private pathLength(points: Point[]): number {
    let length = 0
    for (let i = 1; i < points.length; i++) {
      length += this.distance(points[i - 1], points[i])
    }
    return length
  }

  private distance(p1: Point, p2: Point): number {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)
  }

  private rasterizeToImage(points: Point[], size: number): Float32Array {
    const imageData = new Float32Array(size * size)

    // Normalize points to bounding box
    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const maxX = Math.max(...xs)
    const maxY = Math.max(...ys)
    const width = maxX - minX
    const height = maxY - minY

    if (width === 0 || height === 0) return imageData

    // Scale to fit in canvas with padding
    const padding = size * 0.1
    const scale = (size - 2 * padding) / Math.max(width, height)

    // Center in canvas
    const offsetX = (size - width * scale) / 2
    const offsetY = (size - height * scale) / 2

    const normalized = points.map((p) => ({
      x: (p.x - minX) * scale + offsetX,
      y: (p.y - minY) * scale + offsetY,
    }))

    // Draw stroke
    for (let i = 1; i < normalized.length; i++) {
      this.drawLine(normalized[i - 1], normalized[i], imageData, size, 2.0)
    }

    return imageData
  }

  private drawLine(p1: Point, p2: Point, imageData: Float32Array, size: number, width: number): void {
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const steps = Math.max(Math.abs(dx), Math.abs(dy)) * 2

    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = Math.round(p1.x + t * dx)
      const y = Math.round(p1.y + t * dy)

      // Draw thick line with width
      for (let wx = -width; wx <= width; wx++) {
        for (let wy = -width; wy <= width; wy++) {
          const dist = Math.sqrt(wx * wx + wy * wy)
          if (dist <= width) {
            const px = x + wx
            const py = y + wy
            if (px >= 0 && px < size && py >= 0 && py < size) {
              const idx = Math.floor(py) * size + Math.floor(px)
              imageData[idx] = 1.0
            }
          }
        }
      }
    }
  }
}
