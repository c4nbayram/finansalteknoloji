import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import {
  Activity,
  AlertTriangle,
  Bell,
  BookOpen,
  AreaChart,
  Bot,
  CandlestickChart as CandlestickIcon,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  LayoutDashboard,
  Plus,
  Save,
  StickyNote,
  Target,
  Trash2,
  LineChart,
  LogOut,
  Menu,
  Moon,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  TrendingDown,
  TrendingUp,
  Upload,
  User as UserIcon,
  Wallet,
  X,
  Zap,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react'
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { gsap } from 'gsap'
import './App.css'
import { AnimatedNumber } from './components/AnimatedNumber'
import { CandlestickChart } from './components/CandlestickChart'
import { DonutChart } from './components/DonutChart'
import { EquityChart } from './components/EquityChart'
import { LineAreaChart } from './components/LineAreaChart'
import { MiniHeatmap } from './components/MiniHeatmap'
import { Sparkline } from './components/Sparkline'
import {
  instruments,
  marketTabs,
  type InstrumentConfig,
  type MarketTabId,
} from './data/marketConfig'
import {
  buildIndicatorSnapshot,
  calculateSupportResistance,
  type Candle,
} from './lib/indicators'
import {
  fetchAssetSnapshot,
  fetchQuotes,
  type AssetSnapshot,
  type ProviderStatus,
  type QuoteData,
} from './lib/marketData'
import { integrationConfig } from './lib/integrations'
import {
  getSession,
  getLastLoginError,
  getLoginHistoryForUser,
  login,
  logout as authLogout,
  register,
  updateUserProfile,
  changePassword,
  requestPasswordReset,
  refreshSessionUser,
  onAuthChange,
  type SessionUser,
  type LoginHistoryEntry,
} from './lib/auth'
import { supabase } from './lib/supabase'
import {
  fetchWatchlist,
  addWatchlistItem,
  removeWatchlistItem,
  fetchPositions,
  upsertPosition,
  removePosition,
  fetchNotes,
  addNote as dbAddNote,
  deleteNote as dbDeleteNote,
  fetchAlerts,
  addAlert as dbAddAlert,
  deleteAlert as dbDeleteAlert,
  fetchBotConfig,
  saveBotConfig,
  fetchBotState,
  saveBotState,
  recordBotTrade,
  fetchProfileExtras,
  uploadProfilePhoto,
} from './lib/db'
import { addLog } from './lib/logger'
import {
  appendEquityPoint,
  botPortfolioValue,
  defaultBotConfig,
  defaultBotState,
  evaluateWithAi,
  executeBuy,
  executeSell,
  INTERVAL_OPTIONS,
  RISK_FACTORS,
  RISK_LABEL,
  type ActivityEvent,
  type BotConfig,
  type BotDecision,
  type BotPosition,
  type BotRisk,
  type BotState,
} from './lib/tradeBot'

type ThemeMode = 'light' | 'dark'

type NavItem = {
  path: string
  label: string
  icon: LucideIcon
}

type Profile = {
  name: string
  email: string
  avatar: string
  bio: string
  preferredCurrency: 'TRY' | 'USD' | 'EUR'
  joinedAt: string
  photoData?: string
}

type UserPosition = {
  instrumentId: string
  quantity: number
  averageCost: number
  addedAt: string
}

type SavedNote = {
  id: string
  instrumentId: string
  symbol: string
  label: string
  text: string
  createdAt: string
}

type PriceAlert = {
  id: string
  instrumentId: string
  symbol: string
  price: number
  createdAt: string
}

type ChartType = 'candle' | 'line' | 'area'

const THEME_STORAGE_KEY = 'fintech-theme'
const COLLAPSED_STORAGE_KEY = 'fintech-sidebar-collapsed'

const defaultBotInstrumentIds = ['aapl', 'msft', 'btcusd', 'ethusd', 'xauusd', 'usdtry']

const navItems: NavItem[] = [
  { path: '/', label: 'Genel Bakış', icon: LayoutDashboard },
  { path: '/piyasalar', label: 'Piyasalar', icon: LineChart },
  { path: '/watchlist', label: 'Watchlist', icon: Star },
  { path: '/varlik', label: 'Varlık', icon: Search },
  { path: '/portfoy', label: 'Portföy', icon: Wallet },
  { path: '/bot', label: 'Trade Bot', icon: Bot },
  { path: '/bildirimler', label: 'Bildirimler', icon: Bell },
  { path: '/egitim', label: 'Eğitim', icon: BookOpen },
  { path: '/destek', label: 'Destek', icon: MessageSquare },
  { path: '/profil', label: 'Profil', icon: UserIcon },
]

const avatarOptions = [
  { id: 'YA', icon: '🧑‍💼', label: 'Yatirimci' },
  { id: 'BT', icon: '🤖', label: 'Bot Trader' },
  { id: 'FT', icon: '💼', label: 'Finans Uzmani' },
  { id: 'AI', icon: '🧠', label: 'AI Analist' },
  { id: 'TR', icon: '📈', label: 'Trader' },
  { id: 'KR', icon: '₿', label: 'Kripto' },
  { id: 'DV', icon: '💱', label: 'Doviz' },
  { id: 'EM', icon: '🪙', label: 'Emtia' },
  { id: 'BD', icon: '🎯', label: 'Balanced' },
  { id: 'PR', icon: '🏦', label: 'Portfoy' },
  { id: 'RK', icon: '🛡️', label: 'Risk Kontrol' },
  { id: 'HN', icon: '💡', label: 'Hizli Notlar' },
] as const
const avatarOptionMap = new Map<string, string>(avatarOptions.map((option) => [option.id, option.icon]))
const currencyOptions: Array<Profile['preferredCurrency']> = ['TRY', 'USD', 'EUR']

const demoBalance = 0
const overviewInstrumentIds = ['aapl', 'btcusd', 'xauusd', 'usdtry']
const perMarketDetailLimit = 4

const positionPalette = ['#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6']

const defaultProfile: Profile = {
  name: 'Misafir Yatırımcı',
  email: '',
  avatar: 'YA',
  bio: '',
  preferredCurrency: 'TRY',
  joinedAt: new Date().toISOString(),
}

function getAvatarIcon(avatar: string | undefined): string {
  const normalized = (avatar || '').trim().toUpperCase()
  return avatarOptionMap.get(normalized) ?? (normalized.slice(0, 2) || 'YA')
}

function portfolioPositionToBotPosition(
  position: UserPosition,
  instrument: InstrumentConfig,
): BotPosition {
  return {
    instrumentId: instrument.id,
    symbol: instrument.symbol,
    label: instrument.label,
    quantity: position.quantity,
    averageCost: position.averageCost,
    openedAt: position.addedAt,
  }
}


type BotStatusMessage = {
  tone: 'ok' | 'warn' | 'info'
  text: string
  at: string
}

type BotDecisionLogEntry = {
  instrumentId: string
  symbol: string
  decision: BotDecision
  at: string
  executed: boolean
  price: number
}

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const shellRef = useRef<HTMLDivElement | null>(null)
  const pageRef = useRef<HTMLDivElement | null>(null)

  const [authSession, setAuthSession] = useState<SessionUser | null>(() => getSession())
  const [authReady, setAuthReady] = useState(false)

  async function handleLogout() {
    await authLogout()
    setAuthSession(null)
    navigate('/login')
  }

  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = globalThis.localStorage?.getItem(THEME_STORAGE_KEY)
    return saved === 'dark' ? 'dark' : 'light'
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return globalThis.localStorage?.getItem(COLLAPSED_STORAGE_KEY) === '1'
  })
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const [profile, setProfile] = useState<Profile>(defaultProfile)
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [userPortfolio, setUserPortfolio] = useState<UserPosition[]>([])
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>([])
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([])

  const [selectedMarket, setSelectedMarket] = useState<MarketTabId>('abd')
  const [selectedInstrumentId, setSelectedInstrumentId] = useState('aapl')
  const [quotes, setQuotes] = useState<QuoteData[]>([])
  const [overviewQuotes, setOverviewQuotes] = useState<QuoteData[]>([])
  const [assetSnapshot, setAssetSnapshot] = useState<AssetSnapshot>({
    quote: null,
    candles: [],
    status: integrationConfig.marketDataEnabled ? 'ok' : 'missing_key',
  })
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false)
  const [isLoadingAsset, setIsLoadingAsset] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [alertPrice, setAlertPrice] = useState('')
  const [note, setNote] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  const [botConfig, setBotConfig] = useState<BotConfig>(defaultBotConfig)
  const [botState, setBotState] = useState<BotState>(defaultBotState)
  const [botRunning, setBotRunning] = useState<boolean>(false)
  const [botScanning, setBotScanning] = useState(false)
  const [botStatus, setBotStatus] = useState<BotStatusMessage | null>(null)
  const [botDecisionLog, setBotDecisionLog] = useState<BotDecisionLogEntry[]>([])
  const [botActivity, setBotActivity] = useState<ActivityEvent[]>([])
  const [showBotConfigModal, setShowBotConfigModal] = useState(false)

  const pushActivity = useCallback((event: Omit<ActivityEvent, 'id' | 'at'>) => {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const at = new Date().toISOString()
    setBotActivity((prev) =>
      [{ ...event, id, at }, ...prev].slice(0, 60),
    )
    const level = event.kind === 'trade' ? 'trade' : event.kind === 'error' ? 'error' : event.kind === 'scan' ? 'info' : 'success'
    addLog(level as Parameters<typeof addLog>[0], `Bot·${event.kind}`, `${event.title} — ${event.detail}`, event.symbol ? { symbol: event.symbol, side: event.side } : undefined)
  }, [])

  const selectedInstrument =
    instruments.find((item) => item.id === selectedInstrumentId) ?? instruments[0]

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    globalThis.localStorage?.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    globalThis.localStorage?.setItem(COLLAPSED_STORAGE_KEY, sidebarCollapsed ? '1' : '0')
  }, [sidebarCollapsed])

  // ── Supabase auth: session yükle + değişiklikleri dinle
  useEffect(() => {
    let mounted = true
    void (async () => {
      const session = await refreshSessionUser()
      if (!mounted) return
      setAuthSession(session)
      setAuthReady(true)
    })()
    const unsubscribe = onAuthChange(async (s) => {
      if (!s) {
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          const restored = await refreshSessionUser()
          setAuthSession(restored)
          return
        }
        setAuthSession(null)
        return
      }
      const session = await refreshSessionUser()
      setAuthSession(session)
    })
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  // ── Bot config: değişiklikte 600ms debounce ile Supabase'e yaz
  const botCfgInitialized = useRef(false)
  useEffect(() => {
    if (!authSession) return
    if (!botCfgInitialized.current) {
      botCfgInitialized.current = true
      return
    }
    const handle = setTimeout(() => {
      void saveBotConfig(authSession.id, botConfig)
    }, 600)
    return () => clearTimeout(handle)
  }, [authSession?.id, botConfig])

  // ── Bot state: 1.5s debounce (daha sık değişiyor)
  const botStateInitialized = useRef(false)
  useEffect(() => {
    if (!authSession) return
    if (!botStateInitialized.current) {
      botStateInitialized.current = true
      return
    }
    const handle = setTimeout(() => {
      void saveBotState(authSession.id, botState)
    }, 1500)
    return () => clearTimeout(handle)
  }, [authSession?.id, botState])

  // ── Kullanıcı verilerini Supabase'den yükle (giriş sonrası)
  useEffect(() => {
    if (!authSession) {
      setWatchlist([])
      setUserPortfolio([])
      setSavedNotes([])
      setPriceAlerts([])
      setBotConfig(defaultBotConfig)
      setBotState(defaultBotState)
      return
    }
    let cancelled = false
    void (async () => {
      const [wl, positions, notes, alerts, botCfg, botSt, extras] = await Promise.all([
        fetchWatchlist(authSession.id),
        fetchPositions(authSession.id),
        fetchNotes(authSession.id),
        fetchAlerts(authSession.id),
        fetchBotConfig<BotConfig>(authSession.id),
        fetchBotState<BotState>(authSession.id),
        fetchProfileExtras(authSession.id),
      ])
      if (cancelled) return

      setWatchlist(wl)
      setUserPortfolio(
        positions.map((p) => ({
          instrumentId: p.instrumentId,
          quantity: p.quantity,
          averageCost: p.averageCost,
          addedAt: p.addedAt,
        })),
      )
      setSavedNotes(
        notes.map((n) => ({
          id: n.id,
          instrumentId: n.instrumentId,
          symbol: n.symbol,
          label: n.label,
          text: n.text,
          createdAt: n.createdAt,
        })),
      )
      setPriceAlerts(
        alerts.map((a) => ({
          id: a.id,
          instrumentId: a.instrumentId,
          symbol: a.symbol,
          price: a.price,
          createdAt: a.createdAt,
        })),
      )
      if (botCfg) setBotConfig({ ...defaultBotConfig, ...botCfg })
      if (botSt) setBotState({ ...defaultBotState, ...botSt })

      setProfile({
        name: authSession.name,
        email: authSession.email,
        avatar: authSession.avatar,
        bio: extras?.bio ?? '',
        preferredCurrency: ((extras?.preferred_currency as Profile['preferredCurrency']) ?? 'TRY'),
        joinedAt: authSession.createdAt,
        photoData: authSession.photoData,
      })
    })()
    return () => {
      cancelled = true
    }
  }, [authSession?.id])

  useLayoutEffect(() => {
    if (!shellRef.current) {
      return
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.shell-enter',
        { opacity: 0, y: -12 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: 'power3.out' },
      )
    }, shellRef)
    return () => ctx.revert()
  }, [])

  useLayoutEffect(() => {
    if (!pageRef.current) {
      return
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.page-enter',
        { opacity: 0, y: 22, filter: 'blur(8px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.5, stagger: 0.06, ease: 'power3.out' },
      )
    }, pageRef)
    return () => ctx.revert()
  }, [location.pathname, selectedMarket, selectedInstrumentId, quotes, overviewQuotes, assetSnapshot])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setIsLoadingAsset(true)
      const data = await fetchAssetSnapshot(selectedInstrument)
      if (cancelled) {
        return
      }
      setAssetSnapshot(data)
      setIsLoadingAsset(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [selectedInstrument])

  const liveQuotes = useMemo(() => {
    return Array.from(
      new Map([...overviewQuotes, ...quotes].map((item) => [item.instrument.id, item])).values(),
    )
  }, [overviewQuotes, quotes])

  const selectedAssetQuote = useMemo(
    () => liveQuotes.find((item) => item.instrument.id === selectedInstrumentId) ?? null,
    [liveQuotes, selectedInstrumentId],
  )

  const quoteMap = useMemo(
    () => new Map(liveQuotes.map((item) => [item.instrument.id, item])),
    [liveQuotes],
  )

  const overviewQuoteMap = useMemo(
    () => new Map(overviewQuotes.map((item) => [item.instrument.market, item])),
    [overviewQuotes],
  )

  const currentMarketInstruments = useMemo(
    () => instruments.filter((item) => item.market === selectedMarket).slice(0, perMarketDetailLimit),
    [selectedMarket],
  )

  const currentMarketQuotes = useMemo(
    () => quotes.filter((item) => item.instrument.market === selectedMarket),
    [quotes, selectedMarket],
  )

  const failedQuotes = useMemo(
    () => liveQuotes.filter((item) => item.status === 'error'),
    [liveQuotes],
  )

  const loadedQuotesCount = useMemo(
    () => liveQuotes.filter((item) => item.status === 'ok' && item.price !== null).length,
    [liveQuotes],
  )

  const moversUp = useMemo(
    () =>
      [...currentMarketQuotes]
        .filter((item) => item.percentChange !== null)
        .sort((a, b) => (b.percentChange ?? 0) - (a.percentChange ?? 0))
        .slice(0, 5),
    [currentMarketQuotes],
  )

  const moversDown = useMemo(
    () =>
      [...currentMarketQuotes]
        .filter((item) => item.percentChange !== null)
        .sort((a, b) => (a.percentChange ?? 0) - (b.percentChange ?? 0))
        .slice(0, 5),
    [currentMarketQuotes],
  )

  const byVolume = useMemo(
    () =>
      [...currentMarketQuotes]
        .filter((item) => item.volume !== null)
        .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
        .slice(0, 5),
    [currentMarketQuotes],
  )

  const heatmapItems = useMemo(
    () =>
      currentMarketQuotes.map((item) => ({
        symbol: item.instrument.symbol,
        company: item.instrument.label,
        change: item.percentChange ?? 0,
      })),
    [currentMarketQuotes],
  )

  const indicators = useMemo(
    () => buildIndicatorSnapshot(assetSnapshot.candles),
    [assetSnapshot.candles],
  )

  const levels = useMemo(
    () => calculateSupportResistance(assetSnapshot.candles),
    [assetSnapshot.candles],
  )

  const portfolioPositions = useMemo(() => {
    return userPortfolio
      .map((position, index) => {
        const instrument = instruments.find((item) => item.id === position.instrumentId)
        if (!instrument) {
          return null
        }
        const quote = quoteMap.get(position.instrumentId)
        const price = quote?.price ?? position.averageCost
        const marketValue = price * position.quantity
        const cost = position.averageCost * position.quantity
        const pnl = marketValue - cost
        const pnlPct = cost === 0 ? 0 : (pnl / cost) * 100
        return {
          id: position.instrumentId,
          quantity: position.quantity,
          averageCost: position.averageCost,
          instrument,
          quote: quote ?? null,
          price,
          marketValue,
          cost,
          pnl,
          pnlPct,
          color: positionPalette[index % positionPalette.length],
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
  }, [userPortfolio, quoteMap])

  const portfolioMarketValue = useMemo(
    () => portfolioPositions.reduce((sum, position) => sum + position.marketValue, 0),
    [portfolioPositions],
  )

  const portfolioCost = useMemo(
    () => portfolioPositions.reduce((sum, position) => sum + position.cost, 0),
    [portfolioPositions],
  )

  const portfolioUnrealized = portfolioMarketValue - portfolioCost
  const portfolioUnrealizedPct = portfolioCost === 0 ? 0 : (portfolioUnrealized / portfolioCost) * 100

  const watchlistInstruments = useMemo(
    () =>
      watchlist
        .map((id) => instruments.find((item) => item.id === id))
        .filter((item): item is InstrumentConfig => Boolean(item)),
    [watchlist],
  )

  const watchlistQuotes = useMemo(
    () =>
      watchlistInstruments.map((instrument) => ({
        instrument,
        quote: quoteMap.get(instrument.id) ?? null,
      })),
    [watchlistInstruments, quoteMap],
  )

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) {
      return []
    }
    return instruments
      .filter(
        (item) =>
          item.symbol.toLowerCase().includes(q) ||
          item.label.toLowerCase().includes(q) ||
          item.sector.toLowerCase().includes(q),
      )
      .slice(0, 8)
  }, [searchQuery])

  const userPortfolioRef = useRef(userPortfolio)
  useEffect(() => {
    userPortfolioRef.current = userPortfolio
  }, [userPortfolio])

  const watchlistRef = useRef<string[]>([])
  useEffect(() => {
    watchlistRef.current = watchlist
  }, [watchlist])

  const refreshOverviewQuotes = useCallback(async () => {
    const watchlistInstrumentObjects = watchlistRef.current
      .map((id) => instruments.find((item) => item.id === id))
      .filter((item): item is InstrumentConfig => Boolean(item))
    const positionInstruments = userPortfolioRef.current
      .map((p) => instruments.find((item) => item.id === p.instrumentId))
      .filter((item): item is InstrumentConfig => Boolean(item))
    const overviewBase = instruments.filter((item) => overviewInstrumentIds.includes(item.id))
    const dedup = Array.from(
      new Map(
        [...overviewBase, ...watchlistInstrumentObjects, ...positionInstruments].map((item) => [
          item.id,
          item,
        ]),
      ).values(),
    )
    const data = await fetchQuotes(dedup)
    setOverviewQuotes(data)
  }, [])

  const refreshMarketQuotes = useCallback(async (marketId: MarketTabId) => {
    const targets = instruments
      .filter((item) => item.market === marketId)
      .slice(0, perMarketDetailLimit)
    const data = await fetchQuotes(targets)
    setQuotes(data)
  }, [])

  const syncMarketData = useCallback(
    async (marketId: MarketTabId) => {
      setIsLoadingQuotes(true)
      try {
        await Promise.all([refreshOverviewQuotes(), refreshMarketQuotes(marketId)])
        setLastSyncAt(new Date().toISOString())
      } finally {
        setIsLoadingQuotes(false)
      }
    },
    [refreshMarketQuotes, refreshOverviewQuotes],
  )

  useEffect(() => {
    const frame = window.setTimeout(() => {
      void syncMarketData(selectedMarket)
    }, 0)
    return () => window.clearTimeout(frame)
  }, [selectedMarket, syncMarketData])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void syncMarketData(selectedMarket)
    }, 300_000)
    return () => window.clearInterval(timer)
  }, [selectedMarket, syncMarketData])

  const handleSelectMarket = useCallback((marketId: MarketTabId) => {
    setSelectedMarket(marketId)
    setAlertPrice('')
    const firstMatch = instruments.find((item) => item.market === marketId)
    if (firstMatch) {
      setSelectedInstrumentId(firstMatch.id)
    }
  }, [])

  const handleSelectInstrument = useCallback((instrumentId: string) => {
    setSelectedInstrumentId(instrumentId)
    setAlertPrice('')
    const found = instruments.find((item) => item.id === instrumentId)
    if (found) {
      setSelectedMarket(found.market)
    }
  }, [])

  const handleOpenAsset = useCallback(
    (instrumentId: string) => {
      handleSelectInstrument(instrumentId)
      navigate('/varlik')
      setSearchOpen(false)
      setSearchQuery('')
    },
    [handleSelectInstrument, navigate],
  )

  const botUniverse = useMemo(() => {
    if (botConfig.fundingMode === 'portfolio') {
      return botState.positions
        .map((position) => instruments.find((item) => item.id === position.instrumentId))
        .filter((item): item is InstrumentConfig => Boolean(item))
    }
    const ids = watchlist.length > 0 ? watchlist : defaultBotInstrumentIds
    return ids
      .map((id) => instruments.find((item) => item.id === id))
      .filter((item): item is InstrumentConfig => Boolean(item))
  }, [botConfig.fundingMode, botState.positions, watchlist])

  const botStateForView = useMemo(() => {
    return botState
  }, [botState])

  const botTickIndexRef = useRef(0)
  const botStateRef = useRef(botState)
  const botConfigRef = useRef(botConfig)
  const botUniverseRef = useRef(botUniverse)
  const botQuoteMapRef = useRef(quoteMap)

  const handleMovePortfolioToBot = useCallback((instrumentId: string) => {
    setUserPortfolio((current) => {
      const position = current.find((item) => item.instrumentId === instrumentId)
      const instrument = instruments.find((item) => item.id === instrumentId)
      if (!position || !instrument) {
        return current
      }

      const movedPosition = portfolioPositionToBotPosition(position, instrument)
      setBotState((bot) => {
        const existing = bot.positions.find((item) => item.instrumentId === instrumentId)
        const nextPositions = existing
          ? bot.positions.map((item) => {
              if (item.instrumentId !== instrumentId) {
                return item
              }
              const quantity = item.quantity + movedPosition.quantity
              const averageCost =
                (item.averageCost * item.quantity +
                  movedPosition.averageCost * movedPosition.quantity) /
                quantity
              return { ...item, quantity, averageCost }
            })
          : [...bot.positions, movedPosition]

        return { ...bot, positions: nextPositions }
      })
      pushActivity({
        kind: 'system',
        title: `${instrument.symbol} bota aktarıldı`,
        detail: `${position.quantity.toFixed(4)} adet portföyden trade bot cüzdanına taşındı.`,
      })

      return current.filter((item) => item.instrumentId !== instrumentId)
    })
  }, [pushActivity])

  const handleMoveBotToPortfolio = useCallback((instrumentId: string) => {
    setBotState((bot) => {
      const position = bot.positions.find((item) => item.instrumentId === instrumentId)
      if (!position) {
        return bot
      }

      setUserPortfolio((current) => {
        const existing = current.find((item) => item.instrumentId === instrumentId)
        if (!existing) {
          return [
            ...current,
            {
              instrumentId,
              quantity: position.quantity,
              averageCost: position.averageCost,
              addedAt: new Date().toISOString(),
            },
          ]
        }

        const quantity = existing.quantity + position.quantity
        const averageCost =
          (existing.averageCost * existing.quantity + position.averageCost * position.quantity) /
          quantity
        return current.map((item) =>
          item.instrumentId === instrumentId ? { ...item, quantity, averageCost } : item,
        )
      })
      pushActivity({
        kind: 'system',
        title: `${position.symbol} portföye geri alındı`,
        detail: `${position.quantity.toFixed(4)} adet trade bot cüzdanından portföye taşındı.`,
      })

      return {
        ...bot,
        positions: bot.positions.filter((item) => item.instrumentId !== instrumentId),
      }
    })
  }, [pushActivity])

  useEffect(() => {
    botStateRef.current = botState
  }, [botState])

  useEffect(() => {
    botConfigRef.current = botConfig
  }, [botConfig])

  useEffect(() => {
    botUniverseRef.current = botUniverse
  }, [botUniverse])

  useEffect(() => {
    botQuoteMapRef.current = quoteMap
  }, [quoteMap])

  const runBotTick = useCallback(async () => {
    const universe = botUniverseRef.current
    const config = botConfigRef.current
    if (universe.length === 0) {
      setBotStatus({
        tone: 'warn',
        text:
          config.fundingMode === 'portfolio'
            ? 'Portföy modunda taranacak varlık yok. Önce portföyünden trade bot cüzdanına varlık aktar.'
            : 'Tarama yapılacak varlık yok. Watchlist ekle veya varsayılanlar yüklensin.',
        at: new Date().toISOString(),
      })
      return
    }

    const instrument = universe[botTickIndexRef.current % universe.length]
    botTickIndexRef.current = (botTickIndexRef.current + 1) % universe.length

    setBotScanning(true)
    pushActivity({
      kind: 'scan',
      title: `${instrument.symbol} taranıyor`,
      detail: `AI karar motoru · ${RISK_LABEL[config.risk]}`,
      symbol: instrument.symbol,
    })
    try {
      const snapshot = await fetchAssetSnapshot(instrument)
      const candles = snapshot.candles
      if (candles.length < 20) {
        setBotStatus({
          tone: 'warn',
          text: `${instrument.symbol}: yeterli mum verisi yok.`,
          at: new Date().toISOString(),
        })
        pushActivity({
          kind: 'error',
          title: `${instrument.symbol}: yetersiz veri`,
          detail: `Mum sayısı ${candles.length} (en az 20 gerekli).`,
          symbol: instrument.symbol,
        })
        return
      }

      const livePrice =
        botQuoteMapRef.current.get(instrument.id)?.price ?? candles[candles.length - 1].close
      const tradingState = botStateRef.current
      const activePosition = tradingState.positions.find((p) => p.instrumentId === instrument.id)
      const hasPosition = Boolean(activePosition)

      const decision: BotDecision = await evaluateWithAi(
        { instrument, candles, hasPosition, position: activePosition },
        { ...config, strategy: 'ai' },
        integrationConfig.openAiKey,
      )

      pushActivity({
        kind: 'decision',
        title: `${instrument.symbol}: ${decision.decision.toUpperCase()} (%${decision.confidence})`,
        detail: decision.reasoning,
        symbol: instrument.symbol,
        decision: decision.decision,
        confidence: decision.confidence,
      })

      let executed = false
      let message = `${instrument.symbol}: HOLD (%${decision.confidence})`
      let nextState: BotState = {
        ...tradingState,
        lastRunAt: new Date().toISOString(),
      }
      let executedSide: 'buy' | 'sell' | null = null
      let executedQty = 0

      if (decision.decision === 'buy') {
        const result = executeBuy(nextState, instrument, livePrice, { ...config, strategy: 'ai' }, decision)
        nextState = result.state
        message = result.message
        executed = result.trade !== null
        if (result.trade) {
          executedSide = 'buy'
          executedQty = result.trade.quantity
        }
      } else if (decision.decision === 'sell') {
        const result = executeSell(nextState, instrument, livePrice, decision)
        nextState = result.state
        message = result.message
        executed = result.trade !== null
        if (result.trade) {
          executedSide = 'sell'
          executedQty = result.trade.quantity
        }
      }

      const tickQuoteMap = botQuoteMapRef.current
      const lookup = (id: string) => {
        if (id === instrument.id) return livePrice
        return tickQuoteMap.get(id)?.price ?? null
      }
      nextState = appendEquityPoint(nextState, lookup, new Date().toISOString())

      setBotState(nextState)
      setBotStatus({
        tone: executed ? 'ok' : decision.decision === 'hold' ? 'info' : 'warn',
        text: message,
        at: new Date().toISOString(),
      })

      if (executed && executedSide) {
        const valuation = botPortfolioValue(nextState, lookup)
        pushActivity({
          kind: 'trade',
          title: `${executedSide === 'buy' ? 'AL' : 'SAT'} ${instrument.symbol}`,
          detail: `${executedQty.toFixed(4)} adet @ $${livePrice.toFixed(2)} · Toplam değer $${valuation.total.toLocaleString(
            'tr-TR',
            { maximumFractionDigits: 0 },
          )}`,
          symbol: instrument.symbol,
          side: executedSide,
          total: valuation.total,
        })
        if (authSession?.id) {
          void recordBotTrade(authSession.id, {
            instrumentId: instrument.id,
            side: executedSide,
            quantity: executedQty,
            price: livePrice,
            confidence: decision.confidence,
            reason: decision.reasoning,
          }).catch((err: unknown) => {
            console.error('[bot] recordBotTrade failed', err)
          })
        }
      }
      setBotDecisionLog((prev) =>
        [
          {
            instrumentId: instrument.id,
            symbol: instrument.symbol,
            decision,
            executed,
            price: livePrice,
            at: new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 12),
      )
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'bilinmeyen'
      setBotStatus({
        tone: 'warn',
        text: `Tarama hatası: ${errMsg}`,
        at: new Date().toISOString(),
      })
      pushActivity({
        kind: 'error',
        title: 'Tarama hatası',
        detail: errMsg,
        symbol: instrument.symbol,
      })
    } finally {
      setBotScanning(false)
    }
  }, [authSession?.id, pushActivity])

  useEffect(() => {
    if (!botRunning) {
      return
    }
    const intervalMs = Math.max(60, botConfig.intervalSeconds) * 1000
    const id = window.setInterval(() => {
      void runBotTick()
    }, intervalMs)
    void runBotTick()
    return () => window.clearInterval(id)
  }, [botRunning, botConfig.intervalSeconds, runBotTick])

  const handleBotReset = useCallback(() => {
    setBotState({ ...defaultBotState, lastRunAt: null, equityHistory: [] })
    setBotDecisionLog([])
    setBotActivity([])
    setBotStatus({
      tone: 'info',
      text: 'Sanal hesap sıfırlandı.',
      at: new Date().toISOString(),
    })
    pushActivity({
      kind: 'system',
      title: 'Sıfırlama',
      detail: `Sanal bakiye $${defaultBotState.cash.toLocaleString('tr-TR')} olarak yeniden ayarlandı.`,
    })
  }, [pushActivity])

  const handleAddBotCash = useCallback(
    (amount: number) => {
      if (!Number.isFinite(amount) || amount <= 0) {
        return
      }

      setBotState((current) => ({
        ...current,
        cash: current.cash + amount,
        initialCash: current.initialCash + amount,
      }))
      pushActivity({
        kind: 'system',
        title: 'Bot bakiyesi eklendi',
        detail: `$${amount.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} bot cüzdanına eklendi.`,
      })
    },
    [pushActivity],
  )

  const handleBotStart = useCallback(() => {
    setShowBotConfigModal(true)
  }, [])

  const handleBotStartConfirm = useCallback(() => {
    setShowBotConfigModal(false)
    setBotRunning(true)
    pushActivity({
      kind: 'system',
      title: 'Bot başlatıldı',
      detail: `Tarama döngüsü her ${botConfig.intervalSeconds} saniyede tetiklenecek.`,
    })
  }, [botConfig.intervalSeconds, pushActivity])

  const handleBotStop = useCallback(() => {
    setBotRunning(false)
    pushActivity({
      kind: 'system',
      title: 'Bot durduruldu',
      detail: 'Yeni tarama başlatılmayacak. Açık pozisyonlar korunur.',
    })
  }, [pushActivity])

  const toggleWatchlist = useCallback(
    (instrumentId: string) => {
      const userId = authSession?.id
      setWatchlist((current) => {
        const exists = current.includes(instrumentId)
        if (userId) {
          if (exists) void removeWatchlistItem(userId, instrumentId)
          else void addWatchlistItem(userId, instrumentId)
        }
        return exists
          ? current.filter((id) => id !== instrumentId)
          : [...current, instrumentId]
      })
    },
    [authSession?.id],
  )

  const upsertUserPosition = useCallback(
    (instrumentId: string, quantity: number, averageCost: number) => {
      if (!Number.isFinite(quantity) || !Number.isFinite(averageCost) || quantity <= 0 || averageCost <= 0) {
        return
      }
      const userId = authSession?.id
      if (userId) void upsertPosition(userId, instrumentId, quantity, averageCost)
      setUserPortfolio((current) => {
        const exists = current.some((p) => p.instrumentId === instrumentId)
        if (exists) {
          return current.map((p) =>
            p.instrumentId === instrumentId ? { ...p, quantity, averageCost } : p,
          )
        }
        return [
          ...current,
          { instrumentId, quantity, averageCost, addedAt: new Date().toISOString() },
        ]
      })
    },
    [authSession?.id],
  )

  const removeUserPosition = useCallback(
    (instrumentId: string) => {
      const userId = authSession?.id
      if (userId) void removePosition(userId, instrumentId)
      setUserPortfolio((current) => current.filter((p) => p.instrumentId !== instrumentId))
    },
    [authSession?.id],
  )

  const addSavedNote = useCallback(
    (instrument: InstrumentConfig, text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      const userId = authSession?.id
      const tmpId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      const localNote: SavedNote = {
        id: tmpId,
        instrumentId: instrument.id,
        symbol: instrument.symbol,
        label: instrument.label,
        text: trimmed,
        createdAt: new Date().toISOString(),
      }
      setSavedNotes((current) => [localNote, ...current].slice(0, 50))
      if (userId) {
        void dbAddNote(userId, instrument.id, instrument.symbol, instrument.label, trimmed).then(
          (saved) => {
            if (!saved) return
            setSavedNotes((current) =>
              current.map((n) => (n.id === tmpId ? { ...n, id: saved.id, createdAt: saved.createdAt } : n)),
            )
          },
        )
      }
    },
    [authSession?.id],
  )

  const removeSavedNote = useCallback(
    (noteId: string) => {
      const userId = authSession?.id
      if (userId) void dbDeleteNote(userId, noteId)
      setSavedNotes((current) => current.filter((n) => n.id !== noteId))
    },
    [authSession?.id],
  )

  const addPriceAlert = useCallback(
    (instrument: InstrumentConfig, price: number) => {
      if (!Number.isFinite(price) || price <= 0) return
      const userId = authSession?.id
      const tmpId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      const localAlert: PriceAlert = {
        id: tmpId,
        instrumentId: instrument.id,
        symbol: instrument.symbol,
        price,
        createdAt: new Date().toISOString(),
      }
      setPriceAlerts((current) => [localAlert, ...current].slice(0, 50))
      if (userId) {
        void dbAddAlert(userId, instrument.id, instrument.symbol, price).then((saved) => {
          if (!saved) return
          setPriceAlerts((current) =>
            current.map((a) => (a.id === tmpId ? { ...a, id: saved.id, createdAt: saved.createdAt } : a)),
          )
        })
      }
    },
    [authSession?.id],
  )

  const removePriceAlert = useCallback(
    (alertId: string) => {
      const userId = authSession?.id
      if (userId) void dbDeleteAlert(userId, alertId)
      setPriceAlerts((current) => current.filter((a) => a.id !== alertId))
    },
    [authSession?.id],
  )

  const isInWatchlist = useCallback(
    (instrumentId: string) => watchlist.includes(instrumentId),
    [watchlist],
  )

  const notificationItems = useMemo(() => {
    const items: Array<{ id: string; tone: 'warn' | 'ok' | 'info'; title: string; body: string }> = []
    if (botRunning) {
      items.push({
        id: 'bot-running',
        tone: 'info',
        title: 'Trade bot çalışıyor',
        body: `AI karar motoru · her ${botConfig.intervalSeconds}s`,
      })
    }
    if (botStatus) {
      items.push({
        id: 'bot-status',
        tone: botStatus.tone,
        title: 'Bot taraması',
        body: botStatus.text,
      })
    }
    if (alertPrice) {
      items.push({
        id: 'alert-set',
        tone: 'info',
        title: `${selectedInstrument.symbol} alarmı kuruldu`,
        body: `Hedef fiyat ${alertPrice}`,
      })
    }
    failedQuotes.slice(0, 3).forEach((item) => {
      items.push({
        id: `failed-${item.instrument.id}`,
        tone: 'warn',
        title: `${item.instrument.symbol} verisi gecikti`,
        body: item.error ?? 'Veri akışı yenileniyor.',
      })
    })
    if (lastSyncAt) {
      items.push({
        id: 'sync',
        tone: 'ok',
        title: 'Veri akışı güncellendi',
        body: `Son senkron: ${formatTime(lastSyncAt)}`,
      })
    }
    return items
  }, [
    alertPrice,
    botConfig.intervalSeconds,
    botRunning,
    botStatus,
    failedQuotes,
    lastSyncAt,
    selectedInstrument.symbol,
  ])

  const sharedPageProps: SharedPageProps = {
    selectedMarket,
    selectedInstrument,
    selectedAssetQuote,
    currentMarketQuotes,
    currentMarketInstruments,
    moversUp,
    moversDown,
    byVolume,
    heatmapItems,
    assetSnapshot,
    indicators,
    levels,
    note,
    setNote,
    alertPrice,
    setAlertPrice,
    failedQuotes,
    loadedQuotesCount,
    overviewQuoteMap,
    onSelectMarket: handleSelectMarket,
    onSelectInstrument: handleSelectInstrument,
    onOpenAsset: handleOpenAsset,
    toggleWatchlist,
    isInWatchlist,
    profile,
    setProfile,
    watchlistInstruments,
    watchlistQuotes,
    portfolioPositions,
    portfolioMarketValue,
    portfolioUnrealized,
    portfolioUnrealizedPct,
    savedNotes,
    priceAlerts,
    upsertUserPosition,
    removeUserPosition,
    addSavedNote,
    removeSavedNote,
    addPriceAlert,
    removePriceAlert,
  }

  const livePriceQuotes = liveQuotes.filter((item) => item.price !== null)
  const tickerBase = livePriceQuotes.slice(0, 16)
  const tickerLoop = tickerBase.length > 0 ? [...tickerBase, ...tickerBase] : []

  if (!authSession) {
    if (!authReady) {
      return (
        <div className="login-page">
          <div className="login-bg-anim" />
          <div style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
            <RefreshCw size={18} className="spin" /> Oturum yükleniyor…
          </div>
        </div>
      )
    }
    return (
      <LoginPage
        onLogin={(session) => {
          setAuthSession(session)
          addLog('info', 'Auth', `Giriş yapıldı: ${session.username}`, null, session.id)
        }}
      />
    )
  }

  return (
    <div
      className={`app-shell${sidebarCollapsed ? ' is-collapsed' : ''}${mobileNavOpen ? ' is-mobile-open' : ''}`}
      ref={shellRef}
    >
      <aside className="sidebar shell-enter">
        <div className="sidebar-header">
          <div className="brand-mark">
            <Activity size={20} strokeWidth={2.4} />
          </div>
          <div className="brand-text">
            <p className="brand-eyebrow">Finansal</p>
            <h1>Teknolojiler</h1>
          </div>
          <button
            type="button"
            className="sidebar-collapse"
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label="Yan menü daralt"
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            className="sidebar-mobile-close"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Menüyü kapat"
          >
            <X size={18} />
          </button>
        </div>

        <button
          type="button"
          className="sidebar-profile"
          onClick={() => navigate('/profil')}
        >
          {profile.photoData ? (
            <img src={profile.photoData} alt={profile.name} className="profile-avatar profile-avatar-photo" />
          ) : (
            <span className="profile-avatar">{getAvatarIcon(profile.avatar || (authSession?.avatar ?? 'YA'))}</span>
          )}
          <span className="profile-meta">
            <strong>{profile.name || authSession?.name || 'Misafir'}</strong>
            <small>{profile.email || authSession?.email || 'Profilini düzenle'}</small>
          </span>
        </button>

        <nav className="sidebar-nav" aria-label="Birincil navigasyon">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={() => setMobileNavOpen(false)}
                className={({ isActive }) =>
                  isActive ? 'sidebar-link is-active' : 'sidebar-link'
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-status">
            <span className={getStatusTone(integrationConfig.marketDataStatus)}>
              {integrationConfig.marketDataStatusLabel}
            </span>
          </div>
          {authSession?.role === 'admin' && (
            <a
              href="http://admin.localhost:5173"
              className="sidebar-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Settings size={18} />
              <span>Admin Panel ↗</span>
            </a>
          )}
          <button
            type="button"
            className="sidebar-theme"
            onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            <span>{theme === 'light' ? 'Koyu tema' : 'Açık tema'}</span>
          </button>
          <button type="button" className="sidebar-logout" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Çıkış Yap</span>
          </button>
        </div>
      </aside>

      {mobileNavOpen && (
        <div className="mobile-overlay" onClick={() => setMobileNavOpen(false)} />
      )}

      <div className="app-main">
        <header className="topbar shell-enter">
          <button
            type="button"
            className="hamburger"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Menüyü aç"
          >
            <Menu size={20} />
          </button>

          <div className="search-wrap">
            <Search size={16} className="search-icon" />
            <input
              type="search"
              className="search-input"
              placeholder="Sembol, şirket veya sektör ara..."
              value={searchQuery}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
              onChange={(event) => {
                setSearchQuery(event.target.value)
                setSearchOpen(true)
              }}
            />
            {searchOpen && searchResults.length > 0 && (
              <div className="search-dropdown">
                {searchResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="search-result"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleOpenAsset(item.id)}
                  >
                    <span className="search-symbol">{item.symbol}</span>
                    <span className="search-label">{item.label}</span>
                    <span className="search-tag">{item.sector}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="topbar-actions">
            {lastSyncAt && (
              <span className="sync-pill" title={`Son senkron: ${formatTime(lastSyncAt)}`}>
                <span className="sync-dot" />
                {formatTime(lastSyncAt)}
              </span>
            )}
            <button
              type="button"
              className="icon-button"
              onClick={() => void syncMarketData(selectedMarket)}
              aria-label="Verileri yenile"
            >
              <RefreshCw size={16} className={isLoadingQuotes ? 'spin' : ''} />
            </button>

            <div className="notif-wrap">
              <button
                type="button"
                className="icon-button notif-button"
                onClick={() => setNotificationsOpen((v) => !v)}
                aria-label="Bildirimler"
              >
                <Bell size={16} />
                {notificationItems.length > 0 && (
                  <span className="notif-badge">{notificationItems.length}</span>
                )}
              </button>
              {notificationsOpen && (
                <div className="notif-dropdown">
                  <header>
                    <strong>Bildirimler</strong>
                    <button type="button" onClick={() => setNotificationsOpen(false)}>
                      <X size={14} />
                    </button>
                  </header>
                  {notificationItems.length === 0 ? (
                    <div className="notif-empty">Yeni bildirim yok.</div>
                  ) : (
                    <ul>
                      {notificationItems.map((item) => (
                        <li key={item.id} className={`notif-item tone-${item.tone}`}>
                          <strong>{item.title}</strong>
                          <p>{item.body}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="ticker-shell shell-enter" aria-label="Canlı piyasa bandı">
          {tickerLoop.length > 0 ? (
            <div className="ticker-marquee">
              <div className="ticker-track">
                {tickerLoop.map((item, index) => (
                  <article
                    key={`${item.instrument.id}-${index}`}
                    className="ticker-pill"
                    aria-hidden={index >= tickerBase.length || undefined}
                  >
                    <strong>{item.instrument.symbol}</strong>
                    <span>{formatNumber(item.price)}</span>
                    <small className={getChangeClass(item.percentChange)}>
                      {formatPercent(item.percentChange)}
                    </small>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <div className="ticker-empty-shell">
              <div className="ticker-empty">Canlı piyasa bandı veri bekliyor…</div>
            </div>
          )}
        </section>

        <main className="page-frame" ref={pageRef}>
          <Routes>
            <Route path="/" element={<DashboardPage {...sharedPageProps} />} />
            <Route path="/piyasalar" element={<MarketsPage {...sharedPageProps} />} />
            <Route path="/watchlist" element={<WatchlistPage {...sharedPageProps} />} />
            <Route path="/varlik" element={<AssetPage {...sharedPageProps} />} />
            <Route
              path="/portfoy"
              element={<PortfolioPage {...sharedPageProps} state={botStateForView} />}
            />
            <Route path="/bildirimler" element={<AlertsPage {...sharedPageProps} />} />
            <Route path="/egitim" element={<LearnPage />} />
            <Route
              path="/bot"
              element={
                <BotPage
                  config={botConfig}
                  setConfig={setBotConfig}
                  state={botStateForView}
                  running={botRunning}
                  scanning={botScanning}
                  status={botStatus}
                  decisionLog={botDecisionLog}
                  activity={botActivity}
                  universe={botUniverse}
                  portfolioTransferItems={portfolioPositions}
                  watchlistCount={watchlistInstruments.length}
                  quoteMap={quoteMap}
                  onStart={handleBotStart}
                  onStop={handleBotStop}
                  onRunOnce={() => void runBotTick()}
                  onReset={handleBotReset}
                  onAddCash={handleAddBotCash}
                  onMovePortfolioToBot={handleMovePortfolioToBot}
                  onMoveBotToPortfolio={handleMoveBotToPortfolio}
                  showConfigModal={showBotConfigModal}
                  onConfigModalClose={() => setShowBotConfigModal(false)}
                  onStartConfirm={handleBotStartConfirm}
                />
              }
            />
            <Route path="/destek" element={<SupportPage session={authSession} />} />
            <Route path="/profil" element={<ProfilePage {...sharedPageProps} session={authSession} onSessionUpdate={setAuthSession} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      {(isLoadingQuotes || isLoadingAsset) && (
        <div className="loading-pill">
          <RefreshCw size={14} className="spin" />
          {isLoadingAsset ? 'Varlık verisi yükleniyor…' : 'Piyasa verileri yenileniyor…'}
        </div>
      )}
    </div>
  )
}

type SharedPageProps = {
  selectedMarket: MarketTabId
  selectedInstrument: InstrumentConfig
  selectedAssetQuote: QuoteData | null
  currentMarketQuotes: QuoteData[]
  currentMarketInstruments: InstrumentConfig[]
  moversUp: QuoteData[]
  moversDown: QuoteData[]
  byVolume: QuoteData[]
  heatmapItems: Array<{ symbol: string; company: string; change: number }>
  assetSnapshot: AssetSnapshot
  indicators: ReturnType<typeof buildIndicatorSnapshot>
  levels: ReturnType<typeof calculateSupportResistance>
  note: string
  setNote: (value: string) => void
  alertPrice: string
  setAlertPrice: (value: string) => void
  failedQuotes: QuoteData[]
  loadedQuotesCount: number
  overviewQuoteMap: Map<MarketTabId, QuoteData>
  onSelectMarket: (marketId: MarketTabId) => void
  onSelectInstrument: (instrumentId: string) => void
  onOpenAsset: (instrumentId: string) => void
  toggleWatchlist: (instrumentId: string) => void
  isInWatchlist: (instrumentId: string) => boolean
  profile: Profile
  setProfile: (profile: Profile) => void
  watchlistInstruments: InstrumentConfig[]
  watchlistQuotes: Array<{ instrument: InstrumentConfig; quote: QuoteData | null }>
  portfolioPositions: PortfolioPosition[]
  portfolioMarketValue: number
  portfolioUnrealized: number
  portfolioUnrealizedPct: number
  savedNotes: SavedNote[]
  priceAlerts: PriceAlert[]
  upsertUserPosition: (instrumentId: string, quantity: number, averageCost: number) => void
  removeUserPosition: (instrumentId: string) => void
  addSavedNote: (instrument: InstrumentConfig, text: string) => void
  removeSavedNote: (noteId: string) => void
  addPriceAlert: (instrument: InstrumentConfig, price: number) => void
  removePriceAlert: (alertId: string) => void
}

type PortfolioPosition = {
  id: string
  quantity: number
  averageCost: number
  instrument: InstrumentConfig
  quote: QuoteData | null
  price: number
  marketValue: number
  cost: number
  pnl: number
  pnlPct: number
  color: string
}

function DashboardPage({
  selectedInstrument,
  assetSnapshot,
  overviewQuoteMap,
  watchlistQuotes,
  moversUp,
  moversDown,
  portfolioPositions,
  portfolioMarketValue,
  portfolioUnrealized,
  portfolioUnrealizedPct,
  profile,
  onOpenAsset,
  onSelectMarket,
  toggleWatchlist,
  isInWatchlist,
}: SharedPageProps) {
  const sparkPoints = assetSnapshot.candles.slice(-30).map((item) => item.close)
  const isUp = sparkPoints.length > 1 && sparkPoints[sparkPoints.length - 1] >= sparkPoints[0]
  const dailyHigh = assetSnapshot.candles.length
    ? Math.max(...assetSnapshot.candles.slice(-1).map((c) => c.high))
    : null
  const dailyLow = assetSnapshot.candles.length
    ? Math.min(...assetSnapshot.candles.slice(-1).map((c) => c.low))
    : null

  return (
    <div className="page-stack">
      <section className="dash-hero page-enter">
        <div className="dash-hero-text">
          <p className="eyebrow">Hoş geldin, {profile.name.split(' ')[0] || 'yatırımcı'}</p>
          <h2>Piyasalar bugün ne durumda?</h2>
          <p className="muted">
            Watchlist, portföy ve seçili varlık tek bir ekrandan akıyor. Aşağıdaki kartlardan
            piyasalar arasında geçiş yapabilirsin.
          </p>
        </div>
        <div className="dash-hero-asset">
          <header>
            <span className="chip neutral">{selectedInstrument.symbol}</span>
            <strong>{selectedInstrument.label}</strong>
          </header>
          <div className="dash-hero-price">
            <AnimatedNumber
              value={assetSnapshot.candles.length ? assetSnapshot.candles[assetSnapshot.candles.length - 1].close : 0}
              decimals={2}
            />
          </div>
          <Sparkline points={sparkPoints} positive={isUp} width={320} height={60} />
          <div className="dash-hero-stats">
            <div>
              <span>Yüksek</span>
              <strong>{formatNumber(dailyHigh)}</strong>
            </div>
            <div>
              <span>Düşük</span>
              <strong>{formatNumber(dailyLow)}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="stat-grid page-enter">
        <StatCard
          tone="blue"
          label="Portföy değeri"
          value={`${formatCurrencyValue(portfolioMarketValue, profile.preferredCurrency)}`}
          delta={`${formatPercent(portfolioUnrealizedPct)} dönüş`}
          deltaPositive={portfolioUnrealized >= 0}
          icon={Wallet}
        />
        <StatCard
          tone="green"
          label="Anlık P/L"
          value={`${formatSignedCurrency(portfolioUnrealized, profile.preferredCurrency)}`}
          delta={`${portfolioPositions.length} pozisyon`}
          deltaPositive={portfolioUnrealized >= 0}
          icon={portfolioUnrealized >= 0 ? TrendingUp : TrendingDown}
        />
        <StatCard
          tone="purple"
          label="Watchlist"
          value={`${watchlistQuotes.length} varlık`}
          delta="Profilin ile senkron"
          deltaPositive
          icon={Star}
        />
        <StatCard
          tone="orange"
          label="Aktif piyasalar"
          value={`${marketTabs.length} / ${marketTabs.length}`}
          delta="Canlı veri akışı"
          deltaPositive
          icon={Activity}
        />
      </section>

      <section className="market-strip page-enter">
        {marketTabs.map((tab) => {
          const overview = overviewQuoteMap.get(tab.id) ?? null
          const trendUp = (overview?.percentChange ?? 0) >= 0
          const sparkData = overview
            ? [
                overview.open ?? overview.previousClose ?? overview.price ?? 0,
                overview.low ?? overview.price ?? 0,
                overview.high ?? overview.price ?? 0,
                overview.price ?? overview.previousClose ?? 0,
              ]
            : []
          return (
            <button
              key={tab.id}
              type="button"
              className="market-card"
              onClick={() => onSelectMarket(tab.id)}
            >
              <div className="market-card-head">
                <strong>{tab.label}</strong>
                <span className={overview ? 'chip ok' : 'chip neutral'}>
                  {overview ? 'Canlı' : 'Bekliyor'}
                </span>
              </div>
              <div className="market-card-body">
                <div className="market-card-meta">
                  <small>{overview?.instrument.symbol ?? tab.label}</small>
                  <strong>{formatNumber(overview?.price ?? null)}</strong>
                  <span className={getChangeClass(overview?.percentChange ?? null)}>
                    {formatPercent(overview?.percentChange ?? null)}
                  </span>
                </div>
                <div className="market-card-spark">
                  <Sparkline points={sparkData} positive={trendUp} width={120} height={50} />
                </div>
              </div>
            </button>
          )
        })}
      </section>

      <section className="dash-grid page-enter">
        <article className="card">
          <header className="card-head">
            <div>
              <p className="eyebrow">Portföy</p>
              <h3>Dağılım</h3>
            </div>
            <span className="muted">{formatCurrencyValue(portfolioMarketValue, profile.preferredCurrency)}</span>
          </header>
          <div className="portfolio-summary">
            <DonutChart
              size={220}
              thickness={28}
              centerLabel="Toplam"
              centerValue={formatCompactNumber(portfolioMarketValue)}
              slices={portfolioPositions.map((position) => ({
                label: position.instrument.symbol,
                value: position.marketValue,
                color: position.color,
              }))}
            />
            <ul className="legend-list">
              {portfolioPositions.map((position) => (
                <li key={position.id}>
                  <span className="legend-dot" style={{ background: position.color }} />
                  <span className="legend-name">{position.instrument.symbol}</span>
                  <span className="legend-val">
                    {formatCurrencyValue(position.marketValue, profile.preferredCurrency)}
                  </span>
                  <span className={getChangeClass(position.pnlPct)}>
                    {formatPercent(position.pnlPct)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className="card">
          <header className="card-head">
            <div>
              <p className="eyebrow">Watchlist</p>
              <h3>Favori varlıkların</h3>
            </div>
            <span className="muted">{watchlistQuotes.length} varlık</span>
          </header>
          {watchlistQuotes.length === 0 ? (
            <div className="empty-block">
              <Star size={28} />
              <strong>Henüz favorin yok</strong>
              <p>Piyasalar sayfasından yıldız ikonuna basarak favorilerine ekle.</p>
            </div>
          ) : (
            <ul className="asset-list">
              {watchlistQuotes.map(({ instrument, quote }) => (
                <li key={instrument.id}>
                  <AssetRow
                    instrument={instrument}
                    quote={quote}
                    onOpen={() => onOpenAsset(instrument.id)}
                    onToggleFavorite={() => toggleWatchlist(instrument.id)}
                    isFavorite={isInWatchlist(instrument.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="card">
          <header className="card-head">
            <div>
              <p className="eyebrow">Yükselenler</p>
              <h3>En iyi performans</h3>
            </div>
            <TrendingUp size={18} className="positive" />
          </header>
          <ul className="asset-list compact">
            {moversUp.length === 0 ? (
              <li className="muted small">Yükselen veri yok.</li>
            ) : (
              moversUp.slice(0, 5).map((item) => (
                <li key={item.instrument.id}>
                  <AssetRow
                    instrument={item.instrument}
                    quote={item}
                    onOpen={() => onOpenAsset(item.instrument.id)}
                    onToggleFavorite={() => toggleWatchlist(item.instrument.id)}
                    isFavorite={isInWatchlist(item.instrument.id)}
                  />
                </li>
              ))
            )}
          </ul>
        </article>

        <article className="card">
          <header className="card-head">
            <div>
              <p className="eyebrow">Düşenler</p>
              <h3>En çok geri çekilen</h3>
            </div>
            <TrendingDown size={18} className="negative" />
          </header>
          <ul className="asset-list compact">
            {moversDown.length === 0 ? (
              <li className="muted small">Düşen veri yok.</li>
            ) : (
              moversDown.slice(0, 5).map((item) => (
                <li key={item.instrument.id}>
                  <AssetRow
                    instrument={item.instrument}
                    quote={item}
                    onOpen={() => onOpenAsset(item.instrument.id)}
                    onToggleFavorite={() => toggleWatchlist(item.instrument.id)}
                    isFavorite={isInWatchlist(item.instrument.id)}
                  />
                </li>
              ))
            )}
          </ul>
        </article>
      </section>
    </div>
  )
}

function MarketsPage({
  selectedMarket,
  currentMarketQuotes,
  currentMarketInstruments,
  heatmapItems,
  byVolume,
  onSelectMarket,
  onOpenAsset,
  toggleWatchlist,
  isInWatchlist,
}: SharedPageProps) {
  const selectedMarketLabel =
    marketTabs.find((item) => item.id === selectedMarket)?.label ?? selectedMarket.toUpperCase()

  return (
    <div className="page-stack">
      <section className="card page-enter">
        <header className="card-head">
          <div>
            <p className="eyebrow">Piyasa keşfi</p>
            <h2>{selectedMarketLabel}</h2>
            <p className="muted">Sekmelerden geçiş yap, varlıklara tıkla ve favorilerine ekle.</p>
          </div>
          <div className="market-tab-row">
            {marketTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={selectedMarket === tab.id ? 'market-tab is-active' : 'market-tab'}
                onClick={() => onSelectMarket(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        {currentMarketInstruments.length === 0 ? (
          <p className="muted">Bu piyasa için varlık tanımı yok.</p>
        ) : (
          <ul className="asset-list">
            {currentMarketInstruments.map((instrument) => {
              const quote = currentMarketQuotes.find((item) => item.instrument.id === instrument.id) ?? null
              return (
                <li key={instrument.id}>
                  <AssetRow
                    instrument={instrument}
                    quote={quote}
                    onOpen={() => onOpenAsset(instrument.id)}
                    onToggleFavorite={() => toggleWatchlist(instrument.id)}
                    isFavorite={isInWatchlist(instrument.id)}
                    showSpark
                  />
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="dash-grid page-enter two">
        <article className="card">
          <header className="card-head">
            <div>
              <p className="eyebrow">Hacme göre</p>
              <h3>Öne çıkan işlem hacmi</h3>
            </div>
          </header>
          <ul className="asset-list compact">
            {byVolume.length === 0 ? (
              <li className="muted small">Hacim verisi yok.</li>
            ) : (
              byVolume.map((item) => (
                <li key={item.instrument.id}>
                  <AssetRow
                    instrument={item.instrument}
                    quote={item}
                    onOpen={() => onOpenAsset(item.instrument.id)}
                    onToggleFavorite={() => toggleWatchlist(item.instrument.id)}
                    isFavorite={isInWatchlist(item.instrument.id)}
                  />
                </li>
              ))
            )}
          </ul>
        </article>

        <article className="card">
          <header className="card-head">
            <div>
              <p className="eyebrow">Heatmap</p>
              <h3>Günlük renk haritası</h3>
            </div>
          </header>
          <MiniHeatmap items={heatmapItems} />
        </article>
      </section>
    </div>
  )
}

function WatchlistPage({
  watchlistQuotes,
  toggleWatchlist,
  isInWatchlist,
  onOpenAsset,
}: SharedPageProps) {
  return (
    <div className="page-stack">
      <section className="card page-enter">
        <header className="card-head">
          <div>
            <p className="eyebrow">Favoriler</p>
            <h2>Watchlist</h2>
            <p className="muted">
              Takip ettiğin varlıklar tarayıcına yerel olarak kaydedilir. Yıldıza tıklayarak çıkar.
            </p>
          </div>
          <span className="muted">{watchlistQuotes.length} varlık</span>
        </header>

        {watchlistQuotes.length === 0 ? (
          <div className="empty-block large">
            <Star size={36} />
            <strong>Watchlist boş</strong>
            <p>
              Piyasalar veya Genel Bakış sayfasından bir varlığa yıldız ekleyerek hızlıca buradan
              takip edebilirsin.
            </p>
          </div>
        ) : (
          <ul className="asset-list">
            {watchlistQuotes.map(({ instrument, quote }) => (
              <li key={instrument.id}>
                <AssetRow
                  instrument={instrument}
                  quote={quote}
                  onOpen={() => onOpenAsset(instrument.id)}
                  onToggleFavorite={() => toggleWatchlist(instrument.id)}
                  isFavorite={isInWatchlist(instrument.id)}
                  showSpark
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function AssetPage({
  selectedInstrument,
  selectedAssetQuote,
  assetSnapshot,
  indicators,
  levels,
  note,
  setNote,
  alertPrice,
  setAlertPrice,
  toggleWatchlist,
  isInWatchlist,
  currentMarketInstruments,
  onSelectInstrument,
  onOpenAsset,
  portfolioPositions,
  portfolioMarketValue,
  savedNotes,
  priceAlerts,
  upsertUserPosition,
  removeUserPosition,
  addSavedNote,
  removeSavedNote,
  addPriceAlert,
  removePriceAlert,
  profile,
}: SharedPageProps) {
  const liveQuote =
    selectedAssetQuote && selectedAssetQuote.price !== null && selectedAssetQuote.price !== undefined
      ? selectedAssetQuote
      : null
  const sparkPoints = assetSnapshot.candles.slice(-30).map((item) => item.close)
  const isUp = sparkPoints.length > 1 && sparkPoints[sparkPoints.length - 1] >= sparkPoints[0]

  const [chartType, setChartType] = useState<ChartType>('candle')
  const [chartMenuOpen, setChartMenuOpen] = useState(false)

  const existingPosition = portfolioPositions.find(
    (p) => p.instrument.id === selectedInstrument.id,
  )
  const [positionQty, setPositionQty] = useState(
    existingPosition ? existingPosition.quantity.toString() : '',
  )
  const [positionCost, setPositionCost] = useState(
    existingPosition ? existingPosition.averageCost.toString() : '',
  )
  const lastInstrumentRef = useRef(selectedInstrument.id)
  if (lastInstrumentRef.current !== selectedInstrument.id) {
    lastInstrumentRef.current = selectedInstrument.id
    if (existingPosition) {
      setPositionQty(existingPosition.quantity.toString())
      setPositionCost(existingPosition.averageCost.toString())
    } else {
      setPositionQty('')
      setPositionCost('')
    }
    setChartMenuOpen(false)
  }

  const assetNotes = savedNotes.filter((n) => n.instrumentId === selectedInstrument.id)
  const assetAlerts = priceAlerts.filter((a) => a.instrumentId === selectedInstrument.id)

  const livePrice = liveQuote?.price ?? null

  function handleSubmitPosition(event: React.FormEvent) {
    event.preventDefault()
    const qty = parseFloat(positionQty.replace(',', '.'))
    const cost = parseFloat(positionCost.replace(',', '.'))
    if (Number.isFinite(qty) && Number.isFinite(cost) && qty > 0 && cost > 0) {
      upsertUserPosition(selectedInstrument.id, qty, cost)
    }
  }

  function handleSaveNote() {
    if (note.trim()) {
      addSavedNote(selectedInstrument, note)
      setNote('')
    }
  }

  function handleSaveAlert() {
    const price = parseFloat(alertPrice.replace(',', '.'))
    if (Number.isFinite(price) && price > 0) {
      addPriceAlert(selectedInstrument, price)
      setAlertPrice('')
    }
  }

  function handleQuickFillCurrentPrice() {
    if (livePrice !== null) {
      setAlertPrice(livePrice.toFixed(2))
    }
  }

  const chartTypes: Array<{ id: ChartType; label: string; icon: LucideIcon }> = [
    { id: 'candle', label: 'Mum', icon: CandlestickIcon },
    { id: 'line', label: 'Çizgi', icon: LineChart },
    { id: 'area', label: 'Alan', icon: AreaChart },
  ]
  const activeChart = chartTypes.find((c) => c.id === chartType) ?? chartTypes[0]
  const ActiveChartIcon = activeChart.icon

  return (
    <div className="page-stack">
      <section className="card asset-hero page-enter">
        <div className="asset-hero-info">
          <header>
            <span className="chip neutral">{selectedInstrument.exchange ?? selectedInstrument.sector}</span>
            <button
              type="button"
              className={isInWatchlist(selectedInstrument.id) ? 'fav-button is-active' : 'fav-button'}
              onClick={() => toggleWatchlist(selectedInstrument.id)}
              aria-label="Favoriye ekle"
            >
              <Star size={16} />
              {isInWatchlist(selectedInstrument.id) ? 'Watchlistte' : 'Watchliste ekle'}
            </button>
          </header>
          <h2>{selectedInstrument.label}</h2>
          <p className="muted">{selectedInstrument.symbol} · {selectedInstrument.sector}</p>
          {liveQuote ? (
            <div className="asset-hero-price">
              <span>
                <AnimatedNumber value={liveQuote.price ?? 0} decimals={2} />
              </span>
              <small className={getChangeClass(liveQuote.percentChange)}>
                {formatPercent(liveQuote.percentChange)}
              </small>
            </div>
          ) : (
            <EmptyState
              title="Fiyat verisi bekleniyor"
              description="Veri akışı geldiğinde otomatik güncellenecek."
              status={assetSnapshot.status}
              compact
            />
          )}
          <Sparkline points={sparkPoints} positive={isUp} width={420} height={62} />

          <div className="asset-quick-stats">
            <div>
              <span>Açılış</span>
              <strong>{formatNumber(liveQuote?.open ?? null)}</strong>
            </div>
            <div>
              <span>Yüksek</span>
              <strong>{formatNumber(liveQuote?.high ?? null)}</strong>
            </div>
            <div>
              <span>Düşük</span>
              <strong>{formatNumber(liveQuote?.low ?? null)}</strong>
            </div>
            <div>
              <span>Hacim</span>
              <strong>{formatCompactNumber(liveQuote?.volume ?? null)}</strong>
            </div>
          </div>
        </div>

        <aside className="asset-hero-side">
          <p className="eyebrow">Aynı piyasadan</p>
          <ul className="symbol-mini-list">
            {currentMarketInstruments.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={item.id === selectedInstrument.id ? 'mini-row is-active' : 'mini-row'}
                  onClick={() => onSelectInstrument(item.id)}
                >
                  <strong>{item.symbol}</strong>
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </section>

      <section className="dash-grid page-enter two-and-third">
        <article className="card span-2 chart-card">
          <header className="card-head">
            <div>
              <p className="eyebrow">Grafik</p>
              <h3>{activeChart.label} grafiği</h3>
            </div>
            <div className="chart-type-picker">
              <button
                type="button"
                className="chart-type-trigger"
                onClick={() => setChartMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={chartMenuOpen}
              >
                <ActiveChartIcon size={14} />
                <span>{activeChart.label}</span>
                <ChevronDown size={14} />
              </button>
              {chartMenuOpen && (
                <div className="chart-type-menu" role="menu">
                  {chartTypes.map((type) => {
                    const Icon = type.icon
                    return (
                      <button
                        key={type.id}
                        type="button"
                        role="menuitem"
                        className={chartType === type.id ? 'chart-type-option is-active' : 'chart-type-option'}
                        onClick={() => {
                          setChartType(type.id)
                          setChartMenuOpen(false)
                        }}
                      >
                        <Icon size={14} />
                        {type.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <small className="muted">{assetSnapshot.candles.length} bar</small>
          </header>
          {assetSnapshot.candles.length > 0 ? (
            chartType === 'candle' ? (
              <CandlestickChart data={normalizeCandles(assetSnapshot.candles)} />
            ) : (
              <LineAreaChart data={normalizeCandles(assetSnapshot.candles)} mode={chartType} />
            )
          ) : (
            <EmptyState
              title="Grafik verisi yok"
              description={assetSnapshot.error ?? 'Time series cevabı geldiğinde grafik burada görünür.'}
              status={assetSnapshot.status}
            />
          )}
        </article>

        <article className="card">
          <header className="card-head">
            <div>
              <p className="eyebrow">Teknik</p>
              <h3>Göstergeler</h3>
            </div>
          </header>
          <div className="indicator-grid">
            {indicators.map((indicator) => (
              <div key={indicator.label} className="indicator-card">
                <span>{indicator.label}</span>
                <strong>{indicator.value}</strong>
                <small className={mapIndicatorStatus(indicator.status)}>{indicator.status}</small>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="dash-grid page-enter three">
        <article className="card">
          <header className="card-head">
            <div>
              <p className="eyebrow">Seviyeler</p>
              <h3>Destek / direnç</h3>
            </div>
          </header>
          <div className="level-block">
            <span className="muted small">Destek</span>
            <div className="chip-row">
              {levels.support.length > 0 ? (
                levels.support.map((value) => (
                  <span key={`support-${value}`} className="chip ok">
                    {value.toFixed(2)}
                  </span>
                ))
              ) : (
                <span className="chip neutral">Veri yok</span>
              )}
            </div>
            <span className="muted small">Direnç</span>
            <div className="chip-row">
              {levels.resistance.length > 0 ? (
                levels.resistance.map((value) => (
                  <span key={`resistance-${value}`} className="chip warn">
                    {value.toFixed(2)}
                  </span>
                ))
              ) : (
                <span className="chip neutral">Veri yok</span>
              )}
            </div>
          </div>
        </article>

        <article className="card">
          <header className="card-head">
            <div>
              <p className="eyebrow">Alarm — {selectedInstrument.symbol}</p>
              <h3>Fiyat hedefi</h3>
            </div>
            <Target size={18} />
          </header>
          <p className="muted small">
            Sadece {selectedInstrument.symbol} için kaydedilir.{' '}
            {livePrice !== null && (
              <button type="button" className="link-button" onClick={handleQuickFillCurrentPrice}>
                Anlık {formatNumber(livePrice)}
              </button>
            )}
          </p>
          <div className="alert-inline">
            <input
              value={alertPrice}
              onChange={(event) => setAlertPrice(event.target.value)}
              placeholder="örn. 252.40"
              aria-label="Alarm fiyatı"
              inputMode="decimal"
            />
            <button type="button" className="primary-button" onClick={handleSaveAlert}>
              Kaydet
            </button>
          </div>
          {assetAlerts.length > 0 && (
            <ul className="mini-list">
              {assetAlerts.map((alert) => {
                const distance =
                  livePrice !== null
                    ? ((alert.price - livePrice) / livePrice) * 100
                    : null
                return (
                  <li key={alert.id} className="mini-list-row">
                    <div>
                      <strong>{formatNumber(alert.price)}</strong>
                      {distance !== null && (
                        <small className={getChangeClass(distance)}>
                          {distance > 0 ? '+' : ''}
                          {distance.toFixed(2)}% uzakta
                        </small>
                      )}
                    </div>
                    <button
                      type="button"
                      className="icon-mini"
                      onClick={() => removePriceAlert(alert.id)}
                      aria-label="Alarmı sil"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </article>

        <article className="card">
          <header className="card-head">
            <div>
              <p className="eyebrow">Notlar — {selectedInstrument.symbol}</p>
              <h3>Kişisel günlük</h3>
            </div>
            <StickyNote size={18} />
          </header>
          <textarea
            className="note-area"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={`${selectedInstrument.symbol} için düşüncelerini yaz, kaydet diyince ana sayfaya yansır...`}
          />
          <div className="note-actions">
            <button
              type="button"
              className="primary-button"
              onClick={handleSaveNote}
              disabled={!note.trim()}
            >
              <Save size={14} /> Kaydet
            </button>
            <span className="muted small">{assetNotes.length} kayıtlı not</span>
          </div>
          {assetNotes.length > 0 && (
            <ul className="note-list">
              {assetNotes.slice(0, 3).map((entry) => (
                <li key={entry.id} className="note-list-row">
                  <p>{entry.text}</p>
                  <footer>
                    <small>{formatTime(entry.createdAt)}</small>
                    <button
                      type="button"
                      className="icon-mini"
                      onClick={() => removeSavedNote(entry.id)}
                      aria-label="Notu sil"
                    >
                      <Trash2 size={14} />
                    </button>
                  </footer>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="card page-enter">
        <header className="card-head">
          <div>
            <p className="eyebrow">Portföyüm</p>
            <h3>Bu varlık dahil tüm pozisyonların</h3>
          </div>
          <span className="muted">
            {portfolioPositions.length} pozisyon ·{' '}
            {formatCurrencyValue(portfolioMarketValue, profile.preferredCurrency)}
          </span>
        </header>

        <div className="portfolio-edit-grid">
          <div className="portfolio-edit-chart">
            {portfolioPositions.length > 0 ? (
              <DonutChart
                size={240}
                thickness={26}
                centerLabel={existingPosition ? 'Seçili' : 'Toplam'}
                centerValue={
                  existingPosition
                    ? formatCompactNumber(existingPosition.marketValue)
                    : formatCompactNumber(portfolioMarketValue)
                }
                selectedId={existingPosition ? existingPosition.instrument.id : null}
                slices={portfolioPositions.map((position) => ({
                  id: position.instrument.id,
                  label: `${position.instrument.symbol} · ${formatCurrencyValue(
                    position.marketValue,
                    profile.preferredCurrency,
                  )}`,
                  value: position.marketValue,
                  color: position.color,
                }))}
                onSelect={(slice) => {
                  if (slice.id) onOpenAsset(slice.id)
                }}
              />
            ) : (
              <div className="empty-block">
                <Wallet size={26} />
                <strong>Portföyün boş</strong>
                <p>Aşağıdaki form ile {selectedInstrument.symbol} ekleyerek başlayabilirsin.</p>
              </div>
            )}
            {portfolioPositions.length > 0 && (
              <p className="muted small portfolio-edit-hint">
                Dilimlere tıklayarak o varlığa geç ve düzenle.
              </p>
            )}
          </div>

          <form className="portfolio-edit-form" onSubmit={handleSubmitPosition}>
            <header>
              <strong>
                {existingPosition
                  ? `${selectedInstrument.symbol} pozisyonunu düzenle`
                  : `${selectedInstrument.symbol} ekle`}
              </strong>
              {existingPosition && (
                <span className={existingPosition.pnl >= 0 ? 'chip ok' : 'chip warn'}>
                  P/L {formatSignedNumber(existingPosition.pnl)} (
                  {formatPercent(existingPosition.pnlPct)})
                </span>
              )}
            </header>
            <div className="form-field">
              <span>Adet</span>
              <input
                type="text"
                inputMode="decimal"
                value={positionQty}
                onChange={(event) => setPositionQty(event.target.value)}
                placeholder="örn. 12.5"
              />
            </div>
            <div className="form-field">
              <span>Ortalama maliyet</span>
              <input
                type="text"
                inputMode="decimal"
                value={positionCost}
                onChange={(event) => setPositionCost(event.target.value)}
                placeholder={livePrice !== null ? livePrice.toFixed(2) : 'örn. 250.00'}
              />
              {livePrice !== null && !positionCost && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setPositionCost(livePrice.toFixed(2))}
                >
                  Anlık fiyatı kullan
                </button>
              )}
            </div>
            <div className="form-actions">
              <button type="submit" className="primary-button">
                <Plus size={14} /> {existingPosition ? 'Güncelle' : 'Portföye ekle'}
              </button>
              {existingPosition && (
                <button
                  type="button"
                  className="ghost-button danger"
                  onClick={() => removeUserPosition(selectedInstrument.id)}
                >
                  <Trash2 size={14} /> Pozisyonu sil
                </button>
              )}
            </div>
          </form>

          {portfolioPositions.length > 0 && (
            <ul className="portfolio-edit-legend">
              {portfolioPositions.map((position) => (
                <li key={position.instrument.id}>
                  <button
                    type="button"
                    className={
                      position.instrument.id === selectedInstrument.id
                        ? 'portfolio-legend-row is-active'
                        : 'portfolio-legend-row'
                    }
                    onClick={() => onOpenAsset(position.instrument.id)}
                  >
                    <span className="legend-dot" style={{ background: position.color }} />
                    <span className="legend-name">{position.instrument.symbol}</span>
                    <span className="legend-val">
                      {formatCurrencyValue(position.marketValue, profile.preferredCurrency)}
                    </span>
                    <span className={getChangeClass(position.pnlPct)}>
                      {formatPercent(position.pnlPct)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

function PortfolioPage({
  portfolioPositions,
  portfolioMarketValue,
  portfolioUnrealized,
  portfolioUnrealizedPct,
  profile,
  onOpenAsset,
  overviewQuoteMap,
  upsertUserPosition,
  state,
}: SharedPageProps & { state: BotState }) {
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string>('')
  const [quantity, setQuantity] = useState('')
  const [cost, setCost] = useState('')

  const selectedInstrument = instruments.find((i) => i.id === selectedInstrumentId)
  const liveQuote = selectedInstrument ? overviewQuoteMap.get(selectedInstrument.market) : null
  const livePrice = liveQuote?.price ?? null

  function handleAddPosition(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedInstrument) return
    const qty = parseFloat(quantity.replace(',', '.'))
    const costVal = parseFloat(cost.replace(',', '.'))
    if (Number.isFinite(qty) && Number.isFinite(costVal) && qty > 0 && costVal > 0) {
      upsertUserPosition(selectedInstrument.id, qty, costVal)
      setSelectedInstrumentId('')
      setQuantity('')
      setCost('')
    }
  }

  function handleCloseForm() {
    setSelectedInstrumentId('')
    setQuantity('')
    setCost('')
  }

  function handleQuickFillPrice() {
    if (livePrice !== null) {
      setCost(livePrice.toFixed(2))
    }
  }

  return (
    <div className="page-stack">
      <section className="card asset-hero page-enter">
        <div className="asset-hero-info">
          <p className="eyebrow">Hesap özeti</p>
          <h2>Portföy</h2>
          <p className="muted">
            Demo bakiye sanal kalır. Pozisyonlar gerçek piyasa fiyatları ile değerlenir.
          </p>
          <div className="portfolio-stats">
            <div>
              <span>Bakiye</span>
              <strong>{formatCurrencyValue(demoBalance, profile.preferredCurrency)}</strong>
            </div>
            <div>
              <span>Piyasa değeri</span>
              <strong>{formatCurrencyValue(portfolioMarketValue, profile.preferredCurrency)}</strong>
            </div>
            <div>
              <span>Anlık P/L</span>
              <strong className={portfolioUnrealized >= 0 ? 'positive' : 'negative'}>
                {formatSignedCurrency(portfolioUnrealized, profile.preferredCurrency)}
              </strong>
            </div>
            <div>
              <span>Getiri</span>
              <strong className={portfolioUnrealized >= 0 ? 'positive' : 'negative'}>
                {formatPercent(portfolioUnrealizedPct)}
              </strong>
            </div>
            <div>
              <span>Trade Bot Nakiti</span>
              <strong>${state.cash.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</strong>
            </div>
          </div>
        </div>
        <aside className="asset-hero-side donut-side">
          <DonutChart
            size={220}
            thickness={26}
            centerLabel="Toplam"
            centerValue={formatCompactNumber(portfolioMarketValue)}
            slices={portfolioPositions.map((position) => ({
              id: position.instrument.id,
              label: position.instrument.symbol,
              value: position.marketValue,
              color: position.color,
            }))}
            onSelect={(slice) => {
              if (slice.id) onOpenAsset(slice.id)
            }}
          />
        </aside>
      </section>

      <section className="card page-enter">
        <header className="card-head">
          <div>
            <p className="eyebrow">Hızlı ekleme</p>
            <h3>Piyasa varlıklarından seç</h3>
          </div>
          <span className="muted">{instruments.length} varlık</span>
        </header>

        {selectedInstrument && livePrice !== null && (
          <div className="quick-add-form">
            <div className="quick-add-header">
              <span>
                <strong>{selectedInstrument.symbol}</strong>
                <small>{selectedInstrument.label}</small>
              </span>
              <span className="quick-add-price">
                <strong>{formatNumber(livePrice)}</strong>
              </span>
            </div>

            <form className="portfolio-edit-form" onSubmit={handleAddPosition}>
              <div className="form-field">
                <span>Adet</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  placeholder="örn. 10.5"
                  required
                  autoFocus
                />
              </div>

              <div className="form-field">
                <span>Ortalama maliyet</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={cost}
                  onChange={(event) => setCost(event.target.value)}
                  placeholder={livePrice.toFixed(2)}
                />
                {!cost && (
                  <button
                    type="button"
                    className="link-button"
                    onClick={handleQuickFillPrice}
                  >
                    Canlı fiyatı kullan ({formatNumber(livePrice)})
                  </button>
                )}
              </div>

              <div className="form-actions">
                <button type="submit" className="primary-button" disabled={!quantity || !cost}>
                  <Plus size={14} /> Portföye ekle
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={handleCloseForm}
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        )}

        {!selectedInstrument && (
          <ul className="asset-list">
            {instruments.map((instrument) => {
              const quote = overviewQuoteMap.get(instrument.market)
              return (
                <li key={instrument.id}>
                  <button
                    type="button"
                    className="quick-add-item"
                    onClick={() => setSelectedInstrumentId(instrument.id)}
                  >
                    <span className="quick-add-symbol">
                      <strong>{instrument.symbol}</strong>
                      <small>{instrument.label}</small>
                    </span>
                    <span className="quick-add-info">
                      <strong>{formatNumber(quote?.price ?? null)}</strong>
                      <small className={getChangeClass(quote?.percentChange ?? null)}>
                        {formatPercent(quote?.percentChange ?? null)}
                      </small>
                    </span>
                    <span className="quick-add-trigger">
                      <Plus size={14} />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="card page-enter">
        <header className="card-head">
          <div>
            <p className="eyebrow">Pozisyonlar</p>
            <h3>Açık varlıklar</h3>
          </div>
        </header>
        {portfolioPositions.length === 0 ? (
          <div className="empty-block">
            <Wallet size={26} />
            <strong>Portföyün boş</strong>
            <p>Yukarıdaki form ile bir varlık ekleyerek başlayabilirsin.</p>
          </div>
        ) : (
          <div className="positions-table">
            <div className="positions-head">
              <span>Varlık</span>
              <span>Adet</span>
              <span>Ortalama</span>
              <span>Anlık fiyat</span>
              <span>Değer</span>
              <span>P/L</span>
            </div>
            {portfolioPositions.map((position) => (
              <button
                key={position.id}
                type="button"
                className="positions-row"
                onClick={() => onOpenAsset(position.id)}
              >
                <span className="positions-asset">
                  <span className="positions-bullet" style={{ background: position.color }} />
                  <span>
                    <strong>{position.instrument.symbol}</strong>
                    <small>{position.instrument.label}</small>
                  </span>
                </span>
                <span>{position.quantity}</span>
                <span>{formatNumber(position.averageCost)}</span>
                <span>{formatNumber(position.price)}</span>
                <span>{formatCurrencyValue(position.marketValue, profile.preferredCurrency)}</span>
                <span className={position.pnl >= 0 ? 'positive' : 'negative'}>
                  {formatSignedNumber(position.pnl)} ({formatPercent(position.pnlPct)})
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function AlertsPage({ selectedAssetQuote, alertPrice, failedQuotes, watchlistQuotes }: SharedPageProps) {
  return (
    <div className="page-stack">
      <section className="card page-enter">
        <header className="card-head">
          <div>
            <p className="eyebrow">Bildirim merkezi</p>
            <h2>Alarmlar ve uyarılar</h2>
            <p className="muted">
              Fiyat alarmları, akış uyarıları ve veri kesintileri burada görünür.
            </p>
          </div>
        </header>

        <div className="alert-stat-row">
          <div className="alert-stat">
            <span>Seçili fiyat</span>
            <strong>{formatNumber(selectedAssetQuote?.price ?? null)}</strong>
          </div>
          <div className="alert-stat">
            <span>Hazır alarm</span>
            <strong>{alertPrice || '—'}</strong>
          </div>
          <div className="alert-stat">
            <span>Veri uyarısı</span>
            <strong>{failedQuotes.length}</strong>
          </div>
          <div className="alert-stat">
            <span>Watchlist</span>
            <strong>{watchlistQuotes.length} varlık</strong>
          </div>
        </div>
      </section>

      <section className="card page-enter">
        <header className="card-head">
          <div>
            <p className="eyebrow">Akış</p>
            <h3>Watchlist hareketleri</h3>
          </div>
        </header>
        {watchlistQuotes.length === 0 ? (
          <div className="empty-block">
            <Bell size={26} />
            <strong>Henüz takip ettiğin varlık yok</strong>
            <p>Watchlist sayfasından bir varlık ekleyince hareketler burada listelenir.</p>
          </div>
        ) : (
          <ul className="alert-feed">
            {watchlistQuotes.map(({ instrument, quote }) => (
              <li key={instrument.id} className={`alert-row tone-${(quote?.percentChange ?? 0) >= 0 ? 'ok' : 'warn'}`}>
                <div>
                  <strong>{instrument.symbol}</strong>
                  <small>{instrument.label}</small>
                </div>
                <div className="alert-row-side">
                  <span>{formatNumber(quote?.price ?? null)}</span>
                  <small className={getChangeClass(quote?.percentChange ?? null)}>
                    {formatPercent(quote?.percentChange ?? null)}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

type EduPost = {
  id: string
  title: string
  topic: string
  summary: string
  paragraphs: string[]
  category: string
  gradient: [string, string]
  icon: string
  coverImage?: string
  author: string
  createdAt: string
  publishedAt: string | null
}

function readingTime(paragraphs: string[]): number {
  const words = paragraphs.join(' ').split(/\s+/).length
  return Math.max(1, Math.ceil(words / 200))
}



const CATEGORY_META: Record<string, { gradient: [string, string]; icon: string }> = {
  'teknik-analiz': { gradient: ['#2563eb', '#0ea5e9'], icon: '📈' },
  'risk-yonetimi': { gradient: ['#7c3aed', '#c026d3'], icon: '🛡️' },
  kriptopara: { gradient: ['#f59e0b', '#ef4444'], icon: '₿' },
  forex: { gradient: ['#10b981', '#0d9488'], icon: '💱' },
  hisse: { gradient: ['#3b82f6', '#6366f1'], icon: '📊' },
  genel: { gradient: ['#64748b', '#475569'], icon: '💡' },
}

function LearnPage() {
  const [selectedPost, setSelectedPost] = useState<EduPost | null>(null)
  const [adminPosts, setAdminPosts] = useState<EduPost[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const reloadPublishedPosts = async () => {
      try {
        const { fetchPublishedPosts } = await import('./lib/db')
        const rows = await fetchPublishedPosts()
        if (cancelled) return
        const mapped: EduPost[] = rows.map((p) => {
          const meta = CATEGORY_META[p.category] ?? CATEGORY_META.genel
          return {
            id: p.id,
            title: p.title,
            topic: p.topic,
            summary: p.summary,
            paragraphs: p.paragraphs,
            category: p.category,
            gradient: meta.gradient,
            icon: meta.icon,
            coverImage: p.coverImageUrl ?? undefined,
            author: p.author,
            createdAt: p.createdAt,
            publishedAt: p.publishedAt,
          }
        })
        setAdminPosts(mapped)
        setLoadError(null)
      } catch (err: unknown) {
        if (cancelled) return
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Blog içerikleri yüklenemedi. Lütfen daha sonra tekrar dene.',
        )
      }
    }

    void reloadPublishedPosts()
    // Realtime: yeni post yayınlandığında otomatik güncelle
    const channel = supabase
      .channel('public:edu_posts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'edu_posts' }, () => {
        void reloadPublishedPosts()
      })
      .subscribe()
    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [])

  // ── Full Article View ──
  if (selectedPost) {
    const rt = readingTime(selectedPost.paragraphs)
    return (
      <div className="page-stack">
        <div className="edu-article-back page-enter">
          <button
            type="button"
            className="ghost-button"
            onClick={() => setSelectedPost(null)}
          >
            ← Blog'a Dön
          </button>
        </div>

        <article className="edu-article page-enter">
          {/* Hero */}
          <div className="edu-article-hero">
            {selectedPost.coverImage ? (
              <img
                src={selectedPost.coverImage}
                alt={selectedPost.title}
                className="edu-article-hero-img"
              />
            ) : (
              <div
                className="edu-article-hero-gradient"
                style={{
                  background: `linear-gradient(135deg, ${selectedPost.gradient[0]}, ${selectedPost.gradient[1]})`,
                }}
              >
                <span className="edu-article-hero-icon">{selectedPost.icon}</span>
              </div>
            )}
            <div className="edu-article-hero-overlay">
              <span className="edu-article-cat-badge">{selectedPost.category}</span>
            </div>
          </div>

          {/* Content */}
          <div className="edu-article-content">
            <h1 className="edu-article-title">{selectedPost.title}</h1>
            <p className="edu-article-lead">{selectedPost.summary}</p>

            <div className="edu-article-meta">
              <div className="edu-article-author">
                <span className="edu-article-author-avatar">
                  {selectedPost.author.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <strong>{selectedPost.author}</strong>
                  <small>
                    {new Date(selectedPost.publishedAt!).toLocaleDateString('tr-TR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </small>
                </div>
              </div>
              <div className="edu-article-reading">
                <BookOpen size={14} />
                <span>{rt} dk okuma</span>
              </div>
            </div>

            <div className="edu-article-divider" />

            <div className="edu-article-body">
              {selectedPost.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>

            <div className="edu-article-footer">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setSelectedPost(null)}
              >
                ← Blog'a Dön
              </button>
            </div>
          </div>
        </article>
      </div>
    )
  }

  // ── Blog Listing View ──
  const featured = adminPosts[0]
  const rest = adminPosts.slice(1)

  return (
    <div className="page-stack">
      {loadError && (
        <section className="card page-enter">
          <div className="form-error">{loadError}</div>
        </section>
      )}
      {/* Blog listing */}
      {adminPosts.length > 0 && (
        <section className="page-enter">
          <div className="edu-blog-header">
            <div>
              <p className="eyebrow">Eğitim Blogu</p>
              <h2 className="edu-blog-title">Güncel Makaleler</h2>
            </div>
            <span className="chip neutral">{adminPosts.length} makale</span>
          </div>

          {/* Featured post — NO page-enter here (parent section already has it) */}
          {featured && (
            <button
              type="button"
              className="edu-featured-card"
              onClick={() => setSelectedPost(featured)}
            >
              <div className="edu-featured-img-wrap">
                {featured.coverImage ? (
                  <img
                    src={featured.coverImage}
                    alt={featured.title}
                    className="edu-featured-img"
                  />
                ) : (
                  <div
                    className="edu-featured-gradient"
                    style={{
                      background: `linear-gradient(135deg, ${featured.gradient[0]}, ${featured.gradient[1]})`,
                    }}
                  >
                    <span>{featured.icon}</span>
                  </div>
                )}
                <div className="edu-featured-overlay">
                  <span className="edu-cat-pill">{featured.category}</span>
                  <span className="edu-cat-pill edu-cat-pill-new">Yeni</span>
                </div>
              </div>
              <div className="edu-featured-body">
                <h3 className="edu-featured-title">{featured.title}</h3>
                <p className="edu-featured-summary">{featured.summary}</p>
                <div className="edu-featured-meta">
                  <span>{featured.author}</span>
                  <span>·</span>
                  <span>
                    {new Date(featured.publishedAt!).toLocaleDateString('tr-TR', {
                      day: 'numeric',
                      month: 'long',
                    })}
                  </span>
                  <span>·</span>
                  <span>{readingTime(featured.paragraphs)} dk</span>
                </div>
              </div>
            </button>
          )}

          {/* Rest grid */}
          {rest.length > 0 && (
            <div className="edu-posts-grid" style={{ marginTop: 16 }}>
              {rest.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  className="edu-post-card"
                  onClick={() => setSelectedPost(post)}
                >
                  <div
                    className="edu-post-card-cover"
                    style={
                      post.coverImage
                        ? {}
                        : {
                            background: `linear-gradient(135deg, ${post.gradient[0]}, ${post.gradient[1]})`,
                          }
                    }
                  >
                    {post.coverImage ? (
                      <img
                        src={post.coverImage}
                        alt={post.title}
                        className="edu-post-card-img"
                      />
                    ) : (
                      <span>{post.icon}</span>
                    )}
                  </div>
                  <div className="edu-post-card-body">
                    <span className="edu-post-card-cat">{post.category}</span>
                    <strong>{post.title}</strong>
                    <p>{post.summary}</p>
                    <div className="edu-post-card-footer">
                      <small>{post.author}</small>
                      <small>·</small>
                      <small>
                        {new Date(post.publishedAt!).toLocaleDateString('tr-TR', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </small>
                      <small>·</small>
                      <small>{readingTime(post.paragraphs)} dk</small>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {adminPosts.length === 0 && (
        <section className="card page-enter">
          <div className="edu-empty-state">
            <BookOpen size={48} />
            <h3>Henüz içerik yok</h3>
            <p>
              Admin panelinden içerik ekleyebilirsin.
              <br />
              <a href="http://admin.localhost:5173/egitim" target="_blank" rel="noopener noreferrer">
                Admin paneline git →
              </a>
            </p>
          </div>
        </section>
      )}
    </div>
  )
}

function ProfilePage({
  profile,
  setProfile,
  watchlistInstruments,
  portfolioPositions,
  failedQuotes,
  loadedQuotesCount,
  session,
  onSessionUpdate,
}: SharedPageProps & { session: SessionUser | null; onSessionUpdate: (s: SessionUser) => void }) {
  const [draft, setDraft] = useState<Profile>(profile)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [newPwd2, setNewPwd2] = useState('')
  const [pwdMessage, setPwdMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [pwdLoading, setPwdLoading] = useState(false)
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([])

  useEffect(() => {
    if (!session) return
    void (async () => {
      const list = await getLoginHistoryForUser(session.id)
      setLoginHistory(list)
    })()
  }, [session])

  async function handlePasswordChange(event: React.FormEvent) {
    event.preventDefault()
    setPwdMessage(null)
    if (!session) return
    if (newPwd !== newPwd2) {
      setPwdMessage({ tone: 'err', text: 'Yeni şifreler birbirini tutmuyor.' })
      return
    }
    if (newPwd.length < 6) {
      setPwdMessage({ tone: 'err', text: 'Şifre en az 6 karakter olmalıdır.' })
      return
    }
    setPwdLoading(true)
    const ok = await changePassword(session.id, oldPwd, newPwd)
    setPwdLoading(false)
    if (!ok) {
      setPwdMessage({ tone: 'err', text: 'Mevcut şifren hatalı.' })
      return
    }
    setOldPwd('')
    setNewPwd('')
    setNewPwd2('')
    setPwdMessage({ tone: 'ok', text: 'Şifren başarıyla güncellendi.' })
    addLog('success', 'Profil', 'Şifre değiştirildi', null, session.id)
  }

  const totalQuotes = loadedQuotesCount + failedQuotes.length
  const liveScore = totalQuotes === 0 ? 0 : Math.round((loadedQuotesCount / totalQuotes) * 100)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setProfile(draft)
    if (session) {
      await updateUserProfile(session.id, {
        name: draft.name,
        email: draft.email,
        avatar: draft.avatar,
        photoData: draft.photoData,
        bio: draft.bio,
        preferred_currency: draft.preferredCurrency,
      })
      onSessionUpdate({
        ...session,
        name: draft.name,
        email: draft.email,
        avatar: draft.avatar,
        photoData: draft.photoData,
      })
    }
    setSavedAt(new Date().toISOString())
    addLog('info', 'Profil', 'Profil güncellendi', null, session?.id)
  }

  async function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!session) {
      // Oturum yoksa local preview göster
      const reader = new FileReader()
      reader.onload = (e) => {
        const photoData = e.target?.result as string
        setDraft((d) => ({ ...d, photoData }))
      }
      reader.readAsDataURL(file)
      return
    }
    // Supabase Storage'a yükle, URL'i profile.photoData (photo_url) olarak sakla
    const publicUrl = await uploadProfilePhoto(session.id, file)
    if (publicUrl) {
      setDraft((d) => ({ ...d, photoData: publicUrl }))
      await updateUserProfile(session.id, { photoData: publicUrl })
      onSessionUpdate({ ...session, photoData: publicUrl })
    }
  }

  return (
    <div className="page-stack">
      <section className="card asset-hero page-enter profile-hero">
        <div className="asset-hero-info">
          <p className="eyebrow">Profil</p>
          <div className="profile-identity">
            <div className="profile-photo-wrap">
              {draft.photoData ? (
                <img src={draft.photoData} alt={draft.name} className="profile-avatar lg profile-avatar-photo" />
              ) : (
                <span className="profile-avatar lg">{getAvatarIcon(draft.avatar)}</span>
              )}
              <button
                type="button"
                className="profile-photo-upload-btn"
                onClick={() => photoInputRef.current?.click()}
                title="Fotoğraf yükle"
              >
                <Upload size={14} />
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handlePhotoUpload}
              />
            </div>
            <div>
              <h2>{draft.name || 'İsimsiz Yatırımcı'}</h2>
              <p className="muted">
                {draft.email || 'E-posta eklenmedi'} · {draft.preferredCurrency}
              </p>
              <p className="muted small">
                Üyelik: {new Date(profile.joinedAt).toLocaleDateString('tr-TR')}
              </p>
            </div>
          </div>
          {draft.bio && <p className="profile-bio">{draft.bio}</p>}
        </div>
        <aside className="asset-hero-side">
          <div className="profile-stat-grid">
            <div>
              <span>Watchlist</span>
              <strong>{watchlistInstruments.length}</strong>
            </div>
            <div>
              <span>Pozisyon</span>
              <strong>{portfolioPositions.length}</strong>
            </div>
            <div>
              <span>Veri akışı</span>
              <strong>{liveScore}%</strong>
            </div>
            <div>
              <span>Hata</span>
              <strong>{failedQuotes.length}</strong>
            </div>
          </div>
        </aside>
      </section>

      <section className="card page-enter">
        <header className="card-head">
          <div>
            <p className="eyebrow">Profili düzenle</p>
            <h3>Kişisel bilgiler</h3>
          </div>
          {savedAt && <span className="chip ok">Kaydedildi · {formatTime(savedAt)}</span>}
        </header>

        <form className="profile-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>İsim</span>
            <input
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="Adın Soyadın"
            />
          </label>
          <label className="form-field">
            <span>E-posta</span>
            <input
              type="email"
              value={draft.email}
              onChange={(event) => setDraft({ ...draft, email: event.target.value })}
              placeholder="ornek@mail.com"
            />
          </label>
          <label className="form-field">
            <span>Para birimi</span>
            <div className="pill-group">
              {currencyOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={draft.preferredCurrency === option ? 'pill is-active' : 'pill'}
                  onClick={() => setDraft({ ...draft, preferredCurrency: option })}
                >
                  {option}
                </button>
              ))}
            </div>
          </label>
          <label className="form-field full">
            <span>Avatar</span>
            <div className="avatar-grid">
              {avatarOptions.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={draft.avatar === option.id ? 'avatar-pick is-active' : 'avatar-pick'}
                  onClick={() => setDraft({ ...draft, avatar: option.id })}
                  title={option.label}
                >
                  {option.icon}
                </button>
              ))}
            </div>
          </label>
          <label className="form-field full">
            <span>Bio</span>
            <textarea
              value={draft.bio}
              onChange={(event) => setDraft({ ...draft, bio: event.target.value })}
              placeholder="Yatırım tarzın, amacın veya kısa bir tanıtım..."
            />
          </label>

          <div className="form-actions">
            <button type="submit" className="primary-button">
              Profili kaydet
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setDraft(defaultProfile)}
            >
              Varsayılana dön
            </button>
          </div>
        </form>
      </section>

      <section className="card page-enter">
        <header className="card-head">
          <div>
            <p className="eyebrow">Güvenlik</p>
            <h3>Şifre değiştir</h3>
          </div>
          <ShieldCheck size={20} />
        </header>
        <form className="profile-form" onSubmit={handlePasswordChange}>
          <label className="form-field">
            <span>Mevcut şifre</span>
            <input
              type="password"
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </label>
          <label className="form-field">
            <span>Yeni şifre</span>
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              autoComplete="new-password"
              placeholder="En az 6 karakter"
              required
            />
          </label>
          <label className="form-field">
            <span>Yeni şifre (tekrar)</span>
            <input
              type="password"
              value={newPwd2}
              onChange={(e) => setNewPwd2(e.target.value)}
              autoComplete="new-password"
              placeholder="Yeniden gir"
              required
            />
          </label>
          {pwdMessage && (
            <div className={pwdMessage.tone === 'ok' ? 'inline-success full' : 'inline-error full'}>
              {pwdMessage.text}
            </div>
          )}
          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={pwdLoading}>
              {pwdLoading ? <RefreshCw size={14} className="spin" /> : <ShieldCheck size={14} />}
              {pwdLoading ? ' Güncelleniyor…' : ' Şifreyi güncelle'}
            </button>
          </div>
        </form>
      </section>

      <section className="card page-enter">
        <header className="card-head">
          <div>
            <p className="eyebrow">Oturum geçmişi</p>
            <h3>Son giriş hareketleri</h3>
          </div>
          <small className="muted">Toplam {loginHistory.length}</small>
        </header>
        {loginHistory.length === 0 ? (
          <p className="muted small">Henüz kayıt yok. Çıkış yapıp tekrar giriş yaptığında burada görünür.</p>
        ) : (
          <div className="session-history">
            {loginHistory.slice(0, 10).map((entry) => (
              <div key={entry.id} className={`session-row session-${entry.outcome}`}>
                <div>
                  <strong>{entry.outcome === 'success' ? 'Başarılı giriş' : 'Başarısız deneme'}</strong>
                  <p className="muted small">{entry.userAgent ? entry.userAgent.slice(0, 80) : 'Bilinmeyen cihaz'}</p>
                </div>
                <time className="muted small">{new Date(entry.at).toLocaleString('tr-TR')}</time>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

type BotPageProps = {
  config: BotConfig
  setConfig: (next: BotConfig) => void
  state: BotState
  running: boolean
  scanning: boolean
  status: BotStatusMessage | null
  decisionLog: BotDecisionLogEntry[]
  activity: ActivityEvent[]
  universe: InstrumentConfig[]
  portfolioTransferItems: PortfolioPosition[]
  watchlistCount: number
  quoteMap: Map<string, QuoteData>
  onStart: () => void
  onStop: () => void
  onRunOnce: () => void
  onReset: () => void
  onAddCash: (amount: number) => void
  onMovePortfolioToBot: (instrumentId: string) => void
  onMoveBotToPortfolio: (instrumentId: string) => void
  showConfigModal: boolean
  onConfigModalClose: () => void
  onStartConfirm: () => void
}

function BotPage({
  config,
  setConfig,
  state,
  running,
  scanning,
  status,
  decisionLog,
  activity,
  universe,
  portfolioTransferItems,
  watchlistCount,
  quoteMap,
  onStart,
  onStop,
  onRunOnce,
  onReset,
  onAddCash,
  onMovePortfolioToBot,
  onMoveBotToPortfolio,
  showConfigModal,
  onConfigModalClose,
  onStartConfirm,
}: BotPageProps) {
  const [resetConfirm, setResetConfirm] = useState(false)
  const [cashInput, setCashInput] = useState('10000')
  const [liveTime, setLiveTime] = useState(() => new Date().toLocaleTimeString('tr-TR'))
  const [livePrices, setLivePrices] = useState<Map<string, { price: number; change: number }>>(
    () => {
      const m = new Map<string, { price: number; change: number }>()
      quoteMap.forEach((q, id) => {
        if (q.price != null) m.set(id, { price: q.price, change: q.percentChange ?? 0 })
      })
      return m
    },
  )

  useEffect(() => {
    const tick = setInterval(() => {
      setLiveTime(new Date().toLocaleTimeString('tr-TR'))
      setLivePrices((prev) => {
        const next = new Map(prev)
        next.forEach((v, id) => {
          const drift = (Math.random() - 0.499) * 0.0018
          const newPrice = v.price * (1 + drift)
          next.set(id, { price: newPrice, change: v.change + drift * 100 * 0.1 })
        })
        quoteMap.forEach((q, id) => {
          if (q.price != null && !next.has(id)) {
            next.set(id, { price: q.price, change: q.percentChange ?? 0 })
          }
        })
        return next
      })
    }, 1200)
    return () => clearInterval(tick)
  }, [quoteMap])

  const priceLookup = useCallback(
    (id: string) => quoteMap.get(id)?.price ?? null,
    [quoteMap],
  )

  const valuation = useMemo(() => botPortfolioValue(state, priceLookup), [state, priceLookup])
  const allocation = state.cash * RISK_FACTORS[config.risk]
  const openAiAvailable = integrationConfig.openAiAvailable
  const tradeStats = useMemo(() => {
    const buys = state.trades.filter((t) => t.side === 'buy').length
    const sells = state.trades.filter((t) => t.side === 'sell').length
    const closedPnls: number[] = []
    const openLots: Record<string, { qty: number; cost: number }> = {}
    const reversed = [...state.trades].reverse()
    for (const trade of reversed) {
      const lot = openLots[trade.instrumentId] ?? { qty: 0, cost: 0 }
      if (trade.side === 'buy') {
        lot.qty += trade.quantity
        lot.cost += trade.quantity * trade.price
      } else {
        const avg = lot.qty > 0 ? lot.cost / lot.qty : trade.price
        closedPnls.push((trade.price - avg) * trade.quantity)
        lot.qty = Math.max(0, lot.qty - trade.quantity)
        lot.cost = lot.qty * avg
      }
      openLots[trade.instrumentId] = lot
    }
    const wins = closedPnls.filter((p) => p > 0).length
    const losses = closedPnls.filter((p) => p < 0).length
    const winRate = closedPnls.length > 0 ? (wins / closedPnls.length) * 100 : 0
    const realized = closedPnls.reduce((a, b) => a + b, 0)
    return { buys, sells, wins, losses, winRate, realized, closed: closedPnls.length }
  }, [state.trades])

  const positionRows = state.positions.map((position) => {
    const live = priceLookup(position.instrumentId)
    const price = live ?? position.averageCost
    const marketValue = price * position.quantity
    const cost = position.averageCost * position.quantity
    const pnl = marketValue - cost
    const pnlPct = cost === 0 ? 0 : (pnl / cost) * 100
    return { position, price, marketValue, pnl, pnlPct, live }
  })

  function handleConfirmReset() {
    if (!resetConfirm) {
      setResetConfirm(true)
      return
    }
    onReset()
    setResetConfirm(false)
  }

  function handleAddCashSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = cashInput.replace(/\s/g, '').replace(',', '.')
    const amount = Number(normalized)
    if (!Number.isFinite(amount) || amount <= 0) {
      return
    }
    onAddCash(amount)
    setCashInput('')
  }

  const tradeMarkers = useMemo(
    () =>
      state.trades.map((trade) => ({
        at: trade.timestamp,
        side: trade.side,
        symbol: trade.symbol,
        price: trade.price,
      })),
    [state.trades],
  )

  return (
    <div className="page-stack bot-page">
      {/* Live Price Ticker */}
      {livePrices.size > 0 && (
        <section className="bot-live-ticker page-enter">
          <div className="bot-ticker-label">
            <span className="bot-ticker-dot" />
            Canlı · {liveTime}
          </div>
          <div className="bot-ticker-scroll">
            {universe.slice(0, 8).map((inst) => {
              const lp = livePrices.get(inst.id)
              if (!lp) return null
              const pos = lp.change >= 0
              return (
                <div key={inst.id} className="bot-ticker-item">
                  <span className="bot-ticker-sym">{inst.symbol}</span>
                  <span className="bot-ticker-price">{lp.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className={pos ? 'bot-ticker-chg positive' : 'bot-ticker-chg negative'}>
                    {pos ? '▲' : '▼'} {Math.abs(lp.change).toFixed(2)}%
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="bot-headline page-enter">
        <div className="bot-headline-left">
          <div className="bot-headline-brand">
            <span className="bot-headline-icon">
              <Bot size={22} />
            </span>
            <div>
              <p className="eyebrow">Sanal trade bot · AI destekli</p>
              <h2>Otomatik karar motoru</h2>
            </div>
          </div>
          <div className={`bot-live-pill is-${running ? 'on' : 'off'}`}>
            <span className="bot-pulse" />
            {running ? (scanning ? 'Tarıyor…' : 'Canlı çalışıyor') : 'Duraklatıldı'}
            {state.lastRunAt && <em>· son {formatTime(state.lastRunAt)}</em>}
          </div>
        </div>

        <div className="bot-headline-actions">
          {running ? (
            <button type="button" className="primary-button danger" onClick={onStop}>
              <Pause size={14} /> Durdur
            </button>
          ) : (
            <button type="button" className="primary-button" onClick={onStart}>
              <Play size={14} /> Başlat
            </button>
          )}
          <button
            type="button"
            className="ghost-button"
            onClick={onRunOnce}
            disabled={scanning}
          >
            <Zap size={14} /> {scanning ? 'Tarıyor…' : 'Tek karar'}
          </button>
          <button
            type="button"
            className={resetConfirm ? 'ghost-button danger' : 'ghost-button'}
            onClick={handleConfirmReset}
          >
            <RotateCcw size={14} /> {resetConfirm ? 'Onayla' : 'Sıfırla'}
          </button>
        </div>
      </section>

      <section className="bot-kpi-row page-enter">
        <article className="bot-kpi gradient-blue">
          <span className="bot-kpi-label">Toplam değer</span>
          <strong className="bot-kpi-value">
            ${valuation.total.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
          </strong>
          <small>
            Nakit ${state.cash.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} · Pozisyon $
            {valuation.positionsValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
          </small>
        </article>
        <article className={`bot-kpi ${valuation.pnl >= 0 ? 'gradient-green' : 'gradient-red'}`}>
          <span className="bot-kpi-label">Net P/L</span>
          <strong className="bot-kpi-value">
            {valuation.pnl >= 0 ? '+' : '−'}$
            {Math.abs(valuation.pnl).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
          </strong>
          <small>{formatPercent(valuation.pnlPct)} başlangıca göre</small>
        </article>
        <article className="bot-kpi gradient-purple">
          <span className="bot-kpi-label">İşlem hacmi</span>
          <strong className="bot-kpi-value">{state.trades.length}</strong>
          <small>
            {tradeStats.buys} AL · {tradeStats.sells} SAT · {tradeStats.closed} kapanmış
          </small>
        </article>
        <article className="bot-kpi gradient-orange">
          <span className="bot-kpi-label">Kazanma oranı</span>
          <strong className="bot-kpi-value">%{tradeStats.winRate.toFixed(0)}</strong>
          <small>
            {tradeStats.wins} kazanan · {tradeStats.losses} kaybeden · realize{' '}
            {tradeStats.realized >= 0 ? '+' : '−'}$
            {Math.abs(tradeStats.realized).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
          </small>
        </article>
      </section>

      {!openAiAvailable && (
        <div className="bot-warning page-enter">
          <AlertTriangle size={18} />
          <div>
            <strong>OpenAI anahtarı tanımlı değil</strong>
            <p>
              <code>.env</code> dosyasına <code>VITE_OPENAI_API_KEY=sk-...</code> ekleyip dev
              sunucusunu yeniden başlat. Anahtar olmadan AI karar motoru işlem açmaz.
            </p>
          </div>
        </div>
      )}

      <section className="bot-grid page-enter">
        <article className={`card bot-chart-card${running ? ' bot-chart-live' : ''}`}>
          <header className="card-head">
            <div>
              <p className="eyebrow">{running ? '● Canlı performans' : 'Performans geçmişi'}</p>
              <h3>Sanal portföy eğrisi</h3>
            </div>
            <div className="bot-chart-legend">
              <span className="legend-pill buy">
                <span /> AL
              </span>
              <span className="legend-pill sell">
                <span /> SAT
              </span>
              <span className={valuation.pnl >= 0 ? 'chip ok' : 'chip warn'}>
                {valuation.pnl >= 0 ? '↗' : '↘'} {formatPercent(valuation.pnlPct)}
              </span>
            </div>
          </header>
          <EquityChart
            points={state.equityHistory}
            initial={state.initialCash}
            trades={tradeMarkers}
            height={300}
          />
        </article>

        <article className="card bot-activity-card">
          <header className="card-head">
            <div>
              <p className="eyebrow">Canlı akış</p>
              <h3>Bot hareketleri</h3>
            </div>
            <span className={`live-dot ${running ? 'is-on' : ''}`}>
              <span /> {activity.length}
            </span>
          </header>
          {activity.length === 0 ? (
            <div className="empty-block">
              <Activity size={26} />
              <strong>Akış henüz boş</strong>
              <p>Bot başlatıldığında her tarama, karar ve işlem buraya canlı düşer.</p>
            </div>
          ) : (
            <ul className="activity-feed">
              {activity.map((event) => (
                <li key={event.id} className={`activity-item kind-${event.kind}`}>
                  <span className="activity-icon">
                    {event.kind === 'trade' ? (
                      event.side === 'buy' ? (
                        <TrendingUp size={14} />
                      ) : (
                        <TrendingDown size={14} />
                      )
                    ) : event.kind === 'decision' ? (
                      <Sparkles size={14} />
                    ) : event.kind === 'scan' ? (
                      <Activity size={14} />
                    ) : event.kind === 'error' ? (
                      <AlertTriangle size={14} />
                    ) : (
                      <Bot size={14} />
                    )}
                  </span>
                  <div className="activity-body">
                    <header>
                      <strong>{event.title}</strong>
                      <time>{formatTime(event.at)}</time>
                    </header>
                    <p>{event.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="bot-grid two page-enter">
        <article className="card">
          <header className="card-head">
            <div>
              <p className="eyebrow">Yapılandırma</p>
              <h3>AI karar ve risk</h3>
            </div>
            <div className="bot-meta-inline">
              <span>
                Evren <strong>{universe.length}</strong> (
                {config.fundingMode === 'portfolio'
                  ? 'portföy'
                  : watchlistCount > 0
                    ? 'watchlist'
                    : 'varsayılan'}
                )
              </span>
              <span>
                Tahsis ~$
                <strong>{allocation.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</strong>
              </span>
            </div>
          </header>

          <div className="bot-config-grid">
            <div className="form-field full">
              <span>İşlem kaynağı</span>
              <div className="pill-group">
                <button
                  type="button"
                  className={config.fundingMode === 'wallet' ? 'pill is-active' : 'pill'}
                  onClick={() => setConfig({ ...config, strategy: 'ai', fundingMode: 'wallet' })}
                >
                  Bot bakiyesi
                </button>
                <button
                  type="button"
                  className={config.fundingMode === 'portfolio' ? 'pill is-active' : 'pill'}
                  onClick={() => setConfig({ ...config, strategy: 'ai', fundingMode: 'portfolio' })}
                >
                  Portföyüm
                </button>
              </div>
            </div>

            {config.fundingMode === 'portfolio' && (
              <div className="form-field full">
                <span>Portföyden trade bota aktar</span>
                {portfolioTransferItems.length === 0 ? (
                  <p className="muted small">
                    Aktarılabilecek portföy varlığı yok. Portföy sayfasından varlık ekleyebilir
                    veya bot cüzdanındaki varlıkları geri alabilirsin.
                  </p>
                ) : (
                  <div className="bot-transfer-list">
                    {portfolioTransferItems.map((item) => (
                      <div key={item.id} className="bot-transfer-row">
                        <span>
                          <strong>{item.instrument.symbol}</strong>
                          <small>
                            {item.quantity.toFixed(4)} adet · {formatCurrencyValue(item.marketValue, 'USD')}
                          </small>
                        </span>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => onMovePortfolioToBot(item.id)}
                        >
                          Bota aktar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="form-field full">
              <span>Nakit ekle</span>
              <div className="form-field">
                <span>Para birimi</span>
                <div className="pill-group">
                  {(['USD', 'TRY', 'EUR'] as const).map((curr) => (
                    <button
                      key={curr}
                      type="button"
                      className={config.currency === curr ? 'pill is-active' : 'pill'}
                      onClick={() => setConfig({ ...config, currency: curr })}
                    >
                      {curr}
                    </button>
                  ))}
                </div>
              </div>
              <form className="bot-cash-form" onSubmit={handleAddCashSubmit}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={cashInput}
                  onChange={(event) => setCashInput(event.target.value)}
                  placeholder="İstediğin tutarı yaz"
                />
                <button type="submit" className="ghost-button">
                  <Plus size={14} /> Ekle
                </button>
              </form>
            </div>

            <div className="form-field">
              <span>Risk seviyesi</span>
              <div className="pill-group">
                {(['low', 'medium', 'high'] as BotRisk[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={config.risk === r ? 'pill is-active' : 'pill'}
                    onClick={() => setConfig({ ...config, risk: r })}
                  >
                    {RISK_LABEL[r]}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-field">
              <span>Tarama aralığı</span>
              <div className="pill-group">
                {INTERVAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={config.intervalSeconds === opt.value ? 'pill is-active' : 'pill'}
                    onClick={() => setConfig({ ...config, intervalSeconds: opt.value })}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {status && (
            <div className={`bot-toast tone-${status.tone}`}>
              <span className="bot-toast-time">{formatTime(status.at)}</span>
              <span>{status.text}</span>
            </div>
          )}
        </article>

        <article className="card">
          <header className="card-head">
            <div>
              <p className="eyebrow">Açık pozisyonlar</p>
              <h3>Bot cüzdanı</h3>
            </div>
            <span className="muted">{state.positions.length} pozisyon</span>
          </header>
          {positionRows.length === 0 ? (
            <div className="empty-block">
              <Bot size={26} />
              <strong>Henüz açık pozisyon yok</strong>
              <p>Bot bir alım sinyali ürettiğinde pozisyonlar burada listelenir.</p>
            </div>
          ) : (
            <div className="positions-table bot-positions">
              <div className="positions-head bot-head">
                <span>Varlık</span>
                <span>Adet</span>
                <span>Ortalama</span>
                <span>Anlık</span>
                <span>P/L</span>
              </div>
              {positionRows.map((row) => (
                <div key={row.position.instrumentId} className="positions-row bot-row">
                  <span className="positions-asset">
                    <span className="positions-bullet bot-bullet" />
                    <span>
                      <strong>{row.position.symbol}</strong>
                      <small>{row.position.label}</small>
                    </span>
                  </span>
                  <span>{row.position.quantity.toFixed(4)}</span>
                  <span>{formatNumber(row.position.averageCost)}</span>
                  <span>{formatNumber(row.price)}</span>
                  <span className={row.pnl >= 0 ? 'positive' : 'negative'}>
                    {formatSignedNumber(row.pnl)} ({formatPercent(row.pnlPct)})
                  </span>
                  {config.fundingMode === 'portfolio' && (
                    <button
                      type="button"
                      className="icon-mini delete-btn"
                      onClick={() => onMoveBotToPortfolio(row.position.instrumentId)}
                      aria-label="Portföye geri al"
                      title="Portföye geri al"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="card page-enter">
        <header className="card-head">
          <div>
            <p className="eyebrow">Karar günlüğü</p>
            <h3>Son AI / teknik kararlar</h3>
          </div>
          <span className="muted">{decisionLog.length}</span>
        </header>
        {decisionLog.length === 0 ? (
          <div className="empty-block">
            <Eye size={26} />
            <strong>Karar yok</strong>
            <p>Bot çalıştığında her tarama bir karar üretir ve burada listelenir.</p>
          </div>
        ) : (
          <ul className="decision-log decision-log-grid">
            {decisionLog.map((entry) => (
              <li
                key={`${entry.at}-${entry.symbol}`}
                className={`decision-item d-${entry.decision.decision}`}
              >
                <header>
                  <span className="decision-symbol">{entry.symbol}</span>
                  <span className={`decision-badge d-${entry.decision.decision}`}>
                    {entry.decision.decision.toUpperCase()} · %{entry.decision.confidence}
                  </span>
                  <span className="decision-time">{formatTime(entry.at)}</span>
                </header>
                <p className="decision-reason">{entry.decision.reasoning}</p>
                <footer>
                  <span className="muted small">
                    Fiyat {formatNumber(entry.price)} · Kaynak{' '}
                    {entry.decision.source === 'ai' ? 'AI' : 'Teknik'}
                  </span>
                  {entry.executed && <span className="chip ok">İşlem yapıldı</span>}
                </footer>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card page-enter">
        <header className="card-head">
          <div>
            <p className="eyebrow">İşlem geçmişi</p>
            <h3>Son {state.trades.length} işlem</h3>
          </div>
        </header>
        {state.trades.length === 0 ? (
          <div className="empty-block">
            <Activity size={26} />
            <strong>İşlem yok</strong>
            <p>Bot başlatıldığında ve sinyal yakaladığında işlemler burada listelenir.</p>
          </div>
        ) : (
          <div className="trade-table">
            <div className="trade-head">
              <span>Zaman</span>
              <span>Yön</span>
              <span>Varlık</span>
              <span>Adet</span>
              <span>Fiyat</span>
              <span>Güven</span>
              <span>Gerekçe</span>
            </div>
            {state.trades.map((trade) => (
              <div key={trade.id} className={`trade-row trade-${trade.side}`}>
                <span>{formatTime(trade.timestamp)}</span>
                <span className={`trade-side trade-${trade.side}`}>
                  {trade.side === 'buy' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {trade.side === 'buy' ? 'AL' : 'SAT'}
                </span>
                <span>
                  <strong>{trade.symbol}</strong>
                </span>
                <span>{trade.quantity.toFixed(4)}</span>
                <span>{formatNumber(trade.price)}</span>
                <span>%{trade.confidence}</span>
                <span className="trade-reason">{trade.reason}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {showConfigModal && (
        <div className="modal-overlay" onClick={onConfigModalClose}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h3>Bot Yapılandırması</h3>
              <button
                type="button"
                className="modal-close"
                onClick={onConfigModalClose}
                aria-label="Kapat"
              >
                <X size={20} />
              </button>
            </header>

            <div className="modal-body">
              <div className="form-field">
                <span>Risk seviyesi</span>
                <div className="pill-group">
                  {(['low', 'medium', 'high'] as BotRisk[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={config.risk === r ? 'pill is-active' : 'pill'}
                      onClick={() => setConfig({ ...config, risk: r })}
                    >
                      {RISK_LABEL[r]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-field">
                <span>Tarama aralığı</span>
                <div className="pill-group">
                  {INTERVAL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={config.intervalSeconds === opt.value ? 'pill is-active' : 'pill'}
                      onClick={() => setConfig({ ...config, intervalSeconds: opt.value })}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-field">
                <span>Minimum bakiye ({config.currency})</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={config.minBalance}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      minBalance: Number(event.target.value) || 0,
                    })
                  }
                  placeholder="0"
                />
              </div>

              <div className="form-field">
                <span>Maksimum bakiye ({config.currency})</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={config.maxBalance}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      maxBalance: Number(event.target.value) || 100000,
                    })
                  }
                  placeholder="100000"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="ghost-button" onClick={onConfigModalClose}>
                İptal
              </button>
              <button type="button" className="primary-button" onClick={onStartConfirm}>
                <Play size={14} /> Bot'u Başlat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
function StatCard({
  tone,
  label,
  value,
  delta,
  deltaPositive,
  icon: Icon,
}: {
  tone: 'blue' | 'green' | 'purple' | 'orange'
  label: string
  value: string
  delta: string
  deltaPositive: boolean
  icon: LucideIcon
}) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <div className="stat-icon">
        <Icon size={20} />
      </div>
      <div className="stat-body">
        <p className="stat-label">{label}</p>
        <strong className="stat-value">{value}</strong>
        <small className={deltaPositive ? 'positive' : 'negative'}>{delta}</small>
      </div>
    </article>
  )
}

function AssetRow({
  instrument,
  quote,
  onOpen,
  onToggleFavorite,
  isFavorite,
  showSpark = false,
}: {
  instrument: InstrumentConfig
  quote: QuoteData | null
  onOpen: () => void
  onToggleFavorite: () => void
  isFavorite: boolean
  showSpark?: boolean
}) {
  const positive = (quote?.percentChange ?? 0) >= 0
  const sparkData = quote
    ? [
        quote.open ?? quote.previousClose ?? quote.price ?? 0,
        quote.low ?? quote.price ?? 0,
        quote.high ?? quote.price ?? 0,
        quote.price ?? quote.previousClose ?? 0,
      ]
    : []

  return (
    <div className="asset-row">
      <button type="button" className="asset-row-main" onClick={onOpen}>
        <span className="asset-bubble" data-tone={instrumentTone(instrument)}>
          {instrument.symbol.charAt(0)}
        </span>
        <span className="asset-row-info">
          <strong>{instrument.symbol}</strong>
          <small>{instrument.label}</small>
        </span>
        {showSpark && (
          <span className="asset-row-spark">
            <Sparkline points={sparkData} positive={positive} width={90} height={32} />
          </span>
        )}
        <span className="asset-row-price">
          <strong>{formatNumber(quote?.price ?? null)}</strong>
          <small className={getChangeClass(quote?.percentChange ?? null)}>
            {formatPercent(quote?.percentChange ?? null)}
          </small>
        </span>
      </button>
      <button
        type="button"
        className={isFavorite ? 'fav-icon is-active' : 'fav-icon'}
        onClick={onToggleFavorite}
        aria-label={isFavorite ? 'Watchlistten çıkar' : 'Watchliste ekle'}
      >
        <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} />
      </button>
    </div>
  )
}

function EmptyState({
  title,
  description,
  status,
  compact = false,
}: {
  title: string
  description: string
  status: ProviderStatus | 'error'
  compact?: boolean
}) {
  return (
    <div className={compact ? 'empty-state is-compact' : 'empty-state'}>
      <strong>{title}</strong>
      <p>{description}</p>
      <span className={getStatusTone(status)}>
        {status === 'missing_key'
          ? 'Hazırlanıyor'
          : status === 'ok'
            ? 'Hazır'
            : 'Şu anda kullanılamıyor'}
      </span>
    </div>
  )
}

function instrumentTone(instrument: InstrumentConfig) {
  switch (instrument.market) {
    case 'kripto':
      return 'orange'
    case 'emtia':
      return 'amber'
    case 'doviz':
      return 'teal'
    default:
      return 'blue'
  }
}

function normalizeCandles(candles: Candle[]) {
  return candles.slice(-24).map((item) => ({
    ...item,
    time: item.time.replace(' ', '\n').slice(5, 16),
  }))
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '--'
  }
  return value.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatSignedNumber(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '--'
  }
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatCompactNumber(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '--'
  }
  return new Intl.NumberFormat('tr-TR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--'
  }
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function currencySymbol(currency: Profile['preferredCurrency']) {
  if (currency === 'USD') return '$'
  if (currency === 'EUR') return '€'
  return '₺'
}

function formatCurrencyValue(value: number, currency: Profile['preferredCurrency']) {
  return `${currencySymbol(currency)}${value.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`
}

function formatSignedCurrency(value: number, currency: Profile['preferredCurrency']) {
  const sign = value >= 0 ? '+' : '−'
  const abs = Math.abs(value).toLocaleString('tr-TR', { maximumFractionDigits: 0 })
  return `${sign}${currencySymbol(currency)}${abs}`
}

function getChangeClass(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) {
    return 'neutral-text'
  }
  return value > 0 ? 'positive' : 'negative'
}

function getStatusTone(status: ProviderStatus | 'error') {
  if (status === 'ok') {
    return 'chip ok'
  }
  if (status === 'missing_key') {
    return 'chip warn'
  }
  return 'chip neutral'
}

function mapIndicatorStatus(status: string) {
  if (status === 'pozitif') {
    return 'positive'
  }
  if (status === 'negatif') {
    return 'negative'
  }
  return 'neutral-text'
}

// ─── LoginPage ────────────────────────────────────────────────────────────────

function LoginPage({ onLogin }: { onLogin: (session: SessionUser) => void }) {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [mode, setMode] = useState<'auth' | 'forgot'>('auth')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [forgotIdentifier, setForgotIdentifier] = useState('')
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  function resetAllFields() {
    setError('')
    setInfo('')
    setForgotIdentifier('')
    setShowPassword(false)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const session = await login(username.trim(), password)
    setLoading(false)
    if (!session) {
      setError(getLastLoginError() || 'Kullanıcı adı/e-posta veya şifre hatalı.')
      return
    }
    onLogin(session)
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await register(username.trim(), password, name.trim(), email.trim())
    setLoading(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setInfo(
      'Hesabın oluşturuldu. E-postana gönderilen onay bağlantısına tıkladıktan sonra giriş yapabilirsin.',
    )
    setMode('auth')
    setTab('login')
    const activeSession = getSession()
    if (activeSession) onLogin(activeSession)
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    const result = await requestPasswordReset(forgotIdentifier)
    setLoading(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setInfo(
      'Şifre sıfırlama bağlantısı e-postanıza gönderildi. Bağlantıya tıklayıp yeni şifrenizi belirleyebilirsiniz.',
    )
  }

  return (
    <div className="login-page">
      <div className="login-bg-anim" />
      <div className="login-card">
        <div className="login-brand">
          <div className="login-brand-icon">
            <Activity size={26} strokeWidth={2.4} />
          </div>
          <div>
            <p className="login-eyebrow">Finansal</p>
            <h1 className="login-title">Teknolojiler</h1>
          </div>
        </div>
        <p className="login-subtitle">Gerçek zamanlı piyasa analizi ve AI trade botu platformu</p>

        {mode === 'auth' && (
          <div className="login-tabs">
            <button
              type="button"
              className={tab === 'login' ? 'login-tab is-active' : 'login-tab'}
              onClick={() => { setTab('login'); resetAllFields() }}
            >
              Giriş Yap
            </button>
            <button
              type="button"
              className={tab === 'register' ? 'login-tab is-active' : 'login-tab'}
              onClick={() => { setTab('register'); resetAllFields() }}
            >
              Kayıt Ol
            </button>
          </div>
        )}

        {mode === 'auth' && tab === 'login' && (
          <form className="login-form" onSubmit={handleLogin}>
            <label className="login-field">
              <span>Kullanıcı Adı</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin veya demo"
                autoComplete="username"
                required
              />
            </label>
            <label className="login-field">
              <span>Şifre</span>
              <div className="login-password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  title={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            {error && <div className="login-error">{error}</div>}
            {info && <div className="login-info">{info}</div>}
            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? <RefreshCw size={16} className="spin" /> : null}
              {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
            </button>
            <div className="login-secondary-actions">
              <button
                type="button"
                className="login-link"
                onClick={() => { setMode('forgot'); resetAllFields() }}
              >
                Şifremi unuttum
              </button>
            </div>
          </form>
        )}

        {mode === 'auth' && tab === 'register' && (
          <form className="login-form" onSubmit={handleRegister}>
            <label className="login-field">
              <span>Ad Soyad</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Adın Soyadın"
              />
            </label>
            <label className="login-field">
              <span>Kullanıcı Adı</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="kullanici_adi"
                autoComplete="username"
                required
              />
            </label>
            <label className="login-field">
              <span>E-posta</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@mail.com"
              />
            </label>
            <label className="login-field">
              <span>Şifre</span>
              <div className="login-password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="En az 6 karakter"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  title={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            {error && <div className="login-error">{error}</div>}
            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? <RefreshCw size={16} className="spin" /> : null}
              {loading ? 'Kaydediliyor…' : 'Hesap Oluştur'}
            </button>
          </form>
        )}

        {mode === 'forgot' && (
          <form className="login-form" onSubmit={handleForgot}>
            <p className="login-subtitle" style={{ marginBottom: 12 }}>
              Hesabınla ilişkili kullanıcı adı veya e-postayı gir. Sıfırlama kodu oluşturulup
              gerçek bir sistemde sana e-posta ile gönderilecek.
            </p>
            <label className="login-field">
              <span>Kullanıcı Adı veya E-posta</span>
              <input
                type="text"
                value={forgotIdentifier}
                onChange={(e) => setForgotIdentifier(e.target.value)}
                placeholder="kullanici_adi veya ornek@mail.com"
                required
              />
            </label>
            {error && <div className="login-error">{error}</div>}
            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? <RefreshCw size={16} className="spin" /> : null}
              {loading ? 'Gönderiliyor…' : 'Sıfırlama Kodu Oluştur'}
            </button>
            <div className="login-secondary-actions">
              <button
                type="button"
                className="login-link"
                onClick={() => { setMode('auth'); resetAllFields() }}
              >
                ← Girişe geri dön
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  )
}
// ─── SupportPage ──────────────────────────────────────────────────────────────

type SupportTicket = {
  id: string
  subject: string
  message: string
  email: string
  createdAt: string
  status: 'open' | 'closed'
}

function SupportPage({ session }: { session: SessionUser | null }) {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  useEffect(() => {
    if (!session) {
      setTickets([])
      return
    }
    void (async () => {
      const { fetchMyTickets } = await import('./lib/db')
      const list = await fetchMyTickets(session.id)
      setTickets(
        list.map((t) => ({
          id: t.id,
          subject: t.subject,
          message: t.message,
          email: t.email,
          createdAt: t.createdAt,
          status: t.status,
        })),
      )
    })()
  }, [session])

  useEffect(() => {
    if (!session) return
    setEmail((prev) => prev.trim() || session.email || '')
  }, [session?.id])

  const faqs = [
    {
      q: 'Trade botu nasıl çalışır?',
      a: 'Trade bot, AI (OpenAI GPT-4o) kullanarak teknik indikatörleri analiz eder ve otomatik al/sat kararları üretir. RSI, MACD, Bollinger bantları gibi göstergeleri değerlendirir. Tüm işlemler simüle edilmiş olup gerçek para kullanılmaz.',
    },
    {
      q: 'Varlıklarımı kaybeder miyim?',
      a: 'Hayır. Platform tamamen simülasyon üzerine çalışır. Gerçek para transferi yapılmaz. Trade bot\'un kullandığı "nakit" sanal bir değerdir.',
    },
    {
      q: 'OpenAI anahtarı nereye girer?',
      a: '.env dosyasına VITE_OPENAI_API_KEY=sk-... şeklinde ekleyin. Anahtar olmadan bot teknik mod yerine simüle edilmiş kararlar üretir.',
    },
    {
      q: 'Piyasa verileri gerçek mi?',
      a: 'Twelve Data API anahtarı tanımlıysa gerçek zamanlıdır. Anahtar yoksa veya kota aşılırsa son bilinen değerler gösterilir.',
    },
    {
      q: 'Watchlist nasıl eklenir?',
      a: 'Piyasalar veya Varlık sayfasında herhangi bir varlığın yanındaki yıldız ikonuna tıklayarak watchlist\'e ekleyebilirsiniz.',
    },
    {
      q: 'Verilerim nerede saklanıyor?',
      a: 'Kullanıcı verileri Supabase üzerinde (watchlist, portföy, notlar, alarmlar, destek talepleri ve bot verileri) saklanır. Oturum bilgisi tarayıcıda güvenli şekilde tutulur.',
    },
  ]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!session || sending) {
      return
    }
    setSendError('')
    setSending(true)
    try {
      const { createTicket } = await import('./lib/db')
      const result = await createTicket({
        subject: subject.trim(),
        message: message.trim(),
        email: email.trim(),
      })
      if ('error' in result) {
        setSendError(result.error)
        return
      }
      const created = result.ticket
      addLog('info', 'Destek', `Yeni destek talebi: ${subject}`, null, session.id)
      setTickets((curr) => [
        {
          id: created.id,
          subject: created.subject,
          message: created.message,
          email: created.email,
          createdAt: created.createdAt,
          status: created.status,
        },
        ...curr,
      ])
      setSent(true)
      setSubject('')
      setMessage('')
      setEmail(session.email || '')
      setTimeout(() => setSent(false), 4000)
    } catch {
      setSendError('Destek talebi gönderilemedi. Lütfen tekrar dene.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="page-stack">
      <section className="card asset-hero page-enter">
        <div className="asset-hero-info">
          <p className="eyebrow">Yardım Merkezi</p>
          <h2>Destek & İletişim</h2>
          <p className="muted">Soru, öneri veya teknik destek için bize yazın.</p>
        </div>
        <aside className="asset-hero-side">
          <div className="profile-stat-grid">
            <div>
              <span>Talep</span>
              <strong>{tickets.length}</strong>
            </div>
            <div>
              <span>Açık</span>
              <strong>{tickets.filter((t) => t.status === 'open').length}</strong>
            </div>
          </div>
        </aside>
      </section>

      <section className="support-grid page-enter">
        <article className="card">
          <header className="card-head">
            <div>
              <p className="eyebrow">Bize Yazın</p>
              <h3>Destek talebi oluştur</h3>
            </div>
            {sent && <span className="chip ok">Gönderildi!</span>}
          </header>
          <form className="support-form" onSubmit={handleSubmit}>
            <label className="form-field">
              <span>E-posta adresiniz</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@mail.com"
                required
              />
            </label>
            <label className="form-field">
              <span>Konu</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Konuyu kısaca belirtin"
                required
              />
            </label>
            <label className="form-field">
              <span>Mesajınız</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Sorununuzu veya önerinizi detaylı anlatın..."
                rows={5}
                required
              />
            </label>
            <div className="form-actions">
              <button type="submit" className="primary-button" disabled={sending || !session}>
                <MessageSquare size={14} /> {sending ? 'Gönderiliyor…' : 'Gönder'}
              </button>
            </div>
            {sendError && <div className="login-error">{sendError}</div>}
          </form>
        </article>

        <article className="card">
          <header className="card-head">
            <div>
              <p className="eyebrow">SSS</p>
              <h3>Sık sorulan sorular</h3>
            </div>
          </header>
          <div className="faq-list">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className={`faq-item${openFaq === i ? ' is-open' : ''}`}
              >
                <button
                  type="button"
                  className="faq-question"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  {faq.q}
                  <ChevronDown size={16} className="faq-chevron" />
                </button>
                {openFaq === i && (
                  <div className="faq-answer">
                    <p>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </article>
      </section>

      {tickets.length > 0 && (
        <section className="card page-enter">
          <header className="card-head">
            <div>
              <p className="eyebrow">Taleplerim</p>
              <h3>Gönderilen destek talepleri</h3>
            </div>
          </header>
          <div className="support-ticket-list">
            {tickets.map((t) => (
              <div key={t.id} className="support-ticket">
                <div className="support-ticket-head">
                  <strong>{t.subject}</strong>
                  <span className={t.status === 'open' ? 'chip warn' : 'chip ok'}>
                    {t.status === 'open' ? 'Açık' : 'Kapalı'}
                  </span>
                  <time className="muted small">{new Date(t.createdAt).toLocaleString('tr-TR')}</time>
                </div>
                <p className="muted small">{t.message}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default App
