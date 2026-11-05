// Data layer. "cloud" = Supabase account, "guest" = this browser only.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const sb = url && key ? createClient(url, key) : null
export const cloudAvailable = !!sb

const GUEST_KEY = 'achievers-guest-v1'
let mode = 'guest'
let userId = null

export function currentMode() { return mode }

function guestRead() {
  try { return JSON.parse(localStorage.getItem(GUEST_KEY)) || emptyData() } catch { return emptyData() }
}
function guestWrite(d) { try { localStorage.setItem(GUEST_KEY, JSON.stringify(d)) } catch {} }
function emptyData() { return { profile: {}, cv: null, experiences: [], evidence: [], refs: [] } }

// ---------- auth ----------
export async function initAuth() {
  if (!sb) return null
  const { data } = await sb.auth.getSession()
  if (data.session) { mode = 'cloud'; userId = data.session.user.id }
  return data.session
}
export async function signUp(email, password) {
  const { data, error } = await sb.auth.signUp({ email, password })
  if (error) throw error
  if (data.session) { mode = 'cloud'; userId = data.session.user.id }
  return data
}
export async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw error
  mode = 'cloud'; userId = data.user.id
  return data
}
export async function signOut() {
  if (sb) await sb.auth.signOut()
  mode = 'guest'; userId = null
}
export function useGuest() { mode = 'guest'; userId = null }
export async function userEmail() {
  if (!sb || mode !== 'cloud') return ''
  const { data } = await sb.auth.getUser()
  return data.user?.email || ''
}

// ---------- load everything for the current user ----------
export async function loadAll() {
  if (mode === 'guest') return guestRead()
  const [p, cv, ex, ev, refs] = await Promise.all([
    sb.from('profiles').select('*').eq('id', userId).maybeSingle(),
    sb.from('cv_documents').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
    sb.from('experiences').select('*').eq('user_id', userId).order('created_at'),
    sb.from('evidence').select('*').eq('user_id', userId).order('created_at'),
    sb.from('reference_requests').select('*').eq('user_id', userId).order('created_at'),
  ])
  for (const r of [p, cv, ex, ev, refs]) if (r.error) throw r.error
  return { profile: p.data || {}, cv: cv.data?.[0] || null, experiences: ex.data, evidence: ev.data, refs: refs.data }
}

export async function saveProfile(patch) {
  if (mode === 'guest') { const d = guestRead(); d.profile = { ...d.profile, ...patch }; guestWrite(d); return }
  const { error } = await sb.from('profiles').upsert({ id: userId, ...patch, updated_at: new Date().toISOString() })
  if (error) throw error
}

export async function saveCv(file, text) {
  if (mode === 'guest') { const d = guestRead(); d.cv = { file_name: file?.name || 'pasted text', text }; guestWrite(d); return }
  let file_path = null
  if (file) {
    file_path = `${userId}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, '_')}`
    const up = await sb.storage.from('cvs').upload(file_path, file, { upsert: false })
    if (up.error) throw up.error
  }
  const { error } = await sb.from('cv_documents').insert({ user_id: userId, file_name: file?.name || 'pasted text', file_path, text })
  if (error) throw error
}

// Replace everything that came from the CV or the student's own notes
export async function replaceCvEvidence(evidence, experiences) {
  if (mode === 'guest') {
    const d = guestRead()
    d.evidence = d.evidence.filter(e => !['cv', 'self'].includes(e.source)).concat(evidence.map(e => ({ id: crypto.randomUUID(), ...e })))
    d.experiences = experiences
    guestWrite(d); return
  }
  let r = await sb.from('evidence').delete().eq('user_id', userId).in('source', ['cv', 'self'])
  if (r.error) throw r.error
  r = await sb.from('experiences').delete().eq('user_id', userId)
  if (r.error) throw r.error
  if (evidence.length) { r = await sb.from('evidence').insert(evidence.map(e => ({ ...e, user_id: userId }))); if (r.error) throw r.error }
  if (experiences.length) { r = await sb.from('experiences').insert(experiences.map(e => ({ ...e, user_id: userId }))); if (r.error) throw r.error }
}

// Replace evidence with a given title + source (used by the reasoning check)
export async function setEvidence(item) {
  if (mode === 'guest') {
    const d = guestRead()
    d.evidence = d.evidence.filter(e => !(e.source === item.source && e.title === item.title))
    if (item.skill_id) d.evidence.push({ id: crypto.randomUUID(), ...item })
    guestWrite(d); return
  }
  let r = await sb.from('evidence').delete().eq('user_id', userId).eq('source', item.source).eq('title', item.title)
  if (r.error) throw r.error
  if (item.skill_id) { r = await sb.from('evidence').insert({ ...item, user_id: userId }); if (r.error) throw r.error }
}

// ---------- Meet Me Through Others ----------
export async function createRef(req) {
  if (mode === 'guest') {
    const d = guestRead()
    const row = { id: crypto.randomUUID(), token: crypto.randomUUID(), status: 'pending', response: null, ...req }
    d.refs.push(row); guestWrite(d); return row
  }
  const { data, error } = await sb.from('reference_requests').insert({ ...req, user_id: userId }).select().single()
  if (error) throw error
  return data
}
// Guest mode only: answer your own demo request in this browser
export async function answerGuestRef(id, text) {
  const d = guestRead()
  const r = d.refs.find(x => x.id === id)
  if (!r) return
  r.response = text; r.status = 'answered'
  d.evidence.push({ id: crypto.randomUUID(), skill_id: r.skill_id, source: 'peer', title: `${r.relationship}: ${r.referee_name}`, detail: `"${text.slice(0, 600)}"`, level: 3 })
  guestWrite(d)
}

// Referee page (no account needed)
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
