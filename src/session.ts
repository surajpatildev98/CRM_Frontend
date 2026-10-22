import { isObject } from './api'
import type { JsonObject } from './api'

export type Session = { token: string; user: JsonObject }
const KEY = 'crm.frontend.session'

export function readSession(): Session | null {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) || 'null')
    return isObject(saved) && typeof saved.token === 'string' && saved.token.trim() && isObject(saved.user)
      ? { token: saved.token, user: saved.user } : null
  } catch { return null }
}

export function saveSession(session: Session) {
  try { localStorage.setItem(KEY, JSON.stringify(session)) }
  catch { throw new Error('Your browser blocked session storage. Allow local storage and sign in again.') }
}

export function clearSession() {
  try { localStorage.removeItem(KEY); return true } catch { return false }
}
