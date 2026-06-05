import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type UserRole = 'admin' | 'user'

export type SessionUser = {
  id: string
  username: string
  role: UserRole
  name: string
  email: string
  avatar: string
  photoData?: string
  createdAt: string
  lastLoginAt: string | null
}

export type AuthUser = SessionUser

export type LoginHistoryEntry = {
  id: string
  userId: string
  username: string
  at: string
  outcome: 'success' | 'failure'
  reason?: string
  userAgent?: string
}

type ProfileRow = {
  id: string
  username: string
  email: string | null
  name: string | null
  role: UserRole
  avatar: string | null
  photo_url: string | null
  bio: string | null
  preferred_currency: string | null
  created_at: string
  last_login_at: string | null
}

let cachedSessionUser: SessionUser | null = null
let lastLoginErrorMessage = ''

function rowToSessionUser(row: ProfileRow): SessionUser {
  return {
    id: row.id,
    username: row.username,
    role: row.role ?? 'user',
    name: row.name ?? row.username,
    email: row.email ?? '',
    avatar: row.avatar ?? (row.username ?? 'U').slice(0, 2).toUpperCase(),
    photoData: row.photo_url ?? undefined,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  }
}

async function fetchProfile(userId: string): Promise<SessionUser | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle<ProfileRow>()
  if (error || !data) return null
  return rowToSessionUser(data)
}

function buildFallbackSessionUser(input: {
  id: string
  username: string
  name: string
  email: string
}): SessionUser {
  const cleanUsername = input.username.trim() || 'kullanici'
  const cleanName = input.name.trim() || cleanUsername
  return {
    id: input.id,
    username: cleanUsername,
    role: 'user',
    name: cleanName,
    email: input.email.trim(),
    avatar: cleanUsername.slice(0, 2).toUpperCase(),
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  }
}

async function ensureProfileRow(input: {
  userId: string
  username: string
  name: string
  email: string
}): Promise<void> {
  const cleanEmail = input.email.trim()
  const fallbackFromEmail = cleanEmail.includes('@') ? cleanEmail.split('@')[0] : ''
  const cleanUsername =
    input.username.trim() || fallbackFromEmail || `user_${input.userId.slice(0, 8)}`
  const cleanName = input.name.trim() || cleanUsername
  await supabase.from('profiles').upsert(
    {
      id: input.userId,
      username: cleanUsername,
      name: cleanName,
      email: cleanEmail || null,
      avatar: cleanUsername.slice(0, 2).toUpperCase(),
    },
    { onConflict: 'id' },
  )
}

async function resolveEmailFromIdentifier(identifier: string): Promise<string | null> {
  const id = identifier.trim()
  if (id.includes('@')) return id
  const { data, error } = await supabase.rpc('get_email_by_username', {
    p_username: id,
  })
  if (!error && data && typeof data === 'string') {
    return data
  }
  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('email')
    .ilike('username', id)
    .not('email', 'is', null)
    .maybeSingle<{ email: string | null }>()
  if (profileError || !profileRow?.email) return null
  return profileRow.email
}

async function recordLoginHistory(
  userId: string | null,
  username: string,
  outcome: 'success' | 'failure',
  reason?: string,
): Promise<void> {
  try {
    await supabase.from('login_history').insert({
      user_id: userId,
      username,
      outcome,
      reason: reason ?? null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    })
  } catch {
    // ignore
  }
}

// Session

export async function refreshSessionUser(): Promise<SessionUser | null> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) {
    cachedSessionUser = null
    return null
  }
  let profile = await fetchProfile(data.session.user.id)
  if (!profile) {
    const meta = data.session.user.user_metadata as Record<string, unknown> | null
    const email = data.session.user.email ?? ''
    const usernameFromMeta = typeof meta?.username === 'string' ? meta.username : ''
    const nameFromMeta = typeof meta?.name === 'string' ? meta.name : ''
    const usernameFallback =
      usernameFromMeta || (email.includes('@') ? email.split('@')[0] : `user_${data.session.user.id.slice(0, 8)}`)
    await ensureProfileRow({
      userId: data.session.user.id,
      username: usernameFallback,
      name: nameFromMeta || usernameFallback,
      email,
    })
    profile = await fetchProfile(data.session.user.id)
  }
  if (!profile) {
    const email = data.session.user.email ?? ''
    const usernameFallback = email.includes('@') ? email.split('@')[0] : `user_${data.session.user.id.slice(0, 8)}`
    profile = buildFallbackSessionUser({
      id: data.session.user.id,
      username: usernameFallback,
      name: usernameFallback,
      email,
    })
  }
  cachedSessionUser = profile
  return profile
}

export function getSession(): SessionUser | null {
  return cachedSessionUser
}

export function getLastLoginError(): string {
  return lastLoginErrorMessage
}

export function onAuthChange(cb: (session: Session | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session)
  })
  return () => data.subscription.unsubscribe()
}

// Login / Register / Logout

