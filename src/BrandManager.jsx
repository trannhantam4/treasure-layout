import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { createBrand, updateBrand, deleteBrand, getEventsForBrand, batchCreateBrands } from './Brand';
import BrandFormModal from './BrandFormModal';
import SearchInput from './SearchInput';
import { getCachedBrandCatalog, cacheBrandCatalog } from './storage';
import { canManage } from './utils/auth';
import BrandLogo from './components/BrandLogo';
import EmptyState from './components/EmptyState';
import { modalOverlayStyle, modalCardStyle, modalCloseBtnStyle } from './Modal';
import {
  downloadBrandCatalogTemplate,
  exportBrandCatalog,
  parseBrandCatalogExcel,
} from './utils/brandExcel';
import { toast } from './utils/toast';

const RANK_COLORS = {
  gold: 'var(--gold)',
  silver: 'var(--silver)',
  bronze: 'var(--bronze)',
  standard: 'var(--accent)',
};

function BrandManager({ user }) {
  const navigate = useNavigate();
  const canEdit = canManage(user);

  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [expandedBrand, setExpandedBrand] = useState(null);
  const [brandEvents, setBrandEvents] = useState({});

  // Excel Bulk Import States
  const fileInputRef = useRef(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  useEffect(() => {
    if (!canEdit) { navigate('/'); return; }

    // 1. Try to load cached brand catalog from IndexedDB instantly
    getCachedBrandCatalog().then((cached) => {
      if (cached && cached.length > 0) {
        setBrands(cached);
        setLoading(false);
      }
    }).catch(() => {});

    // 2. Listen for real-time updates and update cache
    const q = query(collection(db, 'brands'), orderBy('brandId', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ docId: d.id, ...d.data() }));
      setBrands(data);
      cacheBrandCatalog(data);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching brands:', err);
      setLoading(false);
    });
    return () => unsub();
  }, [canEdit, navigate]);

  const handleCreate = async (formData) => {
    setSaving(true);
    try {
      await createBrand(formData, user.uid);
      setShowFormModal(false);
      toast.success('Brand created successfully!');
    } catch (err) {
      toast.error('Failed to create brand: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (formData) => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await updateBrand(editTarget.docId, formData);
      setEditTarget(null);
      setShowFormModal(false);
      toast.success('Brand updated successfully!');
    } catch (err) {
      toast.error('Failed to update brand: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (brand) => {
    if (!window.confirm(`Delete brand "${brand.brandName}"? This will also remove all its event assignments.`)) return;
    try {
      await deleteBrand(brand.docId);
      toast.success('Brand deleted successfully!');
    } catch (err) {
      toast.error('Failed to delete brand: ' + err.message);
    }
  };

  const toggleExpand = async (brand) => {
    if (expandedBrand === brand.brandId) {
      setExpandedBrand(null);
      return;
    }
    setExpandedBrand(brand.brandId);
    if (!brandEvents[brand.brandId]) {
      const events = await getEventsForBrand(brand.brandId);
      setBrandEvents((prev) => ({ ...prev, [brand.brandId]: events }));
    }
  };

  /* ─── Excel File Selection & Parse ─── */
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError('');
    try {
      const result = await parseBrandCatalogExcel(file, brands);
      if (result.totalRows === 0) {
        toast.warning('The uploaded Excel file has no data rows.');
        return;
      }
      setImportPreviewData({
        fileName: file.name,
        ...result,
      });
      setShowImportModal(true);
    } catch (err) {
      toast.error('Failed to parse Excel file: ' + err.message);
    } finally {
      e.target.value = '';
    }
  };

  /* ─── Confirm Batch Import ─── */
  const handleConfirmImport = async () => {
    if (!importPreviewData?.validBrands || importPreviewData.validBrands.length === 0) {
      toast.warning('No valid brands to import.');
      return;
    }

    setImporting(true);
    setImportError('');
    try {
      const created = await batchCreateBrands(importPreviewData.validBrands, user.uid);
      setBrands((prev) => {
        const next = [...prev, ...created];
        cacheBrandCatalog(next);
        return next;
      });
      toast.success(`Successfully imported ${created.length} brand(s)!`);
      setShowImportModal(false);
      setImportPreviewData(null);
    } catch (err) {
      console.error('Error importing brands:', err);
      setImportError(err.message || 'Failed to import brands.');
      toast.error(err.message || 'Failed to import brands.');
    } finally {
      setImporting(false);
    }
  };

  const filtered = brands.filter((b) => {
    const term = searchTerm.toLowerCase();
    return b.brandName?.toLowerCase().includes(term) ||
           b.fieldOfWork?.toLowerCase().includes(term) ||
           b.companyEmail?.toLowerCase().includes(term);
  });

  return (
    <div className="mobile-container page-enter">
      <div className="scroll-view">
        {/* Hidden Excel File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          accept=".xlsx, .xls"
        />

        {/* Header with Excel Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <h1 style={{ margin: 0, fontSize: 'var(--font-2xl)' }}>Brand Manager</h1>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={downloadBrandCatalogTemplate}
              className="btn btn-secondary btn-sm"
              title="Download Excel template for importing brands"
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span>📄 Download Template</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-secondary btn-sm"
              title="Bulk import brands from an Excel file"
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span>📥 Import Excel</span>
            </button>
            {brands.length > 0 && (
              <button
                type="button"
                onClick={() => exportBrandCatalog(brands)}
                className="btn btn-secondary btn-sm"
                title="Export all brands to an Excel file"
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <span>📤 Export Brands</span>
              </button>
            )}
            <button
              onClick={() => { setEditTarget(null); setShowFormModal(true); }}
              className="btn btn-primary btn-sm"
            >
              + Create Brand
            </button>
          </div>
        </div>

        <SearchInput searchTerm={searchTerm} setSearchTerm={setSearchTerm} placeholder="Search brands..." />

        {loading && <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</p>}

        {!loading && filtered.length === 0 && (
          <EmptyState icon="🏢" message="No brands yet. Create the first one or import from Excel!" />
        )}

        {/* Brand cards */}
        {filtered.map((brand) => (
          <div key={brand.brandId} className="touchable-card" style={{ flexDirection: 'column', padding: 'var(--space-4)', cursor: 'default' }}>
            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
              {/* Logo */}
              <BrandLogo url={brand.logoUrl} name={brand.brandName} size={60} />

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <span className="badge badge-solid">#{brand.brandId}</span>
                  <h3 style={{ margin: 0, fontSize: 'var(--font-lg)' }}>{brand.brandName}</h3>
                </div>
                <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>{brand.fieldOfWork}</p>
                {brand.companyEmail && (
                  <p style={{ margin: '2px 0 0', fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>✉️ {brand.companyEmail}</p>
                )}
                {brand.phone && (
                  <p style={{ margin: '2px 0 0', fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>📞 {brand.phone}</p>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', flexShrink: 0 }}>
                <button onClick={() => { setEditTarget(brand); setShowFormModal(true); }} className="btn btn-ghost btn-sm" aria-label={`Edit ${brand.brandName}`} title="Edit">✏️</button>
                <button onClick={() => handleDelete(brand)} className="btn btn-ghost btn-sm" aria-label={`Delete ${brand.brandName}`} title="Delete">🗑️</button>
              </div>
            </div>

            {/* Expand: joined events */}
            <button
              onClick={() => toggleExpand(brand)}
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 'var(--space-3)', alignSelf: 'flex-start' }}
            >
              {expandedBrand === brand.brandId ? '▲ Hide Events' : '▼ Joined Events'}
            </button>

            {expandedBrand === brand.brandId && (
              <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {!brandEvents[brand.brandId] && <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>Loading...</p>}
                {brandEvents[brand.brandId]?.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>Not assigned to any events yet.</p>
                )}
                {brandEvents[brand.brandId]?.map((ev) => (
                  <div key={ev.combinedId} style={eventRowStyle}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: 'var(--font-sm)', color: 'var(--text-primary)' }}>{ev.eventName}</div>
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>{ev.eventDateStart} · {ev.eventLocation}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexShrink: 0 }}>
                      <span className="badge" style={{ background: RANK_COLORS[ev.rank] || 'var(--accent)', color: ev.rank === 'gold' ? '#0b0c10' : '#fff' }}>
                        {ev.rank}
                      </span>
                      {ev.position && <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Pos: {ev.position}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Manual Create / Edit Brand Form Modal */}
      {showFormModal && (
        <BrandFormModal
          initial={editTarget}
          prefill={editTarget ? null : { company: user?.company, address: user?.address, phone: user?.phone }}
          onClose={() => { setShowFormModal(false); setEditTarget(null); }}
          onSubmit={editTarget ? handleEdit : handleCreate}
          saving={saving}
        />
      )}

      {/* Excel Bulk Import Preview Modal */}
      {showImportModal && importPreviewData && (
        <div style={modalOverlayStyle({ zIndex: 9999 })} onClick={() => setShowImportModal(false)}>
          <div
            style={{
              ...modalCardStyle({ maxWidth: '640px' }),
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 'var(--font-xl)' }}>Import Brands Preview</h2>
                <p style={{ margin: '2px 0 0', fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
                  File: <strong>{importPreviewData.fileName}</strong> ({importPreviewData.totalRows} row{importPreviewData.totalRows === 1 ? '' : 's'})
                </p>
              </div>
              <button onClick={() => setShowImportModal(false)} style={modalCloseBtnStyle} aria-label="Close">✕</button>
            </div>

            {/* Summary Badges */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
              <span className="badge" style={{ background: 'var(--success)', color: '#fff', fontSize: '11px' }}>
                Ready to create: {importPreviewData.validBrands.length}
              </span>
              {importPreviewData.duplicateBrands.length > 0 && (
                <span className="badge" style={{ background: '#f59e0b', color: '#111', fontSize: '11px' }}>
                  Duplicates (skipped): {importPreviewData.duplicateBrands.length}
                </span>
              )}
              {importPreviewData.invalidRows.length > 0 && (
                <span className="badge" style={{ background: 'var(--danger)', color: '#fff', fontSize: '11px' }}>
                  Invalid rows: {importPreviewData.invalidRows.length}
                </span>
              )}
            </div>

            {/* Preview Table */}
            <div style={{
              maxHeight: '260px',
              overflowY: 'auto',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-input)',
              marginBottom: 'var(--space-3)',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-xs)', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-card-solid)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 600 }}>#</th>
                    <th style={{ padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 600 }}>Brand Name</th>
                    <th style={{ padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 600 }}>Field of Work</th>
                    <th style={{ padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 600 }}>Email</th>
                    <th style={{ padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreviewData.validBrands.map((b) => (
                    <tr key={b.rowNum} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{b.rowNum}</td>
                      <td style={{ padding: '6px 10px', fontWeight: 600, color: 'var(--text-primary)' }}>{b.brandName}</td>
                      <td style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>{b.fieldOfWork || '—'}</td>
                      <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{b.companyEmail || '—'}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--success)', fontWeight: 700 }}>✓ Ready</td>
                    </tr>
                  ))}
                  {importPreviewData.duplicateBrands.map((b) => (
                    <tr key={`dup-${b.rowNum}`} style={{ borderBottom: '1px solid var(--border)', opacity: 0.65, background: 'rgba(245, 158, 11, 0.04)' }}>
                      <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{b.rowNum}</td>
                      <td style={{ padding: '6px 10px', fontWeight: 600, color: 'var(--text-primary)' }}>{b.brandName}</td>
                      <td style={{ padding: '6px 10px', color: 'var(--text-secondary)' }} colSpan={2}>
                        <em>{b.reason}</em>
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', color: '#f59e0b', fontWeight: 600 }}>Duplicate</td>
                    </tr>
                  ))}
                  {importPreviewData.invalidRows.map((b) => (
                    <tr key={`inv-${b.rowNum}`} style={{ borderBottom: '1px solid var(--border)', opacity: 0.65, background: 'rgba(239, 68, 68, 0.04)' }}>
                      <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{b.rowNum}</td>
                      <td style={{ padding: '6px 10px', color: 'var(--danger)' }} colSpan={3}>
                        <em>{b.reason}</em>
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--danger)', fontWeight: 600 }}>Invalid</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {importError && (
              <p style={{ color: 'var(--danger)', fontSize: 'var(--font-sm)', margin: '0 0 var(--space-3)' }}>
                {importError}
              </p>
            )}

            {/* Modal Actions */}
            <div className="btn-group" style={{ margin: 0 }}>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="btn btn-secondary btn-flex"
                disabled={importing}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importing || importPreviewData.validBrands.length === 0}
                className="btn btn-primary btn-flex"
                style={{
                  opacity: importing || importPreviewData.validBrands.length === 0 ? 0.5 : 1,
                }}
              >
                {importing ? 'Importing...' : `Confirm & Import ${importPreviewData.validBrands.length} Brand${importPreviewData.validBrands.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const eventRowStyle = {
  display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
  padding: 'var(--space-2) var(--space-3)',
  background: 'var(--bg-input)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-gold)',
};

export default BrandManager;
