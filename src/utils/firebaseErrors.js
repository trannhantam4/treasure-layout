import { toast } from './toast';

/**
 * Centralized Firebase error handler.
 * Replaces duplicate offline/unavailable catch blocks in Events.jsx and EventDetail.jsx.
 */
export const handleFirebaseError = (error, action = 'complete this action') => {
  if (error.code === 'unavailable' || error.message?.includes('offline')) {
    toast.error('Failed to connect to Firebase. You appear to be offline or a browser extension is blocking the connection.');
  } else {
    toast.error(`Failed to ${action}: ${error.message}`);
  }
};
