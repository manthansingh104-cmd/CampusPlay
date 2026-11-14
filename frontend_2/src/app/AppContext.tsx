import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { loadData, resetData, saveData } from '../services/storage'
import type { AppData, Role, User } from '../types'

interface AppContextValue {
  data: AppData
  user: User | undefined
  role: Role
  updateData: (updater: (current: AppData) => AppData) => void
  signInDemo: (role: Role) => void
  signOut: () => void
  resetDemoData: () => void
  addUser: (user: User) => void
  toggleTheme: () => void
  toast: string
  showToast: (message: string) => void
  clearToast: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(loadData)
  const [toast, setToast] = useState('')
  const updateData = useCallback((updater: (current: AppData) => AppData) => {
    setData((current) => {
      const next = updater(current)
      saveData(next)
      return next
    })
  }, [])
  const signInDemo = useCallback((role: Role) => {
    updateData((current) => ({ ...current, session: { userId: role === 'student' ? 'student-01' : 'organizer-demo', role } }))
  }, [updateData])
  const signOut = useCallback(() => updateData((current) => ({ ...current, session: null })), [updateData])
  const resetDemoData = useCallback(() => setData(resetData()), [])
  const addUser = useCallback((user: User) => updateData((current) => ({ ...current, users: [user, ...current.users], session: { userId: user.id, role: user.role } })), [updateData])
  const toggleTheme = useCallback(() => updateData((current) => ({ ...current, theme: current.theme === 'light' ? 'dark' : 'light' })), [updateData])
  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }, [])
  const clearToast = useCallback(() => setToast(''), [])
  const role = data.session?.role ?? 'student'
  const user = data.session ? data.users.find((entry) => entry.id === data.session?.userId) : undefined

  useEffect(() => {
    document.documentElement.classList.toggle('dark', data.theme === 'dark')
    document.documentElement.dataset.theme = data.theme
  }, [data.theme])

  const value = useMemo(() => ({ data, user, role, updateData, signInDemo, signOut, resetDemoData, addUser, toggleTheme, toast, showToast, clearToast }), [data, user, role, updateData, signInDemo, signOut, resetDemoData, addUser, toggleTheme, toast, showToast, clearToast])
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp must be used inside AppProvider')
  return value
}
