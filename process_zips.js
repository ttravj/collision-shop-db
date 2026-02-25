import fs from 'fs';

const raw = fs.readFileSync('./data/uszips_raw.csv', 'utf8');
const lines = raw.split('\n').slice(1);

const output = lines
  .map(line => {
    const cols = line.split(',');
    const zip = cols[0]?.replace(/"/g, '').trim();
    const lat = cols[1]?.replace(/"/g, '').trim();
    const lng = cols[2]?.replace(/"/g, '').trim();
    if (!zip || !lat || !lng) return null;
    return `${zip},${lat},${lng}`;
  })
  .filter(Boolean)
  .join('\n');

fs.writeFileSync('./data/zip_codes.csv', output);
console.log(`✅ Done. ${output.split('\n').length} zip codes written.`);