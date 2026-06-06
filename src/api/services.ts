import { api } from './client'
import { ServicesResponseSchema, type Service, isRatingService, type RatingService } from './types'

let cachedServices: Service[] | null = null

export async function fetchServices(): Promise<Service[]> {
  const data = await api.get<unknown>('/get_services')
  const parsed = ServicesResponseSchema.parse(data)
  cachedServices = parsed.services_v2
  return cachedServices
}

export function getCachedServices(): Service[] | null {
  return cachedServices
}

export function clearCachedServices() {
  cachedServices = null
}

export async function fetchRatingServices(): Promise<RatingService[]> {
  const services = await fetchServices()
  return services.filter(isRatingService) as RatingService[]
}

export async function fetchServiceByKey(key: string): Promise<Service | undefined> {
  const data = await api.get<{ service: Service }>('/get_service', { service_key: key })
  return data.service
}
