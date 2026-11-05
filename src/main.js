import taxonomy from '../data/taxonomy.json'
import * as db from './db.js'
import { S, loadMe, setView } from './state.js'
import { $, esc, act, actions, setRender, render, go, toast, status, spin } from './ui.js'
import { onboard, bindOnboard, discover, drawFingerprint, profilePage, activities } from './candidate.js'
import { marketplace, topicPage, learning, coursePage, feedbackPage, PROMPTS } from './develop.js'
import { applyPage, jobPage, challengePage, groupPage, leaveChallenge } from './apply.js'
import { discoverPage, jobsPage, assessPage, jobPipeline, comparePage, candidatePage, topicsAdmin, companyPage } from './employer.js'

// ---------- navigation: four stages, one small tab row per stage ----------
const STAGES = [
  ['Build', '#onboard'],
  ['Develop', '#develop'],
  ['Demonstrate', '#apply'],
  ['Connect', '#e-discover'],
]
const SUBNAV = [
  [['#onboard', 'Add evidence'], ['#discover', 'Skill Fingerprint'], ['#profile', 'Profile'], ['#activities', 'Activities']],
  [['#develop', 'Topics'], ['#develop/learn', 'Learning Hub'], ['#develop/feedback', 'Feedback']],
  [],
  [['#e-discover', 'Talent discovery'], ['#e-jobs', 'Job openings'], ['#e-assess', 'Assessments'], ['#e-company', 'Company']],
]
function stageOf(h) {
  if (h.startsWith('e-')) return 3
  if (/^(apply|job|challenge|group)/.test(h)) return 2
  if (/^(develop|topic|course)/.test(h)) return 1
  return 0
}

async function route() {
  const raw = location.hash.slice(1)
  let [path, query] = raw.split('?')
  const params = new URLSearchParams(query || '')
  const view = $('#view')
  $('.help').hidden = path.startsWith('ref/')
  if (!path.startsWith('challenge/') && !path.startsWith('group/')) leaveChallenge()
  if (path.startsWith('ref/')) return refereeView(path.slice(4))
  if (!S.started) return path === 'start' ? welcome() : home()
  if (path === 'home') return home()
  if (path === 'start') path = ''
  // Connect is the employer side of the same demo; every other stage is the candidate side
  const wantEmp = path.startsWith('e-')
  if (path && !path.startsWith('topic/') && wantEmp !== (S.view === 'employer')) await switchView(wantEmp ? 'employer' : 'candidate', false)
  shell(path)
  if (!path) return go(S.view === 'employer' ? '#e-discover' : (S.profile.onboarding || 0) >= 4 ? '#discover' : '#onboard')
  view.innerHTML = `<p class="status">${spin}Loading…</p>`
  try {
    const [a, b] = path.split('/')
    let html
    switch (a) {
      case 'onboard': html = onboard(); break
      case 'discover': html = discover(); break
      case 'develop': html = b === 'learn' ? learning() : b === 'feedback' ? feedbackPage(params) : await marketplace(); break
      case 'topic': html = await topicPage(decodeURIComponent(b)); break
      case 'course': html = coursePage(b); break
      case 'apply': html = await applyPage(); break
      case 'job': html = await jobPage(decodeURIComponent(b)); break
      case 'challenge': html = await challengePage(b); break
      case 'group': html = await groupPage(b); break
      case 'activities': html = await activities(); break
      case 'profile': html = profilePage(); break
      case 'e-discover': html = await discoverPage(); break
      case 'e-jobs': html = await jobsPage(); break
      case 'e-assess': html = await assessPage(); break
      case 'e-job': html = await jobPipeline(decodeURIComponent(b)); break
      case 'e-compare': html = await comparePage(decodeURIComponent(b), (params.get('ids') || '').split(',').filter(Boolean)); break
      case 'e-cand': html = await candidatePage(decodeURIComponent(b), params); break
      case 'e-topics': html = await topicsAdmin(); break
      case 'e-company': html = companyPage(); break
      default: html = `<div class="card stack"><h2>Page not found</h2><a class="btn" href="#discover">Go to my fingerprint</a></div>`
    }
    view.innerHTML = html
    // work-style sliders glide instead of jumping between five positions
    view.querySelectorAll('input[type=range]').forEach(r => { const s = r.getAttribute('step'); if (!s || s === '1') r.step = '0.05' })
    if (a === 'onboard') bindOnboard()
    if (a === 'discover') drawFingerprint()
    if (a === 'group') { const m = $('#msgs'); if (m) m.scrollTop = m.scrollHeight; actions['g-alloc']?.() }
  } catch (e) {
    console.error(e)
    view.innerHTML = `<div class="card stack"><h2>Something went wrong</h2><p class="hint">${esc(e.message || e)}</p><p class="hint">If this mentions a missing column or table, run supabase/schema_v2.sql in Supabase.</p></div>`
  }
}
setRender(() => { const y = window.scrollY; route().then(() => window.scrollTo(0, y)) })
window.addEventListener('hashchange', () => {
  setHelp(false)
  route(); window.scrollTo(0, 0)
  const v = $('#view'); v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter')
})

