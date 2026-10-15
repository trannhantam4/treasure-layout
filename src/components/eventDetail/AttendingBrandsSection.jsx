import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import BrandLogo from '../BrandLogo';
import EmptyState from '../EmptyState';

const BRAND_COLLAPSE_LIMIT = 5;

const toolbarBtnStyle = { display: 'flex', alignItems: 'center', gap: '4px' };

/**
 * "Attending brands" list with collapse/expand and admin toolbar (template, import, export, assign).
 */
function AttendingBrandsSection({
  brands,
  loading,
  canEdit,
  onSelect,            // (assignment) => void
  onDownloadTemplate,  // () => void
  onImport,            // () => void  (opens assign modal on excel tab)
  onExport,            // () => void
  onAssign,            // () => void  (opens assign modal on single tab)
}) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);

  const displayed = showAll ? brands : brands.slice(0, BRAND_COLLAPSE_LIMIT);

  return (
    <div style={{ marginTop: 'var(--space-6)', textAlign: 'left' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <h2 style={{ fontSize: 'var(--font-xl)', margin: 0 }}>{t('attendingBrands')}</h2>
          {brands.length > 0 && (
            <span className="badge badge-solid" style={{ fontSize: 'var(--font-xs)', padding: '2px 8px' }}>
              {brands.length}
            </span>
          )}
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onDownloadTemplate}
              className="btn btn-secondary btn-sm"
              title="Download Excel template for importing brands"
              style={toolbarBtnStyle}
            >
              <span>📄 {t('downloadTemplateBtn')}</span>
            </button>
            <button
              type="button"
              onClick={onImport}
              className="btn btn-secondary btn-sm"
              title="Import brands using Excel"
              style={toolbarBtnStyle}
            >
              <span>📥 {t('importExcelBtn')}</span>
            </button>
            {brands.length > 0 && (
              <button
                type="button"
                onClick={onExport}
                className="btn btn-secondary btn-sm"
                title="Export currently assigned brands to Excel"
                style={toolbarBtnStyle}
              >
                <span>📤 {t('exportBrandsBtn')}</span>
              </button>
            )}
            <button type="button" onClick={onAssign} className="btn btn-primary btn-sm">
              {t('assignBrandBtn')}
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {loading && <p style={{ color: 'var(--text-muted)' }}>{t('loading')}</p>}
        {!loading && brands.length === 0 && (
          <EmptyState icon="🏢" message={t('noBrandsFound', 'No brands assigned to this event yet.')} />
        )}

        {displayed.map((assignment) => (
          <div
            key={assignment.combinedId}
            onClick={() => onSelect(assignment)}
            className="touchable-card"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: 'var(--space-2) var(--space-3)', cursor: 'pointer',
              borderRadius: 'var(--radius-md)', gap: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0, flex: 1 }}>
              <BrandLogo url={assignment.logoUrl} name={assignment.brandName} size={36} />
              <div style={{ minWidth: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2)' }}>
                <h4 style={{ margin: 0, fontSize: 'var(--font-sm)', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {assignment.brandName}
                </h4>
                <span className="badge badge-solid" style={{ fontSize: '10px', textTransform: 'capitalize' }}>
                  {assignment.rank}
                </span>
                {assignment.isTreasureHolder && (
                  <span className="badge badge-warning" style={{ fontSize: '10px' }}>⭐ Treasure</span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
              {assignment.position ? (
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Pos: {assignment.position}</span>
              ) : (
                canEdit && <span style={{ fontSize: '10px', color: 'var(--text-muted)', border: '1px dashed var(--border)', padding: '1px 5px', borderRadius: '4px' }}>+ Position</span>
              )}
              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-md)' }}>›</span>
            </div>
          </div>
        ))}

        {/* Expand / collapse toggle if total brands exceed limit */}
        {brands.length > BRAND_COLLAPSE_LIMIT && (
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="btn btn-secondary"
            style={{
              marginTop: 'var(--space-2)', width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              fontSize: 'var(--font-sm)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)',
            }}
          >
            {showAll ? (
              <>▲ {t('showLessBrands', 'Show fewer brands')}</>
            ) : (
              <>
                ▼ {t('showAllBrands', {
                  count: brands.length,
                  defaultValue: `Show all ${brands.length} brands (${brands.length - BRAND_COLLAPSE_LIMIT} more)`,
                })}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default AttendingBrandsSection;
