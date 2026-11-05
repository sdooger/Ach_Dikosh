// Demonstration content. Everything here is fictional and labelled as demo data in the interface.

// Competencies shown to people, each linked to one OaSIS 2025 descriptor
export const COMPETENCIES = [
  { k: 'coordination', n: 'Project coordination', o: 'F.05.a.01' },
  { k: 'problem', n: 'Problem-solving', o: 'F.02.b.05' },
  { k: 'communication', n: 'Communication', o: 'F.01.a.03' },
  { k: 'writing', n: 'Written communication', o: 'F.01.b.02' },
  { k: 'analytical', n: 'Analytical thinking', o: 'B.05.a.02' },
  { k: 'critical', n: 'Critical thinking', o: 'F.02.a.01' },
  { k: 'decision', n: 'Decision-making', o: 'F.02.a.03' },
  { k: 'collaboration', n: 'Collaboration', o: 'B.01.b.02' },
  { k: 'adaptability', n: 'Adaptability', o: 'B.02.a.01' },
  { k: 'initiative', n: 'Initiative', o: 'B.03.a.07' },
  { k: 'leadership', n: 'Leadership', o: 'B.01.a.01' },
  { k: 'numeracy', n: 'Numeracy', o: 'F.01.c.01' },
  { k: 'business', n: 'Business understanding', o: 'G.01.a.02' },
  { k: 'time', n: 'Time management', o: 'F.04.b.05' },
  { k: 'negotiating', n: 'Negotiating', o: 'F.05.a.03' },
  { k: 'stress', n: 'Stress tolerance', o: 'B.02.a.03' },
  { k: 'creativity', n: 'Creativity', o: 'B.05.b.01' },
]
export const COMP = Object.fromEntries(COMPETENCIES.map(c => [c.k, c]))
export const COMP_BY_O = Object.fromEntries(COMPETENCIES.map(c => [c.o, c]))

// ---------- Maya ----------
export const MAYA = {
  profile: {
    full_name: 'Maya Fournier', headline: 'Fourth-year BComm student, Business Analytics',
    university: 'Haskayne School of Business, University of Calgary', field_of_study: 'Business Analytics', grad_year: 2026,
    location: 'Calgary, AB', interests: 'Analytics, operations, social impact', target_industries: 'Consulting, Retail, Non-profit',
    target_roles: 'Junior Business Analyst', target_role: 'business-analyst', discoverable: true, share_assessments: false, is_demo: true,
    intro: {
      motivation: 'I like turning messy situations into a plan people can follow. Seeing a project survive because we reorganised it, not because we got lucky, is what motivates me.',
      problems: 'Problems where the numbers and the people both matter, like keeping a volunteer project running when the money changes.',
      fields: 'Business analytics, operations and sustainability.',
      shaped: 'Coordinating the community garden when our main funder withdrew. I learned to make decisions with incomplete information.',
      beyond: 'My CV lists a volunteer role. What it does not show is that I rebuilt the plan and kept 50 people motivated through it.',
    },
  },
  cv: `Maya Fournier
Fourth-year BComm student, Business Analytics · Calgary, AB
EDUCATION
BComm, Business Analytics — Haskayne School of Business, University of Calgary, 2022–2026 (expected)
EXPERIENCE
Operations Intern — Bow River Foods, May 2025 – Aug 2025
Analysed weekly sales and waste data in Excel for 4 stores and presented findings to the operations manager.
Volunteer Coordinator — Community Garden Initiative, 2023 – 2025
Coordinated 50 student volunteers and restructured the project plan after the main funder withdrew.
Statistics Teaching Assistant — Department of Economics, Jan 2025 – Apr 2025
Ran weekly tutorials for 30 students.
CERTIFICATIONS
Google Data Analytics Certificate, 2024
EXTRACURRICULAR
Member, Haskayne Consulting Club — two case competitions
SKILLS
Excel, SQL, Tableau, Python (basic), English (native), French (intermediate)`,
  showcase: {
    kind: 'volunteering', title: 'Community Garden Initiative', role: 'Volunteer Coordinator', period: '2023 – 2025',
    situation: "The project's main funder withdrew during its second year, three months before the growing season.",
    contribution: 'I restructured the project strategy: we cut two low-impact activities, split the garden into plots run by student teams, and I coordinated 50 student volunteers across those teams.',
    challenge: 'Volunteers were worried the project would close, and two team leads disagreed about which activities to drop.',
    outcome: 'The initiative continued despite the funding setback and harvested about 80% of the previous year with a smaller budget.',
    skills: ['coordination', 'problem', 'communication', 'adaptability', 'initiative'],
    evidence_url: '',
  },
  big5: { o1: 4, o2: 2, c1: 5, c2: 2, e1: 4, e2: 2, a1: 4, a2: 3, n1: 4, n2: 3 },
  reasoning: [1, 2, 1, 1, 0, 1],
  feedback: { name: 'Sam (demo)', relationship: 'Teammate', skill: 'coordination', text: 'When the funder pulled out, Maya called a meeting the same week, showed us a new plan with three options and let the team leads choose. She kept a shared schedule so nobody was left without a plot. Volunteers stayed because she was clear about what would change.' },
}

