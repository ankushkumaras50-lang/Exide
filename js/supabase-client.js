// js/supabase-client.js
// Exide Battery Wholesale & AET Official Partner - Supabase Client Integration

const SUPABASE_URL = "https://upplcvxeaazdujlnwejz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwcGxjdnhlYWF6ZHVqbG53ZWp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxNzEwMTcsImV4cCI6MjEwODc0NzAxN30.4bxhbuwBLDMTXRvlkCYWUEALIAKWznobH8K20Qf4i7Y";

let supabaseClient = null;

if (typeof window !== 'undefined') {
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage
      }
    });
    window.supabaseClient = supabaseClient;
    console.log("✅ Supabase client initialized with auth session detection.");
  } else {
    console.warn("⚠️ Supabase SDK library not yet detected. Make sure supabase-js script is included before supabase-client.js.");
  }
} else if (typeof require !== 'undefined') {
  try {
    const { createClient } = require('@supabase/supabase-js');
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (e) {}
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    supabaseClient
  };
}
