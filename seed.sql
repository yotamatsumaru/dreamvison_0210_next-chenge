-- Insert sample artists
INSERT OR IGNORE INTO artists (id, name, slug, description, image_url) VALUES 
  (3, 'REIRIE', 'reirie', 'REIRIEのアーティストページ', 'https://via.placeholder.com/400x400'),
  (4, 'みことね', 'mikotone', 'みことねのアーティストページ', 'https://via.placeholder.com/400x400');

-- Insert REIRIE live events
INSERT OR IGNORE INTO events (artist_id, title, slug, description, thumbnail_url, event_type, stream_url, status, start_time, end_time) VALUES 
  (3, 'REIRIE LIVE 2026 - 千葉LOOK', 'reirie-2026-chiba-look', '2026年2月1日(日) [千葉]千葉LOOK
開場 16:00／開演 17:00', 'https://via.placeholder.com/800x450', 'live', 'https://example.cloudfront.net/live/reirie-chiba.m3u8', 'upcoming', '2026-02-01 17:00:00', '2026-02-01 19:00:00'),
  (3, 'REIRIE LIVE 2026 - 広島CAVE-BE', 'reirie-2026-hiroshima-cave-be', '2026年2月7日(土) [広島]広島CAVE-BE
開場 16:00／開演 17:00', 'https://via.placeholder.com/800x450', 'live', 'https://example.cloudfront.net/live/reirie-hiroshima.m3u8', 'upcoming', '2026-02-07 17:00:00', '2026-02-07 19:00:00'),
  (3, 'REIRIE LIVE 2026 - music zoo KOBE太陽と虎', 'reirie-2026-kobe-taiyotora', '2026年2月8日(日) [兵庫]music zoo KOBE太陽と虎
開場 16:00／開演 17:00', 'https://via.placeholder.com/800x450', 'live', 'https://example.cloudfront.net/live/reirie-kobe.m3u8', 'upcoming', '2026-02-08 17:00:00', '2026-02-08 19:00:00'),
  (3, 'REIRIE LIVE 2026 - HEAVEN''S ROCKさいたま新都心VJ-3', 'reirie-2026-saitama-vj3', '2026年2月15日(日) [埼玉]HEAVEN''S ROCKさいたま新都心VJ-3
開場 16:00／開演 17:00', 'https://via.placeholder.com/800x450', 'live', 'https://example.cloudfront.net/live/reirie-saitama.m3u8', 'upcoming', '2026-02-15 17:00:00', '2026-02-15 19:00:00'),
  (3, 'REIRIE LIVE 2026 - F.A.D. YOKOHAMA', 'reirie-2026-fad-yokohama', '2026年2月23日(月祝) [神奈川]F.A.D. YOKOHAMA
開場 16:00／開演 17:00', 'https://via.placeholder.com/800x450', 'live', 'https://example.cloudfront.net/live/reirie-yokohama.m3u8', 'upcoming', '2026-02-23 17:00:00', '2026-02-23 19:00:00'),
  (3, 'REIRIE LIVE 2026 - KYOTO MUSE', 'reirie-2026-kyoto-muse', '2026年2月28日(土) [京都]KYOTO MUSE
開場 16:00／開演 17:00', 'https://via.placeholder.com/800x450', 'live', 'https://example.cloudfront.net/live/reirie-kyoto.m3u8', 'upcoming', '2026-02-28 17:00:00', '2026-02-28 19:00:00'),
  (3, 'REIRIE LIVE 2026 - OSAKA MUSE', 'reirie-2026-osaka-muse', '2026年3月1日(日) [大阪]OSAKA MUSE
開場 16:00／開演 17:00', 'https://via.placeholder.com/800x450', 'live', 'https://example.cloudfront.net/live/reirie-osaka.m3u8', 'upcoming', '2026-03-01 17:00:00', '2026-03-01 19:00:00'),
  (3, 'REIRIE LIVE 2026 - LIVE HOUSE enn 2nd', 'reirie-2026-miyagi-enn', '2026年3月8日(日) [宮城]LIVE HOUSE enn 2nd
開場 16:00／開演 17:00', 'https://via.placeholder.com/800x450', 'live', 'https://example.cloudfront.net/live/reirie-miyagi.m3u8', 'upcoming', '2026-03-08 17:00:00', '2026-03-08 19:00:00'),
  (3, 'REIRIE LIVE 2026 - ell.FITS ALL', 'reirie-2026-aichi-ell', '2026年3月13日(金) [愛知]ell.FITS ALL
開場 17:00／開演 18:00', 'https://via.placeholder.com/800x450', 'live', 'https://example.cloudfront.net/live/reirie-aichi.m3u8', 'upcoming', '2026-03-13 18:00:00', '2026-03-13 20:00:00'),
  (3, 'REIRIE LIVE 2026 - HEAVEN''S ROCK Utsunomiya VJ-2', 'reirie-2026-tochigi-vj2', '2026年3月15日(日) [栃木]HEAVEN''S ROCK Utsunomiya VJ-2
開場 16:00／開演 17:00', 'https://via.placeholder.com/800x450', 'live', 'https://example.cloudfront.net/live/reirie-tochigi.m3u8', 'upcoming', '2026-03-15 17:00:00', '2026-03-15 19:00:00'),
  (3, 'REIRIE LIVE 2026 - 福岡DRUM SON', 'reirie-2026-fukuoka-drum', '2026年3月21日(土) [福岡]福岡DRUM SON
開場 16:00／開演 17:00', 'https://via.placeholder.com/800x450', 'live', 'https://example.cloudfront.net/live/reirie-fukuoka.m3u8', 'upcoming', '2026-03-21 17:00:00', '2026-03-21 19:00:00'),
  (3, 'REIRIE LIVE 2026 - 渋谷CLUB QUATTRO', 'reirie-2026-shibuya-quattro', '2026年3月31日(火) [東京]渋谷CLUB QUATTRO
開場 17:00／開演 18:00', 'https://via.placeholder.com/800x450', 'live', 'https://example.cloudfront.net/live/reirie-shibuya.m3u8', 'upcoming', '2026-03-31 18:00:00', '2026-03-31 20:00:00');

-- Insert みことね event
INSERT OR IGNORE INTO events (artist_id, title, slug, description, thumbnail_url, event_type, stream_url, status, start_time, end_time) VALUES 
  (4, 'みことね - The SOUND of LOVE', 'mikotone-2026-sound-of-love', '2026年2月15日(日) 17:00～
The SOUND of LOVE', 'https://via.placeholder.com/800x450', 'live', 'https://example.cloudfront.net/live/mikotone-soundoflove.m3u8', 'upcoming', '2026-02-15 17:00:00', '2026-02-15 19:00:00');

-- Insert sample tickets (一般チケット for all events)
INSERT OR IGNORE INTO tickets (event_id, name, description, price, currency, stock) 
SELECT id, '一般チケット', 'ライブ配信視聴チケット', 3000, 'jpy', NULL FROM events;

-- Insert admin user (password: admin123 - bcrypt hash)
-- Note: This is a sample hash, you should generate a new one for production
INSERT OR IGNORE INTO admins (username, password_hash) VALUES 
  ('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
