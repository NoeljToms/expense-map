import type { Expense, MonthKey } from './types'

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
