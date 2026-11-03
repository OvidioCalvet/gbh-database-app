export interface BusinessRecord {
  id: number
  bizId: string
  businessName: string
  broadIndustry: string | null
  specificIndustry: string | null
  appearanceDecade: string | null
  sourceYear: number | null
  race: string | null
  gender: string | null
  ownerName: string | null
  address: string | null
}

export interface BusinessPage {
  items: BusinessRecord[]
  total: number
  offset: number
  limit: number
}

export interface IndustryCount {
  name: string
  count: number
}

export class BusinessesApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BusinessesApiError'
  }
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    headers: { Accept: 'application/json' },
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw new BusinessesApiError(`The database request failed (${response.status}).`)
  }

  return (await response.json()) as T
}

export interface BusinessQuery {
  offset: number
  limit: number
  query?: string
  industry?: string | null
}

export async function fetchBusinesses(
  params: BusinessQuery,
  signal?: AbortSignal,
): Promise<BusinessPage> {
  const search = new URLSearchParams({
    offset: String(params.offset),
    limit: String(params.limit),
  })

  const query = params.query?.trim()
  if (query) {
    search.set('q', query)
  }
  if (params.industry) {
    search.set('industry', params.industry)
  }

  return getJson<BusinessPage>(`/api/v1/businesses?${search.toString()}`, signal)
}

export async function fetchIndustries(signal?: AbortSignal): Promise<IndustryCount[]> {
  const result = await getJson<{ items: IndustryCount[] }>(
    '/api/v1/businesses/industries',
    signal,
  )
  return result.items
}
