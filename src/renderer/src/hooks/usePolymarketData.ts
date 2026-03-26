import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { PolymarketEventData, PolymarketOutcome, PriceHistoryPoint } from '../types/polymarket'

const REFRESH_INTERVAL = 30 * 1000
const DEFAULT_SLUG = 'what-will-ndx-hit-in-march-2026'

export type TrendSignal = 'bullish' | 'bearish' | 'neutral'

export interface PolySnapshot {
  time: string // formatted time
  timestamp: number
  outcomes: PolymarketOutcome[] // outcomes with probabilities at this point in time
}

export interface NearestTargets {
  upside: PolymarketOutcome | null
  downside: PolymarketOutcome | null
  signal: TrendSignal
  upsideHistory: PriceHistoryPoint[]
  downsideHistory: PriceHistoryPoint[]
}

function deriveTrend(upProb: number, downProb: number): TrendSignal {
  const diff = upProb - downProb
  if (diff > 0.10) return 'bullish'
  if (diff < -0.10) return 'bearish'
  return 'neutral'
}

export function usePolymarketData() {
  const [data, setData] = useState<PolymarketEventData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [slug, setSlug] = useState(DEFAULT_SLUG)
  const [upsideHistory, setUpsideHistory] = useState<PriceHistoryPoint[]>([])
  const [downsideHistory, setDownsideHistory] = useState<PriceHistoryPoint[]>([])
  const [snapshots, setSnapshots] = useState<PolySnapshot[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1) // -1 = latest (live)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastHistoryTokens = useRef<{ up: string; down: string }>({ up: '', down: '' })
  const historyLoaded = useRef(false)

  const fetchData = useCallback(async (eventSlug: string) => {
    try {
      setError(null)
      const result = (await window.api.fetchPolymarketEvent(eventSlug)) as PolymarketEventData
      setData(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch Polymarket data'
      setError(message)
      console.error('Polymarket fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    historyLoaded.current = false
    fetchData(slug)

    intervalRef.current = setInterval(() => {
      fetchData(slug)
    }, REFRESH_INTERVAL)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [slug, fetchData])

  // Build time-aligned snapshots from price history for all active outcomes
  useEffect(() => {
    if (!data || historyLoaded.current) return
    historyLoaded.current = true

    const allWithTokens = data.outcomes.filter((o) => o.clobTokenId)
    if (allWithTokens.length === 0) return

    const loadSnapshots = async () => {
      // Fetch 1-day history for each active outcome (~30 points = ~50 min intervals)
      const historyMap = new Map<string, PriceHistoryPoint[]>()
      const results = await Promise.allSettled(
        allWithTokens.map(async (o) => {
          const h = (await window.api.fetchPriceHistory(o.clobTokenId, 'max', 200)) as PriceHistoryPoint[]
          return { tokenId: o.clobTokenId, history: h }
        })
      )

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.history.length > 0) {
          historyMap.set(r.value.tokenId, r.value.history)
        }
      }

      if (historyMap.size === 0) return

      // Collect all unique timestamps, sorted
      const allTimestamps = new Set<number>()
      for (const h of historyMap.values()) {
        for (const pt of h) allTimestamps.add(pt.t)
      }
      const timestamps = [...allTimestamps].sort((a, b) => a - b)

      // Build a snapshot at each timestamp
      const snaps: PolySnapshot[] = []
      for (const ts of timestamps) {
        const outcomesCopy: PolymarketOutcome[] = data.outcomes.map((o) => {
          const history = historyMap.get(o.clobTokenId)

          // Determine if this outcome was closed at this timestamp
          const wasClosed = o.closedTime != null && ts >= o.closedTime

          if (!history) return { ...o, closed: wasClosed }

          // Find the closest point at or before this timestamp
          let prob = o.probability
          for (let i = history.length - 1; i >= 0; i--) {
            if (history[i]!.t <= ts) {
              prob = history[i]!.p
              break
            }
          }
          return { ...o, probability: prob, closed: wasClosed }
        })

        const dt = new Date(ts * 1000)
        const time = dt.toLocaleTimeString('en-US', {
          timeZone: 'America/New_York',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })

        snaps.push({ time, timestamp: ts, outcomes: outcomesCopy })
      }

      setSnapshots(snaps)
    }

    loadSnapshots()
  }, [data])

  // Find nearest targets (based on active snapshot's outcomes)
  const activeIndex = selectedIndex === -1 ? snapshots.length - 1 : selectedIndex
  const activeOutcomes = snapshots.length > 0 && activeIndex >= 0
    ? snapshots[activeIndex]!.outcomes
    : data?.outcomes ?? []
  const activeTime = snapshots.length > 0 && activeIndex >= 0
    ? snapshots[activeIndex]!.time
    : null
  const activeTimestamp = snapshots.length > 0 && activeIndex >= 0
    ? snapshots[activeIndex]!.timestamp
    : null

  const nearest = useMemo((): NearestTargets => {
    if (activeOutcomes.length === 0) {
      return { upside: null, downside: null, signal: 'neutral', upsideHistory: [], downsideHistory: [] }
    }

    const activeUp = activeOutcomes
      .filter((o) => o.direction === 'up' && !o.closed)
      .sort((a, b) => a.targetPrice - b.targetPrice)
    const activeDown = activeOutcomes
      .filter((o) => o.direction === 'down' && !o.closed)
      .sort((a, b) => b.targetPrice - a.targetPrice)

    const upside = activeUp[0] || null
    const downside = activeDown[0] || null
    const signal = deriveTrend(upside?.probability ?? 0, downside?.probability ?? 0)

    return { upside, downside, signal, upsideHistory, downsideHistory }
  }, [activeOutcomes, upsideHistory, downsideHistory])

  // Fetch sparkline history when nearest targets change
  useEffect(() => {
    const upToken = nearest.upside?.clobTokenId || ''
    const downToken = nearest.downside?.clobTokenId || ''

    if (upToken && upToken !== lastHistoryTokens.current.up) {
      lastHistoryTokens.current.up = upToken
      window.api.fetchPriceHistory(upToken).then((h) => {
        setUpsideHistory(h as PriceHistoryPoint[])
      }).catch(() => setUpsideHistory([]))
    }

    if (downToken && downToken !== lastHistoryTokens.current.down) {
      lastHistoryTokens.current.down = downToken
      window.api.fetchPriceHistory(downToken).then((h) => {
        setDownsideHistory(h as PriceHistoryPoint[])
      }).catch(() => setDownsideHistory([]))
    }
  }, [nearest.upside?.clobTokenId, nearest.downside?.clobTokenId])

  const changeSlug = useCallback((newSlug: string) => {
    const cleaned = newSlug.trim()
    if (cleaned && cleaned !== slug) {
      setSlug(cleaned)
      setData(null)
      setLoading(true)
      setUpsideHistory([])
      setDownsideHistory([])
      setSnapshots([])
      setSelectedIndex(-1)
      lastHistoryTokens.current = { up: '', down: '' }
    }
  }, [slug])

  return {
    data,
    nearest,
    activeOutcomes,
    activeTime,
    activeTimestamp,
    snapshots,
    selectedIndex: activeIndex,
    setSelectedIndex,
    snapshotCount: snapshots.length,
    loading,
    error,
    slug,
    changeSlug,
    refetch: () => fetchData(slug)
  }
}
