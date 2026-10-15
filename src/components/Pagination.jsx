import { memo } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Reusable Luxury Pagination Controls.
 * Matches the Champagne Gold & Onyx theme.
 *
 * Props:
 * - currentPage: number (1-based)
 * - totalPages: number
 * - totalItems: number
 * - itemsPerPage: number
 * - onPageChange: (newPage: number) => void
 * - noun?: string (default: 'items')
 */
const Pagination = memo(function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  noun,
}) {
  const { t } = useTranslation();
  const effectiveNoun = noun || t('items');
  if (totalPages <= 1) return null;

  const startIdx = Math.min((currentPage - 1) * itemsPerPage + 1, totalItems);
  const endIdx = Math.min(currentPage * itemsPerPage, totalItems);

  // Helper for generating page number pills (with ellipsis if many pages)
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, currentPage - 1);
      let end = Math.min(totalPages, currentPage + 1);

      if (currentPage <= 2) {
        start = 1;
        end = 3;
      } else if (currentPage >= totalPages - 1) {
        start = totalPages - 2;
        end = totalPages;
      }

      if (start > 1) {
        pages.push(1);
        if (start > 2) pages.push('...');
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages) {
        if (end < totalPages - 1) pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 'var(--space-3)',
        marginTop: 'var(--space-5)',
        paddingTop: 'var(--space-4)',
        borderTop: '1px solid var(--border)',
        fontSize: 'var(--font-sm)',
        color: 'var(--text-secondary)',
      }}
    >
      {/* Range summary */}
      <div>
        {t('showing')} <strong style={{ color: 'var(--accent, #0284c7)' }}>{startIdx}–{endIdx}</strong> {t('of')}{' '}
        <strong style={{ color: 'var(--text-primary)' }}>{totalItems}</strong> {effectiveNoun}
      </div>

      {/* Page controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {/* Prev button */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="btn btn-ghost btn-sm"
          style={{
            padding: '4px 8px',
            opacity: currentPage === 1 ? 0.35 : 1,
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
          }}
          aria-label="Previous page"
        >
          ‹ {t('prev')}
        </button>

        {/* Number buttons */}
        {getPageNumbers().map((p, idx) => {
          if (p === '...') {
            return (
              <span key={`dots-${idx}`} style={{ padding: '0 4px', color: 'var(--text-muted)' }}>
                …
              </span>
            );
          }

          const isActive = p === currentPage;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={isActive ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
              style={{
                minWidth: '32px',
                height: '32px',
                padding: '0 6px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#090a0e' : 'var(--text-primary)',
              }}
            >
              {p}
            </button>
          );
        })}

        {/* Next button */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="btn btn-ghost btn-sm"
          style={{
            padding: '4px 8px',
            opacity: currentPage === totalPages ? 0.35 : 1,
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
          }}
          aria-label="Next page"
        >
          {t('next')} ›
        </button>
      </div>
    </div>
  );
});

export default Pagination;
