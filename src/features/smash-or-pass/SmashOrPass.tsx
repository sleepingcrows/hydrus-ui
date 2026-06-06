import { useState, useEffect, useRef } from 'react'
import { searchFiles, fetchFileMetadata, fetchFileMetadataByIds, getFileUrl } from '../../api/search'
import { setRating } from '../../api/ratings'
import type { FileMetadata } from '../../api/types'
import { useRatingServicesStore } from '../../stores/rating-services-store'
import { useSettingsStore } from '../../stores/settings-store'
import { rate, createRating, type TrueSkillRating } from './trueskill'
import { insertTagRatingRecords, getAllFileRatings, upsertFileRating, clearAllRatings } from './tag-history'
import { SERVICE_TYPE, FILE_SORT_TYPES } from '../../api/types'
import { TagSearch } from '../search/TagSearch'

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

export function SmashOrPass() {
  const [fileA, setFileA] = useState<FileMetadata | null>(null)
  const [fileB, setFileB] = useState<FileMetadata | null>(null)
  const [urlA, setUrlA] = useState<string | null>(null)
  const [urlB, setUrlB] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ wins: 0, draws: 0 })
  const [tagVersion, setTagVersion] = useState(0)

  const smashPassTags = useSettingsStore((s) => s.smashPassTags)
  const setSmashPassTags = useSettingsStore((s) => s.setSmashPassTags)

  const fileIdsRef = useRef<number[]>([])
  const hashesRef = useRef<string[]>([])
  const queueIndexRef = useRef(0)
  const ratingsRef = useRef<Map<number, TrueSkillRating>>(new Map())
  const syncedRatingRef = useRef<Map<number, number>>(new Map())
  const loadingRef = useRef(false)
  const fillingRef = useRef(false)

  const ratingService = useRatingServicesStore((s) =>
    s.services.find((rs) => rs.type === SERVICE_TYPE.INC_DEC_RATING) ?? null
  )
  const ratingServiceKey = ratingService?.service_key ?? null
  const isNumerical = false

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
    } catch (e) {
      console.error('Failed to fill queue:', e)
    } finally {
      fillingRef.current = false
    }
  }

  async function loadFileByIndex(index: number): Promise<FileMetadata | null> {
    const ids = fileIdsRef.current
    const hashes = hashesRef.current
    if (index >= ids.length && index >= hashes.length) return null

    const hash = index < hashes.length ? hashes[index] : undefined
    const fileId = index < ids.length ? ids[index] : undefined
    if (!hash && fileId == null) return null

    const files = hash
      ? await fetchFileMetadata([hash])
      : fileId != null
        ? await fetchFileMetadataByIds([fileId])
        : []
    return files.length > 0 ? files[0] : null
  }

  async function loadMatch(): Promise<void> {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const remaining = fileIdsRef.current.length - queueIndexRef.current
      if (remaining <= REFILL_THRESHOLD) {
        await fillQueue()
        queueIndexRef.current = 0
      }

      const a = await loadFileByIndex(queueIndexRef.current)
      const b = await loadFileByIndex(queueIndexRef.current + 1)

      if (!a || !b) {
        setFileA(null)
        setFileB(null)
        setUrlA(null)
        setUrlB(null)
        return
      }

      setFileA(a)
      setFileB(b)

      if (!ratingsRef.current.has(a.file_id)) {
        ratingsRef.current.set(a.file_id, createRating())
      }
      if (!ratingsRef.current.has(b.file_id)) {
        ratingsRef.current.set(b.file_id, createRating())
      }

      if (ratingServiceKey) {
        for (const f of [a, b]) {
          const hydrusVal = f.ratings?.[ratingServiceKey]
          syncedRatingRef.current.set(f.file_id, typeof hydrusVal === 'number' ? hydrusVal : 0)
        }
      }

      const [ruA, ruB] = await Promise.all([
        getFileUrl(a.hash).catch(() => null),
        getFileUrl(b.hash).catch(() => null),
      ])
      setUrlA(ruA)
      setUrlB(ruB)
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
      try {
        const ratings = await getAllFileRatings()
        for (const r of ratings) {
          ratingsRef.current.set(r.file_id, { mu: r.mu, sigma: r.sigma })
          if (r.synced_rating !== undefined) {
            syncedRatingRef.current.set(r.file_id, r.synced_rating)
          }
        }
      } catch (e) {
        console.warn('Could not load saved ratings (starting fresh):', e)
      }
      const tagsRaw = localStorage.getItem('hydrus-smashpass-tags')
      const hasSavedTags = tagsRaw ? (() => { try { return JSON.parse(tagsRaw).length > 0 } catch { return false } })() : false
      if (!hasSavedTags) loadMatch()
    }
    init()
  }, [])

  useEffect(() => {
    if (smashPassTags.length > 0) setTagVersion((v) => v + 1)
  }, [smashPassTags.join(',')])

  async function decide(winner: 'left' | 'right' | 'draw') {
    if (!fileA || !fileB) return

    const ratingA = ratingsRef.current.get(fileA.file_id) || createRating()
    const ratingB = ratingsRef.current.get(fileB.file_id) || createRating()

    let newA: TrueSkillRating
    let newB: TrueSkillRating

    if (winner === 'left') {
      const result = rate(ratingA, ratingB)
      newA = result.winner
      newB = result.loser
      setStats((s) => ({ ...s, wins: s.wins + 1 }))
    } else if (winner === 'right') {
      const result = rate(ratingB, ratingA)
      newB = result.winner
      newA = result.loser
      setStats((s) => ({ ...s, wins: s.wins + 1 }))
    } else {
      newA = ratingA
      newB = ratingB
      setStats((s) => ({ ...s, draws: s.draws + 1 }))
    }

    ratingsRef.current.set(fileA.file_id, newA)
    ratingsRef.current.set(fileB.file_id, newB)

    if (winner !== 'draw' && ratingServiceKey) {
      const WINNER_INC = 5
      const LOSER_DEC = 2

      const winnerId = winner === 'left' ? fileA.file_id : fileB.file_id
      const loserId = winner === 'left' ? fileB.file_id : fileA.file_id

      const winnerNew = (syncedRatingRef.current.get(winnerId) ?? 0) + WINNER_INC
      const loserNew = Math.max(0, (syncedRatingRef.current.get(loserId) ?? 0) - LOSER_DEC)

      try {
        await Promise.all([
          setRating({ file_id: winnerId, rating_service_key: ratingServiceKey, rating: winnerNew }),
          setRating({ file_id: loserId, rating_service_key: ratingServiceKey, rating: loserNew }),
        ])
        syncedRatingRef.current.set(winnerId, winnerNew)
        syncedRatingRef.current.set(loserId, loserNew)
      } catch (e) {
        console.error('Failed to set ratings:', e)
      }
    }

    const persistTs = Date.now()

    try {
      await Promise.all([
        upsertFileRating({ file_id: fileA.file_id, file_hash: fileA.hash, mu: newA.mu, sigma: newA.sigma, synced_rating: syncedRatingRef.current.get(fileA.file_id), timestamp: persistTs }),
        upsertFileRating({ file_id: fileB.file_id, file_hash: fileB.hash, mu: newB.mu, sigma: newB.sigma, synced_rating: syncedRatingRef.current.get(fileB.file_id), timestamp: persistTs }),
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

    queueIndexRef.current += 2
    loadMatch()
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
    fillQueue().then(() => {
      queueIndexRef.current = 0
      loadMatch()
    })
  }, [tagVersion])

  const votingOpen = !loading && fileA && fileB && urlA && urlB

  return (
    <div className="flex flex-col h-full">
      <div className="px-2 pt-1">
        <TagSearch tags={smashPassTags} onTagsChange={(t) => { setSmashPassTags(t); setTagVersion((v) => v + 1) }} />
      </div>
      <div className="flex justify-center gap-6 py-2 text-sm text-gray-500">
        <span>Wins <b className="text-green-400">{stats.wins}</b></span>
        <span>Draws <b className="text-yellow-400">{stats.draws}</b></span>
        <span className="text-gray-400">Queue: <b>{Math.max(0, fileIdsRef.current.length - queueIndexRef.current)}</b></span>
      </div>

      <div className="flex-1 flex gap-2 p-2 min-h-0">
        {loading && (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Loading...
          </div>
        )}
        {!loading && (!fileA || !fileB) && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-4">
            <p className="text-lg">No more files!</p>
            <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={loadMatch}>
              Try Again
            </button>
          </div>
        )}

        {/* Left file */}
        <div
          className={`flex-1 relative bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center ${votingOpen ? 'cursor-pointer' : ''}`}
          onClick={() => votingOpen && decide('left')}
        >
          {urlA && fileA?.mime?.startsWith('video/')
            ? <video src={urlA} className="max-w-full max-h-full object-contain" controls autoPlay loop />
            : urlA
              ? <img src={urlA} alt="" className="max-w-full max-h-full object-contain" />
              : null
          }
          {votingOpen && fileA && (() => {
            const s = syncedRatingRef.current.get(fileA.file_id)
            const rating = (s ?? 0).toString() + ' ELO'
            return (
              <div className="absolute bottom-2 left-2 flex flex-col items-start gap-0.5">
                <span className="bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                  {rating}
                </span>
                <span className="bg-black/50 text-white text-xs px-2 py-0.5 rounded">
                  [← / A]
                </span>
              </div>
            )
          })()}
        </div>

        {/* Right file */}
        <div
          className={`flex-1 relative bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center ${votingOpen ? 'cursor-pointer' : ''}`}
          onClick={() => votingOpen && decide('right')}
        >
          {urlB && fileB?.mime?.startsWith('video/')
            ? <video src={urlB} className="max-w-full max-h-full object-contain" controls autoPlay loop />
            : urlB
              ? <img src={urlB} alt="" className="max-w-full max-h-full object-contain" />
              : null
          }
          {votingOpen && fileB && (() => {
            const s = syncedRatingRef.current.get(fileB.file_id)
            const rating = (s ?? 0).toString() + ' ELO'
            return (
              <div className="absolute bottom-2 right-2 flex flex-col items-end gap-0.5">
                <span className="bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                  {rating}
                </span>
                <span className="bg-black/50 text-white text-xs px-2 py-0.5 rounded">
                  [→ / D]
                </span>
              </div>
            )
          })()}
        </div>
      </div>

      {votingOpen && (
        <div className="flex justify-center gap-4 py-2 text-xs text-gray-500">
          <span className="text-green-400">← / A</span> choose left
          <span className="text-yellow-400">Space / S</span> draw
          <span className="text-green-400">→ / D</span> choose right
        </div>
      )}
    </div>
  )
}
