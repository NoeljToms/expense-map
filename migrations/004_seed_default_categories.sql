INSERT INTO categories (id, label, color)
VALUES
  ('food', 'Food', '#4C9D8B'),
  ('gifts', 'Gifts', '#D47047'),
  ('bills', 'Bills', '#9C6ADE'),
  ('fun', 'Fun', '#E3A44C'),
  ('gas', 'Gas', '#5D7BD9'),
  ('transportation', 'Transportation', '#38BDF8'),
  ('subscription', 'Subscription', '#C2507C'),
  ('miscellaneous', 'Miscellaneous', '#94A3B8')
ON CONFLICT (id) DO UPDATE
SET
  label = EXCLUDED.label,
  color = EXCLUDED.color;
