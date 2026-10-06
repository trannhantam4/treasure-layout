/**
 * Centralized Firebase error handler.
 * Replaces duplicate offline/unavailable catch blocks in Events.jsx and EventDetail.jsx.
 */
export const handleFirebaseError = (error, action = 'complete this action') => {
  if (error.code === 'unavailable' || error.message?.includes('offline')) {
    alert('Failed to connect to Firebase. You appear to be offline or a browser extension is blocking the connection.');
  } else {
    alert(`Failed to ${action}: ${error.message}`);
  }
};
