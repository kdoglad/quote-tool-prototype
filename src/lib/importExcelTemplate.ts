import { supabase } from './supabase';
import { PREFIX_MAP } from './constants';
import * as XLSX from 'xlsx';
import { SPEC_TABLES, UI_FIELDS, AC_MAP_FIELDS, FIELD_TYPES } from './excelTemplateConfig';

export async function importExcelTemplate(file: File, existingItems: any[]): Promise<{ items: any[], acMap: any[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        
        const errors: string[] = [];
        const newItems: any[] = [];
        const newAcMap: any[] = [];

        // Fetch max item codes for auto-generation
        const { data: catData, error: catErr } = await supabase.from('catalog_items').select('item_code');
        if (catErr) {
          reject('Failed to fetch existing item codes from database');
          return;
        }

        const prefixMaxes: Record<string, number> = {};
        const updateMax = (code: string | undefined | null) => {
          if (code && typeof code === 'string') {
            const match = code.match(/^([A-Z]+)-(\d+)$/i);
            if (match) {
              const pfx = match[1].toUpperCase();
              const num = parseInt(match[2], 10);
              if (!prefixMaxes[pfx] || num > prefixMaxes[pfx]) {
                prefixMaxes[pfx] = num;
              }
            }
          }
        };

        if (catData) {
          catData.forEach(row => updateMax(row.item_code));
        }
        existingItems.forEach(ei => updateMax(ei.catalog_data?.item_code));

        const getNextItemCode = (cat: string) => {
          const prefix = PREFIX_MAP[cat] || 'XX';
          const currentMax = prefixMaxes[prefix] || 0;
          const newMax = currentMax + 1;
          prefixMaxes[prefix] = newMax;
          return `${prefix}-${newMax.toString().padStart(3, '0')}`;
        };

        // 1. Process AC Map
        if (wb.SheetNames.includes('AC Map')) {
          const ws = wb.Sheets['AC Map'];
          const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
          
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const acRow: any = {};
            let isEmptyRow = true;

            for (const field of AC_MAP_FIELDS) {
              const val = row[field];
              if (val !== undefined && val !== null && val !== '') {
                isEmptyRow = false;
              }
            }

            if (isEmptyRow) continue;

            for (const field of AC_MAP_FIELDS) {
              let val = row[field];
              if (field === 'size_mm2') {
                acRow[field] = val; 
              } else {
                if (val === undefined || val === null || val === '') {
                  val = 0; 
                }
                const num = Number(val);
                if (isNaN(num)) {
                  errors.push(`Sheet "AC Map", Row ${i + 2}: '${field}' must be a number (got "${val}")`);
                } else {
                  acRow[field] = num;
                }
              }
            }
            newAcMap.push(acRow);
          }
        }

        // 2. Process Specs Sheets
        for (const { cat, table, name } of SPEC_TABLES) {
          const sheetName = name.substring(0, 31);
          if (!wb.SheetNames.includes(sheetName)) continue;

          const ws = wb.Sheets[sheetName];
          const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
          const fields = UI_FIELDS[cat] || [];

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            let itemCode = row['item_code'];
            
            // Check if row is completely empty
            let isEmptyRow = true;
            for (const field of fields) {
              if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
                isEmptyRow = false;
                break;
              }
            }
            if (isEmptyRow) continue;

            if (!itemCode || String(itemCode).trim() === '') {
              // Auto-generate item code instead of throwing error
              itemCode = getNextItemCode(cat);
            }
            
            itemCode = String(itemCode).trim();
            const specData: any = { item_code: itemCode };
            const catalogData: any = { item_code: itemCode };

            for (const field of fields) {
              if (field === 'item_code') continue;

              let val = row[field];
              const expectedType = FIELD_TYPES[field] || 'string';

              if (expectedType === 'number') {
                if (val === undefined || val === null || val === '') {
                  val = 0;
                }
                const num = Number(val);
                if (isNaN(num)) {
                  errors.push(`Sheet "${sheetName}", Row ${i + 2}: '${field}' must be a number (got "${val}")`);
                } else {
                  specData[field] = num;
                }
              } else if (expectedType === 'boolean') {
                if (val === undefined || val === null || val === '') {
                  specData[field] = false;
                } else {
                  const strVal = String(val).toLowerCase().trim();
                  if (['true', 'yes', '1', 'y'].includes(strVal)) specData[field] = true;
                  else if (['false', 'no', '0', 'n'].includes(strVal)) specData[field] = false;
                  else errors.push(`Sheet "${sheetName}", Row ${i + 2}: '${field}' must be boolean (got "${val}")`);
                }
              } else {
                // String type
                specData[field] = val === undefined || val === null ? '' : String(val);
                if (field === 'item_name') catalogData.item_name = specData[field];
              }
            }

            // DB Schema Mappings to fix column mismatch errors
            if (table === 'inverter_specs' && 'cost_per_watt' in specData) {
              specData.cost_per_unit = specData.cost_per_watt;
              delete specData.cost_per_watt;
            }
            if (table === 'battery_specs' && 'battery_price_fwb' in specData) {
              specData.battery_price_fob = specData.battery_price_fwb;
              delete specData.battery_price_fwb;
            }
            if (table === 'harm_filtering_specs' && 'item_name' in specData) {
              delete specData.item_name; // Belongs to catalog_items only
            }
            if (table === 'ac_cabling_specs' && 'cable_type' in specData) {
              delete specData.cable_type; // Not in ac_cabling_specs DB table
            }


            // Find existing item in draft to reuse item_id if possible
            const existingItem = existingItems.find(
              (ei: any) => ei.table_name === table && String(ei.catalog_data?.item_code).trim() === itemCode
            );

            let itemId = crypto.randomUUID();
            let action = 'ADD';
            let oldCatalogData = null;
            let oldSpecData = null;
            let changeId = crypto.randomUUID();

            if (existingItem) {
              itemId = existingItem.catalog_data?.item_id || itemId;
              action = 'UPDATE';
              oldCatalogData = existingItem.old_catalog_data;
              oldSpecData = existingItem.old_spec_data;
              changeId = existingItem.change_id || changeId;
            }

            catalogData.item_id = itemId;
            specData.item_id = itemId; // Ensure the specs table also gets the item_id

            newItems.push({
              change_id: changeId,
              action,
              table_name: table,
              catalog_data: catalogData,
              spec_data: specData,
              old_catalog_data: oldCatalogData,
              old_spec_data: oldSpecData
            });
          }
        }

        if (errors.length > 0) {
          reject(errors.join('\n'));
          return;
        }

        // 3. Add DELETE for items that were in draft but not in Excel
        for (const ei of existingItems) {
          if (ei.action === 'DELETE') {
            newItems.push(ei);
            continue;
          }

          const foundInExcel = newItems.find(
            ni => ni.table_name === ei.table_name && String(ni.catalog_data?.item_code).trim() === String(ei.catalog_data?.item_code).trim()
          );

          if (!foundInExcel) {
            if (ei.action === 'ADD') {
              // Ignore entirely
            } else {
              // Mark as DELETE
              newItems.push({
                ...ei,
                action: 'DELETE',
                change_id: crypto.randomUUID()
              });
            }
          }
        }

        resolve({ items: newItems, acMap: newAcMap });
      } catch (err) {
        reject(`Failed to parse Excel file: ${(err as Error).message}`);
      }
    };
    reader.onerror = () => reject("Failed to read file.");
    reader.readAsArrayBuffer(file);
  });
}
