export interface ConnectionAnchor {
  x: number // normalized 0-1
  y: number // normalized 0-1
  internalOnly?: boolean // only snap from lines whose other end is inside this shape
}

const RECTANGLE_ANCHORS: ConnectionAnchor[] = [
  { x: 0.5, y: 0 },   // top center
  { x: 1, y: 0.5 },   // right center
  { x: 0.5, y: 1 },   // bottom center
  { x: 0, y: 0.5 },   // left center
]

const TRIANGLE_ANCHORS: ConnectionAnchor[] = [
  { x: 0.5, y: 0 },   // top vertex
  { x: 1, y: 1 },     // bottom-right vertex
  { x: 0, y: 1 },     // bottom-left vertex
]

const DIAMOND_ANCHORS: ConnectionAnchor[] = [
  { x: 0.5, y: 0 },   // top vertex
  { x: 1, y: 0.5 },   // right vertex
  { x: 0.5, y: 1 },   // bottom vertex
  { x: 0, y: 0.5 },   // left vertex
]

export function getAnchorsForGeoType(geoType: string): ConnectionAnchor[] {
  switch (geoType) {
    case 'rectangle':
      return RECTANGLE_ANCHORS
    case 'triangle':
      return TRIANGLE_ANCHORS
    case 'diamond':
      return DIAMOND_ANCHORS
    default:
      return []
  }
}

/** External-only anchors for uml-class shapes (the 4 side midpoints). */
export function getExternalAnchors(): ConnectionAnchor[] {
  return RECTANGLE_ANCHORS
}
