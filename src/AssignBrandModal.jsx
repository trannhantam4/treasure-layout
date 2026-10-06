import { useState, useRef, memo } from 'react';
import * as XLSX from 'xlsx';
import { assignBrandToEvent, batchAssignBrandsToEvent } from './Brand';
import { useBrands } from './hooks/useBrands';
import { assignmentKey } from './utils/keys';
import BrandLogo from './components/BrandLogo';
import SearchInput from './SearchInput';
import { modalOverlayStyle, modalCardStyle, modalCloseBtnStyle } from './Modal';

const RANKS = ['gold', 'silver', 'bronze', 'standard'];

/**
 * Generate and download the Excel import template for brand assignment.
 * Sheet 1: Template with column headers and sample rows.
 * Sheet 2: Reference catalog of all existing brands in the system.
 */
export const downloadBrandAssignmentTemplate = (brands = []) => {
  const headers = [['Brand Name', 'Rank', 'Booth Position', 'Brand ID (Optional)']];
  const sampleRows = [
    ['Example Tech Corp', 'gold', 'A-01', ''],
    ['Global Solutions', 'silver', 'Booth 12', ''],
    ['Innovative Apps', 'standard', 'Hall B-05', ''],
  ];

  const templateWs = XLSX.utils.aoa_to_sheet([...headers, ...sampleRows]);
  templateWs['!cols'] = [
    { wch: 25 },
    { wch: 15 },
    { wch: 20 },
    { wch: 20 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, templateWs, 'Brand Import Template');

  // Sheet 2: Reference list of available brands in catalog
  if (brands && brands.length > 0) {
    const catalogRows = [
      ['Brand ID', 'Brand Name', 'Field of Work', 'Company Email'],
      ...brands.map((b) => [
        b.brandId || '',
        b.brandName || '',
        b.fieldOfWork || '',
        b.companyEmail || '',
      ]),
    ];
    const catalogWs = XLSX.utils.aoa_to_sheet(catalogRows);
    catalogWs['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 20 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, catalogWs, 'Available Brands Catalog');
  }

  XLSX.writeFile(wb, 'TreasureLayout_Brand_Assignment_Template.xlsx');
};

const AssignBrandModal = memo(({
  event,
  assignedBrandIds = [],
  onClose,
  onAssigned,
  user,
  initialTab = 'single'
}) => {
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

  const filteredBrands = brands.filter((b) => {
    const term = search.toLowerCase();
    return (
      b.brandName?.toLowerCase().includes(term) ||
      b.fieldOfWork?.toLowerCase().includes(term)
    );
  });

  const isAlreadyAssigned = (b) =>
    assignedBrandIds.includes(assignmentKey(event.eventId, b.brandId));

  /* ─── Single Brand Assign ─── */
  const handleAssignSingle = async () => {
    if (!selected) {
      setError('Please select a brand.');
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
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setError('');
    setBatchSuccessMsg('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet);

        if (!rawJson || rawJson.length === 0) {
          setError('The Excel file is empty or missing data rows.');
          setIsParsing(false);
          return;
        }

        const seenCombinedIds = new Set();
        const parsed = rawJson.map((row, idx) => {
          // Dynamic case-insensitive key extraction
          const rowKeys = Object.keys(row);
          const findVal = (keywords) => {
            const k = rowKeys.find((key) =>
              keywords.some((kw) => key.toLowerCase().replace(/[^a-z0-9]/g, '').includes(kw))
            );
            return k ? String(row[k]).trim() : '';
          };

          const brandNameRaw = findVal(['brandname', 'brand', 'name']);
          const brandIdRaw = findVal(['brandid', 'id']);
          const rankRaw = findVal(['rank']).toLowerCase();
          const validRank = ['gold', 'silver', 'bronze', 'standard'].includes(rankRaw) ? rankRaw : 'standard';
          const posRaw = findVal(['boothposition', 'position', 'booth', 'pos']);

          // Match against global brand catalog
          let matched = null;
          if (brandIdRaw) {
            matched = brands.find((b) => String(b.brandId) === String(brandIdRaw));
          }
          if (!matched && brandNameRaw) {
            matched = brands.find(
              (b) => b.brandName?.trim().toLowerCase() === brandNameRaw.toLowerCase()
            );
          }

          if (!matched) {
            return {
              rowIdx: idx + 2,
              inputName: brandNameRaw || `Row #${idx + 2}`,
              inputId: brandIdRaw,
              rank: validRank,
              position: posRaw,
              status: 'not_found',
              reason: 'Brand not found in catalog',
            };
          }

          const combinedId = assignmentKey(event.eventId, matched.brandId);
          if (assignedBrandIds.includes(combinedId)) {
            return {
              rowIdx: idx + 2,
              inputName: matched.brandName,
              inputId: matched.brandId,
              matchedBrand: matched,
              rank: validRank,
              position: posRaw,
              status: 'already_assigned',
              reason: 'Already assigned to this event',
            };
          }

          if (seenCombinedIds.has(combinedId)) {
            return {
              rowIdx: idx + 2,
              inputName: matched.brandName,
              inputId: matched.brandId,
              matchedBrand: matched,
              rank: validRank,
              position: posRaw,
              status: 'duplicate',
              reason: 'Duplicate entry in Excel file',
            };
          }

          seenCombinedIds.add(combinedId);

          return {
            rowIdx: idx + 2,
            inputName: matched.brandName,
            inputId: matched.brandId,
            matchedBrand: matched,
            rank: validRank,
            position: posRaw,
            status: 'ready',
          };
        });

        setExcelRows(parsed);
        setUploadFileName(file.name);
      } catch (err) {
        console.error('Error parsing Excel:', err);
        setError('Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.');
      } finally {
        setIsParsing(false);
      }
    };

    reader.readAsBinaryString(file);
    e.target.value = '';
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
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          transition: 'max-width var(--duration-normal) var(--ease-out)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--font-xl)' }}>Assign Brands to Event</h2>
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
            👤 Manual Select
          </button>
          <button
            type="button"
            onClick={() => { setTab('excel'); setError(''); }}
            className={`btn btn-sm ${tab === 'excel' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>📊 Excel Bulk Import</span>
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
              setSearchTerm={setSearch}
              placeholder="Search brand by name or field..."
              style={{ marginBottom: 'var(--space-3)' }}
            />

            <div style={listStyle}>
              {loading && <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading brands...</p>}
              {!loading && filteredBrands.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No brands found.</p>
              )}
              {filteredBrands.map((b) => {
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
                      <span className="badge badge-accent" style={{ flexShrink: 0 }}>Assigned</span>
                    )}
                    {isSelected && !assigned && (
                      <span style={{ fontSize: '1rem', flexShrink: 0, color: 'var(--accent)' }}>✓</span>
                    )}
                  </div>
                );
              })}
            </div>

            {selected && (
              <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-input)' }}>
                <p style={{ margin: '0 0 var(--space-3)', fontWeight: '600', color: 'var(--text-primary)' }}>
                  Assigning: <em>{selected.brandName}</em>
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div>
                    <label htmlFor="assignRank" className="form-label form-label-bold">Rank</label>
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
                    <label htmlFor="assignPosition" className="form-label form-label-bold">Booth Position</label>
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
              <button onClick={onClose} className="btn btn-secondary btn-flex">Cancel</button>
              <button
                onClick={handleAssignSingle}
                disabled={saving || !selected}
                className="btn btn-primary btn-flex"
              >
                {saving ? 'Assigning...' : 'Assign Brand'}
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
                  Bulk Brand Assignment via Excel
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Download the official template or use your own .xlsx/.xls file.
                </span>
              </div>
              <button
                type="button"
                onClick={() => downloadBrandAssignmentTemplate(brands)}
                className="btn btn-secondary btn-sm"
                style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>📥 Download Template</span>
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
                {uploadFileName ? uploadFileName : 'Click to select or drop Excel file'}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                {uploadFileName ? 'Click to choose a different file' : 'Accepts .xlsx and .xls (Columns: Brand Name, Rank, Booth Position)'}
              </p>
            </div>

            {isParsing && (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>
                Parsing Excel file...
              </p>
            )}

            {/* Parsed Preview Table & Statistics */}
            {excelRows.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                {/* Status Badges */}
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-2)' }}>
                  <span className="badge" style={{ background: 'var(--success)', color: '#fff', fontSize: '11px' }}>
                    Ready to assign: {readyCount}
                  </span>
                  {alreadyCount > 0 && (
                    <span className="badge" style={{ background: '#f59e0b', color: '#111', fontSize: '11px' }}>
                      Already assigned: {alreadyCount}
                    </span>
                  )}
                  {notFoundCount > 0 && (
                    <span className="badge" style={{ background: 'var(--danger)', color: '#fff', fontSize: '11px' }}>
                      Not in catalog: {notFoundCount}
                    </span>
                  )}
                  {duplicateCount > 0 && (
                    <span className="badge" style={{ background: 'var(--text-muted)', color: '#fff', fontSize: '11px' }}>
                      Duplicate: {duplicateCount}
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
                        <th style={{ padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 600 }}>Brand Name</th>
                        <th style={{ padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 600 }}>Rank</th>
                        <th style={{ padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 600 }}>Position</th>
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
                              <span style={{ color: '#f59e0b', fontWeight: 600 }}>Assigned</span>
                            )}
                            {r.status === 'not_found' && (
                              <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Not found</span>
                            )}
                            {r.status === 'duplicate' && (
                              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Duplicate</span>
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
                Cancel
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
                {savingBatch ? 'Assigning...' : `Assign ${readyCount} Brand${readyCount === 1 ? '' : 's'}`}
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
