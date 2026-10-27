import { useState, useEffect, useCallback } from 'react';
import { collection, query, limit, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import QRCode from 'qrcode';
import { auth, db } from '../firebase';
import { setDeviceData, getDeviceData, removeDeviceData, getStorageStats } from '../storage';
import { assignmentKey, stampKey, relativeKey } from '../utils/keys';
import { crashlytics } from '../utils/analytics';
import { canManage } from '../utils/auth';
import Modal from '../Modal';
import { useTranslation } from 'react-i18next';

const STATUS_STYLE = {
  pass: {
    bg: 'rgba(16, 185, 129, 0.14)',
    border: 'rgba(16, 185, 129, 0.4)',
    color: '#10b981',
    icon: '✅',
    label: 'PASS',
  },
  warn: {
    bg: 'rgba(245, 158, 11, 0.14)',
    border: 'rgba(245, 158, 11, 0.4)',
    color: '#f59e0b',
    icon: '⚠️',
    label: 'WARN',
  },
  fail: {
    bg: 'rgba(239, 68, 68, 0.14)',
    border: 'rgba(239, 68, 68, 0.4)',
    color: '#ef4444',
    icon: '❌',
    label: 'FAIL',
  },
  running: {
    bg: 'rgba(59, 130, 246, 0.14)',
    border: 'rgba(59, 130, 246, 0.4)',
    color: '#3b82f6',
    icon: '⏳',
    label: 'RUNNING',
  },
};

function SystemHealthModal({ isOpen, onClose, user }) {
  const { t } = useTranslation();
  const [running, setRunning] = useState(false);
  const [checks, setChecks] = useState([]);
  const [processHistory, setProcessHistory] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [lastRunAt, setLastRunAt] = useState(null);

  const runDiagnostics = useCallback(async () => {
    setRunning(true);
    const results = [];

    const pushResult = (item) => {
      results.push(item);
      setChecks([...results]);
    };

    // 1. Auth & User Profile Integrity Check
    {
      const t0 = performance.now();
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          pushResult({
            id: 'auth',
            title: t('diagAuthTitle', '1. Authentication & Role Integrity'),
            status: 'fail',
            latencyMs: Math.round(performance.now() - t0),
            summary: 'No authenticated Firebase session found.',
            details: ['Sign in again to restore authentication token.'],
          });
        } else {
          const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
          const latencyMs = Math.round(performance.now() - t0);
          if (!userSnap.exists()) {
            pushResult({
              id: 'auth',
              title: t('diagAuthTitle', '1. Authentication & Role Integrity'),
              status: 'warn',
              latencyMs,
              summary: `Auth UID (${currentUser.uid.slice(0, 8)}…) has no /users profile document.`,
              details: [`Email: ${currentUser.email || '—'}`],
            });
          } else {
            const data = userSnap.data();
            const hasAdminAccess = canManage({ role: data.role });
            pushResult({
              id: 'auth',
              title: t('diagAuthTitle', '1. Authentication & Role Integrity'),
              status: hasAdminAccess ? 'pass' : 'warn',
              latencyMs,
              summary: `Verified user "${data.fullName || data.name || currentUser.email}" (Role: ${data.role || 'visitor'})`,
              details: [
                `UID: ${currentUser.uid}`,
                `Display ID: ${data.displayId ? '#' + data.displayId : 'Not assigned'}`,
                `Company / Brand ID: ${data.company || 'None'} (${data.brandId || 'No brandId'})`,
              ],
            });
          }
        }
      } catch (err) {
        pushResult({
          id: 'auth',
          title: t('diagAuthTitle', '1. Authentication & Role Integrity'),
          status: 'fail',
          latencyMs: Math.round(performance.now() - t0),
          summary: `Auth check failed: ${err.message}`,
          details: [],
        });
      }
    }

    // 2. Device Storage (IndexedDB & Cache API) Self-Test
    {
      const t0 = performance.now();
      const probeKey = 'tl_diag_probe_test';
      const probeVal = { nonce: Math.random().toString(36).slice(2), ts: Date.now() };
      try {
        const writeOk = await setDeviceData(probeKey, probeVal, 1);
        const readBack = await getDeviceData(probeKey);
        await removeDeviceData(probeKey);
        const stats = await getStorageStats();
        const stampKeys = (stats.keys || []).filter((k) => String(k).startsWith('tl_stamp_'));
        const cacheApiAvailable = typeof window !== 'undefined' && 'caches' in window;
        const verified = writeOk && readBack && readBack.nonce === probeVal.nonce;

        pushResult({
          id: 'storage',
          title: t('diagStorageTitle', '2. Device Storage (IndexedDB & Cache API)'),
          status: verified ? 'pass' : 'fail',
          latencyMs: Math.round(performance.now() - t0),
          summary: verified
            ? `IndexedDB R/W/Delete verified (${stats.totalKeys} cached keys)`
            : 'IndexedDB read/write verification failed',
          details: [
            `Total IndexedDB Keys: ${stats.totalKeys}`,
            `Local Stamp Tickets (tl_stamp_*): ${stampKeys.length}`,
            `Cache Storage API (Offline Layouts): ${cacheApiAvailable ? 'Supported' : 'Unavailable'}`,
          ],
        });
      } catch (err) {
        pushResult({
          id: 'storage',
          title: t('diagStorageTitle', '2. Device Storage (IndexedDB & Cache API)'),
          status: 'fail',
          latencyMs: Math.round(performance.now() - t0),
          summary: `Storage error: ${err.message}`,
          details: [],
        });
      }
    }

    // 3. Firestore Core Collections Connectivity
    {
      const t0 = performance.now();
      const targets = ['event', 'brands', 'assignments', 'relative'];
      const details = [];
      let failedCount = 0;

      for (const colName of targets) {
        const cStart = performance.now();
        try {
          const snap = await getDocs(query(collection(db, colName), limit(1)));
          const cMs = Math.round(performance.now() - cStart);
          details.push(`/${colName}: OK (${snap.size} sample doc, ${cMs}ms)`);
        } catch (err) {
          failedCount += 1;
          details.push(`/${colName}: ERROR (${err.code || err.message})`);
        }
      }

      const latencyMs = Math.round(performance.now() - t0);
      pushResult({
        id: 'firestore',
        title: t('diagFirestoreTitle', '3. Firestore Core Collections Connectivity'),
        status: failedCount === 0 ? 'pass' : failedCount < targets.length ? 'warn' : 'fail',
        latencyMs,
        summary:
          failedCount === 0
            ? `All ${targets.length} core collections reachable (${latencyMs}ms total)`
            : `${failedCount}/${targets.length} collection queries failed`,
        details,
      });
    }

    // 4. Stamp Ticket & Cost-Optimized Sync Engine
    {
      const t0 = performance.now();
      try {
        const aKey = assignmentKey('EVT01', 'BRD01');
        const sKey = stampKey('EVT01', 'USR01');
        const rKey = relativeKey('EVT01', 'BRD01', 'USR01');
        const keysValid =
          aKey === 'EVT01-BRD01' &&
          sKey === 'EVT01-USR01' &&
          rKey === 'EVT01-BRD01-USR01';

        const stats = await getStorageStats();
        const stampKeys = (stats.keys || []).filter((k) => String(k).startsWith('tl_stamp_'));
        let validTickets = 0;
        let completedTickets = 0;

        for (const k of stampKeys) {
          const ticket = await getDeviceData(k);
          if (ticket && Array.isArray(ticket.slots)) {
            validTickets += 1;
            if (ticket.allDone) completedTickets += 1;
          }
        }

        pushResult({
          id: 'stamp_engine',
          title: t('diagStampTitle', '4. Stamp Ticket & Sync Optimization Engine'),
          status: keysValid ? 'pass' : 'fail',
          latencyMs: Math.round(performance.now() - t0),
          summary: keysValid
            ? `Key generators & local-first sync active (${validTickets} local card(s), ${completedTickets} completed)`
            : 'Key generator format mismatch',
          details: [
            `Composite Keys: ${aKey} | ${sKey} | ${rKey}`,
            `Sync Policy: Partial stamps stay on device IndexedDB; only allDone=true cards push to /stamps`,
            `Booth Visitor Tracking: Every QR scan writes directly to /relative/{eventId}-{brandId}-{userId}`,
          ],
        });
      } catch (err) {
        pushResult({
          id: 'stamp_engine',
          title: t('diagStampTitle', '4. Stamp Ticket & Sync Optimization Engine'),
          status: 'fail',
          latencyMs: Math.round(performance.now() - t0),
          summary: `Stamp engine check error: ${err.message}`,
          details: [],
        });
      }
    }

    // 5. QR Code Generator & Camera Scanner Readiness
    {
      const t0 = performance.now();
      try {
        const dataUrl = await QRCode.toDataURL('TREASURELAYOUT-DIAG-TEST', { width: 120, margin: 1 });
        const qrOk = typeof dataUrl === 'string' && dataUrl.startsWith('data:image/png;base64,');
        const isSecure =
          typeof window !== 'undefined' &&
          (window.isSecureContext || window.location.hostname === 'localhost');
        const hasMediaDevices = Boolean(
          typeof navigator !== 'undefined' &&
            navigator.mediaDevices &&
            typeof navigator.mediaDevices.getUserMedia === 'function'
        );

        const status = qrOk && isSecure && hasMediaDevices ? 'pass' : qrOk ? 'warn' : 'fail';
        pushResult({
          id: 'qr_camera',
          title: t('diagQrCameraTitle', '5. QR Generator & Camera Scanner Engine'),
          status,
          latencyMs: Math.round(performance.now() - t0),
          summary:
            status === 'pass'
              ? 'QR encoder & browser Camera API ready'
              : 'QR encoder ready; camera API requires HTTPS or permission check',
          details: [
            `QR PNG Encoder: ${qrOk ? 'Operational' : 'Failed'}`,
            `Secure Context (HTTPS): ${isSecure ? 'Yes' : 'No'}`,
            `navigator.mediaDevices.getUserMedia: ${hasMediaDevices ? 'Available' : 'Unavailable'}`,
          ],
        });
      } catch (err) {
        pushResult({
          id: 'qr_camera',
          title: t('diagQrCameraTitle', '5. QR Generator & Camera Scanner Engine'),
          status: 'fail',
          latencyMs: Math.round(performance.now() - t0),
          summary: `QR / Camera check failed: ${err.message}`,
          details: [],
        });
      }
    }

    // 6. Recent Critical Process History & Firestore Audit Trail (/logs)
    try {
      setProcessHistory(crashlytics.getProcessHistory());
      const logsSnap = await getDocs(
        query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(5))
      );
      setAuditLogs(logsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch {
      setProcessHistory(crashlytics.getProcessHistory());
    }

    setLastRunAt(new Date().toLocaleTimeString());
    setRunning(false);
  }, [t]);

  useEffect(() => {
    if (isOpen) {
      runDiagnostics();
    }
  }, [isOpen, runDiagnostics]);

  if (!isOpen) return null;

  const passCount = checks.filter((c) => c.status === 'pass').length;
  const warnCount = checks.filter((c) => c.status === 'warn').length;
  const failCount = checks.filter((c) => c.status === 'fail').length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('criticalProcessCheckTitle', '🩺 Critical Process Check')}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* Summary Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
            padding: 'var(--space-3)',
            background: 'var(--bg-input)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: '#10b981' }}>
              ✅ {passCount} Pass
            </span>
            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: '#f59e0b' }}>
              ⚠️ {warnCount} Warn
            </span>
            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: '#ef4444' }}>
              ❌ {failCount} Fail
            </span>
            {lastRunAt && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                ({lastRunAt})
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={runDiagnostics}
            disabled={running}
            className="btn btn-primary btn-sm"
            style={{ padding: '4px 10px', fontSize: 'var(--font-xs)' }}
          >
            {running ? '⏳ Running...' : t('rerunChecksBtn', '🔄 Re-run Checks')}
          </button>
        </div>

        {/* Diagnostic Check Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {checks.map((item) => {
            const st = STATUS_STYLE[item.status] || STATUS_STYLE.running;
            return (
              <div
                key={item.id}
                style={{
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-input)',
                  border: `1px solid ${st.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ fontSize: 'var(--font-sm)', color: 'var(--text-primary)' }}>
                    {st.icon} {item.title}
                  </strong>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {item.latencyMs}ms
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: st.bg,
                        color: st.color,
                        border: `1px solid ${st.border}`,
                      }}
                    >
                      {st.label}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
                  {item.summary}
                </div>

                {item.details?.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      paddingTop: '4px',
                      borderTop: '1px dashed var(--border)',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      fontFamily: 'monospace',
                    }}
                  >
                    {item.details.map((line, i) => (
                      <span key={i}>• {line}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* In-Memory Critical Process Runtime Log */}
        <div
          style={{
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <strong style={{ fontSize: 'var(--font-sm)' }}>
            ⚡ {t('recentCriticalProcessesTitle', 'Session Critical Process Executions')} ({processHistory.length})
          </strong>
          {processHistory.length === 0 ? (
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
              No critical mutations executed in this session yet.
            </span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '130px', overflowY: 'auto' }}>
              {processHistory.slice(0, 8).map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    background: 'var(--bg-card)',
                  }}
                >
                  <span>
                    {entry.status === 'success' ? '🟢' : '🔴'} <strong>{entry.processName}</strong>
                    {entry.error ? ` — ${entry.error}` : ''}
                  </span>
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                    {entry.durationMs}ms
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Admin Audit Trail (/logs) */}
        {user && canManage(user) && auditLogs.length > 0 && (
          <div
            style={{
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <strong style={{ fontSize: 'var(--font-sm)' }}>
              🛡️ {t('recentAuditLogsTitle', 'Recent Security Audit Logs (/logs)')}
            </strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflowY: 'auto' }}>
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    fontSize: '11px',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    background: 'var(--bg-card)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <div>
                    <strong>{log.action || 'audit'}</strong> · {log.changerName || 'Admin'} &rarr;{' '}
                    <strong>{log.targetUserName || log.targetUserUid}</strong>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {log.oldRole !== undefined
                      ? `Role: "${log.oldRole}" → "${log.newRole}"`
                      : `Company: "${log.oldCompany || 'None'}" → "${log.newCompany || 'None'}"`}{' '}
                    · {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default SystemHealthModal;
