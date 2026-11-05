# Achievers — talent platform prototype

All four stages, with a Candidate / Employer switch:

1. **Register / Discover** — onboarding, CV upload with editable extraction, experience showcase, Big Five (illustrative) and reasoning questions, Skill Fingerprint with evidence labels, privacy settings, "Load Maya's example".
2. **Develop & Express** — topic Marketplace with structured contributions and replies, Learning Hub with knowledge checks and a one-free-course-a-month rule, Meet me through others (referee links).
3. **Demonstrate** — apply or accept an invitation, individual profit-decline simulation (randomised values, auto-scored steps, human review for the written part), group supply-chain simulation with scripted demo participants.
4. **Connect** — talent discovery, job posting with assessment settings, anonymous mini-CV, pipeline with 8 statuses, side-by-side comparison, assessment reports with human evaluation, interview invitations.

Stack: Vite (plain JavaScript) · Supabase (auth, Postgres, file storage) · Netlify (hosting).

## Run locally

```bash
npm install
cp .env.example .env    # optional: without it the app runs in guest mode
npm run dev
```

## Deploy (about 10 minutes)

### 1. Supabase
1. Create a project at supabase.com (free tier).
2. **SQL Editor → New query** → paste `supabase/schema.sql` → **Run**. Then a new query with `supabase/schema_v2.sql` → **Run**.
3. **Authentication → Providers → Email**: for the demo, turn **Confirm email** off so sign-up logs people in immediately.
4. **Project Settings → API**: copy the **Project URL** and the **anon public** key.

### 2. Netlify
1. **Add new site → Import an existing project** → pick this GitHub repo.
2. Build command `npm run build`, publish directory `dist` (already in `netlify.toml`).
3. **Site configuration → Environment variables**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Deploy. Then in Supabase **Authentication → URL Configuration**, set the Site URL to your Netlify address.

## Where things live

| Path | What it is |
|---|---|
| `data/taxonomy.json` | Skill tree: category → sub-category → skill |
| `data/aliases.json` | Phrases that count as evidence for each OaSIS descriptor (edit to improve matching) |
| `data/roles.json` | Target roles and the level (1–5) each needs per skill |
| `src/match.js` | Matching rules and evidence levels |
| `src/store.js` | Database access (Supabase or guest/localStorage) |
| `supabase/schema.sql` | Tables, row-level security, referee functions, CV bucket |

## How evidence levels work

- **1** skill mentioned · **2** done with ownership (led, built, organised…) · **3** with a measurable result (numbers, %).
- CV and self-reported evidence stop at 3. +1 when the skill shows up in 3+ places, +1 when a second kind of source (peer, test) confirms it. Max 5.
- No overall score is ever calculated.

## Data sources

- **Taxonomy:** OaSIS 2025 guide (ESDC) — Skills, Cognitive abilities, Personal attributes and Knowledge (120 descriptors). Physical and sensory abilities, work context and interests are left out. Tools (Excel, SQL…) are our own category because OaSIS does not list them.
- **Role requirements:** OaSIS 2025 skill and ability ratings (0–5) for 9 NOC occupations (see `scripts/build-taxonomy.mjs`). Only descriptors rated 3+ are kept, and the entry-level target is the rating minus 1.
- Raw files are in `data/raw/`. To change roles, edit the `ROLES` list in the script and run `npm run import-taxonomy`.
- Licence: Open Government Licence – Canada. Contains information licensed under the Open Government Licence – Canada.
