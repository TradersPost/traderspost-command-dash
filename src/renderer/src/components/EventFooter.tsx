import type { PolymarketEventData } from '../types/polymarket'

interface EventFooterProps {
  data: PolymarketEventData
}

function formatVolume(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`
  return `$${Math.round(v)}`
}

function formatEndDate(iso: string): string {
  const end = new Date(iso)
  const now = new Date()
  const diffMs = end.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  const dateStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  if (diffDays <= 0) return `Ended ${dateStr}`
  if (diffDays === 1) return `Ends ${dateStr} (1d left)`
  return `Ends ${dateStr} (${diffDays}d left)`
}

export function EventFooter({ data }: EventFooterProps) {
  return (
    <div className="mx-3 mt-3 mb-3 space-y-1.5">
      <div className="text-[12px] text-text-primary font-medium leading-tight">
        {data.title}
      </div>
      <div className="flex items-center justify-between text-[11px] text-text-dim">
        <span>{formatEndDate(data.endDate)}</span>
        <span>{formatVolume(data.totalVolume)} vol</span>
      </div>
      <div className="text-[10px] text-text-dim opacity-60">
        {new Date(data.lastUpdated).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })}
      </div>
    </div>
  )
}
