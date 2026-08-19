import { useState, type FormEvent } from 'react'
import { checkCredentials, isConfigured, signIn } from '../lib/auth'

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(false)

    // Pequeno atraso: evita brute force por script e dá peso ao feedback.
    setTimeout(() => {
      if (checkCredentials(user, pass)) {
        signIn()
        onSuccess()
      } else {
        setError(true)
        setPass('')
        setBusy(false)
      }
    }, 420)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      padding: 24,
    }}>
      <div className={`card anim${error ? ' shake' : ''}`} style={{ width: '100%', maxWidth: 400 }}>
        <div className="card-pad" style={{ padding: '40px 36px 34px' }}>

          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div className="grad-text num" style={{ fontSize: 44, letterSpacing: '0.22em', lineHeight: 1 }}>
              MOVE
            </div>
            <div style={{
              marginTop: 10,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '0.2em',
              color: 'var(--muted)',
            }}>
              <span style={{ width: 18, height: 1, background: 'var(--border-str)' }} />
              INTELIGÊNCIA DE MARCA
              <span style={{ width: 18, height: 1, background: 'var(--border-str)' }} />
            </div>
          </div>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="eyebrow" htmlFor="u" style={{ display: 'block', marginBottom: 7 }}>
                Usuário
              </label>
              <input
                id="u"
                className="field"
                value={user}
                onChange={e => { setUser(e.target.value); setError(false) }}
                autoComplete="username"
                autoFocus
                placeholder="seu usuário"
              />
            </div>

            <div>
              <label className="eyebrow" htmlFor="p" style={{ display: 'block', marginBottom: 7 }}>
                Senha
              </label>
              <input
                id="p"
                className="field"
                type="password"
                value={pass}
                onChange={e => { setPass(e.target.value); setError(false) }}
                autoComplete="current-password"
                placeholder="••••••"
              />
            </div>

            <div style={{ minHeight: 20, marginTop: 2 }}>
              {!isConfigured && (
                <p style={{ color: 'var(--red)', fontSize: 12.5, fontWeight: 600, lineHeight: 1.5 }}>
                  Defina VITE_DASH_USER e VITE_DASH_PASS no .env para liberar o acesso.
                </p>
              )}
              {isConfigured && error && (
                <p style={{ color: 'var(--red)', fontSize: 12.5, fontWeight: 600 }}>
                  Usuário ou senha incorretos.
                </p>
              )}
            </div>

            <button
              className="btn btn-accent btn-lg"
              type="submit"
              disabled={busy || !isConfigured}
            >
              {busy ? 'Verificando…' : 'Entrar no painel'}
            </button>
          </form>

          <p style={{
            marginTop: 22,
            textAlign: 'center',
            fontSize: 11,
            color: 'var(--faint)',
            lineHeight: 1.6,
          }}>
            Painel restrito · dados de pesquisa em tempo real
          </p>
        </div>
      </div>
    </div>
  )
}
