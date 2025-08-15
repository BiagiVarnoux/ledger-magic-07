// src/integrations/supabase/client.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://glhflhqpsjlyrymquzsn.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsaGZsaHFwc2pseXJ5bXF1enNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMDU2NzIsImV4cCI6MjA3MDU4MTY3Mn0.3SyI1bpqEPIi6IjQtcMNYpbFsdBWZ8ntxQwaj5Soe5Q";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
