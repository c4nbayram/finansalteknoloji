import type { InstrumentConfig } from '../data/marketConfig'
import type { Candle } from './indicators'

const env = import.meta.env

export type ProviderStatus = 'ok' | 'missing_key' | 'error'

export type QuoteData = {
  instrument: InstrumentConfig
  price: number | null
  change: number | null
  percentChange: number | null
  open: number | null
  high: number | null
  low: number | null
  previousClose: number | null
  volume: number | null
  currency: string | null
  exchange: string | null
  timestamp: string | null
  isMarketOpen: boolean | null
  status: ProviderStatus
  error?: string
}

export type AssetSnapshot = {
  quote: QuoteData | null
  candles: Candle[]
  status: ProviderStatus
  error?: string
}

const provider = (env.VITE_MARKET_DATA_PROVIDER ?? 'twelvedata').trim().toLowerCase()
const apiKey = env.VITE_MARKET_DATA_API_KEY?.trim()
const baseUrl = (env.VITE_MARKET_DATA_BASE_URL ?? 'https://api.twelvedata.com').trim()
const quoteCache = new Map<string, { expiresAt: number; value: unknown }>()
const inflightRequests = new Map<string, Promise<unknown>>()
const QUOTE_TTL_MS = 30_000
const SERIES_TTL_MS = 180_000

function mapProviderError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Veri alınamadı'
  const normalized = message.toLowerCase()

  if (normalized.includes('api credits') || normalized.includes('current minute')) {
    return 'Yoğunluk nedeniyle veriler kısa süreli gecikiyor. Lütfen biraz sonra tekrar deneyin.'
  }

  if (normalized.includes('current limit') || normalized.includes('run out of api credits')) {
    return 'Veri akışında geçici yoğunluk var. Güncelleme kısa süre içinde devam edecek.'
  }

  if (normalized.includes('symbol') || normalized.includes('figi')) {
    return 'Bu varlık şu anda listelenemiyor.'
  }

  if (normalized.includes('api key')) {
    return 'Canlı veri bağlantısı şu anda kullanılamıyor.'
  }

  return 'Veriler şu anda güncellenemiyor.'
}

function toNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function buildParams(instrument: InstrumentConfig) {
  const params = new URLSearchParams({
    symbol: instrument.providerSymbol,
  })

  if (apiKey) {
    params.set('apikey', apiKey)
  }

  if (instrument.exchange) {
    params.set('exchange', instrument.exchange)
  }

  return params
}

async function fetchJson<T>(path: string, params: URLSearchParams, ttlMs = QUOTE_TTL_MS) {
  const requestKey = `${path}?${params.toString()}`
  const cached = quoteCache.get(requestKey)

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T
  }

  const pending = inflightRequests.get(requestKey)
  if (pending) {
    return pending as Promise<T>
  }

  const request = (async () => {
    const response = await fetch(`${baseUrl}${requestKey}`, {
      cache: 'no-store',
    })
    const data = (await response.json()) as T & { status?: string; message?: string }

    if (!response.ok || data.status === 'error') {
      throw new Error(data.message ?? 'Veri alınamadı')
    }

    quoteCache.set(requestKey, {
      expiresAt: Date.now() + ttlMs,
      value: data,
    })

    return data
  })()

  inflightRequests.set(requestKey, request as Promise<unknown>)

  try {
    return await request
  } finally {
    inflightRequests.delete(requestKey)
  }
}

async function fetchTwelveDataQuote(instrument: InstrumentConfig): Promise<QuoteData> {
  if (!apiKey) {
    return {
      instrument,
      price: null,
      change: null,
      percentChange: null,
      open: null,
      high: null,
      low: null,
      previousClose: null,
      volume: null,
      currency: null,
      exchange: instrument.exchange ?? null,
      timestamp: null,
      isMarketOpen: null,
      status: 'missing_key',
      error: 'VITE_MARKET_DATA_API_KEY tanımlı değil.',
    }
  }

  try {
    const payload = await fetchJson<{
      close?: string
      change?: string
      percent_change?: string
      open?: string
      high?: string
      low?: string
      previous_close?: string
      volume?: string
      currency?: string
      exchange?: string
      datetime?: string
      timestamp?: string
      is_market_open?: boolean
    }>('/quote', buildParams(instrument), QUOTE_TTL_MS)

    return {
      instrument,
      price: toNumber(payload.close),
      change: toNumber(payload.change),
      percentChange: toNumber(payload.percent_change),
      open: toNumber(payload.open),
      high: toNumber(payload.high),
      low: toNumber(payload.low),
      previousClose: toNumber(payload.previous_close),
      volume: toNumber(payload.volume),
      currency: payload.currency ?? null,
      exchange: payload.exchange ?? instrument.exchange ?? null,
      timestamp: payload.datetime ?? payload.timestamp ?? null,
      isMarketOpen:
        typeof payload.is_market_open === 'boolean' ? payload.is_market_open : null,
      status: 'ok',
    }
  } catch (error) {
    return {
      instrument,
      price: null,
      change: null,
      percentChange: null,
      open: null,
      high: null,
      low: null,
      previousClose: null,
      volume: null,
      currency: null,
      exchange: instrument.exchange ?? null,
      timestamp: null,
      isMarketOpen: null,
      status: 'error',
      error: mapProviderError(error),
    }
  }
}

async function fetchTwelveDataSeries(instrument: InstrumentConfig): Promise<AssetSnapshot> {
  if (!apiKey) {
    return {
      quote: null,
      candles: [],
      status: 'missing_key',
      error: 'VITE_MARKET_DATA_API_KEY tanımlı değil.',
    }
  }

  try {
    const params = buildParams(instrument)
    params.set('interval', instrument.market === 'kripto' ? '1h' : '1day')
    params.set('outputsize', '40')
    params.set('format', 'JSON')

    const series = await fetchJson<{
      values?: Array<{
        datetime: string
        open: string
        high: string
        low: string
        close: string
        volume?: string
      }>
    }>('/time_series', params, SERIES_TTL_MS)

    const candles =
      series.values
        ?.map((item) => ({
          time: item.datetime,
          open: toNumber(item.open) ?? 0,
          high: toNumber(item.high) ?? 0,
          low: toNumber(item.low) ?? 0,
          close: toNumber(item.close) ?? 0,
          volume: toNumber(item.volume) ?? undefined,
        }))
        .filter((item) => item.open && item.high && item.low && item.close)
        .reverse() ?? []

    return {
      quote: null,
      candles,
      status: 'ok',
    }
  } catch (error) {
    return {
      quote: null,
      candles: [],
      status: 'error',
      error: mapProviderError(error),
    }
  }
}

export async function fetchQuotes(instruments: InstrumentConfig[]) {
  if (provider !== 'twelvedata') {
    return instruments.map((instrument) => ({
      instrument,
      price: null,
      change: null,
      percentChange: null,
      open: null,
      high: null,
      low: null,
      previousClose: null,
      volume: null,
      currency: null,
      exchange: instrument.exchange ?? null,
      timestamp: null,
      isMarketOpen: null,
      status: 'error' as const,
      error: 'Canlı veri şu anda kullanılamıyor.',
    }))
  }

  return Promise.all(instruments.map((instrument) => fetchTwelveDataQuote(instrument)))
}

export async function fetchAssetSnapshot(instrument: InstrumentConfig) {
  if (provider !== 'twelvedata') {
    return {
      quote: null,
      candles: [],
      status: 'error' as const,
      error: 'Grafik verisi şu anda kullanılamıyor.',
    }
  }

  return fetchTwelveDataSeries(instrument)
}
