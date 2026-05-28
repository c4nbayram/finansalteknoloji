import { supabase } from './supabase'

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

const MAX_CACHE = 500

type LogListener = (logs: LogEntry[]) => void

let _listeners: LogListener[] = []
let _cache: LogEntry[] = []

function _emit(): void {
  for (const fn of _listeners) fn(_cache)
}

function rowToEntry(r: Record<string, unknown>): LogEntry {
  return {
    id: String(r.id),
    timestamp: String(r.created_at),
    level: (r.level as LogLevel) ?? 'info',
    source: String(r.source ?? ''),
    message: String(r.message ?? ''),
    data: r.data ? JSON.stringify(r.data).slice(0, 400) : undefined,
    userId: (r.user_id as string | undefined) ?? undefined,
  }
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
  _cache = [entry, ..._cache].slice(0, MAX_CACHE)
  _emit()
  // Fire-and-forget insert to Supabase
  void supabase.from('activity_logs').insert({
    user_id: userId ?? null,
    level,
    source,
    message,
    data: data ?? null,
  })
  return entry
}

export function getLogs(options?: { limit?: number; level?: LogLevel; source?: string }): LogEntry[] {
  let result = _cache
  if (options?.level) result = result.filter((l) => l.level === options.level)
  if (options?.source) result = result.filter((l) => l.source === options.source)
  if (options?.limit) result = result.slice(0, options.limit)
  return result
}

export async function fetchLogsFromServer(limit = 200): Promise<LogEntry[]> {
  const { data } = await supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  const rows = (data ?? []).map((r) => rowToEntry(r as Record<string, unknown>))
  _cache = rows
  _emit()
  return rows
}

export async function clearLogs(): Promise<void> {
  // Note: requires admin RLS. Non-admin will only clear local cache.
  await supabase.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  _cache = []
  _emit()
}

export function subscribeLogs(fn: LogListener): () => void {
  _listeners = [..._listeners, fn]
  return () => {
    _listeners = _listeners.filter((l) => l !== fn)
  }
}