// ---------- initial assessments ----------
export const BIG5 = [
  { id: 'o', name: 'Openness to Experience', about: 'Interest in new ideas, variety and unfamiliar approaches.', items: [['o1', 'I enjoy exploring new ideas and approaches.', false], ['o2', 'I prefer familiar routines over trying something new.', true]],
    low: 'You tend to prefer proven methods and familiar ways of working.', mid: 'You balance new approaches with proven methods.', high: 'You tend to seek out new ideas and unfamiliar problems.' },
  { id: 'c', name: 'Conscientiousness', about: 'Planning, organisation and following through on commitments.', items: [['c1', 'I plan my work and follow through on details.', false], ['c2', 'I often leave tasks until the last minute.', true]],
    low: 'You tend to work flexibly and adapt plans as you go.', mid: 'You plan when it matters and stay flexible otherwise.', high: 'You tend to plan ahead and keep track of details.' },
  { id: 'e', name: 'Extraversion', about: 'Energy drawn from social interaction and group settings.', items: [['e1', 'I feel energised when working with groups of people.', false], ['e2', 'I prefer to stay in the background in discussions.', true]],
    low: 'You tend to prefer focused, independent work and smaller groups.', mid: 'You are comfortable both in groups and working alone.', high: 'You tend to gain energy from groups and active discussion.' },
  { id: 'a', name: 'Agreeableness', about: 'Orientation toward cooperation, trust and considering others.', items: [['a1', "I try to understand other people's point of view.", false], ['a2', 'I find it hard to compromise when I disagree.', true]],
    low: 'You tend to hold your position firmly and challenge ideas directly.', mid: 'You balance standing your ground with finding common ground.', high: 'You tend to look for consensus and consider others first.' },
  { id: 'n', name: 'Emotional Stability', about: 'How calm and steady you tend to feel under pressure (the inverse of Neuroticism).', items: [['n1', 'I stay calm under pressure.', false], ['n2', 'I worry a lot about things that might go wrong.', true]],
    low: 'You tend to notice risks and feel pressure strongly.', mid: 'You usually stay steady, with some stress in demanding moments.', high: 'You tend to stay calm and steady under pressure.' },
]
export const LIKERT = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree']

