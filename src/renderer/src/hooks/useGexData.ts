import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { GammaNotionalData } from '../types/gex'

const REFRESH_INTERVAL = 15 * 60 * 1000 // 15 minutes
const TODAY_KEY = '__today__'

function isMarketOpen(): boolean {
  const now = new Date()
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = et.getDay()
  if (day === 0 || day === 6) return false

  const minutes = et.getHours() * 60 + et.getMinutes()
  return minutes >= 570 && minutes <= 1080 // 9:30 AM - 6:00 PM ET
}

function getTodayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

function shiftTradingDay(dateStr: string, direction: -1 | 1): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + direction)
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + direction)
  }
  return d.toISOString().split('T')[0]!
}

function getPreviousTradingDay(): string {
  return shiftTradingDay(getTodayET(), -1)
}

export interface GexSnapshot {
  data: GammaNotionalData
  time: string
}

export function useGexData() {
  // All loaded data keyed by date (TODAY_KEY for live snapshots)
  const cache = useRef<Map<string, GexSnapshot[]>>(new Map())

  const [viewDate, setViewDate] = useState(getPreviousTradingDay)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Bumped to trigger re-renders when cache is updated
  const [revision, setRevision] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fetchingRef = useRef<Set<string>>(new Set())

  const today = getTodayET()
  const isViewingToday = viewDate === today

  // Get snapshots for the current view from cache
  const cacheKey = isViewingToday ? TODAY_KEY : viewDate
  const snapshots = cache.current.get(cacheKey) ?? []

  // Load historical snapshots for a date
  const loadHistory = useCallback(async (date: string) => {
    if (cache.current.has(date) || fetchingRef.current.has(date)) return
    fetchingRef.current.add(date)

    try {
      setLoading(true)
      const history = (await window.api.fetchGexHistory(date)) as GexSnapshot[]
      cache.current.set(date, history)
      console.log(`Loaded ${history.length} historical snapshots for ${date}`)
    } catch (err) {
      console.error('Failed to load history:', err)
      setError(`Failed to load ${date}`)
    } finally {
      fetchingRef.current.delete(date)
      setLoading(false)
      setRevision((r) => r + 1)
    }
  }, [])

  // Fetch live GEX data (appends to today's cache)
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = (await window.api.fetchGex()) as GammaNotionalData

      const now = new Date()
      const month = now.toLocaleString('en-US', { timeZone: 'America/New_York', month: 'numeric' })
      const day = now.toLocaleString('en-US', { timeZone: 'America/New_York', day: 'numeric' })
      const timeStr = now.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
      const time = `${month}/${day} ${timeStr}`

      const existing = cache.current.get(TODAY_KEY) ?? []
      cache.current.set(TODAY_KEY, [...existing, { data: result, time }])
      setSelectedIndex(-1)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch GEX data'
      setError(message)
      console.error('GEX fetch error:', err)
    } finally {
      setLoading(false)
      setRevision((r) => r + 1)
    }
  }, [])

  // Navigate to a different day
  const navigateDay = useCallback(
    (direction: -1 | 1) => {
      const nextDate = shiftTradingDay(viewDate, direction)
      if (nextDate > today) return
      setViewDate(nextDate)
      setSelectedIndex(-1)
      setError(null)
    },
    [viewDate, today]
  )

  // Load data when viewDate changes (skips if already cached)
  useEffect(() => {
    if (isViewingToday) {
      if (!cache.current.has(TODAY_KEY)) {
        fetchData()
      }
    } else {
      if (!cache.current.has(viewDate)) {
        loadHistory(viewDate)
      }
    }

    // Auto-refresh only when viewing today
    if (isViewingToday) {
      intervalRef.current = setInterval(() => {
        if (isMarketOpen()) {
          fetchData()
        }
      }, REFRESH_INTERVAL)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [viewDate, isViewingToday, fetchData, loadHistory])

  // Resolve which snapshot to display
  const activeIndex = selectedIndex === -1 ? snapshots.length - 1 : selectedIndex
  const activeSnapshot = snapshots[activeIndex] ?? null

  // Compute historical high/low ranges per strike across current day's snapshots
  const strikeRanges = useMemo(() => {
    const ranges = new Map<number, { minCall: number; maxCall: number; minPut: number; maxPut: number }>()
    for (const snapshot of snapshots) {
      for (const s of snapshot.data.strikeProfile) {
        const existing = ranges.get(s.strike)
        if (existing) {
          existing.minCall = Math.min(existing.minCall, s.callGex)
          existing.maxCall = Math.max(existing.maxCall, s.callGex)
          existing.minPut = Math.min(existing.minPut, s.putGex)
          existing.maxPut = Math.max(existing.maxPut, s.putGex)
        } else {
          ranges.set(s.strike, {
            minCall: s.callGex,
            maxCall: s.callGex,
            minPut: s.putGex,
            maxPut: s.putGex
          })
        }
      }
    }
    return ranges
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshots, revision])

  // Format viewDate for display
  const viewDateLabel = useMemo(() => {
    if (isViewingToday) return 'Today'
    const d = new Date(viewDate + 'T12:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }, [viewDate, isViewingToday])

  const canGoForward = viewDate < today

  return {
    data: activeSnapshot?.data ?? null,
    activeTime: activeSnapshot?.time ?? null,
    snapshots,
    selectedIndex: activeIndex,
    setSelectedIndex,
    viewDate,
    viewDateLabel,
    navigateDay,
    canGoForward,
    loading: loading && snapshots.length === 0,
    error,
    snapshotCount: snapshots.length,
    strikeRanges,
    isMarketOpen: isMarketOpen(),
    refetch: fetchData
  }
}
