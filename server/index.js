import express from 'express'
import cors from 'cors'
import pg from 'pg'

const { Pool } = pg

const app = express()
app.use(cors())
app.use(express.json())

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'expense',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'expense_map',
})

const defaultCategories = [
  { id: 'groceries', label: 'Groceries', color: '#4C9D8B' },
  { id: 'dining', label: 'Dining', color: '#D47047' },
  { id: 'transport', label: 'Transport', color: '#5D7BD9' },
  { id: 'bills', label: 'Bills', color: '#9C6ADE' },
  { id: 'health', label: 'Health', color: '#C2507C' },
  { id: 'fun', label: 'Fun', color: '#E3A44C' },
]

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      color TEXT NOT NULL
    );
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL,
      category TEXT NOT NULL REFERENCES categories(id),
      date DATE NOT NULL,
      note TEXT,
      location TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS income (
      month TEXT PRIMARY KEY,
      amount NUMERIC(12,2) NOT NULL
    );
  `)

  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM categories')
  if (rows[0].count === 0) {
    const values = defaultCategories.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(',')
    const params = defaultCategories.flatMap((c) => [c.id, c.label, c.color])
    await pool.query(`INSERT INTO categories (id, label, color) VALUES ${values}`, params)
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function initDbWithRetry(maxAttempts = 20, delayMs = 1500) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await initDb()
      return
    } catch (err) {
      if (attempt === maxAttempts) throw err
      console.warn(`DB init attempt ${attempt}/${maxAttempts} failed, retrying in ${delayMs}ms`)
      await sleep(delayMs)
    }
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/categories', async (_req, res) => {
  const { rows } = await pool.query('SELECT id, label, color FROM categories ORDER BY label ASC')
  res.json(rows)
})

app.put('/api/categories/:id', async (req, res) => {
  const { id } = req.params
  const { color } = req.body
  if (!color) return res.status(400).json({ error: 'color is required' })
  await pool.query('UPDATE categories SET color = $1 WHERE id = $2', [color, id])
  const { rows } = await pool.query('SELECT id, label, color FROM categories WHERE id = $1', [id])
  res.json(rows[0])
})

app.get('/api/expenses', async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, amount::float AS amount, category, date::text AS date, note, location FROM expenses ORDER BY date DESC, created_at DESC'
  )
  res.json(rows)
})

app.post('/api/expenses', async (req, res) => {
  const { id, name, amount, category, date, note, location } = req.body
  if (!id || !name || !amount || !category || !date) {
    return res.status(400).json({ error: 'id, name, amount, category, date are required' })
  }
  await pool.query(
    'INSERT INTO expenses (id, name, amount, category, date, note, location) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [id, name, amount, category, date, note || null, location || null]
  )
  res.json({ ok: true })
})

app.delete('/api/expenses/:id', async (req, res) => {
  const { id } = req.params
  await pool.query('DELETE FROM expenses WHERE id = $1', [id])
  res.json({ ok: true })
})

app.get('/api/income/:month', async (req, res) => {
  const { month } = req.params
  const { rows } = await pool.query('SELECT amount::float AS amount FROM income WHERE month = $1', [month])
  res.json({ month, amount: rows[0]?.amount ?? 0 })
})

app.put('/api/income/:month', async (req, res) => {
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
})

const port = Number(process.env.PORT || 3000)

initDbWithRetry()
  .then(() => {
    app.listen(port, () => {
      console.log(`API listening on ${port}`)
    })
  })
  .catch((err) => {
    console.error('Failed to init DB', err)
    process.exit(1)
  })
