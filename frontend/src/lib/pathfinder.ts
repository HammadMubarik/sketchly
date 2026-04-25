/**
 * Orthogonal A* pathfinder for routing lines around shapes.
 *
 * Works on a grid in page-coordinate space. Cells that overlap shape
 * bounding boxes (+ padding) are obstacles. Returns a simplified list
 * of waypoints (direction-change corners only).
 *
 * State includes the direction of arrival so a bend penalty makes the
 * search prefer paths with fewer corners. Optional start/end direction
 * hints let the caller force perpendicular entry/exit at connection
 * points.
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
   * Per-obstacle padding override (page units). Negative shrinks the
   * blocked rect — e.g. -GRID_SIZE leaves the border ring open so a
   * line can terminate on a connection point at the shape's edge.
   */
  padding?: number
}

export interface PathOptions {
  gridSize?: number
  /** Default clearance around obstacles, in page units. */
  padding?: number
  /** Direction the path leaves `start` (unit vec, e.g. [1,0] = right). */
  startDir?: [number, number]
  /** Direction the path arrives at `end` (the final segment's direction). */
  endDir?: [number, number]
  /** Cost added per turn. Higher = straighter routes. Default 4. */
  bendPenalty?: number
}

/** Grid cell size in page units — exported so callers can size endpoint padding. */
export const GRID_SIZE = 25

// Index order matters: dirIndex below depends on it.
const DIRS: [number, number][] = [
  [1, 0],   // 0: east
  [-1, 0],  // 1: west
  [0, 1],   // 2: south
  [0, -1],  // 3: north
]

function dirIndex(dx: number, dy: number): number {
  if (dx === 1 && dy === 0) return 0
  if (dx === -1 && dy === 0) return 1
  if (dx === 0 && dy === 1) return 2
  if (dx === 0 && dy === -1) return 3
  return -1
}

function manhattan(ax: number, ay: number, bx: number, by: number) {
  return Math.abs(ax - bx) + Math.abs(ay - by)
}

/**
 * Find an orthogonal (right-angle only) path from `start` to `end`
 * that avoids all `obstacles`. Falls back to an L-shape if A* fails.
 */
