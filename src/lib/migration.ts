import { supabase } from './supabase'

const MIGRATION_FLAG = 'fintech-supabase-migrated-v1'

const KEYS = {
  profile: 'fintech-profile-v1',
  watchlist: 'fintech-watchlist-v1',
  portfolio: 'fintech-portfolio-v1',
  notes: 'fintech-notes-v1',
  alerts: 'fintech-alerts-v1',
  botConfig: 'fintech-bot-config-v1',
  botState: 'fintech-bot-state-v1',
  support: 'fintech-support-v1',
} as const

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export async function migrateLocalStorageToSupabase(userId: string): Promise<void> {
  if (localStorage.getItem(MIGRATION_FLAG) === userId) return

  // Profile
  const profile = read<{
    name?: string
    email?: string
    avatar?: string
    bio?: string
    preferredCurrency?: string
    photoData?: string
  }>(KEYS.profile)
  if (profile) {
    const update: Record<string, unknown> = {}
    if (profile.name) update.name = profile.name
    if (profile.email) update.email = profile.email
    if (profile.avatar) update.avatar = profile.avatar
    if (profile.bio) update.bio = profile.bio
    if (profile.preferredCurrency) update.preferred_currency = profile.preferredCurrency
    if (Object.keys(update).length > 0) {
      await supabase.from('profiles').update(update).eq('id', userId)
    }
  }

  // Watchlist
  const watchlist = read<string[]>(KEYS.watchlist)
  if (watchlist && watchlist.length > 0) {
    await supabase.from('watchlist').upsert(
      watchlist.map((instrumentId) => ({ user_id: userId, instrument_id: instrumentId })),
      { onConflict: 'user_id,instrument_id' },
    )
  }

  // Positions
  const positions = read<
    Array<{ instrumentId: string; quantity: number; averageCost: number; addedAt?: string }>
  >(KEYS.portfolio)
  if (positions && positions.length > 0) {
    await supabase.from('positions').insert(
      positions.map((p) => ({
        user_id: userId,
        instrument_id: p.instrumentId,
        quantity: p.quantity,
        average_cost: p.averageCost,
      })),
    )
  }

  // Notes
  const notes = read<
    Array<{ instrumentId: string; symbol: string; label: string; text: string }>
  >(KEYS.notes)
  if (notes && notes.length > 0) {
    await supabase.from('notes').insert(
      notes.map((n) => ({
        user_id: userId,
        instrument_id: n.instrumentId,
        symbol: n.symbol,
        label: n.label,
        text: n.text,
      })),
    )
  }

  // Alerts
  const alerts = read<Array<{ instrumentId: string; symbol: string; price: number }>>(
    KEYS.alerts,
  )
  if (alerts && alerts.length > 0) {
    await supabase.from('price_alerts').insert(
      alerts.map((a) => ({
        user_id: userId,
        instrument_id: a.instrumentId,
        symbol: a.symbol,
        price: a.price,
      })),
    )
  }

  // Bot config & state
  const botConfig = read<unknown>(KEYS.botConfig)
  if (botConfig) {
    await supabase
      .from('bot_config')
      .upsert({ user_id: userId, config: botConfig }, { onConflict: 'user_id' })
  }
  const botState = read<unknown>(KEYS.botState)
  if (botState) {
    await supabase
      .from('bot_state')
      .upsert({ user_id: userId, state: botState }, { onConflict: 'user_id' })
  }

  // Support tickets (only the current user's tickets)
  const tickets = read<
    Array<{ subject: string; message: string; email: string; status: 'open' | 'closed' }>
  >(KEYS.support)
  if (tickets && tickets.length > 0) {
    await supabase.from('support_tickets').insert(
      tickets.map((t) => ({
        user_id: userId,
        subject: t.subject,
        message: t.message,
        email: t.email,
        status: t.status,
      })),
    )
  }

  // Mark as migrated; do NOT remove originals (in case migration is rerun or rollback needed).
  // User can manually clear them after verifying.
  try {
    localStorage.setItem(MIGRATION_FLAG, userId)
  } catch {
    // ignore
  }
}

export function clearLocalAfterMigration(): void {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k))
}
