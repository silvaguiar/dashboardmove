export interface Answer {
  session_id: string
  question_key: string
  question_label: string
  answer: string
  created_at: string
}

export interface Session {
  id: string
  nome: string
  fone: string
  created_at: string
}

export interface Option {
  name: string
  count: number
  /** Valor numérico quando a resposta é monetária (ex.: "R$ 60,00" -> 60). */
  value: number | null
}

export interface NumericStats {
  avg: number
  median: number
  mode: number
  p25: number
  p75: number
  min: number
  max: number
}

export interface Question {
  key: string
  label: string
  options: Option[]
  total: number
  /** true quando a maioria das respostas é um valor em reais. */
  numeric: boolean
  stats: NumericStats | null
}

export interface Insight {
  tone: 'accent' | 'green' | 'blue' | 'violet'
  tag: string
  title: string
  body: string
}
