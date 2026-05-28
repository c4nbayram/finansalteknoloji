import { useState, useEffect, useRef } from 'react'
import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  Bot,
  BookOpen,
  CheckCircle,
  Eye,
  FileText,
  Image,
  Key,
  LayoutDashboard,
  LogOut,
  Mail,
  Moon,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Sun,
  Trash2,
  TrendingUp,
  Upload,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react'
import {
  login,
  logout as authLogout,
  getUsers,
  deleteUser,
  adminCreateUser,
  adminResetPassword,
  refreshSessionUser,
  onAuthChange,
  type SessionUser,
  type AuthUser,
} from './lib/auth'
import {
  getLogs,
  clearLogs,
  fetchLogsFromServer,
  subscribeLogs,
  type LogEntry,
} from './lib/logger'
import {
  fetchAllPosts,
  upsertEduPost,
  deleteEduPost,
  fetchAllTickets,
  setTicketStatus as dbSetTicketStatus,
  deleteTicket as dbDeleteTicket,
  fetchBotState,
  uploadBlogCover,
  type DbSupportTicket,
} from './lib/db'
import { supabase } from './lib/supabase'
import './AdminApp.css'


export type EduCategory =
  | 'teknik-analiz'
  | 'risk-yonetimi'
  | 'kriptopara'
  | 'forex'
  | 'hisse'
  | 'genel'

export type EduPost = {
  id: string
  title: string
  topic: string
  summary: string
  paragraphs: string[]
  category: EduCategory
  gradient: [string, string]
  icon: string
  coverImage?: string
  author: string
  createdAt: string
  publishedAt: string | null
}

type SupportTicket = {
  id: string
  userId: string
  subject: string
  message: string
  email: string
  senderName: string
  senderUsername: string
  senderRole: 'admin' | 'user'
  createdAt: string
  status: 'open' | 'closed'
}

const ADMIN_THEME_KEY = 'fintech-admin-theme'

const CATEGORY_META: Record<EduCategory, { label: string; gradient: [string, string]; icon: string }> = {
  'teknik-analiz': { label: 'Teknik Analiz', gradient: ['#2563eb', '#0ea5e9'], icon: '📈' },
  'risk-yonetimi': { label: 'Risk Yönetimi', gradient: ['#7c3aed', '#c026d3'], icon: '🛡️' },
  kriptopara: { label: 'Kripto Para', gradient: ['#f59e0b', '#ef4444'], icon: '₿' },
  forex: { label: 'Forex / Döviz', gradient: ['#10b981', '#0d9488'], icon: '💱' },
  hisse: { label: 'Hisse Senedi', gradient: ['#3b82f6', '#6366f1'], icon: '📊' },
  genel: { label: 'Genel Finans', gradient: ['#64748b', '#475569'], icon: '💼' },
}


function dbRowToEduPost(r: {
  id: string
  title: string
  topic: string
  summary: string
  paragraphs: string[]
  category: string
  coverImageUrl: string | null
  author: string
  createdAt: string
  publishedAt: string | null
}): EduPost {
  const cat = (r.category as EduCategory) in CATEGORY_META ? (r.category as EduCategory) : 'genel'
  const meta = CATEGORY_META[cat]
  return {
    id: r.id,
    title: r.title,
    topic: r.topic,
    summary: r.summary,
    paragraphs: r.paragraphs,
    category: cat,
    gradient: meta.gradient,
    icon: meta.icon,
    coverImage: r.coverImageUrl ?? undefined,
    author: r.author,
    createdAt: r.createdAt,
    publishedAt: r.publishedAt,
  }
}

export async function getEduPosts(): Promise<EduPost[]> {
  const rows = await fetchAllPosts()
  return rows.map(dbRowToEduPost)
}

function hydrateSupportTickets(rows: DbSupportTicket[], users: AuthUser[]): SupportTicket[] {
  const usersById = new Map(users.map((u) => [u.id, u] as const))
  return rows.map((r) => {
    const user = usersById.get(r.userId)
    return {
      id: r.id,
      userId: r.userId,
      subject: r.subject,
      message: r.message,
      email: r.email,
      senderName: user?.name ?? '-',
      senderUsername: user?.username ?? '-',
      senderRole: user?.role ?? 'user',
      createdAt: r.createdAt,
      status: r.status,
    }
  })
}


