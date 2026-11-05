import taxonomy from '../data/taxonomy.json'
import aliases from '../data/aliases.json'
import roles from '../data/roles.json'
import * as store from './store.js'
const readCvFile = async f => (await import('./parse.js')).readCvFile(f)
import { matchText, extractExperiences, guessName, skillLevel, gapStatus } from './match.js'

// ---------- lookups ----------
const SKILLS = {}
for (const c of taxonomy.categories) for (const s of c.subcategories) for (const k of s.skills) SKILLS[k.id] = { ...k, cat: c.name, sub: s.name }
const ROLES = Object.fromEntries(roles.roles.map(r => [r.id, r]))
const SRC = { cv: 'From CV', self: 'Self-reported', peer: 'Peer feedback', practice: 'Practice', contribution: 'Contribution', assessed: 'Assessed' }
// Two questions per OaSIS cognitive ability; both right = level 3, one right = level 2
const COG = [
  { ab: 'A.01.a.04', q: 'What comes next: 2, 6, 12, 20, 30, …?', o: ['40', '42', '44'], a: 1 },
  { ab: 'A.01.a.04', q: 'Which number does not belong: 3, 5, 7, 9, 11, 13?', o: ['3', '9', '13'], a: 1 },
  { ab: 'A.01.a.03', q: 'Every analyst on the team uses SQL. Dana does not use SQL. Which must be true?', o: ['Dana is new', 'Dana is not an analyst on the team', 'Some analysts skip SQL'], a: 1 },
  { ab: 'A.01.a.03', q: 'If the report is late, the client complains. The client did not complain. So:', o: ['The report was late', 'The report was not late', 'We cannot tell'], a: 1 },
  { ab: 'A.01.b.02', q: 'A price rises 20%, then falls 20%. Compared with the start it is:', o: ['the same', '4% lower', '4% higher'], a: 1 },
  { ab: 'A.01.b.02', q: '4 people finish a task in 6 days. At the same pace, how long do 6 people take?', o: ['4 days', '5 days', '9 days'], a: 0 },
]
const REFERABLE = id => /^[FB]\./.test(id)
const STYLE = [['plan', 'I plan ahead', 'I improvise'], ['social', 'I recharge alone', 'I recharge with people'], ['detail', 'Big picture first', 'Details first'], ['pace', 'Steady pace', 'Bursts under deadline'], ['decide', 'Decide with data', 'Decide with intuition']]

// ---------- state ----------
let D = { profile: {}, cv: null, experiences: [], evidence: [], refs: [] }
let started = false
let pendingFile = null
let showAll = false
const open = new Set()

const $ = s => document.querySelector(s)
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const chip = src => `<span class="chip src-${src}">${SRC[src]}</span>`
const byskill = () => { const m = {}; D.evidence.forEach(e => (m[e.skill_id] = m[e.skill_id] || []).push(e)); return m }
const firstName = () => (D.profile.full_name || '').split(' ')[0]
function status(el, msg, err = false) { if (!el) return; el.className = 'status' + (err ? ' err' : ''); el.innerHTML = msg }
async function refresh() { D = await store.loadAll() }

