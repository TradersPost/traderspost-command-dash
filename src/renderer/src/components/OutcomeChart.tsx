import type { PolymarketOutcome } from '../types/polymarket'
import { InfoBubble } from './InfoBubble'

interface OutcomeChartProps {
  outcomes: PolymarketOutcome[]
}

function formatVolume(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`
  return `$${Math.round(v)}`
}

function formatPct(p: number): string {
  if (p >= 0.995) return '99%+'
  if (p < 0.005) return '<1%'
  return `${Math.round(p * 100)}%`
}

export function OutcomeChart({ outcomes }: OutcomeChartProps) {
  if (outcomes.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-dim text-sm">
        No outcomes
      </div>
    )
  }

  // Split by direction
  const allUp = outcomes.filter((o) => o.direction === 'up')
  const allDown = outcomes.filter((o) => o.direction === 'down')

  // Filter: keep all unresolved + only the nearest resolved on each side
  const unresolvedUp = allUp.filter((o) => !o.closed)
  const resolvedUp = allUp.filter((o) => o.closed)
  // Nearest resolved upside = the one with the lowest target price (closest to current price)
  const nearestResolvedUp = resolvedUp.length > 0
    ? resolvedUp.sort((a, b) => a.targetPrice - b.targetPrice)[0]!
    : null
  const upside = [
    ...(nearestResolvedUp ? [nearestResolvedUp] : []),
    ...unresolvedUp
  ]
  // Sort descending: highest at top, lowest near the divider
  upside.sort((a, b) => b.targetPrice - a.targetPrice)

  const unresolvedDown = allDown.filter((o) => !o.closed)
  const resolvedDown = allDown.filter((o) => o.closed)
  // Nearest resolved downside = the one with the highest target price (closest to current price)
  const nearestResolvedDown = resolvedDown.length > 0
    ? resolvedDown.sort((a, b) => b.targetPrice - a.targetPrice)[0]!
    : null
  const downside = [
    ...(nearestResolvedDown ? [nearestResolvedDown] : []),
    ...unresolvedDown
  ]
  // Sort descending: highest (nearest to middle) at top, lowest at bottom
  downside.sort((a, b) => b.targetPrice - a.targetPrice)

  const visibleCount = upside.length + downside.length

  const barHeight = 22
  const gap = 4
  const labelWidth = 68
  const pctWidth = 42
  const rightPad = 8
  const leftPad = 4
  const hasDivider = upside.length > 0 && downside.length > 0
  const dividerHeight = hasDivider ? 12 : 0
  const topPad = 24
  const bottomPad = 8
  const downsideLabelPad = downside.length > 0 ? 18 : 0
  const upsideLabelPad = upside.length > 0 ? 18 : 0
  const totalHeight = topPad + upsideLabelPad + upside.length * (barHeight + gap) +
    dividerHeight + downsideLabelPad + downside.length * (barHeight + gap) + bottomPad

  const svgWidth = 380
  const chartLeft = leftPad + labelWidth + 8
  const chartRight = svgWidth - pctWidth - rightPad
  const chartWidth = chartRight - chartLeft

  const renderRow = (outcome: PolymarketOutcome, index: number, yOffset: number) => {
    const y = yOffset + index * (barHeight + gap)
    const barW = Math.max(1, outcome.probability * chartWidth)
    const isResolved = outcome.closed && outcome.probability >= 0.99
    const barColor = outcome.closed
      ? '#667085'
      : outcome.direction === 'up'
        ? '#2e90fa'
        : '#f04438'
    const opacity = outcome.closed && !isResolved ? 0.4 : 0.85
    const barMidY = y + barHeight / 2

    return (
      <g key={outcome.marketId}>
        <text
          x={leftPad + labelWidth}
          y={barMidY + 4}
          fill={outcome.closed ? '#667085' : '#98a2b3'}
          fontSize="11"
          textAnchor="end"
          fontWeight={isResolved ? '600' : '400'}
        >
          {outcome.label}
        </text>

        <rect
          x={chartLeft}
          y={y}
          width={chartWidth}
          height={barHeight}
          rx="3"
          fill="#293548"
          opacity="0.5"
        />

        <rect
          x={chartLeft}
          y={y}
          width={barW}
          height={barHeight}
          rx="3"
          fill={barColor}
          opacity={opacity}
        />

        {isResolved && (
          <text
            x={chartLeft + barW - 16}
            y={barMidY + 4}
            fill="#fff"
            fontSize="11"
            fontWeight="600"
          >
            &#10003;
          </text>
        )}

        <text
          x={chartRight + 6}
          y={barMidY + 4}
          fill={outcome.closed ? '#667085' : '#f2f4f7'}
          fontSize="11"
          fontWeight="500"
          textAnchor="start"
        >
          {formatPct(outcome.probability)}
        </text>

        {outcome.volume > 0 && !outcome.closed && (
          <text
            x={chartLeft + 4}
            y={y + barHeight - 3}
            fill="#667085"
            fontSize="8"
            opacity="0.7"
          >
            {formatVolume(outcome.volume)}
          </text>
        )}
      </g>
    )
  }

  // Y offsets
  const upsideLabelY = topPad
  const upsideStartY = upsideLabelY + upsideLabelPad
  const dividerY = upsideStartY + upside.length * (barHeight + gap)
  const downsideLabelY = dividerY + dividerHeight
  const downsideStartY = downsideLabelY + downsideLabelPad

  return (
    <div className="mx-3 mt-3 rounded-lg bg-bg-card border border-border p-3 flex-1 min-h-0 overflow-hidden flex flex-col">
      <div className="text-[11px] text-text-secondary font-medium mb-1 shrink-0 flex items-center gap-1">
        Market Outcomes
        <InfoBubble text="Shows active targets radiating from the current price. Upside targets go up, downside targets go down. The nearest resolved target on each side is shown for context. Bars show the crowd's implied probability of each level being hit." />
      </div>
      <svg
        viewBox={`0 0 ${svgWidth} ${totalHeight}`}
        preserveAspectRatio="xMidYMid meet"
        className="block w-full h-full min-h-0"
      >
        {/* Upside label */}
        {upside.length > 0 && (
          <text x={leftPad} y={upsideLabelY + 10} fill="#667085" fontSize="9" fontWeight="500">
            UPSIDE
          </text>
        )}

        {/* Upside bars */}
        {upside.map((o, i) => renderRow(o, i, upsideStartY))}

        {/* Divider */}
        {hasDivider && (
          <line
            x1={leftPad}
            y1={dividerY + dividerHeight / 2}
            x2={svgWidth - rightPad}
            y2={dividerY + dividerHeight / 2}
            stroke="#344054"
            strokeWidth="1"
            strokeDasharray="4 3"
          />
        )}

        {/* Downside label */}
        {downside.length > 0 && (
          <text x={leftPad} y={downsideLabelY + 12} fill="#667085" fontSize="9" fontWeight="500">
            DOWNSIDE
          </text>
        )}

        {/* Downside bars */}
        {downside.map((o, i) => renderRow(o, i, downsideStartY))}
      </svg>
    </div>
  )
}
