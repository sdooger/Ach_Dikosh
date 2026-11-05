// PART 3 — Apply & Demonstrate: jobs, applications, individual and group simulations
import * as db from './db.js'
import { S, loadMe } from './state.js'
import { $, $$, esc, val, act, go, render, toast, status, spin, head, compName, fmtDate, demoTag } from './ui.js'
import { COMP, GROUP } from './demo.js'
import { loadCandidate, allJobs, miniCv } from './summary.js'

const LEVEL = { emerging: 1, developing: 2, strong: 3 }
const lvl = f => f >= .75 ? 'strong' : f >= .4 ? 'developing' : 'emerging'
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
const money = n => '$' + Math.round(n).toLocaleString('en-CA')
const canStart = a => a && ['Assessment Invited', 'Assessment in Progress', 'Assessment Completed'].includes(a.status) && (a.route !== 'invited' || a.invite_response === 'accepted')

// ======================================================================
// JOBS & APPLICATIONS
// ======================================================================
export async function applyPage() {
  await loadMe()
  const jobs = await allJobs()
  const appFor = id => S.applications.find(a => a.job_id === id)
  const pending = S.applications.filter(a => a.route === 'invited' && !a.invite_response)
  return `${head('Stage 3 · Apply & Demonstrate', 'Opportunities', 'Apply to a role, or accept an employer invitation. Job-specific simulations start from here and are separate from your registration questionnaires.')}
  ${pending.map(a => { const j = jobs.find(x => x.id === a.job_id); return `<div class="banner"><span><b>${esc(j?.company || 'An employer')}</b> invited you to the assessment for ${esc(j?.title || 'a role')}.</span><span class="row"><button class="primary" data-act="inv-answer" data-id="${a.id}" data-v="accepted">Accept</button><button data-act="inv-answer" data-id="${a.id}" data-v="declined">Decline</button></span></div>` }).join('')}
  <div class="grid g2">${jobs.map(j => { const a = appFor(j.id)
    return `<article class="card stack"><div class="row between"><span class="eyebrow">${esc(j.company)}</span>${a ? `<span class="pill ok">${esc(a.status)}</span>` : j.demo ? demoTag : ''}</div>
      <h3>${esc(j.title)}</h3><span class="hint">${esc(j.location)} · ${esc(j.employment_type)}${j.deadline ? ' · apply by ' + fmtDate(j.deadline) : ''}</span>
      <div class="row">${(j.skills || []).map(k => `<span class="pill">${esc(compName(k))}</span>`).join('')}</div>
      <div class="row"><a class="btn ${a ? '' : 'primary'}" href="#job/${esc(j.id)}">${a ? 'View application' : 'View and apply'}</a>
      ${canStart(a) ? `<a class="btn primary" href="#challenge/${a.id}">Individual simulation</a>${j.assessment?.group ? `<a class="btn" href="#group/${a.id}">Group simulation</a>` : ''}` : ''}</div>
    </article>` }).join('')}</div>`
}

export async function jobPage(id) {
  const job = (await allJobs()).find(j => j.id === id)
  if (!job) return `<div class="card"><h2>Role not found</h2><a href="#apply">Back</a></div>`
  await loadMe()
  const a = S.applications.find(x => x.job_id === id)
  const me = await loadCandidate(db.me())
  const asmt = job.assessment || {}
  return `<a href="#apply" class="back">← Opportunities</a>
  ${head(esc(job.company), esc(job.title), esc(job.location + ' · ' + job.employment_type))}
  <div class="grid g2">
   <section class="card stack"><p style="margin:0">${esc(job.description)}</p>
     <h3>Qualifications</h3><p style="margin:0">${esc(job.qualifications)}</p>
     <h3>Competencies this role asks you to show</h3><div class="row">${job.skills.map(k => `<span class="pill">${esc(compName(k))}</span>`).join('')}</div>
     <h3>Assessment</h3><p style="margin:0">${asmt.format === 'group' ? 'Group challenge' : 'Individual short simulation'} (about ${asmt.duration || 20} minutes)${asmt.group && asmt.format !== 'group' ? ' plus a group simulation' : ''}, after initial screening.</p>
     ${job.deadline ? `<p class="hint">Apply by ${fmtDate(job.deadline)}</p>` : ''}
     ${a ? `<div class="banner"><span>Status: <b>${esc(a.status)}</b></span>${canStart(a) ? `<span class="row"><a class="btn primary" href="#challenge/${a.id}">Individual simulation</a>${asmt.group ? `<a class="btn" href="#group/${a.id}">Group simulation</a>` : ''}</span>` : ''}</div>`
       : `<div class="row"><button class="primary" data-act="apply" data-id="${esc(id)}" ${me && S.evidence.length ? '' : 'disabled'}>Submit application</button></div>${S.evidence.length ? '' : '<p class="hint">Build your Skill Fingerprint before applying.</p>'}<p class="status" id="apst"></p>`}
   </section>
   <section class="card">${me ? miniCv(me, job) : ''}<p class="hint">This is exactly what the employer sees first. Edit your profile to change it.</p></section>
  </div>`
}
act('apply', async el => {
  el.disabled = true
  try {
    await db.insert('applications', { job_id: el.dataset.id, candidate_id: db.me(), route: 'applied', status: 'Application Received' })
    await loadMe(); toast('Application submitted'); render()
  } catch (e) { status('#apst', 'Could not apply: ' + esc(e.message), true); el.disabled = false }
})

