import { Tldraw } from '@tldraw/tldraw'
import '@tldraw/tldraw/tldraw.css'
import { UserProfile } from '../Auth/UserProfile'

export function SketchlyCanvas() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <UserProfile />
      <Tldraw />
    </div>
  )
}