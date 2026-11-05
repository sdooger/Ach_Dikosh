// PART 2 — Develop & Express: Talent Marketplace, Learning Hub, Meet Me Through Others
import * as db from './db.js'
import { S, loadMe, firstName } from './state.js'
import { $, $$, esc, val, act, go, render, toast, status, spin, chip, head, compName, anonId, fmtDate, demoTag } from './ui.js'
import { COMPETENCIES, COMP, CATEGORIES, DEMO_TOPICS, DEMO_CONTRIBUTIONS, LEARN_CATEGORIES, COURSES } from './demo.js'

let topicFilter = { cat: '', q: '' }
let courseCat = ''
let replyTo = null

export async function allTopics() { return [...DEMO_TOPICS.map(t => ({ ...t, demo: true })), ...(await db.list('topics').catch(() => []))] }
export async function allContributions() { return [...DEMO_CONTRIBUTIONS.map(c => ({ ...c, demo: true })), ...(await db.list('contributions').catch(() => []))] }

const tabs = cur => `<div class="tabs" role="tablist">${[['#develop', 'Talent Marketplace', 'market'], ['#develop/learn', 'Learning Hub', 'learn'], ['#develop/feedback', 'Meet me through others', 'feedback']].map(([h, n, k]) => `<a role="tab" href="${h}" aria-selected="${cur === k}">${n}</a>`).join('')}</div>`
const devHead = cur => head('Stage 2 · Develop & Express', 'Learn, contribute and get noticed', 'Answer professional questions, take short lessons and collect feedback. Each adds labelled evidence to your Skill Fingerprint.') + tabs(cur)

