import { toast } from './toast';
import { assignmentKey } from './keys';

/** Security & safety limits for Excel files */
const MAX_EXCEL_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB max
const MAX_EXCEL_ROWS = 2000; // Max rows per import to prevent UI freeze / DoS
const MAX_FIELD_LENGTH = 300; // Max characters per text field
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Prevent CSV / Excel Formula Injection on exported cells.
 * Prefixes a single quote if a string starts with =, +, -, @, tab, or CR,
 * unless it is a benign phone number (e.g. "+84 91 234 5678").
 */
export const sanitizeExcelExportCell = (value, isPhone = false) => {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  if (!str) return '';
  if (isPhone && /^\+?[0-9\s\-().]{5,25}$/.test(str)) {
    return str;
  }
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
};

/**
 * Sanitize an imported cell string:
 * - Strips leading formula characters (=, @)
 * - Enforces maximum character length
 */
const sanitizeImportedString = (value, maxLength = MAX_FIELD_LENGTH) => {
  if (value === null || value === undefined) return '';
  let str = String(value).trim();
  // Strip leading '=' or '@' formula prefixes from untrusted spreadsheets
  str = str.replace(/^[=@]+/, '').trim();
  if (str.length > maxLength) {
    str = str.slice(0, maxLength);
  }
  return str;
};

/**
 * Validate and sanitize an imported logo URL.
 * Only allows valid http:// or https:// URLs; returns '' otherwise.
 */
const sanitizeImportedUrl = (url) => {
  const cleaned = sanitizeImportedString(url, 500);
  if (!cleaned) return '';
  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.href;
    }
  } catch {
    // Invalid URL format — ignore safely
  }
  return '';
};

/**
 * Validate uploaded Excel file size and extension before parsing.
 */
export const validateExcelFile = (file) => {
  if (!file) {
    throw new Error('No file selected.');
  }
  const fileName = (file.name || '').toLowerCase();
  if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
    throw new Error('Invalid file format. Please upload a valid .xlsx or .xls Excel file.');
  }
  if (file.size > MAX_EXCEL_FILE_SIZE_BYTES) {
    throw new Error(
      `Excel file is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum allowed size is 5MB.`
    );
  }
};

/**
 * Safely parse the first worksheet of an Excel File into an array of row objects.
 * Uses ArrayBuffer (replacing deprecated readAsBinaryString) and disables formula/HTML evaluation.
 */
export const readExcelFileSafely = async (file) => {
  validateExcelFile(file);

  const arrayBuffer = await file.arrayBuffer();
  const XLSX = await import('xlsx');

  const workbook = XLSX.read(arrayBuffer, {
    type: 'array',
    cellFormula: false, // Do not parse or evaluate formulas
    cellHTML: false,    // Do not generate HTML from cells
    cellNF: false,      // Do not parse custom number formats (mitigates ReDoS)
    dense: true,
  });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('The Excel workbook contains no sheets.');
  }

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error('Could not read the first worksheet of the Excel file.');
  }

  const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  if (!Array.isArray(rawJson) || rawJson.length === 0) {
    throw new Error('The Excel file is empty or missing data rows.');
  }

  if (rawJson.length > MAX_EXCEL_ROWS) {
    throw new Error(
      `The Excel file has ${rawJson.length} rows, which exceeds the maximum limit of ${MAX_EXCEL_ROWS} rows per import.`
    );
  }

  return rawJson;
};

/**
 * Safely extract a column value from a row object by matching header keywords,
 * ignoring prototype-polluting keys.
 */
const createSafeRowExtractor = (row) => {
  const safeKeys = Object.keys(row).filter(
    (k) => Object.prototype.hasOwnProperty.call(row, k) && !DANGEROUS_KEYS.has(k)
  );
  return (keywords, maxLength = MAX_FIELD_LENGTH) => {
    const matchedKey = safeKeys.find((key) => {
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      return keywords.some((kw) => normalized.includes(kw));
    });
    return matchedKey ? sanitizeImportedString(row[matchedKey], maxLength) : '';
  };
};

/**
 * Download the Excel template for importing brands into the global catalog.
 */
