import { useState, useRef, memo } from 'react';
import { assignBrandToEvent, batchAssignBrandsToEvent } from './Brand';
import { useBrands } from './hooks/useBrands';
import { assignmentKey } from './utils/keys';
import BrandLogo from './components/BrandLogo';
import SearchInput from './SearchInput';
import Pagination from './components/Pagination';
import { modalOverlayStyle, modalCardStyle, modalCloseBtnStyle } from './Modal';
import { useTranslation } from 'react-i18next';
import { downloadBrandAssignmentTemplate, parseBrandAssignmentExcel } from './utils/brandExcel';

const RANKS = ['gold', 'silver', 'bronze', 'standard'];

const AssignBrandModal = memo(({
  event,
  assignedBrandIds = [],
  onClose,
  onAssigned,
  user,
  initialTab = 'single'
}) => {
  const { t } = useTranslation();
  const { brands, loading } = useBrands();
  const [tab, setTab] = useState(initialTab); // 'single' | 'excel'

  // Single assign states
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [rank, setRank] = useState('standard');
  const [position, setPosition] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Excel bulk import states
  const [excelRows, setExcelRows] = useState([]);
  const [uploadFileName, setUploadFileName] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [savingBatch, setSavingBatch] = useState(false);
  const [batchSuccessMsg, setBatchSuccessMsg] = useState('');
  const fileInputRef = useRef(null);

  const [currentPage, setCurrentPage] = useState(1);
  const BRANDS_PER_PAGE = 6;

  const handleSearchChange = (val) => {
    setSearch(val);
    setCurrentPage(1);
  };

  const filteredBrands = brands.filter((b) => {
    const term = search.toLowerCase();
    return (
      b.brandName?.toLowerCase().includes(term) ||
      b.fieldOfWork?.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredBrands.length / BRANDS_PER_PAGE);
  const displayedBrands = filteredBrands.slice(
    (currentPage - 1) * BRANDS_PER_PAGE,
    currentPage * BRANDS_PER_PAGE
  );

  const isAlreadyAssigned = (b) =>
    assignedBrandIds.includes(assignmentKey(event.eventId, b.brandId));

  /* ─── Single Brand Assign ─── */
  const handleAssignSingle = async () => {
    if (!selected) {
      setError(t('selectBrandPrompt'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const assignment = await assignBrandToEvent(
        selected,
        event,
        { rank, position },
        user.uid
      );
      onAssigned(assignment);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to assign brand.');
      setSaving(false);
    }
  };

  /* ─── Excel Import File Parser ─── */
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setError('');
    setBatchSuccessMsg('');

    try {
      const parsed = await parseBrandAssignmentExcel(
        file,
        brands,
        event.eventId,
        assignedBrandIds
      );
      setExcelRows(parsed);
      setUploadFileName(file.name);
    } catch (err) {
      console.error('Error parsing Excel:', err);
      setError(err.message || 'Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.');
    } finally {
      setIsParsing(false);
      e.target.value = '';
    }
  };

  /* ─── Batch Assign from Excel ─── */
  const handleAssignExcelBatch = async () => {
    const readyItems = excelRows.filter((r) => r.status === 'ready');
    if (readyItems.length === 0) {
      setError('No valid unassigned brands found to import.');
      return;
    }

    setSavingBatch(true);
    setError('');
    try {
      const itemsToAssign = readyItems.map((r) => ({
        brand: r.matchedBrand,
        rank: r.rank,
        position: r.position,
      }));

      const created = await batchAssignBrandsToEvent(itemsToAssign, event, user.uid);
      setBatchSuccessMsg(`Successfully assigned ${created.length} brands!`);
      onAssigned(created);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Failed to batch assign brands:', err);
      setError(err.message || 'Failed to assign brands.');
      setSavingBatch(false);
    }
  };

  const readyCount = excelRows.filter((r) => r.status === 'ready').length;
  const alreadyCount = excelRows.filter((r) => r.status === 'already_assigned').length;
  const notFoundCount = excelRows.filter((r) => r.status === 'not_found').length;
  const duplicateCount = excelRows.filter((r) => r.status === 'duplicate').length;

  return (
    <div style={modalOverlayStyle({ zIndex: 9999 })} onClick={onClose}>
      <div
        style={{
          ...modalCardStyle({ maxWidth: tab === 'excel' && excelRows.length > 0 ? '660px' : '540px' }),
          display: 'flex',
          flexDirection: 'column',
          transition: 'max-width var(--duration-normal) var(--ease-out)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--font-xl)' }}>{t('assignBrandsTitle')}</h2>
          <button onClick={onClose} style={modalCloseBtnStyle} aria-label="Close">✕</button>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          gap: 'var(--space-2)',
          borderBottom: '1px solid var(--border)',
          marginBottom: 'var(--space-4)',
          paddingBottom: 'var(--space-2)',
        }}>
          <button
            type="button"
            onClick={() => { setTab('single'); setError(''); }}
            className={`btn btn-sm ${tab === 'single' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontWeight: 600 }}
          >
            👤 {t('manualSelectTab')}
          </button>
          <button
            type="button"
            onClick={() => { setTab('excel'); setError(''); }}
            className={`btn btn-sm ${tab === 'excel' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>📊 {t('excelBulkTab')}</span>
            {excelRows.length > 0 && (
              <span className="badge badge-accent" style={{ fontSize: '10px', padding: '1px 6px' }}>
                {excelRows.length}
              </span>
            )}
          </button>
        </div>

        {/* ─── TAB 1: Single Brand Assign ─── */}
        {tab === 'single' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <SearchInput
              searchTerm={search}
              setSearchTerm={handleSearchChange}
              placeholder={t('searchBrandsPlaceholder')}
              style={{ marginBottom: 'var(--space-3)' }}
            />

            <div style={listStyle}>
              {loading && <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{t('loading')}</p>}
              {!loading && filteredBrands.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{t('noBrandsInCatalog')}</p>
              )}
              {displayedBrands.map((b) => {
                const assigned = isAlreadyAssigned(b);
                const isSelected = selected?.brandId === b.brandId;
                return (
                  <div
                    key={b.brandId}
                    onClick={() => !assigned && setSelected(b)}
                    style={{
                      ...brandRowStyle,
                      border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                      opacity: assigned ? 0.5 : 1,
                      cursor: assigned ? 'not-allowed' : 'pointer',
                      background: isSelected ? 'var(--accent-bg)' : 'transparent',
                    }}
                  >
                    <BrandLogo url={b.logoUrl} name={b.brandName} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '600', fontSize: 'var(--font-base)', color: 'var(--text-primary)' }}>
                        #{b.brandId} · {b.brandName}
                      </div>
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>{b.fieldOfWork}</div>
                    </div>
                    {assigned && (
                      <span className="badge badge-accent" style={{ flexShrink: 0 }}>{t('alreadyAssigned')}</span>
                    )}
                    {isSelected && !assigned && (
                      <span style={{ fontSize: '1rem', flexShrink: 0, color: 'var(--accent)' }}>✓</span>
                    )}
                  </div>
                );
              })}
            </div>

            {!loading && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredBrands.length}
                itemsPerPage={BRANDS_PER_PAGE}
                onPageChange={setCurrentPage}
                noun="brands"
              />
            )}

            {selected && (
              <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-input)' }}>
                <p style={{ margin: '0 0 var(--space-3)', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {t('assigningLabel')} <em>{selected.brandName}</em>
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div>
                    <label htmlFor="assignRank" className="form-label form-label-bold">{t('rankLabel')}</label>
                    <select
                      id="assignRank"
                      value={rank}
                      onChange={(e) => setRank(e.target.value)}
                      className="input-style"
                      style={{ margin: 0 }}
                    >
                      {RANKS.map((r) => (
                        <option key={r} value={r} style={{ textTransform: 'capitalize', background: 'var(--bg-card-solid)', color: 'var(--text-primary)' }}>
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="assignPosition" className="form-label form-label-bold">{t('boothPositionLabel')}</label>
                    <input
                      id="assignPosition"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      placeholder="e.g. A3, B12"
                      className="input-style"
                      style={{ margin: 0 }}
                    />
                  </div>
                </div>
              </div>
            )}

            {error && <p style={{ color: 'var(--danger)', margin: 'var(--space-3) 0 0', fontSize: 'var(--font-sm)' }}>{error}</p>}

            <div className="btn-group" style={{ marginTop: 'var(--space-4)', marginBottom: 0 }}>
              <button onClick={onClose} className="btn btn-secondary btn-flex">{t('cancel')}</button>
              <button
                onClick={handleAssignSingle}
                disabled={saving || !selected}
                className="btn btn-primary btn-flex"
              >
                {saving ? t('saving') : t('assignBrandSubmit')}
              </button>
            </div>
          </div>
        )}

        {/* ─── TAB 2: Excel Bulk Import ─── */}
        {tab === 'excel' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* Top Info & Download Template Button */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 'var(--space-3)',
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-3)',
              gap: 'var(--space-3)',
              flexWrap: 'wrap',
            }}>
              <div>
                <span style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>
                  {t('bulkAssignTitle')}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {t('bulkAssignDesc')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => downloadBrandAssignmentTemplate(brands)}
                className="btn btn-secondary btn-sm"
                style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>📥 {t('downloadTemplateBtn')}</span>
              </button>
            </div>

            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              accept=".xlsx, .xls"
            />

            {/* Drop / Select File Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-4)',
                textAlign: 'center',
                cursor: 'pointer',
                background: uploadFileName ? 'rgba(34, 197, 94, 0.05)' : 'var(--bg-card)',
                marginBottom: 'var(--space-3)',
                transition: 'border-color var(--duration-fast)',
              }}
            >
              <span style={{ fontSize: '1.8rem', display: 'block', marginBottom: '4px' }}>
                {uploadFileName ? '📄' : '📁'}
              </span>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-sm)', color: 'var(--text-primary)' }}>
                {uploadFileName ? uploadFileName : t('selectExcelFile')}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                {uploadFileName ? t('changeExcelFile') : t('acceptsExcelFormats')}
              </p>
            </div>

            {isParsing && (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>
                {t('parsingExcel')}
              </p>
            )}

            {/* Parsed Preview Table & Statistics */}
            {excelRows.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                {/* Status Badges */}
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-2)' }}>
                  <span className="badge" style={{ background: 'var(--success)', color: '#fff', fontSize: '11px' }}>
                    {t('readyToAssign')} {readyCount}
                  </span>
                  {alreadyCount > 0 && (
                    <span className="badge" style={{ background: '#f59e0b', color: '#111', fontSize: '11px' }}>
                      {t('alreadyAssigned')} {alreadyCount}
                    </span>
                  )}
                  {notFoundCount > 0 && (
                    <span className="badge" style={{ background: 'var(--danger)', color: '#fff', fontSize: '11px' }}>
                      {t('notInCatalog')} {notFoundCount}
                    </span>
                  )}
                  {duplicateCount > 0 && (
                    <span className="badge" style={{ background: 'var(--text-muted)', color: '#fff', fontSize: '11px' }}>
                      {t('duplicate')} {duplicateCount}
                    </span>
                  )}
                </div>

                {/* Table */}
                <div style={{
                  maxHeight: '220px',
                  overflowY: 'auto',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-input)',
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-xs)', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-card-solid)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 600 }}>#</th>
                        <th style={{ padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 600 }}>{t('brandName')}</th>
                        <th style={{ padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 600 }}>{t('rankLabel')}</th>
                        <th style={{ padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 600 }}>{t('boothPositionLabel')}</th>
                        <th style={{ padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {excelRows.map((r, i) => (
                        <tr
                          key={i}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            opacity: r.status === 'ready' ? 1 : 0.65,
                            background: r.status === 'ready' ? 'transparent' : 'rgba(0,0,0,0.02)',
                          }}
                        >
                          <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{r.rowIdx}</td>
                          <td style={{ padding: '6px 10px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {r.matchedBrand && <BrandLogo url={r.matchedBrand.logoUrl} name={r.matchedBrand.brandName} size={20} />}
                              <span>{r.inputName}</span>
                            </div>
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            <span className="badge" style={{ fontSize: '10px', textTransform: 'capitalize' }}>
                              {r.rank}
                            </span>
                          </td>
                          <td style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>
                            {r.position || '—'}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                            {r.status === 'ready' && (
                              <span style={{ color: 'var(--success)', fontWeight: 700 }}>✓ Ready</span>
                            )}
                            {r.status === 'already_assigned' && (
                              <span style={{ color: '#f59e0b', fontWeight: 600 }}>{t('alreadyAssigned')}</span>
                            )}
                            {r.status === 'not_found' && (
                              <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Not found</span>
                            )}
                            {r.status === 'duplicate' && (
                              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t('duplicate')}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {error && <p style={{ color: 'var(--danger)', margin: 'var(--space-3) 0 0', fontSize: 'var(--font-sm)' }}>{error}</p>}
            {batchSuccessMsg && <p style={{ color: 'var(--success)', margin: 'var(--space-3) 0 0', fontSize: 'var(--font-sm)', fontWeight: 700 }}>{batchSuccessMsg}</p>}

            {/* Actions */}
            <div className="btn-group" style={{ marginTop: 'var(--space-4)', marginBottom: 0 }}>
              <button type="button" onClick={onClose} className="btn btn-secondary btn-flex">
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleAssignExcelBatch}
                disabled={savingBatch || readyCount === 0}
                className="btn btn-primary btn-flex"
                style={{
                  background: readyCount > 0 ? 'var(--accent)' : undefined,
                  opacity: readyCount === 0 || savingBatch ? 0.5 : 1,
                }}
              >
                {savingBatch ? t('saving') : `${t('assignBrandSubmit')} (${readyCount})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

const listStyle = {
  maxHeight: '260px',
  overflowY: 'auto',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '6px',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

const brandRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  padding: 'var(--space-2) var(--space-3)',
  borderRadius: 'var(--radius-sm)',
  transition: 'background var(--duration-fast)',
};

export default AssignBrandModal;
