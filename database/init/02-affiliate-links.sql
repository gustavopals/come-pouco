CREATE TABLE IF NOT EXISTS affiliate_links (
  id SERIAL PRIMARY KEY,
  original_link TEXT NOT NULL,
  product_image TEXT NOT NULL,
  catchy_phrase VARCHAR(255) NOT NULL,
  affiliate_link TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
