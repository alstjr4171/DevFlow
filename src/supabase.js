const SESSION_KEY = 'devflow_supabase_session'
const VERIFIER_KEY = 'devflow_pkce_verifier'

export const hasSupabaseConfig = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)

const config = {
  url: (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, ''),
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
}

function saveSession(session) {
  const normalized = {
    ...session,
    expires_at: session.expires_at || Math.floor(Date.now() / 1000) + (session.expires_in || 3600),
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(normalized))
  return normalized
}

function readSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null }
}

function baseRedirectUrl() {
  return new URL(import.meta.env.BASE_URL || '/', window.location.origin).toString()
}

function randomVerifier() {
  const bytes = crypto.getRandomValues(new Uint8Array(48))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function challengeFor(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function signInWithGitHub() {
  const verifier = randomVerifier()
  localStorage.setItem(VERIFIER_KEY, verifier)
  const challenge = await challengeFor(verifier)
  const params = new URLSearchParams({
    provider: 'github',
    redirect_to: baseRedirectUrl(),
    code_challenge: challenge,
    code_challenge_method: 's256',
    scopes: 'read:user user:email',
  })
  window.location.assign(`${config.url}/auth/v1/authorize?${params}`)
}

export async function getInitialSession() {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  if (code) {
    const verifier = localStorage.getItem(VERIFIER_KEY)
    if (!verifier) throw new Error('로그인 인증 정보를 찾을 수 없습니다. 다시 로그인해 주세요.')
    const response = await fetch(`${config.url}/auth/v1/token?grant_type=pkce`, {
      method: 'POST',
      headers: { apikey: config.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.msg || result.message || 'GitHub 로그인을 완료하지 못했습니다.')
    localStorage.removeItem(VERIFIER_KEY)
    window.history.replaceState({}, document.title, window.location.pathname)
    return saveSession(result)
  }

  const session = readSession()
  if (!session?.refresh_token) return null
  if (session.expires_at && session.expires_at * 1000 > Date.now() + 60_000) return session

  const response = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: config.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  })
  const result = await response.json()
  if (!response.ok) {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
  return saveSession(result)
}

export async function signOut() {
  const session = readSession()
  if (session?.access_token) {
    await fetch(`${config.url}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: config.anonKey, Authorization: `Bearer ${session.access_token}` },
    }).catch(() => {})
  }
  localStorage.removeItem(SESSION_KEY)
}

async function currentAccessToken() {
  const session = await getInitialSession()
  if (!session?.access_token) throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.')
  return session.access_token
}

export async function loadUserData(userId) {
  const token = await currentAccessToken()
  const url = new URL(`${config.url}/rest/v1/devflow_user_data`)
  url.searchParams.set('select', 'tasks,projects,github_username')
  url.searchParams.set('user_id', `eq.${userId}`)
  const response = await fetch(url, {
    headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`계정 데이터를 불러오지 못했습니다 (${response.status}). ${detail}`)
  }
  const rows = await response.json()
  return rows[0] || null
}

export async function saveUserData(userId, data) {
  const token = await currentAccessToken()
  const response = await fetch(`${config.url}/rest/v1/devflow_user_data?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({ user_id: userId, ...data, updated_at: new Date().toISOString() }),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`계정 데이터를 저장하지 못했습니다 (${response.status}). ${detail}`)
  }
}
