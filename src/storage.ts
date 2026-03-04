import type { Expense, Category, IncomeByMonth } from './types'

const EXPENSES_KEY = 'expense-map.expenses'
const CATEGORIES_KEY = 'expense-map.categories'
const INCOME_KEY = 'expense-map.incomeByMonth'

export function loadExpenses(): Expense[] {
  try {
    const raw = localStorage.getItem(EXPENSES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Expense[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveExpenses(expenses: Expense[]) {
  localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses))
}

export function loadCategories(): Category[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY)
    if (!raw) return defaultCategories
    const parsed = JSON.parse(raw) as Category[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultCategories
  } catch {
    return defaultCategories
  }
}

export function saveCategories(categories: Category[]) {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories))
}

export function loadIncomeByMonth(): IncomeByMonth {
  try {
    const raw = localStorage.getItem(INCOME_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as IncomeByMonth
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveIncomeByMonth(incomeByMonth: IncomeByMonth) {
  localStorage.setItem(INCOME_KEY, JSON.stringify(incomeByMonth))
}

export const defaultCategories: Category[] = [
  { id: 'food', label: 'Food', color: '#4C9D8B' },
  { id: 'gifts', label: 'Gifts', color: '#D47047' },
  { id: 'bills', label: 'Bills', color: '#9C6ADE' },
  { id: 'gas', label: 'Gas', color: '#5D7BD9' },
  { id: 'transportation', label: 'Transportation', color: '#38BDF8' },
  { id: 'subscription', label: 'Subscription', color: '#C2507C' },
  { id: 'miscellaneous', label: 'Miscellaneous', color: '#94A3B8' },
  { id: 'fun', label: 'Fun', color: '#E3A44C' }
]
