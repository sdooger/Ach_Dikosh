// One small data API used by every screen.
// "cloud" = Supabase (accounts, shared between users). "guest" = this browser only (localStorage).
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const sb = url && key ? createClient(url, key) : null
export const cloudAvailable = !!sb

let mode = 'guest'
let uid = 'guest'
export const me = () => uid
export const currentMode = () => mode

// ---------- browser storage backend ----------
const LKEY = 'achievers-v2'
function L() { try { return JSON.parse(localStorage.getItem(LKEY)) || {} } catch { return {} } }
function W(d) { try { localStorage.setItem(LKEY, JSON.stringify(d)) } catch {} }
const now = () => new Date().toISOString()
const matches = (r, m) => Object.entries(m).every(([k, v]) => r[k] === v)

// ---------- generic table operations ----------
export async function list(table, match = {}) {
  if (mode === 'guest') return (L()[table] || []).filter(r => matches(r, match))
  let q = sb.from(table).select('*').match(match)
  q = q.order(table === 'profiles' ? 'id' : 'created_at')
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function insert(table, row) {
  if (mode === 'guest') {
    const d = L(); const r = { id: crypto.randomUUID(), created_at: now(), ...row }
    d[table] = [...(d[table] || []), r]; W(d); return r
  }
  const { data, error } = await sb.from(table).insert(row).select().single()
  if (error) throw error
  return data
}

export async function insertMany(table, rows) {
  if (!rows.length) return []
  if (mode === 'guest') {
    const d = L(); const out = rows.map(r => ({ id: crypto.randomUUID(), created_at: now(), ...r }))
    d[table] = [...(d[table] || []), ...out]; W(d); return out
  }
  const { data, error } = await sb.from(table).insert(rows).select()
  if (error) throw error
  return data
}

export async function update(table, id, patch) {
  if (mode === 'guest') {
    const d = L(); d[table] = (d[table] || []).map(r => r.id === id ? { ...r, ...patch } : r); W(d); return
  }
  const { error } = await sb.from(table).update(patch).eq('id', id)
  if (error) throw error
}

export async function remove(table, id) {
  if (mode === 'guest') { const d = L(); d[table] = (d[table] || []).filter(r => r.id !== id); W(d); return }
  const { error } = await sb.from(table).delete().eq('id', id)
  if (error) throw error
}

export async function removeWhere(table, match) {
  if (mode === 'guest') { const d = L(); d[table] = (d[table] || []).filter(r => !matches(r, match)); W(d); return }
  const { error } = await sb.from(table).delete().match(match)
  if (error) throw error
}

// Insert or replace one row identified by `keys` (e.g. user_id + course_id)
export async function upsert(table, row, keys) {
  if (mode === 'guest') {
    const d = L(); const m = Object.fromEntries(keys.map(k => [k, row[k]]))
    const old = (d[table] || []).find(r => matches(r, m))
    if (old) Object.assign(old, row); else d[table] = [...(d[table] || []), { id: crypto.randomUUID(), created_at: now(), ...row }]
    W(d); return
  }
  const { error } = await sb.from(table).upsert(row, { onConflict: keys.join(',') })
  if (error) throw error
}

// ---------- profile ----------
export async function getProfile(id = uid) {
  if (mode === 'guest') return (L().profiles || []).find(p => p.id === id) || null
  const { data, error } = await sb.from('profiles').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}
export async function saveProfile(patch) {
  if (mode === 'guest') {
    const d = L(); d.profiles = d.profiles || []
    const p = d.profiles.find(x => x.id === uid)
    if (p) Object.assign(p, patch); else d.profiles.push({ id: uid, ...patch })
    W(d); return
  }
  const { error } = await sb.from('profiles').upsert({ id: uid, ...patch, updated_at: now() })
  if (error) throw error
}

// ---------- files ----------
export async function uploadCv(file) {
  if (mode === 'guest' || !file) return null
  const path = `${uid}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, '_')}`
  const { error } = await sb.storage.from('cvs').upload(path, file)
  if (error) throw error
  return path
}

// ---------- auth ----------
export async function initAuth() {
  if (!sb) return null
  const { data } = await sb.auth.getSession()
  if (data.session) { mode = 'cloud'; uid = data.session.user.id }
  return data.session
}
export async function signUp(email, password) {
  const { data, error } = await sb.auth.signUp({ email, password })
  if (error) throw error
  if (data.session) { mode = 'cloud'; uid = data.session.user.id }
  return data
}
export async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw error
  mode = 'cloud'; uid = data.user.id
  return data
}
export async function signOut() { if (sb && mode === 'cloud') await sb.auth.signOut(); mode = 'guest'; uid = 'guest' }
export function useGuest() { mode = 'guest'; uid = 'guest' }
export async function userEmail() {
  if (mode !== 'cloud') return ''
  const { data } = await sb.auth.getUser()
  return data.user?.email || ''
}
export function resetGuest() { try { localStorage.removeItem(LKEY) } catch {} }

// ---------- referee links (no account needed) ----------
export async function getRef(token) {
  const { data, error } = await sb.rpc('get_reference', { p_token: token })
  if (error) throw error
  return data?.[0] || null
}
export async function submitRef(token, text) {
  const { data, error } = await sb.rpc('submit_reference', { p_token: token, p_response: text })
  if (error) throw error
  return data
}
