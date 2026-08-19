import type { Answer, Insight, NumericStats, Option, Question, Session } from '../types'
import { brl, norm, pct } from './format'

/**
 * Converte "R$ 1.250,00" / "150" / "R$ 80" em número.
 * Retorna null quando a resposta não é monetária.
 */
export function parsePrice(raw: string): number | null {
  const s = (raw ?? '').trim()
  if (!s) return null

  // Só aceita string que é essencialmente um valor — evita capturar
  // respostas de texto que por acaso contenham um número.
  if (!/^R?\$?\s*[\d.,]+$/i.test(s)) return null

  let body = s.replace(/[R$\s]/gi, '')
  if (body.includes(',')) {
    // Formato pt-BR: ponto é milhar, vírgula é decimal.
    body = body.replace(/\./g, '').replace(',', '.')
  } else if (/\.\d{3}$/.test(body)) {
    // "1.250" -> milhar
    body = body.replace(/\./g, '')
  }

  const n = Number(body)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

function numericStats(values: number[]): NumericStats | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)

  const freq = new Map<number, number>()
  for (const v of sorted) freq.set(v, (freq.get(v) ?? 0) + 1)
  let mode = sorted[0]
  let best = 0
  for (const [v, c] of freq) if (c > best) { best = c; mode = v }

  return {
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    median: quantile(sorted, 0.5),
    mode,
    p25: quantile(sorted, 0.25),
    p75: quantile(sorted, 0.75),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  }
}

/**
 * Agrupa respostas por pergunta, detecta perguntas de preço e ordena
 * de forma legível: preço vira histograma crescente, categoria vira ranking.
 */
export function buildQuestions(answers: Answer[]): Question[] {
  const map = new Map<string, { label: string; counts: Map<string, number>; total: number }>()

  for (const a of answers) {
    let q = map.get(a.question_key)
    if (!q) {
      q = { label: a.question_label, counts: new Map(), total: 0 }
      map.set(a.question_key, q)
    }
    q.counts.set(a.answer, (q.counts.get(a.answer) ?? 0) + 1)
    q.total++
  }

  const out: Question[] = []

  for (const [key, q] of map) {
    const options: Option[] = Array.from(q.counts, ([name, count]) => ({
      name,
      count,
      value: parsePrice(name),
    }))

    const priced = options.filter(o => o.value !== null)
    const pricedResponses = priced.reduce((sum, o) => sum + o.count, 0)
    const numeric = q.total > 0 && pricedResponses / q.total >= 0.7

    options.sort(
      numeric
        ? (a, b) => (a.value ?? Infinity) - (b.value ?? Infinity)
        : (a, b) => b.count - a.count,
    )

    // Expande as respostas de preço para calcular média/mediana sobre pessoas,
    // e não sobre opções distintas.
    const values: number[] = []
    if (numeric) for (const o of priced) for (let i = 0; i < o.count; i++) values.push(o.value!)

    out.push({
      key,
      label: q.label,
      options,
      total: q.total,
      numeric,
      stats: numeric ? numericStats(values) : null,
    })
  }

  return out.sort((a, b) => a.key.localeCompare(b.key, 'pt-BR', { numeric: true }))
}

/**
 * Uma resposta por pessoa/pergunta, mantendo a mais recente.
 *
 * A base tem casos da mesma sessão respondendo a mesma pergunta duas vezes com
 * valores diferentes (ex.: R$ 110 e depois R$ 30). Sem isto a pessoa entra duas
 * vezes na média e o `question_key` do export viraria sorteio.
 */
export function dedupeAnswers(answers: Answer[]): Answer[] {
  const latest = new Map<string, Answer>()
  for (const a of answers) {
    const k = `${a.session_id}|${a.question_key}`
    const prev = latest.get(k)
    if (!prev || a.created_at > prev.created_at) latest.set(k, a)
  }
  return Array.from(latest.values())
}

/**
 * Colapsa cadastros repetidos do mesmo telefone.
 *
 * Mantém a sessão mais completa (mais respostas) e, no empate, a mais recente —
 * assim um recadastro abandonado não apaga o preenchimento bom. Cadastros sem
 * telefone válido são sempre preservados: não há como afirmar que são a mesma
 * pessoa.
 */
export function dedupeSessions(
  sessions: Session[],
  answerCount: Map<string, number>,
): { kept: Session[]; duplicates: number } {
  const best = new Map<string, Session>()
  const kept: Session[] = []

  for (const s of sessions) {
    const phone = (s.fone ?? '').replace(/\D/g, '')
    if (!isValidPhone(s.fone)) { kept.push(s); continue }

    const prev = best.get(phone)
    if (!prev) { best.set(phone, s); continue }

    const a = answerCount.get(s.id) ?? 0
    const b = answerCount.get(prev.id) ?? 0
    if (a > b || (a === b && s.created_at > prev.created_at)) best.set(phone, s)
  }

  const all = [...kept, ...best.values()]
  all.sort((x, y) => (x.created_at < y.created_at ? 1 : -1))

  return { kept: all, duplicates: sessions.length - all.length }
}

