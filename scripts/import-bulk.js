import { supabase } from '../utils/supabase.js';
import fs from 'fs';

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
    else { current += char; }
  }
  values.push(current.trim());
  return values;
}

function parseFile(filepath) {
  const raw = fs.readFileSync(filepath, 'utf8');
  const lines = raw.split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).filter(l => l.trim().length > 0).map(line => {
    const values = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => {
      const key = h.replace(/"/g, '').trim();
      let val = values[i]?.replace(/"/g, '').trim();
      if (val === 'NULL' || val === '' || val === undefined) val = null;
      if (['association_member','icar_gold_class','email_verified','enrichment_needed'].includes(key)) val = val === 'true' || val === 't';
      if (key === 'lead_score') val = parseInt(val) || 0;
      if (key === 'lat' || key === 'lng') val = val ? parseFloat(val) : null;
      if (key === 'source' || key === 'associations') { try { val = val ? JSON.parse(val) : null; } catch { val = null; } }
      obj[key] = val;
    });
    return obj;
  });
}

const files = [
  'C:/Users/ttrav/Downloads/shops2.csv',
  'C:/Users/ttrav/Downloads/shops3.csv',
  'C:/Users/ttrav/Downloads/shops4.csv',
  'C:/Users/ttrav/Downloads/shops5.csv',
  'C:/Users/ttrav/Downloads/shops6.csv',
  'C:/Users/ttrav/Downloads/shops7.csv',
  'C:/Users/ttrav/Downloads/shops8.csv',
  'C:/Users/ttrav/Downloads/shops9.csv',
  'C:/Users/ttrav/Downloads/shops10.csv',
];

let totalImported = 0;
let totalSkipped = 0;

for (const file of files) {
  if (!fs.existsSync(file)) { console.log(`⏭ Skipping missing file: ${file}`); continue; }
  const shops = parseFile(file);
  console.log(`📦 ${file}: ${shops.length} shops`);
  for (const shop of shops) {
    const { error } = await supabase.from('shops').upsert(shop, { onConflict: 'google_place_id', ignoreDuplicates: true });
    if (error) { console.error(`❌ ${shop.name}: ${error.message}`); totalSkipped++; }
    else totalImported++;
  }
}

console.log(`\n✅ Done. Imported: ${totalImported} | Skipped: ${totalSkipped}`);