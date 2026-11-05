// Turn CV text into structured, editable fields. Rule-based; the student reviews everything before saving.

const HEAD = /^(education|academic background|experience|work experience|professional experience|employment|internships?|projects?|academic projects|certifications?|certificates|licen[cs]es|skills|technical skills|key skills|extracurricular( activities)?|activities|leadership|volunteer(ing)?( experience)?|languages|awards|achievements|interests)\s*:?$/i
const EDU = /universit|college|school of|bachelor|master|bsc|msc|bcomm|\bba\b|\bbs\b|mba|degree|diploma/i
const YEAR = /(19|20)\d\d/
const DATE_TAIL = /,?\s*\(?((?:[A-Z][a-z]{2,8}\.?\s)?(19|20)\d\d.*)$/

function sections(text) {
  const out = { _: [] }
  let cur = '_'
  for (const raw of text.split('\n')) {
    const l = raw.replace(/^[•\-–*·▪●\s]+/, '').trim()
    if (!l) continue
    if (l.length < 45 && HEAD.test(l)) { cur = l.toLowerCase().replace(/[^a-z ]/g, '').trim(); out[cur] = out[cur] || []; continue }
    out[cur].push(l)
  }
  return out
}
const pick = (secs, re) => Object.entries(secs).filter(([k]) => re.test(k)).flatMap(([, v]) => v)

// "Role — Organisation, May 2024 – Aug 2024" → {role, org, period}
function splitEntry(l) {
  const m = l.match(DATE_TAIL)
  const rest = m ? l.slice(0, m.index) : l
  const parts = rest.split(/\s[—–|]\s|\s-\s|\sat\s/)
  return { role: (parts[0] || '').trim(), org: (parts.slice(1).join(' · ') || '').replace(/,\s*$/, '').trim(), period: m ? m[1].replace(/\)$/, '').trim() : '' }
}

// Dated lines start an entry; following lines become its description
function entries(lines) {
  const out = []
  for (const l of lines) {
    if (YEAR.test(l) && l.length < 160 && !/^\d/.test(l)) out.push({ ...splitEntry(l), description: '' })
    else if (out.length) { const e = out[out.length - 1]; e.description += (!e.description ? '' : /[.!?]$/.test(e.description) ? ' ' : '. ') + l }
    else out.push({ role: l.slice(0, 80), org: '', period: '', description: '' })
  }
  return out
}

export function extractCv(text) {
  const secs = sections(text)
  const top = secs._
  const name = top[0] && top[0].length < 40 && !/\d|@|curriculum|resume/i.test(top[0]) ? top[0] : ''
  const headline = top[1] && top[1].length < 100 && !/@|\+\d|http/.test(top[1]) ? top[1] : ''

  let eduLines = pick(secs, /^(education|academic)/)
  if (!eduLines.length) eduLines = Object.values(secs).flat().filter(l => EDU.test(l) && YEAR.test(l))
  const education = eduLines.filter(l => EDU.test(l) || YEAR.test(l)).map(l => {
    const m = l.match(DATE_TAIL); const rest = m ? l.slice(0, m.index) : l
    const p = rest.split(/\s[—–|]\s|\s-\s/)
    return { degree: (p[0] || '').trim(), school: (p.slice(1).join(' · ') || '').replace(/,\s*$/, '').trim(), years: m ? m[1].trim() : '' }
  })

  let workLines = pick(secs, /^(experience|work|professional|employment|internship)/)
  if (!workLines.length) workLines = Object.values(secs).flat().filter(l => YEAR.test(l) && !EDU.test(l))
  const work = entries(workLines).filter(e => e.role)

  const volunteer = entries(pick(secs, /^(volunteer|leadership)/)).filter(e => e.role)
  const projects = pick(secs, /^(project|academic project)/)
  const certifications = pick(secs, /^(certific|licen)/).map(l => { const m = l.match(/(19|20)\d\d/); return { name: l.replace(/,?\s*\(?(19|20)\d\d\)?\s*$/, '').trim(), year: m ? m[0] : '' } })
  const extracurricular = pick(secs, /^(extracurricular|activities|awards|achievements)/)
  const skills = pick(secs, /^(skills|technical skills|key skills|languages)/).flatMap(l => l.split(/[,·|;•]/)).map(s => s.trim()).filter(s => s && s.length < 40)

  return { name, headline, education, work: [...work, ...volunteer.map(v => ({ ...v, kind: 'volunteering' }))], projects, certifications, extracurricular, skills }
}
