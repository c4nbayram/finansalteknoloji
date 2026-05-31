import { supabase, BUCKET_PROFILE, BUCKET_COVERS } from './supabase'

// â”€â”€â”€ Watchlist â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchWatchlist(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('watchlist')
    .select('instrument_id')
    .eq('user_id', userId)
  if (error) {
    console.error('[watchlist] fetchWatchlist failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      userId,
    })
    return []
  }
  return (data ?? []).map((r) => String(r.instrument_id))
}

export async function addWatchlistItem(userId: string, instrumentId: string): Promise<void> {
  const { error } = await supabase
    .from('watchlist')
    .upsert({ user_id: userId, instrument_id: instrumentId }, { onConflict: 'user_id,instrument_id' })
  if (error) {
    console.error('[watchlist] addWatchlistItem failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      userId,
      instrumentId,
    })
  }
}

export async function removeWatchlistItem(userId: string, instrumentId: string): Promise<void> {
  const { error } = await supabase
    .from('watchlist')
    .delete()
    .eq('user_id', userId)
    .eq('instrument_id', instrumentId)
  if (error) {
    console.error('[watchlist] removeWatchlistItem failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      userId,
      instrumentId,
    })
  }
}

// â”€â”€â”€ Positions (portfolio) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type DbPosition = {
  id: string
  instrumentId: string
  quantity: number
  averageCost: number
  addedAt: string
}

export async function fetchPositions(userId: string): Promise<DbPosition[]> {
  const { data, error } = await supabase
    .from('positions')
    .select('id, instrument_id, quantity, average_cost, added_at')
    .eq('user_id', userId)
    .order('added_at', { ascending: false })
  if (error) {
    console.error('[positions] fetchPositions failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      userId,
    })
    return []
  }
  return (data ?? []).map((r) => ({
    id: String(r.id),
    instrumentId: String(r.instrument_id),
    quantity: Number(r.quantity),
    averageCost: Number(r.average_cost),
    addedAt: String(r.added_at),
  }))
}

export async function upsertPosition(
  userId: string,
  instrumentId: string,
  quantity: number,
  averageCost: number,
): Promise<void> {
  // Manual upsert: try update first, if no row then insert
  const { data: existing } = await supabase
    .from('positions')
    .select('id')
    .eq('user_id', userId)
    .eq('instrument_id', instrumentId)
    .maybeSingle()
  if (existing) {
    const { error } = await supabase
      .from('positions')
      .update({ quantity, average_cost: averageCost })
      .eq('id', existing.id)
    if (error) {
      console.error('[positions] upsertPosition update failed', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        userId,
        instrumentId,
      })
    }
  } else {
    const { error } = await supabase.from('positions').insert({
      user_id: userId,
      instrument_id: instrumentId,
      quantity,
      average_cost: averageCost,
    })
    if (error) {
      console.error('[positions] upsertPosition insert failed', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        userId,
        instrumentId,
      })
    }
  }
}

export async function removePosition(userId: string, instrumentId: string): Promise<void> {
  const { error } = await supabase
    .from('positions')
    .delete()
    .eq('user_id', userId)
    .eq('instrument_id', instrumentId)
  if (error) {
    console.error('[positions] removePosition failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      userId,
      instrumentId,
    })
  }
}

export type DbPortfolioWallet = {
  cashBalance: number
  withdrawnTotal: number
}

export async function fetchPortfolioWallet(userId: string): Promise<DbPortfolioWallet | null> {
  const { data, error } = await supabase
    .from('portfolio_wallets')
    .select('cash_balance, withdrawn_total')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[portfolio_wallets] fetch failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      userId,
    })
    return null
  }

  if (!data) return null
  return {
    cashBalance: Number(data.cash_balance ?? 0),
    withdrawnTotal: Number(data.withdrawn_total ?? 0),
  }
}

