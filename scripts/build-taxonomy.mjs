// Builds data/taxonomy.json and data/roles.json from the official OaSIS 2025 files in data/raw/.
// Run: npm run import-taxonomy
import fs from 'fs'

const RAW = new URL('../data/raw/', import.meta.url)
const OUT = new URL('../data/', import.meta.url)

// Read a semicolon-separated OaSIS file (UTF-8 with BOM, CRLF). Handles quoted fields.
function readCsv(name) {
  const text = fs.readFileSync(new URL(name, RAW), 'utf8').replace(/^﻿/, '')
  const rows = []
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    const cells = []; let cur = '', q = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++ } else q = !q }
      else if (ch === ';' && !q) { cells.push(cur); cur = '' }
      else cur += ch
    }
    cells.push(cur)
    rows.push(cells.map(c => c.replace(/\s+/g, ' ').trim()))
  }
  return rows
}
const norm = s => s.toLowerCase().replace(/[^a-z]/g, '')

// ---------- taxonomy ----------
// Which parts of OaSIS are relevant to students applying for knowledge-work roles
const KEEP = c => c.startsWith('F') || c.startsWith('A.01') || c.startsWith('B') || c.startsWith('G')
const CAT_ORDER = ['F', 'A', 'B', 'G']

const guide = readCsv('guide_oasis_2025.csv').slice(1)
const cats = {}, subs = {}
for (const [code, type, name, desc] of guide) {
  if (!KEEP(code) && !(type === 'Category' && CAT_ORDER.includes(code))) continue
  if (type === 'Category') cats[code] = { id: code, name, description: desc, subcategories: [] }
  if (type === 'Sub-Category' && KEEP(code)) { subs[code] = { id: code, name, description: desc, skills: [] }; cats[code[0]]?.subcategories.push(subs[code]) }
  if (type === 'Descriptor' && KEEP(code)) {
    const sub = subs[code.slice(0, 4)]
    if (sub) sub.skills.push({ id: code, name: name.replace(/^Oral Communication: /, ''), description: desc })
  }
}
const categories = CAT_ORDER.map(c => cats[c]).filter(Boolean)
categories.forEach(c => { if (c.id === 'A') c.name = 'Cognitive abilities' })

// Tools are not part of OaSIS; kept as our own category (Lightcast Open Skills can replace it later)
categories.push({
  id: 'T', name: 'Tools and technologies', description: 'Software tools named in the CV. Not part of OaSIS.',
  subcategories: [
    { id: 'T.01', name: 'Data and analytics tools', skills: [
      { id: 'tool-excel', name: 'Microsoft Excel', description: 'Spreadsheets, formulas, pivot tables.' },
      { id: 'tool-sql', name: 'SQL', description: 'Querying relational databases.' },
      { id: 'tool-python', name: 'Python', description: 'General-purpose programming and data analysis.' },
      { id: 'tool-r', name: 'R', description: 'Statistical programming.' },
      { id: 'tool-bi', name: 'BI tools (Tableau, Power BI)', description: 'Dashboards and visual analytics.' } ] },
    { id: 'T.02', name: 'Productivity and design tools', skills: [
      { id: 'tool-powerpoint', name: 'PowerPoint / slides', description: 'Building presentations.' },
      { id: 'tool-figma', name: 'Figma / design tools', description: 'Interface and visual design.' },
      { id: 'tool-pm', name: 'Project tools (Jira, Asana, Notion)', description: 'Planning and tracking work.' } ] },
  ],
})
const nameToId = {}
categories.forEach(c => c.subcategories.forEach(s => s.skills.forEach(k => { nameToId[norm(k.name)] = k.id; nameToId[norm('Oral Communication: ' + k.name)] = k.id })))

// ---------- roles from OaSIS ratings (0-5 per occupation) ----------
const ROLES = [
  { id: 'business-analyst', name: 'Business Analyst / Consultant', noc: '11201.00' },
  { id: 'data-analyst', name: 'Data Analyst / Data Scientist', noc: '21211.00' },
  { id: 'business-systems', name: 'Business Systems Analyst', noc: '21221.00' },
  { id: 'financial-analyst', name: 'Financial Analyst', noc: '11101.01' },
  { id: 'marketing', name: 'Marketing / Communications', noc: '11202.00' },
  { id: 'hr', name: 'Human Resources Professional', noc: '11200.00' },
  { id: 'software', name: 'Software Developer', noc: '21232.00' },
  { id: 'admin-officer', name: 'Administrative Officer / Coordinator', noc: '13100.00' },
  { id: 'research-officer', name: 'Statistical / Research Officer', noc: '12113.00' },
]
const ratings = {}
for (const file of ['skills_oasis_2025.csv', 'abilities_oasis_2025.csv']) {
  const [head, ...rows] = readCsv(file)
  for (const r of rows) {
    const noc = r[0]
    ratings[noc] = ratings[noc] || { label: r[1], values: {} }
    head.slice(2).forEach((h, i) => { const id = nameToId[norm(h)]; if (id) ratings[noc].values[id] = Number(r[i + 2]) || 0 })
  }
}
const unmatched = new Set()
for (const file of ['skills_oasis_2025.csv', 'abilities_oasis_2025.csv']) readCsv(file)[0].slice(2).forEach(h => { if (!nameToId[norm(h)]) unmatched.add(h) })

const roles = ROLES.map(r => {
  const occ = ratings[r.noc]
  if (!occ) throw new Error('NOC not found: ' + r.noc)
  // Keep descriptors the occupation rates 3+ ("important"); entry-level target = rating - 1
  const oasis = Object.fromEntries(Object.entries(occ.values).filter(([, v]) => v >= 3))
  const requires = Object.fromEntries(Object.entries(oasis).map(([k, v]) => [k, Math.max(1, v - 1)]))
  return { ...r, nocLabel: occ.label, oasis, requires }
})

fs.writeFileSync(new URL('taxonomy.json', OUT), JSON.stringify({ source: 'OaSIS 2025 (ESDC, Open Government Licence – Canada)', categories }, null, 1))
fs.writeFileSync(new URL('roles.json', OUT), JSON.stringify({ source: 'OaSIS 2025 ratings', rule: 'Entry-level target = OaSIS occupational rating minus 1; only descriptors rated 3+ are listed.', roles }, null, 1))

const n = categories.reduce((a, c) => a + c.subcategories.reduce((b, s) => b + s.skills.length, 0), 0)
console.log(`taxonomy: ${categories.length} categories, ${n} descriptors`)
roles.forEach(r => console.log(`${r.noc} ${r.nocLabel}: ${Object.keys(r.requires).length} requirements`))
if (unmatched.size) console.log('Columns not in taxonomy (ignored):', [...unmatched].filter(h => !/strength|coordination|vision|dexterity|stamina|flexib|equilib|steadiness|hearing|sound|speech|colour|depth|glare|reaction|limb|wrist|settings|signal|rate control|spatial|perception/i.test(h)).join(', ') || 'only physical/sensory abilities')
