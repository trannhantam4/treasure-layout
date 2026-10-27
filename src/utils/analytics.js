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
const MAX_BREADCRUMBS = 30;

// In-memory log of recent critical process executions (for Admin Diagnostics)
const criticalProcessHistory = [];
const MAX_PROCESS_HISTORY = 25;

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
   * Wrap and monitor a critical asynchronous process with timing, breadcrumb logging,
   * analytics event tracking, and automatic error reporting.
   *
   * @param {string} processName - Identifier for the critical process (e.g. 'stamp_slot', 'claim_prize')
   * @param {Function} operationFn - Async function to execute
   * @param {object} metadata - Context metadata for diagnostics
   */
  async trackCriticalProcess(processName, operationFn, metadata = {}) {
    const startTime = performance.now();
    this.log(`[START] ${processName}`, metadata);

    try {
      const result = await operationFn();
      const durationMs = Math.round(performance.now() - startTime);

      const record = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        processName,
        status: 'success',
        durationMs,
        timestamp: new Date().toISOString(),
        metadata,
      };
      criticalProcessHistory.unshift(record);
      if (criticalProcessHistory.length > MAX_PROCESS_HISTORY) {
        criticalProcessHistory.pop();
      }

      this.log(`[SUCCESS] ${processName} (${durationMs}ms)`, metadata);
      this.logEvent('critical_process_success', {
        process_name: processName,
        duration_ms: durationMs,
        ...metadata,
      });

      return result;
    } catch (error) {
      const durationMs = Math.round(performance.now() - startTime);
      const record = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        processName,
        status: 'error',
        durationMs,
        errorMessage: error?.message || String(error),
        timestamp: new Date().toISOString(),
        metadata,
      };
      criticalProcessHistory.unshift(record);
      if (criticalProcessHistory.length > MAX_PROCESS_HISTORY) {
        criticalProcessHistory.pop();
      }

      await this.recordError(error, false, {
        critical_process: processName,
        duration_ms: durationMs,
        ...metadata,
      });
      throw error;
    }
  },

  /**
   * Get recent critical process executions for Admin System Health check.
   */
  getProcessHistory() {
    return [...criticalProcessHistory];
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
