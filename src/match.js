// Rule-based matching of CV text to taxonomy skills. No AI: every match can be traced to a sentence.

const ACTION = /\b(led|managed|founded|co-founded|built|designed|launched|organi[sz]ed|coordinated|headed|created|developed|initiated)\b/i
const QUANT = /(\d+\s?%|\$\s?\d|€\s?\d|\b\d{2,}\b|\b\d+\s?(people|members|students|clients|stores|users|volunteers)\b)/i

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

// Build one tester per alias
function compileAliases(aliases) {
  return Object.entries(aliases).filter(([id]) => !id.startsWith('_')).map(([id, list]) => ({
    id,
    tests: list.map(a => {
      if (/^[^a-z0-9]|[^a-z0-9]$/i.test(a) && a.trim().length < 3) return s => (' ' + s.toLowerCase() + ' ').includes(a) // e.g. " r "
      if (!/^[a-z]/i.test(a)) return s => s.toLowerCase().includes(a.toLowerCase())                                // e.g. "%"
      const short = a.length <= 4 && /^[a-z]+$/i.test(a)
      const re = new RegExp('(^|[^a-z0-9])' + escapeRe(a.trim()) + (short ? 's?(?![a-z])' : ''), 'i')
      return s => re.test(s)
    }),
  }))
}

export function splitSentences(text) {
  return text.replace(/\r/g, '')
    .split(/\n+|(?<=[.!?;])\s+(?=[A-Z])/)
    .map(s => s.replace(/^[•\-–*·▪●\s]+/, '').trim())
    .filter(s => s.length >= 12)
}

// Evidence level 1-3 from a sentence: mentioned → did it with ownership → with a measurable result
export function levelFor(sentence, source) {
  let l = 1
  if (ACTION.test(sentence)) l++
  if (QUANT.test(sentence.replace(/\b(19|20)\d\d\b/g, ''))) l++
  return source === 'self' ? Math.min(l, 2) : Math.min(l, 3)
}

export function matchText(text, source, aliases, perSkill = 4) {
  const compiled = compileAliases(aliases)
  const out = []
  for (const s of splitSentences(text)) {
    if (/^(education|experience|skills|languages|contact|references|projects)\b/i.test(s) && s.length < 30) continue
    for (const c of compiled) {
      if (!c.tests.some(t => t(s))) continue
      if (out.filter(e => e.skill_id === c.id).length >= perSkill) continue
      const isList = (s.match(/,|·|\|/g) || []).length >= 3
      out.push({ skill_id: c.id, source, title: isList ? 'Listed in skills section' : s.split(/[,.;:—–(]/)[0].slice(0, 70).trim(), detail: s.slice(0, 280), level: levelFor(s, source) })
    }
  }
  return out
}

// Experiences: lines with a date range, plus the line that follows as "my part"
export function extractExperiences(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const out = []
  lines.forEach((l, i) => {
    if (!/(19|20)\d\d/.test(l) || l.length > 150) return
    if (/universit|college|school|bachelor|master|bsc|msc|bcomm|\bba\b|gpa|diploma|exchange semester/i.test(l)) return
    const m = l.match(/,?\s*\(?((?:[A-Z][a-z]{2,8}\.?\s)?(19|20)\d\d.*)$/)
    const rest = m ? l.slice(0, m.index) : l
    const parts = rest.split(/\s[—–|]\s|\s-\s|,\s(?=[A-Z])/)
    if (!parts[0] || parts[0].length < 3) return
    const nl = lines[i + 1] || ''
    const next = nl && !/(19|20)\d\d/.test(nl) && !/^[A-Z &]{3,25}$/.test(nl) ? nl : ''
    out.push({ role: parts[0].trim().slice(0, 80), org: (parts[1] || '').trim().slice(0, 80), period: m ? m[1].replace(/\)$/, '').trim() : '', contribution: next.slice(0, 300), source: 'cv' })
  })
  return out.slice(0, 8)
}

export function guessName(text) {
  const first = text.split('\n').map(l => l.trim()).find(Boolean) || ''
  return first.length < 40 && !/\d|@|curriculum|resume|cv\b/i.test(first) ? first : ''
}

// Combined level for one skill across all evidence (0 = no evidence, max 5)
export function skillLevel(items) {
  if (!items.length) return 0
  let lvl = Math.max(...items.map(e => e.level || 1))
  const sources = new Set(items.map(e => e.source))
  if (items.length >= 3) lvl += 1                       // repeated across experiences
  if (sources.size >= 2 && lvl < 5) lvl += 1            // confirmed by a second kind of source
  return Math.min(5, lvl)
}

export function gapStatus(have, need) {
  if (!need) return have ? 'extra' : 'none'
  if (have >= need) return 'meets'
  if (have > 0) return 'partial'
  return 'missing'
}
