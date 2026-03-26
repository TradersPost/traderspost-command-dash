import type { GammaNotionalData } from '../main/gex-calc'
import type { PolymarketEventData, PriceHistoryPoint } from '../main/polymarket-api'
import type { WebhookSettings } from '../main/index'

export interface HistorySnapshot {
  data: GammaNotionalData
  time: string
}

declare global {
  interface Window {
    api: {
      fetchGex: () => Promise<GammaNotionalData>
      fetchGexHistory: (date: string) => Promise<HistorySnapshot[]>
      minimizeWindow: () => Promise<void>
      closeWindow: () => Promise<void>
      fetchPolymarketEvent: (slug: string) => Promise<PolymarketEventData>
      getWebhookSettings: () => Promise<WebhookSettings>
      saveWebhookSettings: (settings: WebhookSettings) => Promise<void>
      fetchPriceHistory: (tokenId: string, interval?: string, fidelity?: number) => Promise<PriceHistoryPoint[]>
      minimizePolymarketWindow: () => Promise<void>
      closePolymarketWindow: () => Promise<void>
    }
  }
}
