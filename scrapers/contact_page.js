import { supabase } from '../utils/supabase.js';
import { canScrape, logScrape } from '../utils/scrape_guard.js';

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const SKIP_DOMAINS = ['sentry.io', 'wixpress.com', 'squarespace.com', 'wordpress.com', 'example.com', 'google.com'];

function cleanEmails(emails) {
  return [...new Set(emails)].filter(e =>
    !SKIP_DOMAINS.some(skip => e.includes(skip)) &&
    !e.includes('noreply') &&
    !e.includes('no-reply') &&
    !e.includes('@2x') &&
    e.includes('.')
  );
}

async function fetchPage(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BainbridgeAI/1.0)' }
  });
  return res.text();
}

async function extractEmailsFromSite(website) {
  const base = website.replace(/\/$/, '');
  const attempts = [
    base,
    `${base}/contact`,
    `${base}/contact-us`,
    `${base}/about`,
    `${base}/about-us`
  ];

  let allEmails = [];

  for (const url of attempts) {
    try {
      const html = await fetchPage(url);
      const found = html.match(EMAIL_REGEX) || [];
      allEmails.push(...found);
      if (allEmails.length > 0) break;
    } catch {}
  }

  return cleanEmails(allEmails);
}

async function enrichEmails() {
  const { data: shops, error } = await supabase
    .from('shops')
    .select('id, website')
    .is('email', null)
    .not('website', 'is', null)
    .eq('enrichment_needed', true)
    .limit(200);

  if (error) {
    console.error('Failed to fetch shops:', error.message);
    return;
  }

  console.log(`📧 Enriching ${shops.length} shops...`);
  let found = 0;
  let skipped = 0;

  for (const shop of shops) {
    const domain = shop.website;

    if (!(await canScrape('contact_page', domain))) {
      skipped++;
      continue;
    }

    try {
      const emails = await extractEmailsFromSite(shop.website);

      if (emails.length > 0) {
        await supabase.from('shops').update({
          email: emails[0],
          enrichment_needed: false,
          last_enriched_at: new Date().toISOString()
        }).eq('id', shop.id);

        await logScrape('contact_page', domain, 'complete', emails.length);
        console.log(`✅ ${shop.website} → ${emails[0]}`);
        found++;
      } else {
        await logScrape('contact_page', domain, 'skipped', 0, 'no email found');
        await supabase.from('shops').update({ 
          enrichment_needed: false 
        }).eq('id', shop.id);
        console.log(`⚠️ ${shop.website} — no email found`);
      }
    } catch (err) {
      await logScrape('contact_page', domain, 'failed', 0, err.message);
      console.log(`❌ ${shop.website} — ${err.message}`);
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n🏁 Done. Found: ${found} | Skipped: ${skipped} | Total processed: ${shops.length}`);
}

enrichEmails();
