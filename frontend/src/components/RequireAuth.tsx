import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'checking') {
    return (
      <main className="auth-gate" id="main-content" aria-live="polite">
        <p className="eyebrow">Researcher access</p>
        <h1>Checking your sign-in…</h1>
      </main>
    )
  }

  if (status === 'unavailable') {
    return (
      <main className="auth-gate" id="main-content">
        <p className="eyebrow">Researcher access</p>
        <h1>Sign-in service unavailable</h1>
        <p>We could not verify your researcher session. Try signing in again shortly.</p>
        <Link to="/login" state={{ from: location }}>
          Go to sign in
        </Link>
      </main>
    )
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}
