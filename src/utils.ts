import type { Expense, MonthKey } from './types'

export function createId() {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    globalThis.crypto.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`
  }

  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
}

export function monthKey(date: string): MonthKey {
  return date.slice(0, 7)
}

export function formatMoney(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount)
}

export function sumExpenses(expenses: Expense[]) {
  return expenses.reduce((sum, e) => sum + e.amount, 0)
}

export function uniqueMonths(expenses: Expense[]): MonthKey[] {
  const set = new Set<string>()
  expenses.forEach((e) => set.add(monthKey(e.date)))
  return Array.from(set).sort().reverse()
}

export function groupByMonth(expenses: Expense[]): Record<MonthKey, Expense[]> {
  return expenses.reduce<Record<MonthKey, Expense[]>>((acc, e) => {
    const key = monthKey(e.date)
    acc[key] = acc[key] ?? []
    acc[key].push(e)
    return acc
  }, {})
}

export function sumByCategory(expenses: Expense[]) {
  return expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount
    return acc
  }, {})
}
