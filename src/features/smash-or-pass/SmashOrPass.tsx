import { useState, useEffect, useRef } from 'react'
import { searchFiles, fetchFileMetadata, fetchFileMetadataByIds, getFileUrl } from '../../api/search'
import { setRating } from '../../api/ratings'
import { incrementFileViewtime, setFileViewtime } from '../../api/times'
import type { FileMetadata } from '../../api/types'
import { getViewCount, getLegacyViewCountKey } from '../../api/types'
import { useRatingServicesStore } from '../../stores/rating-services-store'
import { useSettingsStore } from '../../stores/settings-store'
import { useMobile } from '../../hooks/use-mobile'
import { rate, createRating, type TrueSkillRating } from './trueskill'
import { insertTagRatingRecords, getAllFileRatings, upsertFileRating, clearAllRatings } from './tag-history'
import { SERVICE_TYPE, FILE_SORT_TYPES } from '../../api/types'
import { TagSearch } from '../search/TagSearch'
import { FileRenderer, isUnsupportedMime } from '../../components/FileRenderer'

const FILE_LIMIT = 200
const REFILL_THRESHOLD = FILE_LIMIT * 0.2

function getAllKnownTags(file: FileMetadata): string[] {
  if (!file.tags) return []
  for (const entry of Object.values(file.tags)) {
    if (entry.type === 10) return entry.display_tags?.['0'] ?? []
  }
  return []
}

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function SmashOrPass({ smashSearchOpen = false, onSmashSearchToggle }: { smashSearchOpen?: boolean; onSmashSearchToggle?: () => void }) {
  const [fileA, setFileA] = useState<FileMetadata | null>(null)
  const [fileB, setFileB] = useState<FileMetadata | null>(null)
  const [urlA, setUrlA] = useState<string | null>(null)
  const [urlB, setUrlB] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ wins: 0, draws: 0, streakA: 0, streakB: 0 })
  const [tagVersion, setTagVersion] = useState(0)
  const [loadingA, setLoadingA] = useState(false)
  const [loadingB, setLoadingB] = useState(false)
  const [fadingA, setFadingA] = useState(false)
  const [fadingB, setFadingB] = useState(false)
  const [pulseAKey, setPulseAKey] = useState(0)
  const [pulseBKey, setPulseBKey] = useState(0)
  const [glowA, setGlowA] = useState(0)
  const [glowB, setGlowB] = useState(0)
  const [swipeDir, setSwipeDir] = useState<'up' | 'down' | 'right' | null>(null)

  const smashPassTags = useSettingsStore((s) => s.smashPassTags)
  const setSmashPassTags = useSettingsStore((s) => s.setSmashPassTags)
  const smashPassTagsB = useSettingsStore((s) => s.smashPassTagsB)
  const setSmashPassTagsB = useSettingsStore((s) => s.setSmashPassTagsB)
  const smashPassDualMode = useSettingsStore((s) => s.smashPassDualMode)

  const [syncedRatings, setSyncedRatings] = useState<Map<number, number>>(new Map())
  const [queueRemaining, setQueueRemaining] = useState(0)
  const [queueRemainingA, setQueueRemainingA] = useState(0)
  const [queueRemainingB, setQueueRemainingB] = useState(0)
  const [eloRanks, setEloRanks] = useState<Map<number, number>>(new Map())

  const fileIdsRef = useRef<number[]>([])
  const hashesRef = useRef<string[]>([])
  const queueIndexRef = useRef(0)
  const fileIdsRefA = useRef<number[]>([])
  const hashesRefA = useRef<string[]>([])
  const queueIndexRefA = useRef(0)
  const fillingRefA = useRef(false)
  const fileIdsRefB = useRef<number[]>([])
  const hashesRefB = useRef<string[]>([])
  const queueIndexRefB = useRef(0)
  const fillingRefB = useRef(false)
  const ratingsRef = useRef<Map<number, TrueSkillRating>>(new Map())
  const loadingRef = useRef(false)
  const fillingRef = useRef(false)
  const roundRef = useRef(0)

  const configuredKey = useSettingsStore((s) => s.ratingServiceKey)
  const services = useRatingServicesStore((s) => s.services)
  const ratingServiceKey = (configuredKey || services.find((rs) => rs.type === SERVICE_TYPE.INC_DEC_RATING)?.service_key) ?? null
  const [, forceRerender] = useState(0)
  const ratingsCacheVerRef = useRef(useSettingsStore.getState().ratingsCacheVersion)
  const ratingsLocalRef = useRef<Map<number, Record<string, number | boolean>>>(new Map())
  useEffect(() => {
    return useSettingsStore.subscribe((s) => {
      if (s.ratingsCacheVersion !== ratingsCacheVerRef.current) {
        ratingsCacheVerRef.current = s.ratingsCacheVersion
        ratingsLocalRef.current.clear()
        const stored = useSettingsStore.getState().getRatingsCache()
        if (stored) { for (const [fid, r] of stored) ratingsLocalRef.current.set(fid, r) }
        forceRerender((n) => n + 1)
      }
    })
  }, [])
  const countedViewsRef = useRef<Set<string>>(new Set())
  const viewCountCacheRef = useRef<Map<string, number>>(new Map())
  useEffect(() => {
    for (const f of [fileA, fileB]) {
      if (!f?.hash) continue
      if (countedViewsRef.current.has(f.hash)) continue
      countedViewsRef.current.add(f.hash)

      const current = getViewCount(f)
      const legacyKey = getLegacyViewCountKey()
      const hasLegacy = legacyKey && f.ratings?.[legacyKey] != null && typeof f.ratings[legacyKey] === 'number'

      if (hasLegacy) {
        const legacyVal = f.ratings[legacyKey] as number
        setFileViewtime({ hash: f.hash, canvas_type: 4, views: legacyVal + 1, viewtime: 0 })
      } else {
        incrementFileViewtime({ hash: f.hash, canvas_type: 4, views: 1, viewtime: 0 })
      }
      viewCountCacheRef.current.set(f.hash, current + 1)
    }
  }, [fileA?.hash, fileB?.hash])
  const isNumerical = false
  const { isMobile, orientation } = useMobile()
  const smashFloatingPanel = useSettingsStore((s) => s.smashFloatingPanel)
  const smashNavSide = useSettingsStore((s) => s.smashNavSide)
  const smashSwipeVote = useSettingsStore((s) => s.smashPassSwipeVote)
  const touchRef = useRef({ sx: 0, sy: 0, swiping: false })

  function handleTouchStart(e: React.TouchEvent) {
    if (!smashSwipeVote || !votingOpen) return
    touchRef.current = { sx: e.touches[0].clientX, sy: e.touches[0].clientY, swiping: true }
    setSwipeDir(null)
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!touchRef.current.swiping) return
    e.preventDefault()
    const dx = e.touches[0].clientX - touchRef.current.sx
    const dy = e.touches[0].clientY - touchRef.current.sy
    const absDx = Math.abs(dx), absDy = Math.abs(dy)
    if (absDx < 10 && absDy < 10) { setSwipeDir(null); return }
    if (absDy > absDx) setSwipeDir(dy < 0 ? 'up' : 'down')
    else if (dx > 0) setSwipeDir('right')
    else setSwipeDir(null)
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!touchRef.current.swiping) return
    touchRef.current.swiping = false
    setSwipeDir(null)
    const dx = e.changedTouches[0].clientX - touchRef.current.sx
    const dy = e.changedTouches[0].clientY - touchRef.current.sy
    const absDx = Math.abs(dx), absDy = Math.abs(dy)
    const min = 50
    if (absDx < min && absDy < min) return
    if (absDy > absDx) {
      if (dy < 0) decide('left')
      else decide('right')
    } else {
      if (dx > 0) decide('draw')
    }
  }

  async function fillQueue(): Promise<void> {
    if (fillingRef.current) return
    fillingRef.current = true
    try {
      const custom = useSettingsStore.getState().smashPassTags
      const tags = custom.length > 0 ? custom : ['system:everything']
      const result = await searchFiles({
        tags,
        file_sort_type: FILE_SORT_TYPES.RANDOM,
        file_sort_asc: false,
        return_hashes: true,
        file_limit: FILE_LIMIT,
      })
      const ids = result.file_ids || []
      const hashes = result.hashes || []

      if (ids.length === 0) return

      const staticMode = useSettingsStore.getState().smashPassStaticMode
      fileIdsRef.current = staticMode ? ids : fisherYatesShuffle(ids)
      hashesRef.current = staticMode ? hashes : fisherYatesShuffle(hashes)
      setQueueRemaining(fileIdsRef.current.length)
    } catch (e) {
      console.error('Failed to fill queue:', e)
    } finally {
      fillingRef.current = false
    }
  }

  async function fillQueueA(): Promise<void> {
    if (fillingRefA.current) return
    fillingRefA.current = true
    try {
      const custom = useSettingsStore.getState().smashPassTags
      const tags = custom.length > 0 ? custom : ['system:everything']
      const result = await searchFiles({
        tags,
        file_sort_type: FILE_SORT_TYPES.RANDOM,
        file_sort_asc: false,
        return_hashes: true,
        file_limit: FILE_LIMIT,
      })
      fileIdsRefA.current = fisherYatesShuffle(result.file_ids || [])
      hashesRefA.current = fisherYatesShuffle(result.hashes || [])
      setQueueRemainingA(fileIdsRefA.current.length)
    } catch (e) {
      console.error('Failed to fill queue A:', e)
    } finally {
      fillingRefA.current = false
    }
  }

  async function fillQueueB(): Promise<void> {
    if (fillingRefB.current) return
    fillingRefB.current = true
    try {
      const custom = useSettingsStore.getState().smashPassTagsB
      const tags = custom.length > 0 ? custom : ['system:everything']
      const result = await searchFiles({
        tags,
        file_sort_type: FILE_SORT_TYPES.RANDOM,
        file_sort_asc: false,
        return_hashes: true,
        file_limit: FILE_LIMIT,
      })
      fileIdsRefB.current = fisherYatesShuffle(result.file_ids || [])
      hashesRefB.current = fisherYatesShuffle(result.hashes || [])
      setQueueRemainingB(fileIdsRefB.current.length)
    } catch (e) {
      console.error('Failed to fill queue B:', e)
    } finally {
      fillingRefB.current = false
    }
  }

  async function loadFileByIndex(index: number, fileIds: number[], hashes: string[]): Promise<FileMetadata | null> {
    if (index >= fileIds.length && index >= hashes.length) return null

    const hash = index < hashes.length ? hashes[index] : undefined
    const fileId = index < fileIds.length ? fileIds[index] : undefined
    if (!hash && fileId == null) return null

    const files = hash
      ? await fetchFileMetadata([hash])
      : fileId != null
        ? await fetchFileMetadataByIds([fileId])
        : []
    return files.length > 0 ? files[0] : null
  }

  async function findNextSupported(index: number, fileIds: number[], hashes: string[], skipHashes?: string[]): Promise<{ file: FileMetadata | null; index: number }> {
    while (index < fileIds.length) {
      const file = await loadFileByIndex(index, fileIds, hashes)
      if (!file) break
      if (isUnsupportedMime(file.mime) || (skipHashes && skipHashes.includes(file.hash))) {
        index++
        continue
      }
      return { file, index }
    }
    return { file: null, index }
  }

  async function loadMatch(): Promise<void> {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      if (smashPassDualMode) {
        const remainA = fileIdsRefA.current.length - queueIndexRefA.current
        if (remainA <= REFILL_THRESHOLD) {
          await fillQueueA()
          queueIndexRefA.current = 0
        }
        const remainB = fileIdsRefB.current.length - queueIndexRefB.current
        if (remainB <= REFILL_THRESHOLD) {
          await fillQueueB()
          queueIndexRefB.current = 0
        }

        const foundA = await findNextSupported(queueIndexRefA.current, fileIdsRefA.current, hashesRefA.current)
        queueIndexRefA.current = foundA.index
        const a = foundA.file

        const foundB = await findNextSupported(queueIndexRefB.current, fileIdsRefB.current, hashesRefB.current, a ? [a.hash] : undefined)
        const b = foundB.file

        if (!a || !b) {
          setFileA(null); setFileB(null); setUrlA(null); setUrlB(null)
          return
        }

        setFileA(a)
        setFileB(b)

        if (!ratingsRef.current.has(a.file_id)) ratingsRef.current.set(a.file_id, createRating())
        if (!ratingsRef.current.has(b.file_id)) ratingsRef.current.set(b.file_id, createRating())

        if (ratingServiceKey) {
          const updates = new Map<number, number>()
          for (const f of [a, b]) {
            const v = f.ratings?.[ratingServiceKey]
            updates.set(f.file_id, typeof v === 'number' ? v : 0)
          }
          setSyncedRatings((prev) => { const n = new Map(prev); for (const [k, v] of updates) n.set(k, v); return n })
        }

        const [ruA, ruB] = await Promise.all([
          getFileUrl(a.hash).catch(() => null),
          getFileUrl(b.hash).catch(() => null),
        ])
        setUrlA(ruA)
        setUrlB(ruB)
      } else {
        const remaining = fileIdsRef.current.length - queueIndexRef.current
        if (remaining <= REFILL_THRESHOLD) {
          await fillQueue()
          queueIndexRef.current = 0
        }

        const foundA = await findNextSupported(queueIndexRef.current, fileIdsRef.current, hashesRef.current)
        queueIndexRef.current = foundA.index
        const a = foundA.file

        let b: FileMetadata | null = null
        if (a) {
          const foundB = await findNextSupported(queueIndexRef.current + 1, fileIdsRef.current, hashesRef.current, [a.hash])
          b = foundB.file
        }

        if (!a || !b) {
          setFileA(null)
          setFileB(null)
          setUrlA(null)
          setUrlB(null)
          return
        }

        setFileA(a)
        setFileB(b)

        if (!ratingsRef.current.has(a.file_id)) ratingsRef.current.set(a.file_id, createRating())
        if (!ratingsRef.current.has(b.file_id)) ratingsRef.current.set(b.file_id, createRating())

        if (ratingServiceKey) {
          const updates = new Map<number, number>()
          for (const f of [a, b]) {
            const v = f.ratings?.[ratingServiceKey]
            updates.set(f.file_id, typeof v === 'number' ? v : 0)
          }
          setSyncedRatings((prev) => { const n = new Map(prev); for (const [k, v] of updates) n.set(k, v); return n })
        }

        const [ruA, ruB] = await Promise.all([
          getFileUrl(a.hash).catch(() => null),
          getFileUrl(b.hash).catch(() => null),
        ])
        setUrlA(ruA)
        setUrlB(ruB)
      }
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  useEffect(() => {
    const MIGRATION_KEY = 'hydrus-ui-trueskill-migration-v2'
    const init = async () => {
      if (!localStorage.getItem(MIGRATION_KEY)) {
        try {
          await clearAllRatings()
          localStorage.setItem(MIGRATION_KEY, 'done')
        } catch (e) {
          console.warn('Migration clear failed:', e)
        }
      }
      const syncedInit = new Map<number, number>()
      try {
        const ratings = await getAllFileRatings()
        for (const r of ratings) {
          ratingsRef.current.set(r.file_id, { mu: r.mu, sigma: r.sigma })
          if (r.synced_rating !== undefined) {
            syncedInit.set(r.file_id, r.synced_rating)
          }
        }
      } catch (e) {
        console.warn('Could not load saved ratings (starting fresh):', e)
      }
      const cached = useSettingsStore.getState().getRatingsCache()
      if (cached && ratingServiceKey) {
        for (const [fileId, ratings] of cached) {
          if (syncedInit.has(fileId)) continue
          const v = ratings[ratingServiceKey]
          if (typeof v === 'number') {
            syncedInit.set(fileId, v)
          }
        }
      }
      setSyncedRatings(syncedInit)
      loadMatch()
    }
    init()
  }, [])

  useEffect(() => {
    setSyncedRatings(new Map())
  }, [configuredKey])

  useEffect(() => {
    if (syncedRatings.size === 0) {
      setEloRanks(new Map())
      return
    }
    const sorted = [...syncedRatings.entries()].sort((a, b) => b[1] - a[1])
    const map = new Map<number, number>()
    for (let i = 0; i < sorted.length; i++) {
      map.set(sorted[i][0], i + 1)
    }
    setEloRanks(map)
  }, [syncedRatings])

  async function decide(winner: 'left' | 'right' | 'draw') {
    if (!fileA || !fileB) return

    const ratingA = ratingsRef.current.get(fileA.file_id) || createRating()
    const ratingB = ratingsRef.current.get(fileB.file_id) || createRating()

    let newA: TrueSkillRating
    let newB: TrueSkillRating

    const prevStreakA = stats.streakA
    const prevStreakB = stats.streakB

    if (winner === 'left') {
      const result = rate(ratingA, ratingB)
      newA = result.winner
      newB = result.loser
      const newStreakA = prevStreakA + 1
      setStats((s) => ({ ...s, wins: s.wins + 1, streakA: newStreakA, streakB: 0 }))
      setPulseAKey((k) => k + 1)
      const glowLevel = newStreakA >= 10 ? 3 : newStreakA >= 5 ? 2 : 1
      setGlowA(glowLevel)
      setGlowB(0)
    } else if (winner === 'right') {
      const result = rate(ratingB, ratingA)
      newB = result.winner
      newA = result.loser
      const newStreakB = prevStreakB + 1
      setStats((s) => ({ ...s, wins: s.wins + 1, streakA: 0, streakB: newStreakB }))
      setPulseBKey((k) => k + 1)
      const glowLevel = newStreakB >= 10 ? 3 : newStreakB >= 5 ? 2 : 1
      setGlowB(glowLevel)
      setGlowA(0)
    } else {
      newA = ratingA
      newB = ratingB
      setStats((s) => ({ ...s, draws: s.draws + 1, streakA: 0, streakB: 0 }))
      setGlowA(0)
      setGlowB(0)
    }

    ratingsRef.current.set(fileA.file_id, newA)
    ratingsRef.current.set(fileB.file_id, newB)

    if (winner !== 'draw' && ratingServiceKey) {
      const cfg = useSettingsStore.getState()
      const baseInc = cfg.ratingBaseInc
      const loserDec = cfg.ratingLoserDec
      const streakThreshold = cfg.ratingStreakThreshold
      const streakBonusAmt = cfg.ratingStreakBonus
      const underdogThreshold = cfg.underdogThreshold
      const underdogMinGap = cfg.underdogMinGap
      const underdogBoostPct = cfg.underdogBoostPct

      const winnerId = winner === 'left' ? fileA.file_id : fileB.file_id
      const loserId = winner === 'left' ? fileB.file_id : fileA.file_id
      const winnerStreak = winner === 'left' ? prevStreakA : prevStreakB
      const winnerElo = syncedRatings.get(winnerId) ?? 0
      const loserElo = syncedRatings.get(loserId) ?? 0

      const streakBonus = (winnerStreak > 0 && winnerStreak % streakThreshold === 0)
        ? streakBonusAmt * Math.floor(winnerStreak / streakThreshold) : 0
      let winnerNew: number
      if (winnerElo <= underdogThreshold && (loserElo - winnerElo) >= underdogMinGap) {
        winnerNew = winnerElo + Math.floor((loserElo - winnerElo) * underdogBoostPct / 100)
      } else {
        winnerNew = winnerElo + baseInc + streakBonus
      }
      const loserNew = Math.max(0, loserElo - loserDec)

      try {
        await Promise.all([
          setRating({ file_id: winnerId, rating_service_key: ratingServiceKey, rating: winnerNew }),
          setRating({ file_id: loserId, rating_service_key: ratingServiceKey, rating: loserNew }),
        ])
        setSyncedRatings((prev) => {
          const next = new Map(prev)
          next.set(winnerId, winnerNew)
          next.set(loserId, loserNew)
          return next
        })
        const existingCache = useSettingsStore.getState().getRatingsCache()
        const winnerBase = existingCache?.get(winnerId) ?? (fileA.file_id === winnerId ? fileA : fileB).ratings ?? {}
        const loserBase = existingCache?.get(loserId) ?? (fileA.file_id === loserId ? fileA : fileB).ratings ?? {}
        useSettingsStore.getState().addToRatingsCache([
          [winnerId, { ...winnerBase, [ratingServiceKey]: winnerNew }],
          [loserId, { ...loserBase, [ratingServiceKey]: loserNew }],
        ])
      } catch (e) {
        console.error('Failed to set ratings:', e)
      }
    }

    const persistTs = Date.now()

    try {
      await Promise.all([
        upsertFileRating({ file_id: fileA.file_id, file_hash: fileA.hash, mu: newA.mu, sigma: newA.sigma, synced_rating: syncedRatings.get(fileA.file_id), timestamp: persistTs }),
        upsertFileRating({ file_id: fileB.file_id, file_hash: fileB.hash, mu: newB.mu, sigma: newB.sigma, synced_rating: syncedRatings.get(fileB.file_id), timestamp: persistTs }),
      ])
    } catch (e) {
      console.error('Failed to persist file ratings:', e)
    }

    const allTagsA = getAllKnownTags(fileA)
    const allTagsB = getAllKnownTags(fileB)
    const tagTs = Date.now()
    const records = [
      ...allTagsA.map((tag) => ({
        id: `${tag}:${tagTs}:${fileA.hash}`,
        tag,
        rating_service_key: ratingServiceKey,
        file_hash: fileA.hash,
        mu_before: ratingA.mu,
        mu_after: newA.mu,
        sigma_before: ratingA.sigma,
        sigma_after: newA.sigma,
        action: (winner === 'left' ? 'smash' : winner === 'right' ? 'pass' : 'skip') as 'smash' | 'pass' | 'skip',
        timestamp: tagTs,
      })),
      ...allTagsB.map((tag) => ({
        id: `${tag}:${tagTs}:${fileB.hash}`,
        tag,
        rating_service_key: ratingServiceKey,
        file_hash: fileB.hash,
        mu_before: ratingB.mu,
        mu_after: newB.mu,
        sigma_before: ratingB.sigma,
        sigma_after: newB.sigma,
        action: (winner === 'right' ? 'smash' : winner === 'left' ? 'pass' : 'skip') as 'smash' | 'pass' | 'skip',
        timestamp: tagTs,
      })),
    ]
    try {
      await insertTagRatingRecords(records)
    } catch (e) {
      console.error('Failed to save tag history:', e)
    }

    console.log('Match result — left:', fileA.hash, 'right:', fileB.hash, 'winner:', winner)
    console.log('  ratingA:', newA.mu.toFixed(1), '±', newA.sigma.toFixed(2))
    console.log('  ratingB:', newB.mu.toFixed(1), '±', newB.sigma.toFixed(2))

    const thisRound = ++roundRef.current

    if (smashPassDualMode) {
      if (winner === 'left') {
        setFadingB(true)
        setLoadingB(true)
        queueIndexRefB.current++
        const found = await findNextSupported(queueIndexRefB.current, fileIdsRefB.current, hashesRefB.current, [fileB.hash, fileA.hash])
        queueIndexRefB.current = found.index
        const newB = found.file
        setQueueRemainingB(Math.max(0, fileIdsRefB.current.length - queueIndexRefB.current))
        if (roundRef.current !== thisRound) return
        if (newB) {
          setFileB(newB)
          if (!ratingsRef.current.has(newB.file_id)) ratingsRef.current.set(newB.file_id, createRating())
          if (ratingServiceKey) {
            const v = newB.ratings?.[ratingServiceKey]
            setSyncedRatings((prev) => { const n = new Map(prev); n.set(newB.file_id, typeof v === 'number' ? v : 0); return n })
          }
          getFileUrl(newB.hash).then((u) => {
            if (roundRef.current !== thisRound) return
            if (u) setUrlB(u)
            const delay = useSettingsStore.getState().terminatedMode ? 750 : 0
            setTimeout(() => {
              setLoadingB(false)
              setTimeout(() => { if (roundRef.current === thisRound) setFadingB(false) }, 150)
            }, delay)
          }).catch(() => { if (roundRef.current !== thisRound) return; setLoadingB(false); setFadingB(false) })
        } else {
          setLoadingB(false); setFadingB(false)
        }
      } else if (winner === 'right') {
        setFadingA(true)
        setLoadingA(true)
        queueIndexRefA.current++
        const found = await findNextSupported(queueIndexRefA.current, fileIdsRefA.current, hashesRefA.current, [fileA.hash, fileB.hash])
        queueIndexRefA.current = found.index
        const newA = found.file
        setQueueRemainingA(Math.max(0, fileIdsRefA.current.length - queueIndexRefA.current))
        if (roundRef.current !== thisRound) return
        if (newA) {
          setFileA(newA)
          if (!ratingsRef.current.has(newA.file_id)) ratingsRef.current.set(newA.file_id, createRating())
          if (ratingServiceKey) {
            const v = newA.ratings?.[ratingServiceKey]
            setSyncedRatings((prev) => { const n = new Map(prev); n.set(newA.file_id, typeof v === 'number' ? v : 0); return n })
          }
          getFileUrl(newA.hash).then((u) => {
            if (roundRef.current !== thisRound) return
            if (u) setUrlA(u)
            const delay = useSettingsStore.getState().terminatedMode ? 750 : 0
            setTimeout(() => {
              setLoadingA(false)
              setTimeout(() => { if (roundRef.current === thisRound) setFadingA(false) }, 150)
            }, delay)
          }).catch(() => { if (roundRef.current !== thisRound) return; setLoadingA(false); setFadingA(false) })
        } else {
          setLoadingA(false); setFadingA(false)
        }
      } else {
        roundRef.current++
        setLoadingA(false); setLoadingB(false)
        setFadingA(false); setFadingB(false)
        setGlowA(0); setGlowB(0)
        queueIndexRefA.current = 0; queueIndexRefB.current = 0
        setQueueRemainingA(fileIdsRefA.current.length); setQueueRemainingB(fileIdsRefB.current.length)
        await Promise.all([fillQueueA(), fillQueueB()])
        loadMatch()
      }
    } else if (winner === 'left') {
      queueIndexRef.current += 1
      setQueueRemaining(Math.max(0, fileIdsRef.current.length - queueIndexRef.current))
      setFadingB(true)
      setLoadingB(true)
      const found = await findNextSupported(queueIndexRef.current + 1, fileIdsRef.current, hashesRef.current, [fileB.hash, fileA.hash])
      const newB = found.file
      if (roundRef.current !== thisRound) return
      if (newB) {
        setFileB(newB)
        if (!ratingsRef.current.has(newB.file_id)) {
          ratingsRef.current.set(newB.file_id, createRating())
        }
        if (ratingServiceKey) {
          const hydrusVal = newB.ratings?.[ratingServiceKey]
          setSyncedRatings((prev) => {
            const next = new Map(prev)
            next.set(newB.file_id, typeof hydrusVal === 'number' ? hydrusVal : 0)
            return next
          })
        }
        getFileUrl(newB.hash).then((u) => {
          if (roundRef.current !== thisRound) return
          if (u) setUrlB(u)
          const delay = useSettingsStore.getState().terminatedMode ? 750 : 0
          setTimeout(() => {
            setLoadingB(false)
            setTimeout(() => { if (roundRef.current === thisRound) setFadingB(false) }, 150)
          }, delay)
        }).catch(() => { if (roundRef.current !== thisRound) return; setLoadingB(false); setFadingB(false) })
      } else {
        setLoadingB(false); setFadingB(false)
      }
    } else if (winner === 'right') {
      queueIndexRef.current += 1
      setQueueRemaining(Math.max(0, fileIdsRef.current.length - queueIndexRef.current))
      setFadingA(true)
      setLoadingA(true)
      const found = await findNextSupported(queueIndexRef.current + 1, fileIdsRef.current, hashesRef.current, [fileA.hash, fileB.hash])
      const newA = found.file
      if (roundRef.current !== thisRound) return
      if (newA) {
        setFileA(newA)
        if (!ratingsRef.current.has(newA.file_id)) {
          ratingsRef.current.set(newA.file_id, createRating())
        }
        if (ratingServiceKey) {
          const hydrusVal = newA.ratings?.[ratingServiceKey]
          setSyncedRatings((prev) => {
            const next = new Map(prev)
            next.set(newA.file_id, typeof hydrusVal === 'number' ? hydrusVal : 0)
            return next
          })
        }
        getFileUrl(newA.hash).then((u) => {
          if (roundRef.current !== thisRound) return
          if (u) setUrlA(u)
          const delay = useSettingsStore.getState().terminatedMode ? 750 : 0
          setTimeout(() => {
            setLoadingA(false)
            setTimeout(() => { if (roundRef.current === thisRound) setFadingA(false) }, 150)
          }, delay)
        }).catch(() => { if (roundRef.current !== thisRound) return; setLoadingA(false); setFadingA(false) })
      } else {
        setLoadingA(false); setFadingA(false)
      }
    } else {
      roundRef.current++
      setLoadingA(false)
      setLoadingB(false)
      setFadingA(false)
      setFadingB(false)
      setGlowA(0)
      setGlowB(0)
      queueIndexRef.current = 0
      setQueueRemaining(fileIdsRef.current.length)
      fillQueue().then(() => loadMatch())
    }
  }

  function handleKeyDown(e: globalThis.KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
    if (e.key === 'ArrowLeft' || e.key === 'a') { e.preventDefault(); decide('left') }
    else if (e.key === 'ArrowRight' || e.key === 'd') { e.preventDefault(); decide('right') }
    else if (e.key === ' ' || e.key === 's') { e.preventDefault(); decide('draw') }
  }

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  useEffect(() => {
    loadingRef.current = false
    fillingRef.current = false
    setLoading(true)
    setFileA(null)
    setFileB(null)
    setUrlA(null)
    setUrlB(null)
    if (smashPassDualMode) {
      Promise.all([fillQueueA(), fillQueueB()]).then(() => {
        queueIndexRefA.current = 0; queueIndexRefB.current = 0
        setQueueRemainingA(fileIdsRefA.current.length); setQueueRemainingB(fileIdsRefB.current.length)
        loadMatch()
      })
    } else {
      fillQueue().then(() => {
        queueIndexRef.current = 0
        setQueueRemaining(fileIdsRef.current.length)
        loadMatch()
      })
    }
  }, [tagVersion])

  const votingOpen = !loading && fileA && fileB && urlA && urlB

  return (
    <div className="flex flex-col h-full">
      {isMobile ? (
        <div className={`overflow-hidden transition-all duration-200 ${smashSearchOpen ? 'max-h-[200px]' : 'max-h-0'}`}>
          <div className="px-2 pt-1 space-y-1">
            {smashPassDualMode ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-mono w-4">A</span>
                  <div className="flex-1">
                    <TagSearch disableHistory tags={smashPassTags} onTagsChange={(t) => { setSmashPassTags(t); setTagVersion((v) => v + 1) }} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-mono w-4">B</span>
                  <div className="flex-1">
                    <TagSearch disableHistory tags={smashPassTagsB} onTagsChange={(t) => { setSmashPassTagsB(t); setTagVersion((v) => v + 1) }} />
                  </div>
                </div>
              </>
            ) : (
              <TagSearch disableHistory tags={smashPassTags} onTagsChange={(t) => { setSmashPassTags(t); setTagVersion((v) => v + 1) }} />
            )}
          </div>
        </div>
      ) : (
        <div className="px-2 pt-1 space-y-1">
          {smashPassDualMode ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-mono w-4">A</span>
                <div className="flex-1">
                  <TagSearch disableHistory tags={smashPassTags} onTagsChange={(t) => { setSmashPassTags(t); setTagVersion((v) => v + 1) }} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-mono w-4">B</span>
                <div className="flex-1">
                  <TagSearch disableHistory tags={smashPassTagsB} onTagsChange={(t) => { setSmashPassTagsB(t); setTagVersion((v) => v + 1) }} />
                </div>
              </div>
            </>
          ) : (
            <TagSearch disableHistory tags={smashPassTags} onTagsChange={(t) => { setSmashPassTags(t); setTagVersion((v) => v + 1) }} />
          )}
        </div>
      )}
      <div className={`flex justify-center ${isMobile ? 'gap-2 text-[10px]' : 'gap-6'} py-2 text-sm text-gray-500 flex-wrap`}>
        <span>Rounds <b className="text-green-400">{stats.wins}</b></span>
        {stats.streakA > 0 && <span>A Streak <b className={stats.streakA >= 10 ? 'text-lime-400' : stats.streakA >= 5 ? 'text-orange-400' : 'text-gray-400'}>{stats.streakA}</b></span>}
        {stats.streakB > 0 && <span>B Streak <b className={stats.streakB >= 10 ? 'text-lime-400' : stats.streakB >= 5 ? 'text-orange-400' : 'text-gray-400'}>{stats.streakB}</b></span>}
        <span>Draws <b className="text-yellow-400">{stats.draws}</b></span>
        {smashPassDualMode ? (
          <>
            <span className="text-gray-400">Q-A: <b>{queueRemainingA}</b></span>
            <span className="text-gray-400">Q-B: <b>{queueRemainingB}</b></span>
          </>
        ) : (
          <span className="text-gray-400">Queue: <b>{queueRemaining}</b></span>
        )}
      </div>

      <div
        className={`flex-1 flex ${isMobile && orientation === 'portrait' ? 'flex-col' : 'flex-row'} gap-2 p-2 min-h-0 relative`}
        style={smashSwipeVote ? { touchAction: 'none' } : undefined}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {swipeDir && (
          <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
            <div className="bg-black/50 rounded-full w-24 h-24 flex items-center justify-center">
              <span className="text-white text-5xl font-bold opacity-80">
                {swipeDir === 'up' ? '\u2191' : swipeDir === 'down' ? '\u2193' : '\u2192'}
              </span>
            </div>
          </div>
        )}
        {!loading && (!fileA || !fileB) && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-4">
            <p className="text-lg">No more files!</p>
            <button className="px-4 py-2 min-h-[44px] bg-blue-600 text-white rounded hover:bg-blue-700 active:bg-blue-800" onClick={loadMatch}>
              Try Again
            </button>
          </div>
        )}

        {/* Left file */}
        <div className="flex-1 relative">
          <div
            className={`absolute inset-0 bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center transition-opacity duration-200 ${fadingA ? 'opacity-10' : ''} ${votingOpen ? 'cursor-pointer' : ''}`}
            onClick={() => votingOpen && decide('left')}
          >
            {urlA
              ? <FileRenderer url={urlA} mime={fileA?.mime ?? 'image/jpeg'} className="w-full h-full object-contain" />
              : null
            }
            {votingOpen && fileA && (() => {
              const s = syncedRatings.get(fileA.file_id)
              const rating = (s ?? 0).toString() + ' ELO'
              const rank = eloRanks.get(fileA.file_id) ?? 0
              const rankSuffix = rank % 10 === 1 && rank % 100 !== 11 ? 'st' : rank % 10 === 2 && rank % 100 !== 12 ? 'nd' : rank % 10 === 3 && rank % 100 !== 13 ? 'rd' : 'th'
              const rankColor = rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-gray-300' : rank === 3 ? 'text-amber-600' : ''
              const baseGlow = glowA === 3 ? 'elo-glow' : glowA === 2 ? 'elo-throb' : ''
              return (
                <div className="absolute bottom-2 left-2 flex flex-col items-start gap-0.5">
                  {rank > 0 && (
                    <span className={`bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded font-bold ${rankColor}`}>
                      {rank}{rankSuffix}
                    </span>
                  )}
                  <span key={`elo-a-${pulseAKey}`} className={`bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded font-mono ${baseGlow} ${pulseAKey > 0 ? 'elo-pulse' : ''}`}>
                    {rating}
                  </span>
                  {(() => {
                    if (!fileA) return null
                    const vc = fileA.hash ? viewCountCacheRef.current.get(fileA.hash) ?? getViewCount(fileA) : getViewCount(fileA)
                    if (vc <= 0) return null
                    return (
                      <span className="bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                        <svg viewBox="0 0 576 512" fill="currentColor" className="w-2.5 h-2.5">
                          <path d="M288 80c-65.2 0-118.8 29.6-159.9 67.7C89.6 183.5 63 226 49.4 256c13.6 30 40.2 72.5 78.7 108.3C169.2 402.4 222.8 432 288 432s118.8-29.6 159.9-67.7C486.4 328.5 513 286 526.6 256c-13.6-30-40.2-72.5-78.7-108.3C406.8 109.6 353.2 80 288 80zM288 368c-61.9 0-112-50.1-112-112s50.1-112 112-112 112 50.1 112 112-50.1 112-112 112zm0-176c-35.3 0-64 28.7-64 64s28.7 64 64 64 64-28.7 64-64-28.7-64-64-64z"/>
                        </svg>
                        {vc.toLocaleString()}
                      </span>
                    )
                  })()}
                  {(!isMobile || !smashFloatingPanel) && (
                  <button
                    className="bg-black/50 hover:bg-black hover:border active:bg-gray-900 active:border-green-400 hover:border-green-500 border border-transparent text-white text-xs min-h-[44px] min-w-[44px] px-2 py-0.5 rounded cursor-pointer transition-colors"
                    onClick={e => { e.stopPropagation(); votingOpen && decide('left') }}
                  >
                    ← / A
                  </button>
                  )}
                </div>
              )
            })()}
          </div>
          {useSettingsStore((s) => s.terminatedMode) && loadingA ? (
            <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
              <div className="w-full bg-red-700 py-2 text-center">
                <span className="text-white font-bold text-lg tracking-wider">TERMINATED</span>
              </div>
            </div>
          ) : (
            loadingA && (
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <span className="bg-gray-800 text-gray-300 px-3 py-1.5 rounded text-xs">Loading...</span>
              </div>
            )
          )}
        </div>

        {/* Right file */}
        <div className="flex-1 relative">
          <div
            className={`absolute inset-0 bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center transition-opacity duration-200 ${fadingB ? 'opacity-10' : ''} ${votingOpen ? 'cursor-pointer' : ''}`}
            onClick={() => votingOpen && decide('right')}
          >
            {urlB
              ? <FileRenderer url={urlB} mime={fileB?.mime ?? 'image/jpeg'} className="w-full h-full object-contain" />
              : null
            }
            {votingOpen && fileB && (() => {
              const s = syncedRatings.get(fileB.file_id)
              const rating = (s ?? 0).toString() + ' ELO'
              const rank = eloRanks.get(fileB.file_id) ?? 0
              const rankSuffix = rank % 10 === 1 && rank % 100 !== 11 ? 'st' : rank % 10 === 2 && rank % 100 !== 12 ? 'nd' : rank % 10 === 3 && rank % 100 !== 13 ? 'rd' : 'th'
              const rankColor = rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-gray-300' : rank === 3 ? 'text-amber-600' : ''
              const baseGlow = glowB === 3 ? 'elo-glow' : glowB === 2 ? 'elo-throb' : ''
              return (
                <div className="absolute bottom-2 right-2 flex flex-col items-end gap-0.5">
                  {rank > 0 && (
                    <span className={`bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded font-bold ${rankColor}`}>
                      {rank}{rankSuffix}
                    </span>
                  )}
                  <span key={`elo-b-${pulseBKey}`} className={`bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded font-mono ${baseGlow} ${pulseBKey > 0 ? 'elo-pulse' : ''}`}>
                    {rating}
                  </span>
                  {(() => {
                    if (!fileB) return null
                    const vc = fileB.hash ? viewCountCacheRef.current.get(fileB.hash) ?? getViewCount(fileB) : getViewCount(fileB)
                    if (vc <= 0) return null
                    return (
                      <span className="bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                        <svg viewBox="0 0 576 512" fill="currentColor" className="w-2.5 h-2.5">
                          <path d="M288 80c-65.2 0-118.8 29.6-159.9 67.7C89.6 183.5 63 226 49.4 256c13.6 30 40.2 72.5 78.7 108.3C169.2 402.4 222.8 432 288 432s118.8-29.6 159.9-67.7C486.4 328.5 513 286 526.6 256c-13.6-30-40.2-72.5-78.7-108.3C406.8 109.6 353.2 80 288 80zM288 368c-61.9 0-112-50.1-112-112s50.1-112 112-112 112 50.1 112 112-50.1 112-112 112zm0-176c-35.3 0-64 28.7-64 64s28.7 64 64 64 64-28.7 64-64-28.7-64-64-64z"/>
                        </svg>
                        {vc.toLocaleString()}
                      </span>
                    )
                  })()}
                  {(!isMobile || !smashFloatingPanel) && (
                  <button
                    className="bg-black/50 hover:bg-black hover:border active:bg-gray-900 active:border-green-400 hover:border-green-500 border border-transparent text-white text-xs min-h-[44px] min-w-[44px] px-2 py-0.5 rounded cursor-pointer transition-colors"
                    onClick={e => { e.stopPropagation(); votingOpen && decide('right') }}
                  >
                    → / D
                  </button>
                  )}
                </div>
              )
            })()}
          </div>
          {useSettingsStore((s) => s.terminatedMode) && loadingB ? (
            <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
              <div className="w-full bg-red-700 py-2 text-center">
                <span className="text-white font-bold text-lg tracking-wider">TERMINATED</span>
              </div>
            </div>
          ) : (
            loadingB && (
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <span className="bg-gray-800 text-gray-300 px-3 py-1.5 rounded text-xs">Loading...</span>
              </div>
            )
          )}
        </div>
      </div>

      {votingOpen && (
        <div className={`flex justify-center ${isMobile && orientation === 'portrait' ? 'gap-2 text-[10px]' : 'gap-4'} py-2 text-xs text-gray-500 flex-wrap`}>
          <span className="text-green-400">{isMobile && orientation === 'portrait' ? 'Tap top' : '← / A'}</span> {isMobile && orientation === 'portrait' ? 'choose left' : 'choose left'}
          <span className="text-yellow-400">{isMobile && orientation === 'portrait' ? 'Tap center' : 'Space / S'}</span> draw
          <span className="text-green-400">{isMobile && orientation === 'portrait' ? 'Tap bottom' : '→ / D'}</span> {isMobile && orientation === 'portrait' ? 'choose right' : 'choose right'}
        </div>
      )}

      {votingOpen && isMobile && smashFloatingPanel && (
        <div className={`fixed top-1/2 -translate-y-1/2 z-50 flex gap-3 ${smashNavSide === 'left' ? 'left-3' : 'right-3'} flex-col`}>
          <button
            className="w-14 h-14 bg-green-600/80 hover:bg-green-600 active:bg-green-700 text-white text-xs font-bold rounded-2xl shadow-lg flex items-center justify-center transition-colors"
            onClick={() => decide('left')}
            aria-label="Choose top file (A)"
          >
            A
          </button>
          <button
            className="w-14 h-14 bg-yellow-600/80 hover:bg-yellow-600 active:bg-yellow-700 text-white text-xs font-bold rounded-2xl shadow-lg flex items-center justify-center transition-colors"
            onClick={() => decide('draw')}
            aria-label="Draw"
          >
            Draw
          </button>
          <button
            className="w-14 h-14 bg-red-600/80 hover:bg-red-600 active:bg-red-700 text-white text-xs font-bold rounded-2xl shadow-lg flex items-center justify-center transition-colors"
            onClick={() => decide('right')}
            aria-label="Choose bottom file (B)"
          >
            B
          </button>
        </div>
      )}
    </div>
  )
}
