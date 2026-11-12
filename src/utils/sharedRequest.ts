/** Share reads within one screen/load generation, never between accounts or mutations. */
export function createSharedRequest<K, V>(load: (key: K) => Promise<V>) {
  const requests = new Map<K, Promise<V>>()
  return (key: K): Promise<V> => {
    const existing = requests.get(key)
    if (existing) return existing
    const request = Promise.resolve().then(() => load(key)).catch(error => {
      if (requests.get(key) === request) requests.delete(key)
      throw error
    })
    requests.set(key, request)
    return request
  }
}