export async function savePortfolioWallet(
  userId: string,
  cashBalance: number,
  withdrawnTotal: number,
): Promise<void> {
  const { error } = await supabase.from('portfolio_wallets').upsert(
    {
      user_id: userId,
      cash_balance: cashBalance,
      withdrawn_total: withdrawnTotal,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  if (error) {
    console.error('[portfolio_wallets] save failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      userId,
      cashBalance,
      withdrawnTotal,
    })
  }
}

export type DbPendingLimitOrder = {
  id: string
  instrumentId: string
  symbol: string
  label: string
  market: string
  quantity: number
  limitPrice: number
  commissionRate: number
  createdAt: string
}

export async function fetchPendingLimitOrders(userId: string): Promise<DbPendingLimitOrder[]> {
  const { data, error } = await supabase
    .from('pending_limit_orders')
    .select(
      'id, instrument_id, symbol, label, market, quantity, limit_price, commission_rate, created_at',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[pending_limit_orders] fetch failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      userId,
    })
    return []
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    instrumentId: String(row.instrument_id),
    symbol: String(row.symbol ?? ''),
    label: String(row.label ?? ''),
    market: String(row.market ?? ''),
    quantity: Number(row.quantity),
    limitPrice: Number(row.limit_price),
    commissionRate: Number(row.commission_rate ?? 0),
    createdAt: String(row.created_at),
  }))
}

export async function addPendingLimitOrder(
  userId: string,
  payload: {
    instrumentId: string
    symbol: string
    label: string
    market: string
    quantity: number
    limitPrice: number
    commissionRate: number
  },
): Promise<DbPendingLimitOrder | null> {
  const { data, error } = await supabase
    .from('pending_limit_orders')
    .insert({
      user_id: userId,
      instrument_id: payload.instrumentId,
      symbol: payload.symbol,
      label: payload.label,
      market: payload.market,
      quantity: payload.quantity,
      limit_price: payload.limitPrice,
      commission_rate: payload.commissionRate,
    })
    .select(
      'id, instrument_id, symbol, label, market, quantity, limit_price, commission_rate, created_at',
    )
    .maybeSingle()

  if (error) {
    console.error('[pending_limit_orders] add failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      userId,
      payload,
    })
    return null
  }

  if (!data) return null
  return {
    id: String(data.id),
    instrumentId: String(data.instrument_id),
    symbol: String(data.symbol ?? ''),
    label: String(data.label ?? ''),
    market: String(data.market ?? ''),
    quantity: Number(data.quantity),
    limitPrice: Number(data.limit_price),
    commissionRate: Number(data.commission_rate ?? 0),
    createdAt: String(data.created_at),
  }
}

export async function deletePendingLimitOrder(userId: string, orderId: string): Promise<void> {
  const { error } = await supabase
    .from('pending_limit_orders')
    .delete()
    .eq('id', orderId)
    .eq('user_id', userId)

  if (error) {
    console.error('[pending_limit_orders] delete failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      userId,
      orderId,
    })
  }
}

// â”€â”€â”€ Notes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type DbNote = {
  id: string
  instrumentId: string
  symbol: string
  label: string
  text: string
  createdAt: string
}

export async function fetchNotes(userId: string): Promise<DbNote[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('id, instrument_id, symbol, label, text, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[notes] fetchNotes failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      userId,
    })
    return []
  }
  return (data ?? []).map((r) => ({
    id: String(r.id),
    instrumentId: String(r.instrument_id),
    symbol: String(r.symbol ?? ''),
    label: String(r.label ?? ''),
    text: String(r.text ?? ''),
    createdAt: String(r.created_at),
  }))
}

export async function addNote(
  userId: string,
  instrumentId: string,
  symbol: string,
  label: string,
  text: string,
): Promise<DbNote | null> {
  const { data, error } = await supabase
    .from('notes')
    .insert({ user_id: userId, instrument_id: instrumentId, symbol, label, text })
    .select('id, instrument_id, symbol, label, text, created_at')
    .maybeSingle()
  if (error) {
    console.error('[notes] addNote failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      userId,
      instrumentId,
      symbol,
    })
    return null
  }
  if (!data) return null
  return {
    id: String(data.id),
    instrumentId: String(data.instrument_id),
    symbol: String(data.symbol ?? ''),
    label: String(data.label ?? ''),
    text: String(data.text ?? ''),
    createdAt: String(data.created_at),
  }
}

