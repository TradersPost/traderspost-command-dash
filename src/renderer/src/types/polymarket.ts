export interface PolymarketOutcome {
  marketId: string
  label: string
  direction: 'up' | 'down'
  targetPrice: number
  probability: number
  volume: number
  closed: boolean
  closedTime: number | null
  lastTradePrice: number
  bestBid: number
  bestAsk: number
}

export interface PriceHistoryPoint {
  t: number
  p: number
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
