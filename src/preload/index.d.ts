import type { GammaNotionalData } from '../main/gex-calc'

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
    }
  }
}