export const REASONING = [
  { ab: 'A.01.a.04', domain: 'Logical sequences', q: 'What comes next: 2, 6, 12, 20, 30, …?', o: ['40', '42', '44'], a: 1 },
  { ab: 'A.01.a.04', domain: 'Logical sequences', q: 'What comes next: 3, 4, 7, 11, 18, …?', o: ['25', '27', '29'], a: 2 },
  { ab: 'A.01.c.03', domain: 'Matrix reasoning', q: 'Which symbol completes the grid?', grid: ['●', '○', '●', '○', '●', '○', '●', '○', '?'], o: ['○', '●', '◐'], a: 1 },
  { ab: 'A.01.a.03', domain: 'Abstract problem-solving', q: 'Every analyst on the team uses SQL. Dana does not use SQL. Which must be true?', o: ['Dana is new', 'Dana is not an analyst on the team', 'Some analysts skip SQL'], a: 1 },
  { ab: 'A.01.a.03', domain: 'Abstract problem-solving', q: 'If the report is late, the client complains. The client did not complain. So:', o: ['The report was not late', 'The report was late', 'We cannot tell'], a: 0 },
  { ab: 'A.01.b.02', domain: 'Quantitative reasoning', q: 'A price rises 20%, then falls 20%. Compared with the start it is:', o: ['the same', '4% lower', '4% higher'], a: 1 },
]

// ---------- marketplace ----------
export const CATEGORIES = ['Business Analytics', 'Finance', 'Marketing', 'Strategy', 'Technology', 'Innovation', 'Sustainability', 'Operations & Supply Chain', 'Entrepreneurship', 'Human Resources']
export const DEMO_TOPICS = [
  { id: 'demo-t1', title: 'Why can revenue increase while profitability declines?', category: 'Business Analytics', publisher: 'Maple Ridge Consulting (demo)', skills: ['analytical', 'critical', 'business'],
    description: "An online retailer's revenue increased by 15% last year, but its operating profit fell. What would you investigate first, and why?" },
  { id: 'demo-t2', title: 'Student retention without discounts', category: 'Marketing', publisher: 'Prairie Roast Coffee (demo)', skills: ['creativity', 'business', 'communication'],
    description: 'How could a Canadian coffee chain improve retention among university students without using discounts?' },
  { id: 'demo-t3', title: 'Less cafeteria food waste at the same cost', category: 'Operations & Supply Chain', publisher: 'University Partner (demo)', skills: ['problem', 'analytical', 'decision'],
    description: 'How could a university cafeteria reduce food waste without increasing operating costs?' },
  { id: 'demo-t4', title: 'A digital service for affordable student housing', category: 'Innovation', publisher: 'Northline Ventures (demo)', skills: ['creativity', 'initiative', 'problem'],
    description: "What practical digital service could improve students' access to affordable housing?" },
]
export const DEMO_CONTRIBUTIONS = [
  { id: 'dc1', topic_id: 'demo-t1', user_id: 'demo-032', author_label: 'Candidate 032 (demo)', created_at: '2026-10-28T10:00:00Z',
    idea: 'Check whether the extra revenue came from lower-margin products.', reasoning: 'If the sales mix shifted toward discounted or low-margin categories, revenue grows while margin shrinks.', implementation: 'Compare gross margin by product category for both years, then look at customer acquisition cost per order.', risks: 'Category data may be incomplete if returns are booked separately.' },
  { id: 'dc2', topic_id: 'demo-t1', user_id: 'demo-021', author_label: 'Candidate 021 (demo)', created_at: '2026-10-29T15:00:00Z',
    idea: 'Look at shipping and returns costs first.', reasoning: 'Online growth often brings free-shipping promotions and higher return rates.', implementation: '', risks: '' },
  { id: 'dc3', topic_id: 'demo-t3', user_id: 'demo-032', author_label: 'Candidate 032 (demo)', created_at: '2026-10-30T09:00:00Z',
    idea: 'Use pre-orders for the two most wasted dishes.', reasoning: 'Waste comes from guessing demand; pre-orders replace the guess with data at no extra cost.', implementation: 'Pilot for four weeks in one cafeteria using the existing app.', risks: 'Students may not change habits quickly.' },
]

