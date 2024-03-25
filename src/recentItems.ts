/**
 * Pair of item code and priority
 */
type RecentItems = Map<string, number>

let recentItemsCache: RecentItems | undefined

const storageKey = 'carbs-calc/recentItems'
const maxRecentItems = 100
const decayFactor = 0.99

function handleStorageEvent(event: StorageEvent) {
  if (event.key === storageKey && recentItemsCache !== undefined) {
    const newRecentItems = loadRecentItems()
    for (const [key, value] of newRecentItems) {
      recentItemsCache.set(key, value)
    }
    for (const key of recentItemsCache.keys()) {
      if (!newRecentItems.has(key)) {
        recentItemsCache.delete(key)
      }
    }
  }
}

function loadRecentItems(): RecentItems {
  const recentItems = new Map<string, number>()

  try {
    const recentItemsString = localStorage.getItem(storageKey)
    if (recentItemsString) {
      const recentItemsObj = JSON.parse(recentItemsString)
      for (const [key, value] of Object.entries(recentItemsObj)) {
        if (typeof value === 'number') {
          recentItems.set(key, value)
        }
      }
    }
  } catch (e) {
    console.error('Failed to load recent items', e)
  }

  return recentItems
}

export function getRecentItems(): RecentItems {
  if (recentItemsCache !== undefined) {
    return recentItemsCache
  }

  recentItemsCache = loadRecentItems()

  window.addEventListener('storage', handleStorageEvent)

  return recentItemsCache
}

function saveRecentItems() {
  if (recentItemsCache === undefined) {
    return
  }

  const recentItemsObj: Record<string, number> = {}
  for (const [key, value] of recentItemsCache) {
    recentItemsObj[key] = value
  }

  const recentItemsString = JSON.stringify(
    recentItemsObj,
    (_key, value: unknown) => {
      // Round numbers to 2 decimal places
      if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.floor(value * 100) / 100
      }
      return value
    }
  )

  try {
    localStorage.setItem(storageKey, recentItemsString)
  } catch (e) {
    console.error('Failed to save recent items', e)
  }
}

/**
 * Add an item to the recent items
 *
 * If the number of recent items exceeds the maximum, the item with the lowest priority is removed.
 * More recent and more frequently used items have higher priority.
 */
export function addRecentItem(itemCode: string) {
  const recentItems = getRecentItems()

  // Decay all priorities
  for (const [itemCode, priority] of recentItems) {
    const newPriority = priority * decayFactor
    if (newPriority < 0.01) {
      recentItems.delete(itemCode)
    } else {
      recentItems.set(itemCode, newPriority)
    }
  }

  recentItems.set(itemCode, (recentItems.get(itemCode) ?? 0) + 1)

  if (recentItems.size > maxRecentItems) {
    const sortedItemCodes = Array.from(recentItems.keys()).sort(
      (a, b) => -(recentItems.get(a)! - recentItems.get(b)!)
    )
    const itemCodesToRemove = sortedItemCodes.slice(maxRecentItems)
    for (const itemCode of itemCodesToRemove) {
      recentItems.delete(itemCode)
    }
  }

  saveRecentItems()
}