export async function deleteNote(userId: string, noteId: string): Promise<void> {
  const { error } = await supabase.from('notes').delete().eq('id', noteId).eq('user_id', userId)
  if (error) {
    console.error('[notes] deleteNote failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      userId,
      noteId,
    })
  }
}

// â”€â”€â”€ Price alerts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type DbAlert = {
  id: string
  instrumentId: string
  symbol: string
  price: number
  createdAt: string
}

export async function fetchAlerts(userId: string): Promise<DbAlert[]> {
  const { data, error } = await supabase
    .from('price_alerts')
    .select('id, instrument_id, symbol, price, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[price_alerts] fetchAlerts failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      userId,
    })
    return []
  }
  return (data ?? []).map((r) => ({
    id: String(r.id),
    instrumentId: String(r.instrument_id),
    symbol: String(r.symbol ?? ''),
    price: Number(r.price),
    createdAt: String(r.created_at),
  }))
}

export async function addAlert(
  userId: string,
  instrumentId: string,
  symbol: string,
  price: number,
): Promise<DbAlert | null> {
  const { data, error } = await supabase
    .from('price_alerts')
    .insert({ user_id: userId, instrument_id: instrumentId, symbol, price })
    .select('id, instrument_id, symbol, price, created_at')
    .maybeSingle()
  if (error) {
    console.error('[price_alerts] addAlert failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      userId,
      instrumentId,
      symbol,
      price,
    })
    return null
  }
  if (!data) return null
  return {
    id: String(data.id),
    instrumentId: String(data.instrument_id),
    symbol: String(data.symbol ?? ''),
    price: Number(data.price),
    createdAt: String(data.created_at),
  }
}

export async function deleteAlert(userId: string, alertId: string): Promise<void> {
  const { error } = await supabase
    .from('price_alerts')
    .delete()
    .eq('id', alertId)
    .eq('user_id', userId)
  if (error) {
    console.error('[price_alerts] deleteAlert failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      userId,
      alertId,
    })
  }
}

// â”€â”€â”€ Bot config + state (jsonb blobs) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchBotConfig<T = unknown>(userId: string): Promise<T | null> {
  const { data } = await supabase
    .from('bot_config')
    .select('config')
    .eq('user_id', userId)
    .maybeSingle()
  return (data?.config as T) ?? null
}

export async function saveBotConfig(userId: string, config: unknown): Promise<void> {
  await supabase
    .from('bot_config')
    .upsert({ user_id: userId, config, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
}

export async function fetchBotState<T = unknown>(userId: string): Promise<T | null> {
  const { data } = await supabase
    .from('bot_state')
    .select('state')
    .eq('user_id', userId)
    .maybeSingle()
  return (data?.state as T) ?? null
}

export async function saveBotState(userId: string, state: unknown): Promise<void> {
  await supabase
    .from('bot_state')
    .upsert({ user_id: userId, state, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
}

export async function recordBotTrade(
  userId: string,
  trade: {
    instrumentId: string
    side: 'buy' | 'sell'
    quantity: number
    price: number
    confidence?: number
    reason?: string
  },
): Promise<void> {
  await supabase.from('bot_trades').insert({
    user_id: userId,
    instrument_id: trade.instrumentId,
    side: trade.side,
    quantity: trade.quantity,
    price: trade.price,
    confidence: trade.confidence ?? null,
    reason: trade.reason ?? null,
  })
}

export type DbBotTrade = {
  id: string
  instrumentId: string
  side: 'buy' | 'sell'
  quantity: number
  price: number
  confidence: number | null
  reason: string | null
  createdAt: string
}

export async function fetchBotTrades(userId: string, limit = 200): Promise<DbBotTrade[]> {
  const { data, error } = await supabase
    .from('bot_trades')
    .select('id, instrument_id, side, quantity, price, confidence, reason, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[bot_trades] fetchBotTrades failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      userId,
      limit,
    })
    return []
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    instrumentId: String(row.instrument_id),
    side: (row.side as 'buy' | 'sell') ?? 'buy',
    quantity: Number(row.quantity),
    price: Number(row.price),
    confidence: row.confidence == null ? null : Number(row.confidence),
    reason: row.reason == null ? null : String(row.reason),
    createdAt: String(row.created_at),
  }))
}

