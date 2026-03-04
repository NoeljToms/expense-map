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