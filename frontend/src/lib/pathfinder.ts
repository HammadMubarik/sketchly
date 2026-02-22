/**
 * Orthogonal A* pathfinder for routing lines around shapes.
 *
 * Works on a grid in page-coordinate space. Cells that overlap
 * shape bounding boxes (+ padding) are treated as obstacles.
 * Returns a simplified list of waypoints (direction-change corners only).
 */

export interface PathPoint {
  x: number
  y: number
}

export interface Obstacle {
  x: number
  y: number
  width: number
  height: number
  /**
   * Per-obstacle padding override (page units).
   * Use a negative value (e.g. -GRID_SIZE) for endpoint shapes so only
   * their interior is blocked; the border cells (connection points) stay open.
   */
  padding?: number
}

/** Grid cell size in page units — export so callers can use it for endpoint padding. */
export const GRID_SIZE = 25

const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]

function key(x: number, y: number) {
  return `${x},${y}`
}

function manhattan(ax: number, ay: number, bx: number, by: number) {
  return Math.abs(ax - bx) + Math.abs(ay - by)
}

/**
 * Find an orthogonal (right-angle only) path from `start` to `end`
 * that avoids all `obstacles`.
 *
 * @param gridSize  Page-unit size of each grid cell (default GRID_SIZE)
 * @param padding   Default extra clearance around each obstacle (default 18px)
 * @returns Array of page-coordinate waypoints (only corners, not every cell)
 */
export function findOrthogonalPath(
  start: PathPoint,
  end: PathPoint,
  obstacles: Obstacle[],
  gridSize = GRID_SIZE,
  padding = 18,
): PathPoint[] {
  const toG = (v: number) => Math.round(v / gridSize)
  const fromG = (v: number) => v * gridSize

  const sx = toG(start.x), sy = toG(start.y)
  const ex = toG(end.x),   ey = toG(end.y)

  if (sx === ex && sy === ey) return [start, end]

  const defaultPad = Math.ceil(padding / gridSize)

  // Build blocked set — each obstacle can override its own padding
  const blocked = new Set<string>()
  for (const obs of obstacles) {
    const obsPad = obs.padding !== undefined
      ? Math.ceil(obs.padding / gridSize)
      : defaultPad
    const x1 = toG(obs.x) - obsPad,            y1 = toG(obs.y) - obsPad
    const x2 = toG(obs.x + obs.width) + obsPad, y2 = toG(obs.y + obs.height) + obsPad
    if (x1 > x2 || y1 > y2) continue // shape too small for negative padding to leave any interior
    for (let x = x1; x <= x2; x++)
      for (let y = y1; y <= y2; y++)
        blocked.add(key(x, y))
  }
  // Always unblock start and end so the path can begin/terminate
  blocked.delete(key(sx, sy))
  blocked.delete(key(ex, ey))

  // Bound the search to the region containing all shapes + margin
  const allX = [sx, ex, ...obstacles.flatMap(o => [toG(o.x), toG(o.x + o.width)])]
  const allY = [sy, ey, ...obstacles.flatMap(o => [toG(o.y), toG(o.y + o.height)])]
  const MARGIN = 4
  const minGX = Math.min(...allX) - MARGIN, maxGX = Math.max(...allX) + MARGIN
  const minGY = Math.min(...allY) - MARGIN, maxGY = Math.max(...allY) + MARGIN

  // A* search
  interface Node { x: number; y: number; g: number; h: number; parent: Node | null }

  const open: Node[] = [{ x: sx, y: sy, g: 0, h: manhattan(sx, sy, ex, ey), parent: null }]
  const closed = new Set<string>()
  const best = new Map<string, number>([[key(sx, sy), 0]])

  let found: Node | null = null

  while (open.length > 0 && !found) {
    let bi = 0
    for (let i = 1; i < open.length; i++)
      if (open[i].g + open[i].h < open[bi].g + open[bi].h) bi = i
    const cur = open.splice(bi, 1)[0]
    const ck = key(cur.x, cur.y)
    if (closed.has(ck)) continue
    closed.add(ck)

    if (cur.x === ex && cur.y === ey) { found = cur; break }

    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx, ny = cur.y + dy
      if (nx < minGX || nx > maxGX || ny < minGY || ny > maxGY) continue
      const nk = key(nx, ny)
      if (closed.has(nk) || blocked.has(nk)) continue
      const ng = cur.g + 1
      if ((best.get(nk) ?? Infinity) <= ng) continue
      best.set(nk, ng)
      open.push({ x: nx, y: ny, g: ng, h: manhattan(nx, ny, ex, ey), parent: cur })
    }
  }

  if (!found) return [start, end] // fallback: straight line

  // Reconstruct full grid path
  const cells: [number, number][] = []
  let n: Node | null = found
  while (n) { cells.unshift([n.x, n.y]); n = n.parent }

  // Simplify: keep only direction-change points
  const pts: PathPoint[] = [{ x: fromG(cells[0][0]), y: fromG(cells[0][1]) }]
  for (let i = 1; i < cells.length - 1; i++) {
    const [px, py] = cells[i - 1]
    const [cx, cy] = cells[i]
    const [nx, ny] = cells[i + 1]
    if (cx - px !== nx - cx || cy - py !== ny - cy)
      pts.push({ x: fromG(cx), y: fromG(cy) })
  }
  pts.push({ x: fromG(cells.at(-1)![0]), y: fromG(cells.at(-1)![1]) })

  return pts
}
