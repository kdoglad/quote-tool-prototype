import * as XLSX from 'xlsx';
import { SPEC_TABLES, UI_FIELDS, AC_MAP_FIELDS } from './excelTemplateConfig';

export function exportExcelTemplate(versionName: string, auditData: any) {
  const wb = XLSX.utils.book_new();

  // 1. Instructions Sheet
  const instructions = [
    ["Bulk Upload Excel Template"],
    [""],
    ["Instructions:"],
    ["1. Each sheet corresponds to a specification category."],
    ["2. Do not rename the sheets or the column headers."],
    ["3. Fill in the rows below the headers to add or update items."],
    ["4. Upload this file back into the system to perform a bulk import."],
  ];
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
  
  // Set some basic column widths for instructions
  wsInstructions['!cols'] = [{ wch: 60 }];
  
  XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");

  const items = auditData?.items || [];
  
  // 2. Spec Sheets
  for (const { cat, table, name } of SPEC_TABLES) {
    const fields = UI_FIELDS[cat] || [];
    
    // Find all items belonging to this table
    const tableItems = items.filter((entry: any) => 
      entry.action !== 'DELETE' && entry.table_name === table
    );

    const rows = [fields]; // Header row

    for (const entry of tableItems) {
      const spec = entry.spec_data || {};
      const catData = entry.catalog_data || {};
      
      const row = fields.map(field => {
        let val = spec[field];
        if (val === undefined || val === null) {
           val = catData[field];
        }
        return val ?? '';
      });
      rows.push(row);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    
    // Auto-fit columns slightly
    ws['!cols'] = fields.map(() => ({ wch: 15 }));

    // Ensure sheet name is <= 31 chars (Excel limit)
    const sheetName = name.substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  // 3. AC Map Sheet
  const acMap = auditData?.ac_map || [];
  const acRows = [AC_MAP_FIELDS];
  for (const row of acMap) {
    const r = AC_MAP_FIELDS.map(f => row[f] ?? '');
    acRows.push(r);
  }
  const wsAc = XLSX.utils.aoa_to_sheet(acRows);
  wsAc['!cols'] = AC_MAP_FIELDS.map(() => ({ wch: 15 }));
  XLSX.utils.book_append_sheet(wb, wsAc, "AC Map");

  // 4. Download
  const safeName = (versionName || 'Draft').replace(/[^a-z0-9_-]/gi, '_');
  XLSX.writeFile(wb, `${safeName}_Specs_Template.xlsx`);
}
