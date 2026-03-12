import { contextBridge, ipcRenderer } from 'electron'

const api = {
  fetchGex: (): Promise<unknown> => ipcRenderer.invoke('fetch-gex'),
  fetchGexHistory: (date: string): Promise<unknown> => ipcRenderer.invoke('fetch-gex-history', date),
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke('window-minimize'),
  closeWindow: (): Promise<void> => ipcRenderer.invoke('window-close')
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
