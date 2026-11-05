// PART 4 — Connect: employer dashboard
import * as db from './db.js'
import { S } from './state.js'
import { $, $$, esc, val, act, go, render, toast, status, spin, chip, head, compName, anonId, fmtDate, demoTag } from './ui.js'
import { COMPETENCIES, COMP, CATEGORIES, DEMO_CANDIDATES, DEMO_COMPANY, STATUSES } from './demo.js'
import { loadCandidate, allJobs, miniCv, evidenceFor, assessedFor } from './summary.js'
import { allTopics, allContributions } from './develop.js'

// Demo candidates' pipeline state lives in this browser only
const DKEY = 'achievers-demo-pipeline'
const demoState = () => { try { return JSON.parse(localStorage.getItem(DKEY)) || {} } catch { return {} } }
const saveDemo = d => { try { localStorage.setItem(DKEY, JSON.stringify(d)) } catch {} }
const savedKey = 'achievers-saved-candidates'
const savedSet = () => { try { return new Set(JSON.parse(localStorage.getItem(savedKey)) || []) } catch { return new Set() } }
let disc = { skill: '', q: '', cat: '' }
let compareSel = new Set()
const company = () => S.profile.company || DEMO_COMPANY

const nav = cur => `<div class="tabs" role="tablist">${[['#e-discover', 'Talent Discovery'], ['#e-jobs', 'Job Openings'], ['#e-assess', 'Assessment Management'], ['#e-topics', 'Marketplace Topics'], ['#e-company', 'Company Profile']].map(([h, n]) => `<a role="tab" href="${h}" aria-selected="${cur === h}">${n}</a>`).join('')}</div>`

// Applications for a job: real rows plus demo candidates
async function pipeline(jobId) {
  const real = (await db.list('applications', { job_id: jobId }).catch(() => [])).map(a => ({ ...a, cid: a.candidate_id, demo: false }))
  const ds = demoState()
  const demo = DEMO_CANDIDATES.filter(c => c.status[jobId] || ds[jobId]?.[c.id]).map(c => ({ id: 'demo:' + c.id, cid: c.id, job_id: jobId, route: 'applied', demo: true, ...(ds[jobId]?.[c.id] || { status: c.status[jobId] }) }))
  return [...real, ...demo]
}
async function setApp(app, patch) {
  if (app.demo) { const d = demoState(); d[app.job_id] = d[app.job_id] || {}; d[app.job_id][app.cid] = { ...(d[app.job_id][app.cid] || { status: app.status }), ...patch }; saveDemo(d); return }
  await db.update('applications', app.id, { ...patch, updated_at: new Date().toISOString() })
}

