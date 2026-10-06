import { memo } from 'react';

/**
 * Reusable empty state / no-results placeholder.
 * Replaces near-duplicate "No ... found" blocks across Admin, BrandManager,
 * AssignBrandModal, EventDetail, Home.
 */
const EmptyState = memo(({ icon = '📭', message = 'Nothing found.' }) => (
  <div
    style={{
      width: '100%',
      padding: 'var(--space-6) 0',
      textAlign: 'center',
      color: 'var(--text-secondary)',
      backgroundColor: 'var(--bg-input)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-gold)',
    }}
  >
    <span style={{ fontSize: '2rem', display: 'block', marginBottom: 'var(--space-2)' }}>{icon}</span>
    {message}
  </div>
));

export default EmptyState;
