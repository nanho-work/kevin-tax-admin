import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ''
const CLIENT_AUTH_BASE = `${API_BASE}/client/auth`

const ADMIN_ACCESS_TOKEN_KEY = 'admin_access_token'
const CLIENT_ACCESS_TOKEN_KEY = 'client_access_token'

let adminAccessToken: string | null = null
let clientAccessToken: string | null = null
let isClientRefreshing = false
let pendingClientQueue: Array<(token: string | null) => void> = []

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean }

function processClientQueue(token: string | null) {
  pendingClientQueue.forEach((resolve) => resolve(token))
  pendingClientQueue = []
}

export function setAdminAccessToken(token: string | null) {
  adminAccessToken = token
  if (typeof window !== 'undefined') {
    if (token) window.sessionStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, token)
    else window.sessionStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY)
  }
}

export function getAdminAccessToken() {
  if (!adminAccessToken && typeof window !== 'undefined') {
    adminAccessToken = window.sessionStorage.getItem(ADMIN_ACCESS_TOKEN_KEY)
  }
  return adminAccessToken
}

export function clearAdminAccessToken() {
  adminAccessToken = null
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY)
  }
}

export function setClientAccessToken(token: string | null) {
  clientAccessToken = token
  if (typeof window !== 'undefined') {
    if (token) window.sessionStorage.setItem(CLIENT_ACCESS_TOKEN_KEY, token)
    else window.sessionStorage.removeItem(CLIENT_ACCESS_TOKEN_KEY)
  }
}

export function getClientAccessToken() {
  if (!clientAccessToken && typeof window !== 'undefined') {
    clientAccessToken = window.sessionStorage.getItem(CLIENT_ACCESS_TOKEN_KEY)
  }
  return clientAccessToken
}

export function clearClientAccessToken() {
  clientAccessToken = null
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(CLIENT_ACCESS_TOKEN_KEY)
  }
}

export function clearAllAccessTokens() {
  clearAdminAccessToken()
  clearClientAccessToken()
}

// Backward compatibility for existing staff/admin service imports.
export const setAccessToken = setAdminAccessToken
export const getAccessToken = getAdminAccessToken
export const clearAccessToken = clearAdminAccessToken

export const adminHttp = axios.create({
  withCredentials: true,
})

adminHttp.interceptors.request.use((config) => {
  const token = getAdminAccessToken()
  if (token) {
    config.headers = config.headers || {}
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

export const clientHttp = axios.create({
  withCredentials: true,
})

clientHttp.interceptors.request.use((config) => {
  const token = getClientAccessToken()
  if (token) {
    config.headers = config.headers || {}
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

clientHttp.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryConfig | undefined
    const status = error.response?.status
    const requestUrl = originalRequest?.url || ''
    const isClientAuthEndpoint =
      requestUrl.includes('/client/auth/login') ||
      requestUrl.includes('/client/auth/refresh') ||
      requestUrl.includes('/client/auth/logout')

    if (!originalRequest || status !== 401 || originalRequest._retry || isClientAuthEndpoint) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    if (isClientRefreshing) {
      return new Promise((resolve, reject) => {
        pendingClientQueue.push((token) => {
          if (!token) {
            reject(error)
            return
          }
          originalRequest.headers = originalRequest.headers || {}
          originalRequest.headers.Authorization = `Bearer ${token}`
          resolve(clientHttp(originalRequest))
        })
      })
    }

    isClientRefreshing = true
    try {
      const refreshRes = await axios.post<{ access_token: string }>(
        `${CLIENT_AUTH_BASE}/refresh`,
        {},
        { withCredentials: true }
      )

      const newAccessToken = refreshRes.data?.access_token
      if (!newAccessToken) throw new Error('No client access token from refresh')

      setClientAccessToken(newAccessToken)
      processClientQueue(newAccessToken)

      originalRequest.headers = originalRequest.headers || {}
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      return clientHttp(originalRequest)
    } catch (refreshError) {
      clearClientAccessToken()
      processClientQueue(null)
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/client')) {
        window.location.href = '/login/client'
      }
      return Promise.reject(refreshError)
    } finally {
      isClientRefreshing = false
    }
  }
)

export default adminHttp
