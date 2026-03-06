import express from 'express'
import cors from 'cors'
import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const { Pool } = pg
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function loadLocalEnv() {
  const envPath = path.join(__dirname, '.env')
  if (!fs.existsSync(envPath)) return

  const content = fs.readFileSync(envPath, 'utf8')
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex <= 0) return

    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()
    if (!process.env[key]) process.env[key] = value
  })
}

loadLocalEnv()

const app = express()
app.use(cors())
app.use(express.json())

const isRunningInDocker = fs.existsSync('/.dockerenv')
const configuredDbHost = process.env.PGHOST || 'localhost'
const dbHost = !isRunningInDocker && configuredDbHost === 'postgres' ? 'localhost' : configuredDbHost

if (!isRunningInDocker && configuredDbHost === 'postgres') {
  console.warn('PGHOST=postgres is Docker-only. Falling back to localhost for local server run.')
}

const dbPassword = process.env.PGPASSWORD ?? ''
if (!dbPassword) {
  console.warn('PGPASSWORD is empty. Set server/.env (or shell env) to your Postgres password.')
}

const pool = new Pool({
  host: dbHost,
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'expense',
  password: dbPassword,
  database: process.env.PGDATABASE || 'expense_map',
})

const defaultCategories = [
  { id: 'food', label: 'Food', color: '#4C9D8B' },
  { id: 'gifts', label: 'Gifts', color: '#D47047' },
  { id: 'bills', label: 'Bills', color: '#9C6ADE' },
  { id: 'gas', label: 'Gas', color: '#5D7BD9' },
  { id: 'transportation', label: 'Transportation', color: '#38BDF8' },
  { id: 'subscription', label: 'Subscription', color: '#C2507C' },
  { id: 'miscellaneous', label: 'Miscellaneous', color: '#94A3B8' },
  { id: 'fun', label: 'Fun', color: '#E3A44C' },
]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

// async function initDbWithRetry(maxAttempts = 20, delayMs = 1500) {
//   for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
//     try {
//       await initDb()
//       return
//     } catch (err) {
//       if (attempt === maxAttempts) throw err
//       console.warn(`DB init attempt ${attempt}/${maxAttempts} failed, retrying in ${delayMs}ms`)
//       await sleep(delayMs)
//     }
//   }
// }

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/categories', asyncHandler(async (_req, res) => {
  const { rows } = await pool.query('SELECT id, label, color FROM categories ORDER BY label ASC')
  res.json(rows)
}))

app.put('/api/categories/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { color } = req.body
  if (!color) return res.status(400).json({ error: 'color is required' })
  await pool.query('UPDATE categories SET color = $1 WHERE id = $2', [color, id])
  const { rows } = await pool.query('SELECT id, label, color FROM categories WHERE id = $1', [id])
  res.json(rows[0])
}))

app.get('/api/expenses', asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, amount::float AS amount, category, date::text AS date, note, location FROM expenses ORDER BY date DESC, created_at DESC'
  )
  res.json(rows)
}))

app.post('/api/expenses', asyncHandler(async (req, res) => {
  const { id, name, amount, category, date, note, location } = req.body
  if (!id || !name || amount === undefined || !category || !date) {
    return res.status(400).json({ error: 'id, name, amount, category, date are required' })
  }
  await pool.query(
    'INSERT INTO expenses (id, name, amount, category, date, note, location) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [id, name, amount, category, date, note || null, location || null]
  )
  res.json({ ok: true })
}))

app.post('/api/expenses/import', async (req, res) => {
  const expenses = req.body?.expenses
  if (!Array.isArray(expenses) || expenses.length === 0) {
    return res.status(400).json({ error: 'expenses array is required' })
  }

  try {
    const values = []
    const placeholders = expenses.map((expense, i) => {
      const { id, name, amount, category, date, note, location } = expense || {}
      if (!id || !name || amount === undefined || !category || !date) {
        throw new Error('Each expense must include id, name, amount, category, date')
      }
      values.push(id, name, amount, category, date, note || null, location || null)
      const offset = i * 7
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`
    })

    await pool.query(
      `INSERT INTO expenses (id, name, amount, category, date, note, location)
       VALUES ${placeholders.join(',')}`,
      values
    )
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }

  res.json({ ok: true, inserted: expenses.length })
})

app.delete('/api/expenses/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  await pool.query('DELETE FROM expenses WHERE id = $1', [id])
  res.json({ ok: true })
}))

app.get('/api/income/:month', asyncHandler(async (req, res) => {
  const { month } = req.params
  const { rows } = await pool.query('SELECT amount::float AS amount FROM income WHERE month = $1', [month])
  res.json({ month, amount: rows[0]?.amount ?? 0 })
}))

app.put('/api/income/:month', asyncHandler(async (req, res) => {
  const { month } = req.params
  const { amount } = req.body
  if (amount === undefined) return res.status(400).json({ error: 'amount is required' })
  await pool.query(
    `INSERT INTO income (month, amount)
     VALUES ($1, $2)
     ON CONFLICT (month) DO UPDATE SET amount = EXCLUDED.amount`,
    [month, amount]
  )
  res.json({ month, amount })
}))

app.use((err, _req, res, _next) => {
  console.error(err)
  const message = err instanceof Error ? err.message : 'Internal server error'
  res.status(500).json({ error: message })
})

const port = Number(process.env.PORT || 3000)
app.listen(port, () => {
      console.log(`API listening on ${port}`)
    })
