/**
 * Centralized compound key generators for Firestore document IDs.
 * Replaces manual `eventId + '-' + brandId` concatenation in Brand.js, StampTicket.jsx,
 * EventDetail.jsx, AssignBrandModal.jsx.
 */
export const assignmentKey = (eventId, brandId) => `${eventId}-${brandId}`;
export const stampKey = (eventId, userId) => `${eventId}-${userId}`;
