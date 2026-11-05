// PART 1 — Register / Discover, plus My Profile and My Activities
import taxonomy from '../data/taxonomy.json'
import aliases from '../data/aliases.json'
import roles from '../data/roles.json'
import * as db from './db.js'
import { S, loadMe, firstName } from './state.js'
import { $, $$, esc, val, act, go, render, toast, status, spin, chip, head, SKILLS, SRC, srcKey, skillName, compName, fmtDate, demoTag } from './ui.js'
import { matchText, levelFor, skillLevel, gapStatus } from './match.js'
import { extractCv } from './cv.js'
import { COMPETENCIES, COMP, MAYA, BIG5, LIKERT, REASONING, COURSES, DEMO_JOBS, DEMO_TOPICS } from './demo.js'

const readCvFile = async f => (await import('./parse.js')).readCvFile(f)
const ROLES = Object.fromEntries(roles.roles.map(r => [r.id, r]))
const STEPS = ['Personal information', 'Qualifications', 'Experiences', 'Initial assessments', 'Skill Fingerprint']
const KINDS = [['project', 'Academic project'], ['case', 'Case competition'], ['volunteering', 'Volunteering'], ['organization', 'Student organization'], ['entrepreneurial', 'Entrepreneurial project'], ['initiative', 'Personal initiative'], ['internship', 'Internship'], ['research', 'Research'], ['portfolio', 'Portfolio work'], ['other', 'Other']]
const KIND = Object.fromEntries(KINDS)
const INTRO = [['motivation', 'What motivates you professionally?'], ['problems', 'What kind of problems do you enjoy solving?'], ['fields', 'Which professional fields interest you?'], ['shaped', 'What experiences have shaped you most?'], ['beyond', 'What would you like employers to understand about you beyond your CV?']]

let draft = null          // CV extraction waiting for review
let draftFile = null
let editingExp = null      // experience id being edited
let assessOpen = null      // 'big5' | 'reasoning'
let showAll = false
const openSkills = new Set()

const byskill = ev => { const m = {}; ev.forEach(e => (m[e.skill_id] = m[e.skill_id] || []).push(e)); return m }
const lvOf = (ev, id) => skillLevel(ev[id] || [])

