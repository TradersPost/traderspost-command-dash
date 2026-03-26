/**
 * Polymarket API client.
 * Uses the public Gamma API for event/market metadata and CLOB API for live prices.
 */
import axios from 'axios'

const GAMMA_API = 'https://gamma-api.polymarket.com'
const CLOB_API = 'https://clob.polymarket.com'

export interface PolymarketOutcome {
  marketId: string
  label: string
  direction: 'up' | 'down'
  targetPrice: number
  probability: number
  volume: number
  closed: boolean
  closedTime: number | null // unix seconds
  clobTokenId: string
  lastTradePrice: number
  bestBid: number
  bestAsk: number
}

export interface PolymarketEventData {
  eventId: string
  title: string
  slug: string
  endDate: string
  outcomes: PolymarketOutcome[]
  totalVolume: number
  lastUpdated: string
}

interface GammaMarket {
  id: string
  question: string
  groupItemTitle?: string
  outcomes?: string // JSON string like '["Yes", "No"]' or '["Up", "Down"]'
  outcomePrices: string // JSON string like '["0.5", "0.5"]'
  volume?: string | number
  closed?: boolean
  closedTime?: string // e.g. "2026-03-10 16:33:05+00"
  clobTokenIds?: string // JSON string like '["token1", "token2"]'
  lastTradePrice?: number
  bestBid?: number
  bestAsk?: number
  endDate?: string
}

interface GammaEvent {
  id: string
  title: string
  slug: string
  endDate: string
  volume: number
  markets: GammaMarket[]
}

function parseOutcomes(market: GammaMarket): PolymarketOutcome[] {
  const vol = typeof market.volume === 'string' ? parseFloat(market.volume) : (market.volume || 0)

  let closedTime: number | null = null
  if (market.closedTime) {
    const parsed = new Date(market.closedTime)
    if (!isNaN(parsed.getTime())) {
      closedTime = Math.floor(parsed.getTime() / 1000)
    }
  }

  let prices: string[] = []
  try {
    prices = JSON.parse(market.outcomePrices) as string[]
  } catch {
    /* ignore */
  }

  let tokens: string[] = []
  try {
    tokens = JSON.parse(market.clobTokenIds || '[]') as string[]
  } catch {
    /* ignore */
  }

  let outcomeLabels: string[] = []
  try {
    outcomeLabels = JSON.parse(market.outcomes || '[]') as string[]
  } catch {
    /* ignore */
  }

  // Multi-outcome strike market: groupItemTitle like "↑ 22050" or "↓ 18975"
  const label = market.groupItemTitle || ''
  const strikeMatch = label.match(/([↑↓])\s*([\d.]+)/)
  if (strikeMatch) {
    return [{
      marketId: market.id,
      label,
      direction: strikeMatch[1] === '↑' ? 'up' : 'down',
      targetPrice: parseFloat(strikeMatch[2]!),
      probability: parseFloat(prices[0] || '0'),
      volume: vol,
      closed: market.closed ?? false,
      closedTime,
      clobTokenId: tokens[0] || '',
      lastTradePrice: market.lastTradePrice ?? 0,
      bestBid: market.bestBid ?? 0,
      bestAsk: market.bestAsk ?? 0
    }]
  }

  // Binary Up/Down market: outcomes = ["Up", "Down"]
  const results: PolymarketOutcome[] = []
  for (let i = 0; i < outcomeLabels.length; i++) {
    const name = outcomeLabels[i]!
    const isUp = /up|yes|bull|over|above/i.test(name)
    const isDown = /down|no|bear|under|below/i.test(name)
    const direction: 'up' | 'down' = isDown ? 'down' : 'up'

    results.push({
      marketId: `${market.id}-${i}`,
      label: name,
      direction,
      targetPrice: isUp ? 1 : 0, // no specific price target
      probability: parseFloat(prices[i] || '0'),
      volume: vol,
      closed: market.closed ?? false,
      closedTime,
      clobTokenId: tokens[i] || '',
      lastTradePrice: market.lastTradePrice ?? 0,
      bestBid: market.bestBid ?? 0,
      bestAsk: market.bestAsk ?? 0
    })
  }

  return results
}

export async function fetchPolymarketEvent(slug: string): Promise<PolymarketEventData> {
  const response = await axios.get<GammaEvent[]>(`${GAMMA_API}/events`, {
    params: { slug },
    timeout: 15000
  })

  const event = response.data[0]
  if (!event) {
    throw new Error(`No Polymarket event found for slug: ${slug}`)
  }

  const outcomes: PolymarketOutcome[] = []
  for (const market of event.markets) {
    outcomes.push(...parseOutcomes(market))
  }

  // Sort: upside targets descending, then downside targets ascending
  const upside = outcomes.filter((o) => o.direction === 'up').sort((a, b) => b.targetPrice - a.targetPrice)
  const downside = outcomes.filter((o) => o.direction === 'down').sort((a, b) => a.targetPrice - b.targetPrice)

  return {
    eventId: event.id,
    title: event.title,
    slug: event.slug,
    endDate: event.endDate,
    outcomes: [...upside, ...downside],
    totalVolume: event.volume,
    lastUpdated: new Date().toISOString()
  }
}

export async function fetchOutcomePrices(
  tokenIds: string[]
): Promise<Map<string, number>> {
  const prices = new Map<string, number>()
  if (tokenIds.length === 0) return prices

  const results = await Promise.allSettled(
    tokenIds.map(async (id) => {
      const response = await axios.get<{ mid: string }>(`${CLOB_API}/midpoint`, {
        params: { token_id: id },
        timeout: 10000
      })
      return { id, mid: parseFloat(response.data.mid || '0') }
    })
  )

  for (const result of results) {
    if (result.status === 'fulfilled') {
      prices.set(result.value.id, result.value.mid)
    }
  }

  return prices
}

export interface PriceHistoryPoint {
  t: number // unix timestamp
  p: number // probability 0-1
}

export async function fetchPriceHistory(
  tokenId: string,
  interval: string = 'max',
  fidelity: number = 60
): Promise<PriceHistoryPoint[]> {
  const response = await axios.get<{ history: PriceHistoryPoint[] }>(
    `${CLOB_API}/prices-history`,
    {
      params: { market: tokenId, interval, fidelity },
      timeout: 15000
    }
  )
  return response.data.history || []
}
