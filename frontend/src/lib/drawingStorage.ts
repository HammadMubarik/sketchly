import { supabase } from './supabaseClient'
import type { TLEditorSnapshot } from '@tldraw/tldraw'

export interface Drawing {
  id: string
  user_id: string
  name: string
  snapshot: TLEditorSnapshot
  created_at: string
  updated_at: string
  is_default: boolean
}

export async function getDefaultDrawing(userId: string): Promise<Drawing | null> {
  const { data, error } = await supabase
    .from('drawings')
    .select('*')
    .eq('user_id', userId)
    .eq('is_default', true)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Error fetching default drawing:', error)
    throw error
  }

  return data
}

export async function saveDrawingSnapshot(
  userId: string,
  drawingId: string | null,
  snapshot: TLEditorSnapshot
): Promise<Drawing> {
  if (drawingId) {
    const { data, error } = await supabase
      .from('drawings')
      .update({ snapshot })
      .eq('id', drawingId)
      .select()
      .single()

    if (error) {
      console.error('Error updating drawing:', error)
      throw error
    }

    return data
  } else {
    const { data, error } = await supabase
      .from('drawings')
      .insert({
        user_id: userId,
        name: 'Untitled Drawing',
        snapshot,
        is_default: true,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating drawing:', error)
      throw error
    }

    return data
  }
}
