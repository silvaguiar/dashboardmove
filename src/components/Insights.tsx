import type { Insight } from '../types'

const TONES: Record<Insight['tone'], { color: string; soft: string }> = {
  accent: { color: 'var(--accent-2)', soft: 'rgba(255,90,31,.12)' },
  green:  { color: 'var(--green)',    soft: 'rgba(46,212,122,.12)' },
  blue:   { color: 'var(--blue)',     soft: 'rgba(77,159,255,.12)' },
  violet: { color: 'var(--violet)',   soft: 'rgba(169,123,255,.12)' },
}

export function InsightCard({ insight, delay = 0 }: { insight: Insight; delay?: number }) {
  const tone = TONES[insight.tone]
  return (
    <div
      className="card card-int anim"
      style={{ animationDelay: `${delay}ms`, display: 'flex' }}
    >
      {/* Faixa lateral colorida — identifica o tipo de insight de relance */}
      <span style={{ width: 3, flex: '0 0 3px', background: tone.color, opacity: .85 }} />

      <div className="card-pad" style={{ flex: 1, minWidth: 0 }}>
        <span
          className="chip"
          style={{ background: tone.soft, borderColor: 'transparent', color: tone.color }}
        >
          {insight.tag}
        </span>

        <h3 style={{
          fontSize: 16,
          fontWeight: 750,
          marginTop: 13,
          lineHeight: 1.3,
          letterSpacing: '-0.01em',
        }}>
          {insight.title}
        </h3>

        <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 8, lineHeight: 1.62 }}>
          {insight.body}
        </p>
      </div>
    </div>
  )
}