// ======================================================================
// ONBOARDING
// ======================================================================
export function onboard() {
  const step = Math.min(S.profile.onboarding || 0, 4)
  const saved = sessionStorage.getItem('ob-step')
  const s = Math.min(saved === null ? step : Number(saved), step, 3)
  const body = [stepPersonal, stepQualifications, stepExperiences, stepAssessments][s]?.() ?? ''
  return `${head('Stage 1 · Register', 'Build your Skill Fingerprint', 'Five short steps. Your progress is saved, so you can stop and come back.', `<button data-act="maya-ask">Load Maya's example</button>`)}
  <div id="maya-confirm"></div>
  <ol class="progress">${STEPS.map((n, i) => `<li class="${i < step ? 'done' : ''} ${i === s ? 'cur' : ''}"><button data-act="ob-step" data-i="${i}" ${i > step ? 'disabled' : ''}><b>${i + 1}</b>${n}</button></li>`).join('')}</ol>
  ${body}`
}
act('ob-step', el => { const i = +el.dataset.i; if (i === 4) return go('#discover'); sessionStorage.setItem('ob-step', i); render() })
async function advance(to) {
  if ((S.profile.onboarding || 0) < to) { await db.saveProfile({ onboarding: to }); S.profile.onboarding = to }
  if (to >= 4) { sessionStorage.removeItem('ob-step'); toast('Skill Fingerprint updated'); return go('#discover') }
  sessionStorage.setItem('ob-step', to); render(); window.scrollTo(0, 0)
}

// ---------- step 1: personal ----------
function personalForm(p) {
  const f = (id, label, v, opt = false, type = 'text') => `<div><label for="${id}">${label}${opt ? ' <span class="opt">(optional)</span>' : ''}</label><input type="${type}" id="${id}" value="${esc(v ?? '')}"></div>`
  return `<div class="grid g-form">
    ${f('pf-name', 'Full name', p.full_name)}
    ${f('pf-uni', 'University or institution', p.university)}
    ${f('pf-field', 'Field of study', p.field_of_study)}
    ${f('pf-grad', 'Graduation year (expected or actual)', p.grad_year, false, 'number')}
    ${f('pf-loc', 'Current location', p.location, true)}
    ${f('pf-int', 'Professional interests', p.interests, true)}
    ${f('pf-ind', 'Target industries', p.target_industries, true)}
    <div><label for="pf-role">Target role</label><select id="pf-role">${roles.roles.map(r => `<option value="${r.id}" ${p.target_role === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>
  </div>`
}
function readPersonal() {
  return { full_name: val('pf-name'), university: val('pf-uni'), field_of_study: val('pf-field'), grad_year: Number(val('pf-grad')) || null, location: val('pf-loc'), interests: val('pf-int'), target_industries: val('pf-ind'), target_role: val('pf-role'), target_roles: ROLES[val('pf-role')]?.name || '' }
}
function stepPersonal() {
  const p = S.profile, intro = p.intro || {}
  return `<div class="grid g2">
   <section class="card stack"><h2>Personal information</h2>${personalForm(p)}</section>
   <section class="card stack"><div class="row between"><h2>Tell us about yourself</h2><span class="pill">Optional</span></div>
     <p class="hint">Your own words are kept as you write them. Nothing here is rewritten by AI.</p>
     ${INTRO.map(([k, q]) => `<div><label for="in-${k}">${q}</label><textarea id="in-${k}" rows="2">${esc(intro[k])}</textarea></div>`).join('')}
   </section></div>
   <div class="row footer-row"><button class="primary" data-act="save-personal">Save and continue</button><p class="status" id="pst"></p></div>`
}
act('save-personal', async () => {
  const p = readPersonal()
  if (!p.full_name || !p.university || !p.field_of_study || !p.grad_year) return status('#pst', 'Fill in name, institution, field of study and graduation year.', true)
  p.intro = Object.fromEntries(INTRO.map(([k]) => [k, val('in-' + k)]))
  await db.saveProfile(p); Object.assign(S.profile, p); toast('Personal information saved')
  advance(1)
})

// ---------- step 2: qualifications (CV) ----------
function stepQualifications() {
  const imported = S.experiences.filter(e => e.source === 'imported' || e.source === 'cv')
  return `<div class="grid g2">
   <section class="card stack">
     <div class="row between"><h2>Upload your CV</h2><span class="pill">Required</span></div>
     <div class="drop" id="drop" tabindex="0" role="button" aria-label="Upload CV"><strong>Drop your CV here or click to upload</strong><span class="hint">PDF or Word (.docx). Text is read in your browser.</span><input type="file" id="file" accept=".pdf,.docx,.txt" hidden></div>
     <details><summary>No file? Paste the text instead</summary><textarea id="cvtext" rows="8" placeholder="Paste your CV text">${esc(S.cv?.text || '')}</textarea><button data-act="cv-paste">Extract from text</button></details>
     <p class="status" id="cvst">${S.cv ? `Current CV: ${esc(S.cv.file_name)}` : ''}</p>
     <div><label for="li">LinkedIn profile URL <span class="opt">(optional)</span></label><input type="text" id="li" value="${esc(S.profile.linkedin)}" placeholder="linkedin.com/in/your-name">
     <p class="hint">Saved as a link on your profile. This prototype does not import data from LinkedIn.</p></div>
   </section>
   <section class="card stack">
     ${draft ? draftForm() : imported.length ? `<h2>Saved qualifications</h2><p class="hint">These came from your CV and stay labelled as imported, not verified. Upload again to replace them.</p>${imported.map(qualItem).join('')}` : `<h2>Review what we found</h2><p class="hint">After upload, the extracted education, experience, certifications and skills appear here as editable fields. Nothing is saved until you confirm.</p>`}
   </section></div>
   <div class="row footer-row"><button class="primary" data-act="qual-next" ${imported.length && !draft ? '' : 'disabled'}>Continue</button><span class="hint">${draft ? 'Confirm the extracted fields first.' : imported.length ? '' : 'Upload and confirm your CV to continue.'}</span></div>`
}
const qualItem = x => `<div class="exp"><div class="row between"><b>${esc(x.title || x.role)}${x.org ? ' · ' + esc(x.org) : ''}</b>${chip('imported')}</div><span class="hint">${esc(KIND[x.kind] || x.kind)}${x.period ? ' · ' + esc(x.period) : ''}</span>${x.contribution ? `<p>${esc(x.contribution)}</p>` : ''}</div>`

function rowsEditor(key, rows, cols) {
  return `<div class="ed" data-key="${key}">${rows.map((r, i) => `<div class="edrow" data-i="${i}">${cols.map(([c, ph, wide]) => wide ? `<textarea data-c="${c}" rows="2" placeholder="${ph}" aria-label="${ph}">${esc(r[c])}</textarea>` : `<input type="text" data-c="${c}" value="${esc(r[c])}" placeholder="${ph}" aria-label="${ph}">`).join('')}<button class="ghost" data-act="draft-del" data-key="${key}" data-i="${i}" aria-label="Remove row">Remove</button></div>`).join('')}
   <button class="ghost" data-act="draft-add" data-key="${key}">+ Add</button></div>`
}
const DRAFT_COLS = {
  education: [['degree', 'Degree and major'], ['school', 'Institution'], ['years', 'Years']],
  work: [['role', 'Role'], ['org', 'Organisation'], ['period', 'Dates'], ['description', 'What you did', true]],
  certifications: [['name', 'Certification'], ['year', 'Year']],
  extracurricular: [['text', 'Activity']],
  projects: [['text', 'Project']],
}
function draftForm() {
  return `<div class="row between"><h2>Review what we found</h2><span class="pill">Not saved yet</span></div>
   <p class="hint">Correct anything that is wrong. Imported information is labelled as imported, not as verified fact.</p>
   <h3>Education</h3>${rowsEditor('education', draft.education, DRAFT_COLS.education)}
   <h3>Work experience and internships</h3>${rowsEditor('work', draft.work, DRAFT_COLS.work)}
   <h3>Certifications</h3>${rowsEditor('certifications', draft.certifications, DRAFT_COLS.certifications)}
   <h3>Projects mentioned</h3>${rowsEditor('projects', draft.projects, DRAFT_COLS.projects)}
   <h3>Extracurricular activities</h3>${rowsEditor('extracurricular', draft.extracurricular, DRAFT_COLS.extracurricular)}
   <div><label for="d-skills">Listed skills <span class="opt">(comma separated)</span></label><input type="text" id="d-skills" value="${esc(draft.skills.join(', '))}"></div>
   <div class="row"><button class="primary" data-act="draft-save">Confirm and save to my profile</button><button class="ghost" data-act="draft-cancel">Discard</button></div><p class="status" id="dst"></p>`
}
function readDraft() {
  for (const key of Object.keys(DRAFT_COLS)) {
    const box = document.querySelector(`.ed[data-key="${key}"]`); if (!box) continue
    draft[key] = [...box.querySelectorAll('.edrow')].map(row => Object.fromEntries([...row.querySelectorAll('[data-c]')].map(i => [i.dataset.c, i.value.trim()])))
  }
  const sk = document.getElementById('d-skills'); if (sk) draft.skills = sk.value.split(',').map(s => s.trim()).filter(Boolean)
}
function setDraft(text) {
  const x = extractCv(text)
  draft = { text, ...x, projects: x.projects.map(t => ({ text: t })), extracurricular: x.extracurricular.map(t => ({ text: t })) }
  if (!S.profile.full_name && x.name) S.profile.full_name = x.name
}
export function bindOnboard() {
  const drop = $('#drop'), file = $('#file'); if (!drop) return
  drop.onclick = () => file.click()
  drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click() } }
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over') }
  drop.ondragleave = () => drop.classList.remove('over')
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); e.dataTransfer.files[0] && loadFile(e.dataTransfer.files[0]) }
  file.onchange = () => file.files[0] && loadFile(file.files[0])
}
async function loadFile(f) {
  status('#cvst', `${spin}Reading ${esc(f.name)}…`)
  try {
    const text = await readCvFile(f)
    if (text.length < 40) throw new Error('empty')
    draftFile = f; setDraft(text); render(); toast('CV uploaded. Review the extracted fields.')
  } catch { status('#cvst', 'Could not read text from this file. If it is a scanned PDF, paste the text instead.', true) }
}
act('cv-paste', () => { const t = val('cvtext'); if (t.length < 40) return status('#cvst', 'Paste at least a few lines of your CV.', true); draftFile = null; setDraft(t); render() })
act('draft-add', el => { readDraft(); const k = el.dataset.key; draft[k].push(Object.fromEntries(DRAFT_COLS[k].map(([c]) => [c, '']))); render() })
act('draft-del', el => { readDraft(); draft[el.dataset.key].splice(+el.dataset.i, 1); render() })
act('draft-cancel', () => { draft = null; render() })
act('draft-save', async el => {
  readDraft(); el.disabled = true; status('#dst', spin + 'Saving…')
  try {
    const uid = db.me()
    const path = await db.uploadCv(draftFile)
    await db.insert('cv_documents', { user_id: uid, file_name: draftFile?.name || 'pasted text', file_path: path, text: draft.text })
    await db.saveProfile({ linkedin: val('li'), full_name: S.profile.full_name || '' })
    for (const x of S.experiences.filter(e => e.source === 'imported' || e.source === 'cv')) await db.remove('experiences', x.id)
    const exps = [
      ...draft.education.filter(e => e.degree).map(e => ({ kind: 'education', title: e.degree, role: e.degree, org: e.school, period: e.years })),
      ...draft.work.filter(w => w.role).map(w => ({ kind: w.kind || (/intern/i.test(w.role) ? 'internship' : 'work'), title: w.role, role: w.role, org: w.org, period: w.period, contribution: w.description })),
      ...draft.certifications.filter(c => c.name).map(c => ({ kind: 'certification', title: c.name, role: c.name, period: c.year })),
      ...draft.projects.filter(p => p.text).map(p => ({ kind: 'project', title: p.text, role: p.text })),
      ...draft.extracurricular.filter(p => p.text).map(p => ({ kind: 'extracurricular', title: p.text, role: p.text })),
    ].map(e => ({ org: '', period: '', contribution: '', ...e, user_id: uid, source: 'imported' }))
    await db.insertMany('experiences', exps)
    // evidence from the confirmed text only
    const confirmed = [...exps.map(e => [e.title, e.org, e.contribution].join('. ')), draft.skills.join(', ')].join('\n')
    await db.removeWhere('evidence', { user_id: uid, source: 'imported' })
    await db.removeWhere('evidence', { user_id: uid, source: 'cv' })
    await db.insertMany('evidence', matchText(confirmed, 'imported', aliases).filter(e => SKILLS[e.skill_id]).map(e => ({ ...e, user_id: uid })))
    draft = null; draftFile = null
    await loadMe(); toast('Qualifications saved to your profile'); render()
  } catch (e) { status('#dst', 'Saving failed: ' + esc(e.message || e), true); el.disabled = false }
})
act('qual-next', () => advance(2))