export type DbBotWalletTransfer = {
  id: string
  userId: string
  direction: 'in' | 'out'
  source: 'portfolio_cash' | 'external_topup' | 'portfolio_withdraw'
  amount: number
  feeAmount: number
  netAmount: number
  currency: string
  quotePair: string | null
  quoteMode: 'bid' | 'ask' | 'mid' | null
  exchangeRate: number | null
  convertedAmount: number | null
  note: string | null
  createdAt: string
}

export async function fetchBotWalletTransfers(
  userId: string,
  limit = 120,
): Promise<DbBotWalletTransfer[]> {
  const { data, error } = await supabase
    .from('bot_wallet_transfers')
    .select('id, user_id, direction, source, amount, fee_amount, net_amount, currency, quote_pair, quote_mode, exchange_rate, converted_amount, note, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[bot_wallet_transfers] fetch failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      userId,
      limit,
    })
    return []
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    direction: (row.direction as 'in' | 'out') ?? 'in',
    source:
      row.source === 'portfolio_cash' || row.source === 'portfolio_withdraw'
        ? row.source
        : 'external_topup',
    amount: Number(row.amount),
    feeAmount: Number(row.fee_amount ?? 0),
    netAmount: Number(row.net_amount),
    currency: String(row.currency ?? 'USD'),
    quotePair: row.quote_pair == null ? null : String(row.quote_pair),
    quoteMode:
      row.quote_mode === 'bid' || row.quote_mode === 'ask' || row.quote_mode === 'mid'
        ? row.quote_mode
        : null,
    exchangeRate: row.exchange_rate == null ? null : Number(row.exchange_rate),
    convertedAmount: row.converted_amount == null ? null : Number(row.converted_amount),
    note: row.note == null ? null : String(row.note),
    createdAt: String(row.created_at),
  }))
}

export async function addBotWalletTransfer(
  userId: string,
  payload: {
    direction: 'in' | 'out'
    source: 'portfolio_cash' | 'external_topup' | 'portfolio_withdraw'
    amount: number
    feeAmount?: number
    netAmount: number
    currency: string
    quotePair?: string
    quoteMode?: 'bid' | 'ask' | 'mid'
    exchangeRate?: number
    convertedAmount?: number
    note?: string
  },
): Promise<DbBotWalletTransfer | null> {
  const { data, error } = await supabase
    .from('bot_wallet_transfers')
    .insert({
      user_id: userId,
      direction: payload.direction,
      source: payload.source,
      amount: payload.amount,
      fee_amount: payload.feeAmount ?? 0,
      net_amount: payload.netAmount,
      currency: payload.currency,
      quote_pair: payload.quotePair ?? null,
      quote_mode: payload.quoteMode ?? null,
      exchange_rate: payload.exchangeRate ?? null,
      converted_amount: payload.convertedAmount ?? null,
      note: payload.note ?? null,
    })
    .select('id, user_id, direction, source, amount, fee_amount, net_amount, currency, quote_pair, quote_mode, exchange_rate, converted_amount, note, created_at')
    .maybeSingle()

  if (error) {
    console.error('[bot_wallet_transfers] add failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      userId,
      payload,
    })
    return null
  }

  if (!data) return null

  return {
    id: String(data.id),
    userId: String(data.user_id),
    direction: (data.direction as 'in' | 'out') ?? 'in',
    source:
      data.source === 'portfolio_cash' || data.source === 'portfolio_withdraw'
        ? data.source
        : 'external_topup',
    amount: Number(data.amount),
    feeAmount: Number(data.fee_amount ?? 0),
    netAmount: Number(data.net_amount),
    currency: String(data.currency ?? 'USD'),
    quotePair: data.quote_pair == null ? null : String(data.quote_pair),
    quoteMode:
      data.quote_mode === 'bid' || data.quote_mode === 'ask' || data.quote_mode === 'mid'
        ? data.quote_mode
        : null,
    exchangeRate: data.exchange_rate == null ? null : Number(data.exchange_rate),
    convertedAmount: data.converted_amount == null ? null : Number(data.converted_amount),
    note: data.note == null ? null : String(data.note),
    createdAt: String(data.created_at),
  }
}

