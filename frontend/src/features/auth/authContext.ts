import { createContext } from 'react'
import type { AuthUser } from './authApi'

export type AuthStatus = 'checking' | 'anonymous' | 'authenticated' | 'unavailable'

export interface AuthState {
  status: AuthStatus
  user: AuthUser | null
}

export interface AuthContextValue extends AuthState {
  logIn: (username: string, password: string) => Promise<AuthUser>
  logOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