// ---------- step 3: experiences ----------
function expForm(x = {}) {
  const sk = new Set(x.skills || [])
  return `<div class="grid g-form">
     <div><label for="ex-kind">Type</label><select id="ex-kind">${KINDS.map(([k, n]) => `<option value="${k}" ${x.kind === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
     <div><label for="ex-title">Project title</label><input type="text" id="ex-title" value="${esc(x.title)}" placeholder="e.g. Community Garden Initiative"></div>
     <div><label for="ex-role">Your role</label><input type="text" id="ex-role" value="${esc(x.role)}" placeholder="e.g. Volunteer Coordinator"></div>
     <div><label for="ex-period">When <span class="opt">(optional)</span></label><input type="text" id="ex-period" value="${esc(x.period)}" placeholder="e.g. 2023 – 2025"></div>
   </div>
   <div><label for="ex-sit">The situation: what was the project or challenge?</label><textarea id="ex-sit" rows="2">${esc(x.situation)}</textarea></div>
   <div><label for="ex-con">Your contribution: what did you personally do?</label><textarea id="ex-con" rows="3">${esc(x.contribution)}</textarea></div>
   <div><label for="ex-cha">The challenge: what difficulties did you face?</label><textarea id="ex-cha" rows="2">${esc(x.challenge)}</textarea></div>
   <div><label for="ex-out">The outcome: what happened as a result?</label><textarea id="ex-out" rows="2">${esc(x.outcome)}</textarea></div>
   <fieldset><legend>Skills demonstrated</legend><div class="checks">${COMPETENCIES.map(c => `<label><input type="checkbox" name="ex-sk" value="${c.k}" ${sk.has(c.k) ? 'checked' : ''}><span>${c.n}</span></label>`).join('')}</div></fieldset>
   <div><label for="ex-url">Supporting evidence link <span class="opt">(optional: slides, report, certificate, screenshot)</span></label><input type="text" id="ex-url" value="${esc(x.evidence_url)}" placeholder="https://"></div>`
}
function expCard(x, actions = true) {
  const fb = S.evidence.filter(e => e.source === 'peer' && e.experience_id === x.id)
  return `<article class="card exp-card stack">
    <div class="row between"><div><span class="eyebrow">${esc(KIND[x.kind] || x.kind)}</span><h3>${esc(x.title || x.role)}</h3><span class="hint">${esc(x.role)}${x.period ? ' · ' + esc(x.period) : ''}</span></div>${chip(x.source)}</div>
    <dl class="star">${[['Situation', x.situation], ['My contribution', x.contribution], ['Challenge', x.challenge], ['Outcome', x.outcome]].filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    ${(x.skills || []).length ? `<div class="row">${x.skills.map(k => `<span class="pill">${esc(compName(k))}</span>`).join('')}</div>` : ''}
    ${x.evidence_url ? `<a href="${esc(x.evidence_url)}" target="_blank" rel="noopener">Supporting evidence ↗</a>` : ''}
    ${fb.map(f => `<div class="ev">${chip('peer')}<p><b>${esc(f.title)}</b> · ${esc(f.detail)}</p></div>`).join('')}
    ${actions ? `<div class="row"><button class="ghost" data-act="exp-edit" data-id="${x.id}">Edit</button><button class="ghost" data-act="exp-del" data-id="${x.id}">Remove</button><a class="ghost-link" href="#develop/feedback?exp=${x.id}">Request feedback</a></div>` : ''}
  </article>`
}
function stepExperiences() {
  const mine = S.experiences.filter(e => e.source === 'self')
  const editing = editingExp && mine.find(e => e.id === editingExp)
  return `<div class="grid g2">
   <section class="card stack"><div class="row between"><h2>${editing ? 'Edit experience' : 'Showcase an experience'}</h2><span class="pill">Optional</span></div>
     <p class="hint">Projects, case competitions, volunteering, clubs, ventures, research. Tell the story your CV cannot.</p>
     ${expForm(editing || {})}
     <div class="row"><button class="primary" data-act="exp-save">${editing ? 'Save changes' : 'Add experience'}</button>${editing ? '<button class="ghost" data-act="exp-cancel">Cancel</button>' : ''}</div><p class="status" id="exst"></p>
   </section>
   <section class="stack">${mine.length ? mine.map(x => expCard(x)).join('') : '<div class="card flat"><p class="hint">Your experiences will appear here. They stay labelled as self-reported until someone corroborates them or you are assessed.</p></div>'}</section></div>
   <div class="row footer-row"><button class="primary" data-act="exp-next">Continue to assessments</button></div>`
}
export async function saveExperience(x, id = null) {
  const uid = db.me()
  const row = { ...x, user_id: uid, source: 'self' }
  let exp
  if (id) { await db.update('experiences', id, row); exp = { id, ...row } } else exp = await db.insert('experiences', row)
  await db.removeWhere('evidence', { user_id: uid, experience_id: exp.id, source: 'self' })
  const text = [x.contribution, x.outcome].join(' ')
  await db.insertMany('evidence', (x.skills || []).map(k => ({ user_id: uid, skill_id: COMP[k].o, source: 'self', title: x.title, detail: (x.contribution || x.situation || '').slice(0, 280), level: levelFor(text, 'self'), experience_id: exp.id })))
  return exp
}
act('exp-save', async el => {
  const x = { kind: val('ex-kind'), title: val('ex-title'), role: val('ex-role'), org: '', period: val('ex-period'), situation: val('ex-sit'), contribution: val('ex-con'), challenge: val('ex-cha'), outcome: val('ex-out'), evidence_url: val('ex-url'), skills: $$('input[name=ex-sk]:checked').map(i => i.value) }
  if (!x.title || !x.contribution) return status('#exst', 'Add at least a title and your contribution.', true)
  if (x.evidence_url && !/^https?:\/\//.test(x.evidence_url)) return status('#exst', 'Evidence links must start with https://', true)
  el.disabled = true
  try { await saveExperience(x, editingExp); editingExp = null; await loadMe(); toast('Experience saved'); render() }
  catch (e) { status('#exst', 'Saving failed: ' + esc(e.message), true); el.disabled = false }
})
act('exp-edit', el => { editingExp = el.dataset.id; if (location.hash.startsWith('#onboard')) render(); else { sessionStorage.setItem('ob-step', 2); go('#onboard') } })
act('exp-cancel', () => { editingExp = null; render() })
act('exp-del', async el => {
  if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = 'Click again to remove'; return }
  await db.removeWhere('evidence', { user_id: db.me(), experience_id: el.dataset.id })
  await db.remove('experiences', el.dataset.id); await loadMe(); toast('Experience removed'); render()
})
act('exp-next', () => advance(3))

// ---------- step 4: initial assessments ----------
function big5Scores(ans) {
  return Object.fromEntries(BIG5.map(d => {
    const v = d.items.map(([id, , rev]) => { const a = Number(ans[id]); return rev ? 6 - a : a })
    return [d.id, v.reduce((a, b) => a + b, 0) / v.length]
  }))
}
const band = v => v < 2.5 ? 'low' : v > 3.5 ? 'high' : 'mid'
function big5Result(scores) {
  return `<div class="stack">${BIG5.map(d => `<div class="dim5"><div class="row between"><b>${d.name}</b><span class="mono hint">${scores[d.id].toFixed(1)} / 5</span></div>
    <div class="scale" aria-hidden="true"><span style="left:calc(${(scores[d.id] - 1) / 4 * 100}% - 6px)"></span></div>
    <p class="hint">${d.about}</p><p style="margin:0">${d[band(scores[d.id])]}</p></div>`).join('')}
    <p class="hint">No dimension is good or bad, and this result never ranks you against other candidates. It is visible only to you.</p></div>`
}
function reasoningResult(ans) {
  const doms = [...new Set(REASONING.map(q => q.domain))]
  return `<div class="stack">${doms.map(d => { const qs = REASONING.map((q, i) => [q, i]).filter(([q]) => q.domain === d); const r = qs.filter(([q, i]) => ans[i] === q.a).length
    return `<div class="row between"><span>${d}</span><span class="mono">${r} / ${qs.length}</span></div>` }).join('')}
    <p class="hint">Each domain is reported separately. There is no overall IQ or employability score. These example questions are not a validated psychometric test.</p></div>`
}
function stepAssessments() {
  const pers = S.personality, rz = S.profile.reasoning
  return `<div class="grid g2">
   <section class="card stack"><div class="row between"><h2>A. Personality questionnaire</h2><span class="pill">Illustrative</span></div>
     <p class="hint">Ten statements based on the Big Five dimensions. This is a demonstration questionnaire, not a validated instrument; production will use a licensed, validated one.</p>
     ${assessOpen === 'big5' ? `${BIG5.flatMap(d => d.items).map(([id, text]) => `<fieldset class="q"><legend>${text}</legend><div class="opts likert">${LIKERT.map((l, j) => `<label><input type="radio" name="b5-${id}" value="${j + 1}" ${pers?.answers?.[id] === j + 1 ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>`).join('')}
       <div class="row"><button class="primary" data-act="b5-submit">Submit answers</button><button class="ghost" data-act="assess-close">Cancel</button></div><p class="status" id="b5st"></p>`
     : pers ? big5Result(pers.scores) + '<button class="ghost" data-act="assess-open" data-k="big5">Retake</button>' : '<p>About 2 minutes. Answer how you usually are, not how you would like to be.</p><button class="primary" data-act="assess-open" data-k="big5">Start questionnaire</button>'}
   </section>
   <section class="card stack"><div class="row between"><h2>B. Reasoning assessment</h2><span class="pill">Optional</span></div>
     <p class="hint">Six example questions: logical sequences, matrix reasoning, abstract and quantitative problems. Results are kept separate from personality.</p>
     ${assessOpen === 'reasoning' ? `${REASONING.map((q, i) => `<fieldset class="q"><legend>${i + 1}. ${q.q}</legend>${q.grid ? `<div class="matrix" aria-label="3 by 3 grid">${q.grid.map(c => `<span>${c}</span>`).join('')}</div>` : ''}<div class="opts">${q.o.map((o, j) => `<label><input type="radio" name="rz-${i}" value="${j}"><span>${o}</span></label>`).join('')}</div></fieldset>`).join('')}
       <div class="row"><button class="primary" data-act="rz-submit">Submit answers</button><button class="ghost" data-act="assess-close">Cancel</button></div><p class="status" id="rzst"></p>`
     : rz?.answers ? reasoningResult(rz.answers) + '<button class="ghost" data-act="assess-open" data-k="reasoning">Retake</button>' : '<p>About 3 minutes. You can skip this and still finish registration.</p><button data-act="assess-open" data-k="reasoning">Start reasoning assessment</button>'}
   </section></div>
   <div class="row footer-row"><button class="primary" data-act="ob-finish" ${pers ? '' : 'disabled'}>See my Skill Fingerprint</button><span class="hint">${pers ? '' : 'Complete the personality questionnaire to finish.'}</span></div>`
}
act('assess-open', el => { assessOpen = el.dataset.k; render() })
act('assess-close', () => { assessOpen = null; render() })
act('b5-submit', async () => {
  const ids = BIG5.flatMap(d => d.items.map(i => i[0])), answers = {}
  for (const id of ids) { const c = document.querySelector(`input[name="b5-${id}"]:checked`); if (!c) return status('#b5st', 'Answer all ten statements.', true); answers[id] = +c.value }
  await savePersonality(answers); assessOpen = null; await loadMe(); toast('Personality questionnaire completed'); render()
})
async function savePersonality(answers) { await db.upsert('personality', { user_id: db.me(), answers, scores: big5Scores(answers) }, ['user_id']) }
act('rz-submit', async () => {
  const ans = []
  for (let i = 0; i < REASONING.length; i++) { const c = document.querySelector(`input[name="rz-${i}"]:checked`); if (!c) return status('#rzst', 'Answer all six questions.', true); ans.push(+c.value) }
  await saveReasoning(ans); assessOpen = null; await loadMe(); toast('Reasoning assessment completed'); render()
})
async function saveReasoning(ans) {
  const uid = db.me(), score = ans.filter((a, i) => a === REASONING[i].a).length
  await db.saveProfile({ reasoning: { answers: ans, score, done: true } })
  await db.removeWhere('evidence', { user_id: uid, ref: 'reasoning' })
  const abilities = [...new Set(REASONING.map(q => q.ab))]
  await db.insertMany('evidence', abilities.map(ab => {
    const qs = REASONING.map((q, i) => [q, i]).filter(([q]) => q.ab === ab); const r = qs.filter(([q, i]) => ans[i] === q.a).length
    return r ? { user_id: uid, skill_id: ab, source: 'assessed', title: 'Initial reasoning assessment', detail: `${r} of ${qs.length} correct (${qs[0][0].domain.toLowerCase()}).`, level: r === qs.length ? 3 : 2, sensitive: true, ref: 'reasoning' } : null
  }).filter(Boolean))
}
act('ob-finish', () => advance(4))

// ---------- Maya demo ----------
act('maya-ask', () => {
  $('#maya-confirm').innerHTML = `<div class="banner"><span>This replaces everything in this account with Maya's fictional demo profile.</span><span class="row"><button class="primary" data-act="maya-load">Load Maya</button><button class="ghost" data-act="maya-no">Cancel</button></span></div>`
})
act('maya-no', () => { $('#maya-confirm').innerHTML = '' })
act('maya-load', async el => {
  el.disabled = true; el.innerHTML = spin + 'Loading…'
  try { await loadMaya(); sessionStorage.removeItem('ob-step'); toast("Maya's example loaded"); go('#discover') }
  catch (e) { toast('Loading failed: ' + e.message, true); el.disabled = false }
})
export async function wipeMine() {
  const uid = db.me()
  for (const [t, k] of [['evidence', 'user_id'], ['experiences', 'user_id'], ['reference_requests', 'user_id'], ['personality', 'user_id'], ['course_progress', 'user_id'], ['contributions', 'user_id'], ['assessments', 'user_id'], ['applications', 'candidate_id'], ['cv_documents', 'user_id']]) await db.removeWhere(t, { [k]: uid })
}
async function loadMaya() {
  const uid = db.me()
  await wipeMine()
  await db.saveProfile({ ...MAYA.profile, linkedin: '', onboarding: 4, reasoning: null, saved_topics: [], premium_demo: false })
  await db.insert('cv_documents', { user_id: uid, file_name: 'maya-fournier-cv.pdf (demo)', file_path: null, text: MAYA.cv })
  const x = extractCv(MAYA.cv)
  const exps = [
    ...x.education.map(e => ({ kind: 'education', title: e.degree, role: e.degree, org: e.school, period: e.years })),
    ...x.work.filter(w => !/garden/i.test(w.org)).map(w => ({ kind: /intern/i.test(w.role) ? 'internship' : 'work', title: w.role, role: w.role, org: w.org, period: w.period, contribution: w.description })),
    ...x.certifications.map(c => ({ kind: 'certification', title: c.name, role: c.name, period: c.year })),
    ...x.extracurricular.map(t => ({ kind: 'extracurricular', title: t, role: t })),
  ].map(e => ({ org: '', period: '', contribution: '', ...e, user_id: uid, source: 'imported' }))
  await db.insertMany('experiences', exps)
  await db.insertMany('evidence', matchText(MAYA.cv, 'imported', aliases).filter(e => SKILLS[e.skill_id]).map(e => ({ ...e, user_id: uid })))
  const garden = await saveExperience(MAYA.showcase)
  await savePersonality(MAYA.big5)
  await saveReasoning(MAYA.reasoning)
  const f = MAYA.feedback
  const ref = await db.insert('reference_requests', { user_id: uid, referee_name: f.name, relationship: f.relationship, skill_id: COMP[f.skill].o, skill_label: COMP[f.skill].n, student_first_name: 'Maya', experience_id: garden.id, experience_title: garden.title, status: 'answered', response: f.text })
  await db.insert('evidence', { user_id: uid, skill_id: COMP[f.skill].o, source: 'peer', title: `${f.relationship}: ${f.name}`, detail: `"${f.text}"`, level: 3, ref_id: ref.id, experience_id: garden.id })
  await loadMe()
}

// ======================================================================
// DISCOVER — My Skill Fingerprint
// ======================================================================
export function discover() {
  const p = S.profile, ev = byskill(S.evidence)
  const role = ROLES[p.target_role] || roles.roles[0], need = role.requires
  const reqIds = Object.keys(need).filter(id => SKILLS[id] && id.startsWith('F.'))
  const counts = { meets: 0, partial: 0, missing: 0 }
  reqIds.forEach(id => counts[gapStatus(lvOf(ev, id), need[id])]++)
  const quals = S.experiences.filter(e => e.source !== 'self')
  const shows = S.experiences.filter(e => e.source === 'self')
  const bySource = {}; S.evidence.forEach(e => { const k = srcKey(e.source); bySource[k] = (bySource[k] || 0) + 1 })
  const gaps = reqIds.filter(id => gapStatus(lvOf(ev, id), need[id]) !== 'meets').sort((a, b) => (need[b] - lvOf(ev, b)) - (need[a] - lvOf(ev, a))).slice(0, 4)
  const tree = taxonomy.categories.map(c => {
    const subs = c.subcategories.map(s => {
      const rows = s.skills.filter(k => showAll || lvOf(ev, k.id) || (need[k.id] && k.id.startsWith('F.')))
      return rows.length ? `<li><div class="sub">${esc(s.name)}</div><ul>${rows.map(k => skillRow(k, lvOf(ev, k.id), need[k.id], ev[k.id] || [], role.oasis[k.id])).join('')}</ul></li>` : ''
    }).join('')
    return subs ? `<li><div class="cat">${esc(c.name)}</div><ul>${subs}</ul></li>` : ''
  }).join('')
  return `${head('Stage 1 · Discover', esc(p.full_name || 'My Skill Fingerprint') + (p.is_demo ? ' ' + demoTag : ''), esc([p.headline || p.field_of_study, p.university, p.grad_year && 'Class of ' + p.grad_year].filter(Boolean).join(' · ')),
    `<label for="role2" class="inline">Compare with</label><select id="role2" data-change="role2">${roles.roles.map(r => `<option value="${r.id}" ${r.id === role.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select><a class="btn" href="#onboard">Edit</a>`)}
  ${(p.onboarding || 0) < 4 ? `<div class="banner"><span>Your registration is not finished yet.</span><a class="btn primary" href="#onboard">Continue registration</a></div>` : ''}
  <div class="grid g-side">
   <div class="stack">
    <section class="card fp">
      <canvas id="fpc" width="560" height="560" aria-label="Fingerprint drawing generated from your evidence"></canvas>
      <h3 style="align-self:flex-start">F. Evidence status</h3>
      <div class="kv">${['imported', 'self', 'assessed', 'verified', 'peer', 'learning', 'contribution'].map(k => `<span>${chip(k)}</span><b class="mono">${bySource[k] || 0}</b>`).join('')}<span>Overall score</span><span>None, by design</span></div>
    </section>
    <section class="card stack">
      <h3>${esc(role.name)}: skills coverage</h3>
      <div class="cover" aria-hidden="true"><span style="width:${counts.meets / reqIds.length * 100}%;background:var(--ok)"></span><span style="width:${counts.partial / reqIds.length * 100}%;background:var(--part)"></span></div>
      <div class="kv"><span>At required level</span><b class="mono" style="color:var(--ok)">${counts.meets} of ${reqIds.length}</b><span>Some evidence</span><b class="mono" style="color:var(--part)">${counts.partial}</b><span>No evidence yet</span><b class="mono" style="color:var(--miss)">${counts.missing}</b></div>
      <p class="hint">Skills OaSIS 2025 rates 3+ for NOC ${esc(role.noc)}. Entry-level target = OaSIS rating minus 1.</p>
      ${gaps.length ? `<h3>Strengthen next</h3>${gaps.map(id => `<div class="gaprow"><span>${esc(SKILLS[id].name)} <span class="muted mono">${lvOf(ev, id)}/${need[id]}</span></span><a class="ghost-link" href="#develop">Find practice</a></div>`).join('')}` : ''}
    </section>
    <section class="card stack"><div class="row between"><h3>Privacy</h3><a class="ghost-link" href="#profile">Change</a></div>
      <div class="kv"><span>Discoverable by employers</span><b>${p.discoverable ? 'Yes' : 'No'}</b><span>Share reasoning results</span><b>${p.share_assessments ? 'Yes' : 'No'}</b><span>Personality results</span><b>Only you</b></div>
    </section>
   </div>
   <div class="stack">
    <section class="card stack"><div class="row between"><h2>A. Qualifications</h2>${chip('imported')}</div>
      ${quals.length ? quals.map(x => `<div class="qual"><b>${esc(x.title || x.role)}</b>${x.org ? ' · ' + esc(x.org) : ''} <span class="hint">${esc(KIND[x.kind] || x.kind)}${x.period ? ' · ' + esc(x.period) : ''}</span></div>`).join('') : '<p class="hint">No CV confirmed yet. <a href="#onboard">Upload it</a>.</p>'}
    </section>
    <section class="stack"><div class="row between"><h2>B. Experience evidence</h2><button data-act="exp-new">Add experience</button></div>
      ${shows.length ? shows.map(x => expCard(x)).join('') : '<div class="card flat"><p class="hint">Add projects, volunteering or competitions with what you did and what changed.</p></div>'}
    </section>
    <section class="card">
      <div class="row between" style="margin-bottom:6px"><h2>E. Skills and competencies</h2><label class="row hint inline"><input type="checkbox" data-change="showall" ${showAll ? 'checked' : ''}> Show full taxonomy</label></div>
      <p class="hint" style="margin-bottom:8px">Filled dots: strength of your evidence. Ringed dot: level the target role asks for. Click a skill to see where it came from.</p>
      <ul class="tree">${tree || '<li class="hint">No skills found yet.</li>'}</ul>
    </section>
    <section class="grid g2">
      <div class="card stack"><div class="row between"><h2>C. Personality</h2><span class="pill">Private</span></div>${S.personality ? big5Result(S.personality.scores) : '<p class="hint">Not completed. <a href="#onboard">Take the questionnaire</a>.</p>'}</div>
      <div class="card stack"><div class="row between"><h2>D. Cognitive reasoning</h2><span class="pill">${p.share_assessments ? 'Shared' : 'Private'}</span></div>${p.reasoning?.answers ? reasoningResult(p.reasoning.answers) : '<p class="hint">Optional and not taken. <a href="#onboard">Take it</a>.</p>'}</div>
    </section>
   </div></div>`
}
function skillRow(k, have, need, items, rating) {
  const s = gapStatus(have, need)
  const label = s === 'missing' && k.id.startsWith('A.') ? 'Not tested' : { meets: 'Meets', partial: 'Partial', missing: 'Gap', extra: '', none: '' }[s]
  const dots = [1, 2, 3, 4, 5].map(i => `<i class="${i <= have ? 'f' : ''} ${i === need ? 'r' : ''}"></i>`).join('')
  return `<li class="skill"><button class="name" data-act="skill-toggle" data-id="${k.id}" aria-expanded="${openSkills.has(k.id)}" title="${esc(k.description)}${rating ? ` · OaSIS rating for this role: ${rating}/5` : ''}">${esc(k.name)}</button>
   <span class="dots" aria-label="Evidence level ${have} of 5${need ? `, role needs ${need}` : ''}">${dots}</span><span class="st ${s}">${label}</span>
   ${openSkills.has(k.id) ? `<div class="evlist">${items.length ? items.map(e => `<div class="ev">${chip(e.source)}<p><b>${esc(e.title)}</b>${e.detail ? ' · ' + esc(e.detail) : ''} <span class="muted mono">L${e.level || 1}</span></p></div>`).join('') : `<p class="hint">No evidence yet. ${esc(k.description)}</p>`}</div>` : ''}</li>`
}
act('skill-toggle', el => { const id = el.dataset.id; openSkills.has(id) ? openSkills.delete(id) : openSkills.add(id); render() })
act('exp-new', () => { editingExp = null; sessionStorage.setItem('ob-step', 2); go('#onboard') })
act('role2', async el => { await db.saveProfile({ target_role: el.value }); S.profile.target_role = el.value; render() })
act('showall', el => { showAll = el.checked; render() })

export function drawFingerprint(evidence = S.evidence, seedName = S.profile.full_name) {
  const c = $('#fpc'); if (!c) return
  const x = c.getContext('2d'), W = c.width, css = getComputedStyle(document.documentElement)
  const ev = byskill(evidence)
  const bands = taxonomy.categories.flatMap(cat => cat.subcategories).filter(s => s.skills.length).map(s => {
    const items = s.skills.flatMap(k => ev[k.id] || [])
    const lvl = s.skills.reduce((a, k) => a + lvOf(ev, k.id), 0) / (s.skills.length * 5)
    const by = {}; items.forEach(e => by[srcKey(e.source)] = (by[srcKey(e.source)] || 0) + 1)
    const top = Object.keys(by).sort((a, b) => ['peer', 'assessed', 'verified'].includes(b) - ['peer', 'assessed', 'verified'].includes(a) || by[b] - by[a])[0]
    return { p: lvl, col: css.getPropertyValue(top ? '--s-' + top : '--line').trim() }
  })
  let seed = [...(seedName || 'achievers')].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 7)
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
  x.clearRect(0, 0, W, W)
  const cx = W / 2, cy = W * .53, rings = 27
  for (let i = 0; i < rings; i++) {
    const b = bands[Math.floor(i / rings * bands.length)], base = 9 + i * 9.4
    x.strokeStyle = b.col; x.globalAlpha = b.p > 0 ? .95 : .5; x.lineWidth = b.p > 0 ? 2 + b.p * 12 : 1.3; x.lineCap = 'round'
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

// ======================================================================
// MY PROFILE
// ======================================================================
export function profilePage() {
  const p = S.profile, intro = p.intro || {}
  return `${head('My Profile', 'Personal information and privacy')}
  <div class="grid g2">
   <section class="card stack"><h2>Personal information</h2>${personalForm(p)}
     <div><label for="li2">LinkedIn URL <span class="opt">(optional)</span></label><input type="text" id="li2" value="${esc(p.linkedin)}"></div>
     <h3>About me</h3>${INTRO.map(([k, q]) => `<div><label for="in-${k}">${q}</label><textarea id="in-${k}" rows="2">${esc(intro[k])}</textarea></div>`).join('')}
     <div class="row"><button class="primary" data-act="profile-save">Save</button></div><p class="status" id="prst"></p>
   </section>
   <div class="stack">
    <section class="card stack"><h2>Privacy</h2>
      <label class="toggle"><input type="checkbox" id="pv-disc" ${p.discoverable ? 'checked' : ''}><span><b>Let employers discover my profile</b><br><span class="hint">Recruiters can find your anonymised Skill Fingerprint and public contributions. Off: only employers you apply to see your summary.</span></span></label>
      <label class="toggle"><input type="checkbox" id="pv-share" ${p.share_assessments ? 'checked' : ''}><span><b>Share my initial reasoning results</b><br><span class="hint">Off by default. Personality results are never shared.</span></span></label>
      <div class="row"><button class="primary" data-act="privacy-save">Save privacy settings</button></div>
      <p class="hint">Employers see you as an anonymous candidate ID. Your name appears only after you accept an interview.</p>
    </section>
    <section class="card stack"><h2>Your data</h2>
      <p class="hint">Remove everything you added: CV, experiences, assessments, contributions, courses and applications.</p>
      <div class="row"><button data-act="wipe-ask">Delete my data</button></div><div id="wipe-confirm"></div>
    </section>
   </div></div>`
}
act('profile-save', async () => {
  const p = readPersonal(); p.linkedin = val('li2'); p.intro = Object.fromEntries(INTRO.map(([k]) => [k, val('in-' + k)]))
  if (!p.full_name) return status('#prst', 'Name is required.', true)
  await db.saveProfile(p); Object.assign(S.profile, p); toast('Profile saved')
})
act('privacy-save', async () => {
  const patch = { discoverable: $('#pv-disc').checked, share_assessments: $('#pv-share').checked }
  await db.saveProfile(patch); Object.assign(S.profile, patch); toast('Privacy settings saved')
})
act('wipe-ask', () => { $('#wipe-confirm').innerHTML = `<div class="banner"><span>This cannot be undone.</span><button class="primary" data-act="wipe-do">Delete everything</button></div>` })
act('wipe-do', async () => {
  await wipeMine(); await db.saveProfile({ onboarding: 0, reasoning: null, intro: null, discoverable: false, share_assessments: false, is_demo: false })
  sessionStorage.removeItem('ob-step'); await loadMe(); toast('Your data was deleted'); go('#onboard')
})

// ======================================================================
// MY ACTIVITIES
// ======================================================================
export async function activities() {
  await loadMe()
  const jobs = [...DEMO_JOBS, ...(await db.list('jobs').catch(() => []))]
  const job = id => jobs.find(j => j.id === id)
  const topic = id => DEMO_TOPICS.find(t => t.id === id)
  const course = id => COURSES.find(c => c.id === id)
  const invites = S.applications.filter(a => a.interview && a.interview.state === 'invited')
  return `${head('My Activities', 'Courses, contributions, assessments and applications')}
  ${invites.map(a => `<div class="banner"><span><b>Interview invitation</b> · ${esc(job(a.job_id)?.title || 'Role')} at ${esc(job(a.job_id)?.company || '')} · ${esc(a.interview.format)} · ${esc(a.interview.when)}</span><span class="row"><button class="primary" data-act="iv-answer" data-id="${a.id}" data-v="accepted">Accept</button><button data-act="iv-answer" data-id="${a.id}" data-v="declined">Decline</button></span></div>`).join('')}
  <div class="grid g2">
   <section class="card stack"><h2>Applications</h2>
     ${S.applications.length ? S.applications.map(a => `<div class="exp"><div class="row between"><b>${esc(job(a.job_id)?.title || 'Role')}</b><span class="pill ok">${esc(a.status)}</span></div><span class="hint">${esc(job(a.job_id)?.company || '')} · ${a.route === 'invited' ? 'Invited by employer' : 'Applied'} ${fmtDate(a.created_at)}</span>
       ${a.route === 'invited' && !a.invite_response ? `<div class="row"><button class="primary" data-act="inv-answer" data-id="${a.id}" data-v="accepted">Accept invitation</button><button data-act="inv-answer" data-id="${a.id}" data-v="declined">Decline</button></div>` : ''}
       ${a.interview ? `<p class="hint">Interview: ${esc(a.interview.format)}, ${esc(a.interview.when)} · ${esc(a.interview.state)}</p>` : ''}
       <a class="ghost-link" href="#job/${esc(a.job_id)}">Open</a></div>`).join('') : '<p class="hint">No applications yet. <a href="#apply">Browse opportunities</a>.</p>'}
   </section>
   <section class="card stack"><h2>Assessments</h2>
     ${S.assessments.length ? S.assessments.map(x => `<div class="exp"><div class="row between"><b>${x.kind === 'group' ? 'Group simulation' : 'Individual simulation'}</b><span class="pill">${x.status === 'submitted' ? 'Completed' : 'In progress'}</span></div><span class="hint">${esc(job(x.job_id)?.title || '')} · ${fmtDate(x.created_at)}</span><a class="ghost-link" href="#${x.kind === 'group' ? 'group' : 'challenge'}/${x.application_id || x.job_id}">${x.status === 'submitted' ? 'View result' : 'Continue'}</a></div>`).join('') : '<p class="hint">None yet. Assessments start after you apply or accept an invitation.</p>'}
   </section>
   <section class="card stack"><h2>Courses</h2>
     ${S.courses.length ? S.courses.map(c => `<div class="row between"><span>${esc(course(c.course_id)?.title || c.course_id)}</span><span class="hint">${fmtDate(c.created_at)} · ${c.score ?? '–'} correct</span></div>`).join('') : '<p class="hint">No courses yet. <a href="#develop/learn">Open the Learning Hub</a>.</p>'}
   </section>
   <section class="card stack"><h2>Contributions</h2>
     ${S.contributions.length ? S.contributions.map(c => `<div class="exp"><b>${esc(topic(c.topic_id)?.title || 'Topic')}</b><p>${esc(c.idea)}</p><a class="ghost-link" href="#topic/${esc(c.topic_id)}">Open discussion</a></div>`).join('') : '<p class="hint">No contributions yet. <a href="#develop">Explore topics</a>.</p>'}
   </section>
  </div>`
}
act('inv-answer', async el => {
  const a = S.applications.find(x => x.id === el.dataset.id), ok = el.dataset.v === 'accepted'
  await db.update('applications', a.id, { invite_response: el.dataset.v, status: ok ? 'Assessment Invited' : 'Final Decision', updated_at: new Date().toISOString() })
  await loadMe(); toast(ok ? 'Invitation accepted. Your assessment is ready under Apply.' : 'Invitation declined'); render()
})
act('iv-answer', async el => {
  const a = S.applications.find(x => x.id === el.dataset.id)
  await db.update('applications', a.id, { interview: { ...a.interview, state: el.dataset.v }, updated_at: new Date().toISOString() })
  await loadMe(); toast(el.dataset.v === 'accepted' ? 'Interview accepted' : 'Interview declined'); render()
})
