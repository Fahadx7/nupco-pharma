import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../lib/ipc'

export interface AuthUser {
  id: number
  name: string
  role: 'admin' | 'pharmacist' | 'cashier'
  pharmacyId: number
  pharmacyName: string
  setupDone: number
}

interface AuthState {
  token: string | null
  user:  AuthUser | null
  isLoading: boolean
  login:  (username: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  rehydrate: () => Promise<void>
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      token:     null,
      user:      null,
      isLoading: false,

      login: async (username, password) => {
        set({ isLoading: true })
        const res = await api.login({ username, password })
        set({ isLoading: false })
        if (res.ok) {
          set({ token: res.token, user: res.user })
          return { ok: true }
        }
        return { ok: false, error: res.error }
      },

      logout: () => {
        api.logout()
        set({ token: null, user: null })
      },

      rehydrate: async () => {
        const { token } = get()
        if (!token) return
        const res = await api.verify(token)
        if (!res.ok) set({ token: null, user: null })
        else {
          // Re-fetch fresh user data (role/name might have changed)
          set({ user: res.user })
        }
      },
    }),
    { name: 'nupco-auth', partialize: (s) => ({ token: s.token, user: s.user }) }
  )
)
