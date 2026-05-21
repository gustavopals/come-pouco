CREATE TABLE IF NOT EXISTS affiliate_links (
  id SERIAL PRIMARY KEY,
  original_link TEXT NOT NULL,
  sub_id_1 VARCHAR(50) NULL,
  product_image TEXT NOT NULL,
  catchy_phrase VARCHAR(255) NOT NULL,
  affiliate_link TEXT NOT NULL,
  company_id INTEGER NULL REFERENCES companies(id) ON DELETE SET NULL,
  created_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS affiliate_links_company_id_created_at_idx
ON affiliate_links (company_id, created_at);

CREATE INDEX IF NOT EXISTS affiliate_links_created_by_user_id_created_at_idx
ON affiliate_links (created_by_user_id, created_at);