// ======================================================================
// MARKETPLACE
// ======================================================================
export async function marketplace() {
  const [topics, contribs] = await Promise.all([allTopics(), allContributions()])
  const saved = new Set(S.profile.saved_topics || [])
  const q = topicFilter.q.toLowerCase()
  const shown = topics.filter(t => (!topicFilter.cat || t.category === topicFilter.cat) && (!q || (t.title + ' ' + t.description).toLowerCase().includes(q)))
  return `${devHead('market')}
  <div class="row filters"><label for="tq" class="sr">Search topics</label><input type="search" id="tq" placeholder="Search topics" value="${esc(topicFilter.q)}" data-change="topic-search">
    <select id="tcat" data-change="topic-cat" aria-label="Category"><option value="">All categories</option>${CATEGORIES.map(c => `<option ${c === topicFilter.cat ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
  <div class="grid g3">${shown.map(t => {
    const n = contribs.filter(c => c.topic_id === t.id && !c.parent_id).length
    const mine = contribs.some(c => c.topic_id === t.id && c.user_id === db.me())
    return `<a class="card topic stack" href="#topic/${esc(t.id)}">
      <div class="row between"><span class="eyebrow">${esc(t.category)}</span>${mine ? '<span class="pill ok">You contributed</span>' : saved.has(t.id) ? '<span class="pill">Saved</span>' : ''}</div>
      <h3>${esc(t.title)}</h3><p class="hint">${esc(t.description)}</p>
      <div class="row">${(t.skills || []).map(k => `<span class="pill">${esc(compName(k))}</span>`).join('')}</div>
      <span class="hint">${esc(t.publisher)} · ${n} contribution${n === 1 ? '' : 's'}</span></a>`
  }).join('') || '<p class="hint">No topics match.</p>'}</div>`
}
act('topic-search', el => { topicFilter.q = el.value; render() })
act('topic-cat', el => { topicFilter.cat = el.value; render() })

export async function topicPage(id) {
  const [topics, contribs] = await Promise.all([allTopics(), allContributions()])
  const t = topics.find(x => x.id === id)
  if (!t) return `<div class="card"><h2>Topic not found</h2><a href="#develop">Back to topics</a></div>`
  const saved = new Set(S.profile.saved_topics || [])
  const roots = contribs.filter(c => c.topic_id === id && !c.parent_id)
  const replies = pid => contribs.filter(c => c.parent_id === pid)
  const card = c => `<article class="card stack contrib">
     <div class="row between"><b>${esc(c.user_id === db.me() ? 'You' : c.author_label || anonId(c.user_id))}</b><span class="hint">${fmtDate(c.created_at)}${c.demo ? ' · demo' : ''}</span></div>
     <dl class="star">${[['My idea', c.idea], ['Reasoning', c.reasoning], ['Implementation', c.implementation], ['Potential risks', c.risks]].filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
     ${c.link ? `<a href="${esc(c.link)}" target="_blank" rel="noopener">Supporting link ↗</a>` : ''}
     ${replies(c.id).map(r => `<div class="reply"><b>${esc(r.user_id === db.me() ? 'You' : r.author_label || anonId(r.user_id))}</b> <span class="hint">${fmtDate(r.created_at)}</span><p>${esc(r.idea)}</p></div>`).join('')}
     ${S.view === 'candidate' ? (replyTo === c.id ? `<div class="stack"><label for="rp">Your reply</label><textarea id="rp" rows="2"></textarea><div class="row"><button class="primary" data-act="reply-send" data-id="${c.id}" data-topic="${esc(id)}">Post reply</button><button class="ghost" data-act="reply-cancel">Cancel</button></div></div>` : `<button class="ghost" data-act="reply-open" data-id="${c.id}">Reply</button>`) : ''}
   </article>`
  return `<a href="#develop" class="back">← All topics</a>
  ${head(esc(t.category), esc(t.title), '', S.view === 'candidate' ? `<button data-act="topic-save" data-id="${esc(id)}">${saved.has(id) ? 'Saved' : 'Save'}</button><button data-act="topic-follow" data-id="${esc(id)}">${saved.has('f:' + id) ? 'Following' : 'Follow'}</button>` : '')}
  <div class="grid g2">
   <div class="stack">
    <section class="card stack"><p style="margin:0">${esc(t.description)}</p>
      <div class="row">${(t.skills || []).map(k => `<span class="pill">${esc(compName(k))}</span>`).join('')}</div>
      <span class="hint">Published by ${esc(t.publisher)}${t.demo ? ' · demo topic' : ''}${t.deadline ? ' · open until ' + fmtDate(t.deadline) : ''}</span>
      ${t.reference ? `<p class="hint">Reference: ${esc(t.reference)}</p>` : ''}</section>
    ${S.view === 'candidate' ? `<section class="card stack"><h2>Your contribution</h2>
      <p class="hint">Only the idea is required. Use the other fields if they help you explain.</p>
      <div><label for="c-idea">My idea: what would you propose?</label><textarea id="c-idea" rows="3"></textarea></div>
      <div><label for="c-reason">Reasoning: why would it work? <span class="opt">(optional)</span></label><textarea id="c-reason" rows="2"></textarea></div>
      <div><label for="c-impl">Implementation: how could it be applied? <span class="opt">(optional)</span></label><textarea id="c-impl" rows="2"></textarea></div>
      <div><label for="c-risk">Potential risks <span class="opt">(optional)</span></label><textarea id="c-risk" rows="2"></textarea></div>
      <div><label for="c-link">Supporting link <span class="opt">(optional)</span></label><input type="text" id="c-link" placeholder="https://"></div>
      <div class="row"><button class="primary" data-act="contrib-send" data-id="${esc(id)}">Publish contribution</button></div><p class="status" id="cst"></p>
      <p class="hint">Contributions show how you reason. They are recorded as contribution evidence, not as proof of ability.</p></section>` : ''}
   </div>
   <section class="stack"><h2>${roots.length} contribution${roots.length === 1 ? '' : 's'}</h2>${roots.map(card).join('') || '<p class="hint">Be the first to contribute.</p>'}</section>
  </div>`
}
act('contrib-send', async el => {
  const id = el.dataset.id, idea = val('c-idea'), link = val('c-link')
  if (idea.length < 15) return status('#cst', 'Write your idea in at least a sentence.', true)
  if (link && !/^https?:\/\//.test(link)) return status('#cst', 'Links must start with https://', true)
  el.disabled = true
  try {
    const uid = db.me(), topic = (await allTopics()).find(t => t.id === id)
    const c = { topic_id: id, user_id: uid, author_label: anonId(uid), idea, reasoning: val('c-reason'), implementation: val('c-impl'), risks: val('c-risk'), link }
    await db.insert('contributions', c)
    const level = c.reasoning.length > 40 && (c.implementation || c.risks) ? 2 : 1
    await db.insertMany('evidence', (topic.skills || []).filter(k => COMP[k]).map(k => ({ user_id: uid, skill_id: COMP[k].o, source: 'contribution', title: 'Marketplace: ' + topic.title, detail: idea.slice(0, 240), level, ref: 'topic:' + id })))
    await loadMe(); toast('Contribution published · Skill Fingerprint updated'); render()
  } catch (e) { status('#cst', 'Publishing failed: ' + esc(e.message), true); el.disabled = false }
})
act('reply-open', el => { replyTo = el.dataset.id; render() })
act('reply-cancel', () => { replyTo = null; render() })
act('reply-send', async el => {
  const text = val('rp'); if (text.length < 5) return
  await db.insert('contributions', { topic_id: el.dataset.topic, user_id: db.me(), parent_id: el.dataset.id, author_label: anonId(db.me()), idea: text })
  replyTo = null; toast('Reply posted'); render()
})
async function toggleSaved(key) {
  const set = new Set(S.profile.saved_topics || []); set.has(key) ? set.delete(key) : set.add(key)
  S.profile.saved_topics = [...set]; await db.saveProfile({ saved_topics: S.profile.saved_topics }); return set.has(key)
}
act('topic-save', async el => { toast((await toggleSaved(el.dataset.id)) ? 'Topic saved' : 'Removed from saved'); render() })
act('topic-follow', async el => { toast((await toggleSaved('f:' + el.dataset.id)) ? 'You are following this discussion' : 'Unfollowed'); render() })

// ======================================================================
// LEARNING HUB
// ======================================================================
const thisMonth = d => { const a = new Date(d), b = new Date(); return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() }
function access(c) {
  const done = S.courses.find(p => p.course_id === c.id)
  if (done) return { open: true, label: 'Completed' }
  if (c.access === 'sponsored') return { open: true, label: 'Free · sponsored by employer' }
  if (c.access === 'free') return { open: true, label: 'Free · university-provided' }
  if (S.profile.premium_demo) return { open: true, label: 'Premium (demo access)' }
  const usedFree = S.courses.some(p => p.access === 'monthly-free' && thisMonth(p.created_at))
  return usedFree ? { open: false, label: 'Premium' } : { open: true, label: 'Your free course this month', monthly: true }
}
export function learning() {
  const shown = COURSES.filter(c => !courseCat || c.category === courseCat)
  return `${devHead('learn')}
  <div class="row filters"><select data-change="course-cat" aria-label="Category"><option value="">All categories</option>${LEARN_CATEGORIES.map(c => `<option ${c === courseCat ? 'selected' : ''}>${c}</option>`).join('')}</select>
   <span class="hint">One premium course free each month. University-provided and employer-sponsored lessons are always free.</span></div>
  <div class="grid g3">${shown.map(c => { const a = access(c); const done = S.courses.find(p => p.course_id === c.id)
    return `<a class="card topic stack" href="#course/${c.id}">
      <div class="row between"><span class="eyebrow">${esc(c.category)}</span><span class="pill ${done ? 'ok' : ''}">${esc(a.label)}</span></div>
      <h3>${esc(c.title)}</h3><span class="hint">${esc(c.provider)}</span><p class="hint">${esc(c.description)}</p>
      <div class="row">${c.skills.map(k => `<span class="pill">${esc(compName(k))}</span>`).join('')}</div>
      <span class="hint">${esc(c.duration)} · ${esc(c.difficulty)}</span></a>` }).join('') || '<p class="hint">No courses in this category yet.</p>'}</div>`
}
act('course-cat', el => { courseCat = el.value; render() })

export function coursePage(id) {
  const c = COURSES.find(x => x.id === id)
  if (!c) return `<div class="card"><h2>Course not found</h2><a href="#develop/learn">Back</a></div>`
  const a = access(c), done = S.courses.find(p => p.course_id === c.id)
  if (!a.open) return `<a href="#develop/learn" class="back">← Learning Hub</a>${head(esc(c.provider), esc(c.title))}
    <section class="card stack"><h2>Premium course</h2><p>You have used your free course for this month.</p>
    <p class="hint">In the product, premium access is a paid subscription. No payment is taken in this prototype.</p>
    <div class="row"><button class="primary" data-act="premium-demo">Unlock premium (demo, no payment)</button></div></section>`
  return `<a href="#develop/learn" class="back">← Learning Hub</a>
  ${head(esc(c.provider) + ' · ' + esc(c.duration), esc(c.title), esc(c.description))}
  ${a.monthly && !done ? '<div class="banner"><span>Completing this course uses your free premium course for this month.</span></div>' : ''}
  <div class="grid g2">
   <section class="card stack">${c.sections.map(([h, p]) => `<h3>${esc(h)}</h3><p style="margin:0">${esc(p)}</p>`).join('')}
     <div class="scenario"><b>Example</b><p style="margin:4px 0 0">${esc(c.example)}</p></div>
     ${c.task ? `<div><label for="task">Short applied task <span class="opt">(optional)</span>: ${esc(c.task)}</label><textarea id="task" rows="3"></textarea></div>` : ''}
   </section>
   <section class="card stack"><h2>Knowledge check</h2>
     ${done ? `<p>Completed ${fmtDate(done.created_at)} with ${done.score} of ${c.quiz.length} correct. The learning record is in your Skill Fingerprint.</p>` : `${c.quiz.map((q, i) => `<fieldset class="q"><legend>${i + 1}. ${esc(q.q)}</legend><div class="opts">${q.o.map((o, j) => `<label><input type="radio" name="kq-${i}" value="${j}"><span>${esc(o)}</span></label>`).join('')}</div></fieldset>`).join('')}
       <div class="row"><button class="primary" data-act="course-done" data-id="${c.id}">Complete course</button></div><p class="status" id="kst"></p>`}
     <p class="hint">A completed course is recorded as learning, not as proof of professional competence.</p>
   </section></div>`
}
act('premium-demo', async () => { await db.saveProfile({ premium_demo: true }); S.profile.premium_demo = true; toast('Premium unlocked for this demo account'); render() })
act('course-done', async el => {
  const c = COURSES.find(x => x.id === el.dataset.id); let score = 0
  for (let i = 0; i < c.quiz.length; i++) { const x = document.querySelector(`input[name="kq-${i}"]:checked`); if (!x) return status('#kst', 'Answer every question first.', true); if (+x.value === c.quiz[i].a) score++ }
  const a = access(c), uid = db.me()
  await db.upsert('course_progress', { user_id: uid, course_id: c.id, status: 'completed', score, access: a.monthly ? 'monthly-free' : c.access }, ['user_id', 'course_id'])
  const task = val('task')
  await db.insertMany('evidence', c.skills.map(k => ({ user_id: uid, skill_id: COMP[k].o, source: 'learning', title: 'Course: ' + c.title, detail: `${c.provider}. Knowledge check ${score}/${c.quiz.length}.${task ? ' Task: ' + task.slice(0, 160) : ''}`, level: score === c.quiz.length ? 2 : 1, ref: 'course:' + c.id })))
  await loadMe(); toast(`Course completed (${score}/${c.quiz.length}) · Skill Fingerprint updated`); render()
})

// ======================================================================
// MEET ME THROUGH OTHERS
// ======================================================================
const PROMPTS = ['What did this person contribute?', 'How did they approach challenges?', 'What did you observe about their teamwork or communication?', 'Can you give a specific example?']
export { PROMPTS }
export function feedbackPage(params) {
  const exps = S.experiences.filter(e => e.source === 'self')
  const pre = params.get('exp')
  const guest = db.currentMode() === 'guest'
  const link = r => `${location.origin}${location.pathname}#ref/${r.token}`
  return `${devHead('feedback')}
  <div class="grid g2">
   <section class="card stack"><div class="row between"><h2>Request feedback</h2>${chip('peer')}</div>
     <p class="hint">Ask a teammate, supervisor or mentor to describe what they saw you do in one of your experiences.</p>
     ${exps.length ? `<div><label for="fb-exp">Experience</label><select id="fb-exp">${exps.map(e => `<option value="${e.id}" ${e.id === pre ? 'selected' : ''}>${esc(e.title)}</option>`).join('')}</select></div>` : '<p class="hint">Add an experience first. <a href="#onboard">Add one</a>.</p>'}
     <div class="grid g-form">
       <div><label for="fb-name">Their name</label><input type="text" id="fb-name"></div>
       <div><label for="fb-rel">Relationship</label><select id="fb-rel"><option>Teammate</option><option>Internship supervisor</option><option>Project mentor</option><option>Student organization collaborator</option><option>Professor</option></select></div>
     </div>
     <div><label for="fb-skill">Focus on</label><select id="fb-skill">${COMPETENCIES.map(c => `<option value="${c.k}">${c.n}</option>`).join('')}</select></div>
     <div class="hint">They will be asked:<ul>${PROMPTS.map(p => `<li>${p}</li>`).join('')}</ul></div>
     <div class="row"><button class="primary" data-act="fb-create" ${exps.length ? '' : 'disabled'}>Create request</button></div><p class="status" id="fbst"></p>
   </section>
   <section class="stack"><h2>Your requests</h2>
    ${S.refs.length ? S.refs.slice().reverse().map(r => `<div class="card stack">
      <div class="row between"><b>${esc(r.referee_name)} · ${esc(r.relationship)}</b><span class="pill ${r.status === 'answered' ? 'ok' : ''}">${r.status === 'answered' ? 'Answered' : 'Waiting'}</span></div>
      <span class="hint">${esc(r.experience_title || '')} · ${esc(r.skill_label)}</span>
      ${r.status === 'answered' ? `<p style="margin:0">"${esc(r.response)}"</p>`
        : guest ? `<p class="hint">Guest mode has no shareable link. Simulate the collaborator's answer:</p><textarea id="ga-${r.id}" rows="3">${esc(`${r.referee_name} here. On ${r.experience_title || 'this project'}, ${firstName() || 'they'} took ownership of the plan when things changed and kept everyone informed. For example, they set up a shared schedule the same week and checked in with each team lead.`)}</textarea><div class="row"><button data-act="fb-sim" data-id="${r.id}">Submit as collaborator (demo)</button></div>`
        : `<div class="linkbox"><input type="text" readonly value="${esc(link(r))}" aria-label="Link for ${esc(r.referee_name)}"><button data-act="copy" data-v="${esc(link(r))}">Copy link</button></div><p class="hint">Send this link. They answer without an account, and only once.</p>`}
    </div>`).join('') : '<p class="hint">No requests yet.</p>'}
    <p class="hint">Production needs identity checks on referees (for example a work or university email), moderation and safeguards against fabricated endorsements.</p>
   </section></div>`
}
act('fb-create', async () => {
  const name = val('fb-name'); if (!name) return status('#fbst', 'Add their name.', true)
  const exp = S.experiences.find(e => e.id === val('fb-exp')), sk = COMP[val('fb-skill')]
  await db.insert('reference_requests', { user_id: db.me(), referee_name: name, relationship: val('fb-rel'), skill_id: sk.o, skill_label: sk.n, student_first_name: firstName(), experience_id: exp.id, experience_title: exp.title, status: 'pending' })
  await loadMe(); toast('Feedback request created'); render()
})
act('fb-sim', async el => {
  const r = S.refs.find(x => x.id === el.dataset.id), text = val('ga-' + r.id)
  if (text.length < 20) return
  await db.update('reference_requests', r.id, { status: 'answered', response: text })
  await db.insert('evidence', { user_id: db.me(), skill_id: r.skill_id, source: 'peer', title: `${r.relationship}: ${r.referee_name}`, detail: `"${text.slice(0, 600)}"`, level: 3, ref_id: r.id, experience_id: r.experience_id })
  await loadMe(); toast('Feedback received · linked to ' + (r.experience_title || 'your experience')); render()
})
