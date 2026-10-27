import {
  doc, setDoc, updateDoc, deleteDoc, getDoc,
  collection, query, where, getDocs, onSnapshot, runTransaction, writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { assignmentKey, stampKey, relativeKey } from './utils/keys';
import { cacheStampTicket, getCachedStampTicket } from './storage';
import { crashlytics } from './utils/analytics';


/**
 * Create a new global brand.
 * Assigns a cryptographically secure random alphanumeric brandId (first 8 chars of Firestore doc ID).
 */
export const createBrand = async (data, createdBy) => {
  const brandRef = doc(collection(db, 'brands'));
  const brandId = brandRef.id.substring(0, 8).toUpperCase();
  const brandData = {
    ...data,
    brandId,
    createdBy,
    createdAt: new Date().toISOString(),
  };
  await setDoc(brandRef, brandData);
  return { docId: brandRef.id, ...brandData };
};

/**
 * Batch create multiple brands in Firestore (chunked to respect Firestore's 500-op batch limit).
 * @param {Array<Object>} brandsList
 * @param {string} createdBy
 * @returns {Promise<Array<Object>>}
 */
const BATCH_CHUNK_SIZE = 450;

export const batchCreateBrands = async (brandsList, createdBy) => {
  if (!brandsList || brandsList.length === 0) return [];
  const now = new Date().toISOString();
  const created = [];

  for (let i = 0; i < brandsList.length; i += BATCH_CHUNK_SIZE) {
    const chunk = brandsList.slice(i, i + BATCH_CHUNK_SIZE);
    const batch = writeBatch(db);

    for (const b of chunk) {
      const brandRef = doc(collection(db, 'brands'));
      const brandId = brandRef.id.substring(0, 8).toUpperCase();
      const brandData = {
        brandName: (b.brandName || '').trim(),
        fieldOfWork: (b.fieldOfWork || '').trim(),
        companyEmail: (b.companyEmail || '').trim(),
        phone: (b.phone || '').trim(),
        companyAddress: (b.companyAddress || b.address || '').trim(),
        logoUrl: (b.logoUrl || '').trim(),
        brandId,
        createdBy,
        createdAt: now,
      };
      batch.set(brandRef, brandData);
      created.push({ docId: brandRef.id, ...brandData });
    }

    await batch.commit();
  }

  return created;
};

/**
 * Update an existing brand's fields.
 * Also batch-updates the brand snapshot in all related assignments.
 */
export const updateBrand = async (docId, data) => {
  const brandRef = doc(db, 'brands', docId);
  await updateDoc(brandRef, data);

  // Sync snapshot fields in all assignments for this brand
  const snapshotFields = {};
  if (data.brandName    !== undefined) snapshotFields.brandName    = data.brandName;
  if (data.logoUrl      !== undefined) snapshotFields.logoUrl      = data.logoUrl;
  if (data.fieldOfWork  !== undefined) snapshotFields.fieldOfWork  = data.fieldOfWork;
  if (data.companyEmail !== undefined) snapshotFields.companyEmail = data.companyEmail;
  if (data.phone        !== undefined) snapshotFields.phone        = data.phone;

  if (Object.keys(snapshotFields).length > 0) {
    const brandSnap = await getDoc(brandRef);
    if (!brandSnap.exists()) return;
    const { brandId } = brandSnap.data();

    const assignmentsQuery = query(
      collection(db, 'assignments'),
      where('brandId', '==', brandId)
    );
    const snap = await getDocs(assignmentsQuery);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.update(d.ref, snapshotFields));
    if (snap.docs.length > 0) await batch.commit();
  }
};

/**
 * Delete a brand and ALL its event assignments.
 */
export const deleteBrand = async (docId) => {
  const brandRef = doc(db, 'brands', docId);
  const brandSnap = await getDoc(brandRef);
  if (!brandSnap.exists()) throw new Error('Brand not found');
  const { brandId } = brandSnap.data();

  const assignmentsQuery = query(
    collection(db, 'assignments'),
    where('brandId', '==', brandId)
  );
  const snap = await getDocs(assignmentsQuery);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(brandRef);
  await batch.commit();
};

/**
 * Assign a global brand to an event.
 * Document ID = "{eventId}-{brandId}" (compound key).
 * Throws if already assigned.
 */