// ======================================================================
// TALENT DISCOVERY
// ======================================================================
export async function discoverPage() {
  const real = (await db.list('profiles', { discoverable: true }).catch(() => [])).filter(p => p.id !== db.me() || S.profile.discoverable)
  const ids = [...real.map(p => p.id), ...DEMO_CANDIDATES.map(c => c.id)]
  const cands = (await Promise.all(ids.map(loadCandidate))).filter(Boolean)
  const saved = savedSet(), q = disc.q.toLowerCase()
  const topics = await allTopics()
  const shown = cands.filter(c => (!disc.skill || evidenceFor(c, disc.skill).items.length || assessedFor(c, disc.skill).length)
    && (!q || [c.field, c.interests, c.education, ...c.experiences.map(e => e.title + ' ' + (e.contribution || ''))].join(' ').toLowerCase().includes(q))
    && (!disc.cat || c.contributions.some(x => topics.find(t => t.id === x.topic_id)?.category === disc.cat)))
  const jobs = await allJobs()
  return `${head('Stage 4 · Connect', 'Talent Discovery', 'Candidates who chose to be discoverable. You see anonymised evidence, not names, photos or private assessments.')}${nav('#e-discover')}
  <div class="row filters">
    <select data-change="d-skill" aria-label="Skill"><option value="">Any competency</option>${COMPETENCIES.map(c => `<option value="${c.k}" ${disc.skill === c.k ? 'selected' : ''}>${c.n}</option>`).join('')}</select>
    <select data-change="d-cat" aria-label="Contributed to topic category"><option value="">Any topic contributions</option>${CATEGORIES.map(c => `<option ${disc.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
    <input type="search" placeholder="Field, project or keyword" value="${esc(disc.q)}" data-change="d-q" aria-label="Keyword">
  </div>
  <div class="grid g2">${shown.map(c => {
    const top = COMPETENCIES.map(k => ({ k: k.k, ...evidenceFor(c, k.k) })).filter(x => x.level).sort((a, b) => b.level - a.level).slice(0, 4)
    const exp = c.experiences.find(e => e.source === 'self') || c.experiences.find(e => e.kind !== 'education')
    return `<article class="card stack"><div class="row between"><h3>${esc(c.label)}</h3>${c.demo ? demoTag : ''}</div>
      <span class="hint">${esc(c.education || '')}${c.interests ? ' · Interested in ' + esc(c.interests) : ''}</span>
      <div class="stack" style="gap:4px">${top.map(x => `<div class="row between"><span>${esc(compName(x.k))}</span><span class="row" style="gap:4px">${[...new Set(x.items.map(i => i.source))].map(s => chip(s)).join('')}</span></div>`).join('') || '<p class="hint">No skill evidence yet.</p>'}</div>
      ${exp ? `<p class="hint">Project: <b>${esc(exp.title || exp.role)}</b>${exp.outcome ? ' · ' + esc(exp.outcome) : ''}</p>` : ''}
      ${c.contributions[0] ? `<div class="ev">${chip('contribution')}<p>${esc(c.contributions[0].idea)}</p></div>` : ''}
      <div class="row"><a class="btn" href="#e-cand/${esc(c.id)}">View profile</a><button data-act="d-save" data-id="${esc(c.id)}">${saved.has(c.id) ? 'Saved' : 'Save'}</button>
        <select id="inv-${esc(c.id)}" aria-label="Role to invite to">${jobs.map(j => `<option value="${esc(j.id)}">${esc(j.title)}</option>`).join('')}</select>
        <button data-act="d-invite" data-id="${esc(c.id)}" data-kind="position">Invite to position</button><button class="primary" data-act="d-invite" data-id="${esc(c.id)}" data-kind="assessment">Invite to assessment</button></div>
    </article>` }).join('') || '<p class="hint">No discoverable candidates match.</p>'}</div>`
}
act('d-skill', el => { disc.skill = el.value; render() })
act('d-cat', el => { disc.cat = el.value; render() })
act('d-q', el => { disc.q = el.value; render() })
act('d-save', el => { const s = savedSet(); s.has(el.dataset.id) ? s.delete(el.dataset.id) : s.add(el.dataset.id); try { localStorage.setItem(savedKey, JSON.stringify([...s])) } catch {} ; toast(s.has(el.dataset.id) ? 'Candidate saved to shortlist' : 'Removed from saved'); render() })
act('d-invite', async el => {
  const cid = el.dataset.id, jobId = val('inv-' + cid), kind = el.dataset.kind
  const status = kind === 'assessment' ? 'Assessment Invited' : 'Initial Screening'
  if (cid.startsWith('demo-')) { const d = demoState(); d[jobId] = d[jobId] || {}; d[jobId][cid] = { status, route: 'invited' }; saveDemo(d) }
  else {
    const existing = (await db.list('applications', { job_id: jobId, candidate_id: cid }))[0]
    if (existing) await db.update('applications', existing.id, { status, route: 'invited', invite_response: null, updated_at: new Date().toISOString() })
    else await db.insert('applications', { job_id: jobId, candidate_id: cid, route: 'invited', status })
  }
  toast(kind === 'assessment' ? 'Assessment invitation sent. The candidate can accept or decline.' : 'Invitation to the position sent')
})

// ======================================================================
// JOBS + ASSESSMENT MANAGEMENT
// ======================================================================
const fmtLabel = { 'individual-short': 'Individual short challenge (~20 min)', 'individual-extended': 'Individual extended simulation (up to 60 min)', group: 'Group challenge', 'company-collab': 'Company–candidate collaboration' }
export async function jobsPage() {
  const jobs = await allJobs()
  const counts = await Promise.all(jobs.map(async j => (await pipeline(j.id)).length))
  return `${head('Stage 4 · Connect', 'Job Openings')}${nav('#e-jobs')}
  <div class="grid g2">
   <section class="stack">${jobs.map((j, i) => `<a class="card topic stack" href="#e-job/${esc(j.id)}"><div class="row between"><span class="eyebrow">${esc(j.company)}</span>${j.demo ? demoTag : ''}</div><h3>${esc(j.title)}</h3><span class="hint">${esc(j.location)} · ${esc(j.employment_type)} · ${counts[i]} candidate${counts[i] === 1 ? '' : 's'}</span><div class="row">${(j.skills || []).map(k => `<span class="pill">${esc(compName(k))}</span>`).join('')}</div></a>`).join('')}</section>
   <section class="card stack"><h2>Create a job posting</h2>${jobForm()}<div class="row"><button class="primary" data-act="job-create">Publish job</button></div><p class="status" id="jst"></p></section>
  </div>`
}
function jobForm() {
  const f = (id, l, ph = '') => `<div><label for="${id}">${l}</label><input type="text" id="${id}" placeholder="${ph}"></div>`
  return `${f('j-title', 'Job title', 'Junior Business Analyst')}
   <div><label for="j-desc">Job description</label><textarea id="j-desc" rows="3"></textarea></div>
   <div><label for="j-qual">Required qualifications</label><textarea id="j-qual" rows="2"></textarea></div>
   <fieldset><legend>Relevant skills</legend><div class="checks">${COMPETENCIES.map(c => `<label><input type="checkbox" name="j-sk" value="${c.k}"><span>${c.n}</span></label>`).join('')}</div></fieldset>
   <div class="grid g-form">${f('j-loc', 'Location or remote status', 'Calgary, AB · Hybrid')}${f('j-type', 'Employment type', 'Full-time')}<div><label for="j-dead">Application deadline</label><input type="date" id="j-dead"></div></div>
   ${assessForm()}`
}
function assessForm(a = {}) {
  return `<h3>Assessment requirements</h3><div class="grid g-form">
     <div><label for="a-fmt">Format</label><select id="a-fmt">${Object.entries(fmtLabel).map(([k, n]) => `<option value="${k}" ${a.format === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
     <div><label for="a-dur">Duration (minutes)</label><input type="number" id="a-dur" value="${a.duration || 20}" min="10" max="60"></div>
     <div><label for="a-diff">Difficulty</label><select id="a-diff">${['Entry level', 'Intermediate'].map(d => `<option ${a.difficulty === d ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
     <div><label for="a-ctx">Industry or context</label><select id="a-ctx">${['Retail', 'Consulting', 'Logistics', 'Finance', 'Non-profit'].map(d => `<option ${a.context === d ? 'selected' : ''}>${d}</option>`).join('')}</select></div></div>
   <fieldset><legend>Competencies to assess</legend><div class="checks">${['analytical', 'problem', 'communication', 'collaboration', 'decision', 'adaptability', 'initiative', 'leadership'].map(k => `<label><input type="checkbox" name="a-comp" value="${k}" ${(a.competencies || []).includes(k) ? 'checked' : ''}><span>${compName(k)}</span></label>`).join('')}</div></fieldset>
   <label class="toggle"><input type="checkbox" id="a-group" ${a.group ? 'checked' : ''}><span>Add a group simulation</span></label>
   <p class="hint">The prototype uses a curated library of scenarios matched to these choices. Tasks have not been independently psychometrically validated.</p>`
}
const readAssess = () => ({ format: val('a-fmt'), duration: +val('a-dur') || 20, difficulty: val('a-diff'), context: val('a-ctx'), competencies: $$('input[name=a-comp]:checked').map(i => i.value), group: $('#a-group').checked })
act('job-create', async el => {
  const job = { created_by: db.me(), title: val('j-title'), company: company().name, description: val('j-desc'), qualifications: val('j-qual'), skills: $$('input[name=j-sk]:checked').map(i => i.value), location: val('j-loc'), employment_type: val('j-type'), deadline: val('j-dead') || null, assessment: readAssess() }
  if (!job.title || !job.description || !job.skills.length) return status('#jst', 'Add a title, description and at least one skill.', true)
  el.disabled = true
  try { const j = await db.insert('jobs', job); toast('Job published'); go('#e-job/' + j.id) } catch (e) { status('#jst', 'Could not publish: ' + esc(e.message), true); el.disabled = false }
})

export async function assessPage() {
  const jobs = await allJobs()
  return `${head('Stage 4 · Connect', 'Assessment Management', 'Choose the role, competencies and format. Each candidate gets a randomised version of the same underlying task.')}${nav('#e-assess')}
  <div class="grid g2"><section class="stack">${jobs.map(j => { const a = j.assessment || {}
    return `<div class="card stack"><div class="row between"><h3>${esc(j.title)}</h3>${j.demo ? demoTag : ''}</div>
      <div class="kv"><span>Format</span><span>${esc(fmtLabel[a.format] || '—')}${a.group && a.format !== 'group' ? ' + group simulation' : ''}</span><span>Duration</span><span>${a.duration || '—'} min</span><span>Context</span><span>${esc(a.context || '—')}</span><span>Competencies</span><span>${(a.competencies || []).map(compName).join(', ') || '—'}</span></div>
      <a class="ghost-link" href="#e-job/${esc(j.id)}">Candidates and reports</a></div>` }).join('')}</section>
   <section class="card stack"><h2>Library scenarios</h2>
     <div class="exp"><b>Profit decline (individual)</b><p class="hint">Revenue up, profit down. Candidates choose indicators, identify drivers, prioritise actions and write a recommendation. Objective steps are auto-scored; the written part needs human review.</p></div>
     <div class="exp"><b>Supply chain disruption (group)</b><p class="hint">A team allocates scarce stock across customer groups and agrees on mitigation. Scored on explicit, observable criteria; human evaluators recommended.</p></div>
     <p class="hint">Long term: templates designed by I-O psychologists, with AI changing scenario variables. Equivalent difficulty across versions must be tested.</p>
   </section></div>`
}

// ======================================================================
// ONE JOB: pipeline, comparison
// ======================================================================
export async function jobPipeline(jobId) {
  const job = (await allJobs()).find(j => j.id === jobId)
  if (!job) return `<div class="card"><h2>Job not found</h2><a href="#e-jobs">Back</a></div>`
  const apps = await pipeline(jobId)
  const cands = Object.fromEntries(await Promise.all(apps.map(async a => [a.cid, await loadCandidate(a.cid)])))
  return `<a href="#e-jobs" class="back">← Job openings</a>
  ${head(esc(job.company), esc(job.title), `${apps.length} candidate${apps.length === 1 ? '' : 's'} · no automated ranking`, `<button class="primary" data-act="cmp-go" data-job="${esc(jobId)}">Compare selected</button>`)}
  <div class="pipeline">${STATUSES.map(st => { const col = apps.filter(a => a.status === st)
    return `<section class="col"><h3>${st} <span class="mono hint">${col.length}</span></h3>${col.map(a => { const c = cands[a.cid]; if (!c) return ''
      return `<div class="card pcard stack"><label class="row"><input type="checkbox" data-change="cmp-sel" value="${esc(a.cid)}" ${compareSel.has(a.cid) ? 'checked' : ''}><b>${esc(a.interview?.state === 'accepted' && c.name ? c.name : c.label)}</b></label>
        <span class="hint">${a.route === 'invited' ? 'Invited' + (a.invite_response ? ' · ' + a.invite_response : ' · awaiting reply') : 'Applied'}${a.interview ? ' · interview ' + esc(a.interview.state) : ''}</span>
        <select data-change="app-status" data-app="${esc(a.id)}" data-job="${esc(jobId)}" aria-label="Status">${STATUSES.map(s => `<option ${s === a.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
        <a class="ghost-link" href="#e-cand/${esc(a.cid)}?job=${esc(jobId)}">Summary and report</a></div>` }).join('')}</section>` }).join('')}</div>
  <p class="hint">Move candidates by changing their status. Candidates see their own status in My Activities.</p>`
}
act('cmp-sel', el => { el.checked ? compareSel.add(el.value) : compareSel.delete(el.value) })
act('cmp-go', el => { if (compareSel.size < 2) return toast('Select at least two candidates to compare', true); go(`#e-compare/${el.dataset.job}?ids=${[...compareSel].join(',')}`) })
act('app-status', async el => {
  const apps = await pipeline(el.dataset.job), a = apps.find(x => String(x.id) === el.dataset.app)
  const patch = { status: el.value }
  if (el.value === 'Assessment Invited' && a.route !== 'applied') patch.invite_response = null
  await setApp(a, patch); toast(`Moved to "${el.value}"`); render()
})

export async function comparePage(jobId, ids) {
  const job = (await allJobs()).find(j => j.id === jobId)
  const cands = (await Promise.all(ids.map(loadCandidate))).filter(Boolean)
  const reqs = [...new Set([...(job.skills || []), ...(job.assessment?.competencies || [])])]
  const cell = (c, k) => { const asd = assessedFor(c, k), { items } = evidenceFor(c, k)
    if (!asd.length && !items.length) return '<span class="none">Missing</span>'
    return `<details><summary>${asd.length ? `${chip('assessed', ' · ' + asd[0].level)}` : chip(items[0].source)}${items.length + asd.length > 1 ? ` <span class="hint">+${items.length + asd.length - 1}</span>` : ''}</summary>
      ${asd.map(a => `<p class="hint">${a.kind === 'group' ? 'Group' : 'Individual'} simulation: ${esc(a.note)}</p>`).join('')}${items.map(e => `<p class="hint">${chip(e.source)} ${esc(e.title)}${e.detail ? ': ' + esc(e.detail) : ''}</p>`).join('')}</details>` }
  const projects = c => c.experiences.filter(e => e.source === 'self' || ['internship', 'work'].includes(e.kind)).map(e => esc(e.title || e.role)).slice(0, 2).join('<br>') || '<span class="none">Missing</span>'
  return `<a href="#e-job/${esc(jobId)}" class="back">← ${esc(job.title)}</a>
  ${head('Compare candidates', esc(job.title), 'Click any cell to see the underlying evidence. Different evidence types are not directly comparable; the label tells you what each one is.')}
  <div class="tablewrap"><table class="cmp"><thead><tr><th>Competency</th>${cands.map(c => `<th>${esc(c.label)}${c.demo ? ' <span class="pill demo">Demo</span>' : ''}</th>`).join('')}</tr></thead><tbody>
    ${reqs.map(k => `<tr><th>${esc(compName(k))}</th>${cands.map(c => `<td>${cell(c, k)}</td>`).join('')}</tr>`).join('')}
    <tr><th>Project experience</th>${cands.map(c => `<td>${projects(c)}</td>`).join('')}</tr>
    <tr><th>Supporting artifacts</th>${cands.map(c => `<td>${c.experiences.some(e => e.evidence_url) ? 'Available' : '<span class="none">None supplied</span>'}</td>`).join('')}</tr>
    <tr><th>Simulations completed</th>${cands.map(c => `<td>${c.assessments.filter(a => a.status === 'submitted').map(a => a.kind).join(', ') || '<span class="none">None</span>'}</td>`).join('')}</tr>
  </tbody></table></div>
  <p class="hint">Achievers supports the decision; it does not make it. No overall score or ranking is produced.</p>`
}

// ======================================================================
// CANDIDATE SUMMARY, ASSESSMENT REPORT, INTERVIEW
// ======================================================================
export async function candidatePage(cid, params) {
  const c = await loadCandidate(cid)
  if (!c) return `<div class="card"><h2>Candidate not available</h2><p class="hint">They may have turned off discoverability.</p></div>`
  const jobs = await allJobs()
  const jobId = params.get('job') || jobs[0].id, job = jobs.find(j => j.id === jobId) || jobs[0]
  const app = (await pipeline(job.id)).find(a => a.cid === cid)
  const reveal = app?.interview?.state === 'accepted'
  const reports = c.assessments.filter(a => a.status === 'submitted')
  return `<a href="${app ? '#e-job/' + esc(job.id) : '#e-discover'}" class="back">← Back</a>
  <div class="grid g2">
   <section class="card">${miniCv(c, job, { reveal })}</section>
   <div class="stack">
    <section class="card stack"><h2>Assessment reports</h2>
      ${reports.length ? reports.map(a => reportHtml(c, a, job)).join('') : '<p class="hint">No completed simulations yet. Invite the candidate to an assessment from the pipeline or Talent Discovery.</p>'}
    </section>
    ${app ? `<section class="card stack"><h2>Interview</h2>
      ${app.interview ? `<div class="kv"><span>Format</span><span>${esc(app.interview.format)}</span><span>When</span><span>${esc(app.interview.when)}</span><span>Candidate response</span><b>${esc(app.interview.state)}</b></div>` : ''}
      <div class="grid g-form"><div><label for="iv-fmt">Format</label><select id="iv-fmt"><option>Video call</option><option>On-site</option><option>Phone</option></select></div><div><label for="iv-when">Date and time</label><input type="datetime-local" id="iv-when"></div></div>
      <div><label for="iv-msg">Message to candidate</label><textarea id="iv-msg" rows="2">We were impressed by your evidence and would like to meet you.</textarea></div>
      <div><label for="iv-notes">Internal evaluation notes <span class="opt">(not shown to the candidate)</span></label><textarea id="iv-notes" rows="2">${esc(app.notes || '')}</textarea></div>
      <div class="row"><button class="primary" data-act="iv-send" data-cid="${esc(cid)}" data-job="${esc(job.id)}">${app.interview ? 'Update invitation' : 'Send interview invitation'}</button><button data-act="notes-save" data-cid="${esc(cid)}" data-job="${esc(job.id)}">Save notes</button></div>
      <p class="hint">A calendar integration can come later. Here the candidate accepts or declines in My Activities.</p>
    </section>` : `<section class="card stack"><h2>Not in a pipeline yet</h2><p class="hint">Use Talent Discovery to invite this candidate to a position or an assessment.</p></section>`}
   </div></div>`
}
function reportHtml(c, a, job) {
  const r = a.result
  return `<article class="report stack">
    <div class="row between"><b>${esc(r.title)}</b><span class="pill">${a.kind === 'group' ? 'Group' : 'Individual'}</span></div>
    <div class="kv"><span>Candidate</span><span>${esc(c.label)}</span><span>Role</span><span>${esc(job.title)}</span><span>Objective result</span><span class="mono">${esc(r.objective || '—')}</span>${r.minutes != null ? `<span>Time used</span><span class="mono">${r.minutes} min</span>` : ''}${a.telemetry ? `<span>Tab changes</span><span class="mono">${a.telemetry.focus_changes || 0} <span class="hint">(context only)</span></span>` : ''}</div>
    <h3>Assessed competencies</h3>
    ${r.competencies.map(x => `<div class="ev"><span class="pill ${x.level === 'strong' ? 'ok' : ''}">${esc(x.level)}</span><p><b>${esc(compName(x.k))}</b> · ${esc(x.note)} <span class="hint">${x.objective === false ? '(awaiting human evaluation)' : '(criteria-based)'}</span></p></div>`).join('')}
    ${r.checks ? `<h3>Written recommendation</h3><blockquote>${esc(r.recommendation)}</blockquote><p class="hint">Automated text checks (assistive, not a grade): ${r.checks.map(([l, ok]) => (ok ? '✓ ' : '✗ ') + l).join('; ')}</p>` : ''}
    ${r.decision ? `<h3>Team decision</h3><p class="hint">Allocation ${r.decision.alloc.join(' / ')} · option: ${esc(r.decision.option)} · "${esc(r.decision.rationale)}"</p>` : ''}
    ${r.note ? `<p class="hint">${esc(r.note)}</p>` : ''}
    <h3>Areas for follow-up</h3>${r.competencies.filter(x => x.level !== 'strong').map(x => `<p class="hint" style="margin:0">· Ask for a specific example of ${esc(compName(x.k).toLowerCase())}.</p>`).join('') || '<p class="hint">None flagged.</p>'}
    <h3>Evaluator comment</h3>
    ${r.review ? `<p style="margin:0">${esc(r.review.comment)} <span class="pill">${esc(r.review.level)}</span> <span class="hint">human evaluation</span></p>` : a.id ? `<div class="grid g-form"><div><label for="rv-l-${a.id}">Communication level</label><select id="rv-l-${a.id}"><option>emerging</option><option selected>developing</option><option>strong</option></select></div></div><textarea id="rv-c-${a.id}" rows="2" aria-label="Comment"></textarea><button data-act="review" data-id="${a.id}">Save human evaluation</button>` : '<p class="hint">Demo report.</p>'}
  </article>`
}
act('review', async el => {
  const id = el.dataset.id, comment = val('rv-c-' + id); if (comment.length < 5) return toast('Write a short comment first', true)
  const a = (await db.list('assessments', { id }))[0]
  await db.update('assessments', id, { result: { ...a.result, review: { comment, level: val('rv-l-' + id), at: new Date().toISOString() } } })
  toast('Human evaluation saved'); render()
})
act('iv-send', async el => {
  const when = val('iv-when'); if (!when) return toast('Choose a date and time', true)
  const app = (await pipeline(el.dataset.job)).find(a => a.cid === el.dataset.cid)
  const interview = { format: val('iv-fmt'), when: new Date(when).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' }), message: val('iv-msg'), state: app.demo ? 'accepted' : 'invited' }
  await setApp(app, { interview, status: 'Interview Scheduled', notes: val('iv-notes') })
  toast(app.demo ? 'Invitation sent (demo candidate accepted automatically)' : 'Interview invitation sent'); render()
})
act('notes-save', async el => { const app = (await pipeline(el.dataset.job)).find(a => a.cid === el.dataset.cid); await setApp(app, { notes: val('iv-notes') }); toast('Notes saved') })

// ======================================================================
// TOPICS + COMPANY
// ======================================================================
export async function topicsAdmin() {
  const topics = (await allTopics()), contribs = await allContributions()
  return `${head('Stage 4 · Connect', 'Marketplace Topics', 'Publish focused professional questions. Browse answers to find people who think the way your team needs.')}${nav('#e-topics')}
  <div class="grid g2">
   <section class="stack">${topics.map(t => { const cs = contribs.filter(c => c.topic_id === t.id && !c.parent_id)
     return `<div class="card stack"><div class="row between"><span class="eyebrow">${esc(t.category)}</span>${t.demo ? demoTag : ''}</div><a href="#topic/${esc(t.id)}"><h3>${esc(t.title)}</h3></a><span class="hint">${cs.length} contribution${cs.length === 1 ? '' : 's'}</span>
       ${cs.slice(0, 3).map(c => `<div class="ev">${chip('contribution')}<p><a href="#e-cand/${esc(c.user_id)}">${esc(c.author_label || anonId(c.user_id))}</a> · ${esc(c.idea)}</p></div>`).join('')}</div>` }).join('')}</section>
   <section class="card stack"><h2>Create a topic</h2>
     <div><label for="tp-title">Topic title</label><input type="text" id="tp-title"></div>
     <div><label for="tp-cat">Category</label><select id="tp-cat">${CATEGORIES.map(c => `<option>${c}</option>`).join('')}</select></div>
     <div><label for="tp-desc">Description and context</label><textarea id="tp-desc" rows="3"></textarea></div>
     <fieldset><legend>Relevant skills</legend><div class="checks">${COMPETENCIES.map(c => `<label><input type="checkbox" name="tp-sk" value="${c.k}"><span>${c.n}</span></label>`).join('')}</div></fieldset>
     <div class="grid g-form"><div><label for="tp-pub">Publisher</label><input type="text" id="tp-pub" value="${esc(company().name)}"></div><div><label for="tp-dead">Deadline <span class="opt">(optional)</span></label><input type="date" id="tp-dead"></div></div>
     <div><label for="tp-ref">Reference material <span class="opt">(optional)</span></label><input type="text" id="tp-ref"></div>
     <div class="row"><button class="primary" data-act="topic-create">Publish topic</button></div><p class="status" id="tpst"></p>
   </section></div>`
}
act('topic-create', async el => {
  const t = { created_by: db.me(), title: val('tp-title'), category: val('tp-cat'), description: val('tp-desc'), skills: $$('input[name=tp-sk]:checked').map(i => i.value), publisher: val('tp-pub'), deadline: val('tp-dead') || null, reference: val('tp-ref') }
  if (!t.title || !t.description) return status('#tpst', 'Add a title and description.', true)
  el.disabled = true
  try { await db.insert('topics', t); toast('Topic published to the Marketplace'); render() } catch (e) { status('#tpst', 'Could not publish: ' + esc(e.message), true); el.disabled = false }
})

export function companyPage() {
  const c = company()
  const f = (id, l, v, opt) => `<div><label for="${id}">${l}${opt ? ' <span class="opt">(optional)</span>' : ''}</label><input type="text" id="${id}" value="${esc(v || '')}"></div>`
  return `${head('Stage 4 · Connect', 'Company Profile')}${nav('#e-company')}
  <section class="card stack" style="max-width:720px">
    ${f('co-name', 'Company name', c.name)}${f('co-ind', 'Industry', c.industry)}
    <div><label for="co-desc">Company description</label><textarea id="co-desc" rows="3">${esc(c.description)}</textarea></div>
    ${f('co-contact', 'Recruiter contact email', c.contact)}${f('co-web', 'Website', c.website, 1)}${f('co-loc', 'Office locations', c.locations, 1)}${f('co-focus', 'Recruitment focus', c.focus, 1)}${f('co-grad', 'Graduate development opportunities', c.graduate, 1)}
    <div class="row"><button class="primary" data-act="co-save">Save company profile</button></div>
    <p class="hint">ATS integration (Greenhouse, Lever, Workday) is optional and not required to start. Employers can use this dashboard directly.</p>
  </section>`
}
act('co-save', async () => {
  const company = { name: val('co-name'), industry: val('co-ind'), description: val('co-desc'), contact: val('co-contact'), website: val('co-web'), locations: val('co-loc'), focus: val('co-focus'), graduate: val('co-grad') }
  if (!company.name || !company.industry) return toast('Company name and industry are required', true)
  await db.saveProfile({ company }); S.profile.company = company; toast('Company profile saved')
})
