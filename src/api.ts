import type { Category, Expense, IncomeByMonth, MonthKey } from './types'

const API_BASE = '/api'

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Request failed: ${res.status}`)
  }
  return (await res.json()) as T
}

export async function fetchCategories(): Promise<Category[]> {
  return json<Category[]>(await fetch(`${API_BASE}/categories`))
}

export async function updateCategoryColor(id: string, color: string): Promise<Category> {
  return json<Category>(
    await fetch(`${API_BASE}/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color }),
    })
  )
}

export async function fetchExpenses(): Promise<Expense[]> {
  return json<Expense[]>(await fetch(`${API_BASE}/expenses`))
}

export async function createExpense(expense: Expense): Promise<void> {
  await json(await fetch(`${API_BASE}/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(expense),
  }))
}

export async function deleteExpense(id: string): Promise<void> {
  await json(await fetch(`${API_BASE}/expenses/${id}`, { method: 'DELETE' }))
}

export async function fetchIncome(month: MonthKey): Promise<number> {
  const data = await json<{ month: string; amount: number }>(await fetch(`${API_BASE}/income/${month}`))
  return data.amount
}

export async function saveIncome(month: MonthKey, amount: number): Promise<void> {
  await json(await fetch(`${API_BASE}/income/${month}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount }),
  }))
}

export async function fetchAllIncome(months: MonthKey[]): Promise<IncomeByMonth> {
  const entries = await Promise.all(
    months.map(async (m) => {
      const amount = await fetchIncome(m)
      return [m, amount] as const
    })
  )
  return Object.fromEntries(entries)
}
