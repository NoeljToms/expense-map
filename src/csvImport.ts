import type { Category, Expense } from './types'
import { createId } from './utils'

type CsvRow = Record<string, string>

const requiredHeaders = ['Date', 'Description', 'Sub-description', 'Status', 'Type of Transaction', 'Amount']

const categoryRules: Array<{ category: string; patterns: RegExp[] }> = [
  { category: 'transportation', patterns: [/\bpresto\b/i, /\buber\b/i, /\blyft\b/i, /\bmetrolinx\b/i] },
  { category: 'gas', patterns: [/\bhusky\b/i, /\bpetro\b/i, /\bshell\b/i, /\besso\b/i, /\bpump\b/i] },
  { category: 'subscription', patterns: [/\bspotify\b/i, /\bprime\b/i, /\bnetflix\b/i, /\bapple\.com\/bill\b/i, /\badobe\b/i] },
  { category: 'fun', patterns: [/\bcineplex\b/i, /\btheatre\b/i, /\bmovie\b/i, /\bsteam\b/i] },
  {
    category: 'food',
    patterns: [
      /\bramen\b/i,
      /\bpizza\b/i,
      /\bgrill\b/i,
      /\brestaurant\b/i,
      /\bkitchen\b/i,
      /\bpoulet\b/i,
      /\bcafe\b/i,
      /\bcoffee\b/i,
    ],
  },
  { category: 'bills', patterns: [/\bhydro\b/i, /\bphone\b/i, /\binternet\b/i, /\binsurance\b/i] },
  { category: 'gifts', patterns: [/\bgift\b/i, /\bflorist\b/i] },
]

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]

    if (char === '"') {
      const next = line[i + 1]
      if (inQuotes && next === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      values.push(current)
      current = ''
      continue
    }

    current += char
  }

  values.push(current)
  return values
}

function parseCsv(text: string): CsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length < 2) return []

  const headers = parseCsvLine(lines[0])
  requiredHeaders.forEach((header) => {
    if (!headers.includes(header)) {
      throw new Error(`Missing required CSV header: ${header}`)
    }
  })

  const rows: CsvRow[] = []
  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i])
    if (cells.every((cell) => cell.trim() === '')) continue

    const row: CsvRow = {}
    headers.forEach((header, index) => {
      row[header] = (cells[index] ?? '').trim()
    })
    rows.push(row)
  }

  return rows
}

function pickCategory(description: string, availableCategoryIds: Set<string>) {
  for (const rule of categoryRules) {
    if (!availableCategoryIds.has(rule.category)) continue
    if (rule.patterns.some((pattern) => pattern.test(description))) {
      return rule.category
    }
  }

  if (availableCategoryIds.has('miscellaneous')) return 'miscellaneous'
  return Array.from(availableCategoryIds)[0] ?? 'miscellaneous'
}

function toAmount(value: string): number | null {
  const cleaned = value.replace(/[$,]/g, '')
  const parsed = Number(cleaned)
  if (!Number.isFinite(parsed)) return null
  return Math.abs(parsed)
}

export type CsvImportResult = {
  expenses: Expense[]
  skippedRows: number
}

export function parseExpenseCsv(text: string, categories: Category[]): CsvImportResult {
  const rows = parseCsv(text)
  const categoryIds = new Set(categories.map((c) => c.id))

  let skippedRows = 0
  const expenses: Expense[] = []

  rows.forEach((row) => {
    const status = (row['Status'] ?? '').toLowerCase()
    const transactionType = (row['Type of Transaction'] ?? '').toLowerCase()
    const description = (row['Description'] ?? '').trim()
    const date = (row['Date'] ?? '').trim()
    const amountRaw = (row['Amount'] ?? '').trim()

    if (!description || !date || !amountRaw) {
      skippedRows += 1
      return
    }

    if (status && status !== 'posted') {
      skippedRows += 1
      return
    }

    if (transactionType !== 'debit') {
      skippedRows += 1
      return
    }

    if (/\bpayment\b/i.test(description)) {
      skippedRows += 1
      return
    }

    const amount = toAmount(amountRaw)
    if (amount === null || amount <= 0) {
      skippedRows += 1
      return
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      skippedRows += 1
      return
    }

    const subDescription = (row['Sub-description'] ?? '').trim()
    const category = pickCategory(description, categoryIds)

    expenses.push({
      id: createId(),
      name: description,
      amount,
      category,
      date,
      location: subDescription || undefined,
      note: 'Imported from CSV',
    })
  })

  return { expenses, skippedRows }
}