/** Mapa session_id -> { question_key -> resposta }. Base do export e dos filtros. */
export function indexBySession(answers: Answer[]): Map<string, Map<string, string>> {
  const idx = new Map<string, Map<string, string>>()
  for (const a of answers) {
    let row = idx.get(a.session_id)
    if (!row) { row = new Map(); idx.set(a.session_id, row) }
    row.set(a.question_key, a.answer)
  }
  return idx
}

/** Volume de captação por hora do dia — mostra a melhor janela de ativação. */
export function byHour(sessions: Session[]): { hour: string; count: number }[] {
  const buckets = new Array(24).fill(0)
  for (const s of sessions) {
    const h = new Date(s.created_at).getHours()
    if (h >= 0 && h < 24) buckets[h]++
  }
  return buckets.map((count, h) => ({ hour: String(h).padStart(2, '0') + 'h', count }))
}

/** Telefone com DDD + 8 ou 9 dígitos — o que de fato serve para campanha. */
export function isValidPhone(fone: string | null | undefined): boolean {
  const d = (fone ?? '').replace(/\D/g, '')
  return d.length >= 10 && d.length <= 13
}

function find(questions: Question[], ...terms: string[]): Question | undefined {
  return questions.find(q => {
    const l = norm(q.label)
    return terms.every(t => l.includes(t))
  })
}

/**
 * Traduz os números em recomendações de campanha em linguagem de negócio.
 * Cada insight só aparece se os dados que o sustentam existirem.
 */
export function buildInsights(
  questions: Question[],
  sessions: Session[],
  hours: { hour: string; count: number }[],
): Insight[] {
  const out: Insight[] = []

  const perceived = find(questions, 'custa')
  const paidShirt = find(questions, 'paga', 'camisa')

  // 1. Margem: valor percebido vs. o que o público já paga hoje.
  if (perceived?.stats && paidShirt?.stats) {
    const p = perceived.stats.median
    const c = paidShirt.stats.median
    const gap = c > 0 ? Math.round(((p - c) / c) * 100) : 0
    out.push({
      tone: gap >= 0 ? 'green' : 'accent',
      tag: 'Precificação',
      title:
        gap >= 0
          ? `Margem de ${gap}% acima do mercado`
          : `Percepção ${Math.abs(gap)}% abaixo do que se paga hoje`,
      body:
        gap >= 0
          ? `O público avalia o produto em ${brl(p)}, enquanto costuma pagar ${brl(c)} numa camisa fitness. Lançar entre ${brl(c)} e ${brl(p)} captura essa diferença sem perder volume.`
          : `O público avalia o produto em ${brl(p)}, abaixo dos ${brl(c)} que costuma pagar. Reforce qualidade e acabamento na comunicação antes de subir o preço.`,
    })
  }

  // 2. Faixa de maior alcance — onde estão os 50% centrais.
  if (perceived?.stats) {
    const { p25, p75, mode } = perceived.stats
    out.push({
      tone: 'accent',
      tag: 'Faixa de preço',
      title: `Zona de conversão: ${brl(p25)} a ${brl(p75)}`,
      body: `Metade dos respondentes coloca o produto nessa faixa, e ${brl(mode)} é o valor mais citado. É o intervalo com maior alcance para a campanha de lançamento.`,
    })
  }

  // 3. Mensagem principal — o driver de escolha da marca.
  // Exige 2+ opções: com o painel filtrado por essa pergunta sobra uma só,
  // e "100% escolhem X" não diria nada.
  const driver = questions.find(q => !q.numeric && q.options.length >= 2 && q.options.length <= 8)
  if (driver) {
    const top = driver.options[0]
    out.push({
      tone: 'violet',
      tag: 'Mensagem',
      title: `${pct(top.count, driver.total)}% decidem por "${top.name.toLowerCase()}"`,
      body: `Esse é o argumento com maior peso na escolha da marca. Coloque-o como headline do criativo e deixe os demais como suporte.`,
    })
  }

  // 4. Base de leads acionável.
  const leads = sessions.filter(s => isValidPhone(s.fone)).length
  if (sessions.length > 0) {
    out.push({
      tone: 'blue',
      tag: 'Base',
      title: `${leads} leads prontos para ativação`,
      body: `${pct(leads, sessions.length)}% dos participantes deixaram telefone válido. Exporte a planilha e segmente por faixa de preço antes do disparo de WhatsApp.`,
    })
  }

  // 5. Melhor janela de captação na academia.
  const peak = [...hours].sort((a, b) => b.count - a.count)[0]
  if (peak && peak.count > 0) {
    const idx = hours.findIndex(h => h.hour === peak.hour)
    const next = hours[(idx + 1) % 24]
    out.push({
      tone: 'green',
      tag: 'Operação',
      title: `Pico de captação às ${peak.hour}`,
      body: `${peak.count} cadastros concentrados entre ${peak.hour} e ${next.hour}. Reforce a abordagem no totem nesse intervalo para acelerar a base.`,
    })
  }

  return out
}