function whoHtml() {
  return db.currentMode() === 'cloud'
    ? '<button class="ghost" data-act="signout">Sign out</button>'
    : `<span class="pill">Guest · saved in this browser</span>${db.cloudAvailable ? '<button class="ghost" data-act="signout">Exit</button>' : ''}`
}
function shell(path, landing = false) {
  const st = landing ? -1 : stageOf(path)
  $('#nav').hidden = false
  $('#nav').innerHTML = STAGES.map(([n, h], i) => `<a href="${h}" ${i === st ? 'aria-current="page"' : ''}><b>${i + 1}</b>${n}</a>`).join('')
  $('#who').innerHTML = whoHtml()
  const items = st >= 0 ? SUBNAV[st] : []
  const sub = $('#subnav')
  sub.hidden = !items.length
  if (items.length) {
    const here = '#' + path
    // the longest matching tab is the current one (so #develop does not also light up #develop/learn)
    const cur = items.map(([h]) => h).filter(h => here === h || here.startsWith(h + '/') || (h === '#develop' && /^#(topic|course)\//.test(here)) || (h === '#e-discover' && /^#e-(cand|compare)\//.test(here)) || (h === '#e-jobs' && /^#e-job\//.test(here)))
      .sort((a, b) => b.length - a.length)[0]
    sub.innerHTML = `<div class="wrap">${items.map(([h, n]) => `<a href="${h}" ${h === cur ? 'aria-current="page"' : ''}>${n}</a>`).join('')}</div>`
  }
}
async function switchView(v, navigate = true) {
  setView(v)
  await loadMe()
  if (v === 'employer' && !S.profile.is_recruiter) { await db.saveProfile({ is_recruiter: true }); S.profile.is_recruiter = true }
  if (navigate) go(v === 'employer' ? '#e-discover' : '#discover')
}

// ---------- landing (the page the logo leads to) ----------
const JOURNEY = [
  ['1', 'Build', "Upload your CV. It is matched to Canada's OaSIS skills taxonomy, and people who worked with you add what they saw."],
  ['2', 'Develop', 'Answer real business topics and take short lessons from companies and universities. Your contributions make you visible.'],
  ['3', 'Demonstrate', 'Apply to roles and take realistic job simulations that show how you reason and decide, alone or in a group.'],
  ['4', 'Connect', 'Employers see anonymised, standardised profiles first, then meet the people who fit. People decide, not an automated ranking.'],
]
function heroDraw(c) {
  if (!c) return
  const x = c.getContext('2d'), W = c.width, css = getComputedStyle(document.documentElement)
  let i = 0
  const bands = taxonomy.categories.flatMap(cat => cat.subcategories).filter(s => s.skills.length).map(s => {
    let sum = 0; const by = {}
    for (const k of s.skills) if (++i % 3) { sum += 1 + (i % 3); const src = i % 11 === 0 ? 'peer' : i % 7 === 0 ? 'assessed' : 'cv'; by[src] = (by[src] || 0) + 1 }
    const top = Object.keys(by).sort((a, b) => ['peer', 'assessed'].includes(b) - ['peer', 'assessed'].includes(a) || by[b] - by[a])[0]
    return { p: sum / (s.skills.length * 5), col: css.getPropertyValue(top ? '--s-' + top : '--line').trim() }
  })
  let seed = [...'achievers'].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 7)
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
  x.clearRect(0, 0, W, W)
  const cx = W / 2, cy = W * .53, rings = 27
  for (let n = 0; n < rings; n++) {
    const b = bands[Math.floor(n / rings * bands.length)], base = 9 + n * 9.4
    x.strokeStyle = b.col; x.globalAlpha = b.p > 0 ? .95 : .5; x.lineWidth = b.p > 0 ? 2 + b.p * 9 : 1.3; x.lineCap = 'round'
    const gapAt = rnd() * 6.28, gapLen = .12 + rnd() * .35
    x.beginPath(); let pen = false
    for (let t = 0; t <= 6.29; t += .02) {
      if (n > 3 && Math.abs((t - gapAt + 6.28) % 6.28) < gapLen) { pen = false; continue }
      const r = base * (1 + .07 * Math.sin(2 * t + n * .2) + .05 * b.p * Math.cos(3 * t + n * .3) + .03 * Math.sin(5 * t + n))
      const px = cx + r * Math.cos(t), py = cy + r * Math.sin(t) * (t > 3.3 && t < 6.1 ? 1.12 : .92)
      if (!pen) { x.moveTo(px, py); pen = true } else x.lineTo(px, py)
    }
    x.stroke()
  }
  x.globalAlpha = 1
}
function home() {
  if (S.started) shell('', true); else { $('#nav').hidden = true; $('#subnav').hidden = true; $('#who').innerHTML = '' }
  const cta = S.started ? ((S.profile.onboarding || 0) >= 4 ? '#discover' : '#onboard') : '#start'
  const label = S.started ? 'Continue' : 'Try it now'
  $('#view').innerHTML = `<section class="lp-hero">
    <div><div class="eyebrow">Talent experience</div>
      <h1>There is more to you than a CV.</h1>
      <p class="lede">A Skill Fingerprint that grows with you: your CV, short lessons, contributions and job simulations, each labelled by where the evidence came from. Employers see anonymised evidence, not just a CV.</p>
      <div class="row"><a class="btn primary" href="${cta}">${label}</a><button data-act="scroll" data-to="how">How it works</button></div>
    </div>
    <canvas id="fph" width="560" height="560" aria-hidden="true"></canvas>
  </section>
  <section class="lp-sec" id="how"><div class="reveal"><div class="eyebrow">The journey</div><h2>From CV to interview in four steps</h2></div>
    <div class="lp-steps">${JOURNEY.map(([n, name, text], i) => `<div class="card lp-step reveal live" style="--i:${i + 1}">
      <span class="n">${n}</span><h3>${name}</h3><p>${text}</p><span class="pill ok">Live now</span></div>`).join('')}</div>
  </section>
  <section class="lp-sec"><div class="reveal"><div class="eyebrow">Why it is different</div><h2>Evidence you can check, not a score</h2></div>
    <div class="lp-points">
      <div class="reveal" style="--i:1"><h3>Every skill has a source</h3><p>Each skill links back to the sentence in your CV, or the person or activity, it came from.</p></div>
      <div class="reveal" style="--i:2"><h3>Labels you can trust</h3><p>An employer can tell what you wrote yourself from what others confirmed or what was assessed.</p></div>
      <div class="reveal" style="--i:3"><h3>No overall score</h3><p>Your fingerprint is a multidimensional profile, never a single number or a hidden ranking.</p></div>
    </div>
  </section>
  <section class="lp-sec"><div class="card stack lp-cta reveal"><h2>See your own fingerprint</h2><p class="lede">Start as a guest in a minute. Nothing leaves your browser.</p>
    <a class="btn primary" href="${cta}">${label}</a></div></section>`
  heroDraw($('#fph'))
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }), { threshold: .15 }) : null
  document.querySelectorAll('.reveal').forEach(el => io ? io.observe(el) : el.classList.add('in'))
}