// ---------- routing ----------
let lastHash = null
async function route() {
  const h = location.hash.slice(1)
  if (h !== lastHash) { // new page: back to the top, fade the view in
    lastHash = h; scrollTo({ top: 0, behavior: 'instant' })
    const v = $('#view'); v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter')
  }
  if (h.startsWith('ref/')) return refereeView(h.slice(4))
  if (h === '' || h === 'home') return home()
  if (!started) return welcome()
  $('#nav').hidden = false
  const v = h === 'register' ? 'register' : 'fingerprint'
  document.querySelectorAll('#nav a').forEach(a => a.getAttribute('href') === '#' + v ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'))
  if (v === 'fingerprint' && !D.cv && !D.evidence.length) { location.hash = '#register'; return }
  $('#view').innerHTML = v === 'register' ? registerHtml() : fingerprintHtml()
  if (v === 'register') bindRegister(); else drawFingerprint()
  renderWho()
}
window.addEventListener('hashchange', route)

async function renderWho() {
  const m = store.currentMode()
  $('#who').innerHTML = !started ? '' : m === 'cloud'
    ? `<span>${esc(await store.userEmail())}</span><button class="ghost" data-act="signout">Sign out</button>`
    : `<span class="pill">Guest · saved in this browser</span>${store.cloudAvailable ? '<button class="ghost" data-act="toauth">Create account</button>' : ''}`
}

// ---------- landing ----------
const JOURNEY = [
  ['1', 'Register', "Upload your CV. It is matched to Canada's OaSIS skills taxonomy, and people who worked with you add what they saw.", true],
  ['2', 'Develop', 'Answer real questions from companies and take short lessons. Your contributions grow your fingerprint.', false],
  ['3', 'Demonstrate', 'Job-relevant challenges that show how you solve problems, alone or in a group.', false],
  ['4', 'Connect', 'Employers compare anonymised, standardised profiles side by side. People decide, not an automated ranking.', false],
]
// Fixed made-up evidence so the hero drawing has colour before anyone signs in
function demoEvidence() {
  const m = {}; let i = 0
  for (const id in SKILLS) if (++i % 3) m[id] = [{ source: i % 11 === 0 ? 'peer' : i % 7 === 0 ? 'assessed' : 'cv', level: 1 + (i % 3) }]
  return m
}
function home() {
  $('#nav').hidden = !started
  document.querySelectorAll('#nav a').forEach(a => a.removeAttribute('aria-current'))
  $('#view').innerHTML = `<section class="lp-hero">
    <div><div class="eyebrow">Talent experience</div>
      <h1>There is more to you than a CV.</h1>
      <p class="lede">Upload your CV and Achievers maps it to Canada's official skills taxonomy. Every skill links to the sentence it came from. Then ask people you worked with to confirm what they saw.</p>
      <div class="row"><a class="btn primary" href="${started ? '#fingerprint' : '#start'}">${started ? 'Open my fingerprint' : 'Try it now'}</a><button data-act="scroll" data-to="how">How it works</button></div>
    </div>
    <canvas id="fph" width="560" height="560" aria-hidden="true"></canvas>
  </section>
  <section class="lp-sec" id="how"><div class="reveal"><div class="eyebrow">The journey</div><h2>From CV to interview in four steps</h2></div>
    <div class="lp-steps">${JOURNEY.map(([n, name, text, live], i) => `<div class="card lp-step reveal ${live ? 'live' : 'flat'}" style="--i:${i + 1}">
      <span class="n">${n}</span><h3>${name}</h3><p>${text}</p><span class="pill ${live ? 'ok' : ''}">${live ? 'Live now' : 'Next release'}</span></div>`).join('')}</div>
  </section>
  <section class="lp-sec"><div class="reveal"><div class="eyebrow">Why it is different</div><h2>Evidence you can check, not a score</h2></div>
    <div class="lp-points">
      <div class="reveal" style="--i:1"><h3>Every skill has a source</h3><p>Each skill links back to the sentence in your CV, or the person, it came from.</p></div>
      <div class="reveal" style="--i:2"><h3>Labels you can trust</h3><p>An employer can tell what you wrote yourself from what others confirmed.</p><div class="row">${['cv', 'self', 'peer', 'assessed'].map(chip).join('')}</div></div>
      <div class="reveal" style="--i:3"><h3>No overall score</h3><p>Your fingerprint is a multidimensional profile, never a single number or a hidden ranking.</p></div>
    </div>
  </section>
  <section class="lp-sec"><div class="card stack lp-cta reveal"><h2>See your own fingerprint</h2><p class="lede">Upload a CV and compare it with the skills a role asks for.</p>
    <a class="btn primary" href="${started ? '#fingerprint' : '#start'}">${started ? 'Open my fingerprint' : 'Try it now'}</a></div></section>`
  drawFingerprint($('#fph'), demoEvidence(), 'achievers')
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }), { threshold: .15 }) : null
  document.querySelectorAll('.reveal').forEach(el => io ? io.observe(el) : el.classList.add('in'))
  renderWho()
}

