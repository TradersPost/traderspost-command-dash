import type { TrendSignal } from '../hooks/usePolymarketData'
import type { PolymarketOutcome, PriceHistoryPoint } from '../types/polymarket'
import { InfoBubble } from './InfoBubble'

interface TrendSignalProps {
  signal: TrendSignal
  upside: PolymarketOutcome | null
  downside: PolymarketOutcome | null
  upsideHistory: PriceHistoryPoint[]
  downsideHistory: PriceHistoryPoint[]
  currentTimestamp: number | null
}

const signalConfig = {
  bullish: { label: 'BULLISH', color: '#2e90fa', arrow: '▲' },
  bearish: { label: 'BEARISH', color: '#f04438', arrow: '▼' },
  neutral: { label: 'NEUTRAL', color: '#f79009', arrow: '◆' }
}

function formatPct(p: number): string {
  if (p >= 0.995) return '99%+'
  if (p < 0.005) return '<1%'
  return `${Math.round(p * 100)}%`
}

function Sparkline({
  history,
  color,
  currentTimestamp
}: {
  history: PriceHistoryPoint[]
  color: string
  currentTimestamp: number | null
}) {
  if (history.length < 2) return null

  const w = 120
  const h = 32
  const pad = 2
  const minP = Math.min(...history.map((p) => p.p))
  const maxP = Math.max(...history.map((p) => p.p))
  const range = maxP - minP || 0.01

  const coords = history.map((pt, i) => ({
    x: pad + (i / (history.length - 1)) * (w - pad * 2),
    y: h - pad - ((pt.p - minP) / range) * (h - pad * 2)
  }))

  const points = coords.map((c) => `${c.x},${c.y}`).join(' ')

  // Find the dot position for the current timestamp
  let dotX: number | null = null
  let dotY: number | null = null
  if (currentTimestamp != null) {
    // Find closest history point at or before the timestamp
    let closest = 0
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i]!.t <= currentTimestamp) {
        closest = i
        break
      }
    }
    dotX = coords[closest]!.x
    dotY = coords[closest]!.y
  }

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {dotX != null && dotY != null && (
        <circle
          cx={dotX}
          cy={dotY}
          r="3"
          fill={color}
          stroke="#111927"
          strokeWidth="1.5"
        />
      )}
    </svg>
  )
}

export function TrendSignalDisplay({
  signal,
  upside,
  downside,
  upsideHistory,
  downsideHistory,
  currentTimestamp
}: TrendSignalProps) {
  const cfg = signalConfig[signal]

  return (
    <div className="mx-3 rounded-lg bg-bg-card border border-border p-3">
      {/* Signal header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-text-secondary font-medium">Crowd Sentiment</span>
          <InfoBubble text="Derived from Polymarket prediction markets. Compares the probability of the nearest unresolved upside target being hit vs. the nearest downside target. If upside probability is 10%+ higher → Bullish. If downside is 10%+ higher → Bearish. Otherwise → Neutral." />
        </div>
        <div className="flex items-center gap-1.5">
          <span style={{ color: cfg.color }} className="text-sm">{cfg.arrow}</span>
          <span style={{ color: cfg.color }} className="text-[13px] font-bold tracking-wide">
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Nearest targets */}
      <div className="space-y-2.5">
        {upside && (
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] text-accent font-medium uppercase tracking-wide">Upside</span>
                <span className="text-[12px] text-text-primary font-mono font-medium">{upside.label}</span>
              </div>
              <Sparkline history={upsideHistory} color="#2e90fa" currentTimestamp={currentTimestamp} />
            </div>
            <span className="text-[18px] font-bold font-mono text-accent ml-3">
              {formatPct(upside.probability)}
            </span>
          </div>
        )}

        {downside && (
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] text-put-wall font-medium uppercase tracking-wide">Downside</span>
                <span className="text-[12px] text-text-primary font-mono font-medium">{downside.label}</span>
              </div>
              <Sparkline history={downsideHistory} color="#f04438" currentTimestamp={currentTimestamp} />
            </div>
            <span className="text-[18px] font-bold font-mono text-put-wall ml-3">
              {formatPct(downside.probability)}
            </span>
          </div>
        )}

        {!upside && !downside && (
          <div className="text-text-dim text-[11px] text-center py-2">
            No active targets
          </div>
        )}
      </div>
    </div>
  )
}
