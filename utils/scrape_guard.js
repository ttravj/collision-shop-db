import { supabase } from './supabase.js';

export async function canScrape(jobType, identifier) {
  const { data } = await supabase
    .from('scrape_log')
    .select('status')
    .eq('job_type', jobType)
    .eq('identifier', identifier)
    .in('status', ['complete', 'pending'])
    .maybeSingle();

  return !data;
}

export async function logScrape(jobType, identifier, status, recordsFound = 0, errorText = null) {
  await supabase.from('scrape_log').upsert({
    job_type: jobType,
    identifier: identifier,
    status,
    records_found: recordsFound,
    error_text: errorText,
    ran_at: new Date().toISOString()
  }, { onConflict: 'job_type,identifier' });
}
