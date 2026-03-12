/**
 * GEX calculation engine.
 * Ported from sacred-profit-pro/apps/api/src/gamma/gamma.service.ts
 */
import { bsDelta, calcGammaExposure, type GammaProfilePoint } from './black-scholes'
import type { MassiveOptionSnapshot } from './api'

const STRIKE_ROUND = 25
const MAX_STRIKES = 30
const RISK_FREE_RATE = 0.0435
const DIVIDEND_YIELD = 0
const PROFILE_LEVELS = 60
const PROFILE_RANGE = 0.08

export interface StrikeGex {
  strike: number
  callGex: number
  putGex: number
  netGex: number
}

export interface GammaLevels {
  callWall: number
  putWall: number
}

export interface GammaNotionalData {
  gammaNotional: number
  callGamma: number
  putGamma: number
  spotPrice: number
  contractsAnalyzed: number
  lastUpdated: string
  levels: GammaLevels
  strikeProfile: StrikeGex[]
  impliedVol: number
  gammaProfile: GammaProfilePoint[]
  dealerDelta: number
}

export function calculateGammaNotional(
  contracts: MassiveOptionSnapshot[],
  spotPrice: number
): GammaNotionalData {
  let callGamma = 0
  let putGamma = 0
  let contractsAnalyzed = 0
  let ivWeightedSum = 0
  let ivWeightTotal = 0
  const strikeMap = new Map<number, { callGex: number; putGex: number }>()

  for (const contract of contracts) {
    if (!contract.greeks?.gamma || !contract.open_interest || !contract.details) {
      continue
    }

    const gamma = contract.greeks.gamma
    const oi = contract.open_interest
    const shares = contract.details.shares_per_contract || 100
    const gex = gamma * oi * shares * spotPrice * spotPrice * 0.01
    contractsAnalyzed++

    // OI-weighted implied volatility — ATM only (within 2% of spot)
    if (
      contract.implied_volatility &&
      contract.implied_volatility > 0 &&
      Math.abs(contract.details.strike_price - spotPrice) / spotPrice <= 0.02
    ) {
      ivWeightedSum += contract.implied_volatility * oi
      ivWeightTotal += oi
    }

    const isCall = contract.details.contract_type === 'call'
    if (isCall) {
      callGamma += gex
    } else if (contract.details.contract_type === 'put') {
      putGamma -= gex
    }

    // Group by rounded strike
    const rounded = Math.round(contract.details.strike_price / STRIKE_ROUND) * STRIKE_ROUND
    const existing = strikeMap.get(rounded) || { callGex: 0, putGex: 0 }
    if (isCall) {
      existing.callGex += gex
    } else {
      existing.putGex -= gex
    }
    strikeMap.set(rounded, existing)
  }

  // Build strike profile
  const allStrikes: StrikeGex[] = Array.from(strikeMap.entries()).map(
    ([strike, { callGex, putGex }]) => ({
      strike,
      callGex,
      putGex,
      netGex: callGex + putGex
    })
  )

  const nearSpot = allStrikes.filter(
    (s) => s.strike >= spotPrice * 0.85 && s.strike <= spotPrice * 1.15
  )

  const strikeProfile = nearSpot
    .sort((a, b) => Math.abs(b.netGex) - Math.abs(a.netGex))
    .slice(0, MAX_STRIKES)
    .sort((a, b) => a.strike - b.strike)

  const levels = deriveKeyLevels(allStrikes, spotPrice)

  // Build gamma exposure profile via Black-Scholes recalculation
  const gammaProfile = buildGammaProfile(contracts, spotPrice, new Date())

  const impliedVol = ivWeightTotal > 0 ? ivWeightedSum / ivWeightTotal : 0
  const dealerDelta = computeDealerDelta(contracts, spotPrice, new Date())

  return {
    gammaNotional: callGamma + putGamma,
    callGamma,
    putGamma,
    spotPrice,
    contractsAnalyzed,
    lastUpdated: new Date().toISOString(),
    levels,
    strikeProfile,
    impliedVol,
    gammaProfile,
    dealerDelta
  }
}

