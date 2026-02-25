import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const { data, error } = await supabase.from('shops').select('count');

if (error) {
  console.error('❌ Connection failed:', error.message);
} else {
  console.log('✅ Connected to Supabase. Shops table ready.');
}