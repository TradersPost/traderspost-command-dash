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

export interface GammaProfilePoint {
  spotLevel: number
  totalGex: number
  callGex: number
  putGex: number
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
