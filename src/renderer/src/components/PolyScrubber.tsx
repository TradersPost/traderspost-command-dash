import { useRef, useCallback, useMemo } from 'react'
import type { PolySnapshot } from '../hooks/usePolymarketData'

interface PolyScrubberProps {
  activeTime: string | null
  snapshotCount: number
  selectedIndex: number
  onScrub: (index: number) => void
  snapshots: PolySnapshot[]
}

interface DayMarker {
  position: number // 0-1
  label: string // "Mar 10"
}

export function PolyScrubber({
  activeTime,
  snapshotCount,
  selectedIndex,
  onScrub,
  snapshots
}: PolyScrubberProps) {
  const trackRef = useRef<HTMLDivElement>(null)

  const resolveIndex = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track || snapshotCount <= 1) return 0
      const rect = track.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      return Math.round(ratio * (snapshotCount - 1))
    },
    [snapshotCount]
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (snapshotCount <= 1) return
      e.currentTarget.setPointerCapture(e.pointerId)
      onScrub(resolveIndex(e.clientX))
    },
    [snapshotCount, onScrub, resolveIndex]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (snapshotCount <= 1) return
      if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return
      onScrub(resolveIndex(e.clientX))
    },
    [snapshotCount, onScrub, resolveIndex]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    },
    []
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (snapshotCount <= 1) return
      e.preventDefault()
      const direction = (e.deltaY || e.deltaX) > 0 ? 1 : -1
      // Step ~2% of the bar per wheel tick
      const step = Math.max(1, Math.round(snapshotCount * 0.02))
      const next = Math.max(0, Math.min(snapshotCount - 1, selectedIndex + direction * step))
      onScrub(next)
    },
    [snapshotCount, selectedIndex, onScrub]
  )

  // Find day boundaries for tick marks, thinned to avoid overlap
  const dayMarkers = useMemo((): DayMarker[] => {
    if (snapshots.length < 2) return []

    // Collect all day boundaries
    const allBoundaries: DayMarker[] = []
    let prevDate = ''

    for (let i = 0; i < snapshots.length; i++) {
      const dt = new Date(snapshots[i]!.timestamp * 1000)
      const dateStr = dt.toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        month: 'numeric',
        day: 'numeric'
      })

      if (dateStr !== prevDate) {
        prevDate = dateStr
        if (i > 0) {
          allBoundaries.push({
            position: i / (snapshots.length - 1),
            label: dateStr
          })
        }
      }
    }

    // Thin out: only keep markers that are far enough apart (min ~12% spacing)
    const minGap = 0.12
    const thinned: DayMarker[] = []
    let lastMonth = ''
    for (const m of allBoundaries) {
      if (m.position < 0.04 || m.position > 0.96) continue
      if (thinned.length === 0 || m.position - thinned[thinned.length - 1]!.position >= minGap) {
        // Only show month prefix on the first occurrence of that month
        const parts = m.label.split('/')
        const month = parts[0]!
        const day = parts[1]!
        if (month !== lastMonth) {
          lastMonth = month
          m.label = `${month}/${day}`
        } else {
          m.label = day
        }
        thinned.push(m)
      }
    }

    return thinned
  }, [snapshots])

  // Format the active timestamp as a full date+time for display
  const activeLabel = useMemo(() => {
    if (!activeTime) return 'Live'
    if (snapshots.length === 0 || selectedIndex < 0) return activeTime

    const snap = snapshots[selectedIndex]
    if (!snap) return activeTime

    const dt = new Date(snap.timestamp * 1000)
    const date = dt.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric'
    })
    return `${date} ${activeTime}`
  }, [activeTime, snapshots, selectedIndex])

  const progress =
    snapshotCount > 1 ? selectedIndex / (snapshotCount - 1) : snapshotCount === 1 ? 1 : 0

  if (snapshotCount === 0) return null

  return (
    <div className="mx-3 mb-3">
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-text-dim font-mono shrink-0 w-[100px]">
          {activeLabel}
        </span>
        <div
          ref={trackRef}
          className="flex-1 relative cursor-pointer pt-4 pb-2"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
          style={{ touchAction: 'none' }}
        >
          {/* Day marker ticks + labels above the track */}
          {dayMarkers.map((marker, i) => (
            <div
              key={i}
              className="absolute"
              style={{ left: `${marker.position * 100}%`, top: 0 }}
            >
              <span
                className="absolute text-[8px] text-text-dim font-mono -translate-x-1/2 whitespace-nowrap"
                style={{ top: '-2px' }}
              >
                {marker.label}
              </span>
            </div>
          ))}

          {/* Track background */}
          <div className="h-2 bg-bg-elevated rounded-full overflow-hidden relative">
            {/* Day boundary tick marks on the track */}
            {dayMarkers.map((marker, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 w-px bg-text-dim opacity-40"
                style={{ left: `${marker.position * 100}%` }}
              />
            ))}

            {/* Progress fill */}
            <div
              className="h-full bg-accent rounded-full transition-[width] duration-200 relative z-10"
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          {/* Thumb */}
          <div
            className="absolute -translate-y-1/2 w-3.5 h-3.5 bg-accent rounded-full border-2 border-bg-deep shadow-[0_0_6px_rgba(46,144,250,0.4)] transition-[left] duration-200 z-20"
            style={{ left: `calc(${progress * 100}% - 7px)`, top: 'calc(1rem + 4px)' }}
          />
        </div>
        <span className="text-[11px] text-text-dim font-mono shrink-0">
          {selectedIndex + 1}/{snapshotCount}
        </span>
      </div>
    </div>
  )
}
