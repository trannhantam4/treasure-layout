import { analyticsPromise } from '../firebase';
import { logEvent, setUserId, setUserProperties } from 'firebase/analytics';

/**
 * Crashlytics & Analytics Service for Web Applications.
 *
 * Firebase Crashlytics is designed primarily for native mobile apps (iOS & Android).
 * On the Web, Firebase Analytics provides native `exception` logging that integrates
 * directly with Google Analytics 4 (GA4) / Firebase Console.
 *
 * This module provides a unified Crashlytics-like API:
 * - logCrash / recordError: Logs fatal and non-fatal errors to Firebase Analytics
 * - logEvent: Custom events tracking
 * - logPageView: Automatic or manual screen/page view tracking
 * - setUser: Associates user ID and role with errors and analytics
 * - addBreadcrumb: Context logging leading up to errors
 */

// In-memory buffer of recent breadcrumbs to attach to error reports
const breadcrumbs = [];
const MAX_BREADCRUMBS = 20;

export const crashlytics = {
  /**
   * Leave a lightweight breadcrumb trace for context before errors occur.
   */
  log(message, data = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      message,
      ...(Object.keys(data).length > 0 ? { data } : {}),
    };
    breadcrumbs.push(entry);
    if (breadcrumbs.length > MAX_BREADCRUMBS) {
      breadcrumbs.shift();
    }
  },

  /**
   * Record an error / exception to Firebase Analytics.
   * Mirrors the Firebase Crashlytics recordError() API.
   *
   * @param {Error|string} error - The caught exception or error object
   * @param {boolean} fatal - Whether this error caused a crash / halted execution
   * @param {object} context - Additional metadata/attributes to attach
   */
  async recordError(error, fatal = false, context = {}) {
    try {
      const description = typeof error === 'string'
        ? error
        : (error?.message || 'Unknown error');

      const stack = error?.stack ? error.stack.slice(0, 500) : '';

      console.error(`[Crashlytics Web] ${fatal ? 'FATAL' : 'NON-FATAL'} error:`, error, {
        context,
        breadcrumbs: [...breadcrumbs],
      });

      const analytics = await analyticsPromise;
      if (analytics) {
        logEvent(analytics, 'exception', {
          description: description.slice(0, 150),
          fatal,
          error_name: (error?.name || 'Error').slice(0, 50),
          error_stack: stack,
          ...context,
        });
      }
    } catch (err) {
      console.warn('[Crashlytics Web] Failed to send exception to analytics:', err);
    }
  },

  /**
   * Set user ID for both error reports and analytics metrics.
   */
  async setUserId(userId) {
    try {
      const analytics = await analyticsPromise;
      if (analytics && userId) {
        setUserId(analytics, String(userId));
      }
    } catch (err) {
      console.warn('[Crashlytics Web] Failed to set user ID:', err);
    }
  },

  /**
   * Set custom user properties (e.g. role, company).
   */
  async setUserProperties(properties = {}) {
    try {
      const analytics = await analyticsPromise;
      if (analytics && properties) {
        setUserProperties(analytics, properties);
      }
    } catch (err) {
      console.warn('[Crashlytics Web] Failed to set user properties:', err);
    }
  },

  /**
   * Log custom analytics event.
   */
  async logEvent(eventName, params = {}) {
    try {
      const analytics = await analyticsPromise;
      if (analytics) {
        logEvent(analytics, eventName, params);
      }
    } catch (err) {
      console.warn(`[Analytics] Failed to log event "${eventName}":`, err);
    }
  },

  /**
   * Log page/route navigation view.
   */
  async logPageView(pagePath, pageTitle) {
    try {
      const analytics = await analyticsPromise;
      if (analytics) {
        logEvent(analytics, 'page_view', {
          page_path: pagePath,
          page_title: pageTitle || document.title,
          page_location: window.location.href,
        });
      }
    } catch (err) {
      console.warn('[Analytics] Failed to log page view:', err);
    }
  },

  /**
   * Get recent breadcrumbs for debugging.
   */
  getBreadcrumbs() {
    return [...breadcrumbs];
  },
};

export default crashlytics;
