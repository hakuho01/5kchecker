const cache = new Map()

const TTL = 60 * 60 * 1000

export function getCache(key) {
  const item = cache.get(key)

  if (!item) return null

  if (Date.now() > item.expire) {
    cache.delete(key)
    return null
  }

  return item.value
}

export function setCache(key, value) {
  cache.set(key, {
    value,
    expire: Date.now() + TTL
  })
}