function deriveKeyLevels(strikes: StrikeGex[], spotPrice: number): GammaLevels {
  if (strikes.length === 0) {
    return { callWall: 0, putWall: 0 }
  }

  const callCandidates = strikes.filter((s) => s.strike >= spotPrice)
  const putCandidates = strikes.filter((s) => s.strike <= spotPrice)

  let callWall = (callCandidates[0] ?? strikes[0])!
  let putWall = (putCandidates[0] ?? strikes[0])!

  for (const s of callCandidates) {
    if (s.callGex > callWall.callGex) callWall = s
  }
  for (const s of putCandidates) {
    if (s.putGex < putWall.putGex) putWall = s
  }

  return {
    callWall: callWall.strike,
    putWall: putWall.strike
  }
}

function buildGammaProfile(
  contracts: MassiveOptionSnapshot[],
  spotPrice: number,
  now: Date
): GammaProfilePoint[] {
  const fromPrice = spotPrice * (1 - PROFILE_RANGE)
  const toPrice = spotPrice * (1 + PROFILE_RANGE)
  const step = (toPrice - fromPrice) / (PROFILE_LEVELS - 1)

  const contractData: Array<{
    strike: number
    vol: number
    T: number
    optType: 'call' | 'put'
    oi: number
    shares: number
  }> = []

  for (const contract of contracts) {
    if (!contract.details || !contract.open_interest || !contract.implied_volatility) {
      continue
    }
    if (contract.implied_volatility <= 0) continue

    const expDate = new Date(contract.details.expiration_date + 'T16:00:00')
    const T = (expDate.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    if (T <= 0) continue

    const optType = contract.details.contract_type as 'call' | 'put'
    if (optType !== 'call' && optType !== 'put') continue

    contractData.push({
      strike: contract.details.strike_price,
      vol: contract.implied_volatility,
      T,
      optType,
      oi: contract.open_interest,
      shares: contract.details.shares_per_contract || 100
    })
  }

  const profile: GammaProfilePoint[] = []
  for (let i = 0; i < PROFILE_LEVELS; i++) {
    const S = fromPrice + i * step
    let callGex = 0
    let putGex = 0

    for (const c of contractData) {
      const gex = calcGammaExposure(S, c.strike, c.vol, c.T, RISK_FREE_RATE, DIVIDEND_YIELD, c.oi, c.shares)

      if (c.optType === 'call') {
        callGex += gex
      } else {
        putGex -= gex
      }
    }

    profile.push({
      spotLevel: Math.round(S),
      totalGex: callGex + putGex,
      callGex,
      putGex
    })
  }

  return profile
}

function computeDealerDelta(
  contracts: MassiveOptionSnapshot[],
  spotPrice: number,
  now: Date
): number {
  let totalDelta = 0

  for (const contract of contracts) {
    if (!contract.details || !contract.open_interest || !contract.implied_volatility) {
      continue
    }
    if (contract.implied_volatility <= 0) continue

    const expDate = new Date(contract.details.expiration_date + 'T16:00:00')
    const T = (expDate.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    if (T <= 0) continue

    const optType = contract.details.contract_type as 'call' | 'put'
    if (optType !== 'call' && optType !== 'put') continue

    const delta = bsDelta(
      spotPrice,
      contract.details.strike_price,
      contract.implied_volatility,
      T,
      RISK_FREE_RATE,
      DIVIDEND_YIELD,
      optType
    )
    const oi = contract.open_interest
    const shares = contract.details.shares_per_contract || 100
    const deltaDollar = oi * shares * spotPrice * delta

    if (optType === 'call') {
      totalDelta += deltaDollar
    } else {
      totalDelta -= deltaDollar
    }
  }

  return totalDelta
}