export async function login(
  identifier: string,
  password: string,
): Promise<SessionUser | null> {
  lastLoginErrorMessage = ''
  const email = await resolveEmailFromIdentifier(identifier)
  if (!email) {
    lastLoginErrorMessage = 'Kullanıcı adı bulunamadı. E-posta ile giriş yapmayı dene.'
    await recordLoginHistory(null, identifier, 'failure', 'unknown_username')
    return null
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    if (error?.message?.toLowerCase().includes('email not confirmed')) {
      lastLoginErrorMessage = 'E-posta doğrulaması yapılmamış. Supabase Auth ayarından doğrulamayı kapat veya kullanıcıyı doğrula.'
    } else {
      lastLoginErrorMessage = 'Kullanıcı adı/e-posta veya şifre hatalı.'
    }
    await recordLoginHistory(null, identifier, 'failure', error?.message ?? 'invalid_credentials')
    return null
  }
  let profile = await fetchProfile(data.user.id)
  if (!profile) {
    const meta = data.user.user_metadata as Record<string, unknown> | null
    const usernameFromMeta = typeof meta?.username === 'string' ? meta.username : ''
    const nameFromMeta = typeof meta?.name === 'string' ? meta.name : ''
    const usernameFallback =
      usernameFromMeta || (identifier.includes('@') ? identifier.split('@')[0] : identifier)
    await ensureProfileRow({
      userId: data.user.id,
      username: usernameFallback,
      name: nameFromMeta || usernameFallback,
      email: data.user.email ?? email,
    })
    profile = await fetchProfile(data.user.id)
  }
  if (!profile) {
    profile = buildFallbackSessionUser({
      id: data.user.id,
      username: identifier.includes('@') ? identifier.split('@')[0] : identifier,
      name: identifier.includes('@') ? identifier.split('@')[0] : identifier,
      email: data.user.email ?? email,
    })
  }
  // Update last_login_at
  await supabase
    .from('profiles')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', data.user.id)
  await recordLoginHistory(data.user.id, profile.username, 'success')
  cachedSessionUser = { ...profile, lastLoginAt: new Date().toISOString() }
  return cachedSessionUser
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut()
  cachedSessionUser = null
}

export async function register(
  username: string,
  password: string,
  name: string,
  email: string,
): Promise<{ user: SessionUser } | { error: string }> {
  const cleanUsername = username.trim()
  const cleanEmail = email.trim()
  const cleanName = name.trim() || cleanUsername
  if (!cleanUsername) return { error: 'Kullanıcı adı gereklidir.' }
  if (!cleanEmail || !cleanEmail.includes('@')) return { error: 'Geçerli bir e-posta gir.' }
  if (password.length < 6) return { error: 'Şifre en az 6 karakter olmalıdır.' }

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: {
        username: cleanUsername,
        name: cleanName,
      },
    },
  })
  if (error) {
    if (error.message.toLowerCase().includes('already')) {
      return { error: 'Bu e-posta ile bir hesap zaten var.' }
    }
    return { error: error.message }
  }
  if (!data.user) {
    return { error: 'Kayıt tamamlanamadı.' }
  }

  await ensureProfileRow({
    userId: data.user.id,
    username: cleanUsername,
    name: cleanName,
    email: cleanEmail,
  })

  let profile: SessionUser | null = null
  for (let i = 0; i < 8 && !profile; i++) {
    profile = await fetchProfile(data.user.id)
    if (!profile) await new Promise((r) => setTimeout(r, 250))
  }
  if (!profile) {
    if (!data.session) {
      return {
        user: buildFallbackSessionUser({
          id: data.user.id,
          username: cleanUsername,
          name: cleanName,
          email: cleanEmail,
        }),
      }
    }
    return { error: 'Profil oluşturulamadı. Lütfen tekrar dene.' }
  }
  cachedSessionUser = profile
  return { user: profile }
}

// Password (change / reset)

export async function changePassword(
  _userId: string,
  oldPassword: string,
  newPassword: string,
): Promise<boolean> {
  if (newPassword.length < 6) return false
  const session = getSession()
  if (!session) return false
  // Verify old password by re-authenticating
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: session.email,
    password: oldPassword,
  })
  if (signInError) return false
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  return !error
}

export async function requestPasswordReset(
  identifier: string,
): Promise<{ ok: true } | { error: string }> {
  const email = await resolveEmailFromIdentifier(identifier)
  if (!email) {
    return { error: 'Bu kullanıcı adı veya e-postaya sahip bir hesap bulunamadı.' }
  }
  const redirectTo =
    typeof window !== 'undefined' ? `${window.location.origin}/sifre-sifirla` : undefined
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) return { error: error.message }
  return { ok: true }
}

export async function confirmPasswordResetSession(
  newPassword: string,
): Promise<{ ok: true } | { error: string }> {
  if (newPassword.length < 6) return { error: 'Şifre en az 6 karakter olmalıdır.' }
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { error: error.message }
  return { ok: true }
}

// Profile updates

