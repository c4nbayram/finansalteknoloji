import { supabase, BUCKET_PROFILE, BUCKET_COVERS } from './supabase'

// â”€â”€â”€ Watchlist â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchWatchlist(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('watchlist')
    .select('instrument_id')
    .eq('user_id', userId)
  return (data ?? []).map((r) => String(r.instrument_id))
}

export async function addWatchlistItem(userId: string, instrumentId: string): Promise<void> {
  await supabase
    .from('watchlist')
    .upsert({ user_id: userId, instrument_id: instrumentId }, { onConflict: 'user_id,instrument_id' })
}

export async function removeWatchlistItem(userId: string, instrumentId: string): Promise<void> {
  await supabase
    .from('watchlist')
    .delete()
    .eq('user_id', userId)
    .eq('instrument_id', instrumentId)
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
  const { data } = await supabase
    .from('positions')
    .select('id, instrument_id, quantity, average_cost, added_at')
    .eq('user_id', userId)
    .order('added_at', { ascending: false })
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
    await supabase
      .from('positions')
      .update({ quantity, average_cost: averageCost })
      .eq('id', existing.id)
  } else {
    await supabase.from('positions').insert({
      user_id: userId,
      instrument_id: instrumentId,
      quantity,
      average_cost: averageCost,
    })
  }
}

export async function removePosition(userId: string, instrumentId: string): Promise<void> {
  await supabase
    .from('positions')
    .delete()
    .eq('user_id', userId)
    .eq('instrument_id', instrumentId)
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
  const { data } = await supabase
    .from('notes')
    .select('id, instrument_id, symbol, label, text, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
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
  const { data } = await supabase
    .from('notes')
    .insert({ user_id: userId, instrument_id: instrumentId, symbol, label, text })
    .select('id, instrument_id, symbol, label, text, created_at')
    .maybeSingle()
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
  await supabase.from('notes').delete().eq('id', noteId).eq('user_id', userId)
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
  const { data } = await supabase
    .from('price_alerts')
    .select('id, instrument_id, symbol, price, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
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
  const { data } = await supabase
    .from('price_alerts')
    .insert({ user_id: userId, instrument_id: instrumentId, symbol, price })
    .select('id, instrument_id, symbol, price, created_at')
    .maybeSingle()
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
  await supabase.from('price_alerts').delete().eq('id', alertId).eq('user_id', userId)
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

