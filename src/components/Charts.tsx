import {
  Area, AreaChart, Bar, BarChart, Cell, ReferenceArea,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { Question } from '../types'
import { brl, pct } from '../lib/format'
import { ChartTip, Empty, Stat } from './Ui'

const AXIS = { fill: '#6b7280', fontSize: 11 }

/** Escala de laranja por posição no ranking — mantém a leitura hierárquica. */
function rankColor(i: number, n: number): string {
  const t = n <= 1 ? 0 : i / (n - 1)
  const light = 62 - t * 26
  const sat = 96 - t * 34
  return `hsl(18, ${sat}%, ${light}%)`
}

export function QuestionCard({
  question,
  active,
  onPick,
  delay = 0,
}: {
  question: Question
  active: string | null
  onPick: (answer: string) => void
  delay?: number
}) {
  const { label, options, total, numeric, stats } = question

  const head = (
    <>
      <p className="eyebrow">{total} respostas</p>
      <h3 style={{
        fontSize: 14.5,
        fontWeight: 700,
        marginTop: 6,
        marginBottom: 18,
        lineHeight: 1.4,
      }}>
        {label}
      </h3>
    </>
  )

  if (total === 0) {
    return (
      <div className="card anim card-pad" style={{ animationDelay: `${delay}ms` }}>
        {head}
        <Empty>Sem respostas no segmento selecionado</Empty>
      </div>
    )
  }

  // ---- Pergunta de preço: histograma crescente com a faixa de 50% destacada.
  if (numeric && stats) {
    const inBand = (v: number | null) => v !== null && v >= stats.p25 && v <= stats.p75
    const bandFrom = options.find(o => inBand(o.value))?.name
    const bandTo = [...options].reverse().find(o => inBand(o.value))?.name

    return (
      <div className="card card-int anim card-pad" style={{ animationDelay: `${delay}ms` }}>
        {head}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 10,
          padding: '14px 16px',
          marginBottom: 18,
          borderRadius: 14,
          background: 'rgba(0,0,0,.28)',
          border: '1px solid var(--border)',
        }}>
          <Stat label="Média" value={brl(stats.avg)} />
          <Stat label="Mediana" value={brl(stats.median)} strong />
          <Stat label="Mais citado" value={brl(stats.mode)} />
          <Stat label="Faixa 50%" value={`${brl(stats.p25)}–${brl(stats.p75)}`} />
        </div>

        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={options} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            {bandFrom && bandTo && (
              <ReferenceArea
                x1={bandFrom}
                x2={bandTo}
                fill="rgba(255,90,31,.10)"
                stroke="rgba(255,90,31,.28)"
                strokeDasharray="3 3"
              />
            )}
            {/* Rótulos horizontais com espaçamento automático: com 20+ faixas de
                preço, forçar todos os valores deixa o eixo ilegível. */}
            <XAxis
              dataKey="name"
              tick={AXIS}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,.07)' }}
              height={26}
              minTickGap={6}
              tickFormatter={(v: string) => v.replace(/R\$\s*/, '').replace(',00', '')}
            />
            <YAxis hide />
            <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
            <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={44} onClick={(d: any) => onPick(d.name)}>
              {options.map(o => (
                <Cell
                  key={o.name}
                  fill={inBand(o.value) ? 'var(--accent)' : 'rgba(255,90,31,.30)'}
                  opacity={active && active !== o.name ? 0.28 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <p style={{ color: 'var(--faint)', fontSize: 11.5, marginTop: 10, lineHeight: 1.5 }}>
          A área destacada concentra metade das respostas — é a faixa com maior alcance.
          Clique numa barra para segmentar o painel.
        </p>
      </div>
    )
  }

  // ---- Pergunta categórica: ranking horizontal.
  return (
    <div className="card card-int anim card-pad" style={{ animationDelay: `${delay}ms` }}>
      {head}

      <ResponsiveContainer width="100%" height={Math.max(110, options.length * 46)}>
        <BarChart data={options} layout="vertical" margin={{ left: 0, right: 44, top: 0, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: string) => (v.length > 22 ? v.slice(0, 20) + '…' : v)}
          />
          <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
          <Bar dataKey="count" radius={[0, 7, 7, 0]} maxBarSize={30} onClick={(d: any) => onPick(d.name)}>
            {options.map((o, i) => (
              <Cell
                key={o.name}
                fill={rankColor(i, options.length)}
                opacity={active && active !== o.name ? 0.28 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 16 }}>
        {options.map((o, i) => (
          <button
            key={o.name}
            className={`chip chip-btn${active === o.name ? ' chip-on' : ''}`}
            onClick={() => onPick(o.name)}
          >
            <span style={{ color: rankColor(i, options.length), fontWeight: 800 }}>
              {pct(o.count, total)}%
            </span>
            <span className="truncate" style={{ maxWidth: 190 }}>{o.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function HourChart({ data }: { data: { hour: string; count: number }[] }) {
  const empty = data.every(d => d.count === 0)
  return (
    <div className="card anim card-pad">
      <p className="eyebrow">Captação por hora do dia</p>
      <h3 style={{ fontSize: 14.5, fontWeight: 700, marginTop: 6, marginBottom: 18 }}>
        Melhor janela para abordagem no totem
      </h3>

      {empty ? (
        <Empty>Sem dados de horário</Empty>
      ) : (
        <ResponsiveContainer width="100%" height={190}>
          <AreaChart data={data} margin={{ top: 4, right: 14, left: 14, bottom: 0 }}>
            <defs>
              <linearGradient id="hourFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.55} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="hour"
              tick={AXIS}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,.07)' }}
              interval={2}
            />
            <YAxis hide />
            <Tooltip content={<ChartTip suffix="cadastros" />} cursor={{ stroke: 'rgba(255,255,255,.12)' }} />
            <Area
              type="monotone"
              dataKey="count"
              stroke="var(--accent)"
              strokeWidth={2}
              fill="url(#hourFill)"
              dot={false}
              activeDot={{ r: 4, fill: 'var(--accent-2)' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
