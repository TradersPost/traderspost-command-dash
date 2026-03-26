/**
 * Scheduled webhook signal based on Polymarket sentiment.
 * At a configured time (default 9:30 AM ET), evaluates the crowd sentiment
 * and sends a buy/sell webhook to TradersPost if decidedly bullish or bearish.
 */
import axios from 'axios'
import { fetchPolymarketEvent, fetchOutcomePrices, type PolymarketOutcome } from './polymarket-api'

const CHECK_INTERVAL = 60 * 1000 // check every 60 seconds

function getETTime(): { hours: number; minutes: number; dateStr: string } {
  const now = new Date()
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  return {
    hours: et.getHours(),
    minutes: et.getMinutes(),
    dateStr: et.toLocaleDateString('en-CA') // YYYY-MM-DD
  }
}

function deriveTrend(
  upProb: number,
  downProb: number,
  threshold: number
): 'bullish' | 'bearish' | 'neutral' {
  const diff = upProb - downProb
  if (diff > threshold) return 'bullish'
  if (diff < -threshold) return 'bearish'
  return 'neutral'
}

function findNearestTargets(outcomes: PolymarketOutcome[]): {
  upside: PolymarketOutcome | null
  downside: PolymarketOutcome | null
} {
  const activeUp = outcomes
    .filter((o) => o.direction === 'up' && !o.closed)
    .sort((a, b) => a.targetPrice - b.targetPrice)
  const activeDown = outcomes
    .filter((o) => o.direction === 'down' && !o.closed)
    .sort((a, b) => b.targetPrice - a.targetPrice)

  return {
    upside: activeUp[0] || null,
    downside: activeDown[0] || null
  }
}

export function startSignalScheduler(): void {
  const enabled = process.env.WEBHOOK_SIGNAL_ENABLED === 'true'
  const webhookUrl = process.env.TRADERSPOST_WEBHOOK_URL || ''
  const buyMessage = process.env.TRADERSPOST_WEBHOOK_BUY_MESSAGE || '{"action":"buy"}'
  const sellMessage = process.env.TRADERSPOST_WEBHOOK_SELL_MESSAGE || '{"action":"sell"}'
  const signalTime = process.env.WEBHOOK_SIGNAL_TIME || '09:30'
  const threshold = parseFloat(process.env.WEBHOOK_SIGNAL_THRESHOLD || '0.10')
  const slug = process.env.POLYMARKET_EVENT_SLUG || ''

  if (!enabled) {
    console.log('[Signal] Webhook signal disabled (WEBHOOK_SIGNAL_ENABLED != true)')
    return
  }

  if (!webhookUrl) {
    console.log('[Signal] No TRADERSPOST_WEBHOOK_URL configured — signal disabled')
    return
  }

  if (!slug) {
    console.log('[Signal] No POLYMARKET_EVENT_SLUG configured — signal disabled')
    return
  }

  const [targetHour, targetMinute] = signalTime.split(':').map(Number) as [number, number]
  let lastFiredDate = ''

  console.log(`[Signal] Scheduler active — will fire at ${signalTime} ET for event "${slug}"`)
  console.log(`[Signal] Threshold: ${(threshold * 100).toFixed(0)}% | Webhook: ${webhookUrl.substring(0, 50)}...`)

  setInterval(async () => {
    const { hours, minutes, dateStr } = getETTime()

    // Check if it's time and we haven't fired today
    if (hours !== targetHour || minutes !== targetMinute) return
    if (lastFiredDate === dateStr) return

    lastFiredDate = dateStr
    console.log(`[Signal] ${dateStr} ${signalTime} ET — evaluating Polymarket sentiment...`)

    try {
      // Fetch fresh data
      const data = await fetchPolymarketEvent(slug)

      // Enrich with live CLOB prices
      const activeTokenIds = data.outcomes
        .filter((o) => !o.closed)
        .map((o) => o.clobTokenId)
        .filter(Boolean)

      if (activeTokenIds.length > 0) {
        const prices = await fetchOutcomePrices(activeTokenIds)
        for (const outcome of data.outcomes) {
          const mid = prices.get(outcome.clobTokenId)
          if (mid !== undefined) {
            outcome.probability = mid
          }
        }
      }

      // Find nearest targets and compute signal
      const { upside, downside } = findNearestTargets(data.outcomes)
      const upProb = upside?.probability ?? 0
      const downProb = downside?.probability ?? 0
      const signal = deriveTrend(upProb, downProb, threshold)

      console.log(
        `[Signal] Upside ${upside?.label ?? 'none'}: ${(upProb * 100).toFixed(1)}% | ` +
        `Downside ${downside?.label ?? 'none'}: ${(downProb * 100).toFixed(1)}% | ` +
        `Signal: ${signal.toUpperCase()}`
      )

      if (signal === 'bullish') {
        let payload: unknown
        try {
          payload = JSON.parse(buyMessage)
        } catch {
          payload = buyMessage
        }
        await axios.post(webhookUrl, payload, { timeout: 10000 })
        console.log(`[Signal] BUY webhook sent to TradersPost`)
      } else if (signal === 'bearish') {
        let payload: unknown
        try {
          payload = JSON.parse(sellMessage)
        } catch {
          payload = sellMessage
        }
        await axios.post(webhookUrl, payload, { timeout: 10000 })
        console.log(`[Signal] SELL webhook sent to TradersPost`)
      } else {
        console.log(`[Signal] NEUTRAL — no webhook sent`)
      }
    } catch (err) {
      console.error('[Signal] Error evaluating signal:', err instanceof Error ? err.message : err)
    }
  }, CHECK_INTERVAL)
}
