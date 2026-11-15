/**
 * Shared fetch helper for the CampusPlay backend.
 * Set VITE_API_URL to the backend origin, for example:
 * https://your-backend.onrender.com
 */
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error('VITE_API_URL is not configured. Set it to your Render backend URL.')
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const headers = new Headers(options.headers)
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_BASE_URL}${normalizedPath}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const payload = await response.json() as { message?: string }
      if (payload.message) message = payload.message
    } catch {
      // Keep the status-based message when the response is not JSON.
    }
    throw new ApiError(message, response.status)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}