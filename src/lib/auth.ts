const KEY = 'move.dash.auth'

/**
 * Credenciais vêm exclusivamente do .env (VITE_DASH_USER / VITE_DASH_PASS).
 *
 * Sem valor padrão embutido de propósito: este repositório é público, e um
 * fallback no código publicaria o usuário e a senha do painel no GitHub.
 * Sem as variáveis, o login falha fechado.
 *
 * Limite que continua valendo: o Vite embute variáveis VITE_* no bundle na
 * hora do build. Isto tira a senha do repositório, mas ela segue legível por
 * quem abrir o DevTools no site publicado. É uma barreira de acesso, não
 * autenticação — proteção real dos dados depende de RLS no Supabase.
 */
const USER = import.meta.env.VITE_DASH_USER
const PASS = import.meta.env.VITE_DASH_PASS

/** false quando o .env não foi configurado — a tela de login avisa. */
export const isConfigured = Boolean(USER && PASS)

export function checkCredentials(user: string, pass: string): boolean {
  if (!isConfigured) return false
  return user.trim().toLowerCase() === USER!.toLowerCase() && pass === PASS
}

export function isAuthed(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function signIn() {
  try { localStorage.setItem(KEY, '1') } catch { /* modo privado */ }
}

export function signOut() {
  try { localStorage.removeItem(KEY) } catch { /* modo privado */ }
}
