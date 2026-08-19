import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(process.cwd(), 'supabase/migrations/20260819120000_provider_preregistration.sql');

describe('provider preregistration shared Supabase migration', () => {
  it('contains the guarded pending submission function and existing Fortaleza/storage contracts', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('submit_pre_registration');
    expect(sql).toContain("status = 'pendente'");
    expect(sql).toContain("nome = 'Fortaleza'");
    expect(sql).toContain("estado = 'CE'");
    expect(sql).toContain('servicos-imagens');
    expect(sql).toContain('v_max_services integer := 2');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.submit_pre_registration');
  });

  it('does not create a parallel review or ratings system', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).not.toContain('CREATE TABLE public.avaliacoes');
    expect(sql).not.toContain('CREATE TABLE public.provider_preregistrations');
  });
});
