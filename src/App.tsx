import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { supabase } from './supabase'

const ACCENT = '#E8510A'
const CARD_BG = '#161b22'
const BORDER = '#21262d'
const CHART_COLORS = ['#E8510A', '#c44008', '#8b2d06', '#6b2205', '#ff7033', '#ff9260', '#4d1804', '#ff5500']

interface Answer {
  session_id: string
  question_key: string
  question_label: string
  answer: string
}

interface Session {
  id: string
  nome: string
  fone: string
  created_at: string
}

interface QuestionStat {
  label: string
  key: string
  options: { name: string; count: number }[]
  total: number
}

function buildStats(answers: Answer[]): QuestionStat[] {
  const map = new Map<string, QuestionStat>()
  for (const a of answers) {
    if (!map.has(a.question_key)) {
      map.set(a.question_key, { label: a.question_label, key: a.question_key, options: [], total: 0 })
    }
    const stat = map.get(a.question_key)!
    const opt = stat.options.find(o => o.name === a.answer)
    if (opt) opt.count++
    else stat.options.push({ name: a.answer, count: 1 })
    stat.total++
  }
  return Array.from(map.values())
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}min atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0D1117', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 12px' }}>
      <p style={{ color: '#fff', fontWeight: 700 }}>{payload[0].payload.name}</p>
      <p style={{ color: ACCENT, fontWeight: 700 }}>{payload[0].value} respostas</p>
    </div>
  )
}

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [live, setLive] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(new Date())

  async function load() {
    const [{ data: s }, { data: a }] = await Promise.all([
      supabase.from('survey_sessions').select('*').order('created_at', { ascending: false }),
      supabase.from('survey_answers').select('*'),
    ])
    if (s) setSessions(s)
    if (a) setAnswers(a)
    setLastUpdate(new Date())
  }

  useEffect(() => {
    load()

    const channel = supabase
      .channel('realtime-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'survey_sessions' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'survey_answers' }, load)
      .subscribe(status => setLive(status === 'SUBSCRIBED'))

    return () => { supabase.removeChannel(channel) }
  }, [])

  const stats = buildStats(answers)
  const uniqueUsers = new Set(sessions.map(s => s.id)).size

  return (
    <div style={{ minHeight: '100vh', background: '#0D1117' }}>

      {/* Header */}
      <header style={{
        borderBottom: `1px solid ${BORDER}`,
        padding: '20px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        background: '#0D1117',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: ACCENT, fontSize: 28, fontWeight: 900, letterSpacing: 6 }}>MOVE</span>
          <span style={{ color: '#555', fontSize: 14 }}>|</span>
          <span style={{ color: '#888', fontSize: 14, fontWeight: 600, letterSpacing: 2 }}>DASHBOARD</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <span style={{ color: '#555', fontSize: 12 }}>
            atualizado {lastUpdate.toLocaleTimeString('pt-BR')}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: live ? '#4ade80' : '#f87171',
              boxShadow: live ? '0 0 8px #4ade80' : 'none',
            }} />
            <span style={{ fontSize: 12, color: live ? '#4ade80' : '#f87171', fontWeight: 600 }}>
              {live ? 'AO VIVO' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </header>

      <main style={{ padding: '32px', maxWidth: 1200, margin: '0 auto' }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'PARTICIPANTES', value: uniqueUsers, sub: 'pessoas únicas' },
            { label: 'RESPOSTAS', value: answers.length, sub: 'total de respostas' },
            { label: 'PERGUNTAS', value: stats.length, sub: 'questões ativas' },
          ].map(kpi => (
            <div key={kpi.label} style={{
              background: CARD_BG,
              border: `1px solid ${BORDER}`,
              borderRadius: 12,
              padding: '24px 28px',
            }}>
              <p style={{ color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>
                {kpi.label}
              </p>
              <p style={{ color: ACCENT, fontSize: 48, fontWeight: 900, lineHeight: 1 }}>{kpi.value}</p>
              <p style={{ color: '#555', fontSize: 12, marginTop: 6 }}>{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* Gráficos por pergunta */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
          {stats.map(stat => (
            <div key={stat.key} style={{
              background: CARD_BG,
              border: `1px solid ${BORDER}`,
              borderRadius: 12,
              padding: '24px',
            }}>
              <p style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>
                {stat.total} respostas
              </p>
              <p style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 20, lineHeight: 1.4 }}>
                {stat.label}
              </p>

              <ResponsiveContainer width="100%" height={Math.max(120, stat.options.length * 48)}>
                <BarChart data={stat.options} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={160}
                    tick={{ fill: '#888', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: string) => v.length > 20 ? v.slice(0, 18) + '…' : v}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={32}>
                    {stat.options.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* % breakdown */}
              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                {stat.options.map(opt => (
                  <div key={opt.name} style={{
                    background: '#0D1117',
                    borderRadius: 6,
                    padding: '4px 10px',
                    fontSize: 11,
                    color: '#888',
                  }}>
                    <span style={{ color: ACCENT, fontWeight: 700 }}>
                      {stat.total > 0 ? Math.round((opt.count / stat.total) * 100) : 0}%
                    </span>
                    {' '}{opt.name}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Últimos participantes */}
        <div style={{
          background: CARD_BG,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: '24px',
        }}>
          <p style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 2, marginBottom: 20 }}>
            ÚLTIMOS PARTICIPANTES
          </p>
          {sessions.length === 0 && (
            <p style={{ color: '#555', textAlign: 'center', padding: '32px 0' }}>
              Nenhum participante ainda
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {sessions.slice(0, 20).map((s, i) => (
              <div key={s.id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: 8,
                background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: ACCENT + '22',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: ACCENT, fontWeight: 700, fontSize: 13,
                  }}>
                    {s.nome?.[0] ?? '?'}
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 14 }}>{s.nome}</p>
                    <p style={{ color: '#555', fontSize: 12 }}>{s.fone || '—'}</p>
                  </div>
                </div>
                <span style={{ color: '#555', fontSize: 12 }}>{timeAgo(s.created_at)}</span>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  )
}
