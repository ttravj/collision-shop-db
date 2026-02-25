import { supabase } from '../utils/supabase.js';
import fs from 'fs';

const raw = fs.readFileSync('./data/shops_mt.csv', 'utf8');
const lines = raw.split('\n');
const headers = lines[0].split(',');

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

const shops = lines.slice(1)
  .filter(l => l.trim().length > 0)
  .map(line => {
    const values = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => {
      const key = h.replace(/"/g, '').trim();
      let val = values[i]?.replace(/"/g, '').trim();
      if (val === 'NULL' || val === '' || val === undefined) val = null;
      if (key === 'association_member' || key === 'icar_gold_class' || key === 'email_verified' || key === 'enrichment_needed') {
        val = val === 'true' || val === 't';
      }
      if (key === 'lead_score') val = parseInt(val) || 0;
      if (key === 'lat' || key === 'lng') val = val ? parseFloat(val) : null;
      if (key === 'source' || key === 'associations') {
        try { val = val ? JSON.parse(val) : null; } catch { val = null; }
      }
      obj[key] = val;
    });
    return obj;
  });

console.log(`📦 Importing ${shops.length} shops...`);
let imported = 0;
let skipped = 0;

for (const shop of shops) {
  const { error } = await supabase
    .from('shops')
    .upsert(shop, { onConflict: 'google_place_id', ignoreDuplicates: true });
  
  if (error) {
    console.error(`❌ ${shop.name}: ${error.message}`);
    skipped++;
  } else {
    imported++;
  }
}

console.log(`✅ Done. Imported: ${imported} | Skipped: ${skipped}`);