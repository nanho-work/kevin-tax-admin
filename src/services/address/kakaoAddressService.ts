import axios from 'axios'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ''

export interface KakaoAddressItem {
  postal_code: string
  address1: string
  address2: string
}

export interface KakaoAddressSearchResponse {
  total: number
  page: number
  size: number
  items: KakaoAddressItem[]
}

export async function searchKakaoAddress(params: {
  query: string
  page?: number
  size?: number
  include_raw?: boolean
}): Promise<KakaoAddressSearchResponse> {
  const res = await axios.get<KakaoAddressSearchResponse>(`${API_BASE}/kakao/search-address`, {
    params: {
      query: params.query,
      page: params.page ?? 1,
      size: params.size ?? 10,
      include_raw: params.include_raw ?? false,
    },
    withCredentials: true,
  })
  return res.data
}

