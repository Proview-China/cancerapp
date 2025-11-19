import Taro from '@tarojs/taro'

const API_BASE = (WECHATAPP_API_BASE as string) ?? 'http://localhost:4000'
const USE_DEMO = ((WECHATAPP_USE_DEMO as string) ?? 'true') === 'true'

export type HttpOptions = {
  method?: keyof Taro.request.Method
  data?: Record<string, unknown>
  headers?: Record<string, string>
}

export async function http<T>(path: string, options: HttpOptions = {}): Promise<T> {
  if (USE_DEMO) {
    throw new Error('Demo mode does not allow HTTP calls')
  }

  const response = await Taro.request<T>({
    url: `${API_BASE}${path}`,
    method: options.method ?? 'GET',
    data: options.data,
    header: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {})
    }
  })

  if (response.statusCode && response.statusCode >= 400) {
    throw new Error(response.errMsg)
  }

  return response.data
}

export const httpConfig = {
  apiBase: API_BASE,
  useDemo: USE_DEMO
}
