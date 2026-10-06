import * as XLSX from 'xlsx';
import { toast } from './toast';

/**
 * Download the Excel template for importing brands into the global catalog.
 */
export const downloadBrandCatalogTemplate = () => {
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
export const exportBrandCatalog = (brands = []) => {
  if (!brands || brands.length === 0) {
    toast.warning('No brands in catalog to export.');
    return;
  }

  const rows = brands.map((b) => ({
    'Brand ID': b.brandId || '',
    'Brand Name': b.brandName || '',
    'Field of Work': b.fieldOfWork || '',
    'Company Email': b.companyEmail || '',
    'Phone': b.phone || '',
    'Company Address': b.companyAddress || b.address || '',
    'Logo URL': b.logoUrl || '',
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
 * Parse an uploaded Excel file for bulk brand catalog import.
 * @param {File} file
 * @param {Array<Object>} existingBrands
 * @returns {Promise<{ validBrands: Array, duplicateBrands: Array, invalidRows: Array, totalRows: number }>}
 */
export const parseBrandCatalogExcel = (file, existingBrands = []) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet);

        if (!rawJson || rawJson.length === 0) {
          throw new Error('The Excel file is empty or missing data rows.');
        }

        const existingNames = new Set(
          existingBrands.map((b) => b.brandName?.trim().toLowerCase()).filter(Boolean)
        );
        const seenInFile = new Set();

        const validBrands = [];
        const duplicateBrands = [];
        const invalidRows = [];

        rawJson.forEach((row, idx) => {
          const rowKeys = Object.keys(row);
          const findVal = (keywords) => {
            const k = rowKeys.find((key) =>
              keywords.some((kw) => key.toLowerCase().replace(/[^a-z0-9]/g, '').includes(kw))
            );
            return k ? String(row[k]).trim() : '';
          };

          const brandName = findVal(['brandname', 'brand', 'name']);
          const fieldOfWork = findVal(['fieldofwork', 'field', 'industry', 'category', 'work']);
          const companyEmail = findVal(['companyemail', 'email', 'mail']);
          const phone = findVal(['phone', 'tel', 'mobile', 'contact']);
          const companyAddress = findVal(['companyaddress', 'address', 'location']);
          const logoUrl = findVal(['logourl', 'logo', 'image', 'url']);

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

        resolve({
          validBrands,
          duplicateBrands,
          invalidRows,
          totalRows: rawJson.length,
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};
