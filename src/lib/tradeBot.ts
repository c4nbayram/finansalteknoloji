import type { InstrumentConfig } from '../data/marketConfig'
import {
  calculateBollinger,
  calculateEma,
  calculateMacd,
  calculateRsi,
  type Candle,
} from './indicators'

export type BotStrategy = 'technical' | 'ai'
export type BotRisk = 'low' | 'medium' | 'high'
export type BotSide = 'buy' | 'sell'
export type BotDecisionType = 'buy' | 'sell' | 'hold'
export type BotFundingMode = 'wallet' | 'portfolio'
export type CurrencyType = 'USD' | 'TRY' | 'EUR'

export type BotConfig = {
  strategy: BotStrategy
  risk: BotRisk
  intervalSeconds: number
  openAiModel: string
  buyThreshold: number
  sellThreshold: number
  autoStart: boolean
  fundingMode: BotFundingMode
  currency: CurrencyType
  minBalance: number
  maxBalance: number
}

export type BotPosition = {
  instrumentId: string
  symbol: string
  label: string
  quantity: number
  averageCost: number
  openedAt: string
}

export type BotTrade = {
  id: string
  instrumentId: string
  symbol: string
  side: BotSide
  quantity: number
  price: number
  reason: string
  source: BotStrategy
  confidence: number
  timestamp: string
}

export type EquityPoint = {
  at: string
  total: number
  cash: number
  positionsValue: number
}

export type ActivityKind = 'scan' | 'decision' | 'trade' | 'error' | 'system'

export type ActivityEvent = {
  id: string
  kind: ActivityKind
  at: string
  title: string
  detail: string
  symbol?: string
  side?: BotSide
  decision?: BotDecisionType
  confidence?: number
  total?: number
}

export type BotState = {
  cash: number
  initialCash: number
  positions: BotPosition[]
  trades: BotTrade[]
  equityHistory: EquityPoint[]
  lastRunAt: string | null
}

export type BotDecision = {
  decision: BotDecisionType
  confidence: number
  reasoning: string
  source: BotStrategy
}

export type BotEvaluationContext = {
  instrument: InstrumentConfig
  candles: Candle[]
  hasPosition: boolean
  position?: BotPosition | null
}

export const RISK_FACTORS: Record<BotRisk, number> = {
  low: 0.05,
  medium: 0.1,
  high: 0.2,
}

export const RISK_LABEL: Record<BotRisk, string> = {
  low: 'Düşük (%5)',
  medium: 'Orta (%10)',
  high: 'Yüksek (%20)',
}

export const STRATEGY_LABEL: Record<BotStrategy, string> = {
  technical: 'Teknik göstergeler',
  ai: 'AI karar motoru',
}

export const INTERVAL_OPTIONS = [
  { value: 60, label: '60 sn' },
  { value: 180, label: '3 dk' },
  { value: 300, label: '5 dk' },
  { value: 600, label: '10 dk' },
]

