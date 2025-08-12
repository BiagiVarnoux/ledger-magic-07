// src/integrations/supabase/client.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url =
  (typeof window !== "undefined" && (window as any).env?.NEXT_PUBLIC_SUPABASE_URL) ||
  (typeof process !== "undefined" && (process as any).env?.NEXT_PUBLIC_SUPABASE_URL) ||
  "";

const key =
  (typeof window !== "undefined" && (window as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  (typeof process !== "undefined" && (process as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  "";

// Exporta null si faltan envs; Index.tsx ya hace fallback a LocalStorage
export const supabase: SupabaseClient | null = (url && key)
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;
