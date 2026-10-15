import { useState, useEffect, useRef, memo } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { stampSlot } from './Brand';
import { modalOverlayStyle, modalCardStyle, modalCloseBtnStyle } from './Modal';
import { useTranslation } from 'react-i18next';

const SCANNER_ID = 'qr-reader-container';

const QRScanModal = memo(({ eventId, userId, onStamped, onClose }) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState('scanning');
  const [message, setMessage] = useState('');
  const [stampedBrand, setStampedBrand] = useState(null);
  const scannerRef = useRef(null);
  const processedRef = useRef(false);

  // Helper function to forcefully kill any active camera media tracks
  const stopAllMediaTracks = () => {
    try {
      const container = document.getElementById(SCANNER_ID);
      if (container) {
        container.querySelectorAll('video').forEach((v) => {
          if (v.srcObject && typeof v.srcObject.getTracks === 'function') {
            v.srcObject.getTracks().forEach((track) => {
              track.stop();
            });
            v.srcObject = null;
          }
        });
      }
    } catch (err) {
      console.warn('Error stopping video media tracks:', err);
    }
  };

  // Helper function to safely stop and clear the scanner instance
  const shutdownScanner = async () => {
    const scanner = scannerRef.current;
    if (scanner) {
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
      } catch (e) {
        console.warn('Error stopping Html5Qrcode scanner:', e);
      } finally {
        try {
          scanner.clear();
        } catch (_) {}
      }
    }
    stopAllMediaTracks();
  };

  useEffect(() => {
    let isCancelled = false;
    let html5QrCode = null;

    // Clean up any residual streams or elements in the container prior to starting
    stopAllMediaTracks();
    const container = document.getElementById(SCANNER_ID);
    if (container) {
      container.innerHTML = '';
    }

    const startScanner = async () => {
      try {
        if (isCancelled) return;
        html5QrCode = new Html5Qrcode(SCANNER_ID);
        scannerRef.current = html5QrCode;

        const onScanSuccess = async (decodedText) => {
          if (processedRef.current) return;
          processedRef.current = true;

          // Immediately shut down camera stream upon successful scan detection
          if (html5QrCode && html5QrCode.isScanning) {
            try {
              await html5QrCode.stop();
            } catch (e) {
              console.warn('Error stopping scanner during scan:', e);
            } finally {
              try {
                html5QrCode.clear();
              } catch (_) {}
            }
          }
          stopAllMediaTracks();

          try {
            const updated = await stampSlot(eventId, userId, decodedText.trim());
            const stampedSlot = updated.slots.find((s) => s.combinedId === decodedText.trim());
            setStampedBrand(stampedSlot);
            setStatus('success');
            onStamped(updated);
          } catch (err) {
            setMessage(err.message || 'Invalid QR code.');
            setStatus('error');
          }
        };

        const config = { fps: 10, qrbox: { width: 240, height: 240 } };

        // Determine best camera configuration:
        // On laptops/desktops, { facingMode: 'environment' } produces a black screen because
        // laptops lack a back camera. We check available devices first:
        let cameraConfig = { facingMode: 'environment' };
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            // Find back/environment camera if available; otherwise use the first available device (laptop webcam)
            const backCam = devices.find((d) =>
              /back|rear|environment/i.test(d.label)
            );
            cameraConfig = backCam ? backCam.id : devices[0].id;
          }
        } catch (deviceErr) {
          console.warn('Could not enumerate cameras, falling back to facingMode constraint:', deviceErr);
        }

        if (isCancelled) return;

        try {
          await html5QrCode.start(cameraConfig, config, onScanSuccess, () => {});
        } catch (startErr) {
          // If cameraConfig failed (e.g. facingMode constraint on desktop), fallback to user camera
          console.warn('First start attempt failed, trying fallback camera config:', startErr);
          if (isCancelled) return;
          await html5QrCode.start({ facingMode: 'user' }, config, onScanSuccess, () => {});
        }

        // If unmounted while start was resolving, stop immediately
        if (isCancelled && html5QrCode) {
          try {
            if (html5QrCode.isScanning) {
              await html5QrCode.stop();
            }
          } catch (e) {
            console.warn('Error stopping scanner after late start:', e);
          } finally {
            try {
              html5QrCode.clear();
            } catch (_) {}
          }
          stopAllMediaTracks();
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Failed to start scanner:', err);
          stopAllMediaTracks();
          setMessage(t('cameraDeniedError'));
          setStatus('error');
        }
      }
    };

    startScanner();

    return () => {
      isCancelled = true;
      if (html5QrCode) {
        try {
          if (html5QrCode.isScanning) {
            html5QrCode.stop().finally(() => {
              try { html5QrCode.clear(); } catch (_) {}
              stopAllMediaTracks();
            });
          } else {
            try { html5QrCode.clear(); } catch (_) {}
            stopAllMediaTracks();
          }
        } catch (e) {
          console.warn('Sync error in cleanup stop:', e);
          stopAllMediaTracks();
        }
      } else {
        stopAllMediaTracks();
      }
    };
  }, [eventId, userId, onStamped, t]);

  const handleClose = async () => {
    await shutdownScanner();
    onClose();
  };

  const handleRetry = async () => {
    await shutdownScanner();
    processedRef.current = false;
    setStatus('scanning');
    setMessage('');
    setStampedBrand(null);
    onClose();
  };

  return (
    <div style={modalOverlayStyle({ zIndex: 3000, background: 'rgba(0,0,0,0.85)', blur: 'blur(8px)' })}>
      <div style={modalCardStyle({ maxWidth: '420px' })}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--font-xl)' }}>
            {status === 'scanning' && t('scanTreasureQrTitle')}
            {status === 'success' && t('stampCollectedTitle')}
            {status === 'error' && t('scanFailedTitle')}
          </h2>
          <button onClick={handleClose} style={modalCloseBtnStyle} aria-label="Close">✕</button>
        </div>

        {/* Scanner viewport */}
        {status === 'scanning' && (
          <>
            <p style={{ textAlign: 'center', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', margin: '0 0 var(--space-3)' }}>
              {t('pointCameraPrompt')}
            </p>
            <div style={viewportWrapStyle}>
              <div id={SCANNER_ID} style={{ width: '100%' }} />
              <div style={aimOverlayStyle}>
                {aimCorner('top-left')}
                {aimCorner('top-right')}
                {aimCorner('bottom-left')}
                {aimCorner('bottom-right')}
              </div>
            </div>
            <p style={{ textAlign: 'center', fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-3)' }}>
              {t('qrFitFramePrompt')}
            </p>
          </>
        )}

        {/* Success state */}
        {status === 'success' && stampedBrand && (
          <div style={{ textAlign: 'center', padding: 'var(--space-3) 0' }}>
            <div style={successCircleStyle}>
              {stampedBrand.logoUrl ? (
                <img src={stampedBrand.logoUrl} alt={stampedBrand.brandName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} loading="lazy" />
              ) : (
                <span style={{ fontSize: '36px' }}>🏢</span>
              )}
              <div style={successCheckStyle}>✓</div>
            </div>
            <h3 style={{ margin: 'var(--space-4) 0 var(--space-1)' }}>{stampedBrand.brandName}</h3>
            <p style={{ margin: 'var(--space-2) 0 0', color: 'var(--success)', fontWeight: '600' }}>{t('stampAddedToast')}</p>
            <button onClick={handleClose} className="btn btn-primary" style={{ marginTop: 'var(--space-5)', width: '100%' }}>
              {t('backToEventBtn')}
            </button>
          </div>
        )}

        {/* Error state */}
        {status === 'error' && (
          <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
            <div style={{ fontSize: '48px', marginBottom: 'var(--space-3)' }}>❌</div>
            <p style={{ color: 'var(--danger)', fontWeight: '600', marginBottom: 'var(--space-2)' }}>{message}</p>
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
              <button onClick={handleRetry} className="btn btn-primary btn-flex">
                {t('tryAgainBtn')}
              </button>
              <button onClick={handleClose} className="btn btn-secondary btn-flex">
                {t('cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

function aimCorner(position) {
  const base = {
    position: 'absolute',
    width: '28px', height: '28px',
    borderColor: 'var(--accent)',
    borderStyle: 'solid',
  };
  const map = {
    'top-left':     { top: 0, left: 0, borderWidth: '3px 0 0 3px', borderRadius: '4px 0 0 0' },
    'top-right':    { top: 0, right: 0, borderWidth: '3px 3px 0 0', borderRadius: '0 4px 0 0' },
    'bottom-left':  { bottom: 0, left: 0, borderWidth: '0 0 3px 3px', borderRadius: '0 0 0 4px' },
    'bottom-right': { bottom: 0, right: 0, borderWidth: '0 3px 3px 0', borderRadius: '0 0 4px 0' },
  };
  return <div style={{ ...base, ...map[position] }} />;
}

const viewportWrapStyle = {
  position: 'relative',
  borderRadius: 'var(--radius-lg)',
  overflow: 'hidden',
  background: '#000',
};
const aimOverlayStyle = {
  position: 'absolute', inset: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  pointerEvents: 'none',
};
const successCircleStyle = {
  width: '96px', height: '96px',
  borderRadius: '50%',
  border: '3px solid var(--accent)',
  margin: '0 auto',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  overflow: 'hidden', position: 'relative',
  background: 'var(--bg-input)',
};
const successCheckStyle = {
  position: 'absolute', inset: 0,
  borderRadius: '50%',
  background: 'rgba(99,102,241,0.25)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: '36px', color: 'var(--accent)', fontWeight: '900',
};

export default QRScanModal;