export const downloadBrandCatalogTemplate = async () => {
  const XLSX = await import('xlsx');
  const headers = [
    ['Brand Name', 'Field of Work', 'Company Email', 'Phone', 'Company Address', 'Logo URL']
  ];
  const sampleRows = [
    ['Acme Corporation', 'Technology & AI', 'contact@acme.com', '+1-555-0101', '100 Innovation Way, Tech Park', 'https://example.com/logo1.png'],
    ['Green Energy Ltd', 'Renewable Energy', 'info@greenenergy.io', '+1-555-0102', '25 Solar Boulevard, Eco City', ''],
    ['NextGen Robotics', 'Industrial Automation', 'hello@nextgenrobotics.com', '+1-555-0103', '500 Automata Drive, Suite 4', ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet([...headers, ...sampleRows]);
  ws['!cols'] = [
    { wch: 25 }, // Brand Name
    { wch: 22 }, // Field of Work
    { wch: 26 }, // Company Email
    { wch: 18 }, // Phone
    { wch: 32 }, // Company Address
    { wch: 32 }, // Logo URL
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Brands Template');
  XLSX.writeFile(wb, 'TreasureLayout_Brands_Import_Template.xlsx');
};

/**
 * Export all brands from the global catalog to an Excel file.
 * @param {Array<Object>} brands
 */
export const exportBrandCatalog = async (brands = []) => {
  if (!brands || brands.length === 0) {
    toast.warning('No brands in catalog to export.');
    return;
  }

  const XLSX = await import('xlsx');
  const rows = brands.map((b) => ({
    'Brand ID': sanitizeExcelExportCell(b.brandId),
    'Brand Name': sanitizeExcelExportCell(b.brandName),
    'Field of Work': sanitizeExcelExportCell(b.fieldOfWork),
    'Company Email': sanitizeExcelExportCell(b.companyEmail),
    'Phone': sanitizeExcelExportCell(b.phone, true),
    'Company Address': sanitizeExcelExportCell(b.companyAddress || b.address),
    'Logo URL': sanitizeExcelExportCell(b.logoUrl),
    'Created At': b.createdAt ? new Date(b.createdAt).toLocaleString() : '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 12 },
    { wch: 25 },
    { wch: 22 },
    { wch: 26 },
    { wch: 18 },
    { wch: 30 },
    { wch: 30 },
    { wch: 22 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Brand Catalog');
  XLSX.writeFile(wb, 'TreasureLayout_Brands_Export.xlsx');
};

/**
 * Export assigned brands for a specific event to an Excel file with formula-injection protection.
 * @param {Array<Object>} assignedBrands
 * @param {string} eventName
 */
export const exportAssignedBrandsExcel = async (assignedBrands = [], eventName = 'Event') => {
  if (!assignedBrands || assignedBrands.length === 0) {
    toast.warning('No brands assigned to this event yet.');
    return;
  }

  const XLSX = await import('xlsx');
  const rows = assignedBrands.map((a) => ({
    'Brand ID': sanitizeExcelExportCell(a.brandId),
    'Brand Name': sanitizeExcelExportCell(a.brandName),
    'Rank': sanitizeExcelExportCell(a.rank),
    'Booth Position': sanitizeExcelExportCell(a.position),
    'Treasure Holder': a.isTreasureHolder ? 'Yes' : 'No',
    'Field of Work': sanitizeExcelExportCell(a.fieldOfWork),
    'Assigned At': a.assignedAt ? new Date(a.assignedAt).toLocaleString() : '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 12 },
    { wch: 25 },
    { wch: 15 },
    { wch: 18 },
    { wch: 18 },
    { wch: 25 },
    { wch: 22 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Assigned Brands');
  const safeEventName = String(eventName || 'Event')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .slice(0, 60);
  XLSX.writeFile(wb, `${safeEventName}_Assigned_Brands.xlsx`);
};

/**
 * Parse an uploaded Excel file for bulk brand catalog import.
 * @param {File} file
 * @param {Array<Object>} existingBrands
 * @returns {Promise<{ validBrands: Array, duplicateBrands: Array, invalidRows: Array, totalRows: number }>}
 */
export const parseBrandCatalogExcel = async (file, existingBrands = []) => {
  const rawJson = await readExcelFileSafely(file);

  const existingNames = new Set(
    existingBrands.map((b) => b.brandName?.trim().toLowerCase()).filter(Boolean)
  );
  const seenInFile = new Set();

  const validBrands = [];
  const duplicateBrands = [];
  const invalidRows = [];

  rawJson.forEach((row, idx) => {
    if (!row || typeof row !== 'object') return;
    const findVal = createSafeRowExtractor(row);

    const brandName = findVal(['brandname', 'brand', 'name'], 120);
    const fieldOfWork = findVal(['fieldofwork', 'field', 'industry', 'category', 'work'], 150);
    const companyEmail = findVal(['companyemail', 'email', 'mail'], 150);
    const phone = findVal(['phone', 'tel', 'mobile', 'contact'], 40);
    const companyAddress = findVal(['companyaddress', 'address', 'location'], 250);
    const rawLogoUrl = findVal(['logourl', 'logo', 'image', 'url'], 500);
    const logoUrl = sanitizeImportedUrl(rawLogoUrl);

    const rowNum = idx + 2;

    if (!brandName) {
      invalidRows.push({ rowNum, reason: 'Missing Brand Name' });
      return;
    }

    const lowerName = brandName.toLowerCase();
    if (existingNames.has(lowerName)) {
      duplicateBrands.push({ rowNum, brandName, reason: 'Already exists in system' });
      return;
    }

    if (seenInFile.has(lowerName)) {
      duplicateBrands.push({ rowNum, brandName, reason: 'Duplicate inside file' });
      return;
    }

    seenInFile.add(lowerName);

    validBrands.push({
      rowNum,
      brandName,
      fieldOfWork,
      companyEmail,
      phone,
      companyAddress,
      logoUrl,
    });
  });

  return {
    validBrands,
    duplicateBrands,
    invalidRows,
    totalRows: rawJson.length,
  };
};

/**
 * Parse an uploaded Excel file for bulk assigning brands to an event.
 * @param {File} file
 * @param {Array<Object>} brands - Global brand catalog
 * @param {string} eventId - Current event ID
 * @param {Array<string>} assignedBrandIds - Already assigned combinedIds
 * @returns {Promise<Array<Object>>}
 */
export const parseBrandAssignmentExcel = async (file, brands = [], eventId = '', assignedBrandIds = []) => {
  const rawJson = await readExcelFileSafely(file);
  const seenCombinedIds = new Set();
  const assignedSet = new Set(assignedBrandIds);

  return rawJson.map((row, idx) => {
    const findVal = row && typeof row === 'object' ? createSafeRowExtractor(row) : () => '';

    const brandNameRaw = findVal(['brandname', 'brand', 'name'], 120);
    const brandIdRaw = findVal(['brandid', 'id'], 40);
    const rankRaw = findVal(['rank'], 20).toLowerCase();
    const validRank = ['gold', 'silver', 'bronze', 'standard'].includes(rankRaw) ? rankRaw : 'standard';
    const posRaw = findVal(['boothposition', 'position', 'booth', 'pos'], 60);

    // Match against global brand catalog
    let matched = null;
    if (brandIdRaw) {
      matched = brands.find((b) => String(b.brandId).toLowerCase() === String(brandIdRaw).toLowerCase());
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

    const combinedId = assignmentKey(eventId, matched.brandId);
    if (assignedSet.has(combinedId)) {
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
};

/**
 * Generate and download the Excel import template for brand assignment.
 * Sheet 1: Template with column headers and sample rows.
 * Sheet 2: Reference catalog of all existing brands in the system.
 */
export const downloadBrandAssignmentTemplate = async (brands = []) => {
  const XLSX = await import('xlsx');
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

  if (brands && brands.length > 0) {
    const catalogRows = [
      ['Brand ID', 'Brand Name', 'Field of Work', 'Company Email'],
      ...brands.map((b) => [
        sanitizeExcelExportCell(b.brandId),
        sanitizeExcelExportCell(b.brandName),
        sanitizeExcelExportCell(b.fieldOfWork),
        sanitizeExcelExportCell(b.companyEmail),
      ]),
    ];
    const catalogWs = XLSX.utils.aoa_to_sheet(catalogRows);
    catalogWs['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 20 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, catalogWs, 'Available Brands Catalog');
  }

  XLSX.writeFile(wb, 'TreasureLayout_Brand_Assignment_Template.xlsx');
};

/**
 * Export visitors from the 'relative' collection to an Excel file with formula-injection sanitization.
 * @param {Array<Object>} visitors
 * @param {string} brandLabel
 */
export const exportBrandVisitorsExcel = async (visitors = [], brandLabel = 'Brand') => {
  if (!visitors || visitors.length === 0) {
    toast.warning('No visitors found to export.');
    return;
  }

  const XLSX = await import('xlsx');
  const rows = visitors.map((v) => ({
    'Relative ID': sanitizeExcelExportCell(v.relativeId || v.id),
    'Event Name': sanitizeExcelExportCell(v.eventName),
    'Brand Name': sanitizeExcelExportCell(v.brandName),
    'Brand ID': sanitizeExcelExportCell(v.brandId),
    'Visitor Name': sanitizeExcelExportCell(v.visitorName),
    'Visitor ID': sanitizeExcelExportCell(v.visitorDisplayId || v.userId),
    'Company': sanitizeExcelExportCell(v.visitorCompany),
    'Position': sanitizeExcelExportCell(v.visitorPosition),
    'Email': sanitizeExcelExportCell(v.visitorEmail),
    'Phone': sanitizeExcelExportCell(v.visitorPhone, true),
    'Address': sanitizeExcelExportCell(v.visitorAddress),
    'Visited At': v.visitedAt ? new Date(v.visitedAt).toLocaleString() : '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 28 },
    { wch: 26 },
    { wch: 22 },
    { wch: 12 },
    { wch: 22 },
    { wch: 14 },
    { wch: 24 },
    { wch: 20 },
    { wch: 26 },
    { wch: 18 },
    { wch: 28 },
    { wch: 22 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Brand Visitors');
  const safeBrand = String(brandLabel || 'Brand')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .slice(0, 50);
  XLSX.writeFile(wb, `${safeBrand}_Booth_Visitors.xlsx`);
};


