import { createClient } from '@supabase/supabase-js'

const DEFAULT_URL = 'https://ndnuvbzegifrsdaiultd.supabase.co'

export const getSupabaseConfig = () => {
  const envUrl = import.meta.env.VITE_SUPABASE_URL
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const localKey = localStorage.getItem('perfomax_supabase_anon_key')

  const url = (envUrl && envUrl.trim()) ? envUrl.trim() : DEFAULT_URL
  let key = ''

  if (envKey && envKey.trim()) {
    key = envKey.trim()
    // Jika ada di .env, bersihkan cache lama di localStorage agar tidak bentrok
    if (localKey && localKey !== key) {
      localStorage.removeItem('perfomax_supabase_anon_key')
    }
  } else if (localKey && localKey.trim()) {
    key = localKey.trim()
  }

  // Bersihkan dari spasi atau tanda petik yang tidak sengaja ter-copy
  key = key.replace(/^["']|["']$/g, '').trim()

  return { url, key }
}

export const isSupabaseConfigured = () => {
  const { key } = getSupabaseConfig()
  return Boolean(key && key.length > 20)
}

let supabaseInstance = null

export const saveSupabaseKey = (key) => {
  if (key && key.trim()) {
    const cleaned = key.trim().replace(/^["']|["']$/g, '')
    localStorage.setItem('perfomax_supabase_anon_key', cleaned)
    supabaseInstance = null // Reset client instance
    window.location.reload()
  }
}

export const clearSupabaseKey = () => {
  localStorage.removeItem('perfomax_supabase_anon_key')
  supabaseInstance = null
  window.location.reload()
}

export const getSupabase = () => {
  const { url, key } = getSupabaseConfig()
  if (!key) {
    return null
  }
  if (!supabaseInstance) {
    supabaseInstance = createClient(url, key, {
      auth: {
        persistSession: false
      }
    })
  }
  return supabaseInstance
}
