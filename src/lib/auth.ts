export type UserRole = 'admin' | 'user'

export type AuthUser = {
  id: string
  username: string
  passwordHash: string
  role: UserRole
  name: string
  email: string
  avatar: string
  photoData?: string
  createdAt: string
  lastLoginAt: string | null
}

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

const USERS_KEY = 'fintech-users-v2'
const SESSION_KEY = 'fintech-session-v2'

function simpleHash(str: string): string {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0
  }
  return h.toString(36)
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function seedUsers(): AuthUser[] {
  return [
    {
      id: 'admin-001',
      username: 'admin',
      passwordHash: simpleHash('admin123'),
      role: 'admin',
      name: 'Sistem Admini',
      email: 'admin@fintech.local',
      avatar: 'SA',
      createdAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
      lastLoginAt: null,
    },
    {
      id: 'user-001',
      username: 'demo',
      passwordHash: simpleHash('demo123'),
      role: 'user',
      name: 'Demo Yatırımcı',
      email: 'demo@fintech.local',
      avatar: 'DY',
      createdAt: new Date(Date.now() - 14 * 86_400_000).toISOString(),
      lastLoginAt: null,
    },
  ]
}

export function getUsers(): AuthUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    if (!raw) {
      const defaults = seedUsers()
      localStorage.setItem(USERS_KEY, JSON.stringify(defaults))
      return defaults
    }
    return JSON.parse(raw) as AuthUser[]
  } catch {
    return seedUsers()
  }
}

function saveUsers(users: AuthUser[]): void {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users))
  } catch {
    // ignore quota exceeded
  }
}

function toSession(user: AuthUser): SessionUser {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    photoData: user.photoData,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  }
}

export function login(username: string, password: string): SessionUser | null {
  const users = getUsers()
  const hash = simpleHash(password)
  const user = users.find((u) => u.username === username && u.passwordHash === hash)
  if (!user) return null
  const now = new Date().toISOString()
  saveUsers(users.map((u) => (u.id === user.id ? { ...u, lastLoginAt: now } : u)))
  const session = { ...toSession(user), lastLoginAt: now }
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // ignore
  }
  return session
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY)
}

export function getSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as SessionUser) : null
  } catch {
    return null
  }
}

export function updateSession(session: SessionUser): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // ignore
  }
}

export function register(
  username: string,
  password: string,
  name: string,
  email: string,
): { user: SessionUser } | { error: string } {
  const users = getUsers()
  if (users.some((u) => u.username === username)) {
    return { error: 'Bu kullanıcı adı zaten kullanılıyor.' }
  }
  if (password.length < 6) {
    return { error: 'Şifre en az 6 karakter olmalıdır.' }
  }
  const now = new Date().toISOString()
  const newUser: AuthUser = {
    id: makeId(),
    username,
    passwordHash: simpleHash(password),
    role: 'user',
    name: name.trim() || username,
    email,
    avatar: (name.trim() || username).slice(0, 2).toUpperCase(),
    createdAt: now,
    lastLoginAt: now,
  }
  saveUsers([...users, newUser])
  const session = toSession(newUser)
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // ignore
  }
  return { user: session }
}

export function updateUserProfile(
  userId: string,
  updates: Partial<Pick<AuthUser, 'name' | 'email' | 'avatar' | 'photoData'>>,
): void {
  const users = getUsers()
  saveUsers(users.map((u) => (u.id === userId ? { ...u, ...updates } : u)))
  const session = getSession()
  if (session?.id === userId) {
    updateSession({ ...session, ...updates })
  }
}

export function deleteUser(userId: string): void {
  const users = getUsers()
  saveUsers(users.filter((u) => u.id !== userId))
}

export function changePassword(userId: string, oldPassword: string, newPassword: string): boolean {
  const users = getUsers()
  const user = users.find((u) => u.id === userId)
  if (!user || user.passwordHash !== simpleHash(oldPassword)) return false
  if (newPassword.length < 6) return false
  saveUsers(users.map((u) => (u.id === userId ? { ...u, passwordHash: simpleHash(newPassword) } : u)))
  return true
}