export const assignBrandToEvent = async (brand, event, { rank, position }, assignedBy) => {
  const combinedId = assignmentKey(event.eventId, brand.brandId);
  const assignmentRef = doc(db, 'assignments', combinedId);

  const existing = await getDoc(assignmentRef);
  if (existing.exists()) {
    throw new Error('Brand "' + brand.brandName + '" is already assigned to this event.');
  }

  const assignmentData = {
    combinedId,
    eventId: event.eventId,
    brandId: brand.brandId,
    brandDocId: brand.docId || '',

    rank: rank || 'silver',
    position: position || '',
    assignedAt: new Date().toISOString(),
    assignedBy,
    isTreasureHolder: false,

    brandName:    brand.brandName    || '',
    logoUrl:      brand.logoUrl      || '',
    fieldOfWork:  brand.fieldOfWork  || '',
    companyEmail: brand.companyEmail || '',
    phone:        brand.phone        || '',

    eventName:      event.eventName      || '',
    eventDateStart: event.eventDateStart || '',
    eventLocation:  event.eventLocation  || '',
  };

  await setDoc(assignmentRef, assignmentData);
  return assignmentData;
};

/**
 * Batch assign multiple brands to an event via Firestore writeBatch (chunked by 450).
 * @param {Array<{brand: Object, rank: string, position: string}>} items
 * @param {Object} event
 * @param {string} assignedBy
 * @returns {Promise<Array>}
 */
export const batchAssignBrandsToEvent = async (items, event, assignedBy) => {
  if (!items || items.length === 0) return [];
  const now = new Date().toISOString();
  const createdAssignments = [];

  for (let i = 0; i < items.length; i += BATCH_CHUNK_SIZE) {
    const chunk = items.slice(i, i + BATCH_CHUNK_SIZE);
    const batch = writeBatch(db);

    for (const item of chunk) {
      const combinedId = assignmentKey(event.eventId, item.brand.brandId);
      const assignmentRef = doc(db, 'assignments', combinedId);
      const assignmentData = {
        combinedId,
        eventId: event.eventId,
        brandId: item.brand.brandId,
        brandDocId: item.brand.docId || '',
        rank: item.rank || 'standard',
        position: item.position || '',
        assignedAt: now,
        assignedBy,
        isTreasureHolder: false,
        brandName: item.brand.brandName || '',
        logoUrl: item.brand.logoUrl || '',
        fieldOfWork: item.brand.fieldOfWork || '',
        companyEmail: item.brand.companyEmail || '',
        phone: item.brand.phone || '',
        eventName: event.eventName || '',
        eventDateStart: event.eventDateStart || '',
        eventLocation: event.eventLocation || '',
      };
      batch.set(assignmentRef, assignmentData);
      createdAssignments.push(assignmentData);
    }

    await batch.commit();
  }

  return createdAssignments;
};

/**
 * Update rank, position, or isTreasureHolder for an existing assignment.
 * Only whitelisted fields are written to prevent arbitrary field injection.
 */
const ASSIGNMENT_EDITABLE_FIELDS = ['rank', 'position', 'isTreasureHolder'];
export const updateAssignment = async (combinedId, updates) => {
  const filtered = Object.fromEntries(
    Object.entries(updates).filter(([k]) => ASSIGNMENT_EDITABLE_FIELDS.includes(k))
  );
  if (Object.keys(filtered).length === 0) return;
  await updateDoc(doc(db, 'assignments', combinedId), filtered);
};

/**
 * Remove a brand from an event (deletes the assignment doc).
 * The global brand itself is untouched.
 */
export const removeAssignment = async (combinedId) => {
  await deleteDoc(doc(db, 'assignments', combinedId));
};

/**
 * Get all brand assignments for a specific event.
 */
