const BASE_URL_STORAGE_KEY = 'hydrus-api-url'
const ACCESS_KEY_STORAGE_KEY = 'hydrus-api-access-key'

function getBaseUrl(): string {
  return localStorage.getItem(BASE_URL_STORAGE_KEY) || 'http://127.0.0.1:45869'
}

function getAccessKey(): string {
  return localStorage.getItem(ACCESS_KEY_STORAGE_KEY) || ''
}

export function setConnection(url: string, key: string) {
  localStorage.setItem(BASE_URL_STORAGE_KEY, url.replace(/\/+$/, ''))
  localStorage.setItem(ACCESS_KEY_STORAGE_KEY, key)
}

export function getConnection(): { url: string; key: string } {
  return { url: getBaseUrl(), key: getAccessKey() }
}

export function clearConnection() {
  localStorage.removeItem(BASE_URL_STORAGE_KEY)
  localStorage.removeItem(ACCESS_KEY_STORAGE_KEY)
}

function authParams(): Record<string, string> {
  const key = getAccessKey()
  return key ? { 'Hydrus-Client-API-Access-Key': key } : {}
}

function jsonEncodeForGet(obj: unknown): string {
  return JSON.stringify(obj)
}

function buildUrl(path: string, params?: Record<string, string>): string {
  const merged = { ...authParams(), ...params }
  const qp = new URLSearchParams(merged)
  const qs = qp.toString()
  return `${getBaseUrl()}${path}${qs ? '?' + qs : ''}`
}

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const res = await fetch(buildUrl(path, params))
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)
  const text = await res.text()
  return text ? JSON.parse(text) : undefined as T
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const key = getAccessKey()
  if (key) h['Hydrus-Client-API-Access-Key'] = key
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers: h,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)
  const text = await res.text()
  return text ? JSON.parse(text) : undefined as T
}

async function getBinary(path: string, params?: Record<string, string>): Promise<Blob> {
  const res = await fetch(buildUrl(path, params))
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)
  return res.blob()
}

async function apiVersionFetch(baseUrl: string, key?: string): Promise<number> {
  const params = key ? `?Hydrus-Client-API-Access-Key=${encodeURIComponent(key)}` : ''
  const url = `${baseUrl.replace(/\/+$/, '')}/api_version${params}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Status ${res.status}`)
  const data = await res.json()
  if (data.version === undefined) throw new Error('Invalid response')
  return data.version
}

export async function testConnection(url: string, key: string): Promise<number> {
  return apiVersionFetch(url, key)
}

export const api = {
  get,
  post,
  getBinary,
  jsonEncodeForGet,
}
