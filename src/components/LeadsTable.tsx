import { useState } from 'react'
import type { Question, Session } from '../types'
import { initials, timeAgo } from '../lib/format'
import { isValidPhone } from '../lib/stats'
import { Empty } from './Ui'

const PAGE = 25

export default function LeadsTable({
  sessions,
  answersBySession,
  questions,
  search,
  onSearch,
}: {
  sessions: Session[]
  answersBySession: Map<string, Map<string, string>>
  questions: Question[]
  search: string
  onSearch: (v: string) => void
}) {
  const [limit, setLimit] = useState(PAGE)
  const [open, setOpen] = useState<string | null>(null)

  const shown = sessions.slice(0, limit)

  return (
    <div className="card anim">
      <div className="card-pad" style={{ paddingBottom: 10 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
        }}>
          <div>
            <p className="eyebrow">Base de leads</p>
            <h3 style={{ fontSize: 14.5, fontWeight: 700, marginTop: 6 }}>
              {sessions.length} {sessions.length === 1 ? 'participante' : 'participantes'}
            </h3>
          </div>

          <input
            className="field"
            style={{ maxWidth: 250 }}
            placeholder="Buscar nome ou telefone…"
            value={search}
            onChange={e => { onSearch(e.target.value); setLimit(PAGE) }}
          />
        </div>
      </div>

      <div className="card-pad" style={{ paddingTop: 4 }}>
        {shown.length === 0 && <Empty>Nenhum participante encontrado</Empty>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {shown.map(s => {
            const isOpen = open === s.id
            const answers = answersBySession.get(s.id)
            const valid = isValidPhone(s.fone)

            return (
              <div key={s.id}>
                <div
                  className="lead-row"
                  onClick={() => setOpen(isOpen ? null : s.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="avatar">{initials(s.nome)}</div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="truncate" style={{ fontWeight: 650, fontSize: 13.5 }}>
                      {s.nome || 'Sem nome'}
                    </p>
                    <p style={{
                      color: valid ? 'var(--text-2)' : 'var(--faint)',
                      fontSize: 12,
                      marginTop: 1,
                    }}>
                      {s.fone || 'sem telefone'}
                    </p>
                  </div>

                  {valid && (
                    <span className="chip" style={{
                      background: 'var(--green-soft)',
                      borderColor: 'transparent',
                      color: 'var(--green)',
                    }}>
                      lead
                    </span>
                  )}

                  <span style={{
                    color: 'var(--faint)',
                    fontSize: 11.5,
                    minWidth: 42,
                    textAlign: 'right',
                  }}>
                    {timeAgo(s.created_at)}
                  </span>
                </div>

                {isOpen && (
                  <div style={{
                    margin: '2px 0 8px 62px',
                    padding: '14px 16px',
                    borderRadius: 12,
                    background: 'rgba(0,0,0,.3)',
                    border: '1px solid var(--border)',
                    display: 'grid',
                    gap: 10,
                  }}>
                    {questions.map(q => (
                      <div key={q.key}>
                        <p style={{ color: 'var(--faint)', fontSize: 11, lineHeight: 1.4 }}>
                          {q.label}
                        </p>
                        <p style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>
                          {answers?.get(q.key) ?? '—'}
                        </p>
                      </div>
                    ))}
                    {!answers && (
                      <p style={{ color: 'var(--faint)', fontSize: 12 }}>Sem respostas registradas.</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {sessions.length > limit && (
          <button
            className="btn"
            style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}
            onClick={() => setLimit(l => l + PAGE * 2)}
          >
            Mostrar mais ({sessions.length - limit} restantes)
          </button>
        )}
      </div>
    </div>
  )
}