// ---------- learning hub ----------
export const LEARN_CATEGORIES = ['Data Analysis', 'Financial Literacy', 'Business Strategy', 'Communication', 'Leadership Development', 'Digital Tools', 'Sustainability', 'Entrepreneurship']
export const COURSES = [
  { id: 'c-ba', title: 'Introduction to Business Analytics', provider: 'University Partner (demo)', type: 'university', category: 'Data Analysis', skills: ['analytical', 'numeracy', 'critical'], duration: '25 min', difficulty: 'Beginner', access: 'free',
    description: 'How analysts turn a business question into data, metrics and a recommendation.',
    sections: [
      ['Start with the question', 'Good analysis starts with a decision someone needs to make, not with the data. Write the question in one sentence: "Should we keep the free-shipping offer?" is better than "Look at the sales data".'],
      ['Choose metrics that answer it', 'Pick two or three metrics that would change the decision. Revenue alone rarely does; margin, cost per order or retention usually tell you more.'],
      ['Compare, then explain', 'A number means little alone. Compare with last period, another group or a target, then explain why the difference exists before recommending anything.'],
    ],
    example: 'A retailer sees revenue up 15%. Comparing gross margin by category shows the growth came from a discounted product line, so profit fell. The recommendation targets the mix, not total sales.',
    quiz: [
      { q: 'What should come first in an analysis?', o: ['Collecting as much data as possible', 'A clear business question', 'A dashboard'], a: 1 },
      { q: 'Revenue grew but profit fell. Which metric helps most next?', o: ['Total website visits', 'Gross margin by product category', 'Number of employees'], a: 1 },
      { q: 'Why compare a metric with another period or group?', o: ['To make charts look better', 'To judge whether a value is unusual', 'It is not useful'], a: 1 },
    ] },
  { id: 'c-sc', title: 'Understanding Supply Chain Decisions', provider: 'Northline Logistics (demo employer)', type: 'company', category: 'Business Strategy', skills: ['decision', 'problem', 'business'], duration: '20 min', difficulty: 'Beginner', access: 'sponsored',
    description: 'An industry introduction to the trade-offs logistics teams make every week.',
    sections: [
      ['How the industry works', 'A supply chain moves products from suppliers through warehouses to customers. Every step adds cost and time, and every buffer of stock protects against surprises.'],
      ['Typical operational challenges', 'Disruptions such as a supplier outage, a strike or a storm force teams to choose between cost, speed and customer promises. There is rarely an option that wins on all three.'],
      ['Making the trade-off explicit', 'Strong decisions name what is being protected (for example, hospital customers) and what is being sacrificed (for example, a slower delivery for retail). Stakeholders accept trade-offs they understand.'],
    ],
    example: 'When a supplier fire cut stock by 40%, Northline protected deliveries to clinics, delayed retail orders by a week and told retail customers the new date on day one.',
    task: 'In two sentences: which customers would you protect first in a stock shortage, and what would you tell the others?',
    quiz: [
      { q: 'Which three factors usually trade off in logistics decisions?', o: ['Cost, speed and service', 'Logo, colour and font', 'Hiring, firing and training'], a: 0 },
      { q: 'What makes a trade-off easier for stakeholders to accept?', o: ['Not mentioning it', 'Explaining what is protected and why', 'Delaying the announcement'], a: 1 },
      { q: 'Safety stock is mainly used to:', o: ['Increase marketing reach', 'Protect against supply surprises', 'Reduce staff costs'], a: 1 },
    ] },
  { id: 'c-com', title: 'Communicating with Data', provider: 'University Partner (demo)', type: 'university', category: 'Communication', skills: ['communication', 'writing'], duration: '15 min', difficulty: 'Beginner', access: 'premium',
    description: 'Write updates that lead with the decision and use numbers people remember.',
    sections: [
      ['Lead with the point', 'Put the recommendation or decision in the first sentence. Supporting detail follows for readers who need it.'],
      ['One number per idea', 'Choose the single number that carries each idea and round it. "Waste fell by a fifth" is easier to remember than "waste fell 19.7%".'],
    ],
    example: 'Before: "After reviewing the data across stores we noticed some trends…" After: "Cut the Tuesday delivery: it carries 30% of our waste and 8% of sales."',
    quiz: [
      { q: 'Where should the recommendation go in an update?', o: ['At the end', 'In the first sentence', 'In an appendix'], a: 1 },
      { q: 'Which is easier to remember?', o: ['"Waste fell 19.73%"', '"Waste fell by about a fifth"'], a: 1 },
    ] },
  { id: 'c-lead', title: 'Leading a Student Team Through Change', provider: 'University Partner (demo)', type: 'university', category: 'Leadership Development', skills: ['leadership', 'adaptability', 'coordination'], duration: '15 min', difficulty: 'Intermediate', access: 'premium',
    description: 'Keep volunteers motivated when the plan changes.',
    sections: [
      ['Say what changes and what does not', 'People handle change better when they know exactly what stays the same. Start there.'],
      ['Give people real choices', 'Let the team choose between two workable options rather than asking for open-ended input. It builds ownership without stalling decisions.'],
    ],
    example: 'A club lost its venue two weeks before an event. The lead kept the date and format, offered two new venues and let the committee vote the same day.',
    quiz: [
      { q: 'What reduces anxiety during a change?', o: ['Saying what stays the same', 'Announcing everything at once without detail'], a: 0 },
      { q: 'A good way to involve the team is to:', o: ['Ask "any ideas?" with no options', 'Offer two workable options to choose from'], a: 1 },
    ] },
]

