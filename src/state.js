// Everything about the signed-in person, loaded once and refreshed after changes
import * as db from './db.js'

export const S = {
  started: false,
  view: 'candidate',
  cv: null, profile: {}, experiences: [], evidence: [], refs: [], personality: null, courses: [], contributions: [], applications: [], assessments: [],
}

export async function loadMe() {
  const uid = db.me()
  const [profile, experiences, evidence, refs, pers, courses, contributions, applications, assessments, cvs] = await Promise.all([
    db.getProfile(uid),
    db.list('experiences', { user_id: uid }),
    db.list('evidence', { user_id: uid }),
    db.list('reference_requests', { user_id: uid }),
    db.list('personality', { user_id: uid }),
    db.list('course_progress', { user_id: uid }),
    db.list('contributions', { user_id: uid }),
    db.list('applications', { candidate_id: uid }),
    db.list('assessments', { user_id: uid }),
    db.list('cv_documents', { user_id: uid }),
  ])
  Object.assign(S, { cv: cvs[cvs.length - 1] || null, profile: profile || {}, experiences, evidence, refs, personality: pers[0] || null, courses, contributions, applications, assessments })
  try { S.view = localStorage.getItem('achievers-view') || 'candidate' } catch {}
}

export function setView(v) { S.view = v; try { localStorage.setItem('achievers-view', v) } catch {} }
export const firstName = () => (S.profile.full_name || '').split(' ')[0]
