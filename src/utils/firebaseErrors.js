import { toast } from './toast';
import { crashlytics } from './analytics';

/**
 * Centralized Firebase error handler.
 * Replaces duplicate offline/unavailable catch blocks in Events.jsx and EventDetail.jsx.
 * Also logs non-fatal exceptions to Crashlytics / Firebase Analytics.
 */
export const handleFirebaseError = (error, action = 'complete this action') => {
  crashlytics.recordError(error, false, { action, code: error?.code || 'unknown' });

  if (error.code === 'unavailable' || error.message?.includes('offline')) {
    toast.error('Failed to connect to Firebase. You appear to be offline or a browser extension is blocking the connection.');
  } else {
    toast.error(`Failed to ${action}: ${error.message}`);
  }
};