export const OPENAI_MODEL_OPTIONS = [
  { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
  { value: 'gpt-4o', label: 'gpt-4o' },
  { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini' },
  { value: 'gpt-4.1', label: 'gpt-4.1' },
]

export const defaultBotConfig: BotConfig = {
  strategy: 'ai',
  risk: 'medium',
  intervalSeconds: 180,
  openAiModel: 'gpt-4o-mini',
  buyThreshold: 55,
  sellThreshold: 50,
  autoStart: true,
  fundingMode: 'wallet',
  currency: 'USD',
  minBalance: 0,
  maxBalance: 0,
}

export const defaultBotState: BotState = {
  cash: 0,
  initialCash: 0,
  positions: [],
  trades: [],
  equityHistory: [],
  lastRunAt: null,
}

const MIN_CANDLES = 30
const TRADING_FEE_RATE = 0.0005
const MIN_TRADE_VALUE = 50
const MAX_TRADES_TO_KEEP = 80

const MAX_OPEN_POSITIONS: Record<BotRisk, number> = {
  low: 4,
  medium: 6,
  high: 8,
}

const MAX_POSITION_EXPOSURE: Record<BotRisk, number> = {
  low: 0.12,
  medium: 0.18,
  high: 0.28,
}

const STOP_LOSS_PCT: Record<BotRisk, number> = {
  low: -3,
  medium: -5,
  high: -8,
}

const TAKE_PROFIT_PCT: Record<BotRisk, number> = {
  low: 7,
  medium: 11,
  high: 16,
}

type IndicatorSnapshot = {
  candles: Candle[]
  closes: number[]
  lastPrice: number | null
  prevPrice: number | null
  rsi: number | null
  macd: number | null
  prevMacd: number | null
  ema8: number | null
  ema21: number | null
  ema34: number | null
  bollinger: ReturnType<typeof calculateBollinger>
  atr: number | null
  atrPct: number | null
  momentum3Pct: number | null
  momentum10Pct: number | null
  volumeRatio: number | null
}

type ScoreBreakdown = {
  buy: number
  sell: number
  confidence: number
  buyReasons: string[]
  sellReasons: string[]
  cautions: string[]
  indicators: IndicatorSnapshot
}

type AiResponseShape = {
  decision?: string
  confidence?: number | string
  reasoning?: string
}

function isFinitePrice(value: number) {
  return Number.isFinite(value) && value > 0
}

function cleanCandles(candles: Candle[]) {
  return candles.filter(
    (candle) =>
      isFinitePrice(candle.open) &&
      isFinitePrice(candle.high) &&
      isFinitePrice(candle.low) &&
      isFinitePrice(candle.close),
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function effectiveBuyThreshold(config: BotConfig) {
  return clamp(Math.max(config.buyThreshold || 0, defaultBotConfig.buyThreshold), 45, 90)
}

function effectiveSellThreshold(config: BotConfig) {
  return clamp(Math.max(config.sellThreshold || 0, defaultBotConfig.sellThreshold), 45, 90)
}

function pctChange(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) {
    return null
  }

  return ((current - previous) / previous) * 100
}

function average(values: number[]) {
  if (!values.length) {
    return null
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function calculateAtr(candles: Candle[], period = 14) {
  if (candles.length <= period) {
    return null
  }

  const trueRanges: number[] = []
  for (let index = 1; index < candles.length; index += 1) {
    const current = candles[index]
    const previous = candles[index - 1]
    trueRanges.push(
      Math.max(
        current.high - current.low,
        Math.abs(current.high - previous.close),
        Math.abs(current.low - previous.close),
      ),
    )
  }

  return average(trueRanges.slice(-period))
}

function buildIndicators(candles: Candle[]): IndicatorSnapshot {
  const cleaned = cleanCandles(candles).slice(-60)
  const closes = cleaned.map((item) => item.close)
  const lastPrice = closes.at(-1) ?? null
  const prevPrice = closes.at(-2) ?? null
  const macd = calculateMacd(closes)
  const prevMacd = closes.length > 27 ? calculateMacd(closes.slice(0, -1)) : null
  const atr = calculateAtr(cleaned)
  const volumeWindow = cleaned
    .slice(-20)
    .map((item) => item.volume)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const lastVolume = cleaned.at(-1)?.volume
  const avgVolume = average(volumeWindow)

  return {
    candles: cleaned,
    closes,
    lastPrice,
    prevPrice,
    rsi: calculateRsi(closes),
    macd,
    prevMacd,
    ema8: calculateEma(closes, 8),
    ema21: calculateEma(closes, 21),
    ema34: calculateEma(closes, 34),
    bollinger: calculateBollinger(closes, 20),
    atr,
    atrPct: lastPrice && atr ? (atr / lastPrice) * 100 : null,
    momentum3Pct: pctChange(lastPrice, closes.at(-4) ?? null),
    momentum10Pct: pctChange(lastPrice, closes.at(-11) ?? null),
    volumeRatio:
      typeof lastVolume === 'number' && avgVolume && avgVolume > 0 ? lastVolume / avgVolume : null,
  }
}

function marketVolatilityCap(instrument: InstrumentConfig) {
  switch (instrument.market) {
    case 'kripto':
      return 8
    case 'emtia':
      return 4.5
    case 'doviz':
      return 2.8
    default:
      return 5
  }
}

function scoreTechnicalSetup(context: BotEvaluationContext): ScoreBreakdown {
  const indicators = buildIndicators(context.candles)
  const buyReasons: string[] = []
  const sellReasons: string[] = []
  const cautions: string[] = []
  let buy = 0
  let sell = 0

  const { instrument, position } = context
  const { lastPrice, rsi, macd, prevMacd, ema8, ema21, ema34, bollinger, atrPct } = indicators

  if (indicators.candles.length < MIN_CANDLES || lastPrice === null) {
    return {
      buy: 0,
      sell: 0,
      confidence: 0,
      buyReasons,
      sellReasons,
      cautions: [`Yeterli temiz mum verisi yok (${indicators.candles.length}/${MIN_CANDLES}).`],
      indicators,
    }
  }

  if (atrPct !== null) {
    const cap = marketVolatilityCap(instrument)
    if (atrPct > cap) {
      sell += 12
      cautions.push(`Volatilite yüksek: ATR %${atrPct.toFixed(2)}.`)
    } else if (atrPct < cap * 0.65) {
      buy += 4
      buyReasons.push(`Volatilite kontrollü: ATR %${atrPct.toFixed(2)}.`)
    }
  }

  if (ema8 !== null && ema21 !== null && ema34 !== null) {
    if (ema8 > ema21 && ema21 > ema34 && lastPrice > ema21) {
      buy += 24
      buyReasons.push('Trend yukarı: EMA8 > EMA21 > EMA34.')
    } else if (ema8 < ema21 && ema21 < ema34 && lastPrice < ema21) {
      sell += 24
      sellReasons.push('Trend aşağı: EMA8 < EMA21 < EMA34.')
    } else if (lastPrice > ema21) {
      buy += 9
      buyReasons.push('Fiyat EMA21 üzerinde.')
    } else {
      sell += 9
      sellReasons.push('Fiyat EMA21 altında.')
    }
  }

  if (macd !== null) {
    const macdRising = prevMacd !== null && macd > prevMacd
    if (macd > 0 && macdRising) {
      buy += 18
      buyReasons.push('MACD pozitif ve güçleniyor.')
    } else if (macd > 0) {
      buy += 10
      buyReasons.push('MACD pozitif.')
    } else if (macd < 0 && !macdRising) {
      sell += 18
      sellReasons.push('MACD negatif ve zayıflıyor.')
    } else if (macd < 0) {
      sell += 10
      sellReasons.push('MACD negatif.')
    }
  }

  if (indicators.momentum3Pct !== null) {
    if (indicators.momentum3Pct > 1.2) {
      buy += 8
      buyReasons.push(`Kısa momentum +%${indicators.momentum3Pct.toFixed(2)}.`)
    } else if (indicators.momentum3Pct < -1.2) {
      sell += 8
      sellReasons.push(`Kısa momentum %${indicators.momentum3Pct.toFixed(2)}.`)
    }
  }

  if (indicators.momentum10Pct !== null) {
    if (indicators.momentum10Pct > 2.5) {
      buy += 10
      buyReasons.push(`10 bar momentum +%${indicators.momentum10Pct.toFixed(2)}.`)
    } else if (indicators.momentum10Pct < -2.5) {
      sell += 10
      sellReasons.push(`10 bar momentum %${indicators.momentum10Pct.toFixed(2)}.`)
    }
  }

  if (rsi !== null) {
    if (rsi <= 28) {
      buy += 16
      buyReasons.push(`RSI ${rsi.toFixed(1)} aşırı satımda.`)
    } else if (rsi >= 74) {
      sell += 18
      sellReasons.push(`RSI ${rsi.toFixed(1)} aşırı alımda.`)
    } else if (rsi >= 52 && rsi <= 66) {
      buy += 8
      buyReasons.push(`RSI ${rsi.toFixed(1)} sağlıklı momentum bölgesinde.`)
    } else if (rsi < 42) {
      sell += 7
      sellReasons.push(`RSI ${rsi.toFixed(1)} zayıf.`)
    }
  }

  if (bollinger) {
    const bandWidth = bollinger.upper - bollinger.lower
    const bandPosition = bandWidth > 0 ? (lastPrice - bollinger.lower) / bandWidth : 0.5
    if (bandPosition <= 0.18 && rsi !== null && rsi < 45) {
      buy += 10
      buyReasons.push('Fiyat alt Bollinger bandına yakın.')
    } else if (bandPosition >= 0.86 && rsi !== null && rsi > 62) {
      sell += 12
      sellReasons.push('Fiyat üst Bollinger bandına yakın.')
    }
  }

  if (indicators.volumeRatio !== null) {
    if (indicators.volumeRatio >= 1.25) {
      buy += 4
      buyReasons.push(`Hacim ortalamanın ${indicators.volumeRatio.toFixed(1)} katı.`)
    } else if (indicators.volumeRatio < 0.55) {
      cautions.push('Hacim zayıf, sinyal güveni düşürüldü.')
    }
  }

  if (position && lastPrice > 0) {
    const positionPnlPct = ((lastPrice - position.averageCost) / position.averageCost) * 100
    if (positionPnlPct <= STOP_LOSS_PCT.medium) {
      sell += 32
      sellReasons.push(`Zarar kes seviyesi: ${positionPnlPct.toFixed(2)}%.`)
    } else if (positionPnlPct >= TAKE_PROFIT_PCT.medium && sell > buy * 0.65) {
      sell += 18
      sellReasons.push(`Kâr koruma aktif: +%${positionPnlPct.toFixed(2)}.`)
    } else if (positionPnlPct > 0 && buy > sell) {
      buy += 3
      buyReasons.push(`Pozisyon kârda: +%${positionPnlPct.toFixed(2)}.`)
    }
  }

  const leader = Math.max(buy, sell)
  const laggard = Math.min(buy, sell)
  const confidence = clamp(Math.round(leader - laggard * 0.45), 0, 95)

  return {
    buy,
    sell,
    confidence,
    buyReasons,
    sellReasons,
    cautions,
    indicators,
  }
}

function buildReason(reasons: string[], cautions: string[], fallback: string) {
  const joined = [...reasons.slice(0, 4), ...cautions.slice(0, 2)].join(' · ')
  return joined || fallback
}

export function evaluateTechnical(
  context: BotEvaluationContext,
  config: BotConfig,
): BotDecision {
  const score = scoreTechnicalSetup(context)
  const buyThreshold = effectiveBuyThreshold(config)
  const sellThreshold = effectiveSellThreshold(config)

  if (score.indicators.candles.length < MIN_CANDLES || score.indicators.lastPrice === null) {
    return {
      decision: 'hold',
      confidence: 0,
      reasoning: score.cautions[0] ?? 'Yeterli mum verisi yok.',
      source: 'technical',
    }
  }

  if (context.hasPosition && context.position && score.indicators.lastPrice > 0) {
    const pnlPct =
      ((score.indicators.lastPrice - context.position.averageCost) / context.position.averageCost) *
      100
    if (pnlPct <= STOP_LOSS_PCT[config.risk]) {
      return {
        decision: 'sell',
        confidence: 92,
        reasoning: `Risk yöneticisi zarar kesti: ${pnlPct.toFixed(2)}% <= ${STOP_LOSS_PCT[config.risk]}%.`,
        source: 'technical',
      }
    }
    if (
      pnlPct >= TAKE_PROFIT_PCT[config.risk] &&
      score.sell >= score.buy &&
      score.sell >= sellThreshold * 0.8
    ) {
      return {
        decision: 'sell',
        confidence: clamp(70 + Math.round(score.sell - score.buy), 70, 95),
        reasoning: buildReason(
          score.sellReasons,
          score.cautions,
          `Kâr koruma aktif: +%${pnlPct.toFixed(2)}.`,
        ),
        source: 'technical',
      }
    }
  }

  if (!context.hasPosition && score.buy >= buyThreshold && score.buy > score.sell * 1.25) {
    return {
      decision: 'buy',
      confidence: clamp(score.confidence + 35, 55, 95),
      reasoning: buildReason(score.buyReasons, score.cautions, 'Alım için teknik yapı pozitif.'),
      source: 'technical',
    }
  }

  if (context.hasPosition && score.sell >= sellThreshold && score.sell > score.buy * 1.15) {
    return {
      decision: 'sell',
      confidence: clamp(score.confidence + 35, 55, 95),
      reasoning: buildReason(score.sellReasons, score.cautions, 'Satış için teknik yapı zayıfladı.'),
      source: 'technical',
    }
  }

  const reasons = score.buy >= score.sell ? score.buyReasons : score.sellReasons
  return {
    decision: 'hold',
    confidence: clamp(score.confidence, 0, 75),
    reasoning: buildReason(reasons, score.cautions, 'Net ve güvenilir işlem sinyali yok.'),
    source: 'technical',
  }
}

export async function evaluateWithAi(
  context: BotEvaluationContext,
  config: BotConfig,
  apiKey: string,
  signal?: AbortSignal,
): Promise<BotDecision> {
  const technical = evaluateTechnical(context, config)
  const score = scoreTechnicalSetup(context)
  const { instrument, candles, hasPosition, position } = context
  const indicators = score.indicators

  if (!apiKey.trim()) {
    return {
      decision: 'hold',
      confidence: 0,
      source: 'ai',
      reasoning: 'OpenAI API anahtarı tanımlı değil; AI karar motoru işlem açmadı.',
    }
  }

  if (indicators.lastPrice === null || indicators.candles.length < MIN_CANDLES) {
    return {
      decision: 'hold',
      confidence: 0,
      reasoning: 'AI için yeterli temiz mum verisi yok.',
      source: 'ai',
    }
  }

  const recent = candles.slice(-16).map((candle) => ({
    t: candle.time,
    o: Number(candle.open.toFixed(4)),
    h: Number(candle.high.toFixed(4)),
    l: Number(candle.low.toFixed(4)),
    c: Number(candle.close.toFixed(4)),
    v: candle.volume ? Number(candle.volume.toFixed(0)) : undefined,
  }))

  const positionLine =
    hasPosition && position
      ? `Açık pozisyon: evet, ortalama maliyet ${position.averageCost.toFixed(4)}, adet ${position.quantity.toFixed(6)}`
      : 'Açık pozisyon: yok'

  const userPrompt = [
    `Varlık: ${instrument.symbol} (${instrument.label}) - ${instrument.market}`,
    `Son fiyat: ${indicators.lastPrice.toFixed(4)}`,
    positionLine,
    `Yerel teknik karar: ${technical.decision}, güven ${technical.confidence}, gerekçe: ${technical.reasoning}`,
    `Skorlar: buy ${score.buy.toFixed(1)}, sell ${score.sell.toFixed(1)}`,
    `RSI(14): ${indicators.rsi?.toFixed(2) ?? 'N/A'}`,
    `MACD: ${indicators.macd?.toFixed(4) ?? 'N/A'} | önceki MACD: ${indicators.prevMacd?.toFixed(4) ?? 'N/A'}`,
    `EMA8/21/34: ${indicators.ema8?.toFixed(4) ?? 'N/A'} / ${indicators.ema21?.toFixed(4) ?? 'N/A'} / ${indicators.ema34?.toFixed(4) ?? 'N/A'}`,
    `ATR%: ${indicators.atrPct?.toFixed(2) ?? 'N/A'} | 3 bar momentum: ${indicators.momentum3Pct?.toFixed(2) ?? 'N/A'} | 10 bar momentum: ${indicators.momentum10Pct?.toFixed(2) ?? 'N/A'}`,
    indicators.bollinger
      ? `Bollinger alt/orta/üst: ${indicators.bollinger.lower.toFixed(4)} / ${indicators.bollinger.middle.toFixed(4)} / ${indicators.bollinger.upper.toFixed(4)}`
      : 'Bollinger: N/A',
    `Son 16 mum: ${JSON.stringify(recent)}`,
    'Sadece şu JSON şemasını döndür: {"decision":"buy|sell|hold","confidence":0-100,"reasoning":"kısa Türkçe gerekçe"}',
  ].join('\n')

  const systemPrompt = [
    'Sen disiplinli, risk kontrollü bir OpenAI trade karar motorusun.',
    'Görevin buy/sell/hold kararını yalnızca verilen piyasa verisi, teknik skorlar ve açık pozisyon bilgisiyle üretmek.',
    'Belirsizlikte, çelişkili sinyalde, düşük hacimde veya aşırı volatilitede hold seç.',
    'Pozisyon yoksa sell seçme. Açık pozisyon varsa stop-loss, kâr koruma ve trend bozulmasını önceliklendir.',
    'Buy kararı için trend, momentum ve risk koşulları birlikte pozitif olmalı.',
    'Sell kararı için açık pozisyon, risk gerekçesi veya net trend bozulması olmalı.',
    'Confidence gerçek güven seviyesidir; işlem açılmasını istemiyorsan düşük confidence ver veya hold seç.',
    'Sadece geçerli JSON döndür. Açıklama kısa, Türkçe, somut ve gösterge bazlı olsun.',
  ].join(' ')

  let response: Response
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: config.openAiModel,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    })
  } catch (error) {
    return {
      decision: 'hold',
      confidence: 0,
      source: 'ai',
      reasoning: `AI bağlantısı kurulamadı; işlem bekletildi: ${
        error instanceof Error ? error.message : 'bilinmeyen hata'
      }`,
    }
  }

  if (!response.ok) {
    return {
      decision: 'hold',
      confidence: 0,
      source: 'ai',
      reasoning: `AI hatası ${response.status}; işlem bekletildi.`,
    }
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = payload.choices?.[0]?.message?.content?.trim()
  if (!content) {
    return {
      decision: 'hold',
      confidence: 0,
      source: 'ai',
      reasoning: 'AI boş yanıt verdi; işlem bekletildi.',
    }
  }

  let parsed: AiResponseShape
  try {
    parsed = JSON.parse(content) as AiResponseShape
  } catch {
    return {
      decision: 'hold',
      confidence: 0,
      source: 'ai',
      reasoning: 'AI yanıtı JSON formatında değil; işlem bekletildi.',
    }
  }

  const rawDecision = String(parsed.decision ?? '').toLowerCase()
  let decision: BotDecisionType =
    rawDecision === 'buy' || rawDecision === 'sell' || rawDecision === 'hold'
      ? rawDecision
      : 'hold'
  let confidence = clamp(Math.round(Number(parsed.confidence ?? 0)), 0, 100)
  const reasoning = String(parsed.reasoning ?? '').slice(0, 260) || 'AI kısa gerekçe sağlamadı.'

  if (decision === 'sell' && !hasPosition) {
    decision = 'hold'
    confidence = Math.min(confidence, 45)
  }

  if (decision === 'buy' && hasPosition) {
    decision = 'hold'
    confidence = Math.min(confidence, 50)
  }

  const threshold =
    decision === 'buy' ? effectiveBuyThreshold(config) : effectiveSellThreshold(config)
  if (decision !== 'hold' && confidence < threshold) {
    return {
      decision: 'hold',
      confidence,
      reasoning: `AI güveni eşik altında (%${confidence} < %${threshold}). ${reasoning}`,
      source: 'ai',
    }
  }

  if (
    decision !== 'hold' &&
    technical.decision !== 'hold' &&
    technical.decision !== decision &&
    technical.confidence >= 70
  ) {
    return {
      decision: 'hold',
      confidence: Math.min(confidence, 65),
      reasoning: `AI ve teknik karar çelişti; işlem bekletildi. AI: ${reasoning}`,
      source: 'ai',
    }
  }

  return {
    decision,
    confidence,
    reasoning,
    source: 'ai',
  }
}

function generateTradeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export type ExecutionResult = {
  state: BotState
  trade: BotTrade | null
  message: string
}

export type BuyAllocationPreview = {
  ok: boolean
  grossAllocation: number
  netAllocation: number
  fee: number
  reason?: string
}

function withFee(value: number) {
  return value * TRADING_FEE_RATE
}

export function previewBuyAllocation(
  state: BotState,
  config: BotConfig,
): BuyAllocationPreview {
  const cashReserve = state.initialCash * 0.02
  const deployableCash = Math.max(0, state.cash - cashReserve)
  const riskAllocation = deployableCash * RISK_FACTORS[config.risk]
  const exposureCap = state.initialCash * MAX_POSITION_EXPOSURE[config.risk]

  const minConfigured = Math.max(0, Number(config.minBalance ?? 0))
  const maxConfigured =
    Number(config.maxBalance ?? 0) > 0
      ? Math.max(minConfigured, Number(config.maxBalance))
      : Number.POSITIVE_INFINITY

  let grossAllocation = Math.min(riskAllocation, exposureCap, deployableCash, maxConfigured)

  if (minConfigured > 0) {
    if (deployableCash < minConfigured) {
      return {
        ok: false,
        grossAllocation: 0,
        netAllocation: 0,
        fee: 0,
        reason: `Min işlem tutarı (${minConfigured.toFixed(2)}) için yeterli nakit yok.`,
      }
    }
    grossAllocation = Math.max(grossAllocation, minConfigured)
    grossAllocation = Math.min(grossAllocation, deployableCash, exposureCap, maxConfigured)
  }

  if (grossAllocation < MIN_TRADE_VALUE) {
    return {
      ok: false,
      grossAllocation: 0,
      netAllocation: 0,
      fee: 0,
      reason: 'Yeterli sanal nakit yok.',
    }
  }

  const fee = withFee(grossAllocation)
  const netAllocation = grossAllocation - fee

  return {
    ok: netAllocation > 0,
    grossAllocation,
    netAllocation,
    fee,
    reason: netAllocation > 0 ? undefined : 'İşlem sonrası kullanılabilir tutar sıfır.',
  }
}

export function executeBuy(
  state: BotState,
  instrument: InstrumentConfig,
  price: number,
  config: BotConfig,
  decision: BotDecision,
): ExecutionResult {
  if (!isFinitePrice(price)) {
    return { state, trade: null, message: 'Geçersiz fiyat.' }
  }

  if (decision.confidence < effectiveBuyThreshold(config)) {
    return {
      state,
      trade: null,
      message: `${instrument.symbol}: güven eşiği altında, alım yapılmadı.`,
    }
  }

  if (state.positions.some((position) => position.instrumentId === instrument.id)) {
    return {
      state,
      trade: null,
      message: `${instrument.symbol}: açık pozisyon zaten var, ek alım yapılmadı.`,
    }
  }

  if (state.positions.length >= MAX_OPEN_POSITIONS[config.risk]) {
    return {
      state,
      trade: null,
      message: `Maksimum açık pozisyon sınırı dolu (${MAX_OPEN_POSITIONS[config.risk]}).`,
    }
  }

  const allocation = previewBuyAllocation(state, config)
  if (!allocation.ok) {
    return { state, trade: null, message: allocation.reason ?? 'İşleme alınacak tutar hesaplanamadı.' }
  }

  const quantity = allocation.netAllocation / price
  if (quantity <= 0) {
    return { state, trade: null, message: 'İşlem adedi hesaplanamadı.' }
  }

  const trade: BotTrade = {
    id: generateTradeId(),
    instrumentId: instrument.id,
    symbol: instrument.symbol,
    side: 'buy',
    quantity,
    price,
    reason: decision.reasoning,
    source: decision.source,
    confidence: decision.confidence,
    timestamp: new Date().toISOString(),
  }

  return {
    state: {
      ...state,
      cash: state.cash - allocation.grossAllocation,
      positions: [
        ...state.positions,
        {
          instrumentId: instrument.id,
          symbol: instrument.symbol,
          label: instrument.label,
          quantity,
          averageCost: price,
          openedAt: new Date().toISOString(),
        },
      ],
      trades: [trade, ...state.trades].slice(0, MAX_TRADES_TO_KEEP),
    },
    trade,
    message: `${instrument.symbol} alındı: ${quantity.toFixed(4)} adet @ ${price.toFixed(2)}`,
  }
}

export function executeSell(
  state: BotState,
  instrument: InstrumentConfig,
  price: number,
  decision: BotDecision,
): ExecutionResult {
  const existing = state.positions.find((position) => position.instrumentId === instrument.id)
  if (!existing) {
    return { state, trade: null, message: 'Açık pozisyon yok.' }
  }
  if (!isFinitePrice(price)) {
    return { state, trade: null, message: 'Geçersiz fiyat.' }
  }

  const grossProceeds = existing.quantity * price
  const proceeds = grossProceeds - withFee(grossProceeds)
  const trade: BotTrade = {
    id: generateTradeId(),
    instrumentId: instrument.id,
    symbol: instrument.symbol,
    side: 'sell',
    quantity: existing.quantity,
    price,
    reason: decision.reasoning,
    source: decision.source,
    confidence: decision.confidence,
    timestamp: new Date().toISOString(),
  }

  return {
    state: {
      ...state,
      cash: state.cash + proceeds,
      positions: state.positions.filter((position) => position.instrumentId !== instrument.id),
      trades: [trade, ...state.trades].slice(0, MAX_TRADES_TO_KEEP),
    },
    trade,
    message: `${instrument.symbol} satıldı: ${existing.quantity.toFixed(4)} adet @ ${price.toFixed(2)}`,
  }
}

export function botPortfolioValue(state: BotState, priceLookup: (id: string) => number | null) {
  const positionsValue = state.positions.reduce((sum, position) => {
    const live = priceLookup(position.instrumentId)
    const fallback = position.averageCost
    return sum + position.quantity * (live ?? fallback)
  }, 0)
  const total = state.cash + positionsValue

  return {
    positionsValue,
    total,
    pnl: total - state.initialCash,
    pnlPct: state.initialCash === 0 ? 0 : ((total - state.initialCash) / state.initialCash) * 100,
  }
}

const MAX_EQUITY_POINTS = 360
const MIN_EQUITY_GAP_MS = 30_000

export function appendEquityPoint(
  state: BotState,
  priceLookup: (id: string) => number | null,
  at: string = new Date().toISOString(),
): BotState {
  const valuation = botPortfolioValue(state, priceLookup)
  const last = state.equityHistory.at(-1)
  if (last) {
    const lastTime = new Date(last.at).getTime()
    const nextTime = new Date(at).getTime()
    if (
      Number.isFinite(lastTime) &&
      Number.isFinite(nextTime) &&
      nextTime - lastTime < MIN_EQUITY_GAP_MS &&
      Math.abs(last.total - valuation.total) < 1
    ) {
      return state
    }
  }
  const next: EquityPoint = {
    at,
    total: valuation.total,
    cash: state.cash,
    positionsValue: valuation.positionsValue,
  }
  return {
    ...state,
    equityHistory: [...state.equityHistory, next].slice(-MAX_EQUITY_POINTS),
  }
}