export function findOrthogonalPath(
  start: PathPoint,
  end: PathPoint,
  obstacles: Obstacle[],
  options: PathOptions = {},
): PathPoint[] {
  const gridSize = options.gridSize ?? GRID_SIZE
  const padding = options.padding ?? 18
  const bendPenalty = options.bendPenalty ?? 4

  const toG = (v: number) => Math.round(v / gridSize)
  const fromG = (v: number) => v * gridSize

  const sx = toG(start.x), sy = toG(start.y)
  const ex = toG(end.x),   ey = toG(end.y)

  if (sx === ex && sy === ey) return [start, end]

  const defaultPad = Math.ceil(padding / gridSize)

  const blocked = new Set<string>()
  for (const obs of obstacles) {
    const obsPad = obs.padding !== undefined
      ? Math.ceil(obs.padding / gridSize)
      : defaultPad
    const x1 = toG(obs.x) - obsPad,             y1 = toG(obs.y) - obsPad
    const x2 = toG(obs.x + obs.width) + obsPad, y2 = toG(obs.y + obs.height) + obsPad
    if (x1 > x2 || y1 > y2) continue
    for (let x = x1; x <= x2; x++)
      for (let y = y1; y <= y2; y++)
        blocked.add(`${x},${y}`)
  }
  blocked.delete(`${sx},${sy}`)
  blocked.delete(`${ex},${ey}`)

  // Punch doorways at endpoints. When start/end sits on a shape edge, the
  // anchor cell + the cells immediately around it are inside that shape's
  // padded blocked rect. We open just a narrow channel along the outward
  // direction so A* can step out — without opening the whole border ring,
  // which was the old bug (path traversing the inside perimeter of a box).
  const doorwayDepth = defaultPad + 1
  const punchDoorway = (gx: number, gy: number, outDir: [number, number] | undefined) => {
    blocked.delete(`${gx},${gy}`)
    if (!outDir) return
    for (let i = 1; i <= doorwayDepth; i++) {
      blocked.delete(`${gx + outDir[0] * i},${gy + outDir[1] * i}`)
    }
  }
  punchDoorway(sx, sy, options.startDir)
  // The endDir is the direction the path *arrives* moving — to punch a door
  // outward from the end shape we negate it.
  punchDoorway(ex, ey, options.endDir ? [-options.endDir[0], -options.endDir[1]] : undefined)

  // Search region: obstacle bbox + start/end + generous margin so detours
  // around tightly-packed shapes don't run out of space (was 4 — too tight,
  // routes failed and fell back to a diagonal line).
  const allX = [sx, ex, ...obstacles.flatMap(o => [toG(o.x), toG(o.x + o.width)])]
  const allY = [sy, ey, ...obstacles.flatMap(o => [toG(o.y), toG(o.y + o.height)])]
  const MARGIN = 24
  const minGX = Math.min(...allX) - MARGIN, maxGX = Math.max(...allX) + MARGIN
  const minGY = Math.min(...allY) - MARGIN, maxGY = Math.max(...allY) + MARGIN

  const startDirIdx = options.startDir ? dirIndex(options.startDir[0], options.startDir[1]) : -1
  const endDirIdx = options.endDir ? dirIndex(options.endDir[0], options.endDir[1]) : -1

  // A* state includes incoming direction so the bend penalty is correct
  // (cheapest g to a cell depends on the direction you arrived from).
  interface Node { x: number; y: number; dir: number; g: number; h: number; parent: Node | null }
  const stateKey = (x: number, y: number, dir: number) => `${x},${y},${dir}`

  const open: Node[] = [{
    x: sx, y: sy,
    dir: startDirIdx,             // virtual incoming direction at start
    g: 0,
    h: manhattan(sx, sy, ex, ey),
    parent: null,
  }]
  const best = new Map<string, number>([[stateKey(sx, sy, startDirIdx), 0]])

  let found: Node | null = null

  while (open.length > 0) {
    let bi = 0
    for (let i = 1; i < open.length; i++)
      if (open[i].g + open[i].h < open[bi].g + open[bi].h) bi = i
    const cur = open.splice(bi, 1)[0]
    const ck = stateKey(cur.x, cur.y, cur.dir)
    const known = best.get(ck)
    if (known !== undefined && known < cur.g) continue // stale

    if (cur.x === ex && cur.y === ey) { found = cur; break }

    for (let di = 0; di < DIRS.length; di++) {
      const [dx, dy] = DIRS[di]
      const nx = cur.x + dx, ny = cur.y + dy
      if (nx < minGX || nx > maxGX || ny < minGY || ny > maxGY) continue
      if (blocked.has(`${nx},${ny}`)) continue

      let stepCost = 1
      // Turn cost: cur.dir is -1 only when start has no startDir, in which
      // case the very first move is free.
      if (cur.dir !== -1 && cur.dir !== di) stepCost += bendPenalty
      // Arrival direction preference: stepping into end with the wrong
      // direction is penalised, so the path bends one cell early instead.
      if (endDirIdx !== -1 && nx === ex && ny === ey && di !== endDirIdx) {
        stepCost += bendPenalty
      }

      const ng = cur.g + stepCost
      const nk = stateKey(nx, ny, di)
      if ((best.get(nk) ?? Infinity) <= ng) continue
      best.set(nk, ng)
      open.push({ x: nx, y: ny, dir: di, g: ng, h: manhattan(nx, ny, ex, ey), parent: cur })
    }
  }

  if (!found) return orthogonalFallback(start, end)

  // Reconstruct full grid path
  const cells: [number, number][] = []
  let n: Node | null = found
  while (n) { cells.unshift([n.x, n.y]); n = n.parent }

  // Simplify to direction-change corners only
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

/**
 * L-shaped fallback when A* can't find a route. Bends along the longer
 * axis first so the result still looks like an orthogonal connector
 * rather than a diagonal slash.
 */
function orthogonalFallback(start: PathPoint, end: PathPoint): PathPoint[] {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    return [start, { x: end.x, y: start.y }, end]
  }
  return [start, { x: start.x, y: end.y }, end]
}
