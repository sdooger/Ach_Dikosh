// Candidate data as an employer sees it, and the standardized anonymous mini-CV
import * as db from './db.js'
import { esc, chip, anonId, compName, skillName } from './ui.js'
import { skillLevel } from './match.js'
import { COMP, DEMO_CANDIDATES, DEMO_CONTRIBUTIONS, DEMO_JOBS } from './demo.js'

const LEVEL = { emerging: 1, developing: 2, strong: 3 }

// Load one candidate (real or demo) in a common shape
export async function loadCandidate(id) {
  const d = DEMO_CANDIDATES.find(c => c.id === id)
  if (d) return {
    id, label: d.label, demo: true, field: d.field, education: d.education, interests: d.interests, discoverable: d.discoverable,
    experiences: d.experiences, evidence: d.evidence,
    assessments: d.assessments.map(a => ({ kind: a.kind, status: 'submitted', result: { title: a.title, objective: a.objective, competencies: a.results.map(([k, level, note]) => ({ k, level, note })) } })),
    contributions: DEMO_CONTRIBUTIONS.filter(c => c.user_id === id), name: null,
  }
  const [p, experiences, evidence, assessments, contributions] = await Promise.all([
    db.getProfile(id), db.list('experiences', { user_id: id }), db.list('evidence', { user_id: id }),
    db.list('assessments', { user_id: id }), db.list('contributions', { user_id: id }),
  ])
  if (!p) return null
  // In browser-only mode there is no server-side privacy, so apply the same rule here
  const shared = db.currentMode() === 'guest' && !p.share_assessments ? evidence.filter(e => !e.sensitive) : evidence
  const edu = experiences.find(e => e.kind === 'education')
  return {
    id, label: anonId(id), demo: !!p.is_demo, field: p.field_of_study, education: edu ? edu.title : p.field_of_study, interests: p.interests, discoverable: p.discoverable,
    experiences, evidence: shared, assessments, contributions: contributions.filter(c => !c.parent_id), name: p.full_name, profile: p,
  }
}

export async function allJobs() { return [...DEMO_JOBS.map(j => ({ ...j, demo: true })), ...(await db.list('jobs').catch(() => []))] }

// Best evidence per competency
export function evidenceFor(c, k) {
  const o = COMP[k]?.o
  const items = c.evidence.filter(e => e.skill_id === o)
  return { items: items.sort((a, b) => (b.level || 1) - (a.level || 1)), level: skillLevel(items) }
}

export function assessedFor(c, k) {
  // a human evaluation replaces "pending"; pending items go last
  return c.assessments.filter(a => a.status === 'submitted').flatMap(a => (a.result?.competencies || []).filter(x => x.k === k).map(x => {
    const reviewed = x.level === 'pending' && a.result.review
    return { ...x, kind: a.kind, title: a.result.title, level: reviewed ? a.result.review.level : x.level, note: reviewed ? 'Human evaluation: ' + a.result.review.comment : x.note }
  })).sort((a, b) => (a.level === 'pending') - (b.level === 'pending'))
}

// Standardized anonymous mini-CV: same sections for every candidate, built from the job's requirements
export function miniCv(c, job, opts = {}) {
  const reqs = job.assessment?.competencies?.length ? [...new Set([...job.skills, ...job.assessment.competencies])] : job.skills
  const relevantIds = new Set(c.evidence.filter(e => reqs.some(k => COMP[k]?.o === e.skill_id)).map(e => e.experience_id).filter(Boolean))
  const exps = c.experiences.filter(e => e.kind !== 'education' && e.kind !== 'certification')
  const relevant = exps.filter(e => relevantIds.has(e.id) || e.source === 'self').slice(0, 3)
  const certs = c.experiences.filter(e => e.kind === 'certification')
  const artifacts = exps.filter(e => e.evidence_url)
  return `<div class="minicv stack">
    <div class="row between"><div><span class="eyebrow">Standardized summary · ${esc(job.title)}</span><h2>${esc(opts.reveal && c.name ? c.name : c.label)}</h2></div>${c.demo ? '<span class="pill demo">Demo data</span>' : ''}</div>
    <p class="hint">${opts.reveal && c.name ? 'Name revealed after interview acceptance.' : 'Name, photo and contact details hidden.'} Free-text evidence can still contain identifying details.</p>
    <div class="kv"><span>Qualification</span><span>${esc(c.education || '—')}</span><span>Field</span><span>${esc(c.field || '—')}</span>${certs.length ? `<span>Certifications</span><span>${certs.map(x => esc(x.title)).join(', ')}</span>` : ''}</div>
    <h3>Relevant experience</h3>
    ${relevant.length ? relevant.map(e => `<div class="exp"><div class="row between"><b>${esc(e.title || e.role)}</b>${chip(e.source)}</div>${e.contribution ? `<p>${esc(e.contribution)}</p>` : ''}${e.outcome ? `<p class="hint">Outcome: ${esc(e.outcome)}</p>` : ''}</div>`).join('') : '<p class="none">No experience linked to these requirements.</p>'}
    <h3>Evidence for each requirement</h3>
    ${reqs.map(k => { const { items } = evidenceFor(c, k); const asd = assessedFor(c, k)
      return `<div class="dim"><b>${esc(compName(k))}</b>${items.length || asd.length
        ? [...asd.map(a => `<div class="ev">${chip('assessed', ' · ' + a.level)}<p><b>${a.kind === 'group' ? 'Group' : 'Individual'} simulation</b> · ${esc(a.note)}</p></div>`),
           ...items.filter(e => e.source !== 'assessed' || !asd.length).slice(0, 2).map(e => `<div class="ev">${chip(e.source)}<p><b>${esc(e.title)}</b>${e.detail ? ' · ' + esc(e.detail) : ''}</p></div>`)].join('')
        : '<p class="none">Not yet evidenced. Explore at interview.</p>'}</div>` }).join('')}
    ${artifacts.length ? `<h3>Supporting artifacts</h3>${artifacts.map(e => `<a href="${esc(e.evidence_url)}" target="_blank" rel="noopener">${esc(e.title)} ↗</a>`).join('<br>')}` : ''}
    ${c.contributions.length ? `<h3>Public contributions</h3>${c.contributions.slice(0, 2).map(x => `<div class="ev">${chip('contribution')}<p>${esc(x.idea)}</p></div>`).join('')}` : ''}
    <p class="hint">Identical sections make review consistent. They do not verify claims or remove every source of bias. No overall score is produced.</p>
  </div>`
}
