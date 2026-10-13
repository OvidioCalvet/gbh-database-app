import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchCurrentUser, signIn, signOut } from './authApi'
import { AuthContext } from './authContext'
import type { AuthState } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ status: 'checking', user: null })
  const requestVersion = useRef(0)

  useEffect(() => {
    const version = ++requestVersion.current

    fetchCurrentUser()
      .then((user) => {
        if (version === requestVersion.current) {
          setAuth({ status: user ? 'authenticated' : 'anonymous', user })
        }
      })
      .catch(() => {
        if (version === requestVersion.current) {
          setAuth({ status: 'unavailable', user: null })
        }
      })

    return () => {
      requestVersion.current += 1
    }
  }, [])

  const logIn = useCallback(async (username: string, password: string) => {
    const version = ++requestVersion.current
    const user = await signIn(username, password)

    if (version === requestVersion.current) {
      setAuth({ status: 'authenticated', user })
    }

    return user
  }, [])

  const logOut = useCallback(async () => {
    const version = ++requestVersion.current
    await signOut()

    if (version === requestVersion.current) {
      setAuth({ status: 'anonymous', user: null })
    }
  }, [])

  return <AuthContext.Provider value={{ ...auth, logIn, logOut }}>{children}</AuthContext.Provider>
}
