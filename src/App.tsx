import { useEffect, useMemo, useState } from 'react'
import {
  createExpense,
  createExpenses,
  deleteExpense,
  fetchAllIncome,
  fetchCategories,
  fetchExpenses,
  saveIncome,
  updateCategoryColor as apiUpdateCategoryColor,
} from './api'
import { parseExpenseCsv } from './csvImport'
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

function contrastText(hexColor: string) {
  const hex = hexColor.replace('#', '')
  if (hex.length !== 6) return '#0f172a'
  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return '#0f172a'
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance > 0.62 ? '#0f172a' : '#f8fafc'
}

export default function App() {
  const [theme, setTheme] = useState<Theme>('light')
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [incomeByMonth, setIncomeByMonth] = useState<Record<MonthKey, number>>({})
  const [draft, setDraft] = useState<Expense>(() => blankExpense())
  const [filterMonth, setFilterMonth] = useState<MonthKey | 'all'>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importStatus, setImportStatus] = useState<string>('')
  const [isImporting, setIsImporting] = useState(false)
  const [importPreview, setImportPreview] = useState<Expense[]>([])
  const [importReviewIndex, setImportReviewIndex] = useState(0)
  const [importSkippedRows, setImportSkippedRows] = useState(0)
  const [isReviewConfirmStep, setIsReviewConfirmStep] = useState(false)

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
  const reviewingExpense = importPreview[importReviewIndex]
  const isOnLastReviewItem = importReviewIndex >= importPreview.length - 1

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

  async function beginImportReviewFromCsv() {
    if (!importFile || categories.length === 0) return
    setIsImporting(true)
    setImportStatus('')

    try {
      const text = await importFile.text()
      const { expenses: parsedExpenses, skippedRows } = parseExpenseCsv(text, categories)
      if (parsedExpenses.length === 0) {
        setImportStatus(`Found 0 importable expenses. Skipped ${skippedRows} rows.`)
        return
      }

      setImportPreview(parsedExpenses)
      setImportReviewIndex(0)
      setImportSkippedRows(skippedRows)
      setIsReviewConfirmStep(false)
      setImportStatus(`Review ${parsedExpenses.length} expenses, then confirm import.`)
      setImportFile(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed'
      setImportStatus(message)
    } finally {
      setIsImporting(false)
    }
  }

  function updateReviewCategory(category: string) {
    setImportPreview((prev) => prev.map((expense, index) => (index === importReviewIndex ? { ...expense, category } : expense)))
  }

  function moveReview(delta: number) {
    setIsReviewConfirmStep(false)
    setImportReviewIndex((prev) => {
      const next = prev + delta
      if (next < 0) return 0
      if (next >= importPreview.length) return importPreview.length - 1
      return next
    })
  }

  function cancelImportReview() {
    setImportPreview([])
    setImportReviewIndex(0)
    setImportSkippedRows(0)
    setIsReviewConfirmStep(false)
    setImportStatus('CSV review canceled.')
  }

  async function confirmReviewedImport() {
    if (importPreview.length === 0) return
    setIsImporting(true)
    try {
      await createExpenses(importPreview)
      setExpenses((prev) => [...importPreview, ...prev])
      setImportStatus(`Imported ${importPreview.length} expenses. Skipped ${importSkippedRows} rows.`)
      setImportPreview([])
      setImportReviewIndex(0)
      setImportSkippedRows(0)
      setIsReviewConfirmStep(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed'
      setImportStatus(message)
    } finally {
      setIsImporting(false)
    }
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
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              className="block text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700 dark:text-slate-200 dark:file:bg-slate-100 dark:file:text-slate-900 dark:hover:file:bg-slate-300"
              type="file"
              accept=".csv,text/csv"
              disabled={isImporting || importPreview.length > 0}
              onChange={(e) => {
                setImportStatus('')
                setImportFile(e.target.files?.[0] ?? null)
              }}
            />
            <button
              className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={beginImportReviewFromCsv}
              disabled={!importFile || isImporting || importPreview.length > 0}
            >
              {isImporting ? 'Reading...' : 'Review CSV'}
            </button>
            {importStatus && <p className="text-sm text-slate-600 dark:text-slate-300">{importStatus}</p>}
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
      {reviewingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
          <button
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
            aria-label="Close review"
            onClick={cancelImportReview}
          />
          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 shadow-[0_28px_100px_-36px_rgba(2,6,23,0.85)] dark:border-slate-700 dark:bg-slate-900/95">
            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">CSV Review</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {isReviewConfirmStep
                      ? `Final confirmation for ${importPreview.length} expenses`
                      : `Entry ${importReviewIndex + 1} of ${importPreview.length}`}
                  </p>
                </div>
                <button
                  className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  onClick={cancelImportReview}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {!isReviewConfirmStep && (
                <>
                  <div className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                    <div>
                      <p className="text-xs uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">Description</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{reviewingExpense.name}</p>
                    </div>
                    <div className="grid gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-3">
                      <p>{reviewingExpense.date}</p>
                      <p>{formatMoney(reviewingExpense.amount)}</p>
                      <p className="truncate">{reviewingExpense.location || 'No location'}</p>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">Choose Category</p>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((c) => {
                        const isSelected = reviewingExpense.category === c.id
                        return (
                          <button
                            key={c.id}
                            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${isSelected ? 'shadow-sm ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900' : 'bg-white text-slate-700 hover:-translate-y-0.5 dark:bg-slate-900 dark:text-slate-200'}`}
                            style={{
                              borderColor: c.color,
                              background: isSelected ? c.color : undefined,
                              color: isSelected ? contrastText(c.color) : undefined,
                              boxShadow: isSelected ? `0 0 0 2px ${c.color}55` : undefined,
                            }}
                            onClick={() => updateReviewCategory(c.id)}
                          >
                            {c.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}

              {isReviewConfirmStep && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                  <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Ready to import</p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    You reviewed {importPreview.length} expenses. Skipped rows: {importSkippedRows}.
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Click confirm to add all reviewed entries at once.</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
              <button
                className="h-10 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-700 transition hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-300 dark:hover:bg-rose-900/30"
                onClick={cancelImportReview}
                disabled={isImporting}
              >
                Cancel
              </button>
              <div className="flex flex-wrap gap-2">
                {!isReviewConfirmStep && (
                  <>
                    <button
                      className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      onClick={() => moveReview(-1)}
                      disabled={importReviewIndex === 0}
                    >
                      Previous
                    </button>
                    {!isOnLastReviewItem && (
                      <button
                        className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        onClick={() => moveReview(1)}
                      >
                        Next
                      </button>
                    )}
                    {isOnLastReviewItem && (
                      <button
                        className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
                        onClick={() => setIsReviewConfirmStep(true)}
                      >
                        Final Review
                      </button>
                    )}
                  </>
                )}
                {isReviewConfirmStep && (
                  <>
                    <button
                      className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      onClick={() => setIsReviewConfirmStep(false)}
                      disabled={isImporting}
                    >
                      Back
                    </button>
                    <button
                      className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
                      onClick={confirmReviewedImport}
                      disabled={isImporting}
                    >
                      {isImporting ? 'Importing...' : `Confirm and Add ${importPreview.length}`}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