// ---------- employer side ----------
export const DEMO_COMPANY = { name: 'Maple Ridge Consulting (demo)', industry: 'Management consulting', description: 'A fictional Calgary consulting firm used for the Achievers demonstration.', website: '', locations: 'Calgary, AB', focus: 'Graduate analysts' }
export const DEMO_JOBS = [
  { id: 'demo-job-ba', title: 'Junior Business Analyst', company: 'Maple Ridge Consulting (demo)', location: 'Calgary, AB · Hybrid', employment_type: 'Full-time, new graduate', deadline: '2026-12-15',
    description: 'Join a small team helping Western Canadian retailers and non-profits make better operating decisions. You will analyse data, build simple models and present recommendations to clients.',
    qualifications: 'Final-year student or recent graduate in business, economics, analytics or a related field. Excel required; SQL is an asset.',
    skills: ['analytical', 'problem', 'communication', 'business'],
    assessment: { format: 'individual-short', duration: 20, difficulty: 'Entry level', context: 'Retail', competencies: ['analytical', 'problem', 'decision', 'communication'], group: true } },
  { id: 'demo-job-ops', title: 'Operations Analyst Intern', company: 'Northline Logistics (demo)', location: 'Edmonton, AB', employment_type: 'Summer internship', deadline: '2027-01-31',
    description: 'Support the planning team on stock allocation and delivery performance during a busy season.',
    qualifications: 'Students in any program with strong numeracy.', skills: ['problem', 'decision', 'collaboration'],
    assessment: { format: 'group', duration: 30, difficulty: 'Entry level', context: 'Logistics', competencies: ['collaboration', 'decision', 'communication'], group: true } },
]
export const STATUSES = ['Application Received', 'Initial Screening', 'Assessment Invited', 'Assessment in Progress', 'Assessment Completed', 'Shortlisted', 'Interview Scheduled', 'Final Decision']

