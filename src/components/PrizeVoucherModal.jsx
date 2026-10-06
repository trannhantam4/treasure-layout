import { useState, memo } from 'react';
import { claimPrizeTicket } from '../Brand';
import { modalOverlayStyle, modalCardStyle } from '../Modal';
import BrandLogo from './BrandLogo';
import { canManage } from '../utils/auth';

/**
 * PrizeVoucherModal — Official Finished Ticket & Prize Voucher Pass
 * Designed specifically for visitors to show to event staff/organizers
 * to verify booth completions and collect their physical/digital prize.
 */
const PrizeVoucherModal = memo(({
  isOpen,
  onClose,
  ticket,
  eventName,
  user,
  currentUser,
  onClaimed
}) => {
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [showStaffPrompt, setShowStaffPrompt] = useState(false);
  const [staffNameInput, setStaffNameInput] = useState('');

  const isStaff = canManage(currentUser);
  const isClaimed = Boolean(ticket?.claimed);
  const totalStamps = ticket?.slots?.length || 0;
  const stampedSlots = ticket?.slots?.filter((s) => s.stamped) || [];
  const allDone = stampedSlots.length === totalStamps && totalStamps > 0;

  const voucherCode = `TL-WINNER-${(ticket?.eventId || 'EVT').slice(0, 4).toUpperCase()}-${(user?.uid || 'USR').slice(0, 6).toUpperCase()}`;

  if (!isOpen || !ticket) return null;

  const handleConfirmClaim = async () => {
    setClaiming(true);
    setClaimError('');
    try {
      const staffIdentifier = staffNameInput.trim() ||
        (currentUser?.fullName || currentUser?.userName || currentUser?.name || 'Event Staff');
      const updated = await claimPrizeTicket(ticket.eventId, user.uid, staffIdentifier);
      if (onClaimed) onClaimed(updated);
      setShowStaffPrompt(false);
    } catch (err) {
      console.error('Error claiming prize:', err);
      setClaimError(err.message || 'Failed to claim prize.');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div style={modalOverlayStyle({ zIndex: 9999, background: 'rgba(0,0,0,0.82)', blur: 'blur(8px)' })} onClick={onClose}>
      <div
        className="prize-voucher-modal"
        style={{
          ...modalCardStyle({ maxWidth: '440px', padding: '0', maxHeight: '90vh' }),
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'var(--bg-card-solid)',
          border: '2px solid #f59e0b',
          boxShadow: '0 0 35px rgba(245, 158, 11, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Golden Certificate Header */}
        <div style={{
          background: 'linear-gradient(135deg, #b45309 0%, #f59e0b 50%, #d97706 100%)',
          color: '#111827',
          padding: 'var(--space-4) var(--space-5)',
          position: 'relative',
          textAlign: 'center',
        }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'rgba(0,0,0,0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              cursor: 'pointer',
              color: '#fff',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1
            }}
            aria-label="Close Prize Pass"
          >
            ✕
          </button>

          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '2px' }}>🏆</span>
          <h2 style={{ margin: 0, fontSize: 'var(--font-xl)', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Prize Claim Voucher
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: 'var(--font-xs)', fontWeight: 700, opacity: 0.9 }}>
            TREASURE HUNT COMPLETION PASS
          </p>
        </div>

        {/* Scrollable Content Body */}
        <div style={{ overflowY: 'auto', padding: 'var(--space-5)', flex: 1 }}>
          {/* Status Banner */}
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: 'var(--space-4)',
            backgroundColor: isClaimed ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.12)',
            border: `1px solid ${isClaimed ? 'var(--danger)' : 'var(--success)'}`,
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 800,
              fontSize: 'var(--font-sm)',
              color: isClaimed ? 'var(--danger)' : 'var(--success)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              <span>{isClaimed ? '🔒' : '✨'}</span>
              <span>{isClaimed ? 'PRIZE REDEEMED / CLAIMED' : 'READY TO CLAIM PRIZE'}</span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
              {isClaimed
                ? `Redeemed on ${new Date(ticket.claimedAt).toLocaleString()} (Staff: ${ticket.claimedBy || 'Verified'})`
                : 'Show this official screen to the organizers at the counter to claim your reward.'}
            </p>
          </div>

          {/* Ticket Information Card */}
          <div style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-4)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px dashed var(--border)', paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em' }}>Event</span>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-base)', color: 'var(--text-primary)' }}>{eventName}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em' }}>Voucher Ref</span>
                <div style={{ fontWeight: 800, fontSize: '11px', color: '#f59e0b', fontFamily: 'monospace' }}>{voucherCode}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Winner Name</span>
                <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)', color: 'var(--text-primary)' }}>
                  {user?.fullName || user?.userName || user?.name || 'Attendee'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Company</span>
                <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
                  {user?.company || 'Visitor'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Display ID</span>
                <div style={{ fontWeight: 600, fontSize: 'var(--font-xs)', color: 'var(--text-primary)' }}>
                  #{user?.displayId || user?.uid?.slice(0, 8)?.toUpperCase()}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Stamps Collected</span>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-xs)', color: 'var(--success)' }}>
                  ✓ {stampedSlots.length} of {totalStamps} booths
                </div>
              </div>
            </div>
          </div>

          {/* Official Completion Badge UI (No QR) */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
            background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.02) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: 'var(--space-4)',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              width: '76px',
              height: '76px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '38px',
              boxShadow: '0 6px 20px rgba(245, 158, 11, 0.35)',
              marginBottom: 'var(--space-2)',
            }}>
              🏆
            </div>
            <div style={{
              fontWeight: 800,
              fontSize: 'var(--font-md)',
              color: 'var(--text-primary)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              Official Winner Pass
            </div>
            <div style={{
              fontFamily: 'monospace',
              fontSize: 'var(--font-sm)',
              fontWeight: 700,
              color: '#f59e0b',
              marginTop: '4px',
              padding: '4px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px dashed rgba(245, 158, 11, 0.35)',
              letterSpacing: '0.06em',
            }}>
              {voucherCode}
            </div>
            <span style={{
              marginTop: 'var(--space-2)',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              fontWeight: 600,
            }}>
              ✨ All {totalStamps} booths verified • Present this pass to collect your reward
            </span>
          </div>

          {/* Collected Stamps Summary List */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 'var(--space-2)' }}>
              Completed Booths ({stampedSlots.length})
            </span>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              maxHeight: '130px',
              overflowY: 'auto',
              paddingRight: '4px',
            }}>
              {ticket.slots.map((slot) => (
                <div
                  key={slot.combinedId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-2) var(--space-3)',
                    background: 'var(--bg-input)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <BrandLogo url={slot.logoUrl} name={slot.brandName} size={24} />
                    <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {slot.brandName}
                    </span>
                  </div>
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--success)', fontWeight: 700 }}>
                    ✓ Stamped
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Staff Redemption Action */}
          {!isClaimed && (
            <div style={{
              borderTop: '1px dashed var(--border)',
              paddingTop: 'var(--space-4)',
              textAlign: 'center',
            }}>
              {!showStaffPrompt ? (
                <button
                  type="button"
                  onClick={() => setShowStaffPrompt(true)}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: 'var(--space-3)',
                    fontWeight: 700,
                    fontSize: 'var(--font-sm)',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    border: 'none',
                    color: '#000',
                    boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)',
                  }}
                >
                  🎁 Staff: Mark as Prize Handed Out
                </button>
              ) : (
                <div style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-3)',
                  textAlign: 'left'
                }}>
                  <span style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Confirm Prize Handout
                  </span>
                  <p style={{ margin: '0 0 var(--space-2)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Only event organizers should tap confirm. This locks the ticket so it cannot be claimed twice.
                  </p>
                  <input
                    type="text"
                    placeholder="Staff Name / Booth # (Optional)"
                    value={staffNameInput}
                    onChange={(e) => setStaffNameInput(e.target.value)}
                    className="input-style"
                    style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-xs)' }}
                  />
                  {claimError && (
                    <p style={{ color: 'var(--danger)', fontSize: '11px', margin: '0 0 var(--space-2)' }}>{claimError}</p>
                  )}
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button
                      type="button"
                      onClick={() => setShowStaffPrompt(false)}
                      disabled={claiming}
                      className="btn btn-secondary btn-sm btn-flex"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmClaim}
                      disabled={claiming}
                      className="btn btn-primary btn-sm btn-flex"
                      style={{ background: 'var(--success)', border: 'none' }}
                    >
                      {claiming ? 'Confirming...' : '✓ Confirm Handout'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: 'var(--space-3) var(--space-5)',
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Present to organizers to claim
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-sm"
          >
            Close Pass
          </button>
        </div>
      </div>
    </div>
  );
});

export default PrizeVoucherModal;
