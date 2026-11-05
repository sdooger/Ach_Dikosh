// "Why Achievers": a self-contained showcase of the case answer. Static, fictional demo data, no database needed.
const SRC = { cv: 'From CV', self: 'Self-reported', peer: 'Peer feedback', practice: 'Practice', contribution: 'Contribution', assessed: 'Assessed' }
const chip = s => `<span class="chip src-${s}">${SRC[s]}</span>`
const meter = (have, need) => `<span class="meter" role="img" aria-label="Evidence level ${have} of 5${need ? `, role needs ${need}` : ''}">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= have ? 'f' : ''} ${i === need ? 't' : ''}"></i>`).join('')}</span>`
const verdict = (have, need) => have >= need ? ['meets', 'Meets'] : have > 0 ? ['partial', 'Partial'] : ['missing', 'Gap']

// Maya is fictional. Levels follow the real rules: 1 mentioned, 2 ownership, 3 measurable result, +1 for 3+ places, +1 when a second kind of source confirms, max 5.
const MAYA = [
  { n: 'Written communication', lv: 4, need: 3, src: ['cv', 'peer'], why: [['Level 3', 'CV sentence: “Grew the club newsletter open rate from 22% to 41%.” It names a measurable result.'], ['+1', 'Her club lead described the same work with a specific example (peer feedback).']] },
  { n: 'Data analysis', lv: 4, need: 3, src: ['cv', 'self'], why: [['Level 3', 'CV sentence: “Built an Excel model comparing four campaign channels and cut cost per sign-up by 18%.”'], ['+1', 'The skill shows up in three places: her CV, her project list and her own notes.']] },
  { n: 'Coordination', lv: 3, need: 3, src: ['cv', 'peer'], why: [['Level 2', 'CV sentence: “Organised a 12-person volunteer schedule.” She owned the task, but no result is given.'], ['+1', 'A teammate confirmed it in a referee answer.']] },
  { n: 'Critical thinking', lv: 3, need: 3, src: ['contribution', 'assessed'], why: [['Level 2', 'Her answer to a company topic weighed three options and explained the trade-off.'], ['+1', 'A second kind of source agrees: she passed the reasoning check for this ability.']] },
  { n: 'Deductive reasoning', lv: 3, need: 2, src: ['assessed'], why: [['Level 3', 'Both reasoning-check questions for this ability were answered correctly.']] },
  { n: 'Teamwork', lv: 2, need: 3, src: ['cv', 'peer'], why: [['Level 1', 'The CV only mentions “team player”, with no example.'], ['+1', 'A referee confirmed it, but there is still no measurable result. A group simulation would close this gap.']] },
]

function paper() {
  return `<div class="paper" aria-label="A typical one-page CV">
    <div class="paper-top"><b>Maya R.</b><span>Business student · Calgary</span></div>
    <h4>Experience</h4>
    <p><b>Marketing volunteer</b>, Business Club</p>
    <ul><li>Helped with the newsletter</li><li>Organised volunteer schedules</li><li>Used Excel for reports</li></ul>
    <h4>Skills</h4>
    <p>Communication · Teamwork · Excel · Leadership · Problem solving</p>
    <h4>Interests</h4>
    <p>Travel, running, photography</p>
    <div class="paper-q">Which of these claims are true? How strong are they? Who says so?</div>
  </div>`
}
function skillRow(s) {
  const [cls, label] = verdict(s.lv, s.need)
  return `<li class="cs"><div class="cs-top"><b>${s.n}</b>${meter(s.lv, s.need)}<span class="st ${cls}">${label}</span></div>
    <div class="row">${s.src.map(chip).join('')}</div>
    <details><summary>Why level ${s.lv}?</summary><div class="why">${s.why.map(([a, b]) => `<div><span class="pill ok">${a}</span><p>${b}</p></div>`).join('')}</div></details></li>`
}

function compareTab() {
  return `<div class="head"><div><div class="eyebrow">Same person, two views</div><h1>A CV makes claims. A Skill Fingerprint shows evidence.</h1>
    <p class="lede">Maya is a fictional third-year student. Her CV says what she wants us to believe. Her fingerprint shows how strong each skill is and who or what backs it up.</p></div></div>
  <div class="duo">
    <section class="card stack"><div class="row between"><h2>The CV</h2><span class="pill">Claims only</span></div>${paper()}
      <p class="hint">An employer has to guess what “Communication” or “Leadership” means. Every candidate writes the same words.</p></section>
    <section class="card stack"><div class="row between"><h2>The Skill Fingerprint</h2><span class="pill ok">Evidence</span></div>
      <div class="fp-demo"><canvas id="fpmaya" width="560" height="560" aria-hidden="true"></canvas>
        <div class="legend">${['cv', 'self', 'peer', 'contribution', 'assessed'].map(chip).join('')}</div></div>
      <p class="hint">Bars show how strong the evidence is. The triangle marks the level the target role asks for (sample role: marketing coordinator).</p>
      <ul class="cs-list">${MAYA.map(skillRow).join('')}</ul>
      <p class="hint">No overall score. Open “Why level…” to see the exact sentence or person behind each bar.</p></section>
  </div>
  <section class="callout"><div><h3>What changes for the employer</h3>
    <p>Instead of reading “good communicator”, they see <b>a measurable result from the CV, confirmed by a person who watched the work</b>. And they can see honestly that teamwork is still thin.</p></div>
    <div class="row"><a class="btn primary" href="#case/employer">See the employer view</a><a class="btn" href="#start">Build my own</a></div></section>`
}

const CAND = [
  { id: 'A', blurb: 'Final-year, retail and events', skills: [4, 4, 3, 3, 2], src: [['cv', 5], ['peer', 2], ['assessed', 2]] },
  { id: 'B', blurb: 'Second-year, marketing club lead', skills: [3, 4, 4, 3, 3], src: [['cv', 4], ['contribution', 3], ['peer', 1]] },
  { id: 'C', blurb: 'Recent graduate, analytics intern', skills: [2, 5, 3, 4, 2], src: [['cv', 6], ['practice', 2], ['assessed', 3]] },
]
const CSK = [['Written communication', 3], ['Data analysis', 3], ['Coordination', 3], ['Critical thinking', 3], ['Teamwork', 3]]
function employerTab() {
  return `<div class="head"><div><div class="eyebrow">Connect · the employer view</div><h1>Strong candidates found by evidence, not by name.</h1>
    <p class="lede">Employers browse anonymised, standardised profiles side by side. Names, photos and schools stay hidden until the employer opens a conversation.</p></div></div>
  <div class="grid g3">${CAND.map(c => `<section class="card stack anon">
      <div class="row"><span class="avatar" aria-hidden="true">${c.id}</span><div><h3>Candidate ${c.id}</h3><p class="hint">${c.blurb}</p></div></div>
      <div class="row">${c.src.map(([s, n]) => `<span class="chip src-${s}">${SRC[s]} · ${n}</span>`).join('')}</div>
      <div class="kv"><span>At required level</span><b class="mono">${c.skills.filter((v, i) => v >= CSK[i][1]).length} of ${CSK.length}</b><span>Confirmed by others or tests</span><b class="mono">${c.src.filter(([s]) => ['peer', 'assessed'].includes(s)).reduce((a, [, n]) => a + n, 0)}</b><span>Overall score</span><span>None, by design</span></div>
    </section>`).join('')}</div>
  <section class="card stack"><div class="row between"><h2>Side by side</h2><span class="pill demo">Sample data</span></div>
    <div class="tablewrap"><table class="cmp"><thead><tr><th>Skill</th>${CAND.map(c => `<th>Candidate ${c.id}</th>`).join('')}</tr></thead>
    <tbody>${CSK.map(([n, need], i) => `<tr><td><b>${n}</b><div class="hint">Role asks for level ${need}</div></td>${CAND.map(c => `<td>${meter(c.skills[i], need)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <p class="hint">People decide. The platform never ranks candidates or makes a hiring decision.</p></section>
  <section class="callout"><div><h3>Why this helps fairness</h3><p>Everyone is described in the same skills language (Canada’s OaSIS taxonomy), with the same evidence labels. Hidden names and schools reduce first-glance bias.</p></div>
    <div class="row"><a class="btn primary" href="#case/impact">See impact and model</a><a class="btn" href="#e-discover">Open the live employer demo</a></div></section>`
}

const METRICS = [
  ['Confirmed skills', 'Share of fingerprints with at least one skill confirmed by another person or a test.', 'Illustrative target: 60% of active students'],
  ['Time to shortlist', 'Minutes an employer needs to go from a role to a shortlist of anonymised profiles.', 'Measured in the pilot against their current process'],
  ['Discovery without applying', 'Students contacted by an employer after a topic contribution, without having applied.', 'Illustrative target: 1 in 10 contributors'],
  ['Trust in the result', 'Share of employers who say the evidence labels changed their shortlist.', 'Asked after each pilot cycle'],
]
function impactTab() {
  return `<div class="head"><div><div class="eyebrow">Impact and model</div><h1>What we would measure, and who pays.</h1>
    <p class="lede">All figures below are targets to test in a pilot, not results. We label them that way on purpose.</p></div></div>
  <div class="grid g3">${METRICS.map(([t, d, g]) => `<section class="card stack metric"><span class="pill est">Pilot metric</span><h3>${t}</h3><p class="hint">${d}</p><p class="goal">${g}</p></section>`).join('')}</div>
  <div class="sectionhead row between"><h2>Who pays for what</h2><span class="pill">To be tested</span></div>
  <div class="grid g3 model">
    <section class="card stack"><h3>Students</h3><p class="chip src-assessed">Free core</p><ul class="plain"><li>Skill Fingerprint from a CV</li><li>Referee feedback and reasoning check</li><li>One free course each month</li></ul><p class="hint">Extra courses are optional and paid. Learning adds evidence labelled as learning, separate from independently verified skills.</p></section>
    <section class="card stack"><h3>Employers</h3><p class="chip src-contribution">Pays for access</p><ul class="plain"><li>Anonymised talent discovery</li><li>Sponsored topics and job simulations</li><li>Side-by-side comparison</li></ul><p class="hint">The employer pays for better candidates and a shorter shortlist, not for ranking students.</p></section>
    <section class="card stack"><h3>Universities</h3><p class="chip src-peer">Partner</p><ul class="plain"><li>Short lessons for their students</li><li>Cohort view of skill gaps, without names</li><li>Link to employers hiring locally</li></ul><p class="hint">Universities bring students in early, before the first job search.</p></section>
  </div>
  <section class="callout"><div><h3>Built to be explained</h3><p>Matching uses published rules, not a hidden model. Every skill links to the sentence or person it came from, sharing is consent-based, and no automated hiring decision is made. This keeps the design simple to explain under privacy rules such as PIPEDA.</p></div>
    <div class="row"><a class="btn primary" href="#start">Try the prototype</a></div></section>`
}

export function casePage(path) {
  const tab = path.split('/')[1] || ''
  return tab === 'employer' ? employerTab() : tab === 'impact' ? impactTab() : compareTab()
}
