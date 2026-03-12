/**
 * Black-Scholes math utilities for gamma exposure calculation.
 * Pure functions — no dependencies.
 * Ported from sacred-profit-pro/apps/api/src/gamma/black-scholes.ts
 */

export function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

export function normalCdf(x: number): number {
  if (x < 0) return 1 - normalCdf(-x)

  const b1 = 0.31938153
  const b2 = -0.356563782
  const b3 = 1.781477937
  const b4 = -1.821255978
  const b5 = 1.330274429
  const p = 0.2316419

  const t = 1.0 / (1.0 + p * x)
  const poly = ((((b5 * t + b4) * t + b3) * t + b2) * t + b1) * t

  return 1.0 - normalPdf(x) * poly
}

export function bsGamma(
  S: number,
  K: number,
  vol: number,
  T: number,
  r: number,
  q: number
): number {
  if (T <= 0 || vol <= 0 || S <= 0 || K <= 0) return 0

  const sqrtT = Math.sqrt(T)
  const dp = (Math.log(S / K) + (r - q + 0.5 * vol * vol) * T) / (vol * sqrtT)

  return (Math.exp(-q * T) * normalPdf(dp)) / (S * vol * sqrtT)
}

export function bsDelta(
  S: number,
  K: number,
  vol: number,
  T: number,
  r: number,
  q: number,
  optType: 'call' | 'put'
): number {
  if (T <= 0 || vol <= 0 || S <= 0 || K <= 0) return 0

  const sqrtT = Math.sqrt(T)
  const d1 = (Math.log(S / K) + (r - q + 0.5 * vol * vol) * T) / (vol * sqrtT)
  const discount = Math.exp(-q * T)

  return optType === 'call' ? discount * normalCdf(d1) : discount * (normalCdf(d1) - 1)
}

export function calcGammaExposure(
  S: number,
  K: number,
  vol: number,
  T: number,
  r: number,
  q: number,
  openInterest: number,
  sharesPerContract: number = 100
): number {
  const gamma = bsGamma(S, K, vol, T, r, q)
  return openInterest * sharesPerContract * S * S * 0.01 * gamma
}

export interface GammaProfilePoint {
  spotLevel: number
  totalGex: number
  callGex: number
  putGex: number
}
