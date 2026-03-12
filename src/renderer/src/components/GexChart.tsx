import type { StrikeGex, GammaLevels } from '../types/gex'
import { InfoBubble } from './InfoBubble'

interface GexChartProps {
  strikeProfile: StrikeGex[]
  spotPrice: number
  levels: GammaLevels
  strikeRanges: Map<number, { minCall: number; maxCall: number; minPut: number; maxPut: number }>
}

function formatGex(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(0)}M`
  return `$${(value / 1e3).toFixed(0)}K`
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

export function GexChart({ strikeProfile, spotPrice, levels, strikeRanges }: GexChartProps) {
  if (strikeProfile.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-dim text-sm">
        No strike data
      </div>
    )
  }

  const strikes = [...strikeProfile].sort((a, b) => b.strike - a.strike) // descending for visual

  // Find max absolute value for scaling — include historical ranges
  let maxAbsGex = Math.max(
    ...strikes.map((s) => Math.max(Math.abs(s.callGex), Math.abs(s.putGex)))
  )
  for (const s of strikes) {
    const range = strikeRanges.get(s.strike)
    if (range) {
      maxAbsGex = Math.max(maxAbsGex, Math.abs(range.maxCall), Math.abs(range.minPut))
    }
  }

  const barHeight = 16
  const gap = 3
  const labelWidth = 56
  const chartLeft = labelWidth + 24
  const rightPad = 8
  const topPad = 28
  const bottomPad = 28
  const totalHeight = topPad + strikes.length * (barHeight + gap) + bottomPad

  const svgWidth = 380
  const chartWidth = svgWidth - chartLeft - rightPad
  const centerX = chartLeft + chartWidth / 2

  // Scale factor
  const scale = maxAbsGex > 0 ? (chartWidth / 2) / maxAbsGex : 0

  // Helper: find the Y position for a given strike price
  const strikeToY = (targetStrike: number): number | null => {
    let closest = -1
    let minDist = Infinity
    for (let i = 0; i < strikes.length; i++) {
      const dist = Math.abs(strikes[i]!.strike - targetStrike)
      if (dist < minDist) {
        minDist = dist
        closest = i
      }
    }
    if (closest < 0) return null
    return topPad + closest * (barHeight + gap) + barHeight / 2
  }

  const spotY = strikeToY(spotPrice)
  const callWallY = levels.callWall > 0 ? strikeToY(levels.callWall) : null
  const putWallY = levels.putWall > 0 ? strikeToY(levels.putWall) : null

  return (
    <div className="mx-3 rounded-lg bg-bg-card border border-border p-3 flex-1 min-h-0 overflow-hidden flex flex-col">
      <div className="text-[11px] text-text-secondary font-medium mb-1 shrink-0 flex items-center gap-1">
        Gamma Strike Profile
        <InfoBubble text="Each row shows the gamma exposure at a strike price. Blue bars (right) are call gamma — dealers are short calls and must sell into rallies. Gray bars (left) are put gamma — dealers are short puts and must buy into dips. The faint lines behind bars show the day's high/low range. Dashed lines mark the current SPX price, Call Wall, and Put Wall." />
      </div>
      <svg
        viewBox={`0 0 ${svgWidth} ${totalHeight}`}
        preserveAspectRatio="xMidYMid meet"
        className="block w-full h-full min-h-0"
      >
        {/* Center line */}
        <line
          x1={centerX}
          y1={topPad - 4}
          x2={centerX}
          y2={totalHeight - bottomPad + 4}
          stroke="#344054"
          strokeWidth="1"
        />

        {/* X-axis labels */}
        <text x={chartLeft} y={totalHeight - 8} fill="#667085" fontSize="10" textAnchor="start">
          {formatGex(-maxAbsGex)}
        </text>
        <text x={centerX} y={totalHeight - 8} fill="#667085" fontSize="10" textAnchor="middle">
          $0
        </text>
        <text x={svgWidth - rightPad} y={totalHeight - 8} fill="#667085" fontSize="10" textAnchor="end">
          {formatGex(maxAbsGex)}
        </text>

        {/* Top axis labels */}
        <text x={chartLeft + chartWidth * 0.25} y={topPad - 10} fill="#667085" fontSize="10" textAnchor="middle">
          {formatGex(-maxAbsGex / 2)}
        </text>
        <text x={chartLeft + chartWidth * 0.75} y={topPad - 10} fill="#667085" fontSize="10" textAnchor="middle">
          {formatGex(maxAbsGex / 2)}
        </text>

        {/* Bars */}
        {strikes.map((s, i) => {
          const y = topPad + i * (barHeight + gap)
          const callWidth = Math.abs(s.callGex) * scale
          const putWidth = Math.abs(s.putGex) * scale
          const range = strikeRanges.get(s.strike)
          const barMidY = y + barHeight / 2

          return (
            <g key={s.strike}>
              {/* Strike label */}
              <text
                x={labelWidth}
                y={barMidY + 3.5}
                fill="#98a2b3"
                fontSize="10"
                textAnchor="end"
              >
                {formatNumber(s.strike)}
              </text>

              {/* Historical range indicators (thin lines behind bars) */}
              {range && (
                <>
                  {/* Call side range (right of center) */}
                  {range.maxCall > 0 && (
                    <line
                      x1={centerX + Math.min(range.minCall, s.callGex) * scale}
                      y1={barMidY}
                      x2={centerX + range.maxCall * scale}
                      y2={barMidY}
                      stroke="#2e90fa"
                      strokeWidth="2"
                      opacity="0.25"
                    />
                  )}
                  {/* Put side range (left of center) — putGex is negative */}
                  {range.minPut < 0 && (
                    <line
                      x1={centerX + range.minPut * scale}
                      y1={barMidY}
                      x2={centerX + Math.max(range.maxPut, s.putGex) * scale}
                      y2={barMidY}
                      stroke="#667085"
                      strokeWidth="2"
                      opacity="0.25"
                    />
                  )}
                </>
              )}

              {/* Put bar (gray, extends left from center) */}
              {putWidth > 0 && (
                <rect
                  x={centerX - putWidth}
                  y={y}
                  width={putWidth}
                  height={barHeight}
                  rx="2"
                  fill="#667085"
                  opacity="0.85"
                />
              )}

              {/* Call bar (blue, extends right from center) */}
              {callWidth > 0 && (
                <rect
                  x={centerX}
                  y={y}
                  width={callWidth}
                  height={barHeight}
                  rx="2"
                  fill="#2e90fa"
                  opacity="0.85"
                />
              )}
            </g>
          )
        })}

        {/* Call Wall line */}
        {callWallY != null && (
          <>
            <line
              x1={chartLeft}
              y1={callWallY}
              x2={svgWidth - rightPad}
              y2={callWallY}
              stroke="#f79009"
              strokeWidth="1.5"
              strokeDasharray="6 3"
            />
            <text
              x={svgWidth - rightPad - 2}
              y={callWallY - 5}
              fill="#f79009"
              fontSize="10"
              fontWeight="600"
              textAnchor="end"
            >
              CW {formatNumber(levels.callWall)}
            </text>
          </>
        )}

        {/* Put Wall line */}
        {putWallY != null && (
          <>
            <line
              x1={chartLeft}
              y1={putWallY}
              x2={svgWidth - rightPad}
              y2={putWallY}
              stroke="#f04438"
              strokeWidth="1.5"
              strokeDasharray="6 3"
            />
            <text
              x={svgWidth - rightPad - 2}
              y={putWallY + 13}
              fill="#f04438"
              fontSize="10"
              fontWeight="600"
              textAnchor="end"
            >
              PW {formatNumber(levels.putWall)}
            </text>
          </>
        )}

        {/* SPX price line */}
        {spotY != null && (
          <>
            <line
              x1={chartLeft}
              y1={spotY}
              x2={svgWidth - rightPad}
              y2={spotY}
              stroke="#53b1fd"
              strokeWidth="1.5"
              strokeDasharray="6 3"
            />
            <text
              x={svgWidth - rightPad - 2}
              y={spotY - 5}
              fill="#53b1fd"
              fontSize="10"
              fontWeight="600"
              textAnchor="end"
            >
              SPX {formatNumber(spotPrice)}
            </text>
          </>
        )}
      </svg>
    </div>
  )
}
