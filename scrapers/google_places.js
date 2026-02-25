import { supabase } from '../utils/supabase.js';
import { canScrape, logScrape } from '../utils/scrape_guard.js';
import fs from 'fs';

const API_KEY = process.env.GOOGLE_PLACES_KEY;
const RADIUS = 40000;

async function searchPlaces(lat, lng) {
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${RADIUS}&keyword=auto+body+shop&key=${API_KEY}`;
  const res = await fetch(url);
  return res.json();
}

async function getPlaceDetails(placeId) {
  const fields = 'name,formatted_address,formatted_phone_number,website,geometry';
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${API_KEY}`;
  const res = await fetch(url);
  return res.json();
}

async function upsertShop(shop) {
  const { error } = await supabase
    .from('shops')
    .upsert(shop, { onConflict: 'google_place_id', ignoreDuplicates: false });
  if (error) console.error('Upsert error:', error.message);
}

async function scrapeZip(zip, lat, lng) {
  const jobKey = `zip_${zip}`;

  if (!(await canScrape('google_places', jobKey))) {
    console.log(`⏭ Skipping ${zip} — already scraped`);
    return;
  }

  console.log(`🔍 Scraping ${zip}...`);
  let count = 0;

  try {
    const result = await searchPlaces(lat, lng);

    for (const place of result.results || []) {
      const details = await getPlaceDetails(place.place_id);
      const d = details.result;
      const addressParts = (d.formatted_address || '').split(',');

      await upsertShop({
        name: d.name,
        phone: d.formatted_phone_number,
        website: d.website,
        address: addressParts[0]?.trim(),
        city: addressParts[1]?.trim(),
        state: addressParts[2]?.trim().split(' ')[0],
        zip: addressParts[2]?.trim().split(' ')[1],
        lat: d.geometry?.location?.lat,
        lng: d.geometry?.location?.lng,
        google_place_id: place.place_id,
        source: ['google'],
        enrichment_needed: true
      });
      count++;
      await new Promise(r => setTimeout(r, 200));
    }

    await logScrape('google_places', jobKey, 'complete', count);
    console.log(`✅ ${zip}: ${count} shops found`);

  } catch (err) {
    await logScrape('google_places', jobKey, 'failed', 0, err.message);
    console.error(`❌ ${zip} failed:`, err.message);
  }
}

const zips = fs.readFileSync('./data/zip_codes_tx.csv', 'utf8')
  .split('\n')
  .map(l => l.trim())
  .filter(l => l.length > 0)
  .map(l => l.split(','));

for (const [zip, lat, lng] of zips) {
  await scrapeZip(zip.trim(), lat.trim(), lng.trim());
  await new Promise(r => setTimeout(r, 500));
}