async function generateArticle(
  topic: string,
  category: EduCategory,
  apiKey: string,
  model: string,
): Promise<{ title: string; summary: string; paragraphs: string[] }> {
  const catLabel = CATEGORY_META[category].label
  const prompt = `Sen bir finansal teknolojiler eğitim platformu için içerik yazarısın.
"${topic}" konusunda (kategori: ${catLabel}) profesyonel ve eğitici bir makale yaz.

ZORUNLU FORMAT - Sadece JSON döndür, başka hiçbir şey yok:
{
  "title": "Çarpıcı ve kısa bir başlık (10-12 kelime max)",
  "summary": "Tek cümlelik özet (okuyucuyu çekecek)",
  "paragraphs": [
    "Birinci paragraf: Konuya giriş ve neden önemli olduğu (120-180 kelime)",
    "İkinci paragraf: Temel kavramlar ve nasıl çalıştığı (130-180 kelime)",
    "Üçüncü paragraf: Pratik örnekler ve uygulama (130-180 kelime)",
    "Dördüncü paragraf: Dikkat edilmesi gerekenler ve riskler (120-160 kelime)",
    "Beşinci paragraf: Yatırımcı için pratik tavsiyeler ve özet (120-150 kelime)"
  ]
}

ÖNEMLİ:
- Tüm içerik Türkçe olacak
- Her paragraf bağımsız ve bilgi dolu olmalı
- Teknik terimleri sade bir dille açıkla
- Yatırım tavsiyesi verme, eğitici kalıpla yaz`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.75,
      max_tokens: 1800,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    throw new Error(err?.error?.message ?? `OpenAI hatası: ${res.status}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data.choices?.[0]?.message?.content ?? ''
  const parsed = JSON.parse(content) as {
    title: string
    summary: string
    paragraphs: string[]
  }
  if (!parsed.title || !Array.isArray(parsed.paragraphs))
    throw new Error('Geçersiz yanıt formatı')
  return parsed
}


export default function AdminApp() {
  const [session, setSession] = useState<SessionUser | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem(ADMIN_THEME_KEY) ?? 'dark') as 'light' | 'dark'
  })

  useEffect(() => {
    document.documentElement.dataset.adminTheme = theme
    localStorage.setItem(ADMIN_THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    let mounted = true
    void (async () => {
      const s = await refreshSessionUser()
      if (!mounted) return
      setSession(s?.role === 'admin' ? s : null)
      setAuthReady(true)
    })()
    const unsub = onAuthChange(async (sb) => {
      if (!sb) {
        setSession(null)
        return
      }
      const s = await refreshSessionUser()
      setSession(s?.role === 'admin' ? s : null)
    })
    return () => {
      mounted = false
      unsub()
    }
  }, [])

  async function handleLogout() {
    await authLogout()
    setSession(null)
    setTickets([])
  }

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  useEffect(() => {
    if (!session) return
    let cancelled = false

    const refreshTickets = async () => {
      const [rows, users] = await Promise.all([fetchAllTickets(), getUsers()])
      if (cancelled) return
      setTickets(hydrateSupportTickets(rows, users))
    }

    void refreshTickets()

    const channel = supabase
      .channel(`admin-support-${session.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_tickets' },
        () => {
          void refreshTickets()
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [session?.id])

  if (!session) {
    if (!authReady) {
      return (
        <div className="admin-login-page" data-admin-theme={theme}>
          <div style={{ color: 'var(--a-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <RefreshCw size={18} className="admin-spin" /> Oturum yükleniyor...
          </div>
        </div>
      )
    }
    return (
      <AdminLoginPage
        onLogin={(s) => setSession(s)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    )
  }

  return (
    <div className="admin-root" data-admin-theme={theme}>
      <AdminSidebar
        session={session}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={toggleTheme}
        openTicketCount={tickets.filter((t) => t.status === 'open').length}
      />
      <main className="admin-main">
        <Routes>
          <Route path="/" element={<AdminDashboard session={session} tickets={tickets} />} />
          <Route path="/egitim" element={<ContentGeneratorPage session={session} />} />
          <Route path="/mesajlar" element={<MessagesPage tickets={tickets} onTicketsChange={setTickets} />} />
          <Route path="/kullanicilar" element={<UsersPage session={session} />} />
          <Route path="/loglar" element={<LogsPage />} />
          <Route path="/bot" element={<BotMonitorPage session={session} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}


function AdminLoginPage({
  onLogin,
  theme,
  onToggleTheme,
}: {
  onLogin: (s: SessionUser) => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const s = await login(username.trim(), password)
    setLoading(false)
    if (!s) {
      setError('Geçersiz kimlik bilgileri.')
      return
    }
    if (s.role !== 'admin') {
      setError('Bu panel yalnızca yöneticilere açıktır.')
      return
    }
    onLogin(s)
  }

  return (
    <div className="admin-login-page" data-admin-theme={theme}>
      <button type="button" className="admin-login-theme-btn" onClick={onToggleTheme}>
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="admin-login-card">
        <div className="admin-login-brand">
          <div className="admin-login-icon">
            <ShieldCheck size={28} />
          </div>
          <div>
            <p className="admin-login-eyebrow">Yönetim Paneli</p>
            <h1 className="admin-login-title">Admin Girişi</h1>
          </div>
        </div>
        <p className="admin-login-sub">Bu alan yalnızca yetkili yöneticiler içindir.</p>

        <form className="admin-login-form" onSubmit={handleSubmit}>
          <label className="admin-field">
            <span>Kullanıcı Adı</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              required
            />
          </label>
          <label className="admin-field">
            <span>Şifre</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </label>
          {error && <div className="admin-login-error">{error}</div>}
          <button type="submit" className="admin-login-submit" disabled={loading}>
            {loading ? <RefreshCw size={16} className="admin-spin" /> : <ShieldCheck size={16} />}
            {loading ? 'Doğrulanıyor...' : 'Giriş Yap'}
          </button>
        </form>
        <p className="admin-login-note">
          Yalnızca <strong>admin</strong> rolüne sahip hesaplar girebilir.
        </p>
      </div>
    </div>
  )
}


const adminNavItems = [
  { path: '/', label: 'Genel Bakış', icon: LayoutDashboard, end: true },
  { path: '/egitim', label: 'İçerik Üretici', icon: BookOpen },
  { path: '/mesajlar', label: 'Mesajlar', icon: Mail },
  { path: '/kullanicilar', label: 'Kullanıcılar', icon: Users },
  { path: '/loglar', label: 'Sistem Logları', icon: Activity },
  { path: '/bot', label: 'Bot Monitörü', icon: Bot },
]

function AdminSidebar({
  session,
  onLogout,
  theme,
  onToggleTheme,
  openTicketCount,
}: {
  session: SessionUser
  onLogout: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  openTicketCount: number
}) {
  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <div className="admin-brand-icon">
          <ShieldCheck size={20} />
        </div>
        <div>
          <p className="admin-brand-eyebrow">Admin Panel</p>
          <h2 className="admin-brand-title">
            Finansal
            <br />
            Teknolojiler
          </h2>
        </div>
      </div>

      <div className="admin-sidebar-profile">
        <span className="admin-avatar">{session.avatar}</span>
        <div className="admin-sidebar-meta">
          <strong>{session.name}</strong>
          <small>@{session.username}</small>
        </div>
        <span className="admin-role-badge">Admin</span>
      </div>

      <nav className="admin-sidebar-nav">
        {adminNavItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                isActive ? 'admin-nav-link is-active' : 'admin-nav-link'
              }
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {item.path === '/mesajlar' && openTicketCount > 0 && (
                <span className="admin-nav-badge">{openTicketCount}</span>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="admin-sidebar-footer">
        <div className="admin-sidebar-divider" />
        <a
          href="http://localhost:5173"
          className="admin-nav-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          <TrendingUp size={18} />
          <span>Ana Siteye Git</span>
        </a>
        <button type="button" className="admin-nav-link" onClick={onToggleTheme}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          <span>{theme === 'dark' ? 'Açık Tema' : 'Koyu Tema'}</span>
        </button>
        <button type="button" className="admin-nav-link admin-logout" onClick={onLogout}>
          <LogOut size={18} />
          <span>Çıkış Yap</span>
        </button>
      </div>
    </aside>
  )
}


function AdminDashboard({ session, tickets }: { session: SessionUser; tickets: SupportTicket[] }) {
  const [posts, setPosts] = useState<EduPost[]>([])
  const [users, setUsers] = useState<AuthUser[]>([])
  const [botTradeCount, setBotTradeCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [p, u] = await Promise.all([
        getEduPosts(),
        getUsers(),
      ])
      if (cancelled) return
      setPosts(p)
      setUsers(u)
      const bs = await fetchBotState<{ trades?: unknown[] }>(session.id)
      if (!cancelled && bs && Array.isArray(bs.trades)) setBotTradeCount(bs.trades.length)
    })()
    return () => {
      cancelled = true
    }
  }, [session.id])

  const publishedPosts = posts.filter((p) => p.publishedAt)
  const openTickets = tickets.filter((t) => t.status === 'open')

  const stats = [
    {
      label: 'Yayınlı İçerik',
      value: publishedPosts.length,
      icon: FileText,
      color: '#3b82f6',
    },
    {
      label: 'Açık Mesaj',
      value: openTickets.length,
      icon: Mail,
      color: '#f59e0b',
      urgent: openTickets.length > 0,
    },
    {
      label: 'Kayıtlı Kullanıcı',
      value: users.length,
      icon: Users,
      color: '#10b981',
    },
    {
      label: 'Bot İşlemi',
      value: botTradeCount,
      icon: Bot,
      color: '#a855f7',
    },
  ]

  return (
    <div className="admin-page-stack">
      <div className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Genel Bakış</p>
          <h2>Hoş geldin, {session.name}</h2>
          <p className="admin-muted">
            {new Date().toLocaleDateString('tr-TR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>

      <div className="admin-stats-grid">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <div
              key={s.label}
              className={`admin-stat-card${s.urgent ? ' admin-stat-urgent' : ''}`}
              style={{ '--stat-color': s.color } as React.CSSProperties}
            >
              <div className="admin-stat-icon">
                <Icon size={20} />
              </div>
              <div>
                <strong className="admin-stat-value">{s.value}</strong>
                <p className="admin-stat-label">{s.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="admin-dash-grid">
        <div className="admin-card">
          <div className="admin-card-head">
            <FileText size={16} />
            <h3>Son İçerikler</h3>
          </div>
          {posts.length === 0 ? (
            <div className="admin-empty">
              <BookOpen size={28} />
              <p>
                Henüz içerik yok.{' '}
                <a href="/egitim">İlk içeriği oluştur</a>
              </p>
            </div>
          ) : (
            <div className="admin-post-mini-list">
              {posts.slice(0, 5).map((p) => (
                <div key={p.id} className="admin-post-mini">
                  <span
                    className="admin-post-mini-icon"
                    style={{
                      background: `linear-gradient(135deg, ${p.gradient[0]}, ${p.gradient[1]})`,
                    }}
                  >
                    {p.coverImage ? (
                      <img
                        src={p.coverImage}
                        alt={p.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
                      />
                    ) : (
                      p.icon
                    )}
                  </span>
                  <div>
                    <strong>{p.title}</strong>
                    <small>
                      {new Date(p.createdAt).toLocaleDateString('tr-TR')} ·{' '}
                      {p.publishedAt ? 'Yayında' : 'Taslak'}
                    </small>
                  </div>
                  <span className={p.publishedAt ? 'admin-badge green' : 'admin-badge yellow'}>
                    {p.publishedAt ? 'Yayında' : 'Taslak'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="admin-card">
          <div className="admin-card-head">
            <Mail size={16} />
            <h3>Son Mesajlar</h3>
          </div>
          {tickets.length === 0 ? (
            <div className="admin-empty">
              <Mail size={28} />
              <p>Henüz mesaj yok.</p>
            </div>
          ) : (
            <div className="admin-log-mini-list">
              {tickets.slice(0, 5).map((t) => (
                <div key={t.id} className="admin-log-mini">
                  <span
                    className="admin-log-dot"
                    style={{ background: t.status === 'open' ? '#f59e0b' : '#10b981' }}
                  />
                  <div>
                    <strong>{t.subject}</strong>
                    <small>
                      {t.senderName} (@{t.senderUsername}) · {t.email || 'E-posta yok'} ·{' '}
                      {new Date(t.createdAt).toLocaleDateString('tr-TR')}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


type GenerateState = 'idle' | 'generating' | 'preview' | 'error'
type DraftPost = Omit<EduPost, 'id' | 'createdAt' | 'publishedAt' | 'author'>

function ContentGeneratorPage({ session }: { session: SessionUser }) {
  const [posts, setPosts] = useState<EduPost[]>([])
  const [topic, setTopic] = useState('')
  const [category, setCategory] = useState<EduCategory>('genel')
  const [apiKey, setApiKey] = useState(
    () => (import.meta.env.VITE_OPENAI_API_KEY ?? '').trim(),
  )
  const [model, setModel] = useState(
    () => (import.meta.env.VITE_OPENAI_MODEL ?? 'gpt-4o-mini').trim(),
  )
  const [genState, setGenState] = useState<GenerateState>('idle')
  const [genError, setGenError] = useState('')
  const [dataError, setDataError] = useState('')
  const [draft, setDraft] = useState<DraftPost | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [preUploadedImage, setPreUploadedImage] = useState<string | undefined>(undefined)
  const [preUploadFile, setPreUploadFile] = useState<File | null>(null)
  const [draftCoverFile, setDraftCoverFile] = useState<File | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const preUploadRef = useRef<HTMLInputElement>(null)
  const editPhotoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void refreshPosts()
  }, [])

  async function refreshPosts() {
    try {
      const all = await getEduPosts()
      setPosts(all)
      setDataError('')
    } catch (err: unknown) {
      setDataError(err instanceof Error ? err.message : 'İçerikler alınamadı.')
    }
  }

  async function handleGenerate() {
    if (!topic.trim()) return
    if (!apiKey) {
      setGenError(
        'OpenAI API anahtarı eksik. .env dosyasına VITE_OPENAI_API_KEY ekleyin veya aşağıya girin.',
      )
      setGenState('error')
      return
    }
    setGenState('generating')
    setGenError('')
    try {
      const result = await generateArticle(topic.trim(), category, apiKey, model)
      const meta = CATEGORY_META[category]
      setDraft({
        title: result.title,
        topic: topic.trim(),
        summary: result.summary,
        paragraphs: result.paragraphs,
        category,
        gradient: meta.gradient,
        icon: meta.icon,
        coverImage: preUploadedImage,
      })
      setGenState('preview')
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : 'Bilinmeyen hata')
      setGenState('error')
    }
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>, forDraft = true) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const coverImage = ev.target?.result as string
      if (forDraft) {
        setDraft((d) => (d ? { ...d, coverImage } : d))
        setDraftCoverFile(file)
      }
    }
    reader.readAsDataURL(file)
  }

  async function savePost(publishNow: boolean) {
    if (!draft) return
    try {
      // Önce kapak resmini Supabase Storage'a yükle (dosya varsa)
      let coverUrl: string | null | undefined = draft.coverImage
      const fileToUpload = draftCoverFile ?? preUploadFile
      if (fileToUpload) {
        coverUrl = await uploadBlogCover(fileToUpload)
      } else if (draft.coverImage && draft.coverImage.startsWith('data:')) {
        // dataUrl => Blob => upload
        const { dataUrlToBlob } = await import('./lib/db')
        const blob = dataUrlToBlob(draft.coverImage)
        if (blob) {
          const file = new File([blob], 'cover.jpg', { type: blob.type })
          coverUrl = await uploadBlogCover(file)
        }
      }

      await upsertEduPost({
        title: draft.title,
        topic: draft.topic,
        summary: draft.summary,
        paragraphs: draft.paragraphs,
        category: draft.category,
        coverImageUrl: coverUrl ?? null,
        author: session.name,
        publishedAt: publishNow ? new Date().toISOString() : null,
      })
      await refreshPosts()
      setDraft(null)
      setDraftCoverFile(null)
      setGenState('idle')
      setTopic('')
      setPreUploadedImage(undefined)
      setPreUploadFile(null)
      setGenError('')
      setDataError('')
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : publishNow
            ? 'İçerik yayınlanamadı.'
            : 'Taslak kaydedilemedi.'
      setGenError(message)
      setGenState('error')
    }
  }

  async function togglePublish(postId: string) {
    const post = posts.find((p) => p.id === postId)
    if (!post) return
    try {
      await upsertEduPost({
        id: postId,
        publishedAt: post.publishedAt ? null : new Date().toISOString(),
      })
      await refreshPosts()
      setDataError('')
    } catch (err: unknown) {
      setDataError(err instanceof Error ? err.message : 'Yayın durumu güncellenemedi.')
    }
  }

  async function updatePostPhoto(postId: string, file: File) {
    try {
      const url = await uploadBlogCover(file)
      if (!url) {
        setDataError('Görsel yüklenemedi.')
        return
      }
      await upsertEduPost({ id: postId, coverImageUrl: url })
      await refreshPosts()
      setDataError('')
    } catch (err: unknown) {
      setDataError(err instanceof Error ? err.message : 'Görsel güncellenemedi.')
    }
  }

  async function handleDelete(postId: string) {
    if (deleteConfirm !== postId) {
      setDeleteConfirm(postId)
      return
    }
    try {
      await deleteEduPost(postId)
      await refreshPosts()
      setDeleteConfirm(null)
      setDataError('')
    } catch (err: unknown) {
      setDataError(err instanceof Error ? err.message : 'İçerik silinemedi.')
    }
  }

  const published = posts.filter((p) => p.publishedAt)
  const drafts = posts.filter((p) => !p.publishedAt)

  return (
    <div className="admin-page-stack">
      <div className="admin-page-header">
        <div>
          <p className="admin-eyebrow">İçerik Üretici</p>
          <h2>Blog & Eğitim İçerikleri</h2>
          <p className="admin-muted">
            OpenAI ile otomatik makale üret, fotoğraf ekle, düzenle ve yayınla.
          </p>
        </div>
        <div className="admin-header-meta">
          <span className="admin-badge blue">{published.length} Yayında</span>
          <span className="admin-badge yellow">{drafts.length} Taslak</span>
        </div>
      </div>

      {dataError && (
        <div className="admin-error-box">
          <AlertTriangle size={16} />
          {dataError}
        </div>
      )}

      {/* Generator Card */}
      <div className="admin-card admin-generator-card">
        <div className="admin-card-head">
          <Zap size={18} />
          <h3>AI İçerik Üretici</h3>
          {!apiKey && <span className="admin-badge red">OpenAI anahtarı yok</span>}
        </div>

        <div className="admin-generator-inputs">

          {/* Image BEFORE generation */}
          <div className="admin-field">
            <span>Kapak Görseli (İçerik üretilmeden önce yükle)</span>
            {preUploadedImage ? (
              <div className="admin-pre-img-wrap">
                <img src={preUploadedImage} alt="Kapak görseli önizleme" className="admin-pre-img" />
                <div className="admin-pre-img-actions">
                  <button type="button" className="admin-ghost-btn" onClick={() => preUploadRef.current?.click()}>
                    <Image size={14} /> Değiştir
                  </button>
                  <button type="button" className="admin-ghost-btn" onClick={() => setPreUploadedImage(undefined)}>
                    <Trash2 size={14} /> Kaldır
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="admin-cover-upload-zone admin-cover-upload-zone-sm" onClick={() => preUploadRef.current?.click()}>
                <Upload size={22} />
                <strong>Görsel yükle</strong>
                <small>PNG, JPG, WebP · 1200x630px önerilir</small>
              </button>
            )}
            <input
              ref={preUploadRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setPreUploadFile(file)
                const reader = new FileReader()
                reader.onload = (ev) => setPreUploadedImage(ev.target?.result as string)
                reader.readAsDataURL(file)
                e.target.value = ''
              }}
            />
          </div>

          <div className="admin-field-row">
            <label className="admin-field">
              <span>Konu / Topic</span>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="ör: RSI indikatörü nedir?, Stop-loss stratejileri, Bitcoin halving..."
                disabled={genState === 'generating'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleGenerate()
                }}
              />
            </label>
            <label className="admin-field admin-field-sm">
              <span>Kategori</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as EduCategory)}
                disabled={genState === 'generating'}
              >
                {(
                  Object.entries(CATEGORY_META) as [
                    EduCategory,
                    (typeof CATEGORY_META)[EduCategory],
                  ][]
                ).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {!import.meta.env.VITE_OPENAI_API_KEY && (
            <label className="admin-field">
              <span>OpenAI API Anahtarı (geçici)</span>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
              />
            </label>
          )}

          <label className="admin-field admin-field-inline">
            <span>Model:</span>
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="gpt-4o-mini">gpt-4o-mini (hızlı, ekonomik)</option>
              <option value="gpt-4o">gpt-4o (güçlü)</option>
              <option value="gpt-4-turbo">gpt-4-turbo</option>
            </select>
          </label>

          <button
            type="button"
            className="admin-primary-btn admin-generate-btn"
            onClick={() => void handleGenerate()}
            disabled={genState === 'generating' || !topic.trim()}
          >
            {genState === 'generating' ? (
              <>
                <RefreshCw size={16} className="admin-spin" /> Üretiliyor...
              </>
            ) : (
              <>
                <Zap size={16} /> İçerik Üret
              </>
            )}
          </button>

          {genState === 'error' && (
            <div className="admin-error-box">
              <AlertTriangle size={16} />
              {genError}
            </div>
          )}
        </div>
      </div>

      {/* Preview */}
      {genState === 'preview' && draft && (
        <div className="admin-card admin-preview-card">
          <div className="admin-card-head">
            <Eye size={18} />
            <h3>Önizleme & Düzenleme</h3>
            <div className="admin-card-actions">
              <button
                type="button"
                className="admin-ghost-btn"
                onClick={() => {
                  setDraft(null)
                  setGenState('idle')
                }}
              >
                <X size={14} /> İptal
              </button>
              <button
                type="button"
                className="admin-ghost-btn"
                onClick={() => savePost(false)}
              >
                <Save size={14} /> Taslak Kaydet
              </button>
              <button
                type="button"
                className="admin-primary-btn"
                onClick={() => savePost(true)}
              >
                <Send size={14} /> Yayınla
              </button>
            </div>
          </div>

          {/* Cover Image Area */}
          <div className="admin-preview-cover-wrap">
            {draft.coverImage ? (
              <div className="admin-cover-img-wrap">
                <img
                  src={draft.coverImage}
                  alt="Kapak görseli"
                  className="admin-cover-img"
                />
                <div className="admin-cover-img-overlay">
                  <button
                    type="button"
                    className="admin-ghost-btn"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    <Image size={14} /> Görseli Değiştir
                  </button>
                  <button
                    type="button"
                    className="admin-ghost-btn"
                    onClick={() => setDraft((d) => d ? { ...d, coverImage: undefined } : d)}
                  >
                    <Trash2 size={14} /> Kaldır
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="admin-cover-upload-zone"
                onClick={() => photoInputRef.current?.click()}
              >
                <Upload size={28} />
                <strong>Kapak Görseli Ekle</strong>
                <small>PNG, JPG, WebP · Önerilen: 1200x630px</small>
              </button>
            )}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => handlePhotoUpload(e, true)}
            />
          </div>

          {/* Preview Content */}
          <div
            className="admin-preview-cover"
            style={{
              background: `linear-gradient(135deg, ${draft.gradient[0]}, ${draft.gradient[1]})`,
            }}
          >
            <span className="admin-preview-icon">{draft.icon}</span>
            <div>
              <span className="admin-preview-category">
                {CATEGORY_META[draft.category].label}
              </span>
              <h2 className="admin-preview-title">{draft.title}</h2>
              <p className="admin-preview-summary">{draft.summary}</p>
            </div>
          </div>

          <div className="admin-preview-edit">
            <label className="admin-field">
              <span>Başlığı Düzenle</span>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft((d) => d ? { ...d, title: e.target.value } : d)}
              />
            </label>
            <label className="admin-field">
              <span>Özet</span>
              <input
                type="text"
                value={draft.summary}
                onChange={(e) => setDraft((d) => d ? { ...d, summary: e.target.value } : d)}
              />
            </label>
          </div>

          <div className="admin-preview-body">
            {draft.paragraphs.map((p, i) => (
              <div key={i} className="admin-preview-para-edit">
                <textarea
                  value={p}
                  rows={4}
                  onChange={(e) => {
                    const updated = [...draft.paragraphs]
                    updated[i] = e.target.value
                    setDraft((d) => d ? { ...d, paragraphs: updated } : d)
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Posts List */}
      <div className="admin-card">
        <div className="admin-card-head">
          <FileText size={18} />
          <h3>Tüm İçerikler ({posts.length})</h3>
          <button type="button" className="admin-ghost-btn" onClick={refreshPosts}>
            <RefreshCw size={14} /> Yenile
          </button>
        </div>

        {posts.length === 0 ? (
          <div className="admin-empty">
            <BookOpen size={36} />
            <p>Henüz içerik yok. Yukarıdan bir konu girerek AI'a ürettir.</p>
          </div>
        ) : (
          <div className="admin-posts-list">
            {posts.map((post) => (
              <div key={post.id} className="admin-post-row">
                <div
                  className="admin-post-cover-mini"
                  style={{
                    background: post.coverImage
                      ? 'transparent'
                      : `linear-gradient(135deg, ${post.gradient[0]}, ${post.gradient[1]})`,
                  }}
                >
                  {post.coverImage ? (
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: 12,
                      }}
                    />
                  ) : (
                    <span>{post.icon}</span>
                  )}
                </div>
                <div className="admin-post-info">
                  <strong>{post.title}</strong>
                  <small>
                    {CATEGORY_META[post.category].label} ·{' '}
                    {new Date(post.createdAt).toLocaleDateString('tr-TR')} ·{' '}
                    {post.paragraphs.length} paragraf
                    {post.coverImage ? ' · Görsel' : ''}
                  </small>
                  <p className="admin-post-summary">{post.summary}</p>
                </div>
                <div className="admin-post-actions">
                  <span className={post.publishedAt ? 'admin-badge green' : 'admin-badge yellow'}>
                    {post.publishedAt ? 'Yayında' : 'Taslak'}
                  </span>
                  {/* Quick photo upload for existing posts */}
                  <label
                    className="admin-ghost-btn"
                    style={{ cursor: 'pointer' }}
                    title="Kapak görseli ekle/değiştir"
                  >
                    <Image size={14} />
                    <input
                      ref={editPhotoInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        void updatePostPhoto(post.id, file)
                        e.target.value = ''
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="admin-ghost-btn"
                    onClick={() => togglePublish(post.id)}
                  >
                    {post.publishedAt ? (
                      <Eye size={14} />
                    ) : (
                      <CheckCircle size={14} />
                    )}
                    {post.publishedAt ? 'Yayından Kaldır' : 'Yayınla'}
                  </button>
                  <button
                    type="button"
                    className={
                      deleteConfirm === post.id ? 'admin-danger-btn' : 'admin-ghost-btn'
                    }
                    onClick={() => handleDelete(post.id)}
                  >
                    <Trash2 size={14} />
                    {deleteConfirm === post.id ? 'Onayla' : 'Sil'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


function MessagesPage({
  tickets,
  onTicketsChange,
}: {
  tickets: SupportTicket[]
  onTicketsChange: React.Dispatch<React.SetStateAction<SupportTicket[]>>
}) {
  const [selected, setSelected] = useState<SupportTicket | null>(null)
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    if (!selected) return
    const fresh = tickets.find((t) => t.id === selected.id) ?? null
    setSelected(fresh)
  }, [tickets, selected?.id])

  async function toggleStatus(id: string) {
    const target = tickets.find((t) => t.id === id)
    if (!target) return
    const next: 'open' | 'closed' = target.status === 'open' ? 'closed' : 'open'
    await dbSetTicketStatus(id, next)
    const updated = tickets.map((t) => (t.id === id ? { ...t, status: next } : t))
    onTicketsChange(updated)
    if (selected?.id === id) {
      setSelected(updated.find((t) => t.id === id) ?? null)
    }
  }

  async function handleDelete(id: string) {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id)
      return
    }
    await dbDeleteTicket(id)
    const updated = tickets.filter((t) => t.id !== id)
    onTicketsChange(updated)
    if (selected?.id === id) setSelected(null)
    setDeleteConfirm(null)
  }

  const filtered =
    filter === 'all' ? tickets : tickets.filter((t) => t.status === filter)

  const openCount = tickets.filter((t) => t.status === 'open').length

  return (
    <div className="admin-page-stack">
      <div className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Gelen Kutusu</p>
          <h2>İletişim Mesajları</h2>
          <p className="admin-muted">Ana sitedeki iletişim formundan gelen talepler.</p>
        </div>
        <div className="admin-header-meta">
          <span className="admin-badge red">{openCount} Açık</span>
          <span className="admin-badge green">{tickets.length - openCount} Kapalı</span>
          <span className="admin-badge blue">Canlı</span>
        </div>
      </div>

      <div className="admin-messages-layout">
        {/* Left: ticket list */}
        <div className="admin-card admin-messages-list-card">
          <div className="admin-card-head">
            <Mail size={16} />
            <h3>Mesajlar ({filtered.length})</h3>
            <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
              {(['all', 'open', 'closed'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={filter === f ? 'admin-primary-btn' : 'admin-ghost-btn'}
                  style={{ padding: '4px 10px', fontSize: '0.76rem' }}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? 'Tümü' : f === 'open' ? 'Açık' : 'Kapalı'}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="admin-empty">
              <Mail size={32} />
              <p>Henüz mesaj yok.</p>
            </div>
          ) : (
            <div className="admin-ticket-list">
              {filtered.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`admin-ticket-item${selected?.id === t.id ? ' is-active' : ''}${t.status === 'open' ? ' is-open' : ''}`}
                  onClick={() => setSelected(t)}
                >
                  <div className="admin-ticket-dot-wrap">
                    <span
                      className="admin-ticket-dot"
                      style={{ background: t.status === 'open' ? '#f59e0b' : '#10b981' }}
                    />
                  </div>
                  <div className="admin-ticket-preview">
                    <div className="admin-ticket-preview-head">
                      <strong>{t.subject}</strong>
                      <time>{new Date(t.createdAt).toLocaleDateString('tr-TR')}</time>
                    </div>
                    <small>{t.senderName} (@{t.senderUsername}) · {t.email || 'E-posta yok'}</small>
                    <p className="admin-ticket-excerpt">{t.message}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: selected message */}
        <div className="admin-card admin-messages-detail-card">
          {selected ? (
            <>
              <div className="admin-card-head">
                <Mail size={16} />
                <h3>{selected.subject}</h3>
                <div className="admin-card-actions">
                  <button
                    type="button"
                    className="admin-ghost-btn"
                    onClick={() => toggleStatus(selected.id)}
                  >
                    <CheckCircle size={14} />
                    {selected.status === 'open' ? 'Kapat' : 'Yeniden Aç'}
                  </button>
                  <button
                    type="button"
                    className={deleteConfirm === selected.id ? 'admin-danger-btn' : 'admin-ghost-btn'}
                    onClick={() => handleDelete(selected.id)}
                  >
                    <Trash2 size={14} />
                    {deleteConfirm === selected.id ? 'Onayla' : 'Sil'}
                  </button>
                </div>
              </div>

              <div className="admin-message-detail">
                <div className="admin-message-meta-row">
                  <div className="admin-message-meta-item">
                    <span>Gönderen</span>
                    <strong>{selected.senderName} (@{selected.senderUsername})</strong>
                  </div>
                  <div className="admin-message-meta-item">
                    <span>Hesap E-postası</span>
                    <strong>{selected.email || 'E-posta belirtilmemiş'}</strong>
                  </div>
                  <div className="admin-message-meta-item">
                    <span>Kullanıcı ID</span>
                    <strong>{selected.userId}</strong>
                  </div>
                  <div className="admin-message-meta-item">
                    <span>Rol</span>
                    <strong>{selected.senderRole}</strong>
                  </div>
                  <div className="admin-message-meta-item">
                    <span>Tarih</span>
                    <strong>{new Date(selected.createdAt).toLocaleString('tr-TR')}</strong>
                  </div>
                  <div className="admin-message-meta-item">
                    <span>Durum</span>
                    <span
                      className={selected.status === 'open' ? 'admin-badge yellow' : 'admin-badge green'}
                    >
                      {selected.status === 'open' ? 'Açık' : 'Kapalı'}
                    </span>
                  </div>
                </div>

                <div className="admin-message-body">
                  <p>{selected.message}</p>
                </div>

                {selected.email && (
                  <a
                    href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject)}`}
                    className="admin-primary-btn"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
                  >
                    <Send size={14} /> E-posta ile Yanıtla
                  </a>
                )}
              </div>
            </>
          ) : (
            <div className="admin-empty" style={{ height: '100%', justifyContent: 'center' }}>
              <Mail size={40} />
              <p>Görüntülemek için bir mesaj seçin.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


function UsersPage({ session }: { session: SessionUser }) {
  const [users, setUsers] = useState<AuthUser[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [resetForUser, setResetForUser] = useState<string | null>(null)
  const [resetValue, setResetValue] = useState('')
  const [resetMsg, setResetMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user')
  const [createMsg, setCreateMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [createLoading, setCreateLoading] = useState(false)

  useEffect(() => {
    void refresh()
  }, [])

  async function refresh() {
    const u = await getUsers()
    setUsers(u)
  }

  async function handleDelete(id: string) {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id)
      return
    }
    await deleteUser(id)
    await refresh()
    setDeleteConfirm(null)
  }

  async function handleResetSubmit(id: string) {
    setResetMsg(null)
    if (resetValue.length < 6) {
      setResetMsg({ tone: 'err', text: 'Yeni şifre en az 6 karakter olmalıdır.' })
      return
    }
    const ok = await adminResetPassword(id, resetValue)
    if (!ok) {
      setResetMsg({
        tone: 'err',
        text: 'Şifre güncellenemedi. Bu işlem için Supabase Edge Function (service-role) gerekiyor.',
      })
      return
    }
    setResetMsg({ tone: 'ok', text: 'Şifre güncellendi.' })
    setResetValue('')
    setResetForUser(null)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateMsg(null)
    setCreateLoading(true)
    const result = await adminCreateUser({
      username: newUsername,
      password: newPassword,
      name: newName,
      email: newEmail,
      role: newRole,
    })
    setCreateLoading(false)
    if ('error' in result) {
      setCreateMsg({ tone: 'err', text: result.error })
      return
    }
    setCreateMsg({ tone: 'ok', text: `${result.user.username} oluşturuldu.` })
    setNewName('')
    setNewUsername('')
    setNewEmail('')
    setNewPassword('')
    setNewRole('user')
    await refresh()
  }

  return (
    <div className="admin-page-stack">
      <div className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Kullanıcı Yönetimi</p>
          <h2>Kayıtlı Kullanıcılar</h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="admin-primary-btn"
            onClick={() => { setShowCreate((s) => !s); setCreateMsg(null) }}
          >
            <UserPlus size={14} /> Yeni Kullanıcı
          </button>
          <button type="button" className="admin-ghost-btn" onClick={refresh}>
            <RefreshCw size={14} /> Yenile
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="admin-card">
          <div className="admin-card-head">
            <Plus size={18} />
            <h3>Yeni kullanıcı oluştur</h3>
          </div>
          <form className="admin-form-grid" onSubmit={handleCreate}>
            <label className="admin-form-field">
              <span>Ad Soyad</span>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Adı Soyadı"
              />
            </label>
            <label className="admin-form-field">
              <span>Kullanıcı Adı</span>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="kullanici_adi"
                required
              />
            </label>
            <label className="admin-form-field">
              <span>E-posta</span>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="ornek@mail.com"
              />
            </label>
            <label className="admin-form-field">
              <span>Şifre</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="En az 6 karakter"
                required
              />
            </label>
            <label className="admin-form-field">
              <span>Rol</span>
              <select
                className="admin-select"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'user' | 'admin')}
              >
                <option value="user">Kullanıcı</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <div className="admin-form-actions">
              {createMsg && (
                <span className={createMsg.tone === 'ok' ? 'admin-badge green' : 'admin-badge red'}>
                  {createMsg.text}
                </span>
              )}
              <button type="submit" className="admin-primary-btn" disabled={createLoading}>
                {createLoading ? <RefreshCw size={14} className="admin-spin" /> : <CheckCircle size={14} />}
                {createLoading ? ' Oluşturuluyor...' : ' Oluştur'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="admin-card">
        <div className="admin-card-head">
          <Users size={18} />
          <h3>{users.length} kullanıcı kayıtlı</h3>
        </div>
        <div className="admin-users-list">
          {users.map((u) => (
            <div key={u.id} className="admin-user-item">
              <div className="admin-user-ava">
                {u.photoData ? (
                  <img src={u.photoData} alt={u.name} />
                ) : (
                  <span>{u.avatar}</span>
                )}
              </div>
              <div className="admin-user-info">
                <strong>{u.name}</strong>
                <small>
                  @{u.username} · {u.email || 'E-posta yok'}
                </small>
                <small className="admin-muted">
                  Kayıt: {new Date(u.createdAt).toLocaleDateString('tr-TR')}
                  {u.lastLoginAt &&
                    ` · Son giriş: ${new Date(u.lastLoginAt).toLocaleString('tr-TR')}`}
                </small>
                {resetForUser === u.id && (
                  <div className="admin-inline-reset">
                    <input
                      type="password"
                      value={resetValue}
                      onChange={(e) => setResetValue(e.target.value)}
                      placeholder="Yeni şifre (en az 6 karakter)"
                      autoFocus
                    />
                    <button
                      type="button"
                      className="admin-primary-btn"
                      onClick={() => handleResetSubmit(u.id)}
                    >
                      Uygula
                    </button>
                    <button
                      type="button"
                      className="admin-ghost-btn"
                      onClick={() => { setResetForUser(null); setResetValue(''); setResetMsg(null) }}
                    >
                      İptal
                    </button>
                    {resetMsg && (
                      <span className={resetMsg.tone === 'ok' ? 'admin-badge green' : 'admin-badge red'}>
                        {resetMsg.text}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <span
                className={u.role === 'admin' ? 'admin-badge blue' : 'admin-badge gray'}
              >
                {u.role === 'admin' ? 'Admin' : 'Kullanıcı'}
              </span>
              <button
                type="button"
                className="admin-ghost-btn"
                onClick={() => { setResetForUser(resetForUser === u.id ? null : u.id); setResetValue(''); setResetMsg(null) }}
                title="Şifre sıfırla"
              >
                <Key size={14} /> Şifre
              </button>
              {u.id !== session.id && (
                <button
                  type="button"
                  className={
                    deleteConfirm === u.id ? 'admin-danger-btn' : 'admin-ghost-btn'
                  }
                  onClick={() => handleDelete(u.id)}
                >
                  <Trash2 size={14} />
                  {deleteConfirm === u.id ? 'Onayla' : 'Sil'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>(() => getLogs())
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    void fetchLogsFromServer(500)
    return subscribeLogs((updated) => setLogs(updated))
  }, [])

  const levelColors: Record<string, string> = {
    info: '#3b82f6',
    warn: '#f59e0b',
    error: '#ef4444',
    success: '#10b981',
    trade: '#a855f7',
  }

  const filtered = filter === 'all' ? logs : logs.filter((l) => l.level === filter)

  return (
    <div className="admin-page-stack">
      <div className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Sistem Logları</p>
          <h2>Aktivite Kayıtları</h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            className="admin-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Tümü ({logs.length})</option>
            <option value="info">Info</option>
            <option value="warn">Uyarı</option>
            <option value="error">Hata</option>
            <option value="success">Başarı</option>
            <option value="trade">İşlem</option>
          </select>
          <button
            type="button"
            className="admin-danger-btn"
            onClick={() => {
              void clearLogs()
            }}
          >
            <Trash2 size={14} /> Temizle
          </button>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-log-list">
          {filtered.length === 0 ? (
            <div className="admin-empty">
              <Activity size={28} />
              <p>Log bulunamadı.</p>
            </div>
          ) : (
            filtered.slice(0, 500).map((entry) => (
              <div key={entry.id} className="admin-log-item">
                <span
                  className="admin-log-level-dot"
                  style={{ background: levelColors[entry.level] ?? '#888' }}
                />
                <span
                  className="admin-log-lvl"
                  style={{ color: levelColors[entry.level] }}
                >
                  {entry.level.toUpperCase()}
                </span>
                <span className="admin-log-src">{entry.source}</span>
                <span className="admin-log-time">
                  {new Date(entry.timestamp).toLocaleString('tr-TR')}
                </span>
                <span className="admin-log-msg">{entry.message}</span>
                {entry.data && <code className="admin-log-data">{entry.data}</code>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}


type AdminBotState = {
  cash?: number
  initialCash?: number
  positions?: unknown[]
  trades?: Array<{
    side: string
    symbol: string
    price: number
    timestamp: string
    quantity: number
    confidence: number
    reason: string
  }>
  equityHistory?: Array<{ at: string; total: number }>
  lastRunAt?: string | null
}

function BotMonitorPage({ session }: { session: SessionUser }) {
  const [botState, setBotState] = useState<AdminBotState>({})

  useEffect(() => {
    void refresh()
  }, [])

  async function refresh() {
    const data = await fetchBotState<AdminBotState>(session.id)
    setBotState(data ?? {})
  }

  const trades = botState.trades ?? []
  const equity = botState.equityHistory ?? []
  const lastPoint = equity[equity.length - 1]
  const firstPoint = equity[0]
  const pnl = lastPoint && firstPoint ? lastPoint.total - firstPoint.total : 0
  const pnlPct = firstPoint?.total ? (pnl / firstPoint.total) * 100 : 0

  return (
    <div className="admin-page-stack">
      <div className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Bot Monitörü</p>
          <h2>Trade Bot Durumu</h2>
        </div>
        <button type="button" className="admin-ghost-btn" onClick={refresh}>
          <RefreshCw size={14} /> Yenile
        </button>
      </div>

      <div className="admin-stats-grid">
        {[
          {
            label: 'Başlangıç',
            value: `$${(botState.initialCash ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`,
            color: '#3b82f6',
          },
          {
            label: 'Nakit',
            value: `$${(botState.cash ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`,
            color: '#10b981',
          },
          {
            label: 'Pozisyon',
            value: String((botState.positions ?? []).length),
            color: '#a855f7',
          },
          {
            label: 'Net P/L',
            value: `${pnl >= 0 ? '+' : ''}$${Math.abs(pnl).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} (${pnlPct.toFixed(2)}%)`,
            color: pnl >= 0 ? '#10b981' : '#ef4444',
          },
        ].map((s) => (
          <div
            key={s.label}
            className="admin-stat-card"
            style={{ '--stat-color': s.color } as React.CSSProperties}
          >
            <div>
              <strong className="admin-stat-value">{s.value}</strong>
              <p className="admin-stat-label">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-card">
        <div className="admin-card-head">
          <Bot size={18} />
          <h3>Son {trades.length} İşlem</h3>
        </div>
        {trades.length === 0 ? (
          <div className="admin-empty">
            <Bot size={28} />
            <p>Henüz bot işlemi yok.</p>
          </div>
        ) : (
          <div className="admin-log-list">
            {[...trades]
              .reverse()
              .slice(0, 50)
              .map((t, i) => (
                <div key={i} className="admin-log-item">
                  <span
                    className="admin-log-level-dot"
                    style={{ background: t.side === 'buy' ? '#10b981' : '#ef4444' }}
                  />
                  <span
                    className="admin-log-lvl"
                    style={{ color: t.side === 'buy' ? '#10b981' : '#ef4444' }}
                  >
                    {t.side === 'buy' ? 'AL' : 'SAT'}
                  </span>
                  <span className="admin-log-src">{t.symbol}</span>
                  <span className="admin-log-time">
                    {new Date(t.timestamp).toLocaleString('tr-TR')}
                  </span>
                  <span className="admin-log-msg">
                    {t.quantity.toFixed(4)} adet @ ${t.price.toFixed(2)} · %{t.confidence} güven
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}


