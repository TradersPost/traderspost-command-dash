import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { config } from 'dotenv'
import { fetchSpotPrice, fetchAllContracts, fetchIntradayBars } from './api'
import { calculateGammaNotional, type GammaNotionalData } from './gex-calc'
import {
  fetchPolymarketEvent,
  fetchOutcomePrices,
  fetchPriceHistory,
  type PolymarketEventData,
  type PriceHistoryPoint
} from './polymarket-api'
import { startSignalScheduler } from './signal-scheduler'

interface HistorySnapshot {
  data: GammaNotionalData
  time: string
}

// Load .env from project root
config({ path: join(app.getAppPath(), '.env') })
// Also try CWD for dev
config()

// Webhook settings config (persisted to userData)
export interface WebhookSettings {
  webhookUrl: string
  buyMessage: string
  sellMessage: string
  enabled: boolean
  signalTime: string
  threshold: number
}

const settingsPath = join(app.getPath('userData'), 'webhook-settings.json')

function readWebhookSettings(): WebhookSettings {
  const defaults: WebhookSettings = {
    webhookUrl: process.env.TRADERSPOST_WEBHOOK_URL || '',
    buyMessage: process.env.TRADERSPOST_WEBHOOK_BUY_MESSAGE || '{"action":"buy"}',
    sellMessage: process.env.TRADERSPOST_WEBHOOK_SELL_MESSAGE || '{"action":"sell"}',
    enabled: process.env.WEBHOOK_SIGNAL_ENABLED === 'true',
    signalTime: process.env.WEBHOOK_SIGNAL_TIME || '09:30',
    threshold: parseFloat(process.env.WEBHOOK_SIGNAL_THRESHOLD || '0.10')
  }

  if (existsSync(settingsPath)) {
    try {
      const saved = JSON.parse(readFileSync(settingsPath, 'utf-8'))
      return { ...defaults, ...saved }
    } catch {
      /* ignore */
    }
  }
  return defaults
}

function writeWebhookSettings(settings: WebhookSettings): void {
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
  // Also update process.env so the signal scheduler picks up changes
  process.env.TRADERSPOST_WEBHOOK_URL = settings.webhookUrl
  process.env.TRADERSPOST_WEBHOOK_BUY_MESSAGE = settings.buyMessage
  process.env.TRADERSPOST_WEBHOOK_SELL_MESSAGE = settings.sellMessage
  process.env.WEBHOOK_SIGNAL_ENABLED = settings.enabled ? 'true' : 'false'
  process.env.WEBHOOK_SIGNAL_TIME = settings.signalTime
  process.env.WEBHOOK_SIGNAL_THRESHOLD = String(settings.threshold)
}

// Apply saved settings to process.env on startup
const savedSettings = readWebhookSettings()
writeWebhookSettings(savedSettings)

// Local disk cache for GEX snapshots
const cacheDir = join(app.getPath('userData'), 'gex-cache')
if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true })

function cachePath(date: string): string {
  return join(cacheDir, `${date}.json`)
}

function readCache(date: string): HistorySnapshot[] | null {
  const p = cachePath(date)
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf-8'))
  } catch {
    return null
  }
}

function writeCache(date: string, snapshots: HistorySnapshot[]): void {
  try {
    writeFileSync(cachePath(date), JSON.stringify(snapshots))
  } catch (err) {
    console.error('Failed to write cache:', err)
  }
}