// ======================================================================
// INDIVIDUAL SIMULATION — Junior Business Analyst: revenue up, profit down
// ======================================================================
const INDICATORS = [['mix', 'Gross margin by product category', true], ['cac', 'Customer acquisition cost', true], ['opex', 'Operating expenses', false], ['returns', 'Returns and refunds rate', false], ['traffic', 'Website traffic', false], ['aov', 'Average order value', false]]
const DRIVERS = [['mix', 'Sales shifted toward low-margin promotional products', true], ['cac', 'Acquiring each new customer became more expensive', true], ['opex', 'Operating expenses rose sharply', false], ['returns', 'Returns increased significantly', false], ['traffic', 'Fewer people visited the website', false]]
const ACTIONS = [['pricing', 'Review pricing and promotions in the low-margin category'], ['channels', 'Shift marketing spend to channels with lower acquisition cost'], ['ads', 'Buy more ads to grow website traffic'], ['staff', 'Cut operating staff by 10%']]
const BEST_ORDER = ['pricing', 'channels', 'ads', 'staff']

export function makeScenario(seed, context = 'Retail') {
  const R = rng(seed)
  const names = ['Northwind Outfitters', 'Cedar & Pine Home', 'Prairie Pantry Online', 'Lakeshore Electronics']
  const name = names[Math.floor(R() * names.length)]
  const rev0 = Math.round((8 + R() * 6) * 1e6), growth = .12 + R() * .08, rev1 = rev0 * (1 + growth)
  const shareB0 = .14 + R() * .04, shareB1 = .32 + R() * .06, mA = .44 + R() * .04, mB = .1 + R() * .04
  const gp0 = rev0 * ((1 - shareB0) * mA + shareB0 * mB), gp1 = rev1 * ((1 - shareB1) * mA + shareB1 * mB)
  const cac0 = 16 + R() * 4, cac1 = cac0 * (1.4 + R() * .2), newCust0 = 60000 + R() * 15000, newCust1 = newCust0 * (1.15 + R() * .1)
  const mkt0 = cac0 * newCust0, mkt1 = cac1 * newCust1, opex0 = rev0 * (.24 + R() * .02), opex1 = opex0 * (1.02 + R() * .02)
  const op0 = gp0 - mkt0 - opex0, op1 = gp1 - mkt1 - opex1
  return { seed, name, context, rev0, rev1, growth, gp0, gp1, op0, op1, shareB0, shareB1, mA, mB, cac0, cac1, mkt0, mkt1, opex0, opex1,
    ret0: .061 + R() * .005, ret1: .064 + R() * .005, traffic0: 2.1e6 + R() * 3e5, aov0: 82 + R() * 10 }
}
function indicatorData(s, k) {
  const pct = v => (v * 100).toFixed(1) + '%'
  return {
    mix: `Core range: margin ${pct(s.mA)}. Promotional range: margin ${pct(s.mB)}. Promotional share of sales went from ${pct(s.shareB0)} to ${pct(s.shareB1)}.`,
    cac: `Cost to acquire a new customer rose from ${money(s.cac0)} to ${money(s.cac1)}. Marketing spend: ${money(s.mkt0)} → ${money(s.mkt1)}.`,
    opex: `Operating expenses: ${money(s.opex0)} → ${money(s.opex1)} (+${((s.opex1 / s.opex0 - 1) * 100).toFixed(1)}%).`,
    returns: `Returns rate: ${pct(s.ret0)} → ${pct(s.ret1)}.`,
    traffic: `Website visits: ${(s.traffic0 / 1e6).toFixed(2)}M → ${(s.traffic0 * 1.09 / 1e6).toFixed(2)}M.`,
    aov: `Average order value: ${money(s.aov0)} → ${money(s.aov0 * .97)}.`,
  }[k]
}

