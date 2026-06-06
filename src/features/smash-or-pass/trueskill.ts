function pdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

function erf(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const sign = x < 0 ? -1 : 1
  x = Math.abs(x)
  const t = 1 / (1 + p * x)
  const poly = (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t
  return sign * (1 - poly * Math.exp(-x * x))
}

function cdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2))
}

function vWin(t: number, epsilon: number): number {
  return pdf(t - epsilon) / cdf(t - epsilon)
}

function wWin(t: number, epsilon: number): number {
  const v = vWin(t, epsilon)
  return v * (v + t - epsilon)
}

function vLoss(t: number, epsilon: number): number {
  return -pdf(-t - epsilon) / cdf(-t - epsilon)
}

function wLoss(t: number, epsilon: number): number {
  const v = vLoss(t, epsilon)
  return v * (v - t - epsilon)
}

export interface TrueSkillRating {
  mu: number
  sigma: number
}

export interface TrueSkillConfig {
  mu: number
  sigma: number
  beta: number
  tau: number
  epsilon: number
}

export const DEFAULT_CONFIG: TrueSkillConfig = {
  mu: 25,
  sigma: 25 / 3,
  beta: 25 / 6,
  tau: (25 / 3) / 100,
  epsilon: 0.1,
}

export function createRating(mu?: number, sigma?: number): TrueSkillRating {
  return { mu: mu ?? DEFAULT_CONFIG.mu, sigma: sigma ?? DEFAULT_CONFIG.sigma }
}

export function conservativeRating(r: TrueSkillRating): number {
  return r.mu - 3 * r.sigma
}

export function rate(
  winner: TrueSkillRating,
  loser: TrueSkillRating,
  config: TrueSkillConfig = DEFAULT_CONFIG,
): { winner: TrueSkillRating; loser: TrueSkillRating } {
  const c = Math.sqrt(
    2 * config.beta * config.beta +
    winner.sigma * winner.sigma +
    loser.sigma * loser.sigma,
  )
  const t = (winner.mu - loser.mu) / c
  const epsilonOverC = config.epsilon / c

  const vw = vWin(t, epsilonOverC)
  const ww = wWin(t, epsilonOverC)
  const vl = vLoss(t, epsilonOverC)
  const wl = wLoss(t, epsilonOverC)

  const winnerMu = winner.mu + (winner.sigma * winner.sigma / c) * vw
  const winnerSigma = winner.sigma * Math.sqrt(
    Math.max(0, 1 - (winner.sigma * winner.sigma / (c * c)) * ww),
  )
  const loserMu = loser.mu + (loser.sigma * loser.sigma / c) * vl
  const loserSigma = loser.sigma * Math.sqrt(
    Math.max(0, 1 - (loser.sigma * loser.sigma / (c * c)) * wl),
  )

  const tauSq = config.tau * config.tau
  return {
    winner: {
      mu: winnerMu,
      sigma: Math.sqrt(winnerSigma * winnerSigma + tauSq),
    },
    loser: {
      mu: loserMu,
      sigma: Math.sqrt(loserSigma * loserSigma + tauSq),
    },
  }
}
