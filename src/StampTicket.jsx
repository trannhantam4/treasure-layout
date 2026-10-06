import { useState, useEffect, useCallback, memo } from 'react';
import { getOrCreateStampTicket } from './Brand';
import { cacheStampTicket, getCachedStampTicket } from './storage';
import { stampKey } from './utils/keys';
import QRScanModal from './QRScanModal';
import PrizeVoucherModal from './components/PrizeVoucherModal';

/**
 * StampTicket — Mobile-first responsive treasure hunt stamp card.
 * Shows one slot per assigned brand. Users scan QR codes at booths to collect stamps.
 * Ticket is saved to device storage for offline access.
 */
function StampTicket({ eventId, eventName, user, brands, currentUser = user }) {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || brands.length === 0) {
      setLoading(false);
      return;
    }

    const ticketId = stampKey(eventId, user.uid);

    // 1. Try device cache first
    getCachedStampTicket(ticketId)
      .then((cached) => {
        if (cached) {
          setTicket(cached);
          setLoading(false);
        }
      })
      .catch(() => {});

    // 2. Sync from Firestore (source of truth)
    getOrCreateStampTicket(eventId, user.uid, eventName, brands)
      .then((data) => {
        setTicket(data);
        cacheStampTicket(ticketId, data);
      })
      .catch((err) => {
        console.error('Error loading stamp ticket:', err);
        setError('Could not load your stamp card.');
      })
      .finally(() => setLoading(false));
  }, [eventId, user, eventName, brands]);

  const handleStamped = useCallback((updatedTicket) => {
    setTicket(updatedTicket);
    const ticketId = stampKey(eventId, user.uid);
    cacheStampTicket(ticketId, updatedTicket);
    if (updatedTicket?.slots && updatedTicket.slots.length > 0 && updatedTicket.slots.every((s) => s.stamped)) {
      setShowPrizeModal(true);
    }
  }, [eventId, user]);

  const handleClaimed = useCallback((updatedTicket) => {
    setTicket(updatedTicket);
    const ticketId = stampKey(eventId, user.uid);
    cacheStampTicket(ticketId, updatedTicket);
  }, [eventId, user]);

  if (brands.length === 0) return null;

  const stamped = ticket ? ticket.slots.filter((s) => s.stamped).length : 0;
  const total = ticket ? ticket.slots.length : brands.length;
  const allDone = stamped === total && total > 0;
  const progressPct = total > 0 ? Math.round((stamped / total) * 100) : 0;

  return (
    <div className="stamp-ticket">
      {/* Header */}
      <div className="stamp-ticket__header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className="stamp-ticket__title">🎫 Treasure Hunt</h3>
          <p className="stamp-ticket__subtitle">{eventName}</p>
        </div>
        <div className="stamp-ticket__badge" data-done={allDone}>
          {ticket?.claimed ? '✓ CLAIMED' : `${stamped}/${total}`}
        </div>
      </div>

      {/* Progress bar */}
      <div className="stamp-ticket__progress-bg">
        <div
          className="stamp-ticket__progress-fill"
          style={{ width: progressPct + '%' }}
          data-done={allDone}
        />
      </div>
      <p className="stamp-ticket__progress-label">
        {allDone ? 'All stamps collected!' : `${progressPct}% complete — ${total - stamped} stamps remaining`}
      </p>

      {loading && <p className="stamp-ticket__status">Loading your stamp card...</p>}
      {error && <p className="stamp-ticket__status stamp-ticket__status--error">{error}</p>}

      {/* Stamp slots grid — responsive */}
      {ticket && (
        <div className="stamp-ticket__grid">
          {ticket.slots.map((slot) => (
            <StampSlot key={slot.combinedId} slot={slot} />
          ))}
        </div>
      )}

      {/* Completion & Prize Claim message */}
      {allDone && (
        <div
          className="stamp-ticket__complete"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
            padding: 'var(--space-4)',
            background: ticket?.claimed
              ? 'rgba(34, 197, 94, 0.1)'
              : 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.08) 100%)',
            border: ticket?.claimed ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: ticket?.claimed ? 'none' : '0 0 20px rgba(245, 158, 11, 0.15)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span style={{ fontSize: '2.5rem', flexShrink: 0 }}>{ticket?.claimed ? '🎖️' : '🏆'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '700', fontSize: 'var(--font-md)', color: ticket?.claimed ? 'var(--success)' : '#f59e0b' }}>
                {ticket?.claimed ? 'Prize Claimed & Redeemed!' : 'Treasure Hunt Complete!'}
              </div>
              <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
                {ticket?.claimed
                  ? `Redeemed on ${new Date(ticket.claimedAt).toLocaleDateString()} — Thank you for participating!`
                  : `You visited all ${total} brand booths! Present your Finished Ticket to claim your prize.`}
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowPrizeModal(true)}
            className="btn"
            style={{
              width: '100%',
              padding: '12px 16px',
              fontWeight: '700',
              fontSize: 'var(--font-base)',
              background: ticket?.claimed
                ? 'var(--bg-card)'
                : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: ticket?.claimed ? 'var(--text-primary)' : '#111827',
              border: ticket?.claimed ? '1px solid var(--border)' : 'none',
              boxShadow: ticket?.claimed ? 'none' : '0 4px 14px rgba(245, 158, 11, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              borderRadius: 'var(--radius-md)',
              transition: 'transform 0.15s ease',
            }}
          >
            <span>{ticket?.claimed ? '🎫 View Claimed Voucher' : '🎁 Show Finished Ticket / Claim Prize'}</span>
            <span style={{ fontSize: '18px' }}>→</span>
          </button>
        </div>
      )}

      {/* Scan button — prominent on mobile */}
      {!allDone && ticket && (
        <button
          onClick={() => setShowScanner(true)}
          className="btn btn-primary stamp-ticket__scan-btn"
        >
          📷 Scan QR to Stamp
        </button>
      )}

      {showScanner && (
        <QRScanModal
          eventId={eventId}
          userId={user.uid}
          onStamped={handleStamped}
          onClose={() => setShowScanner(false)}
        />
      )}

      {showPrizeModal && (
        <PrizeVoucherModal
          isOpen={showPrizeModal}
          onClose={() => setShowPrizeModal(false)}
          ticket={ticket}
          eventName={eventName}
          user={user}
          currentUser={currentUser}
          onClaimed={handleClaimed}
        />
      )}
    </div>
  );
}

/* ─── Individual Stamp Slot ─── */
const StampSlot = memo(({ slot }) => {
  const done = slot.stamped;
  return (
    <div className="stamp-slot" data-stamped={done}>
      <div className="stamp-slot__logo" data-stamped={done}>
        {slot.logoUrl ? (
          <img
            src={slot.logoUrl}
            alt={slot.brandName}
            loading="lazy"
            decoding="async"
            className="stamp-slot__logo-img"
            data-stamped={done}
          />
        ) : (
          <span style={{ fontSize: '20px', opacity: done ? 1 : 0.3 }}>🏢</span>
        )}
        {done && <div className="stamp-slot__check">✓</div>}
      </div>
      <div className="stamp-slot__name" data-stamped={done}>
        {done ? slot.brandName : '???'}
      </div>
      {done && slot.stampedAt && (
        <div className="stamp-slot__time">
          {new Date(slot.stampedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </div>
  );
});

export default StampTicket;