export const getBrandsForEvent = async (eventId) => {
  const q = query(collection(db, 'assignments'), where('eventId', '==', eventId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
};

/**
 * Real-time listener for brand assignments of an event.
 * Automatically synchronizes changes and returns unsubscribe function.
 */
export const subscribeBrandsForEvent = (eventId, onUpdate, onError) => {
  const q = query(collection(db, 'assignments'), where('eventId', '==', eventId));
  return onSnapshot(
    q,
    (snap) => {
      onUpdate(snap.docs.map((d) => d.data()));
    },
    onError
  );
};

/**
 * Get all event assignments for a specific brand (numeric brandId).
 */
export const getEventsForBrand = async (brandId) => {
  const q = query(collection(db, 'assignments'), where('brandId', '==', brandId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
};

/**
 * Increment a global counter atomically using runTransaction.
 */
export const incrementCounter = async (counterName = 'userCounter') => {
  const counterRef = doc(db, 'counters', counterName);
  return await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    const newCount = counterDoc.exists() ? (counterDoc.data().count || 0) + 1 : 1;
    transaction.set(counterRef, { count: newCount }, { merge: true });
    return newCount;
  });
};

/**
 * Increment user display-ID counter and return formatted ID like "USR-00001".
 */
export const generateUserDisplayId = async () => {
  const count = await incrementCounter('userCounter');
  return 'USR-' + String(count).padStart(5, '0');
};

// ─────────────────────────────────────────────────────────
// Treasure Hunt helpers
// ─────────────────────────────────────────────────────────

/**
 * Toggle the "Treasure Holder" flag on an assignment.
 * A treasure holder gets a QR code and a stamp slot on user tickets.
 */
export const setTreasureHolder = async (combinedId, isHolder) => {
  await updateDoc(doc(db, 'assignments', combinedId), { isTreasureHolder: isHolder });
};

/**
 * Record a brand booth visit in the 'relative' collection.
 * Document ID = "{eventId}-{brandId}-{userId}"
 */
export const recordBrandVisit = async ({
  eventId,
  eventName,
  brandId,
  brandName,
  logoUrl,
  userId,
  visitedAt,
  userProfile = null,
}) => {
  if (!eventId || !brandId || !userId) return null;
  const relId = relativeKey(eventId, brandId, userId);
  const relRef = doc(db, 'relative', relId);

  let visitor = userProfile;
  if (!visitor || (!visitor.fullName && !visitor.name && !visitor.email)) {
    try {
      const userSnap = await getDoc(doc(db, 'users', userId));
      if (userSnap.exists()) {
        visitor = userSnap.data();
      }
    } catch (err) {
      console.warn('Could not fetch visitor profile for relative record:', err);
    }
  }

  const relativeData = {
    relativeId: relId,
    combinedId: assignmentKey(eventId, brandId),
    eventId,
    eventName: eventName || '',
    brandId,
    brandName: brandName || '',
    brandLogoUrl: logoUrl || '',
    userId,
    visitorName: visitor?.fullName || visitor?.name || visitor?.userName || 'Visitor',
    visitorEmail: visitor?.email || '',
    visitorPhone: visitor?.phone || '',
    visitorCompany: visitor?.company || '',
    visitorPosition: visitor?.position || '',
    visitorAddress: visitor?.address || '',
    visitorDisplayId: visitor?.displayId || '',
    visitorPhotoURL: visitor?.photoURL || '',
    visitedAt: visitedAt || new Date().toISOString(),
  };

  await setDoc(relRef, relativeData, { merge: true });
  return relativeData;
};

/**
 * Helper to reconcile a ticket's slots with the current list of event treasureHolders.
 * Preserves any already-stamped slots and adds any newly assigned treasureHolders.
 */
const reconcileTicketSlots = (existingSlots = [], treasureHolders = []) => {
  const holderIds = new Set(treasureHolders.map((th) => th.combinedId));
  // Keep slots that are still active treasure holders OR have already been stamped
  const retainedSlots = existingSlots.filter(
    (s) => holderIds.has(s.combinedId) || s.stamped
  );
  const existingIds = new Set(retainedSlots.map((s) => s.combinedId));
  const newSlots = treasureHolders
    .filter((th) => !existingIds.has(th.combinedId))
    .map((th) => ({
      combinedId: th.combinedId,
      brandId:    th.brandId,
      brandName:  th.brandName,
      logoUrl:    th.logoUrl || '',
      stamped:    false,
      stampedAt:  null,
    }));
  return [...retainedSlots, ...newSlots];
};

/**
 * Get or create the stamp ticket for a user at an event.
 * - In-progress stamp tickets (0 to N-1 stamps) live strictly on the user's device
 *   (IndexedDB via cacheStampTicket) with zero Firestore writes to '/stamps'.
 * - Only fully completed stamp tickets (all slots stamped) are pushed to Firestore.
 */
export const getOrCreateStampTicket = async (eventId, userId, eventName, treasureHolders, userProfile = null) => {
  const stampId = stampKey(eventId, userId);
  const stampRef = doc(db, 'stamps', stampId);

  // 1. Check local device storage first (primary store for in-progress tickets)
  const localTicket = await getCachedStampTicket(stampId);
  if (localTicket && Array.isArray(localTicket.slots)) {
    const mergedSlots = reconcileTicketSlots(localTicket.slots, treasureHolders);
    const allDone = mergedSlots.length > 0 && mergedSlots.every((s) => s.stamped);
    const updatedLocal = {
      ...localTicket,
      eventName: eventName || localTicket.eventName || '',
      slots: mergedSlots,
    };

    // If not all slots are stamped yet, keep exclusively on device (0 Firestore reads/writes!)
    if (!allDone) {
      await cacheStampTicket(stampId, updatedLocal);
      return updatedLocal;
    }

    // All slots are stamped! Ensure it is pushed to Firestore once.
    if (!updatedLocal.syncedToFirestore) {
      const completedTicket = {
        ...updatedLocal,
        completedAt: updatedLocal.completedAt || new Date().toISOString(),
        syncedToFirestore: true,
      };
      await setDoc(stampRef, completedTicket, { merge: true });
      await cacheStampTicket(stampId, completedTicket);
      return completedTicket;
    }

    // Already synced to Firestore; if not yet claimed locally, check Firestore in case staff redeemed it
    if (!updatedLocal.claimed) {
      try {
        const snap = await getDoc(stampRef);
        if (snap.exists()) {
          const remote = snap.data();
          const synced = {
            ...updatedLocal,
            ...remote,
            slots: reconcileTicketSlots(remote.slots || mergedSlots, treasureHolders),
            syncedToFirestore: true,
          };
          await cacheStampTicket(stampId, synced);
          return synced;
        }
      } catch {
        // Offline or unreachable — return local copy
      }
    }

    await cacheStampTicket(stampId, updatedLocal);
    return updatedLocal;
  }

  // 2. No local ticket in IndexedDB — check Firestore once in case user already completed on another device
  try {
    const snap = await getDoc(stampRef);
    if (snap.exists()) {
      const existing = snap.data();
      // Backfill any already-stamped slots into 'relative' asynchronously
      if (Array.isArray(existing.slots)) {
        existing.slots
          .filter((s) => s.stamped && s.brandId)
          .forEach((s) => {
            recordBrandVisit({
              eventId,
              eventName: existing.eventName || eventName || '',
              brandId: s.brandId,
              brandName: s.brandName || '',
              logoUrl: s.logoUrl || '',
              userId,
              visitedAt: s.stampedAt,
              userProfile,
            }).catch(() => {});
          });
      }

      const mergedSlots = reconcileTicketSlots(existing.slots || [], treasureHolders);
      const allDone = mergedSlots.length > 0 && mergedSlots.every((s) => s.stamped);
      const remoteTicket = {
        ...existing,
        slots: mergedSlots,
        syncedToFirestore: allDone,
      };
      await cacheStampTicket(stampId, remoteTicket);
      return remoteTicket;
    }
  } catch (err) {
    console.warn('Could not check remote stamp ticket, initializing locally:', err);
  }

  // 3. Initialize new ticket locally in IndexedDB ONLY (0 Firestore writes!)
  const slots = treasureHolders.map((th) => ({
    combinedId: th.combinedId,
    brandId:    th.brandId,
    brandName:  th.brandName,
    logoUrl:    th.logoUrl || '',
    stamped:    false,
    stampedAt:  null,
  }));
  const ticketData = {
    ticketId: stampId,
    userId,
    eventId,
    eventName,
    createdAt: new Date().toISOString(),
    syncedToFirestore: false,
    slots,
  };
  await cacheStampTicket(stampId, ticketData);
  return ticketData;
};

/**
 * Mark a stamp slot as collected after a QR scan.
 * - Updates the stamp ticket in device storage (IndexedDB) on every scan.
 * - ONLY pushes the '/stamps/{eventId}-{userId}' document to Firestore when ALL slots
 *   on the ticket are stamped (allDone === true), saving Firestore write traffic and cost.
 * - Also records the booth visit in the 'relative' collection ("{eventId}-{brandId}-{userId}").
 */
export const stampSlot = async (eventId, userId, combinedId, userProfile = null) => {
  return crashlytics.trackCriticalProcess(
    'stamp_slot',
    async () => {
      if (!eventId || !userId || !combinedId) {
        throw new Error('Missing event, user, or QR code identifier.');
      }

      // Extract eventId from combinedId to verify if it belongs to this event
      const dashIndex = combinedId.indexOf('-');
      if (dashIndex === -1) {
        throw new Error('Invalid QR code format.');
      }
      const qrEventId = combinedId.substring(0, dashIndex);
      if (qrEventId !== eventId) {
        throw new Error('This QR code belongs to a different event.');
      }

      const stampId = stampKey(eventId, userId);
      const stampRef = doc(db, 'stamps', stampId);

      // Load ticket from local IndexedDB first; fall back to Firestore only if missing locally
      let ticket = await getCachedStampTicket(stampId);
      if (!ticket) {
        const snap = await getDoc(stampRef);
        if (snap.exists()) {
          ticket = snap.data();
        }
      }

      if (!ticket || !Array.isArray(ticket.slots)) {
        throw new Error('Stamp ticket not found. Please open your stamp card first.');
      }

      const slotIndex = ticket.slots.findIndex((s) => s.combinedId === combinedId);

      if (slotIndex === -1) {
        // Check if the brand is actually assigned to this event but not a treasure hunt participant
        const assignSnap = await getDoc(doc(db, 'assignments', combinedId));
        if (assignSnap.exists()) {
          if (assignSnap.data().eventId !== eventId) {
            throw new Error('This QR code belongs to a different event.');
          }
          if (!assignSnap.data().isTreasureHolder) {
            throw new Error('This brand is not participating in the treasure hunt.');
          }
        }
        throw new Error('This brand is not a participant at this event.');
      }

      if (ticket.slots[slotIndex].stamped) {
        throw new Error('Stamp already collected for "' + ticket.slots[slotIndex].brandName + '".');
      }

      const stampedAt = new Date().toISOString();
      const targetSlot = ticket.slots[slotIndex];
      const updatedSlots = ticket.slots.map((s, i) =>
        i === slotIndex ? { ...s, stamped: true, stampedAt } : s
      );

      const allDone = updatedSlots.length > 0 && updatedSlots.every((s) => s.stamped);

      const updatedTicket = {
        ...ticket,
        slots: updatedSlots,
        ...(allDone
          ? { completedAt: stampedAt, syncedToFirestore: true }
          : { syncedToFirestore: false }),
      };

      // Always persist immediately to local device storage
      const savedLocally = await cacheStampTicket(stampId, updatedTicket);
      if (!savedLocally) {
        console.warn('[CriticalCheck] Device storage write returned false for stamp ticket:', stampId);
      }

      // ONLY push to Firestore '/stamps' collection when all slots are completed!
      if (allDone) {
        await setDoc(stampRef, updatedTicket, { merge: true });
      }

      // Write visit record to 'relative' collection with ID "{eventId}-{brandId}-{userId}"
      const brandId = targetSlot.brandId || combinedId.substring(dashIndex + 1);
      try {
        await recordBrandVisit({
          eventId,
          eventName: ticket.eventName || '',
          brandId,
          brandName: targetSlot.brandName || '',
          logoUrl: targetSlot.logoUrl || '',
          userId,
          visitedAt: stampedAt,
          userProfile,
        });
      } catch (err) {
        console.warn('Error saving brand visit to relative collection:', err);
      }

      return updatedTicket;
    },
    { event_id: eventId, combined_id: combinedId }
  );
};

/**
 * Real-time listener for visitors in the 'relative' collection.
 * If brandId is provided (and not 'ALL'), filters by brandId; otherwise fetches all records.
 */
export const subscribeBrandVisitors = (brandId, onUpdate, onError) => {
  const q = brandId && brandId !== 'ALL'
    ? query(collection(db, 'relative'), where('brandId', '==', brandId))
    : collection(db, 'relative');

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.visitedAt || 0) - new Date(a.visitedAt || 0));
      onUpdate(list);
    },
    onError
  );
};