export async function deleteBotWalletTransfer(userId: string, transferId: string): Promise<void> {
  const { error } = await supabase
    .from('bot_wallet_transfers')
    .delete()
    .eq('id', transferId)
    .eq('user_id', userId)

  if (error) {
    console.error('[bot_wallet_transfers] delete failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      userId,
      transferId,
    })
  }
}

// â”€â”€â”€ Profile (full row) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type DbProfileExtras = {
  bio: string
  preferred_currency: string
}

export async function fetchProfileExtras(userId: string): Promise<DbProfileExtras | null> {
  const { data } = await supabase
    .from('profiles')
    .select('bio, preferred_currency')
    .eq('id', userId)
    .maybeSingle()
  if (!data) return null
  return {
    bio: String(data.bio ?? ''),
    preferred_currency: String(data.preferred_currency ?? 'TRY'),
  }
}

// â”€â”€â”€ Edu Posts (blog) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type DbEduPost = {
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
}

function rowToEduPost(r: Record<string, unknown>): DbEduPost {
  return {
    id: String(r.id),
    title: String(r.title ?? ''),
    topic: String(r.topic ?? ''),
    summary: String(r.summary ?? ''),
    paragraphs: Array.isArray(r.paragraphs) ? (r.paragraphs as string[]) : [],
    category: String(r.category ?? 'genel'),
    coverImageUrl: (r.cover_image_url as string | null) ?? null,
    author: String(r.author ?? ''),
    createdAt: String(r.created_at),
    publishedAt: (r.published_at as string | null) ?? null,
  }
}

export async function fetchPublishedPosts(): Promise<DbEduPost[]> {
  const { data, error } = await supabase
    .from('edu_posts')
    .select('*')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
  if (error) {
    console.error('[edu_posts] fetchPublishedPosts failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    })
    throw new Error(`Yayınlanan içerikler alınamadı: ${error.message}`)
  }
  return (data ?? []).map(rowToEduPost)
}

export async function fetchAllPosts(): Promise<DbEduPost[]> {
  const { data, error } = await supabase
    .from('edu_posts')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[edu_posts] fetchAllPosts failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    })
    throw new Error(`İçerikler alınamadı: ${error.message}`)
  }
  return (data ?? []).map(rowToEduPost)
}

export async function upsertEduPost(
  post: Partial<DbEduPost> & { id?: string },
): Promise<DbEduPost | null> {
  const row: Record<string, unknown> = {
    title: post.title,
    topic: post.topic,
    summary: post.summary,
    paragraphs: post.paragraphs,
    category: post.category,
    cover_image_url: post.coverImageUrl,
    author: post.author,
    published_at: post.publishedAt,
  }
  Object.keys(row).forEach((k) => row[k] === undefined && delete row[k])
  let query
  if (post.id) {
    query = supabase.from('edu_posts').update(row).eq('id', post.id).select('*').maybeSingle()
  } else {
    query = supabase.from('edu_posts').insert(row).select('*').maybeSingle()
  }
  const { data, error } = await query
  if (error) {
    console.error('[edu_posts] upsertEduPost failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      payload: row,
      postId: post.id ?? null,
    })
    throw new Error(`İçerik kaydedilemedi: ${error.message}`)
  }
  if (!data) {
    throw new Error('İçerik kaydedildi ancak geri dönen kayıt bulunamadı.')
  }
  return rowToEduPost(data as Record<string, unknown>)
}