async function getApp(appId) {
  const app = S.applications.find(a => a.id === appId)
  const job = app && (await allJobs()).find(j => j.id === app.job_id)
  return { app, job }
}
async function getOrStart(app, job, kind) {
  let x = S.assessments.find(a => a.application_id === app.id && a.kind === kind)
  if (!x) {
    const seed = Math.floor(Math.random() * 1e9)
    x = await db.insert('assessments', { user_id: db.me(), application_id: app.id, job_id: app.job_id, kind, scenario: kind === 'individual' ? makeScenario(seed, job.assessment?.context) : { seed, started: Date.now() }, answers: {}, telemetry: { focus_changes: 0, started: Date.now() }, status: 'in_progress' })
    if (app.status === 'Assessment Invited') await db.update('applications', app.id, { status: 'Assessment in Progress', updated_at: new Date().toISOString() })
    await loadMe()
    x = S.assessments.find(a => a.id === x.id) || x
  }
  return x
}

let cur = null           // assessment being taken
let timer = null
function startTimer(minutes) {
  clearInterval(timer)
  timer = setInterval(() => {
    const el = $('#timer'); if (!el || !cur) return clearInterval(timer)
    const left = Math.max(0, minutes * 60 - Math.floor((Date.now() - cur.telemetry.started) / 1000))
    el.textContent = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`
    el.classList.toggle('late', left < 120)
  }, 1000)
}
document.addEventListener('visibilitychange', () => { if (document.hidden && cur && cur.status !== 'submitted') { cur.telemetry.focus_changes = (cur.telemetry.focus_changes || 0) + 1 } })

const rules = minutes => `<details class="rules"><summary>Instructions and rules</summary><ul>
  <li>About ${minutes} minutes. The timer is a guide; you can still submit after it ends, and the time used is recorded.</li>
  <li>Your progress is saved when you press Save or move to the next step.</li>
  <li>Allowed: calculator and your own notes. Not allowed: AI assistants or help from other people for the written answers.</li>
  <li>The page records start and submission times and how often you leave this tab. Leaving the tab is not treated as misconduct on its own.</li>
  <li>Scenario values are randomised for each candidate. The underlying task is the same for everyone.</li></ul></details>`

export async function challengePage(appId) {
  const { app, job } = await getApp(appId)
  if (!app) return `<div class="card"><h2>No application found</h2><a href="#apply">Back to opportunities</a></div>`
  if (!canStart(app)) return `<div class="card stack"><h2>Not available yet</h2><p>The simulation opens after the employer invites you and you accept. Current status: ${esc(app.status)}.</p><a href="#apply">Back</a></div>`
  cur = await getOrStart(app, job, 'individual')
  if (cur.status === 'submitted') return individualResult(cur, job)
  const s = cur.scenario, A = cur.answers || {}, minutes = job.assessment?.duration || 20
  const step = A.step || 1
  startTimer(minutes)
  const pct = v => (v * 100).toFixed(1) + '%'
  return `<div class="head"><div><div class="eyebrow">Simulation · ${esc(job.title)}</div><h1>Revenue is up. Profit is down.</h1></div><div class="row"><span class="timer mono" id="timer">--:--</span></div></div>
  ${rules(minutes)}
  <div class="grid g2">
   <section class="card stack"><h2>Scenario</h2>
     <p style="margin:0">You have joined ${esc(s.name)}, an online ${esc(s.context.toLowerCase())} business, as a junior analyst. The CEO is puzzled: revenue grew ${pct(s.growth)} this year, but operating profit fell. She wants your view by the end of the day.</p>
     <div class="tablewrap"><table class="dash"><thead><tr><th>Indicator</th><th>Last year</th><th>This year</th></tr></thead><tbody>
       <tr><td>Revenue</td><td class="mono">${money(s.rev0)}</td><td class="mono">${money(s.rev1)}</td></tr>
       <tr><td>Gross profit</td><td class="mono">${money(s.gp0)}</td><td class="mono">${money(s.gp1)}</td></tr>
       <tr><td>Marketing spend</td><td class="mono">${money(s.mkt0)}</td><td class="mono">${money(s.mkt1)}</td></tr>
       <tr><td>Operating expenses</td><td class="mono">${money(s.opex0)}</td><td class="mono">${money(s.opex1)}</td></tr>
       <tr><th>Operating profit</th><th class="mono">${money(s.op0)}</th><th class="mono">${money(s.op1)}</th></tr></tbody></table></div>
     <p class="hint">Simplified, fictional data. Scenario #${s.seed % 10000}.</p>
   </section>
   <section class="card stack">
     <h2>1. What would you investigate?</h2><p class="hint">Choose up to three indicators. You will get more detail on the ones you choose.</p>
     <div class="checks">${INDICATORS.map(([k, n]) => `<label><input type="checkbox" name="ind" value="${k}" ${(A.investigate || []).includes(k) ? 'checked' : ''} ${step > 1 ? 'disabled' : ''}><span>${n}</span></label>`).join('')}</div>
     ${step === 1 ? `<div class="row"><button class="primary" data-act="ch-next" data-step="2">Get the detail</button></div>` : ''}
     ${step >= 2 ? `<div class="scenario"><b>Additional information</b>${(A.investigate || []).map(k => `<p style="margin:6px 0 0">${indicatorData(s, k)}</p>`).join('')}</div>
       <h2>2. What are the likely drivers?</h2><p class="hint">Select all that the data supports.</p>
       <div class="checks">${DRIVERS.map(([k, n]) => `<label><input type="checkbox" name="drv" value="${k}" ${(A.drivers || []).includes(k) ? 'checked' : ''} ${step > 2 ? 'disabled' : ''}><span>${n}</span></label>`).join('')}</div>
       ${step === 2 ? `<div class="row"><button class="primary" data-act="ch-next" data-step="3">Continue</button></div>` : ''}` : ''}
     ${step >= 3 ? `<h2>3. Prioritise</h2><p class="hint">Rank the actions from 1 (do first) to 4 (do last).</p>
       ${ACTIONS.map(([k, n]) => `<div class="rank"><label for="rk-${k}">${n}</label><select id="rk-${k}" ${step > 3 ? 'disabled' : ''}>${[1, 2, 3, 4].map(i => `<option ${(A.rank || {})[k] == i ? 'selected' : ''}>${i}</option>`).join('')}</select></div>`).join('')}
       ${step === 3 ? `<div class="row"><button class="primary" data-act="ch-next" data-step="4">Continue</button></div>` : ''}` : ''}
     ${step >= 4 ? `<h2>4. Your recommendation</h2>
       <div><label for="rec">What do you recommend to the CEO, and why? Use the numbers.</label><textarea id="rec" rows="6">${esc(A.recommendation || '')}</textarea></div>
       <div class="row"><button data-act="ch-save">Save progress</button><button class="primary" data-act="ch-submit">Submit simulation</button></div>` : ''}
     <p class="status" id="chst"></p>
   </section></div>`
}
async function saveAnswers(patch) { cur.answers = { ...cur.answers, ...patch }; await db.update('assessments', cur.id, { answers: cur.answers, telemetry: cur.telemetry }) }
act('ch-next', async el => {
  const to = +el.dataset.step
  if (to === 2) { const v = $$('input[name=ind]:checked').map(i => i.value); if (!v.length || v.length > 3) return status('#chst', 'Choose one to three indicators.', true); await saveAnswers({ investigate: v, step: 2 }) }
  if (to === 3) { const v = $$('input[name=drv]:checked').map(i => i.value); if (!v.length) return status('#chst', 'Select at least one driver.', true); await saveAnswers({ drivers: v, step: 3 }) }
  if (to === 4) { const r = Object.fromEntries(ACTIONS.map(([k]) => [k, +val('rk-' + k)])); if (new Set(Object.values(r)).size !== 4) return status('#chst', 'Use each rank 1 to 4 once.', true); await saveAnswers({ rank: r, step: 4 }) }
  toast('Progress saved'); render()
})
act('ch-save', async () => { await saveAnswers({ recommendation: val('rec') }); toast('Progress saved') })
act('ch-submit', async el => {
  const rec = val('rec'); if (rec.length < 60) return status('#chst', 'Write at least a few sentences for your recommendation.', true)
  el.disabled = true; await saveAnswers({ recommendation: rec })
  const A = cur.answers
  const inv = INDICATORS.filter(([k, , key]) => key && A.investigate.includes(k)).length            // 0-2
  const drv = Math.max(0, DRIVERS.filter(([k, , ok]) => ok && A.drivers.includes(k)).length - DRIVERS.filter(([k, , ok]) => !ok && A.drivers.includes(k)).length) // 0-2
  const order = Object.entries(A.rank).sort((a, b) => a[1] - b[1]).map(([k]) => k)
  const pri = (order[0] === 'pricing' || order[0] === 'channels' ? 2 : 0) + (order[3] === 'staff' ? 1 : 0)     // 0-3
  const checks = [
    ['Uses figures from the data', /\d/.test(rec)],
    ['Addresses the product mix or margin', /mix|margin|categor|promot|low-margin/i.test(rec)],
    ['Addresses acquisition cost or marketing', /acquisi|cac|marketing|channel/i.test(rec)],
    ['States a clear recommendation', /recommend|should|propose|suggest/i.test(rec)],
    ['Names a risk or trade-off', /risk|trade|however|but |downside|might/i.test(rec)],
  ]
  const met = checks.filter(c => c[1]).length
  const comps = [
    { k: 'analytical', level: lvl((inv + drv) / 4), note: `Chose ${inv} of 2 key indicators; identified ${DRIVERS.filter(([k, , ok]) => ok && A.drivers.includes(k)).length} of 2 drivers${A.drivers.some(d => !DRIVERS.find(x => x[0] === d)[2]) ? ' and one unsupported driver' : ''}.`, objective: true },
    { k: 'decision', level: lvl(pri / 3), note: `Ranked "${ACTIONS.find(a => a[0] === order[0])[1].toLowerCase()}" first and "${ACTIONS.find(a => a[0] === order[3])[1].toLowerCase()}" last.`, objective: true },
    { k: 'problem', level: lvl((drv + (met >= 3 ? 2 : met >= 2 ? 1 : 0)) / 4), note: 'Linked identified drivers to proposed actions.', objective: true },
    { k: 'communication', level: 'pending', note: `Written recommendation awaiting human review. Automated text checks met ${met} of ${checks.length} criteria.`, objective: false },
  ]
  const result = { title: 'Profit decline simulation', objective: `${inv + drv + pri} / 7`, competencies: comps, checks, minutes: Math.round((Date.now() - cur.telemetry.started) / 60000), recommendation: rec }
  await db.update('assessments', cur.id, { status: 'submitted', result, submitted_at: new Date().toISOString(), telemetry: cur.telemetry })
  await addAssessedEvidence(cur, comps.filter(c => c.objective), 'Simulation: ' + result.title)
  await maybeComplete(cur.application_id)
  await loadMe(); toast('Simulation submitted · results added to your Skill Fingerprint'); render()
})
async function addAssessedEvidence(a, comps, title) {
  await db.removeWhere('evidence', { user_id: db.me(), ref: 'assess:' + a.id })
  await db.insertMany('evidence', comps.filter(c => COMP[c.k]).map(c => ({ user_id: db.me(), skill_id: COMP[c.k].o, source: 'assessed', title, detail: c.note, level: LEVEL[c.level] || 1, ref: 'assess:' + a.id })))
}
async function maybeComplete(appId) {
  await loadMe()
  const app = S.applications.find(a => a.id === appId), job = (await allJobs()).find(j => j.id === app.job_id)
  const need = job.assessment?.format === 'group' ? ['group'] : job.assessment?.group ? ['individual', 'group'] : ['individual']
  const done = need.every(k => S.assessments.some(x => x.application_id === appId && x.kind === k && x.status === 'submitted'))
  if (done) await db.update('applications', appId, { status: 'Assessment Completed', updated_at: new Date().toISOString() })
}
function resultCard(x, job) {
  const r = x.result
  const strengths = r.competencies.filter(c => c.level === 'strong'), dev = r.competencies.filter(c => c.level === 'emerging' || c.level === 'developing')
  return `<div class="grid g2">
   <section class="card stack"><div class="row between"><h2>Completed</h2><span class="pill ok">Submitted ${fmtDate(x.submitted_at)}</span></div>
     <p style="margin:0">${esc(r.title)} for ${esc(job?.title || '')}. Time used: ${r.minutes ?? '–'} min.</p>
     <h3>Competencies assessed</h3>
     ${r.competencies.map(c => `<div class="ev"><span class="pill ${c.level === 'strong' ? 'ok' : ''}">${esc(c.level)}</span><p><b>${esc(compName(c.k))}</b> · ${esc(c.note)}</p></div>`).join('')}
     ${r.review ? `<div class="scenario"><b>Evaluator comment</b><p style="margin:4px 0 0">${esc(r.review.comment)} (communication: ${esc(r.review.level)})</p></div>` : ''}
   </section>
   <section class="card stack"><h2>Feedback</h2>
     <h3>Observable strengths</h3>${strengths.length ? strengths.map(c => `<p style="margin:0">· ${esc(c.note)}</p>`).join('') : '<p class="hint">No competency reached the strong band in this attempt.</p>'}
     <h3>Development opportunities</h3>${dev.length ? dev.map(c => `<p style="margin:0">· ${esc(compName(c.k))}: ${esc(c.note)}</p>`).join('') : '<p class="hint">None flagged.</p>'}
     <h3>Added to your Skill Fingerprint</h3><p style="margin:0">${r.competencies.filter(c => c.objective !== false && c.level !== 'pending').map(c => esc(compName(c.k))).join(', ')} (labelled "Assessed"). Results awaiting human review are added only after review.</p>
     <div class="row"><a class="btn primary" href="#discover">See my fingerprint</a><a class="btn" href="#apply">Back to opportunities</a></div>
   </section></div>`
}
function individualResult(x, job) { clearInterval(timer); return `${head('Simulation result', esc(job?.title || ''))}${resultCard(x, job)}` }

// ======================================================================
// GROUP SIMULATION — supply chain disruption
// ======================================================================
let gTimers = []
let gx = null
export async function groupPage(appId) {
  const { app, job } = await getApp(appId)
  if (!app) return `<div class="card"><h2>No application found</h2><a href="#apply">Back</a></div>`
  if (!canStart(app)) return `<div class="card stack"><h2>Not available yet</h2><p>Current status: ${esc(app.status)}.</p><a href="#apply">Back</a></div>`
  gx = await getOrStart(app, job, 'group'); cur = gx
  if (gx.status === 'submitted') { gTimers.forEach(clearTimeout); return `${head('Group simulation result', esc(GROUP.title))}${resultCard(gx, job)}` }
  const A = gx.answers || {}, msgs = A.messages || []
  const minutes = 15
  startTimer(minutes); scheduleBots()
  const alloc = A.alloc || {}
  return `<div class="head"><div><div class="eyebrow">Group simulation · ${esc(job.title)}</div><h1>${esc(GROUP.title)}</h1></div><div class="row"><span class="timer mono" id="timer">--:--</span></div></div>
  ${rules(minutes)}
  <div class="banner"><span>Participants: <b>You</b>, Alex (demo applicant), Priya (Northline employee, demo). The other participants are scripted for this demonstration.</span></div>
  <div class="grid g2">
   <section class="stack">
    <div class="card stack"><h2>Scenario</h2><p style="margin:0">${esc(GROUP.context)}</p>
      <div class="tablewrap"><table class="dash"><thead><tr><th>Customer group</th><th>Normal monthly demand</th></tr></thead><tbody>${GROUP.segments.map(([n, d]) => `<tr><td>${esc(n)}</td><td class="mono">${d}</td></tr>`).join('')}<tr><th>Available this month</th><th class="mono">600</th></tr></tbody></table></div></div>
    <div class="card stack"><h2>Team decision</h2>
      ${GROUP.segments.map(([n], i) => `<div class="rank"><label for="al-${i}">${esc(n)}</label><input type="number" min="0" step="10" id="al-${i}" value="${alloc[i] ?? ''}" data-change="g-alloc"></div>`).join('')}
      <p class="mono hint" id="altot"></p>
      <fieldset><legend>Mitigation</legend><div class="opts" style="flex-direction:column">${GROUP.options.map(([k, n]) => `<label><input type="radio" name="gopt" value="${k}" ${A.option === k ? 'checked' : ''} data-change="g-alloc"><span>${esc(n)}</span></label>`).join('')}</div></fieldset>
      <div><label for="grat">Team rationale</label><textarea id="grat" rows="3">${esc(A.rationale || '')}</textarea></div>
      <div class="row"><button class="primary" data-act="g-submit">Submit team decision</button></div><p class="status" id="gst"></p>
    </div>
   </section>
   <section class="card stack chat"><h2>Team discussion</h2>
     <div class="msgs" id="msgs" aria-live="polite">${msgs.map(msgHtml).join('') || '<p class="hint">The discussion starts in a few seconds.</p>'}</div>
     <div class="grid g-form"><div><label for="mtype">Message type</label><select id="mtype"><option value="proposal">Proposal</option><option value="response">Response</option><option value="question">Question</option><option value="agreement">Agreement</option></select></div>
     <div><label for="mreply">Responding to <span class="opt">(optional)</span></label><select id="mreply"><option value="">—</option>${msgs.filter(m => m.who !== 'You').map((m, i) => `<option value="${m.id}">${esc(m.who.split(' ')[0])}: ${esc(m.text.slice(0, 40))}…</option>`).join('')}</select></div></div>
     <label for="mtext" class="sr">Message</label><textarea id="mtext" rows="3" placeholder="Propose, respond, explain your reasoning…"></textarea>
     <div class="row"><button class="primary" data-act="g-send">Send</button></div>
   </section></div>`
}
const msgHtml = m => `<div class="msg ${m.who === 'You' ? 'me' : ''}"><div class="row between"><b>${esc(m.who)}</b><span class="pill">${esc(m.type)}</span></div>${m.replyTo ? `<p class="hint">↳ responding to ${esc(m.replyToWho || '')}</p>` : ''}<p>${esc(m.text)}</p></div>`
async function pushMsg(m) {
  if (!gx || gx.status === 'submitted') return
  const msgs = [...(gx.answers.messages || []), { id: crypto.randomUUID().slice(0, 8), t: Math.round((Date.now() - gx.telemetry.started) / 1000), ...m }]
  gx.answers = { ...gx.answers, messages: msgs }
  await db.update('assessments', gx.id, { answers: gx.answers })
  if (location.hash.startsWith('#group/')) { const box = $('#msgs'); if (box) { box.innerHTML = msgs.map(msgHtml).join(''); box.scrollTop = box.scrollHeight }
    const sel = $('#mreply'); if (sel) { const v = sel.value; sel.innerHTML = '<option value="">—</option>' + msgs.filter(x => x.who !== 'You').map(x => `<option value="${x.id}">${esc(x.who.split(' ')[0])}: ${esc(x.text.slice(0, 40))}…</option>`).join(''); sel.value = v } }
}
function scheduleBots() {
  gTimers.forEach(clearTimeout); gTimers = []
  const sent = new Set((gx.answers.messages || []).map(m => m.bot))
  const elapsed = (Date.now() - gx.telemetry.started) / 1000
  GROUP.bots.forEach((b, i) => {
    if (sent.has(i) || b.at === 'reply') return
    gTimers.push(setTimeout(() => pushMsg({ who: b.name, type: b.type, text: b.text, bot: i }), Math.max(1, b.at - elapsed) * 1000))
  })
}
act('g-send', async () => {
  const text = val('mtext'); if (text.length < 3) return
  const rid = val('mreply'), target = (gx.answers.messages || []).find(m => m.id === rid)
  await pushMsg({ who: 'You', type: val('mtype'), text, replyTo: rid || null, replyToWho: target?.who.split(' ')[0] || '' })
  $('#mtext').value = ''
  const bi = GROUP.bots.findIndex(b => b.at === 'reply')
  if (!(gx.answers.messages || []).some(m => m.bot === bi)) gTimers.push(setTimeout(() => pushMsg({ who: GROUP.bots[bi].name, type: GROUP.bots[bi].type, text: GROUP.bots[bi].text, bot: bi, replyTo: 'you', replyToWho: 'You' }), 3000))
})
act('g-alloc', () => {
  const tot = GROUP.segments.reduce((a, _, i) => a + (Number(val('al-' + i)) || 0), 0)
  const cap = 600 + (document.querySelector('input[name=gopt]:checked')?.value === 'air' ? 150 : 0)
  const el = $('#altot'); if (el) { el.textContent = `Allocated ${tot} of ${cap} units`; el.className = 'mono ' + (tot > cap ? 'status err' : 'hint') }
})
act('g-submit', async el => {
  const alloc = GROUP.segments.map((_, i) => Number(val('al-' + i)) || 0), option = document.querySelector('input[name=gopt]:checked')?.value, rationale = val('grat')
  const cap = 600 + (option === 'air' ? 150 : 0), tot = alloc.reduce((a, b) => a + b, 0)
  if (!option) return status('#gst', 'Choose a mitigation option.', true)
  if (tot > cap) return status('#gst', `The allocation (${tot}) exceeds available units (${cap}).`, true)
  if (rationale.length < 30) return status('#gst', 'Write the team rationale in a sentence or two.', true)
  el.disabled = true
  const mine = (gx.answers.messages || []).filter(m => m.who === 'You'), others = (gx.answers.messages || []).filter(m => m.who !== 'You')
  const reason = /because|so that|since|as a result|which means|otherwise|to keep|to protect/i
  const firstBotProposal2 = others.find(m => m.bot === 3)
  const criteria = [
    { k: 'communication', label: 'Proposed at least one option and explained the reason', met: mine.some(m => m.type === 'proposal' && reason.test(m.text)) },
    { k: 'collaboration', label: "Responded directly to a teammate's idea", met: mine.some(m => m.replyTo || m.type === 'response') },
    { k: 'collaboration', label: "Final rationale builds on a teammate's point (retail communication or air freight)", met: /retail|tell|inform|communicat|air/i.test(rationale) },
    { k: 'decision', label: 'Named a trade-off explicitly (cost, delay, who is protected)', met: [...mine.map(m => m.text), rationale].some(t => /cost|trade|delay|instead|sacrific|protect|priorit/i.test(t)) },
    { k: 'decision', label: 'Allocation fits the available stock and is explained', met: tot <= cap && tot >= cap * .9 },
    { k: 'initiative', label: 'Put forward a proposal before the team converged', met: mine.some(m => m.type === 'proposal' && (!firstBotProposal2 || m.t < firstBotProposal2.t)) },
  ]
  const comps = ['communication', 'collaboration', 'decision', 'initiative'].map(k => { const cs = criteria.filter(c => c.k === k); const n = cs.filter(c => c.met).length
    return { k, level: lvl(n / cs.length), note: cs.map(c => (c.met ? '✓ ' : '✗ ') + c.label).join('; '), objective: true } })
  const result = { title: GROUP.title, objective: `${criteria.filter(c => c.met).length} / ${criteria.length} criteria`, competencies: comps, criteria, decision: { alloc, option, rationale }, counts: { yours: mine.length, total: (gx.answers.messages || []).length }, minutes: Math.round((Date.now() - gx.telemetry.started) / 60000),
    note: 'Illustrative criteria. Production scoring needs an expert rubric and human evaluators. Message counts are context only and are not used to label leadership or personality.' }
  gx.answers = { ...gx.answers, alloc, option, rationale }
  await db.update('assessments', gx.id, { status: 'submitted', result, answers: gx.answers, submitted_at: new Date().toISOString(), telemetry: gx.telemetry })
  await addAssessedEvidence(gx, comps, 'Group simulation: ' + GROUP.title)
  gTimers.forEach(clearTimeout)
  await maybeComplete(gx.application_id)
  await loadMe(); toast('Team decision submitted · results added to your Skill Fingerprint'); render()
})
export function leaveChallenge() { gTimers.forEach(clearTimeout); clearInterval(timer); cur = null }