/**
 * Sync existing stamped slots from '/stamps' into '/relative' collection
 * (useful for backfilling historical visits recorded prior to the 'relative' collection).
 */
export const syncExistingStampsToRelative = async () => {
  const [stampsSnap, usersSnap] = await Promise.all([
    getDocs(collection(db, 'stamps')),
    getDocs(collection(db, 'users')).catch(() => null),
  ]);

  const usersMap = new Map();
  if (usersSnap) {
    usersSnap.docs.forEach((uDoc) => {
      usersMap.set(uDoc.id, uDoc.data());
    });
  }

  let syncedCount = 0;
  const operations = [];

  stampsSnap.docs.forEach((docSnap) => {
    const ticket = docSnap.data();
    const { eventId, eventName, userId, slots } = ticket;
    if (!eventId || !userId || !Array.isArray(slots)) return;

    const visitor = usersMap.get(userId) || null;
    slots.forEach((slot) => {
      if (!slot.stamped) return;
      const dashIdx = (slot.combinedId || '').indexOf('-');
      const brandId = slot.brandId || (dashIdx !== -1 ? slot.combinedId.substring(dashIdx + 1) : '');
      if (!brandId) return;

      const relId = relativeKey(eventId, brandId, userId);
      const relRef = doc(db, 'relative', relId);
      const relativeData = {
        relativeId: relId,
        combinedId: slot.combinedId || assignmentKey(eventId, brandId),
        eventId,
        eventName: eventName || '',
        brandId,
        brandName: slot.brandName || '',
        brandLogoUrl: slot.logoUrl || '',
        userId,
        visitorName: visitor?.fullName || visitor?.name || visitor?.userName || 'Visitor',
        visitorEmail: visitor?.email || '',
        visitorPhone: visitor?.phone || '',
        visitorCompany: visitor?.company || '',
        visitorPosition: visitor?.position || '',
        visitorAddress: visitor?.address || '',
        visitorDisplayId: visitor?.displayId || '',
        visitorPhotoURL: visitor?.photoURL || '',
        visitedAt: slot.stampedAt || ticket.createdAt || new Date().toISOString(),
      };
      operations.push({ ref: relRef, data: relativeData });
    });
  });

  for (let i = 0; i < operations.length; i += BATCH_CHUNK_SIZE) {
    const chunk = operations.slice(i, i + BATCH_CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((op) => {
      batch.set(op.ref, op.data, { merge: true });
      syncedCount++;
    });
    await batch.commit();
  }

  return syncedCount;
};

/**
 * Mark a completed stamp ticket as claimed.
 * Saves claimed: true, claimedAt, and claimedBy to prevent duplicate prize redemption.
 */
export const claimPrizeTicket = async (eventId, userId, staffName = 'Staff Organizer') => {
  return crashlytics.trackCriticalProcess(
    'claim_prize_ticket',
    async () => {
      if (!eventId || !userId) {
        throw new Error('Missing eventId or userId for prize claim.');
      }

      const stampId = stampKey(eventId, userId);
      const stampRef = doc(db, 'stamps', stampId);
      const snap = await getDoc(stampRef);

      let ticket = snap.exists() ? snap.data() : await getCachedStampTicket(stampId);
      if (!ticket) {
        throw new Error('Stamp ticket not found.');
      }

      const allDone = ticket.slots && ticket.slots.length > 0 && ticket.slots.every((s) => s.stamped);
      if (!allDone) {
        throw new Error('Cannot claim prize: not all stamps have been collected yet.');
      }

      if (ticket.claimed) {
        throw new Error('This prize was already claimed on ' + new Date(ticket.claimedAt).toLocaleString());
      }

      const claimData = {
        claimed: true,
        claimedAt: new Date().toISOString(),
        claimedBy: staffName,
        syncedToFirestore: true,
      };

      const claimedTicket = { ...ticket, ...claimData };
      await setDoc(stampRef, claimedTicket, { merge: true });
      await cacheStampTicket(stampId, claimedTicket);
      return claimedTicket;
    },
    { event_id: eventId, staff: staffName }
  );
};


