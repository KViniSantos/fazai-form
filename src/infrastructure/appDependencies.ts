import { loadCategories, loadFortaleza, type CatalogClient, type FortalezaCity, type ServiceCategory } from '@/infrastructure/supabase/catalogRepository';
import { createSupabaseBrowserClient } from '@/infrastructure/supabase/client';
import { createPreRegistrationRepository, type PreRegistrationClient, type PreRegistrationRepository } from '@/infrastructure/supabase/preRegistrationRepository';

export interface CatalogRepository {
  loadCategories: () => Promise<ServiceCategory[]>;
  loadFortaleza: () => Promise<FortalezaCity>;
}

export interface PreRegistrationAppDependencies {
  catalog: CatalogRepository;
  repository: PreRegistrationRepository;
  siteUrl?: string;
}

export function createDefaultAppDependencies(): PreRegistrationAppDependencies {
  const client = createSupabaseBrowserClient();
  return {
    catalog: {
      loadCategories: () => loadCategories(client as unknown as CatalogClient),
      loadFortaleza: () => loadFortaleza(client as unknown as CatalogClient),
    },
    repository: createPreRegistrationRepository(client as unknown as PreRegistrationClient),
    siteUrl: import.meta.env.VITE_SITE_URL?.trim() || undefined,
  };
}
