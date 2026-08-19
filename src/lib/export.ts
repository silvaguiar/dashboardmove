import type { Answer, Question, Session } from '../types'
import { indexBySession, parsePrice } from './stats'

const ACCENT = 'FFFF5A1F'
const HEADER_TXT = 'FFFFFFFF'
const STRIPE = 'FFF7F7F9'

function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Deixa o navegador iniciar o download antes de liberar a URL.
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/**
 * Uma linha por pessoa: Nome | Telefone | pergunta 1..N | Data | Hora.
 * As colunas de pergunta seguem a ordem em que as perguntas aparecem no painel.
 */
export function buildRows(sessions: Session[], answers: Answer[], questions: Question[]) {
  const idx = indexBySession(answers)

  const header = [
    'Nome',
    'Telefone',
    ...questions.map(q => q.label),
    'Data',
    'Hora',
  ]

  const rows = sessions.map(s => {
    const a = idx.get(s.id)
    const d = new Date(s.created_at)
    return [
      (s.nome ?? '').trim(),
      (s.fone ?? '').trim(),
      ...questions.map(q => a?.get(q.key) ?? ''),
      d.toLocaleDateString('pt-BR'),
      d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    ]
  })

  return { header, rows }
}

/**
 * Planilha .xlsx formatada — cabeçalho na cor da marca, filtro automático,
 * painel congelado e colunas de preço já como número (dá para somar e filtrar).
 * O exceljs entra por import dinâmico para não pesar o carregamento do painel.
 */
export async function exportXlsx(
  sessions: Session[],
  answers: Answer[],
  questions: Question[],
  suffix = '',
) {
  const ExcelJS = (await import('exceljs')).default
  const { header, rows } = buildRows(sessions, answers, questions)

  const wb = new ExcelJS.Workbook()
  wb.creator = 'MOVE Dashboard'
  wb.created = new Date()

  const ws = wb.addWorksheet('Respostas', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  ws.addRow(header)
  const priceCols = new Set<number>()
  questions.forEach((q, i) => { if (q.numeric) priceCols.add(3 + i) })

  for (const r of rows) {
    const row = ws.addRow(r)
    // Telefone precisa ser texto, senão o Excel come o zero e vira notação científica.
    row.getCell(2).numFmt = '@'
    for (const c of priceCols) {
      const cell = row.getCell(c)
      const n = parsePrice(String(cell.value ?? ''))
      if (n !== null) {
        cell.value = n
        cell.numFmt = 'R$ #,##0.00'
      }
    }
  }

  const head = ws.getRow(1)
  head.height = 30
  head.eachCell(cell => {
    cell.font = { bold: true, color: { argb: HEADER_TXT }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT } }
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
  })

  // Zebra: leitura muito mais fácil em base grande.
  for (let i = 2; i <= ws.rowCount; i++) {
    if (i % 2 === 0) {
      ws.getRow(i).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STRIPE } }
      })
    }
  }

  ws.columns.forEach((col, i) => {
    const sample = [header[i], ...rows.slice(0, 200).map(r => String(r[i] ?? ''))]
    const widest = sample.reduce((m, v) => Math.max(m, v.length), 10)
    col.width = Math.min(Math.max(widest + 2, 12), 46)
  })

  if (ws.rowCount > 1) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: header.length } }
  }

  const buf = await wb.xlsx.writeBuffer()
  download(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `move-respostas${suffix}_${stamp()}.xlsx`,
  )
}

/** CSV com BOM — abre direto no Excel e serve para importar em ferramenta de disparo. */
export function exportCsv(
  sessions: Session[],
  answers: Answer[],
  questions: Question[],
  suffix = '',
) {
  const { header, rows } = buildRows(sessions, answers, questions)
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`
  const csv = [header, ...rows].map(r => r.map(esc).join(';')).join('\r\n')

  download(
    new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }),
    `move-respostas${suffix}_${stamp()}.csv`,
  )
}