export const DEMO_CANDIDATES = [
  { id: 'demo-021', label: 'Candidate 021 (demo)', field: 'Economics', education: 'BSc Economics · 4th year', interests: 'Finance, public policy', discoverable: true,
    experiences: [
      { kind: 'organization', title: 'Student society conference', role: 'Treasurer', situation: 'Annual 200-person conference with a fixed budget.', contribution: 'Managed a $14k budget and sponsor payments.', challenge: 'A sponsor paid late.', outcome: 'Event ran on budget.', source: 'self' },
      { kind: 'work', title: 'Retail associate', role: 'Sales associate', contribution: 'Weekend shifts in a busy store.', source: 'imported' },
    ],
    evidence: [
      { skill_id: 'F.04.a.01', source: 'self', title: 'Conference budget', level: 2 },
      { skill_id: 'F.02.a.01', source: 'imported', title: 'Econometrics coursework', level: 1 },
      { skill_id: 'F.01.a.03', source: 'peer', title: 'Society president', detail: '"Explained a budget cut to the whole board clearly."', level: 3 },
      { skill_id: 'B.05.a.02', source: 'assessed', title: 'Simulation: Junior Business Analyst', level: 2 },
      { skill_id: 'F.02.a.03', source: 'assessed', title: 'Simulation: Junior Business Analyst', level: 3 },
    ],
    assessments: [{ kind: 'individual', title: 'Profit decline simulation', objective: '6 / 9', results: [['analytical', 'developing', 'Investigated returns and shipping first; found one of two drivers.'], ['decision', 'strong', 'Prioritised the mix review before cutting marketing.'], ['communication', 'pending', 'Recommendation awaiting human review.']] }],
    status: { 'demo-job-ba': 'Assessment Completed' } },
  { id: 'demo-032', label: 'Candidate 032 (demo)', field: 'Finance', education: 'BComm Finance · 3rd year', interests: 'Analytics, retail', discoverable: true,
    experiences: [
      { kind: 'volunteering', title: 'Community fundraising event', role: 'Fundraising lead', situation: 'Food bank fundraiser.', contribution: 'Recruited 12 local sponsors.', challenge: 'Venue cancelled two weeks out.', outcome: 'Raised $9,000.', source: 'self' },
    ],
    evidence: [
      { skill_id: 'F.05.a.04', source: 'self', title: 'Recruited 12 sponsors', level: 3 },
      { skill_id: 'B.05.a.02', source: 'contribution', title: 'Marketplace: revenue vs profitability', level: 2 },
      { skill_id: 'B.05.a.02', source: 'assessed', title: 'Simulation: Junior Business Analyst', level: 3 },
      { skill_id: 'F.02.b.05', source: 'assessed', title: 'Simulation: Junior Business Analyst', level: 2 },
      { skill_id: 'B.01.b.02', source: 'assessed', title: 'Group: supply chain disruption', level: 3 },
      { skill_id: 'F.02.a.01', source: 'learning', title: 'Introduction to Business Analytics', level: 1 },
    ],
    assessments: [
      { kind: 'individual', title: 'Profit decline simulation', objective: '8 / 9', results: [['analytical', 'strong', 'Checked margin by category and acquisition cost; found both drivers.'], ['problem', 'developing', 'Proposed actions; trade-offs only partly explained.'], ['communication', 'pending', 'Recommendation awaiting human review.']] },
      { kind: 'group', title: 'Supply chain disruption', objective: '—', results: [['collaboration', 'strong', 'Built on two teammates’ proposals in the final plan.'], ['decision', 'developing', 'Agreed allocation; reasoning for retail delay was brief.']] },
    ],
    status: { 'demo-job-ba': 'Shortlisted' } },
]

// ---------- group challenge ----------
export const GROUP = {
  title: 'Responding to a supply chain disruption',
  context: 'A fire at your main supplier cuts available stock of a medical-grade cleaning product from 1,000 to 600 units this month. Three customer groups depend on you. The team must agree on an allocation and one mitigation option within the time limit.',
  segments: [['Hospitals and clinics', 400], ['Retail chains', 450], ['Online direct customers', 150]],
  options: [['air', 'Air-freight 150 units from a US supplier (+$18,000, arrives in 5 days)'], ['alt', 'Qualify a slower local supplier (no extra cost, 3 weeks)'], ['none', 'No mitigation: communicate delays only']],
  bots: [
    { name: 'Alex (demo applicant)', at: 4, type: 'proposal', text: 'I think hospitals should get their full 400 units. If clinics run out, that is a safety issue, not just a lost sale.' },
    { name: 'Priya (Northline employee, demo)', at: 12, type: 'question', text: 'Retail is our biggest account by revenue. If we cut them hard, how do we keep that relationship?' },
    { name: 'Alex (demo applicant)', at: 'reply', type: 'response', text: 'Good point. Whatever we decide, we should tell retail the new delivery date today.' },
    { name: 'Priya (Northline employee, demo)', at: 40, type: 'proposal', text: 'Air freight is expensive, but 150 extra units would let us give retail most of what they need. Worth it?' },
  ],
}
