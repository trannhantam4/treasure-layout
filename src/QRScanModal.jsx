import { useState, useEffect, useRef, memo } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { stampSlot } from './Brand';
import { modalOverlayStyle, modalCardStyle, modalCloseBtnStyle } from './Modal';

const SCANNER_ID = 'qr-reader-container';

const QRScanModal = memo(({ eventId, userId, onStamped, onClose }) => {
  const [status, setStatus] = useState('scanning');
  const [message, setMessage] = useState('');
  const [stampedBrand, setStampedBrand] = useState(null);
  const scannerRef = useRef(null);
  const processedRef = useRef(false);

  useEffect(() => {
    let html5QrCode = null;
    let isUnmounted = false;

    const startScanner = async () => {
      try {
        if (isUnmounted) return;
        html5QrCode = new Html5Qrcode(SCANNER_ID);
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          async (decodedText) => {
            if (processedRef.current) return;
            processedRef.current = true;

            if (html5QrCode && html5QrCode.isScanning) {
              try {
                await html5QrCode.stop();
              } catch (e) {
                console.warn('Error stopping scanner during scan:', e);
              }
            }

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
          },
          () => {}
        );

        if (isUnmounted && html5QrCode && html5QrCode.isScanning) {
          try {
            await html5QrCode.stop();
          } catch (e) {
            console.warn('Error stopping scanner after late start:', e);
          }
        }
      } catch (err) {
        if (!isUnmounted) {
          console.error('Failed to start scanner:', err);
          setMessage('Camera access denied or not available. Please allow camera permissions.');
          setStatus('error');
        }
      }
    };

    startScanner();

    return () => {
      isUnmounted = true;
      if (html5QrCode && html5QrCode.isScanning) {
        try {
          html5QrCode.stop().catch((e) => console.warn('Error in cleanup stop catch:', e));
        } catch (e) {
          console.warn('Sync error in cleanup stop:', e);
        }
      }
    };
  }, [eventId, userId, onStamped]);

  const handleClose = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        scannerRef.current.stop().catch((e) => console.warn('Error in close stop catch:', e));
      } catch (e) {
        console.warn('Sync error in close stop:', e);
      }
    }
    onClose();
  };

  const handleRetry = () => {
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
            {status === 'scanning' && '📷 Scan Treasure QR'}
            {status === 'success' && '✅ Stamp Collected!'}
            {status === 'error' && '❌ Scan Failed'}
          </h2>
          <button onClick={handleClose} style={modalCloseBtnStyle} aria-label="Close">✕</button>
        </div>

        {/* Scanner viewport */}
        {status === 'scanning' && (
          <>
            <p style={{ textAlign: 'center', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', margin: '0 0 var(--space-3)' }}>
              Point your camera at a Treasure Holder QR code
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
              Make sure the QR fits inside the frame
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
            <p style={{ margin: 'var(--space-2) 0 0', color: 'var(--success)', fontWeight: '600' }}>Stamp added to your card!</p>
            <button onClick={handleClose} className="btn btn-primary" style={{ marginTop: 'var(--space-5)', width: '100%' }}>
              Back to Event
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
                Try Again
              </button>
              <button onClick={handleClose} className="btn btn-secondary btn-flex">
                Cancel
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
