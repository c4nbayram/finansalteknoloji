export type Candle = {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

function average(values: number[]) {
  if (!values.length) {
    return null
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function calculateEma(values: number[], period: number) {
  if (values.length < period) {
    return null
  }

  const multiplier = 2 / (period + 1)
  let ema = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period

  for (let index = period; index < values.length; index += 1) {
    ema = (values[index] - ema) * multiplier + ema
  }

  return ema
}

export function calculateRsi(values: number[], period = 14) {
  if (values.length <= period) {
    return null
  }

  let gains = 0
  let losses = 0

  for (let index = 1; index <= period; index += 1) {
    const change = values[index] - values[index - 1]
    if (change >= 0) {
      gains += change
    } else {
      losses += Math.abs(change)
    }
  }

  let averageGain = gains / period
  let averageLoss = losses / period

  for (let index = period + 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1]
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? Math.abs(change) : 0
    averageGain = (averageGain * (period - 1) + gain) / period
    averageLoss = (averageLoss * (period - 1) + loss) / period
  }

  if (averageLoss === 0) {
    return 100
  }

  const rs = averageGain / averageLoss
  return 100 - 100 / (1 + rs)
}

export function calculateMacd(values: number[]) {
  const ema12 = calculateEma(values, 12)
  const ema26 = calculateEma(values, 26)

  if (ema12 === null || ema26 === null) {
    return null
  }

  return ema12 - ema26
}

export function calculateBollinger(values: number[], period = 20) {
  if (values.length < period) {
    return null
  }

  const slice = values.slice(-period)
  const mean = average(slice)
  if (mean === null) {
    return null
  }

  const variance =
    slice.reduce((sum, value) => sum + (value - mean) ** 2, 0) / slice.length
  const deviation = Math.sqrt(variance)

  return {
    middle: mean,
    upper: mean + deviation * 2,
    lower: mean - deviation * 2,
  }
}

export function calculateSupportResistance(candles: Candle[]) {
  if (!candles.length) {
    return { support: [], resistance: [] }
  }

  const window = candles.slice(-20)
  const lows = [...window.map((item) => item.low)].sort((a, b) => a - b)
  const highs = [...window.map((item) => item.high)].sort((a, b) => b - a)

  return {
    support: Array.from(new Set(lows.map((value) => Number(value.toFixed(2))))).slice(0, 3),
    resistance: Array.from(new Set(highs.map((value) => Number(value.toFixed(2))))).slice(0, 3),
  }
}

export function buildIndicatorSnapshot(candles: Candle[]) {
  const closes = candles.map((item) => item.close)
  const rsi = calculateRsi(closes)
  const macd = calculateMacd(closes)
  const ema20 = calculateEma(closes, 20)
  const bollinger = calculateBollinger(closes, 20)

  return [
    {
      label: 'RSI (14)',
      value: rsi === null ? '--' : rsi.toFixed(2),
      status:
        rsi === null ? 'veri yok' : rsi > 60 ? 'pozitif' : rsi < 40 ? 'negatif' : 'nötr',
    },
    {
      label: 'MACD',
      value: macd === null ? '--' : macd.toFixed(2),
      status:
        macd === null ? 'veri yok' : macd > 0 ? 'pozitif' : macd < 0 ? 'negatif' : 'nötr',
    },
    {
      label: 'EMA 20',
      value: ema20 === null ? '--' : ema20.toFixed(2),
      status: ema20 === null ? 'veri yok' : 'nötr',
    },
    {
      label: 'Bollinger',
      value:
        bollinger === null
          ? '--'
          : `${bollinger.lower.toFixed(2)} / ${bollinger.upper.toFixed(2)}`,
      status: bollinger === null ? 'veri yok' : 'nötr',
    },
  ]
}
