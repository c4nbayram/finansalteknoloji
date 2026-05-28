export type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'trade'

export type LogEntry = {
  id: string
  timestamp: string
  level: LogLevel
  source: string
  message: string
  data?: string
  userId?: string
}

const LOGS_KEY = 'fintech-logs-v1'
const MAX_ENTRIES = 2000

type LogListener = (logs: LogEntry[]) => void

let _listeners: LogListener[] = []
let _cache: LogEntry[] | null = null

function _load(): LogEntry[] {
  if (_cache) return _cache
  try {
    const raw = localStorage.getItem(LOGS_KEY)
    _cache = raw ? (JSON.parse(raw) as LogEntry[]) : []
  } catch {
    _cache = []
  }
  return _cache
}

function _save(logs: LogEntry[]): void {
  _cache = logs
  try {
    localStorage.setItem(LOGS_KEY, JSON.stringify(logs))
  } catch {
    // quota exceeded — trim to half and retry
    const trimmed = logs.slice(0, Math.floor(logs.length / 2))
    _cache = trimmed
    try {
      localStorage.setItem(LOGS_KEY, JSON.stringify(trimmed))
    } catch {
      // give up
    }
  }
  for (const fn of _listeners) fn(logs)
}

export function addLog(
  level: LogLevel,
  source: string,
  message: string,
  data?: unknown,
  userId?: string,
): LogEntry {
  const entry: LogEntry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    timestamp: new Date().toISOString(),
    level,
    source,
    message,
    data: data !== undefined ? JSON.stringify(data).slice(0, 400) : undefined,
    userId,
  }
  const logs = _load()
  _save([entry, ...logs].slice(0, MAX_ENTRIES))
  return entry
}

export function getLogs(options?: { limit?: number; level?: LogLevel; source?: string }): LogEntry[] {
  const all = _load()
  let result = all
  if (options?.level) result = result.filter((l) => l.level === options.level)
  if (options?.source) result = result.filter((l) => l.source === options.source)
  if (options?.limit) result = result.slice(0, options.limit)
  return result
}

export function clearLogs(): void {
  _cache = []
  try {
    localStorage.removeItem(LOGS_KEY)
  } catch {
    // ignore
  }
  for (const fn of _listeners) fn([])
}

export function subscribeLogs(fn: LogListener): () => void {
  _listeners = [..._listeners, fn]
  return () => {
    _listeners = _listeners.filter((l) => l !== fn)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LOGS_KEY) {
      _cache = null
    }
  })
}