// ---------- sign in ----------
function welcome() {
  $('#nav').hidden = true; $('#who').innerHTML = ''
  $('#view').innerHTML = `<section class="auth"><div class="card stack">
      ${store.cloudAvailable ? `<h2 id="authtitle">Create your account</h2>
      <div><label for="email">Email</label><input type="email" id="email" autocomplete="email"></div>
      <div><label for="pw">Password <span class="opt">(8+ characters)</span></label><input type="password" id="pw" autocomplete="new-password"></div>
      <div class="row"><button class="primary" data-act="signup">Create account</button><button data-act="signin">Log in</button></div>
      <p class="status" id="authst"></p><hr style="border:0;border-top:1px solid var(--line);width:100%">` : `<h2>Try it now</h2><p class="hint">Accounts are not configured on this deployment yet, so your data stays in this browser.</p>`}
      <button data-act="guest">Continue as guest</button>
      <p class="hint">Guest data stays in this browser only. Referee links need an account.</p>
    </div></section>`
}
async function enter() { started = true; await refresh(); location.hash = D.cv || D.evidence.length ? '#fingerprint' : '#register'; route() }

// ---------- register ----------
function registerHtml() {
  const p = D.profile, st = p.work_style || {}, rz = p.reasoning || {}
  return `<div class="head"><div><div class="eyebrow">Step 1 · Register</div><h1>Build your Skill Fingerprint</h1>
    <p class="lede">Several sources of evidence, each keeping its label, so an employer can tell what you wrote yourself from what someone else confirmed.</p></div></div>
  <div class="grid g2">
   <div class="stack">
    <section class="card stack">
      <div class="row between"><h2>Your CV</h2><span class="pill">Required</span></div>
      <div class="drop" id="drop" tabindex="0" role="button" aria-label="Upload CV file"><strong>Drop your CV here or click to upload</strong><span class="hint">PDF, Word (.docx) or .txt${D.cv ? ` · current: ${esc(D.cv.file_name)}` : ''}</span><input type="file" id="file" accept=".pdf,.docx,.txt,.md" hidden></div>
      <div><label for="cv">CV text <span class="opt">(filled from your file, or paste it)</span></label><textarea id="cv" style="min-height:190px">${esc(D.cv?.text || '')}</textarea></div>
      <div><label for="linkedin">LinkedIn profile <span class="opt">(optional)</span></label><input type="text" id="linkedin" value="${esc(p.linkedin)}" placeholder="linkedin.com/in/your-name"></div>
    </section>
    <section class="card stack">
      <h2>Beyond the CV</h2>
      <div><label for="target">Target role</label><select id="target">${roles.roles.map(r => `<option value="${r.id}" ${p.target_role === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>
      <div><label for="notes">A moment that shows how you work</label><textarea id="notes" placeholder="What was the situation, what did you do, and what changed?">${esc(p.notes)}</textarea></div>
      <div><label for="projects">Projects, portfolio, volunteering <span class="opt">(optional, one per line)</span></label><textarea id="projects" style="min-height:80px">${esc(p.projects)}</textarea></div>
      <div class="row"><button class="primary" data-act="build">Build my Skill Fingerprint</button></div>
      <p class="status" id="buildst"></p>
    </section>
   </div>
   <div class="stack">
    <section class="card stack" id="refs">${refsHtml()}</section>
    <section class="card stack">
      <div class="row between"><h2>Work style</h2><span class="pill">Optional · self-reported</span></div>
      <p class="hint">Inspired by Big Five dimensions. It describes how you like to work and is never turned into a score.</p>
      ${STYLE.map(([k, a, b]) => `<div class="slider"><span>${a}</span><input type="range" min="1" max="5" value="${st[k] || 3}" data-style="${k}" aria-label="${a} or ${b}"><span>${b}</span></div>`).join('')}
    </section>
    <section class="card stack">
      <div class="row between"><h2>Reasoning check</h2><span class="pill">Optional · 6 questions</span></div>
      <p class="hint">Two short questions each for three OaSIS cognitive abilities: inductive reasoning, deductive reasoning and mathematical reasoning. Correct answers add assessed evidence.</p>
      ${COG.map((q, i) => `<div class="q"><div style="font-size:14px">${i + 1}. ${q.q}</div><div class="opts">${q.o.map((o, j) => `<label><input type="radio" name="cog${i}" value="${j}" ${rz['a' + i] === j ? 'checked' : ''}><span>${o}</span></label>`).join('')}</div></div>`).join('')}
      <div class="row"><button data-act="cog">Submit answers</button></div><p class="status" id="cogst">${rz.done ? `Done: ${rz.score}/${COG.length} correct` : ''}</p>
    </section>
   </div></div>`
}
function refLink(r) { return `${location.origin}${location.pathname}#ref/${r.token}` }
function refsHtml() {
  const guest = store.currentMode() === 'guest'
  return `<div class="row between"><h2>Meet me through others</h2>${chip('peer')}</div>
   <p class="hint">Ask someone you worked with one structured question about you. Specific stories carry more weight than a generic endorsement.</p>
   <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">
     <div><label for="rname">Their name</label><input type="text" id="rname" placeholder="e.g. Priya"></div>
     <div><label for="rrel">Relationship</label><select id="rrel"><option>Manager</option><option>Teammate</option><option>Professor</option><option>Club lead</option></select></div>
     <div><label for="rskill">Ask about</label><select id="rskill">${Object.values(SKILLS).filter(s => REFERABLE(s.id)).map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
   </div>
   <div class="row"><button data-act="addref">Create request</button></div><p class="status" id="refst"></p>
   ${D.refs.map(r => `<div class="card flat stack" style="padding:14px">
     <div class="row between"><b>${esc(r.referee_name)} · ${esc(r.relationship)}</b><span class="pill ${r.status === 'answered' ? 'ok' : ''}">${r.status === 'answered' ? 'Answered' : 'Waiting for answer'}</span></div>
     <p class="hint">"Describe a specific moment when you saw ${esc(r.student_first_name || 'them')} show <b>${esc(r.skill_label.toLowerCase())}</b>. What did they do, and what changed as a result?"</p>
     ${r.status === 'answered' ? `<p style="margin:0;font-size:14px">"${esc(r.response)}"</p>`
       : guest ? `<label for="ga-${r.id}" class="hint" style="font-weight:600">Guest demo: type their answer here</label><textarea id="ga-${r.id}" style="min-height:70px"></textarea><div class="row"><button data-act="guestans" data-id="${r.id}">Add answer</button></div>`
       : `<div class="linkbox"><input type="text" readonly value="${esc(refLink(r))}" aria-label="Link for ${esc(r.referee_name)}"><button data-act="copy" data-v="${esc(refLink(r))}">Copy link</button></div><p class="hint">Send this link to ${esc(r.referee_name)}. They answer without creating an account.</p>`}
   </div>`).join('')}`
}
function bindRegister() {
  const drop = $('#drop'), file = $('#file')
  drop.onclick = () => file.click()
  drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click() } }
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over') }
  drop.ondragleave = () => drop.classList.remove('over')
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]) }
  file.onchange = () => file.files[0] && loadFile(file.files[0])
  document.querySelectorAll('[data-style]').forEach(r => r.onchange = async () => {
    const ws = { ...(D.profile.work_style || {}), [r.dataset.style]: +r.value }
    D.profile.work_style = ws; await store.saveProfile({ work_style: ws })
  })
}
async function loadFile(f) {
  const st = $('#buildst')
  status(st, `<span class="spin"></span>Reading ${esc(f.name)}…`)
  try {
    const text = await readCvFile(f)
    if (text.length < 40) throw new Error('empty')
    pendingFile = f; $('#cv').value = text
    status(st, `Read ${text.length.toLocaleString()} characters from ${esc(f.name)}. Check the text, then build your fingerprint.`)
  } catch { status(st, 'Could not read text from this file. If it is a scanned PDF, paste the text into the box instead.', true) }
}
async function build(btn) {
  const st = $('#buildst'), cv = $('#cv').value.trim()
  if (cv.length < 40) return status(st, 'Add your CV first: upload a file or paste the text.', true)
  btn.disabled = true; status(st, '<span class="spin"></span>Matching your CV to the skills taxonomy…')
  try {
    const notes = $('#notes').value.trim(), projects = $('#projects').value.trim()
    const patch = { notes, projects, linkedin: $('#linkedin').value.trim(), target_role: $('#target').value }
    if (!D.profile.full_name) patch.full_name = guessName(cv)
    if (!D.cv || D.cv.text !== cv || pendingFile) await store.saveCv(pendingFile, cv)
    pendingFile = null
    await store.saveProfile(patch)
    const evidence = [...matchText(cv, 'cv', aliases), ...matchText(notes + '\n' + projects, 'self', aliases, 2)].filter(e => SKILLS[e.skill_id])
    const exps = extractExperiences(cv)
    if (notes) exps.push({ role: 'In my own words', org: '', period: '', contribution: notes.slice(0, 600), source: 'self' })
    await store.replaceCvEvidence(evidence, exps)
    await refresh(); location.hash = '#fingerprint'
  } catch (e) { status(st, 'Saving failed: ' + esc(e.message || e), true) } finally { btn.disabled = false }
}