export async function deleteEduPost(id: string): Promise<void> {
  const { error } = await supabase.from('edu_posts').delete().eq('id', id)
  if (error) {
    console.error('[edu_posts] deleteEduPost failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      postId: id,
    })
    throw new Error(`İçerik silinemedi: ${error.message}`)
  }
}

// â”€â”€â”€ Support tickets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type DbSupportTicket = {
  id: string
  userId: string
  subject: string
  message: string
  email: string
  createdAt: string
  status: 'open' | 'closed'
}

function rowToTicket(r: Record<string, unknown>): DbSupportTicket {
  return {
    id: String(r.id),
    userId: String(r.user_id ?? ''),
    subject: String(r.subject ?? ''),
    message: String(r.message ?? ''),
    email: String(r.email ?? ''),
    createdAt: String(r.created_at),
    status: (r.status as 'open' | 'closed') ?? 'open',
  }
}

export async function fetchMyTickets(userId: string): Promise<DbSupportTicket[]> {
  const { data } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return (data ?? []).map(rowToTicket)
}

export async function fetchAllTickets(): Promise<DbSupportTicket[]> {
  const { data } = await supabase
    .from('support_tickets')
    .select('*')
    .order('created_at', { ascending: false })
  return (data ?? []).map(rowToTicket)
}

export async function createTicket(input: {
  subject: string
  message: string
  email: string
}): Promise<{ ticket: DbSupportTicket } | { error: string }> {
  const cleanSubject = input.subject.trim()
  const cleanMessage = input.message.trim()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return { error: 'Oturum doğrulanamadı. Lütfen tekrar giriş yapın.' }
  }
  const cleanEmail = input.email.trim() || authData.user.email?.trim() || ''
  if (!cleanEmail) {
    return { error: 'E-posta adresi gereklidir.' }
  }

  const payload = {
    user_id: authData.user.id,
    subject: cleanSubject,
    message: cleanMessage,
    email: cleanEmail,
    status: 'open' as const,
  }

  const { error } = await supabase.from('support_tickets').insert(payload)
  if (error) {
    console.error('[support] createTicket failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    })
    return { error: error.message || 'Destek talebi gönderilemedi.' }
  }

  const { data, error: fetchError } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('user_id', authData.user.id)
    .eq('subject', cleanSubject)
    .eq('message', cleanMessage)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fetchError || !data) {
    return {
      ticket: {
        id: `tmp-${Date.now()}`,
        userId: authData.user.id,
        subject: cleanSubject,
        message: cleanMessage,
        email: cleanEmail,
        createdAt: new Date().toISOString(),
        status: 'open',
      },
    }
  }

  return { ticket: rowToTicket(data as Record<string, unknown>) }
}

export async function setTicketStatus(id: string, status: 'open' | 'closed'): Promise<void> {
  await supabase.from('support_tickets').update({ status }).eq('id', id)
}

export async function deleteTicket(id: string): Promise<void> {
  await supabase.from('support_tickets').delete().eq('id', id)
}

// â”€â”€â”€ Storage: profile photo & blog covers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function uploadToBucket(
  bucket: string,
  path: string,
  file: File | Blob,
): Promise<string | null> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file instanceof File ? file.type : undefined,
  })
  if (error) {
    console.error('[storage] upload failed', error)
    return null
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadProfilePhoto(userId: string, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${userId}/avatar-${Date.now()}.${ext}`
  return uploadToBucket(BUCKET_PROFILE, path, file)
}

export async function uploadBlogCover(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  return uploadToBucket(BUCKET_COVERS, path, file)
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const [header, body] = dataUrl.split(',')
    const mimeMatch = /data:([^;]+);base64/.exec(header)
    const mime = mimeMatch?.[1] ?? 'image/jpeg'
    const binary = atob(body)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: mime })
  } catch {
    return null
  }
}

