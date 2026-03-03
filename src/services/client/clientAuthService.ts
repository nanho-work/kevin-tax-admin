import { clientHttp, clearClientAccessToken, setClientAccessToken } from '@/services/http'
import type { ClientLoginRequest, ClientSession } from '@/types/clientAuth'

const CLIENT_AUTH_BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/client/auth`

function parseClientSession(data: unknown): ClientSession {
  const session = data as Partial<ClientSession> | null
  if (
    !session ||
    typeof session.account_id !== 'number' ||
    typeof session.client_id !== 'number' ||
    typeof session.login_id !== 'string' ||
    typeof session.name !== 'string' ||
    typeof session.is_active !== 'boolean' ||
    typeof session.role_template_id !== 'number' ||
    typeof session.role_code !== 'string' ||
    typeof session.role_level !== 'number'
  ) {
    throw new Error('클라이언트 세션 응답 형식이 올바르지 않습니다.')
  }
  if (
    session.role_name !== undefined &&
    session.role_name !== null &&
    typeof session.role_name !== 'string'
  ) {
    throw new Error('클라이언트 세션 응답 형식이 올바르지 않습니다.')
  }
  return session as ClientSession
}

export async function clientLogin(data: ClientLoginRequest): Promise<{ access_token: string; session?: ClientSession }> {
  const res = await clientHttp.post(`${CLIENT_AUTH_BASE}/login`, data)
  const accessToken = res.data?.access_token as string | undefined
  if (!accessToken) {
    throw new Error('클라이언트 로그인 응답에 access_token이 없습니다.')
  }
  setClientAccessToken(accessToken)
  let session: ClientSession | undefined
  try {
    session = parseClientSession(res.data?.session ?? res.data?.account ?? res.data?.user)
  } catch {
    session = undefined
  }
  return { access_token: accessToken, session }
}

export async function checkClientSession(access_token?: string): Promise<ClientSession> {
  if (access_token) setClientAccessToken(access_token)
  const res = await clientHttp.get(`${CLIENT_AUTH_BASE}/session`, { timeout: 5000 })
  if (res.data?.access_token) {
    setClientAccessToken(res.data.access_token)
  }
  return parseClientSession(res.data)
}

export async function logoutClient(): Promise<void> {
  await clientHttp.post(`${CLIENT_AUTH_BASE}/logout`)
  clearClientAccessToken()
}
