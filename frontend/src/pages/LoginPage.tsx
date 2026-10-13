import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthApiError } from '../features/auth/authApi'
import { useAuth } from '../features/auth/useAuth'

interface LoginLocationState {
  from?: {
    pathname?: string
  }
}

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { status, logIn } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const locationState = location.state as LoginLocationState | null
  const requestedPath = locationState?.from?.pathname
  const redirectPath = requestedPath?.startsWith('/') && requestedPath !== '/login'
    ? requestedPath
    : '/data-entry'

  if (status === 'authenticated') {
    return <Navigate to="/data-entry" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await logIn(username.trim(), password)
      navigate(redirectPath, { replace: true })
    } catch (cause) {
      if (cause instanceof AuthApiError && cause.status === 401) {
        setError('The username or password was not recognized.')
      } else {
        setError('Sign-in is unavailable right now. Please try again shortly.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page" id="main-content">
      <section className="login-card" aria-labelledby="login-title">
        <p className="eyebrow">Researcher access</p>
        <h1 id="login-title">Log in</h1>
        <p className="login-card__description">
          Sign in to add new business records or update an existing record.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-form__field">
            <label htmlFor="login-username">Username</label>
            <input
              id="login-username"
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>

          <div className="login-form__field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error && (
            <p className="login-form__error" role="alert">
              {error}
            </p>
          )}

          <button className="login-form__submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="login-card__note">
          Researcher accounts are provided by the Gainesville Business History project team.
        </p>
      </section>
    </main>
  )
}
