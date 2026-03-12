/**
 * Massive.com API client for fetching SPX option chain data.
 * Ported from sacred-profit-pro/apps/api/src/gamma/gamma.service.ts
 */
import axios from 'axios'

const BASE_URL = 'https://api.massive.com'
const OPTIONS_SYMBOL = 'I:SPX'
const PAGE_LIMIT = 250
const MAX_PAGES = 60
const CONTRACT_CACHE_TTL = 60 * 60 * 1000 // 60 minutes
const PAGE_DELAY_MS = 250 // Delay between paginated requests to avoid rate limits
const MAX_RETRIES = 3

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const isRateLimit =
        err instanceof Error &&
        'response' in err &&
        (err as { response?: { status?: number } }).response?.status === 429
      if (isRateLimit && attempt < retries) {
        const waitMs = Math.pow(2, attempt + 1) * 1000 // 2s, 4s, 8s
        console.log(`Rate limited, waiting ${waitMs}ms before retry ${attempt + 1}/${retries}`)
        await delay(waitMs)
        continue
      }
      throw err
    }
  }
  throw new Error('Unreachable')
}

export interface MassiveGreeks {
  delta: number
  gamma: number
  theta: number
  vega: number
}

export interface MassiveOptionDetails {
  contract_type: string
  expiration_date: string
  strike_price: number
  shares_per_contract: number
  ticker: string
}

export interface MassiveOptionSnapshot {
  greeks?: MassiveGreeks
  open_interest?: number
  details?: MassiveOptionDetails
  underlying_asset?: { ticker: string }
  implied_volatility?: number
}

interface MassiveResponse {
  results?: MassiveOptionSnapshot[]
  status?: string
  request_id?: string
  next_url?: string
}

interface MassiveAggResponse {
  results?: { c: number; t?: number }[]
  status?: string
}

export interface IntradayBar {
  timestamp: number // unix ms
  close: number // SPY close
}

// Contract cache
let contractCache: { contracts: MassiveOptionSnapshot[]; fetchedAt: number } | null = null

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]!
}

function getMaxExpirationDate(maxDte: number = 45): string {
  const date = new Date()
  date.setDate(date.getDate() + maxDte)
  return date.toISOString().split('T')[0]!
}

export async function fetchSpotPrice(apiKey: string): Promise<number> {
  return fetchWithRetry(async () => {
    const response: { data: MassiveAggResponse } = await axios.get<MassiveAggResponse>(
      `${BASE_URL}/v2/aggs/ticker/SPY/prev`,
      {
        params: { apiKey },
        timeout: 10000
      }
    )

    const spyClose = response.data.results?.[0]?.c
    if (!spyClose) {
      return 0
    }

    return Math.round(spyClose * 10)
  })
}

export async function fetchAllContracts(apiKey: string): Promise<MassiveOptionSnapshot[]> {
  // Return cached contracts if still fresh
  if (contractCache && Date.now() - contractCache.fetchedAt < CONTRACT_CACHE_TTL) {
    console.log(
      `Using cached contracts: ${contractCache.contracts.length} (age ${Math.round((Date.now() - contractCache.fetchedAt) / 60000)}m)`
    )
    return contractCache.contracts
  }

  const maxExpDate = getMaxExpirationDate()
  const allContracts: MassiveOptionSnapshot[] = []
  let url: string | null =
    `${BASE_URL}/v3/snapshot/options/${OPTIONS_SYMBOL}` +
    `?expiration_date.gte=${getTodayDate()}` +
    `&expiration_date.lte=${maxExpDate}` +
    `&limit=${PAGE_LIMIT}`

  let page = 0
  while (url && page < MAX_PAGES) {
    if (page > 0) await delay(PAGE_DELAY_MS)

    const pageUrl = url
    const response = await fetchWithRetry(async () => {
      const res: { data: MassiveResponse } = await axios.get<MassiveResponse>(pageUrl, {
        params: pageUrl.includes('apiKey') ? undefined : { apiKey },
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 15000
      })
      return res
    })

    if (response.data.results) {
      allContracts.push(...response.data.results)
    }

    url = response.data.next_url || null
    if (url && !url.includes('apiKey')) {
      url += url.includes('?') ? `&` : `?`
      url += `apiKey=${apiKey}`
    }
    page++
  }

  console.log(`Fetched ${allContracts.length} contracts across ${page} page(s) for ${OPTIONS_SYMBOL}`)

  contractCache = { contracts: allContracts, fetchedAt: Date.now() }
  return allContracts
}

/**
 * Fetch 15-minute intraday SPY bars for a given date.
 * Returns timestamps + close prices that can be used to recalculate GEX at each point.
 */
export async function fetchIntradayBars(
  apiKey: string,
  date: string
): Promise<IntradayBar[]> {
  return fetchWithRetry(async () => {
    const url = `${BASE_URL}/v2/aggs/ticker/SPY/range/15/minute/${date}/${date}?adjusted=true&sort=asc&limit=50000&apiKey=${apiKey}`
    const response: { data: MassiveAggResponse } = await axios.get(url, { timeout: 30000 })
    const results = response.data.results || []

    return results
      .filter((r) => r.t != null)
      .map((r) => ({
        timestamp: r.t!,
        close: r.c
      }))
  })
}
