import type { EquityPoint } from '../lib/tradeBot'

export type EquityTradeMarker = {
  at: string
  side: 'buy' | 'sell'
  symbol: string
  price: number
}

type EquityChartProps = {
  points: EquityPoint[]
  initial: number
  trades?: EquityTradeMarker[]
  height?: number
}

export function EquityChart({ points, initial, trades = [], height = 260 }: EquityChartProps) {
  if (points.length < 2) {
    return (
      <div className="equity-empty">
        <strong>Henüz yeterli veri yok</strong>
        <p>Bot her tarama döngüsünde sanal portföy değerini buraya işler.</p>
      </div>
    )
  }

  const width = 960
  const padding = { top: 24, right: 64, bottom: 36, left: 12 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const totals = points.map((p) => p.total)
  const max = Math.max(initial, ...totals)
  const min = Math.min(initial, ...totals)
  const range = max - min || max * 0.02 || 1

  const startTimeMs = new Date(points[0].at).getTime()
  const endTimeMs = new Date(points[points.length - 1].at).getTime()
  const span = Math.max(endTimeMs - startTimeMs, 1)

  const xForTime = (timeMs: number) => {
    const clamped = Math.min(Math.max(timeMs, startTimeMs), endTimeMs)
    return padding.left + ((clamped - startTimeMs) / span) * innerW
  }
  const xFor = (index: number) => xForTime(new Date(points[index].at).getTime())
  const yFor = (value: number) =>
    padding.top + (1 - (value - min) / range) * innerH

  const baselineY = yFor(initial)
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(2)},${yFor(p.total).toFixed(2)}`)
    .join(' ')
  const areaPath = `${linePath} L${xFor(points.length - 1).toFixed(2)},${(padding.top + innerH).toFixed(2)} L${padding.left.toFixed(2)},${(padding.top + innerH).toFixed(2)} Z`

  const last = points[points.length - 1]
  const positive = last.total >= initial
  const stroke = positive ? '#10b981' : '#ef4444'
  const gradId = positive ? 'equity-grad-up' : 'equity-grad-down'

  const ticks = 4
  const tickValues = Array.from({ length: ticks }).map(
    (_, i) => min + (range * i) / (ticks - 1),
  )

  const startTime = new Date(points[0].at).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const endTime = new Date(last.at).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const valueAtTime = (timeMs: number) => {
    if (points.length === 0) return null
    if (timeMs <= new Date(points[0].at).getTime()) return points[0].total
    if (timeMs >= new Date(points[points.length - 1].at).getTime())
      return points[points.length - 1].total
    for (let i = 1; i < points.length; i += 1) {
      const a = new Date(points[i - 1].at).getTime()
      const b = new Date(points[i].at).getTime()
      if (timeMs >= a && timeMs <= b) {
        const t = b === a ? 0 : (timeMs - a) / (b - a)
        return points[i - 1].total + (points[i].total - points[i - 1].total) * t
      }
    }
    return points[points.length - 1].total
  }

  const visibleTrades = trades.filter((trade) => {
    const t = new Date(trade.at).getTime()
    return Number.isFinite(t) && t >= startTimeMs && t <= endTimeMs
  })

  return (
    <div className="equity-chart-shell">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="equity-chart"
        preserveAspectRatio="none"
        role="img"
        aria-label="Sanal portföy değer eğrisi"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.32" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>

        {tickValues.map((value, i) => {
          const y = yFor(value)
          return (
            <g key={i}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                className="chart-grid-line"
              />
              <text
                x={width - padding.right + 8}
                y={y + 4}
                className="chart-axis-label"
              >
                ${value.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
              </text>
            </g>
          )
        })}

        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={baselineY}
          y2={baselineY}
          className="equity-baseline"
        />
        <text
          x={padding.left + 6}
          y={baselineY - 6}
          className="equity-baseline-label"
        >
          Başlangıç ${initial.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
        </text>

        <path d={areaPath} fill={`url(#${gradId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={stroke}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {visibleTrades.map((trade, i) => {
          const t = new Date(trade.at).getTime()
          const x = xForTime(t)
          const value = valueAtTime(t) ?? last.total
          const y = yFor(value)
          const isBuy = trade.side === 'buy'
          const color = isBuy ? '#10b981' : '#ef4444'
          return (
            <g key={`${trade.at}-${i}`} className="trade-marker">
              <circle cx={x} cy={y} r={6} fill={color} stroke="var(--card-bg)" strokeWidth={2}>
                <title>
                  {`${isBuy ? 'AL' : 'SAT'} ${trade.symbol} @ ${trade.price.toFixed(2)} · ${new Date(
                    trade.at,
                  ).toLocaleTimeString('tr-TR')}`}
                </title>
              </circle>
              <text
                x={x}
                y={y - 12}
                textAnchor="middle"
                className={`trade-marker-label ${isBuy ? 'buy' : 'sell'}`}
              >
                {isBuy ? 'AL' : 'SAT'}
              </text>
            </g>
          )
        })}

        <circle
          cx={xFor(points.length - 1)}
          cy={yFor(last.total)}
          r={5}
          fill={stroke}
          stroke="var(--card-bg)"
          strokeWidth={2}
        />

        <text
          x={padding.left}
          y={height - 10}
          className="chart-axis-label"
        >
          {startTime}
        </text>
        <text
          x={width - padding.right}
          y={height - 10}
          textAnchor="end"
          className="chart-axis-label"
        >
          {endTime}
        </text>
      </svg>
    </div>
  )
}
