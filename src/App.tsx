import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import type { Answer, Session } from './types'
import { fetchAll } from './lib/data'
import { isAuthed, signOut } from './lib/auth'
import { brl, digits, pct } from './lib/format'
import {
  buildInsights, buildQuestions, byHour, dedupeAnswers, dedupeSessions,
  indexBySession, isValidPhone,
} from './lib/stats'
import { exportCsv, exportXlsx } from './lib/export'
import Login from './components/Login'
import { HourChart, QuestionCard } from './components/Charts'
import { InsightCard } from './components/Insights'
import LeadsTable from './components/LeadsTable'
import { Empty, Kpi, Section } from './components/Ui'

export default function App() {
  const [authed, setAuthed] = useState(isAuthed)
  if (!authed) return <Login onSuccess={() => setAuthed(true)} />
  return <Dashboard onSignOut={() => { signOut(); setAuthed(false) }} />
}

function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const [rawSessions, setSessions] = useState<Session[]>([])
  const [rawAnswers, setAnswers] = useState<Answer[]>([])
  const [dedupe, setDedupe] = useState(true)
  const [live, setLive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [now, setNow] = useState(new Date())

  /** questionKey -> resposta selecionada. Segmenta todo o painel. */
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<'xlsx' | 'csv' | null>(null)

  useEffect(() => {
    let alive = true

    async function load() {
      try {
        const [s, a] = await Promise.all([
          fetchAll<Session>('survey_sessions', { column: 'created_at', ascending: false }),
          fetchAll<Answer>('survey_answers'),
        ])
        if (!alive) return
        setSessions(s)
        setAnswers(a)
        setLoadError(null)
      } catch (err) {
        // Sem isto o painel seguiria mostrando números velhos como se fossem atuais.
        if (!alive) return
        console.error(err)
        setLoadError(err instanceof Error ? err.message : 'Falha ao carregar os dados.')
      } finally {
        if (alive) setLoading(false)
      }
    }

    load()

    const channel = supabase
      .channel('realtime-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'survey_sessions' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'survey_answers' }, load)
      .subscribe(status => alive && setLive(status === 'SUBSCRIBED'))

    // Rede de segurança caso o websocket caia sem avisar.
    const poll = setInterval(load, 15000)
    const clock = setInterval(() => setNow(new Date()), 1000)

    return () => {
      alive = false
      supabase.removeChannel(channel)
      clearInterval(poll)
      clearInterval(clock)
    }
  }, [])

  // ---- Limpeza da base, antes de qualquer estatística.
  // Resposta repetida da mesma pessoa é sempre erro de captura: colapsa sempre.
  const cleanAnswers = useMemo(() => dedupeAnswers(rawAnswers), [rawAnswers])

  const answerCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of cleanAnswers) m.set(a.session_id, (m.get(a.session_id) ?? 0) + 1)
    return m
  }, [cleanAnswers])

  // Cadastro repetido do mesmo telefone é opcional: o operador decide se quer
  // ver pessoas únicas ou todos os preenchimentos.
  const { kept, duplicates } = useMemo(
    () => dedupeSessions(rawSessions, answerCount),
    [rawSessions, answerCount],
  )

  const sessions = dedupe ? kept : rawSessions
  const answers = useMemo(() => {
    if (!dedupe) return cleanAnswers
    const ids = new Set(sessions.map(s => s.id))
    return cleanAnswers.filter(a => ids.has(a.session_id))
  }, [cleanAnswers, sessions, dedupe])

  // Estrutura das perguntas vem sempre da base completa, para que as colunas
  // do export e o layout dos cartões não mudem quando um filtro é aplicado.
  const baseQuestions = useMemo(() => buildQuestions(answers), [answers])
  const bySession = useMemo(() => indexBySession(answers), [answers])

  const activeFilters = Object.entries(filters)

  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase()
    const qDigits = digits(search)

    return sessions.filter(s => {
      const row = bySession.get(s.id)
      for (const [key, value] of activeFilters) {
        if (row?.get(key) !== value) return false
      }
      if (!q) return true
      const nameHit = (s.nome ?? '').toLowerCase().includes(q)
      const phoneHit = qDigits.length > 0 && digits(s.fone).includes(qDigits)
      return nameHit || phoneHit
    })
  }, [sessions, bySession, filters, search])

  const filteredAnswers = useMemo(() => {
    if (activeFilters.length === 0 && !search.trim()) return answers
    const ids = new Set(filteredSessions.map(s => s.id))
    return answers.filter(a => ids.has(a.session_id))
  }, [answers, filteredSessions, filters, search])

  const viewQuestions = useMemo(() => buildQuestions(filteredAnswers), [filteredAnswers])
  const viewByKey = useMemo(
    () => new Map(viewQuestions.map(q => [q.key, q])),
    [viewQuestions],
  )

  const hours = useMemo(() => byHour(filteredSessions), [filteredSessions])
  const insights = useMemo(
    () => buildInsights(viewQuestions, filteredSessions, hours),
    [viewQuestions, filteredSessions, hours],
  )

  const leads = filteredSessions.filter(s => isValidPhone(s.fone)).length
  const segmented = activeFilters.length > 0 || search.trim().length > 0

  // Preço de referência para o KPI: o valor que o público atribui ao produto.
  const headline =
    viewQuestions.find(q => q.numeric && q.label.toLowerCase().includes('custa')) ??
    viewQuestions.find(q => q.numeric)

  async function doExport(kind: 'xlsx' | 'csv') {
    setBusy(kind)
    try {
      const suffix = segmented ? '_segmento' : ''
      if (kind === 'xlsx') {
        await exportXlsx(filteredSessions, filteredAnswers, baseQuestions, suffix)
      } else {
        exportCsv(filteredSessions, filteredAnswers, baseQuestions, suffix)
      }
    } catch (err) {
      console.error(err)
      alert('Não foi possível gerar o arquivo. Tente novamente.')
    } finally {
      setBusy(null)
    }
  }

  function toggleFilter(key: string, answer: string) {
    setFilters(f => (f[key] === answer ? omit(f, key) : { ...f, [key]: answer }))
  }

  return (
    <div style={{ minHeight: '100vh' }}>

      {/* ---------- Cabeçalho ---------- */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        borderBottom: '1px solid var(--border)',
        background: 'rgba(7,8,12,.82)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}>
        <div style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '14px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className="grad-text num" style={{ fontSize: 24, letterSpacing: '0.2em' }}>
              MOVE
            </span>
            <span style={{ width: 1, height: 20, background: 'var(--border-str)' }} />
            <span className="eyebrow" style={{ letterSpacing: '0.18em' }}>
              Inteligência de marca
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="chip" style={{ gap: 7 }}>
              <span className={`dot ${live ? 'dot-live' : 'dot-off'}`} />
              <span style={{ color: live ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                {live ? 'AO VIVO' : 'RECONECTANDO'}
              </span>
              <span style={{ color: 'var(--faint)' }}>·</span>
              <span className="num" style={{ fontWeight: 600, color: 'var(--muted)' }}>
                {now.toLocaleTimeString('pt-BR')}
              </span>
            </div>

            <button className="btn" onClick={() => doExport('csv')} disabled={busy !== null}>
              CSV
            </button>

            <button
              className="btn btn-accent"
              onClick={() => doExport('xlsx')}
              disabled={busy !== null || filteredSessions.length === 0}
            >
              {busy === 'xlsx' ? 'Gerando…' : `Exportar Excel (${filteredSessions.length})`}
            </button>

            <button className="btn" onClick={onSignOut} title="Sair do painel">Sair</button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '30px 28px 72px' }}>

        {/* ---------- Segmento ativo ---------- */}
        {segmented && (
          <div className="card anim" style={{
            padding: '12px 16px',
            marginBottom: 22,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            borderColor: 'rgba(255,90,31,.3)',
          }}>
            <span className="eyebrow" style={{ color: 'var(--accent-2)' }}>Segmento ativo</span>
            {activeFilters.map(([key, value]) => (
              <button
                key={key}
                className="chip chip-on"
                onClick={() => setFilters(f => omit(f, key))}
                title="Remover filtro"
              >
                {value} <span style={{ opacity: .6 }}>✕</span>
              </button>
            ))}
            {search.trim() && (
              <button className="chip chip-on" onClick={() => setSearch('')}>
                busca: {search} <span style={{ opacity: .6 }}>✕</span>
              </button>
            )}
            <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>
              {filteredSessions.length} de {sessions.length} participantes
              {sessions.length > 0 && ` (${pct(filteredSessions.length, sessions.length)}%)`}
            </span>
            <button
              className="btn"
              style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: 12 }}
              onClick={() => { setFilters({}); setSearch('') }}
            >
              Limpar tudo
            </button>
          </div>
        )}

        {/* ---------- Qualidade da base ---------- */}
        {duplicates > 0 && (
          <div className="card anim" style={{
            padding: '11px 16px',
            marginBottom: 22,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}>
            <span className="eyebrow">Qualidade da base</span>
            <span style={{ color: 'var(--text-2)', fontSize: 12.5 }}>
              {duplicates} {duplicates === 1 ? 'cadastro repetido' : 'cadastros repetidos'} do
              mesmo telefone {dedupe ? 'fora da contagem' : 'incluídos na contagem'}.
            </span>
            <button
              className={`chip chip-btn${dedupe ? ' chip-on' : ''}`}
              style={{ marginLeft: 'auto' }}
              onClick={() => setDedupe(d => !d)}
              title="Vale para os números, os gráficos e o export"
            >
              {dedupe ? '✓ ' : ''}Contar só pessoas únicas
            </button>
          </div>
        )}

        {/* ---------- Falha de leitura ---------- */}
        {loadError && (
          <div className="card anim" style={{
            padding: '13px 16px',
            marginBottom: 22,
            borderColor: 'rgba(255,95,86,.4)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}>
            <span className="eyebrow" style={{ color: 'var(--red)' }}>Falha na atualização</span>
            <span style={{ color: 'var(--text-2)', fontSize: 12.5 }}>
              Os números abaixo podem estar desatualizados — {loadError}
            </span>
          </div>
        )}

        {/* ---------- KPIs ---------- */}
        <div className="grid-kpi" style={{ marginBottom: 30 }}>
          <Kpi
            label="Participantes"
            value={filteredSessions.length}
            sub={
              segmented
                ? `de ${sessions.length} no total`
                : dedupe ? 'pessoas únicas' : 'cadastros (com repetidos)'
            }
            accent
            delay={0}
          />
          <Kpi
            label="Leads com telefone"
            value={leads}
            sub={`${pct(leads, filteredSessions.length)}% prontos para campanha`}
            delay={60}
          />
          <Kpi
            label="Respostas"
            value={filteredAnswers.length}
            sub={`${baseQuestions.length} perguntas ativas`}
            delay={120}
          />
          <Kpi
            label="Valor percebido"
            value={headline?.stats ? brl(headline.stats.median) : '—'}
            sub={headline?.stats ? `mediana · média ${brl(headline.stats.avg)}` : 'sem dado de preço'}
            accent
            delay={180}
          />
        </div>

        {loading ? (
          <div className="card card-pad">
            <Empty>Carregando dados da pesquisa…</Empty>
          </div>
        ) : sessions.length === 0 ? (
          <div className="card card-pad">
            <Empty>Nenhuma resposta registrada ainda. O painel atualiza sozinho.</Empty>
          </div>
        ) : (
          <>
            {/* ---------- Insights ---------- */}
            {insights.length > 0 && (
              <Section
                title="Leitura para campanha"
                hint="Recomendações geradas a partir das respostas do segmento atual."
              >
                <div className="grid-3">
                  {insights.map((ins, i) => (
                    <InsightCard key={ins.tag + i} insight={ins} delay={i * 60} />
                  ))}
                </div>
              </Section>
            )}

            {/* ---------- Perguntas ---------- */}
            <Section
              title="Respostas por pergunta"
              hint="Clique em qualquer barra para segmentar todo o painel por aquela resposta."
            >
              <div className="grid-2">
                {baseQuestions.map((q, i) => {
                  const view = viewByKey.get(q.key) ?? { ...q, options: [], total: 0, stats: null }
                  return (
                    <QuestionCard
                      key={q.key}
                      question={view}
                      active={filters[q.key] ?? null}
                      onPick={answer => toggleFilter(q.key, answer)}
                      delay={i * 60}
                    />
                  )
                })}
              </div>
            </Section>

            {/* ---------- Operação + base ---------- */}
            <Section
              title="Base e operação"
              hint="Quem respondeu, quando, e o que cada pessoa marcou."
            >
              <div style={{ display: 'grid', gap: 16 }}>
                <HourChart data={hours} />
                <LeadsTable
                  sessions={filteredSessions}
                  answersBySession={bySession}
                  questions={baseQuestions}
                  search={search}
                  onSearch={setSearch}
                />
              </div>
            </Section>
          </>
        )}

        <footer style={{
          marginTop: 40,
          paddingTop: 22,
          borderTop: '1px solid var(--border)',
          color: 'var(--faint)',
          fontSize: 11.5,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <span>MOVE · painel de pesquisa em tempo real</span>
          <span>Atualizado às {now.toLocaleTimeString('pt-BR')}</span>
        </footer>
      </main>
    </div>
  )
}

function omit(obj: Record<string, string>, key: string): Record<string, string> {
  const { [key]: _, ...rest } = obj
  return rest
}
