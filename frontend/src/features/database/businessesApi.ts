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

export interface BusinessDetail extends BusinessRecord {
  foundingYear: number | null
  firstAppearance: number | null
  endYear: number | null
  ifClosed: boolean | null
  ownershipType: string | null
  ownershipDemographic: string | null
  postal: string | null
  pointX: number | null
  pointY: number | null
  oldAddress: string | null
  phoneNumber: string | null
  website: string | null
  socialMedia: boolean | null
  facebookUrl: string | null
  instagramUrl: string | null
  youtubeUrl: string | null
  xUrl: string | null
  linkedinUrl: string | null
  sourceId: string | null
  newspaper: string | null
  cityDirectories: boolean | null
  googleModernBusiness: boolean | null
  linkOhInterview: string | null
  linkGbhStory: string | null
  notes: string | null
  createdAt: string | null
  updatedAt: string | null
  createdBy: string | null
  updatedBy: string | null
}

export type BusinessWriteInput = Omit<
  BusinessDetail,
  'id' | 'bizId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
> & {
  bizId?: string | null
  businessName: string
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
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'BusinessesApiError'
    this.status = status
  }
}

function validationDetail(value: unknown): string | null {
  if (!Array.isArray(value)) return null

  const first = value[0]
  if (typeof first !== 'object' || first === null) return null

  const message =
    'msg' in first && typeof first.msg === 'string' ? first.msg : 'The submitted value is invalid.'
  const location = 'loc' in first && Array.isArray(first.loc) ? first.loc.at(-1) : null
  return typeof location === 'string' ? `${location}: ${message}` : message
}

async function readError(response: Response): Promise<BusinessesApiError> {
  const body: unknown = await response.json().catch(() => null)
  let detail: string | null = null

  if (typeof body === 'object' && body !== null && 'detail' in body) {
    detail =
      typeof body.detail === 'string' ? body.detail : validationDetail(body.detail)
  }

  return new BusinessesApiError(
    detail || `The database request failed (${response.status}).`,
    response.status,
  )
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    headers: { Accept: 'application/json' },
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw await readError(response)
  }

  return (await response.json()) as T
}

async function sendJson<T>(
  path: string,
  method: 'POST' | 'PATCH',
  body: BusinessWriteInput,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    method,
    signal,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw await readError(response)
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

export async function fetchBusiness(
  id: number,
  signal?: AbortSignal,
): Promise<BusinessDetail> {
  return getJson<BusinessDetail>(`/api/v1/businesses/${id}`, signal)
}

export async function createBusiness(
  input: BusinessWriteInput,
  signal?: AbortSignal,
): Promise<BusinessDetail> {
  return sendJson<BusinessDetail>('/api/v1/businesses', 'POST', input, signal)
}

export async function updateBusiness(
  id: number,
  input: BusinessWriteInput,
  signal?: AbortSignal,
): Promise<BusinessDetail> {
  return sendJson<BusinessDetail>(`/api/v1/businesses/${id}`, 'PATCH', input, signal)
}
