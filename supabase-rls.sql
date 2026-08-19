-- =============================================================================
-- MOVE — Row Level Security
--
-- NÃO EXECUTE ENQUANTO A ATIVAÇÃO ESTIVER RODANDO SEM ALGUÉM NO LOCAL.
-- Rode só quando houver quem confirme, na academia, que o app voltou a sincronizar.
--
-- Contexto apurado no código em 19/08/2026:
--
--  * O app mobile (move-app-mobile) grava com a CHAVE ANÔNIMA. Não há signIn
--    em lugar nenhum — ele atua como role `anon`, igual ao dashboard.
--
--  * Ele usa .upsert() (src/sync/sync.ts), que é INSERT ... ON CONFLICT DO
--    UPDATE. Por isso precisa de INSERT **e** UPDATE. Política que libere só
--    INSERT quebra a sincronização.
--
--  * O dashboard lê as duas tabelas com a mesma chave anônima.
--
-- ATENÇÃO — não rode `move-app/supabase-migration.sql`. As políticas dele são
-- todas TO authenticated: aplicá-lo hoje derruba a gravação do app e a leitura
-- do dashboard de uma vez só. O arquivo também está desatualizado (não tem as
-- colunas user_id e synced que existem em produção).
--
-- Rede de segurança: o app é offline-first (SQLite) e só marca `synced = 1`
-- depois do upsert dar certo. Se algo aqui bloquear a escrita, os dados ficam
-- na fila do aparelho e sobem quando corrigir. Pausa a coleta, não perde.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- PASSO 1 — DIAGNÓSTICO (somente leitura, seguro a qualquer momento)
-- Rode isto primeiro e guarde o resultado. É o seu ponto de retorno.
-- -----------------------------------------------------------------------------

-- RLS está ligado hoje?
select tablename, rowsecurity as rls_ligado
from pg_tables
where schemaname = 'public'
  and tablename in ('survey_sessions', 'survey_answers', 'survey_flow');

-- Que políticas já existem?
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('survey_sessions', 'survey_answers', 'survey_flow')
order by tablename, policyname;

-- Se o PASSO 1 mostrar políticas com nomes iguais aos do PASSO 2,
-- apague-as antes ou renomeie as novas — senão o CREATE POLICY falha.


-- -----------------------------------------------------------------------------
-- PASSO 2 — APLICAR
--
-- O que muda: SELECT, INSERT e UPDATE continuam liberados para anon, ou seja,
-- app e dashboard seguem funcionando exatamente como hoje. O ganho é que
-- **DELETE deixa de existir** para anon — ninguém apaga a base coletada.
--
-- Ganho honesto: é proteção contra apagamento, não contra inserção falsa.
-- Como o app usa a mesma chave anônima de qualquer visitante, não há como o
-- banco distinguir os dois. Bloquear INSERT protegeria contra respostas
-- forjadas, mas mataria o app junto.
--
-- Tudo numa transação: ou aplica inteiro, ou não aplica nada.
-- -----------------------------------------------------------------------------

begin;

alter table public.survey_sessions enable row level security;
alter table public.survey_answers  enable row level security;

-- survey_sessions
create policy "anon_select_sessions" on public.survey_sessions
  for select to anon, authenticated using (true);

create policy "anon_insert_sessions" on public.survey_sessions
  for insert to anon, authenticated with check (true);

-- necessário para o .upsert() do app
create policy "anon_update_sessions" on public.survey_sessions
  for update to anon, authenticated using (true) with check (true);

-- survey_answers
create policy "anon_select_answers" on public.survey_answers
  for select to anon, authenticated using (true);

create policy "anon_insert_answers" on public.survey_answers
  for insert to anon, authenticated with check (true);

create policy "anon_update_answers" on public.survey_answers
  for update to anon, authenticated using (true) with check (true);

-- Nenhuma política FOR DELETE, de propósito: sem política, RLS nega.
-- O app nunca deleta (não há .delete() em src/sync/sync.ts).

commit;


-- -----------------------------------------------------------------------------
-- PASSO 3 — CONFERIR NA HORA, nesta ordem
--
--  1. Abra o dashboard e confirme que os números aparecem (SELECT anon ok).
--     Se vier zerado, o RLS está barrando a leitura — vá para o PASSO 4.
--
--  2. Peça para alguém responder uma pesquisa no totem e confirme que o
--     participante aparece no dashboard em segundos (INSERT + UPDATE anon ok).
--
--  3. Só considere concluído depois do item 2. O item 1 sozinho não prova que
--     a gravação continua funcionando.
-- -----------------------------------------------------------------------------


-- -----------------------------------------------------------------------------
-- PASSO 4 — REVERTER (se algo parar de funcionar)
-- Volta ao estado de hoje na hora. Rode sem hesitar: coleta vale mais que
-- hardening, e o que ficou na fila do aparelho sobe depois.
-- -----------------------------------------------------------------------------

-- alter table public.survey_sessions disable row level security;
-- alter table public.survey_answers  disable row level security;


-- -----------------------------------------------------------------------------
-- NOTA sobre survey_flow
-- Não encontrei referência a essa tabela nem no app mobile nem no dashboard —
-- o fluxo de telas parece estar embutido no app. Por isso ela ficou de fora.
-- Confirme antes de mexer nela.
-- -----------------------------------------------------------------------------
