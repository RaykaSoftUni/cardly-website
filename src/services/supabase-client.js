import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const missing = [
  !url && 'VITE_SUPABASE_URL',
  !publishableKey && 'VITE_SUPABASE_PUBLISHABLE_KEY',
].filter(Boolean);

if (missing.length) {
  throw new Error(`Missing Supabase configuration: ${missing.join(', ')}. Set these in .env.local and restart Vite.`);
}

// Accept only modern public keys, preventing accidental use of privileged keys.
if (!publishableKey.startsWith('sb_publishable_')) {
  throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY must be a public sb_publishable_ key. Never use secret or service_role keys in frontend configuration.');
}

// ES modules share this instance across all importers within a page.
export const supabaseClient = createClient(url, publishableKey);
