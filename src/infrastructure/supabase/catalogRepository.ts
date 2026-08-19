export interface CatalogError {
  message?: string;
}

export interface CatalogQuery<T = unknown> extends PromiseLike<{ data: T | null; error: CatalogError | null }> {
  select(columns: string): CatalogQuery<T>;
  eq(column: string, value: unknown): CatalogQuery<T>;
  order(column: string): PromiseLike<{ data: T | null; error: CatalogError | null }>;
  single(): PromiseLike<{ data: T | null; error: CatalogError | null }>;
}

export interface CatalogClient {
  from(table: string): CatalogQuery;
}

export interface ServiceCategory {
  id: string;
  nome: string;
}

export interface FortalezaCity {
  id: string;
  nome: string;
  estado: string;
}

function throwCatalogError(error: CatalogError | null, fallbackMessage: string): void {
  if (error) throw new Error(error.message || fallbackMessage);
}

export async function loadCategories(client: CatalogClient): Promise<ServiceCategory[]> {
  const { data, error } = await client
    .from('categorias_servico')
    .select('id,nome')
    .eq('ativo', true)
    .order('ordem');

  throwCatalogError(error, 'Não foi possível carregar as categorias de serviço.');
  return (data as ServiceCategory[] | null) ?? [];
}

export async function loadFortaleza(client: CatalogClient): Promise<FortalezaCity> {
  const { data, error } = await client
    .from('cidades')
    .select('id,nome,estado')
    .eq('nome', 'Fortaleza')
    .eq('estado', 'CE')
    .single();

  throwCatalogError(error, 'Não foi possível carregar Fortaleza/CE.');
  if (!data) throw new Error('Fortaleza/CE não está disponível para pré-cadastro.');
  return data as FortalezaCity;
}
