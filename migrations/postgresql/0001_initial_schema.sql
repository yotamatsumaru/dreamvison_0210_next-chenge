-- PostgreSQL migration for streaming platform
-- Converted from Cloudflare D1 (SQLite) schema

-- Artists table
CREATE TABLE IF NOT EXISTS artists (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Events table (live events or archived content)
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  artist_id INT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  
  -- Event type: 'live' or 'archive'
  event_type TEXT NOT NULL DEFAULT 'live',
  
  -- Streaming URLs (CloudFront or MediaPackage endpoints)
  stream_url TEXT,
  archive_url TEXT,
  
  -- CloudFront key pair ID for signed URLs
  cloudfront_key_pair_id TEXT,
  
  -- Schedule
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  
  -- Status: 'upcoming', 'live', 'ended', 'archived'
  status TEXT NOT NULL DEFAULT 'upcoming',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);

-- Tickets table (price tiers for events)
CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  event_id INT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price INT NOT NULL, -- Price in cents (e.g., 5000 = ¥5000)
  currency TEXT NOT NULL DEFAULT 'jpy',
  
  -- Stripe product/price IDs
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  
  -- Availability
  stock INT, -- NULL = unlimited
  sold_count INT DEFAULT 0,
  
  -- Sale period
  sale_start TIMESTAMP,
  sale_end TIMESTAMP,
  
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Purchases table (ticket purchase records)
CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  event_id INT NOT NULL,
  ticket_id INT NOT NULL,
  
  -- Customer info (from Stripe)
  stripe_customer_id TEXT NOT NULL,
  stripe_checkout_session_id TEXT UNIQUE NOT NULL,
  stripe_payment_intent_id TEXT,
  
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  
  -- Payment info
  amount INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'jpy',
  
  -- Status: 'pending', 'completed', 'refunded', 'cancelled'
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- Access token for viewing (JWT or random token)
  access_token TEXT UNIQUE,
  
  -- Token expiry (for time-limited access)
  access_expires_at TIMESTAMP,
  
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

-- Admin users table (simple auth for content management)
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, -- bcrypt hash
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_artist_id ON events(artist_id);
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_tickets_event_id ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_purchases_event_id ON purchases(event_id);
CREATE INDEX IF NOT EXISTS idx_purchases_stripe_customer ON purchases(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_purchases_access_token ON purchases(access_token);
CREATE INDEX IF NOT EXISTS idx_artists_slug ON artists(slug);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for automatic updated_at updates
CREATE TRIGGER update_artists_updated_at BEFORE UPDATE ON artists
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
