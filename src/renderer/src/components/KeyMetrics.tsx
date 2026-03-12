import type { GammaLevels } from '../types/gex'
import { InfoBubble } from './InfoBubble'

interface KeyMetricsProps {
  levels: GammaLevels
  spotPrice: number
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function formatDiff(diff: number): string {
  const sign = diff >= 0 ? '+' : ''
  return `${sign}${Math.round(diff)} pt`
}

const metrics = [
  { key: 'callWall' as const, label: 'Call Wall', color: 'text-call-wall' },
  { key: 'putWall' as const, label: 'Put Wall', color: 'text-put-wall' }
]

export function KeyMetrics({ levels, spotPrice }: KeyMetricsProps) {
  return (
    <div className="mx-3 mt-3 space-y-1.5">
      <div className="flex items-center gap-1">
        <span className="text-[11px] text-text-secondary font-medium">Key Levels</span>
        <InfoBubble text="Call Wall: the strike with the largest call gamma above the current price. Acts as a ceiling — dealers hedging short calls create selling pressure here. Put Wall: the strike with the largest put gamma below the current price. Acts as a floor — dealers hedging short puts create buying pressure here. The +/- points show distance from SPX." />
      </div>
      {metrics.map(({ key, label, color }) => {
        const value = levels[key]
        const diff = value - spotPrice

        return (
          <div key={key} className="flex items-center justify-between text-[12px]">
            <span className={`font-medium ${color}`}>{label}</span>
            <div className="flex items-center gap-6">
              <span className="text-text-primary font-mono font-medium w-16 text-right">
                {formatNumber(value)}
              </span>
              <span className="text-text-dim font-mono w-16 text-right">
                {formatDiff(diff)}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
