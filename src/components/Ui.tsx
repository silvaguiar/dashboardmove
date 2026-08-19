import type { ReactNode } from 'react'

export function Section({
  title,
  hint,
  right,
  children,
}: {
  title: string
  hint?: string
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <section style={{ marginBottom: 30 }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 14,
        flexWrap: 'wrap',
      }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 750, letterSpacing: '-0.01em' }}>{title}</h2>
          {hint && (
            <p style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 3 }}>{hint}</p>
          )}
        </div>
        {right}
      </div>
      {children}
    </section>
  )
}

export function Kpi({
  label,
  value,
  sub,
  accent,
  delay = 0,
}: {
  label: string
  value: string | number
  sub: string
  accent?: boolean
  delay?: number
}) {
  return (
    <div className="card card-int anim card-pad" style={{ animationDelay: `${delay}ms` }}>
      <p className="eyebrow">{label}</p>
      <p
        className="num"
        style={{
          fontSize: 40,
          lineHeight: 1.05,
          marginTop: 10,
          color: accent ? undefined : 'var(--text)',
        }}
      >
        {accent ? <span className="grad-text">{value}</span> : value}
      </p>
      <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 7 }}>{sub}</p>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p style={{
      color: 'var(--faint)',
      fontSize: 13,
      textAlign: 'center',
      padding: '36px 0',
    }}>
      {children}
    </p>
  )
}

/** Bloco compacto de métrica usado dentro dos cartões de preço. */
export function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'var(--faint)',
      }}>
        {label}
      </p>
      <p
        className="num truncate"
        style={{
          fontSize: strong ? 21 : 17,
          marginTop: 4,
          color: strong ? 'var(--accent-2)' : 'var(--text)',
        }}
      >
        {value}
      </p>
    </div>
  )
}

export function ChartTip({ active, payload, suffix }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div style={{
      background: 'rgba(8,9,13,.96)',
      border: '1px solid var(--border-str)',
      borderRadius: 10,
      padding: '9px 13px',
      boxShadow: 'var(--shadow-lg)',
    }}>
      <p style={{ fontWeight: 700, fontSize: 13 }}>{p.name ?? p.hour}</p>
      <p style={{ color: 'var(--accent-2)', fontWeight: 700, fontSize: 12.5, marginTop: 2 }}>
        {payload[0].value} {suffix ?? 'respostas'}
      </p>
    </div>
  )
}
