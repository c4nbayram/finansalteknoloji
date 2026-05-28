import type { Candle } from '../lib/indicators'

type LineAreaChartProps = {
  data: Candle[]
  mode: 'line' | 'area'
}

export function LineAreaChart({ data, mode }: LineAreaChartProps) {
  if (!data.length) return null

  const width = 960
  const height = 380
  const padding = { top: 24, right: 64, bottom: 38, left: 12 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const closes = data.map((c) => c.close)
  const max = Math.max(...closes)
  const min = Math.min(...closes)
  const range = max - min || max * 0.02 || 1

  const xFor = (i: number) =>
    padding.left + (i / Math.max(data.length - 1, 1)) * innerW
  const yFor = (v: number) =>
    padding.top + (1 - (v - min) / range) * innerH

  const linePath = data
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(2)},${yFor(c.close).toFixed(2)}`)
    .join(' ')
  const areaPath = `${linePath} L${xFor(data.length - 1).toFixed(2)},${(padding.top + innerH).toFixed(2)} L${padding.left.toFixed(2)},${(padding.top + innerH).toFixed(2)} Z`

  const positive = closes[closes.length - 1] >= closes[0]
  const stroke = positive ? '#10b981' : '#ef4444'
  const gradId = `line-grad-${positive ? 'up' : 'down'}`

  const ticks = 5
  const tickValues = Array.from({ length: ticks }).map(
    (_, i) => min + (range * i) / (ticks - 1),
  )

  const labelStep = Math.max(1, Math.ceil(data.length / 8))

  return (
    <div className="chart-shell">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="line-area-chart"
        preserveAspectRatio="none"
        role="img"
        aria-label={mode === 'area' ? 'Alan grafiği' : 'Çizgi grafiği'}
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
                {value.toFixed(2)}
              </text>
            </g>
          )
        })}

        {mode === 'area' && <path d={areaPath} fill={`url(#${gradId})`} />}
        <path
          d={linePath}
          fill="none"
          stroke={stroke}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {data.map((c, i) =>
          i % labelStep === 0 ? (
            <text
              key={`label-${i}`}
              x={xFor(i)}
              y={height - 12}
              textAnchor="middle"
              className="chart-label"
            >
              {c.time}
            </text>
          ) : null,
        )}

        <circle
          cx={xFor(data.length - 1)}
          cy={yFor(closes[closes.length - 1])}
          r={5}
          fill={stroke}
          stroke="var(--card-bg)"
          strokeWidth={2}
        />
      </svg>
    </div>
  )
}
