type HeatmapItem = {
  symbol: string
  company: string
  change: number
}

type MiniHeatmapProps = {
  items: HeatmapItem[]
}

export function MiniHeatmap({ items }: MiniHeatmapProps) {
  if (!items.length) {
    return <div className="empty-state is-compact">Heatmap için veri bekleniyor.</div>
  }

  return (
    <div className="heatmap-grid">
      {items.map((item) => {
        const intensity = Math.min(Math.abs(item.change) / 6, 1)
        const background =
          item.change >= 0
            ? `rgba(16, 185, 129, ${0.18 + intensity * 0.42})`
            : `rgba(239, 68, 68, ${0.18 + intensity * 0.42})`

        return (
          <article
            key={item.symbol}
            className="heatmap-cell"
            style={{ background }}
          >
            <strong>{item.symbol}</strong>
            <p>{item.company}</p>
            <span className={item.change >= 0 ? 'positive' : 'negative'}>
              {item.change >= 0 ? '+' : ''}
              {item.change.toFixed(2)}%
            </span>
          </article>
        )
      })}
    </div>
  )
}