// ---------- fingerprint ----------
function fingerprintHtml() {
  const p = D.profile, role = ROLES[p.target_role] || roles.roles[0], need = role.requires
  const ev = byskill()
  const lv = id => skillLevel(ev[id] || [])
  const reqIds = Object.keys(need).filter(id => SKILLS[id] && id.startsWith('F.'))
  const abilityIds = Object.keys(need).filter(id => SKILLS[id] && id.startsWith('A.'))
  const abilitiesTested = abilityIds.filter(id => lv(id) > 0).length
  const counts = { meets: 0, partial: 0, missing: 0 }
  reqIds.forEach(id => counts[gapStatus(lv(id), need[id])]++)
  const confirmed = D.evidence.filter(e => ['peer', 'assessed'].includes(e.source)).length
  const tree = taxonomy.categories.map(c => {
    const subs = c.subcategories.map(s => {
      const rows = s.skills.filter(k => showAll || lv(k.id) || (need[k.id] && !k.id.startsWith('A.')))
      if (!rows.length) return ''
      return `<li><div class="sub">${esc(s.name)}</div><ul>${rows.map(k => skillRow(k, lv(k.id), need[k.id], ev[k.id] || [], role.oasis[k.id])).join('')}</ul></li>`
    }).join('')
    return subs ? `<li><div class="cat">${esc(c.name)}</div><ul>${subs}</ul></li>` : ''
  }).join('')
  const gaps = reqIds.filter(id => gapStatus(lv(id), need[id]) !== 'meets').sort((a, b) => (need[b] - lv(b)) - (need[a] - lv(a))).slice(0, 4)
  return `<div class="head"><div><div class="eyebrow">Skill Fingerprint</div><h1>${esc(p.full_name || 'Your profile')}</h1>
    <p class="lede">Built from ${D.cv ? esc(D.cv.file_name) : 'your CV'}${D.refs.some(r => r.status === 'answered') ? ' and people you worked with' : ''}. Levels show how strong the evidence is, from 1 (mentioned) to 5 (confirmed several ways).</p></div>
    <div class="row"><label for="role2" style="margin:0">Compare with</label><select id="role2" style="width:auto">${roles.roles.map(r => `<option value="${r.id}" ${r.id === role.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select><a class="btn" href="#register">Edit sources</a></div></div>
  <div class="grid g-side">
   <div class="stack">
    <section class="card fp">
      <canvas id="fpc" width="560" height="560" aria-label="Fingerprint drawing generated from your evidence"></canvas>
      <div class="legend">${Object.keys(SRC).map(k => `<span class="chip src-${k}" style="opacity:${D.evidence.some(e => e.source === k) ? 1 : .35}">${SRC[k]}</span>`).join('')}</div>
      <div class="kv"><span>Skills with evidence</span><b class="mono">${Object.keys(ev).length}</b><span>Evidence items</span><b class="mono">${D.evidence.length}</b><span>Confirmed by others or tests</span><b class="mono">${confirmed}</b><span>Overall score</span><span>None, by design</span></div>
    </section>
    <section class="card stack">
      <h3>${esc(role.name)}: skills coverage</h3>
      <div class="cover" aria-hidden="true"><span style="width:${counts.meets / reqIds.length * 100}%;background:var(--ok)"></span><span style="width:${counts.partial / reqIds.length * 100}%;background:var(--part)"></span></div>
      <div class="kv"><span>At required level</span><b class="mono" style="color:var(--ok)">${counts.meets} of ${reqIds.length}</b><span>Some evidence</span><b class="mono" style="color:var(--part)">${counts.partial}</b><span>No evidence yet</span><b class="mono" style="color:var(--miss)">${counts.missing}</b></div>
      <p class="hint">Counts the ${reqIds.length} skills that OaSIS 2025 rates 3 or higher for NOC ${esc(role.noc)} (${esc(role.nocLabel)}). Entry-level target = OaSIS rating minus 1.</p>
      <p class="hint">Cognitive abilities: ${abilitiesTested} of ${abilityIds.length} rated abilities have test evidence. The rest are measured in challenges in the next release.</p>
    </section>
    ${gaps.length ? `<section class="card stack"><h3>Strengthen next</h3>${gaps.map(id => `<div class="gaprow"><span>${esc(SKILLS[id].name)} <span class="muted mono">${lv(id)}/${need[id]}</span></span>${REFERABLE(id) ? `<button class="ghost" data-act="askref" data-id="${id}">Ask a referee</button>` : ''}</div>`).join('')}
      <p class="hint">Practice tasks and challenges that add evidence arrive in the next release.</p></section>` : ''}
   </div>
   <div class="stack">
    <section class="card">
      <div class="row between" style="margin-bottom:6px"><h2>Skill tree</h2><label class="row hint" style="margin:0;font-weight:400"><input type="checkbox" id="showall" ${showAll ? 'checked' : ''}> Show full taxonomy</label></div>
      <p class="hint" style="margin-bottom:8px">Filled bars: your evidence level. Triangle: the level the role asks for. Click a skill to see where it came from.</p>
      <ul class="tree">${tree || '<li class="hint">No skills found yet.</li>'}</ul>
    </section>
    <section class="card stack"><h2>Experience</h2>
      ${D.experiences.length ? D.experiences.map(x => `<div class="exp"><div class="row between"><b>${esc(x.role)}${x.org ? ' · ' + esc(x.org) : ''}</b>${chip(x.source)}</div>${x.period ? `<span class="hint">${esc(x.period)}</span>` : ''}${x.contribution ? `<p>${esc(x.contribution)}</p>` : ''}</div>`).join('') : '<p class="hint">No dated experience found in the CV.</p>'}
    </section>
    ${D.profile.work_style ? `<section class="card stack"><div class="row between"><h3>Work style</h3>${chip('self')}</div>${STYLE.map(([k, a, b]) => `<div class="slider"><span>${a}</span><input type="range" min="1" max="5" value="${D.profile.work_style[k] || 3}" disabled aria-label="${a} or ${b}"><span>${b}</span></div>`).join('')}</section>` : ''}
   </div></div>`
}
function skillRow(k, have, need, items, rating) {
  const s = gapStatus(have, need)
  const label = s === 'missing' && k.id.startsWith('A.') ? 'Not tested' : { meets: 'Meets', partial: 'Partial', missing: 'Gap', extra: 'Extra', none: '' }[s]
  const dots = [1, 2, 3, 4, 5].map(i => `<i class="${i <= have ? 'f' : ''} ${i === need ? 't' : ''}"></i>`).join('')
  return `<li class="skill"><button class="name" data-act="toggle" data-id="${k.id}" aria-expanded="${open.has(k.id)}" title="${esc(k.description)}${rating ? ` · OaSIS rating for this role: ${rating}/5` : ''}">${esc(k.name)}</button>
   <span class="meter" role="img" aria-label="Evidence level ${have} of 5${need ? `, role needs ${need}` : ''}">${dots}</span><span class="st ${s}">${label}</span>
   ${open.has(k.id) ? `<div class="evlist">${items.length ? items.map(e => `<div class="ev">${chip(e.source)}<p><b>${esc(e.title)}</b> · ${esc(e.detail)} <span class="muted mono">L${e.level || 1}</span></p></div>`).join('') : `<p class="hint">No evidence yet. ${esc(k.description)}</p>`}</div>` : ''}</li>`
}
function drawFingerprint(c = $('#fpc'), ev = byskill(), name = D.profile.full_name) {
  if (!c) return
  const x = c.getContext('2d'), W = c.width, css = getComputedStyle(document.documentElement)
  const bands = taxonomy.categories.flatMap(cat => cat.subcategories).filter(s => s.skills.length).map(s => {
    const items = s.skills.flatMap(k => ev[k.id] || [])
    const lvl = s.skills.reduce((a, k) => a + skillLevel(ev[k.id] || []), 0) / (s.skills.length * 5)
    const bySrc = {}; items.forEach(e => bySrc[e.source] = (bySrc[e.source] || 0) + 1)
    const top = Object.keys(bySrc).sort((a, b) => ['peer', 'assessed'].includes(b) - ['peer', 'assessed'].includes(a) || bySrc[b] - bySrc[a])[0]
    return { p: lvl, col: css.getPropertyValue(top ? '--s-' + top : '--line').trim() }
  })
  let seed = [...(name || 'achievers')].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 7)
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
  x.clearRect(0, 0, W, W)
  const cx = W / 2, cy = W * .53, rings = 27
  for (let i = 0; i < rings; i++) {
    const b = bands[Math.floor(i / rings * bands.length)], base = 9 + i * 9.4
    x.strokeStyle = b.col; x.globalAlpha = b.p > 0 ? .95 : .5; x.lineWidth = b.p > 0 ? 2 + b.p * 9 : 1.3; x.lineCap = 'round'
    const gapAt = rnd() * 6.28, gapLen = .12 + rnd() * .35
    x.beginPath(); let pen = false
    for (let t = 0; t <= 6.29; t += .02) {
      if (i > 3 && Math.abs((t - gapAt + 6.28) % 6.28) < gapLen) { pen = false; continue }
      const r = base * (1 + .07 * Math.sin(2 * t + i * .2) + .05 * b.p * Math.cos(3 * t + i * .3) + .03 * Math.sin(5 * t + i))
      const px = cx + r * Math.cos(t), py = cy + r * Math.sin(t) * (t > 3.3 && t < 6.1 ? 1.12 : .92)
      if (!pen) { x.moveTo(px, py); pen = true } else x.lineTo(px, py)
    }
    x.stroke()
  }
  x.globalAlpha = 1
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { drawFingerprint(); drawFingerprint($('#fph'), demoEvidence(), 'achievers') })

// ---------- referee page (public, no account) ----------
async function refereeView(token) {
  $('#nav').hidden = true; $('#who').innerHTML = ''
  const v = $('#view')
  if (!store.sb) { v.innerHTML = `<div class="card"><h2>This link needs the online version</h2><p class="hint">Referee links work on the deployed site with accounts enabled.</p></div>`; return }
  v.innerHTML = `<p class="status"><span class="spin"></span>Loading…</p>`
  let r
  try { r = await store.getRef(token) } catch { r = null }
  if (!r) { v.innerHTML = `<div class="card"><h2>This link is not valid</h2><p class="hint">Ask the person who sent it for a new one.</p></div>`; return }
  const who = esc(r.student_first_name || 'this student')
  if (r.status === 'answered') { v.innerHTML = `<div class="card"><h2>Thank you</h2><p class="lede">Your answer about ${who} has been recorded.</p></div>`; return }
  v.innerHTML = `<div class="grid g2"><section class="card stack">
     <div class="eyebrow">Meet me through others</div>
     <h1>${who} asked you for a short reference</h1>
     <p class="lede">Hi ${esc(r.referee_name)}. ${who} listed you as their ${esc(r.relationship.toLowerCase())}. Please answer one question with a real example. It takes about three minutes.</p>
     <div><label for="refans">Describe a specific moment when you saw ${who} show <b>${esc(r.skill_label.toLowerCase())}</b>. What did they do, and what changed as a result?</label>
     <textarea id="refans" style="min-height:160px"></textarea></div>
     <div class="row"><button class="primary" data-act="refsubmit" data-token="${esc(token)}">Send answer</button></div><p class="status" id="refst2"></p>
   </section>
   <section class="card stack"><h3>How your answer is used</h3>
     <p class="hint">It appears in ${who}'s Skill Fingerprint labelled as peer feedback, with your first name and relationship. Employers see it next to the rest of their evidence. You can only answer once.</p></section></div>`
}

// ---------- events ----------
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-act]'); if (!t) return
  const a = t.dataset.act
  try {
    if (a === 'scroll') return document.getElementById(t.dataset.to)?.scrollIntoView({ behavior: 'smooth' })
    if (a === 'guest') { store.useGuest(); return enter() }
    if (a === 'signup' || a === 'signin') {
      const email = $('#email').value.trim(), pw = $('#pw').value, st = $('#authst')
      if (!email || pw.length < 8) return status(st, 'Enter your email and a password of at least 8 characters.', true)
      t.disabled = true; status(st, '<span class="spin"></span>' + (a === 'signup' ? 'Creating account…' : 'Logging in…'))
      try {
        if (a === 'signup') { const r = await store.signUp(email, pw); if (!r.session) { status(st, 'Check your inbox to confirm your email, then log in.'); return } }
        else await store.signIn(email, pw)
        return enter()
      } catch (err) { status(st, esc(err.message), true) } finally { t.disabled = false }
      return
    }
    if (a === 'toauth' || a === 'signout') { await store.signOut(); started = false; location.hash = ''; return route() }
    if (a === 'build') return build(t)
    if (a === 'addref') {
      const name = $('#rname').value.trim(), st = $('#refst')
      if (!name) { $('#rname').focus(); return status(st, 'Add their name first.', true) }
      const sk = SKILLS[$('#rskill').value]
      await store.createRef({ referee_name: name, relationship: $('#rrel').value, skill_id: sk.id, skill_label: sk.name, student_first_name: firstName() })
      await refresh(); $('#refs').innerHTML = refsHtml(); return
    }
    if (a === 'guestans') {
      const v = $('#ga-' + t.dataset.id).value.trim(); if (v.length < 20) return
      await store.answerGuestRef(t.dataset.id, v); await refresh(); $('#refs').innerHTML = refsHtml(); return
    }
    if (a === 'copy') { try { await navigator.clipboard.writeText(t.dataset.v); t.textContent = 'Copied' } catch { t.previousElementSibling.select() } return }
    if (a === 'askref') { location.hash = '#register'; setTimeout(() => { const s = $('#rskill'); if (s) { s.value = t.dataset.id; $('#refs').scrollIntoView({ behavior: 'smooth' }); $('#rname').focus() } }, 50); return }
    if (a === 'toggle') { const id = t.dataset.id; open.has(id) ? open.delete(id) : open.add(id); $('#view').innerHTML = fingerprintHtml(); drawFingerprint(); return }
    if (a === 'cog') {
      let score = 0; const r = {}
      COG.forEach((q, i) => { const v = document.querySelector(`input[name=cog${i}]:checked`); r['a' + i] = v ? +v.value : null; if (v && +v.value === q.a) score++ })
      r.done = true; r.score = score
      await store.saveProfile({ reasoning: r }); D.profile.reasoning = r
      for (const ab of [...new Set(COG.map(q => q.ab))]) {
        const items = COG.map((q, i) => [q, i]).filter(([q]) => q.ab === ab)
        const right = items.filter(([q, i]) => r['a' + i] === q.a).length
        await store.setEvidence({ source: 'assessed', title: 'Reasoning check · ' + SKILLS[ab].name, skill_id: right ? ab : null, detail: `Answered ${right} of ${items.length} ${SKILLS[ab].name.toLowerCase()} questions correctly.`, level: right === items.length ? 3 : 2 })
      }
      await refresh(); status($('#cogst'), `Done: ${score}/${COG.length} correct · added to your fingerprint`); return
    }
    if (a === 'refsubmit') {
      const v = $('#refans').value.trim(), st = $('#refst2')
      if (v.length < 20) return status(st, 'Please write at least a couple of sentences with a real example.', true)
      t.disabled = true
      const ok = await store.submitRef(t.dataset.token, v)
      if (!ok) return status(st, 'This request was already answered.', true)
      $('#view').innerHTML = `<div class="card"><h2>Thank you</h2><p class="lede">Your answer has been recorded.</p></div>`; return
    }
  } catch (err) { console.error(err); alert(err.message || String(err)) }
})
document.addEventListener('change', async e => {
  if (e.target.id === 'role2') { await store.saveProfile({ target_role: e.target.value }); D.profile.target_role = e.target.value; route() }
  if (e.target.id === 'showall') { showAll = e.target.checked; $('#view').innerHTML = fingerprintHtml(); drawFingerprint() }
})

// ---------- boot ----------
;(async () => {
  const session = await store.initAuth().catch(() => null)
  if (session) { started = true; await refresh() }
  route()
})()