// ---------- sign in ----------
function welcome() {
  $('#nav').hidden = true; $('#subnav').hidden = true; $('#who').innerHTML = ''
  $('#view').innerHTML = `<section class="auth"><div class="card stack">
      ${db.cloudAvailable ? `<h2>Create your account</h2>
      <div><label for="email">Email</label><input type="email" id="email" autocomplete="email"></div>
      <div><label for="pw">Password <span class="opt">(8+ characters)</span></label><input type="password" id="pw" autocomplete="current-password"></div>
      <div class="row"><button class="primary" data-act="signup">Create account</button><button data-act="signin">Log in</button></div>
      <p class="status" id="authst"></p><hr>` : `<h2>Try it now</h2><p class="hint">Accounts are not configured on this deployment yet, so your data stays in this browser.</p>`}
      <button data-act="guest">Continue as guest</button>
      <p class="hint">Guest data stays in this browser only. Referee links need an account.</p>
    </div></section>`
}
async function enter() { S.started = true; await loadMe(); route() }
act('guest', async () => { db.useGuest(); await enter() })
for (const kind of ['signup', 'signin']) act(kind, async el => {
  const email = $('#email').value.trim(), pw = $('#pw').value
  if (!email || pw.length < 8) return status('#authst', 'Enter your email and a password of at least 8 characters.', true)
  el.disabled = true; status('#authst', spin + (kind === 'signup' ? 'Creating account…' : 'Logging in…'))
  try {
    if (kind === 'signup') { const r = await db.signUp(email, pw); if (!r.session) return status('#authst', 'Check your inbox to confirm your email, then log in.') }
    else await db.signIn(email, pw)
    await enter()
  } catch (e) { status('#authst', esc(e.message), true) } finally { el.disabled = false }
})
act('signout', async () => { await db.signOut(); S.started = false; location.hash = ''; route() })
act('copy', async el => { try { await navigator.clipboard.writeText(el.dataset.v); el.textContent = 'Copied' } catch { el.previousElementSibling?.select() } })

