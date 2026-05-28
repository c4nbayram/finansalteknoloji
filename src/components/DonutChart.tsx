type DonutSlice = {
  id?: string
  label: string
  value: number
  color: string
}

type DonutChartProps = {
  slices: DonutSlice[]
  size?: number
  thickness?: number
  centerLabel?: string
  centerValue?: string
  selectedId?: string | null
  onSelect?: (slice: DonutSlice) => void
}

export function DonutChart({
  slices,
  size = 220,
  thickness = 28,
  centerLabel,
  centerValue,
  selectedId,
  onSelect,
}: DonutChartProps) {
  const total = slices.reduce((sum, slice) => sum + Math.max(slice.value, 0), 0)
  const radius = size / 2 - thickness / 2
  const circumference = 2 * Math.PI * radius
  const center = size / 2

  if (total <= 0) {
    return (
      <div className="donut-empty" style={{ width: size, height: size }}>
        <span>Veri yok</span>
      </div>
    )
  }

  const segments = slices.reduce<
    Array<{ id?: string; label: string; color: string; dash: number; offset: number; original: DonutSlice }>
  >((acc, slice) => {
    const fraction = Math.max(slice.value, 0) / total
    const dash = fraction * circumference
    const previousOffset = acc.length === 0 ? 0 : acc[acc.length - 1].offset + acc[acc.length - 1].dash
    acc.push({
      id: slice.id,
      label: slice.label,
      color: slice.color,
      dash,
      offset: previousOffset,
      original: slice,
    })
    return acc
  }, [])

  return (
    <div className="donut-wrapper" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="donut-svg">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--donut-track)"
          strokeWidth={thickness}
        />
        {segments.map((segment) => {
          const gap = circumference - segment.dash
          const dashArray = `${segment.dash} ${gap}`
          const dashOffset = circumference / 4 - segment.offset
          const isSelected = selectedId !== undefined && segment.id === selectedId
          const segmentThickness = isSelected ? thickness + 6 : thickness
          return (
            <circle
              key={segment.label}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={segmentThickness}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${center} ${center})`}
              className={onSelect ? 'donut-segment is-clickable' : 'donut-segment'}
              style={onSelect ? { cursor: 'pointer' } : undefined}
              onClick={onSelect ? () => onSelect(segment.original) : undefined}
            >
              <title>{segment.label}</title>
            </circle>
          )
        })}
      </svg>
      {(centerLabel || centerValue) && (
        <div className="donut-center">
          {centerLabel && <span className="donut-center-label">{centerLabel}</span>}
          {centerValue && <strong className="donut-center-value">{centerValue}</strong>}
        </div>
      )}
    </div>
  )
}
