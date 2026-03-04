export type Expense = {
  id: string
  name: string
  amount: number
  category: string
  date: string // YYYY-MM-DD
  note?: string
  location?: string
}

export type Category = {
  id: string
  label: string
  color: string
}

export type MonthKey = string // YYYY-MM

export type IncomeByMonth = Record<MonthKey, number>
