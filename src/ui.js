// Small shared helpers for rendering and events
import taxonomy from '../data/taxonomy.json'
import { COMP } from './demo.js'

export const $ = s => document.querySelector(s)
export const $$ = s => [...document.querySelectorAll(s)]
export const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export const val = id => (document.getElementById(id)?.value ?? '').trim()

// Evidence origins. Every item in the fingerprint carries one of these.
export const SRC = {
  imported: 'Imported (CV)', cv: 'Imported (CV)', self: 'Self-reported', peer: 'Contextual feedback', learning: 'Learning record',
  contribution: 'Contribution', practice: 'Practice', assessed: 'Assessed', verified: 'Externally verified',
}
export const srcKey = s => (s === 'cv' ? 'imported' : s)
export const chip = (src, extra = '') => `<span class="chip src-${srcKey(src)}">${SRC[src] || src}${extra}</span>`

export const SKILLS = {}
for (const c of taxonomy.categories) for (const s of c.subcategories) for (const k of s.skills) SKILLS[k.id] = { ...k, cat: c.name, sub: s.name }
export const skillName = id => SKILLS[id]?.name || COMP[id]?.n || id
export const compName = k => COMP[k]?.n || k

// Short anonymous label from any id
export function anonId(id) {
  if (String(id).startsWith('demo-')) return 'Candidate ' + id.slice(5)
  let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return 'Candidate ' + h.toString(16).slice(-4).toUpperCase()
}

// ---------- actions (event delegation) ----------
export const actions = {}
export function act(name, fn) { actions[name] = fn }

let renderFn = () => {}
export function setRender(f) { renderFn = f }
export const render = () => renderFn()
export function go(hash) { if (location.hash === hash) renderFn(); else location.hash = hash }

// ---------- feedback ----------
let toastTimer
export function toast(msg, err = false) {
  let t = $('#toast')
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.append(t) }
  t.className = err ? 'err show' : 'show'
  t.textContent = msg
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.className = '', 3500)
}
export function status(el, msg, err = false) { if (typeof el === 'string') el = $(el); if (!el) return; el.className = 'status' + (err ? ' err' : ''); el.innerHTML = msg }
export const spin = '<span class="spin"></span>'
export const fmtDate = d => d ? new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) : ''

export function head(eyebrow, title, lede = '', right = '') {
  return `<div class="head"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${lede ? `<p class="lede">${lede}</p>` : ''}</div>${right ? `<div class="row">${right}</div>` : ''}</div>`
}
export const demoTag = '<span class="pill demo">Demo data</span>'
