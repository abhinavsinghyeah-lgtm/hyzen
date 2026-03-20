const CACHE_MS = 3000;

let cacheValue = null;
let cacheTs = 0;
let lastActionTs = 0;

function invalidate() {
  // Invalidate immediately; cache can only be reused if no actions occur
  // for at least CACHE_MS.
  lastActionTs = Date.now();
  cacheTs = 0;
}

async function getCachedContainers({ fetcher }) {
  const now = Date.now();

  const noRecentActions = now - lastActionTs >= CACHE_MS;
  const cacheFreshEnough = cacheValue && now - cacheTs <= CACHE_MS;

  if (cacheValue && noRecentActions && cacheFreshEnough) {
    return cacheValue;
  }

  const value = await fetcher();
  cacheValue = value;
  cacheTs = now;
  return value;
}

module.exports = {
  CACHE_MS,
  invalidate,
  getCachedContainers,
};

