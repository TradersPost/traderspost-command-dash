import { useRef, useCallback } from 'react'

interface ProgressBarProps {
  activeTime: string | null
  snapshotCount: number
  selectedIndex: number
  onScrub: (index: number) => void
  isMarketOpen: boolean
  viewDateLabel: string
  canGoForward: boolean
  onPrevDay: () => void
  onNextDay: () => void
}

export function ProgressBar({
  activeTime,
  snapshotCount,
  selectedIndex,
  onScrub,
  isMarketOpen,
  viewDateLabel,
  canGoForward,
  onPrevDay,
  onNextDay
}: ProgressBarProps) {
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

  const progress =
    snapshotCount > 1 ? selectedIndex / (snapshotCount - 1) : snapshotCount === 1 ? 1 : 0

  return (
    <div className="mx-3 mt-3 mb-3 space-y-1.5">
      {/* Day navigation */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={onPrevDay}
          className="flex h-5 w-5 items-center justify-center rounded text-text-dim hover:bg-bg-elevated hover:text-text-secondary"
        >
          <svg width="8" height="10" viewBox="0 0 8 10" fill="currentColor">
            <path d="M7 0.5L1 5L7 9.5V0.5Z" />
          </svg>
        </button>
        <span className="text-[11px] text-text-secondary font-medium min-w-[48px] text-center">
          {viewDateLabel}
        </span>
        <button
          onClick={onNextDay}
          disabled={!canGoForward}
          className="flex h-5 w-5 items-center justify-center rounded text-text-dim hover:bg-bg-elevated hover:text-text-secondary disabled:opacity-30 disabled:pointer-events-none"
        >
          <svg width="8" height="10" viewBox="0 0 8 10" fill="currentColor">
            <path d="M1 0.5L7 5L1 9.5V0.5Z" />
          </svg>
        </button>
      </div>
      {/* Scrubber */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-text-dim font-mono shrink-0">
          {activeTime ?? '--:--'}
        </span>
        <div
          ref={trackRef}
          className="flex-1 relative cursor-pointer py-2"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ touchAction: 'none' }}
        >
          {/* Track background */}
          <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-[width] duration-200"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-accent rounded-full border-2 border-bg-deep shadow-[0_0_6px_rgba(46,144,250,0.4)] transition-[left] duration-200"
            style={{ left: `calc(${progress * 100}% - 7px)` }}
          />
        </div>
        <span className="text-[11px] text-text-dim font-mono shrink-0">
          {snapshotCount > 0
            ? `${selectedIndex + 1}/${snapshotCount}`
            : isMarketOpen
              ? '0/0'
              : 'Closed'}
        </span>
      </div>
    </div>
  )
}
