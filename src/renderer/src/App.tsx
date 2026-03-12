import { TitleBar } from './components/TitleBar'
import { GexChart } from './components/GexChart'
import { KeyMetrics } from './components/KeyMetrics'
import { ProgressBar } from './components/ProgressBar'
import { useGexData } from './hooks/useGexData'

function LoadingSkeleton() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      <span className="text-text-dim text-xs">Loading gamma data...</span>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="text-gex-negative text-sm font-medium">Error</span>
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

export default function App() {
  const {
    data,
    activeTime,
    loading,
    error,
    snapshotCount,
    selectedIndex,
    setSelectedIndex,
    strikeRanges,
    viewDateLabel,
    canGoForward,
    navigateDay,
    isMarketOpen,
    refetch
  } = useGexData()

  return (
    <div className="flex h-full flex-col bg-bg-deep">
      <TitleBar />

      {loading && <LoadingSkeleton />}

      {!loading && error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && data && (
        <>
          <GexChart
            strikeProfile={data.strikeProfile}
            spotPrice={data.spotPrice}
            levels={data.levels}
            strikeRanges={strikeRanges}
          />
          <KeyMetrics levels={data.levels} spotPrice={data.spotPrice} />
          <div className="mt-auto">
            <ProgressBar
              activeTime={activeTime}
              snapshotCount={snapshotCount}
              selectedIndex={selectedIndex}
              onScrub={setSelectedIndex}
              isMarketOpen={isMarketOpen}
              viewDateLabel={viewDateLabel}
              canGoForward={canGoForward}
              onPrevDay={() => navigateDay(-1)}
              onNextDay={() => navigateDay(1)}
            />
          </div>
        </>
      )}
    </div>
  )
}
