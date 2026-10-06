import { get, set, del, clear, keys } from 'idb-keyval';

/** Default TTLs in minutes */
export const TTL_SHORT = 5;      // 5 minutes (for active events list)
export const TTL_MEDIUM = 30;    // 30 minutes (for event details)
export const TTL_LONG = 60 * 24;  // 24 hours (for global brand catalog)

/**
 * Save data to device IndexedDB with an optional TTL (in minutes).
 */
export async function setDeviceData(key, value, ttlMinutes = TTL_MEDIUM) {
  try {
    const record = {
      value,
      timestamp: Date.now(),
      ttlMs: ttlMinutes * 60 * 1000,
    };
    await set(key, record);
    return true;
  } catch (error) {
    console.warn(`[DeviceStorage] Failed to save key "${key}":`, error);
    return false;
  }
}

/**
 * Get data from device IndexedDB. Returns null if expired or not found.
 */
export async function getDeviceData(key) {
  try {
    const record = await get(key);
    if (!record) return null;

    const { value, timestamp, ttlMs } = record;
    if (ttlMs && Date.now() - timestamp > ttlMs) {
      // Expired — remove asynchronously and return null
      del(key).catch(() => {});
      return null;
    }
    return value;
  } catch (error) {
    console.warn(`[DeviceStorage] Failed to read key "${key}":`, error);
    return null;
  }
}

/**
 * Remove specific item from device IndexedDB.
 */
export async function removeDeviceData(key) {
  try {
    await del(key);
  } catch (error) {
    console.warn(`[DeviceStorage] Failed to delete key "${key}":`, error);
  }
}

/**
 * Clear all cached data on device.
 */
export async function clearDeviceStorage() {
  try {
    await clear();
  } catch (error) {
    console.warn('[DeviceStorage] Failed to clear storage:', error);
  }
}

/* ================================================================
   APPLICATION-SPECIFIC STORAGE HELPERS
   ================================================================ */

// 1. Events List Caching
const KEY_EVENTS_LIST = 'tl_events_list';
export async function cacheEventsList(events) {
  return setDeviceData(KEY_EVENTS_LIST, events, TTL_SHORT);
}
export async function getCachedEventsList() {
  return getDeviceData(KEY_EVENTS_LIST);
}

// 2. Single Event Detail Caching
export async function cacheEventDetail(eventId, eventData) {
  return setDeviceData(`tl_event_${eventId}`, eventData, TTL_MEDIUM);
}
export async function getCachedEventDetail(eventId) {
  return getDeviceData(`tl_event_${eventId}`);
}

// 3. Global Brand Catalog Caching
const KEY_BRANDS_CATALOG = 'tl_brands_catalog';
export async function cacheBrandCatalog(brands) {
  return setDeviceData(KEY_BRANDS_CATALOG, brands, TTL_LONG);
}
export async function getCachedBrandCatalog() {
  return getDeviceData(KEY_BRANDS_CATALOG);
}

// 4. User Stamp Ticket Caching
export async function cacheStampTicket(ticketId, ticketData) {
  return setDeviceData(`tl_stamp_${ticketId}`, ticketData, TTL_MEDIUM);
}
export async function getCachedStampTicket(ticketId) {
  return getDeviceData(`tl_stamp_${ticketId}`);
}

// 5. User Event Registration Caching
export async function cacheUserRegistration(eventId, userId, isRegistered) {
  return setDeviceData(`tl_reg_${eventId}_${userId}`, isRegistered, TTL_MEDIUM);
}
export async function getCachedUserRegistration(eventId, userId) {
  return getDeviceData(`tl_reg_${eventId}_${userId}`);
}

// 6. Treasure Hunt Opt-In Caching
export async function cacheTreasureHuntOptIn(eventId, userId, joinedHunt) {
  return setDeviceData(`tl_hunt_${eventId}_${userId}`, joinedHunt, TTL_LONG);
}
export async function getCachedTreasureHuntOptIn(eventId, userId) {
  return getDeviceData(`tl_hunt_${eventId}_${userId}`);
}

// 7. Storage Stats & Cleanup
export async function getStorageStats() {
  try {
    const allKeys = await keys();
    return {
      totalKeys: allKeys.length,
      keys: allKeys,
    };
  } catch {
    return { totalKeys: 0, keys: [] };
  }
}
