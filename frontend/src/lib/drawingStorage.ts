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

export async function getDrawingById(drawingId: string): Promise<Drawing | null> {
  const { data, error } = await supabase
    .from('drawings')
    .select('*')
    .eq('id', drawingId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Error fetching drawing by ID:', error)
    return null
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
        is_default: false,
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

// --- Room Visits ---

export interface RoomVisit {
  id: string
  user_id: string
  drawing_id: string
  room_name: string
  last_visited_at: string
  created_at: string
  owner_id?: string
}

export async function recordRoomVisit(
  userId: string,
  drawingId: string,
  roomName: string = 'Untitled Drawing'
): Promise<void> {
  const { error } = await supabase
    .from('room_visits')
    .upsert(
      {
        user_id: userId,
        drawing_id: drawingId,
        room_name: roomName,
        last_visited_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,drawing_id' }
    )

  if (error) {
    console.error('Error recording room visit:', error)
  }
}

export async function getUserRoomVisits(userId: string): Promise<RoomVisit[]> {
  const { data, error } = await supabase
    .from('room_visits')
    .select(`
      *,
      drawings!inner(user_id)
    `)
    .eq('user_id', userId)
    .order('last_visited_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Error fetching room visits:', error)
    return []
  }

  // Map the joined data to include owner_id
  return (data || []).map((visit: any) => ({
    id: visit.id,
    user_id: visit.user_id,
    drawing_id: visit.drawing_id,
    room_name: visit.room_name,
    last_visited_at: visit.last_visited_at,
    created_at: visit.created_at,
    owner_id: visit.drawings?.user_id,
  }))
}

export async function deleteRoomVisit(visitId: string): Promise<void> {
  const { error } = await supabase
    .from('room_visits')
    .delete()
    .eq('id', visitId)

  if (error) {
    console.error('Error deleting room visit:', error)
  }
}
