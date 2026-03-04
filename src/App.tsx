import { useEffect, useMemo, useState } from 'react'
import {
  createExpense,
  deleteExpense,
  fetchAllIncome,
  fetchCategories,
  fetchExpenses,
  saveIncome,
  updateCategoryColor as apiUpdateCategoryColor,
} from './api'
import type { Category, Expense, MonthKey } from './types'
import { createId, formatMoney, groupByMonth, monthKey, sumByCategory, sumExpenses, uniqueMonths } from './utils'

type Theme = 'light' | 'dark'

const blankExpense = (): Expense => ({
  id: createId(),
  name: '',
  amount: 0,
  category: 'food',
  date: new Date().toISOString().slice(0, 10),
  note: '',
  location: '',
})

const panelClass =
  'rounded-2xl border border-slate-200/80 bg-white/90 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.35)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/80'
const fieldClass =
  'h-11 w-full rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:ring-slate-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400'
const labelClass = 'grid gap-2 text-sm text-slate-600 dark:text-slate-300'

export default function App() {
  const [theme, setTheme] = useState<Theme>('light')
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [incomeByMonth, setIncomeByMonth] = useState<Record<MonthKey, number>>({})
  const [draft, setDraft] = useState<Expense>(() => blankExpense())
  const [filterMonth, setFilterMonth] = useState<MonthKey | 'all'>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')

  const months = useMemo(() => uniqueMonths(expenses), [expenses])
  const grouped = useMemo(() => groupByMonth(expenses), [expenses])

  const visibleExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const inMonth = filterMonth === 'all' || monthKey(e.date) === filterMonth
      const inCat = filterCategory === 'all' || e.category === filterCategory
      return inMonth && inCat
    })
  }, [expenses, filterMonth, filterCategory])

  const totalVisible = useMemo(() => sumExpenses(visibleExpenses), [visibleExpenses])
  const visibleMonths = useMemo(() => uniqueMonths(visibleExpenses), [visibleExpenses])
  const visibleGrouped = useMemo(() => groupByMonth(visibleExpenses), [visibleExpenses])
  const activeMonth = useMemo<MonthKey>(() => {
    if (filterMonth !== 'all') return filterMonth
    if (months.length > 0) return months[0]
    return new Date().toISOString().slice(0, 7)
  }, [filterMonth, months])

  const monthIncome = incomeByMonth[activeMonth] ?? 0
  const monthExpenses = useMemo(() => grouped[activeMonth] ?? [], [grouped, activeMonth])
  const monthByCategory = useMemo(() => sumByCategory(monthExpenses), [monthExpenses])

  useEffect(() => {
    const savedTheme = localStorage.getItem('expense-map-theme')
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme)
    } else {
      setTheme('light')
    }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('expense-map-theme', theme)
  }, [theme])

  useEffect(() => {
    let active = true
    async function loadAll() {
      const [expenseData, categoryData] = await Promise.all([fetchExpenses(), fetchCategories()])
      if (!active) return
      setExpenses(expenseData)
      setCategories(categoryData)
    }
    loadAll()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (months.length === 0) return
    let active = true
    async function loadIncome() {
      const data = await fetchAllIncome(months)
      if (active) setIncomeByMonth(data)
    }
    loadIncome()
    return () => {
      active = false
    }
  }, [months])

  async function addExpense() {
    const trimmedName = draft.name.trim()
    if (!trimmedName || draft.amount <= 0) return

    const nextExpense = { ...draft, name: trimmedName }
    await createExpense(nextExpense)
    setExpenses((prev) => [nextExpense, ...prev])
    setDraft(blankExpense())
  }

  async function removeExpense(id: string) {
    await deleteExpense(id)
    setExpenses((prev) => prev.filter((e) => e.id !== id))
  }

  async function updateCategoryColor(id: string, color: string) {
    const updated = await apiUpdateCategoryColor(id, color)
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)))
  }

  async function updateIncome(value: number) {
    await saveIncome(activeMonth, value)
    setIncomeByMonth((prev) => ({ ...prev, [activeMonth]: value }))
  }

  function resetFilters() {
    setFilterMonth('all')
    setFilterCategory('all')
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dbeafe_0%,#f8fafc_42%),radial-gradient(circle_at_90%_10%,#fce7f3_0%,transparent_40%)] text-slate-900 antialiased transition-colors dark:bg-[radial-gradient(circle_at_top_left,#0f172a_0%,#020617_45%),radial-gradient(circle_at_90%_10%,#172554_0%,transparent_45%)] dark:text-slate-100">
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-6">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300">
              Expense map
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Personal Expenses</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Simple monthly tracking with clean, local-first data.</p>
          </div>
          <button
            className="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-violet-300 hover:bg-violet-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-violet-500/50 dark:hover:bg-violet-500/10"
            onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? 'Dark mode' : 'Light mode'}
          </button>
        </header>

        <section className={`${panelClass} mb-6 p-4 sm:p-5`}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.8fr_1fr_1.2fr_1.2fr_1.2fr_1.6fr_auto] xl:items-center">
            <input
              className={fieldClass}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Expense name"
              aria-label="Expense name"
            />
            <input
              className={`${fieldClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
              type="number"
              min="0"
              step="0.01"
              value={draft.amount}
              onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
              placeholder="0.00"
              aria-label="Amount"
            />
            <select
              className={fieldClass}
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              aria-label="Category"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              className={fieldClass}
              type="date"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              aria-label="Date"
            />
            <input
              className={fieldClass}
              value={draft.location ?? ''}
              onChange={(e) => setDraft({ ...draft, location: e.target.value })}
              placeholder="Location"
              aria-label="Location"
            />
            <input
              className={fieldClass}
              value={draft.note ?? ''}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="Note"
              aria-label="Note"
            />
            <button
              className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
              onClick={addExpense}
            >
              Add
            </button>
          </div>
        </section>

        <main className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className={`${panelClass} p-5 lg:sticky lg:top-5`}>
            <div className="mb-5 rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-100 p-4 dark:border-slate-800 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800/80">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Visible total</p>
              <p className="mt-1 bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 bg-clip-text text-3xl font-semibold text-transparent dark:from-blue-300 dark:via-violet-300 dark:to-fuchsia-300">
                {formatMoney(totalVisible)}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{visibleExpenses.length} entries</p>
            </div>

            <h2 className="mb-3 text-lg font-semibold tracking-tight">Filters</h2>
            <button
              className="mb-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={resetFilters}
            >
              Reset filters
            </button>
            <div className="grid gap-3">
              <label className={labelClass}>
                Month
                <select className={fieldClass} value={filterMonth} onChange={(e) => setFilterMonth(e.target.value as MonthKey | 'all')}>
                  <option value="all">All months</option>
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Category
                <select className={fieldClass} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                  <option value="all">All categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-6">
              <h3 className="mb-2 text-base font-semibold">Income</h3>
              <label className={labelClass}>
                {activeMonth}
                <input
                  className={`${fieldClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={monthIncome}
                  onChange={(e) => updateIncome(Number(e.target.value))}
                />
              </label>
            </div>

            <div className="mt-6 grid gap-3">
              <h3 className="text-base font-semibold">Category Share</h3>
              {categories.map((c) => {
                const spent = monthByCategory[c.id] ?? 0
                const pct = monthIncome > 0 ? (spent / monthIncome) * 100 : 0
                return (
                  <div key={c.id} className="text-sm">
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="h-3.5 w-3.5 rounded-full" style={{ background: c.color }} />
                        <span>{c.label}</span>
                      </div>
                      <span className="tabular-nums text-slate-500 dark:text-slate-400">{pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, background: c.color }} />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-6 grid gap-3">
              <h3 className="text-base font-semibold">Category Colors</h3>
              {categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="h-3.5 w-3.5 rounded-full" style={{ background: c.color }} />
                  <span className="flex-1">{c.label}</span>
                  <input
                    className="h-10 w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-950"
                    type="color"
                    value={c.color}
                    onChange={(e) => updateCategoryColor(c.id, e.target.value)}
                    aria-label={`Update color for ${c.label}`}
                  />
                </div>
              ))}
            </div>
          </aside>

          <section className={`${panelClass} p-5`}>
            <h2 className="mb-2 text-xl font-semibold tracking-tight">Monthly View</h2>
            {visibleMonths.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">No expenses match these filters.</p>
            )}

            {visibleMonths.map((m) => {
              const list = visibleGrouped[m] ?? []
              const total = sumExpenses(list)
              return (
                <div key={m} className="mt-4 border-t border-slate-200 pt-4 first:mt-0 first:border-t-0 first:pt-0 dark:border-slate-800">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold">{m}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{list.length} entries</p>
                    </div>
                    <p className="text-lg font-semibold">{formatMoney(total)}</p>
                  </div>

                  <div className="grid gap-3">
                    {list.map((e) => {
                      const cat = categories.find((c) => c.id === e.category)
                      return (
                        <div
                          key={e.id}
                          className="flex flex-col items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-violet-200 hover:shadow-sm sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-800/50 dark:hover:border-violet-500/40"
                        >
                          <div className="flex items-center gap-3">
                            <span className="h-3.5 w-3.5 rounded-full" style={{ background: cat?.color ?? '#64748b' }} />
                            <div>
                              <p className="font-medium">{e.name}</p>
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                {e.date}
                                {e.location ? ` • ${e.location}` : ''}
                                {e.note ? ` • ${e.note}` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="w-full text-left sm:w-auto sm:text-right">
                            <p className="mb-1 font-semibold">{formatMoney(e.amount)}</p>
                            <button
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
                              onClick={() => removeExpense(e.id)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </section>
        </main>
      </div>
    </div>
  )
}