export async function updateUserProfile(
  userId: string,
  updates: Partial<{
    name: string
    email: string
    avatar: string
    photoData: string
    bio: string
    preferred_currency: string
  }>,
): Promise<void> {
  const row: Record<string, unknown> = {}
  if (updates.name !== undefined) row.name = updates.name
  if (updates.email !== undefined) row.email = updates.email
  if (updates.avatar !== undefined) row.avatar = updates.avatar
  if (updates.photoData !== undefined) row.photo_url = updates.photoData
  if (updates.bio !== undefined) row.bio = updates.bio
  if (updates.preferred_currency !== undefined) row.preferred_currency = updates.preferred_currency
  if (Object.keys(row).length === 0) return
  const { error } = await supabase.from('profiles').update(row).eq('id', userId)
  if (error) {
    throw new Error(error.message)
  }
  if (cachedSessionUser?.id === userId) {
    cachedSessionUser = { ...cachedSessionUser, ...rowApplyToSession(row) }
  }
}

function rowApplyToSession(row: Record<string, unknown>): Partial<SessionUser> {
  const out: Partial<SessionUser> = {}
  if (typeof row.name === 'string') out.name = row.name
  if (typeof row.email === 'string') out.email = row.email
  if (typeof row.avatar === 'string') out.avatar = row.avatar
  if (typeof row.photo_url === 'string') out.photoData = row.photo_url
  return out
}

export function updateSession(session: SessionUser): void {
  cachedSessionUser = session
}

// Admin: users

export async function getUsers(): Promise<AuthUser[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return (data as ProfileRow[]).map(rowToSessionUser)
}

export async function deleteUser(userId: string): Promise<void> {
  // Removes the profile row; auth.users is removed via cascade only if admin
  // service-role is used. With anon-key this just clears the profile.
  await supabase.from('profiles').delete().eq('id', userId)
}

export async function setUserRole(userId: string, role: UserRole): Promise<boolean> {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
  if (error) {
    console.error('[auth] setUserRole failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      userId,
      role,
    })
    return false
  }
  if (cachedSessionUser?.id === userId) {
    cachedSessionUser = { ...cachedSessionUser, role }
  }
  return true
}

export async function adminResetPassword(
  _userId: string,
  _newPassword: string,
): Promise<boolean> {
  // Frontend with anon key cannot directly reset another user's password
  // without service-role access. Use Supabase Edge Function or Admin API.
  console.warn(
    '[auth] adminResetPassword: bu işlem için Supabase Edge Function gerekiyor (service-role).',
  )
  return false
}

export async function adminCreateUser(input: {
  username: string
  password: string
  name: string
  email: string
  role?: UserRole
}): Promise<{ user: AuthUser } | { error: string }> {
  // Admin-created accounts: signUp with the new user's email. The currently
  // logged-in admin will be signed out by signUp(), so we save+restore session.
  const { data: currentSession } = await supabase.auth.getSession()
  const result = await register(input.username, input.password, input.name, input.email)
  if ('error' in result) {
    if (currentSession.session) {
      await supabase.auth.setSession({
        access_token: currentSession.session.access_token,
        refresh_token: currentSession.session.refresh_token,
      })
    }
    return result
  }
  if (input.role === 'admin') {
    await supabase.from('profiles').update({ role: 'admin' }).eq('id', result.user.id)
  }
  // Restore the admin session
  if (currentSession.session) {
    await supabase.auth.setSession({
      access_token: currentSession.session.access_token,
      refresh_token: currentSession.session.refresh_token,
    })
    const restored = await fetchProfile(currentSession.session.user.id)
    if (restored) cachedSessionUser = restored
  }
  return { user: { ...result.user, role: input.role ?? 'user' } }
}

// Login history

export async function getLoginHistoryForUser(
  userId: string,
): Promise<LoginHistoryEntry[]> {
  const { data, error } = await supabase
    .from('login_history')
    .select('*')
    .eq('user_id', userId)
    .order('at', { ascending: false })
    .limit(50)
  if (error || !data) return []
  return data.map((r: Record<string, unknown>) => ({
    id: String(r.id),
    userId: String(r.user_id ?? ''),
    username: String(r.username ?? ''),
    at: String(r.at),
    outcome: r.outcome as 'success' | 'failure',
    reason: r.reason as string | undefined,
    userAgent: r.user_agent as string | undefined,
  }))
}

export async function getAllLoginHistory(): Promise<LoginHistoryEntry[]> {
  const { data, error } = await supabase
    .from('login_history')
    .select('*')
    .order('at', { ascending: false })
    .limit(200)
  if (error || !data) return []
  return data.map((r: Record<string, unknown>) => ({
    id: String(r.id),
    userId: String(r.user_id ?? ''),
    username: String(r.username ?? ''),
    at: String(r.at),
    outcome: r.outcome as 'success' | 'failure',
    reason: r.reason as string | undefined,
    userAgent: r.user_agent as string | undefined,
  }))
}


