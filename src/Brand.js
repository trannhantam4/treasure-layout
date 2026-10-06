import {
  doc, setDoc, updateDoc, deleteDoc, getDoc,
  collection, query, where, getDocs, runTransaction, writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { assignmentKey, stampKey } from './utils/keys';

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
 * Batch create multiple brands in Firestore.
 * @param {Array<Object>} brandsList
 * @param {string} createdBy
 * @returns {Promise<Array<Object>>}
 */
export const batchCreateBrands = async (brandsList, createdBy) => {
  if (!brandsList || brandsList.length === 0) return [];
  const batch = writeBatch(db);
  const now = new Date().toISOString();
  const created = [];

  for (const b of brandsList) {
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
 * Batch assign multiple brands to an event via Firestore writeBatch.
 * @param {Array<{brand: Object, rank: string, position: string}>} items
 * @param {Object} event
 * @param {string} assignedBy
 * @returns {Promise<Array>}
 */
export const batchAssignBrandsToEvent = async (items, event, assignedBy) => {
  if (!items || items.length === 0) return [];
  const batch = writeBatch(db);
  const now = new Date().toISOString();
  const createdAssignments = [];

  for (const item of items) {
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
 * Get all event assignments for a specific brand (numeric brandId).
 */
export const getEventsForBrand = async (brandId) => {
  const q = query(collection(db, 'assignments'), where('brandId', '==', brandId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
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
 * Get or create the stamp ticket for a user at an event.
 * Slots are built from the provided treasureHolders array.
 * Syncs new slots if new treasure holders were added after ticket creation.
 */
export const getOrCreateStampTicket = async (eventId, userId, eventName, treasureHolders) => {
  const stampId = stampKey(eventId, userId);
  const stampRef = doc(db, 'stamps', stampId);
  const snap = await getDoc(stampRef);

  if (snap.exists()) {
    const existing = snap.data();
    const existingIds = new Set(existing.slots.map((s) => s.combinedId));
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
    if (newSlots.length > 0) {
      const merged = [...existing.slots, ...newSlots];
      await updateDoc(stampRef, { slots: merged });
      return { ...existing, slots: merged };
    }
    return existing;
  }

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
    userId, eventId, eventName,
    createdAt: new Date().toISOString(),
    slots,
  };
  await setDoc(stampRef, ticketData);
  return ticketData;
};

/**
 * Mark a stamp slot as collected after a QR scan.
 * Validates existence of slot and prevents double-stamping.
 * Checks if QR belongs to a different event via Firestore lookup.
 */
export const stampSlot = async (eventId, userId, combinedId) => {
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
  const snap = await getDoc(stampRef);

  if (!snap.exists()) {
    throw new Error('Stamp ticket not found. Please open your stamp card first.');
  }

  const ticket = snap.data();
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

  const updatedSlots = ticket.slots.map((s, i) =>
    i === slotIndex ? { ...s, stamped: true, stampedAt: new Date().toISOString() } : s
  );
  await updateDoc(stampRef, { slots: updatedSlots });
  return { ...ticket, slots: updatedSlots };
};

/**
 * Mark a completed stamp ticket as claimed.
 * Saves claimed: true, claimedAt, and claimedBy to prevent duplicate prize redemption.
 */
export const claimPrizeTicket = async (eventId, userId, staffName = 'Staff Organizer') => {
  const stampId = stampKey(eventId, userId);
  const stampRef = doc(db, 'stamps', stampId);
  const snap = await getDoc(stampRef);

  if (!snap.exists()) {
    throw new Error('Stamp ticket not found.');
  }

  const ticket = snap.data();
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
  };

  await updateDoc(stampRef, claimData);
  return { ...ticket, ...claimData };
};