// ---------- Help, scroll, light/dark theme ----------
function setHelp(open) { const p = $('#helppanel'); if (!p) return; p.hidden = !open; $('#helpbtn').setAttribute('aria-expanded', open) }
act('help', () => setHelp($('#helppanel').hidden))
act('scroll', el => document.getElementById(el.dataset.to)?.scrollIntoView({ behavior: 'smooth' }))
act('theme', () => {
  const d = document.documentElement
  d.dataset.theme = d.dataset.theme === 'dark' ? 'light' : 'dark'
  try { localStorage.setItem('theme', d.dataset.theme) } catch {}
  render() // canvases do not change colour by themselves, so redraw the page
})
document.addEventListener('click', e => { if (!e.target.closest('.help')) setHelp(false) })
document.addEventListener('keydown', e => { if (e.key === 'Escape') setHelp(false) })

// ---------- referee page (no account) ----------
async function refereeView(token) {
  $('#nav').hidden = true; $('#subnav').hidden = true; $('#who').innerHTML = ''
  const v = $('#view')
  if (!db.sb) { v.innerHTML = `<div class="card"><h2>This link needs the online version</h2></div>`; return }
  v.innerHTML = `<p class="status">${spin}Loading…</p>`
  let r; try { r = await db.getRef(token) } catch { r = null }
  if (!r) { v.innerHTML = `<div class="card"><h2>This link is not valid</h2><p class="hint">Ask the person who sent it for a new one.</p></div>`; return }
  const who = esc(r.student_first_name || 'this student')
  if (r.status === 'answered') { v.innerHTML = `<div class="card"><h2>Thank you</h2><p class="lede">Your feedback about ${who} has been recorded.</p></div>`; return }
  v.innerHTML = `<div class="grid g2"><section class="card stack">
     <div class="eyebrow">Meet me through others</div>
     <h1>${who} asked for your feedback</h1>
     <p class="lede">Hi ${esc(r.referee_name)}. ${who} listed you as a ${esc(r.relationship.toLowerCase())}${r.experience_title ? ` on <b>${esc(r.experience_title)}</b>` : ''}, and asked about their <b>${esc(r.skill_label.toLowerCase())}</b>. Please answer with specific observations.</p>
     ${PROMPTS.map((p, i) => `<div><label for="rq${i}">${p}</label><textarea id="rq${i}" rows="3"></textarea></div>`).join('')}
     <label class="toggle"><input type="checkbox" id="rconsent"><span>I agree that my first name, relationship and answer are shown in ${who}'s Skill Fingerprint.</span></label>
     <div class="row"><button class="primary" data-act="refsubmit" data-token="${esc(token)}">Send feedback</button></div><p class="status" id="refst"></p>
   </section>
   <section class="card stack"><h3>How your answer is used</h3><p class="hint">It is labelled as contextual feedback and linked to the experience above. Employers see it next to the rest of ${who}'s evidence. You can only answer once.</p></section></div>`
}
act('refsubmit', async el => {
  const parts = PROMPTS.map((p, i) => [p, $('#rq' + i).value.trim()]).filter(([, a]) => a)
  const text = parts.map(([p, a]) => `${p} ${a}`).join(' ')
  if (text.length < 40) return status('#refst', 'Please answer at least one question with a real example.', true)
  if (!$('#rconsent').checked) return status('#refst', 'Please confirm consent to share your answer.', true)
  el.disabled = true
  try { const ok = await db.submitRef(el.dataset.token, text); if (!ok) return status('#refst', 'This request was already answered.', true); $('#view').innerHTML = `<div class="card"><h2>Thank you</h2><p class="lede">Your feedback has been recorded.</p></div>` }
  catch (e) { status('#refst', esc(e.message), true); el.disabled = false }
})

// ---------- events ----------
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-act]'); if (!t || !actions[t.dataset.act]) return
  if (t.tagName === 'A') e.preventDefault()
  try { await actions[t.dataset.act](t, e) } catch (err) { console.error(err); toast(err.message || String(err), true) }
})
document.addEventListener('change', async e => {
  const t = e.target.closest('[data-change]'); if (!t || !actions[t.dataset.change]) return
  try { await actions[t.dataset.change](t, e) } catch (err) { console.error(err); toast(err.message || String(err), true) }
})
document.addEventListener('input', e => { if (e.target.closest('[data-change="g-alloc"]')) actions['g-alloc']?.() })

// ---------- boot ----------
;(async () => {
  const session = await db.initAuth().catch(() => null)
  if (session) { S.started = true; await loadMe().catch(e => toast(e.message, true)) }
  route()
})()
