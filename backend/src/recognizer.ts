export interface Point { x: number; y: number }

function distance(a: Point, b: Point) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy)
}

function pathLength(points: Point[]) {
  let len = 0
  for (let i = 1; i < points.length; i++) len += distance(points[i - 1], points[i])
  return len
}

function perpendicularDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const mag = Math.sqrt(dx * dx + dy * dy)
  if (mag === 0) return distance(p, a)
  const u = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (mag * mag)
  const uClamped = Math.max(0, Math.min(1, u))
  const cx = a.x + uClamped * dx
  const cy = a.y + uClamped * dy
  return Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2)
}

export function geometricRecognize(points: Point[]): { name: string; confidence: number } {
  if (!points || points.length < 3) return { name: 'unknown', confidence: 0 }

  // safe non-null start/end (we already guarded for length >= 3 above)
  const start = points[0]!
  const end = points[points.length - 1]!
  const isClosed = distance(start, end) < pathLength(points) * 0.15

  // Linearity
  const lineLen = distance(start, end)
  let maxDev = 0
  for (const p of points) maxDev = Math.max(maxDev, perpendicularDistance(p, start, end))
  let linearity = 0
  if (lineLen > 0) linearity = Math.max(0, 1 - (maxDev / lineLen) * 3)

  if (linearity > 0.92) return { name: 'line', confidence: linearity }
  if (!isClosed && linearity > 0.6) return { name: 'line', confidence: linearity }

  // Circularity
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length
  const radii = points.map(p => Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2))
  const avgR = radii.reduce((s, r) => s + r, 0) / radii.length
  const variance = radii.reduce((s, r) => s + (r - avgR) ** 2, 0) / radii.length
  const stdDev = Math.sqrt(variance)
  const ratio = avgR === 0 ? 1 : stdDev / avgR
  const circScore = Math.max(0, 1 - ratio * 4)
  if (circScore > 0.8 && isClosed) return { name: 'circle', confidence: circScore }

  // Rectangularity
  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  const w = Math.max(...xs) - Math.min(...xs)
  const h = Math.max(...ys) - Math.min(...ys)
  const perim = 2 * (w + h) || 1
  const plen = pathLength(points)
  const rectScore = Math.max(0, 1 - Math.abs(1 - (plen / perim)))
  if (rectScore > 0.72 && isClosed) return { name: 'rectangle', confidence: rectScore }

  // Diamond/triangle detection heuristics (simple)
  if (rectScore > 0.5 && isClosed) return { name: 'diamond', confidence: rectScore * 0.9 }

  return { name: 'unknown', confidence: 0 }
}
