type SparklineProps = {
  points: number[]
  positive?: boolean
  width?: number
  height?: number
  strokeWidth?: number
}

export function Sparkline({
  points,
  positive = true,
  width = 140,
  height = 44,
  strokeWidth = 2,
}: SparklineProps) {
  if (!points.length) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="spark-empty" aria-hidden="true">
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} strokeDasharray="3 4" />
      </svg>
    )
  }

  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1
  const stepX = points.length > 1 ? width / (points.length - 1) : width

  const coords = points.map((value, index) => {
    const x = index * stepX
    const y = height - ((value - min) / range) * (height - strokeWidth * 2) - strokeWidth
    return [x, y] as const
  })

  const linePath = coords
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ')

  const areaPath = `${linePath} L${(width).toFixed(2)},${height} L0,${height} Z`

  const gradientId = positive ? 'spark-grad-up' : 'spark-grad-down'
  const stroke = positive ? 'var(--spark-up)' : 'var(--spark-down)'

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="spark" aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
