type Candle = {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

type CandlestickChartProps = {
  data: Candle[]
}

export function CandlestickChart({ data }: CandlestickChartProps) {
  if (!data.length) {
    return null
  }

  const width = 960
  const height = 380
  const padding = { top: 20, right: 56, bottom: 70, left: 12 }
  const volumeAreaHeight = 56
  const priceTop = padding.top
  const priceBottom = height - padding.bottom - volumeAreaHeight - 8
  const volumeTop = height - padding.bottom - volumeAreaHeight
  const volumeBottom = height - padding.bottom

  const max = Math.max(...data.map((item) => item.high))
  const min = Math.min(...data.map((item) => item.low))
  const range = max - min || 1

  const maxVolume = Math.max(...data.map((item) => item.volume ?? 0)) || 1

  const innerWidth = width - padding.left - padding.right
  const slot = innerWidth / data.length
  const candleWidth = Math.min(28, Math.max(6, slot * 0.6))

  const scaleY = (value: number) =>
    priceTop + (1 - (value - min) / range) * (priceBottom - priceTop)

  const ticks = 5
  const tickValues = Array.from({ length: ticks }).map(
    (_, i) => min + (range * i) / (ticks - 1),
  )

  return (
    <div className="chart-shell">
      <svg
        className="candle-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Candlestick chart"
        preserveAspectRatio="none"
      >
        {tickValues.map((value, index) => {
          const y = scaleY(value)
          return (
            <g key={index}>
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

        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={volumeTop - 4}
          y2={volumeTop - 4}
          className="chart-divider"
        />

        {data.map((item, index) => {
          const x = padding.left + index * slot + slot / 2
          const isUp = item.close >= item.open
          const openY = scaleY(item.open)
          const closeY = scaleY(item.close)
          const highY = scaleY(item.high)
          const lowY = scaleY(item.low)
          const bodyY = Math.min(openY, closeY)
          const bodyHeight = Math.max(Math.abs(openY - closeY), 2)
          const volH = ((item.volume ?? 0) / maxVolume) * (volumeBottom - volumeTop)
          const volY = volumeBottom - volH

          const showLabel = data.length <= 16 || index % Math.ceil(data.length / 8) === 0

          return (
            <g key={`${item.time}-${index}`}>
              <line
                x1={x}
                x2={x}
                y1={highY}
                y2={lowY}
                className={isUp ? 'wick-up' : 'wick-down'}
              />
              <rect
                x={x - candleWidth / 2}
                y={bodyY}
                width={candleWidth}
                height={bodyHeight}
                rx="2"
                className={isUp ? 'body-up' : 'body-down'}
              />
              <rect
                x={x - candleWidth / 2}
                y={volY}
                width={candleWidth}
                height={volH}
                rx="1.5"
                className={isUp ? 'volume-up' : 'volume-down'}
              />
              {showLabel && (
                <text
                  x={x}
                  y={height - padding.bottom + 18}
                  textAnchor="middle"
                  className="chart-label"
                >
                  {item.time}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
