import { supabase } from '../supabase'

const PAGE = 1000
const MAX_PAGES = 200 // trava de segurança: 200k linhas

/**
 * Busca a tabela inteira em páginas.
 *
 * O PostgREST corta qualquer select em `db-max-rows` (1000 por padrão no
 * Supabase) e devolve 200 — sem erro, sem aviso. Com 4 respostas por pessoa,
 * survey_answers passa de 1000 linhas por volta de 250 participantes, e a
 * partir daí médias, medianas e insights sairiam de uma amostra truncada.
 *
 * O avanço é feito pelo tamanho real da página recebida e o laço só encerra
 * numa página vazia, então continua correto mesmo se o limite do servidor for
 * diferente de PAGE.
 */
export async function fetchAll<T>(
  table: string,
  orderBy?: { column: string; ascending: boolean },
): Promise<T[]> {
  const out: T[] = []

  for (let page = 0; page < MAX_PAGES; page++) {
    let query = supabase.from(table).select('*').range(out.length, out.length + PAGE - 1)
    if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending })

    const { data, error } = await query
    if (error) throw error
    if (!data || data.length === 0) return out

    out.push(...(data as T[]))
  }

  console.warn(`[MOVE] ${table}: leitura interrompida em ${MAX_PAGES} páginas.`)
  return out
}