// Data cache
let dataCache: { data: GammaNotionalData; fetchedAt: number } | null = null
const DATA_CACHE_TTL = 15 * 60 * 1000 // 15 minutes

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 420,
    height: 680,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    minWidth: 360,
    minHeight: 500,
    backgroundColor: '#111927',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // IPC: fetch GEX data
  ipcMain.handle('fetch-gex', async () => {
    // Return cached data if fresh
    if (dataCache && Date.now() - dataCache.fetchedAt < DATA_CACHE_TTL) {
      return dataCache.data
    }

    const apiKey = process.env.MASSIVE_API_KEY
    if (!apiKey) {
      throw new Error('MASSIVE_API_KEY is not configured. Add it to .env file.')
    }

    const [spotPrice, contracts] = await Promise.all([
      fetchSpotPrice(apiKey),
      fetchAllContracts(apiKey)
    ])

    if (spotPrice === 0) {
      throw new Error('Could not determine SPX spot price')
    }

    const data = calculateGammaNotional(contracts, spotPrice)
    dataCache = { data, fetchedAt: Date.now() }
    return data
  })

  // IPC: fetch historical snapshots for a date — serves from disk cache if available
  ipcMain.handle('fetch-gex-history', async (_event, date: string) => {
    // Check disk cache first
    const cached = readCache(date)
    if (cached) {
      console.log(`Cache hit: ${cached.length} snapshots for ${date}`)
      return cached
    }

    const apiKey = process.env.MASSIVE_API_KEY
    if (!apiKey) {
      throw new Error('MASSIVE_API_KEY is not configured.')
    }

    // Fetch contracts first (cached after first load), then bars — avoids rate limit contention
    const contracts = await fetchAllContracts(apiKey)
    const bars = await fetchIntradayBars(apiKey, date)

    console.log(`History: ${bars.length} bars for ${date}, ${contracts.length} contracts`)

    const snapshots: HistorySnapshot[] = []
    for (const bar of bars) {
      const spotPrice = Math.round(bar.close * 10) // SPY × 10 ≈ SPX
      const data = calculateGammaNotional(contracts, spotPrice)

      const barDate = new Date(bar.timestamp)
      const month = barDate.toLocaleString('en-US', { timeZone: 'America/New_York', month: 'numeric' })
      const day = barDate.toLocaleString('en-US', { timeZone: 'America/New_York', day: 'numeric' })
      const timeStr = barDate.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
      const time = `${month}/${day} ${timeStr}`

      snapshots.push({ data, time })
    }

    // Save to disk cache for future app launches
    if (snapshots.length > 0) {
      writeCache(date, snapshots)
    }

    return snapshots
  })

  ipcMain.handle('window-minimize', () => {
    mainWindow.minimize()
  })

  ipcMain.handle('window-close', () => {
    mainWindow.close()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Polymarket data cache
let polyCache: { data: PolymarketEventData; fetchedAt: number } | null = null
const POLY_CACHE_TTL = 30 * 1000 // 30 seconds

function createPolymarketWindow(): void {
  const polyWindow = new BrowserWindow({
    width: 420,
    height: 520,
    x: 460,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    minWidth: 360,
    minHeight: 400,
    backgroundColor: '#111927',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  polyWindow.on('ready-to-show', () => {
    polyWindow.show()
  })

  ipcMain.handle('fetch-polymarket-event', async (_event, slug: string) => {
    // Return cached data if fresh and same slug
    if (polyCache && Date.now() - polyCache.fetchedAt < POLY_CACHE_TTL && polyCache.data.slug === slug) {
      return polyCache.data
    }

    const data = await fetchPolymarketEvent(slug)

    // Refresh live prices from CLOB API for active outcomes
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

    polyCache = { data, fetchedAt: Date.now() }
    return data
  })

  ipcMain.handle(
    'fetch-price-history',
    async (_event, tokenId: string, interval?: string, fidelity?: number) => {
      return fetchPriceHistory(tokenId, interval || 'max', fidelity || 60)
    }
  )

  ipcMain.handle('get-webhook-settings', () => {
    return readWebhookSettings()
  })

  ipcMain.handle('save-webhook-settings', (_event, settings: WebhookSettings) => {
    writeWebhookSettings(settings)
    console.log(`[Signal] Settings updated — enabled: ${settings.enabled}, time: ${settings.signalTime}`)
  })

  ipcMain.handle('polymarket-window-minimize', () => {
    polyWindow.minimize()
  })

  ipcMain.handle('polymarket-window-close', () => {
    polyWindow.close()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    polyWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/polymarket.html')
  } else {
    polyWindow.loadFile(join(__dirname, '../renderer/polymarket.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.traderspost.command-dash')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()
  createPolymarketWindow()
  startSignalScheduler()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
      createPolymarketWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
