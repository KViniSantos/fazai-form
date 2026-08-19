import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface PublicSupabaseEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  siteUrl?: string;
}

type EnvSource = Record<string, string | undefined>;

function getImportMetaEnv(): EnvSource {
  return import.meta.env as unknown as EnvSource;
}

export function readPublicSupabaseEnv(source: EnvSource = getImportMetaEnv()): PublicSupabaseEnv {
  const supabaseUrl = source.VITE_SUPABASE_URL?.trim();
  const supabaseAnonKey = source.VITE_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para iniciar o pré-cadastro.');
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    siteUrl: source.VITE_SITE_URL?.trim() || undefined,
  };
}

export function createSupabaseBrowserClient(source?: EnvSource): SupabaseClient {
  const { supabaseUrl, supabaseAnonKey } = readPublicSupabaseEnv(source);
  return createClient(supabaseUrl, supabaseAnonKey);
}
