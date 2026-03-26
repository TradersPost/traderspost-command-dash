import { useState } from 'react'
import { PolymarketTitleBar } from './components/PolymarketTitleBar'
import { TrendSignalDisplay } from './components/TrendSignal'
import { OutcomeChart } from './components/OutcomeChart'
import { EventFooter } from './components/EventFooter'
import { PolyScrubber } from './components/PolyScrubber'
import { WebhookSettingsPanel } from './components/WebhookSettings'
import { usePolymarketData } from './hooks/usePolymarketData'

function LoadingSkeleton() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      <span className="text-text-dim text-xs">Loading market data...</span>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="text-put-wall text-sm font-medium">Error</span>
      <span className="text-text-dim text-xs leading-relaxed">{message}</span>
      <button
        onClick={onRetry}
        className="mt-2 rounded bg-bg-elevated px-4 py-1.5 text-xs text-text-secondary hover:bg-border transition-colors"
      >
        Retry
      </button>
    </div>
  )
}

export default function PolymarketApp() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const {
    data,
    nearest,
    activeOutcomes,
    activeTime,
    activeTimestamp,
    snapshots,
    snapshotCount,
    selectedIndex,
    setSelectedIndex,
    loading,
    error,
    slug,
    changeSlug,
    refetch
  } = usePolymarketData()

  return (
    <div className="flex h-full flex-col bg-bg-deep relative">
      <PolymarketTitleBar slug={slug} onChangeSlug={changeSlug} onOpenSettings={() => setSettingsOpen(true)} />
      <WebhookSettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {loading && <LoadingSkeleton />}

      {!loading && error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && data && (
        <>
          <TrendSignalDisplay
            signal={nearest.signal}
            upside={nearest.upside}
            downside={nearest.downside}
            upsideHistory={nearest.upsideHistory}
            downsideHistory={nearest.downsideHistory}
            currentTimestamp={activeTimestamp}
          />
          <OutcomeChart outcomes={activeOutcomes} />
          <div className="mt-auto">
            <EventFooter data={data} />
            <PolyScrubber
              activeTime={activeTime}
              snapshotCount={snapshotCount}
              selectedIndex={selectedIndex}
              onScrub={setSelectedIndex}
              snapshots={snapshots}
            />
          </div>
        </>
      )}
    </div>
  )
}
