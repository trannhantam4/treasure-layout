import { useState, useEffect, useMemo, memo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { subscribeBrandVisitors, syncExistingStampsToRelative } from './Brand';
import { useBrands } from './hooks/useBrands';
import { canManage } from './utils/auth';
import BrandLogo from './components/BrandLogo';
import SearchInput from './SearchInput';
import EmptyState from './components/EmptyState';
import Pagination from './components/Pagination';
import { exportBrandVisitorsExcel } from './utils/brandExcel';
import { toast } from './utils/toast';
import { useTranslation } from 'react-i18next';

const VISITORS_PER_PAGE = 10;

function BrandVisitors({ user }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const { brands, loading: loadingBrands } = useBrands();
  const isStaff = canManage(user);

  const queryBrandId = searchParams.get('brandId') || '';
  const queryEventId = searchParams.get('eventId') || '';

  // Match the logged-in user's brand by brandId or company name
  const userMatchedBrand = useMemo(() => {
    if (!user || !brands || brands.length === 0) return null;
    if (user.brandId) {
      const byId = brands.find((b) => String(b.brandId) === String(user.brandId));
      if (byId) return byId;
    }
    const userCompany = (user.company || '').trim().toLowerCase();
    if (!userCompany) return null;
    return brands.find((b) => (b.brandName || '').trim().toLowerCase() === userCompany) || null;
  }, [user, brands]);

  // Selected brand filter:
  // - Regular brand members are locked to their own brandId
  // - Admins/Managers default to query param, their matched brand, or 'ALL'
  const [selectedBrandId, setSelectedBrandId] = useState(queryBrandId);
  const [selectedEventId, setSelectedEventId] = useState(queryEventId || 'ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [visitors, setVisitors] = useState([]);
  const [loadingVisitors, setLoadingVisitors] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Initialize effective brandId once brands load
  const activeBrandId = useMemo(() => {
    if (!isStaff) {
      return userMatchedBrand?.brandId || user?.brandId || '';
    }
    if (selectedBrandId) return selectedBrandId;
    return queryBrandId || userMatchedBrand?.brandId || 'ALL';
  }, [isStaff, userMatchedBrand, user?.brandId, selectedBrandId, queryBrandId]);

  const activeBrandObj = useMemo(() => {
    if (!activeBrandId || activeBrandId === 'ALL') return null;
    return brands.find((b) => String(b.brandId) === String(activeBrandId)) || null;
  }, [activeBrandId, brands]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (loadingBrands) return;

    // If user is not staff and doesn't belong to any registered brand, no query needed
    if (!isStaff && !activeBrandId) {
      setVisitors([]);
      setLoadingVisitors(false);
      return;
    }

    setLoadingVisitors(true);
    const unsub = subscribeBrandVisitors(
      activeBrandId,
      (data) => {
        setVisitors(data);
        setLoadingVisitors(false);
      },
      (err) => {
        console.error('Error fetching brand visitors:', err);
        setLoadingVisitors(false);
      }
    );

    return () => unsub();
  }, [user, loadingBrands, isStaff, activeBrandId, navigate]);

  // Distinct events from the visitors list for the event filter dropdown
  const eventOptions = useMemo(() => {
    const map = new Map();
    visitors.forEach((v) => {
      if (v.eventId && !map.has(v.eventId)) {
        map.set(v.eventId, v.eventName || v.eventId);
      }
    });
    return Array.from(map.entries()).map(([eventId, eventName]) => ({
      eventId,
      eventName,
    }));
  }, [visitors]);

  // Filter by selected event + search term
  const filteredVisitors = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return visitors.filter((v) => {
      if (selectedEventId !== 'ALL' && v.eventId !== selectedEventId) {
        return false;
      }
      if (!term) return true;
      return (
        v.visitorName?.toLowerCase().includes(term) ||
        v.visitorEmail?.toLowerCase().includes(term) ||
        v.visitorPhone?.toLowerCase().includes(term) ||
        v.visitorCompany?.toLowerCase().includes(term) ||
        v.visitorDisplayId?.toLowerCase().includes(term) ||
        v.eventName?.toLowerCase().includes(term) ||
        v.brandName?.toLowerCase().includes(term) ||
        v.relativeId?.toLowerCase().includes(term)
      );
    });
  }, [visitors, selectedEventId, searchTerm]);

  // Unique visitors count & distinct events count
  const uniqueVisitorCount = useMemo(
    () => new Set(filteredVisitors.map((v) => v.userId)).size,
    [filteredVisitors]
  );
  const distinctEventCount = useMemo(
    () => new Set(filteredVisitors.map((v) => v.eventId)).size,
    [filteredVisitors]
  );

  const totalPages = Math.ceil(filteredVisitors.length / VISITORS_PER_PAGE);
  const displayedVisitors = filteredVisitors.slice(
    (currentPage - 1) * VISITORS_PER_PAGE,
    currentPage * VISITORS_PER_PAGE
  );

  const handleSearchChange = (val) => {
    setSearchTerm(val);
    setCurrentPage(1);
  };

  const handleSyncStamps = async () => {
    setSyncing(true);
    try {
      const count = await syncExistingStampsToRelative();
      toast.success(
        t('syncVisitorsSuccess', {
          count,
          defaultValue: `Synced ${count} booth visit record(s) from stamp cards!`,
        })
      );
    } catch (err) {
      console.error('Failed to sync stamps to relative:', err);
      toast.error('Failed to sync existing stamp records.');
    } finally {
      setSyncing(false);
    }
  };

  if (loadingBrands) {
    return (
      <div className="mobile-container page-enter">
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 'var(--space-8)' }}>
          {t('loading')}
        </p>
      </div>
    );
  }

  // Non-staff user whose company does not match any brand in the catalog
  if (!isStaff && !userMatchedBrand) {
    return (
      <div className="mobile-container page-enter">
        <div className="scroll-view">
          <h1 style={{ margin: 0, fontSize: 'var(--font-2xl)' }}>
            {t('brandVisitorsTitle', 'Brand Booth Visitors')}
          </h1>
          <div
            className="touchable-card"
            style={{
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              padding: 'var(--space-6)',
              gap: 'var(--space-3)',
              cursor: 'default',
            }}
          >
            <span style={{ fontSize: '2.5rem' }}>🏢</span>
            <h3 style={{ margin: 0 }}>
              {t('noBrandLinkedTitle', 'No Brand Linked to Your Account')}
            </h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', maxWidth: '420px' }}>
              {t(
                'noBrandLinkedDesc',
                'Your profile company must match an official brand in the catalog to view booth visitors.'
              )}
            </p>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
              {t('companyLabel', 'Company:')} <strong>{user?.company || t('noneUnknown', 'None')}</strong>
            </div>
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="btn btn-primary btn-sm"
            >
              {t('editProfile', 'Edit Profile')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-container page-enter">
      <div className="scroll-view">
        {/* Header & Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
          }}
        >
          <h1 style={{ margin: 0, fontSize: 'var(--font-2xl)' }}>
            {t('brandVisitorsTitle', 'Brand Booth Visitors')}
          </h1>

          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {isStaff && (
              <button
                type="button"
                onClick={handleSyncStamps}
                disabled={syncing}
                className="btn btn-secondary btn-sm"
                title="Backfill visitor records from existing stamp tickets"
              >
                🔄 {syncing ? t('saving', 'Syncing...') : t('syncStampsBtn', 'Sync Stamp Records')}
              </button>
            )}
            {filteredVisitors.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  exportBrandVisitorsExcel(
                    filteredVisitors,
                    activeBrandObj?.brandName || 'All_Brands'
                  )
                }
                className="btn btn-primary btn-sm"
              >
                📤 {t('exportVisitorsBtn', 'Export Excel')}
              </button>
            )}
          </div>
        </div>

        {/* Brand Banner Card */}
        <div
          className="touchable-card"
          style={{
            padding: 'var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
            cursor: 'default',
            border: '1px solid var(--border-gold)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {activeBrandObj ? (
              <>
                <BrandLogo url={activeBrandObj.logoUrl} name={activeBrandObj.brandName} size={52} />
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    <span className="badge badge-solid">#{activeBrandObj.brandId}</span>
                    <h2 style={{ margin: 0, fontSize: 'var(--font-lg)' }}>{activeBrandObj.brandName}</h2>
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
                    {activeBrandObj.fieldOfWork}
                  </p>
                </div>
              </>
            ) : (
              <div style={{ flex: 1 }}>
                <span className="badge badge-accent" style={{ marginBottom: '4px' }}>
                  {t('allBrandsViewBadge', 'ADMIN / MANAGER VIEW')}
                </span>
                <h2 style={{ margin: 0, fontSize: 'var(--font-lg)' }}>
                  {t('allBrandsVisitorsHeading', 'All Brand Booth Visitors')}
                </h2>
              </div>
            )}

            {/* KPI Summary Pills */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <div style={statBoxStyle}>
                <span style={statNumberStyle}>{filteredVisitors.length}</span>
                <span style={statLabelStyle}>{t('totalScansLabel', 'Total Visits')}</span>
              </div>
              <div style={statBoxStyle}>
                <span style={statNumberStyle}>{uniqueVisitorCount}</span>
                <span style={statLabelStyle}>{t('uniqueVisitorsLabel', 'Visitors')}</span>
              </div>
              <div style={statBoxStyle}>
                <span style={statNumberStyle}>{distinctEventCount}</span>
                <span style={statLabelStyle}>{t('eventsCountLabel', 'Events')}</span>
              </div>
            </div>
          </div>

          {/* Filter Dropdowns: Brand Selector (for Staff) + Event Selector */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isStaff ? 'repeat(auto-fit, minmax(200px, 1fr))' : '1fr',
              gap: 'var(--space-3)',
              borderTop: '1px solid var(--border)',
              paddingTop: 'var(--space-3)',
            }}
          >
            {isStaff && (
              <div>
                <label htmlFor="visitorBrandFilter" className="form-label form-label-bold">
                  {t('filterByBrandLabel', 'Brand')}
                </label>
                <select
                  id="visitorBrandFilter"
                  value={activeBrandId}
                  onChange={(e) => {
                    setSelectedBrandId(e.target.value);
                    setSelectedEventId('ALL');
                    setCurrentPage(1);
                  }}
                  className="input-style"
                  style={{ margin: 0 }}
                >
                  <option value="ALL">{t('allBrandsOption', 'All Brands')}</option>
                  {brands.map((b) => (
                    <option key={b.brandId} value={b.brandId}>
                      #{b.brandId} · {b.brandName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="visitorEventFilter" className="form-label form-label-bold">
                {t('filterByEventLabel', 'Filter by Event')}
              </label>
              <select
                id="visitorEventFilter"
                value={selectedEventId}
                onChange={(e) => {
                  setSelectedEventId(e.target.value);
                  setCurrentPage(1);
                }}
                className="input-style"
                style={{ margin: 0 }}
              >
                <option value="ALL">
                  {t('allEventsOption', 'All Events')} ({eventOptions.length})
                </option>
                {eventOptions.map((ev) => (
                  <option key={ev.eventId} value={ev.eventId}>
                    {ev.eventName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Search Input */}
        <SearchInput
          searchTerm={searchTerm}
          setSearchTerm={handleSearchChange}
          placeholder={t(
            'searchVisitorsPlaceholder',
            'Search visitors by name, company, email, phone, or event...'
          )}
        />

        {loadingVisitors && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{t('loading')}</p>
        )}

        {!loadingVisitors && filteredVisitors.length === 0 && (
          <EmptyState
            icon="👥"
            message={t(
              'noVisitorsFoundMsg',
              'No booth visitors recorded yet. When attendees scan your brand QR code at an event, they will appear here.'
            )}
          />
        )}

        {/* Visitor Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {displayedVisitors.map((v) => (
            <VisitorCard
              key={v.relativeId || v.id}
              visitor={v}
              showBrandBadge={activeBrandId === 'ALL'}
              onEventClick={() => v.eventId && navigate(`/events/${v.eventId}`)}
            />
          ))}
        </div>

        {!loadingVisitors && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredVisitors.length}
            itemsPerPage={VISITORS_PER_PAGE}
            onPageChange={setCurrentPage}
            noun="visitors"
          />
        )}
      </div>
    </div>
  );
}

const VisitorCard = memo(({ visitor, showBrandBadge, onEventClick }) => {
  const { t } = useTranslation();
  const visitedDate = visitor.visitedAt
    ? new Date(visitor.visitedAt).toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return (
    <div
      className="touchable-card"
      style={{
        flexDirection: 'column',
        padding: 'var(--space-4)',
        gap: 'var(--space-3)',
        cursor: 'default',
      }}
    >
      {/* Top Row: Visitor Identity + Event Tag */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {visitor.visitorPhotoURL ? (
            <img
              src={visitor.visitorPhotoURL}
              alt={visitor.visitorName}
              loading="lazy"
              decoding="async"
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid var(--accent)',
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                flexShrink: 0,
              }}
            >
              👤
            </div>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--font-md)' }}>
                {visitor.visitorName || 'Visitor'}
              </h3>
              {visitor.visitorDisplayId && (
                <span className="badge badge-solid" style={{ fontSize: '10px' }}>
                  #{visitor.visitorDisplayId}
                </span>
              )}
            </div>
            <p style={{ margin: '2px 0 0', fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
              {visitor.visitorPosition
                ? `${visitor.visitorPosition} · ${visitor.visitorCompany || '—'}`
                : visitor.visitorCompany || t('visitorRole', 'Visitor')}
            </p>
          </div>
        </div>

        {/* Event & Brand Badges */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <button
            type="button"
            onClick={onEventClick}
            className="badge badge-accent"
            style={{
              cursor: 'pointer',
              border: 'none',
              fontSize: '11px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="View Event"
          >
            <span>🎪 {visitor.eventName || visitor.eventId}</span>
          </button>
          {showBrandBadge && visitor.brandName && (
            <span className="badge" style={{ fontSize: '10px', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
              🏢 #{visitor.brandId} · {visitor.brandName}
            </span>
          )}
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            🕒 {visitedDate}
          </span>
        </div>
      </div>

      {/* Contact Details Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--space-2)',
          paddingTop: 'var(--space-2)',
          borderTop: '1px solid var(--border)',
          fontSize: 'var(--font-xs)',
          color: 'var(--text-secondary)',
        }}
      >
        {visitor.visitorEmail && (
          <div>
            <strong style={{ color: 'var(--text-muted)' }}>✉️ Email: </strong>
            <a href={`mailto:${visitor.visitorEmail}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
              {visitor.visitorEmail}
            </a>
          </div>
        )}
        {visitor.visitorPhone && (
          <div>
            <strong style={{ color: 'var(--text-muted)' }}>📞 {t('phone', 'Phone')}: </strong>
            <a href={`tel:${visitor.visitorPhone}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>
              {visitor.visitorPhone}
            </a>
          </div>
        )}
        {visitor.visitorAddress && (
          <div>
            <strong style={{ color: 'var(--text-muted)' }}>📍 {t('address', 'Address')}: </strong>
            <span>{visitor.visitorAddress}</span>
          </div>
        )}
        <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '10px' }}>
          ID: {visitor.relativeId || visitor.id}
        </div>
      </div>
    </div>
  );
});

const statBoxStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '6px 14px',
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  minWidth: '76px',
};

const statNumberStyle = {
  fontWeight: 800,
  fontSize: 'var(--font-lg)',
  color: 'var(--accent)',
  lineHeight: 1.1,
};

const statLabelStyle = {
  fontSize: '10px',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  fontWeight: 600,
  marginTop: '2px',
};

export default BrandVisitors;
