export interface AuthUser {
  username: string
  displayName?: string
}

interface AuthEnvelope {
  user: AuthUser
}

export class AuthApiError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.status = status
    this.name = 'AuthApiError'
  }
}

function isAuthEnvelope(value: unknown): value is AuthEnvelope {
  if (typeof value !== 'object' || value === null || !('user' in value)) return false

  const user = value.user
  return (
    typeof user === 'object' &&
    user !== null &&
    'username' in user &&
    typeof user.username === 'string' &&
    (!('displayName' in user) || typeof user.displayName === 'string')
  )
}

async function readResponseError(response: Response): Promise<AuthApiError> {
  const body: unknown = await response.json().catch(() => null)
  const detail =
    typeof body === 'object' &&
    body !== null &&
    'detail' in body &&
    typeof body.detail === 'string'
      ? body.detail
      : response.statusText

  return new AuthApiError(detail || `Request failed with status ${response.status}.`, response.status)
}

async function readAuthEnvelope(response: Response): Promise<AuthUser> {
  const body: unknown = await response.json().catch(() => null)
  if (!isAuthEnvelope(body)) {
    throw new AuthApiError('The sign-in service returned an unexpected response.', response.status)
  }

  return body.user
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch('/api/v1/auth/me', {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })

  if (response.status === 401) return null
  if (!response.ok) throw await readResponseError(response)

  return readAuthEnvelope(response)
}

export async function signIn(username: string, password: string): Promise<AuthUser> {
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  })

  if (!response.ok) throw await readResponseError(response)
  return readAuthEnvelope(response)
}

export async function signOut(): Promise<void> {
  const response = await fetch('/api/v1/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) throw await readResponseError(response)
}
