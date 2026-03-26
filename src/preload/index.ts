import { contextBridge, ipcRenderer } from 'electron'

const api = {
  fetchGex: (): Promise<unknown> => ipcRenderer.invoke('fetch-gex'),
  fetchGexHistory: (date: string): Promise<unknown> => ipcRenderer.invoke('fetch-gex-history', date),
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke('window-minimize'),
  closeWindow: (): Promise<void> => ipcRenderer.invoke('window-close'),
  fetchPolymarketEvent: (slug: string): Promise<unknown> =>
    ipcRenderer.invoke('fetch-polymarket-event', slug),
  fetchPriceHistory: (tokenId: string, interval?: string, fidelity?: number): Promise<unknown> =>
    ipcRenderer.invoke('fetch-price-history', tokenId, interval, fidelity),
  getWebhookSettings: (): Promise<unknown> =>
    ipcRenderer.invoke('get-webhook-settings'),
  saveWebhookSettings: (settings: unknown): Promise<void> =>
    ipcRenderer.invoke('save-webhook-settings', settings),
  minimizePolymarketWindow: (): Promise<void> =>
    ipcRenderer.invoke('polymarket-window-minimize'),
  closePolymarketWindow: (): Promise<void> =>
    ipcRenderer.invoke('polymarket-window-close')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.api = api
}
