import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import type { Bindings } from './types';

// Import routes
import stripeRoutes from './routes/stripe';
import eventsRoutes from './routes/events';
import artistsRoutes from './routes/artists';
import watchRoutes from './routes/watch';
import adminRoutes from './routes/admin';

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS for API routes
app.use('/api/*', cors());

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }));

// API routes
app.route('/api/stripe', stripeRoutes);
app.route('/api/events', eventsRoutes);
app.route('/api/artists', artistsRoutes);
app.route('/api/watch', watchRoutes);
app.route('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Home page
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ライブ配信・ストリーミングプラットフォーム</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 min-h-screen">
        <nav class="bg-black bg-opacity-50 backdrop-blur-md border-b border-gray-800 sticky top-0 z-50">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16 items-center">
                    <div class="flex items-center">
                        <i class="fas fa-broadcast-tower text-purple-500 text-2xl mr-3"></i>
                        <a href="/" class="text-white text-xl font-bold hover:text-purple-400 transition">StreamingPlatform</a>
                    </div>
                    
                    <!-- Desktop Navigation -->
                    <div class="hidden md:flex space-x-4">
                        <a href="/" class="text-white px-3 py-2 hover:text-purple-400 transition">ホーム</a>
                        <a href="/artists" class="text-gray-300 hover:text-white px-3 py-2 transition">アーティスト</a>
                        <a href="/events" class="text-gray-300 hover:text-white px-3 py-2 transition">イベント</a>
                    </div>
                    
                    <!-- Mobile Menu Button -->
                    <button id="mobile-menu-button" onclick="toggleMobileMenu()" class="md:hidden text-white p-2 hover:text-purple-400 transition">
                        <i id="hamburger-icon" class="fas fa-bars text-2xl"></i>
                        <i id="close-icon" class="fas fa-times text-2xl hidden"></i>
                    </button>
                </div>
            </div>
            
            <!-- Mobile Navigation -->
            <div id="mobile-menu" class="hidden md:hidden bg-black bg-opacity-95 border-t border-gray-800">
                <div class="px-4 py-3 space-y-1">
                    <a href="/" class="block text-white px-3 py-2 rounded hover:bg-purple-600 transition">
                        <i class="fas fa-home mr-2"></i>ホーム
                    </a>
                    <a href="/artists" class="block text-gray-300 hover:text-white px-3 py-2 rounded hover:bg-gray-800 transition">
                        <i class="fas fa-users mr-2"></i>アーティスト
                    </a>
                    <a href="/events" class="block text-gray-300 hover:text-white px-3 py-2 rounded hover:bg-gray-800 transition">
                        <i class="fas fa-calendar-alt mr-2"></i>イベント
                    </a>
                </div>
            </div>
        </nav>
        
        <script src="/static/nav.js"></script>

        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div class="text-center mb-16">
                <h1 class="text-5xl font-bold text-white mb-4">
                    ライブ配信・ストリーミング<br>プラットフォーム
                </h1>
                <p class="text-xl text-gray-300 mb-8">
                    お気に入りのアーティストのライブをどこでも視聴
                </p>
                <div class="flex justify-center space-x-4">
                    <a href="/events" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg transition">
                        <i class="fas fa-calendar-alt mr-2"></i>
                        イベント一覧
                    </a>
                    <a href="/artists" class="bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 px-8 rounded-lg transition">
                        <i class="fas fa-users mr-2"></i>
                        アーティスト一覧
                    </a>
                </div>
            </div>

            <div id="upcoming-events" class="mb-12">
                <h2 class="text-3xl font-bold text-white mb-6">
                    <i class="fas fa-fire text-orange-500 mr-2"></i>
                    今後のライブ
                </h2>
                <div id="events-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div class="text-center text-gray-400 py-8">
                        <i class="fas fa-spinner fa-spin text-4xl mb-2"></i>
                        <p>読み込み中...</p>
                    </div>
                </div>
            </div>

            <div class="bg-black bg-opacity-40 backdrop-blur-md rounded-xl p-8 border border-gray-800">
                <h2 class="text-2xl font-bold text-white mb-4">
                    <i class="fas fa-info-circle text-blue-500 mr-2"></i>
                    プラットフォームについて
                </h2>
                <div class="grid md:grid-cols-3 gap-6 text-gray-300">
                    <div>
                        <i class="fas fa-video text-purple-500 text-3xl mb-2"></i>
                        <h3 class="font-bold text-white mb-2">高品質配信</h3>
                        <p>AWS + CloudFrontによる安定した配信</p>
                    </div>
                    <div>
                        <i class="fas fa-lock text-purple-500 text-3xl mb-2"></i>
                        <h3 class="font-bold text-white mb-2">セキュア</h3>
                        <p>DRM保護と署名付きURL</p>
                    </div>
                    <div>
                        <i class="fas fa-credit-card text-purple-500 text-3xl mb-2"></i>
                        <h3 class="font-bold text-white mb-2">簡単決済</h3>
                        <p>Stripeによる安全な決済</p>
                    </div>
                </div>
            </div>
        </main>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            // Load upcoming events
            async function loadEvents() {
                try {
                    const response = await axios.get('/api/events?status=upcoming');
                    const events = response.data;
                    
                    const eventsContainer = document.getElementById('events-list');
                    
                    if (events.length === 0) {
                        eventsContainer.innerHTML = \`
                            <div class="col-span-full text-center text-gray-400 py-8">
                                <i class="fas fa-calendar-times text-4xl mb-2"></i>
                                <p>現在、予定されているライブはありません</p>
                            </div>
                        \`;
                        return;
                    }
                    
                    eventsContainer.innerHTML = events.map(event => \`
                        <a href="/events/\${event.slug}" class="block bg-black bg-opacity-40 backdrop-blur-md rounded-xl overflow-hidden border border-gray-800 hover:border-purple-500 transition">
                            <div class="aspect-video bg-gray-800 relative">
                                <img src="\${event.thumbnail_url || 'https://via.placeholder.com/800x450'}" 
                                     alt="\${event.title}" 
                                     class="w-full h-full object-cover">
                                <div class="absolute top-2 right-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                                    <i class="fas fa-circle animate-pulse mr-1"></i>
                                    UPCOMING
                                </div>
                            </div>
                            <div class="p-4">
                                <h3 class="text-white font-bold text-lg mb-2">\${event.title}</h3>
                                <p class="text-gray-400 text-sm mb-2">
                                    <i class="fas fa-clock mr-1"></i>
                                    \${event.start_time ? new Date(event.start_time).toLocaleString('ja-JP') : '日時未定'}
                                </p>
                                <p class="text-gray-500 text-sm line-clamp-2">\${event.description || ''}</p>
                            </div>
                        </a>
                    \`).join('');
                } catch (error) {
                    console.error('Failed to load events:', error);
                    document.getElementById('events-list').innerHTML = \`
                        <div class="col-span-full text-center text-red-400 py-8">
                            <i class="fas fa-exclamation-triangle text-4xl mb-2"></i>
                            <p>イベントの読み込みに失敗しました</p>
                        </div>
                    \`;
                }
            }
            
            loadEvents();
        </script>
    </body>
    </html>
  `);
});

// Events listing page
app.get('/events', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>イベント一覧 - StreamingPlatform</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 min-h-screen">
        <nav class="bg-black bg-opacity-50 backdrop-blur-md border-b border-gray-800 sticky top-0 z-50">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16 items-center">
                    <div class="flex items-center">
                        <i class="fas fa-broadcast-tower text-purple-500 text-2xl mr-3"></i>
                        <a href="/" class="text-white text-xl font-bold hover:text-purple-400 transition">StreamingPlatform</a>
                    </div>
                    <div class="hidden md:flex space-x-4">
                        <a href="/" class="text-gray-300 hover:text-white px-3 py-2 transition">ホーム</a>
                        <a href="/artists" class="text-gray-300 hover:text-white px-3 py-2 transition">アーティスト</a>
                        <a href="/events" class="text-white px-3 py-2 transition">イベント</a>
                    </div>
                    <button id="mobile-menu-button" onclick="toggleMobileMenu()" class="md:hidden text-white p-2 hover:text-purple-400 transition">
                        <i id="hamburger-icon" class="fas fa-bars text-2xl"></i>
                        <i id="close-icon" class="fas fa-times text-2xl hidden"></i>
                    </button>
                </div>
            </div>
            <div id="mobile-menu" class="hidden md:hidden bg-black bg-opacity-95 border-t border-gray-800">
                <div class="px-4 py-3 space-y-1">
                    <a href="/" class="block text-gray-300 px-3 py-2 rounded hover:bg-gray-800 hover:text-white transition"><i class="fas fa-home mr-2"></i>ホーム</a>
                    <a href="/artists" class="block text-gray-300 px-3 py-2 rounded hover:bg-gray-800 hover:text-white transition"><i class="fas fa-users mr-2"></i>アーティスト</a>
                    <a href="/events" class="block text-white bg-purple-600 px-3 py-2 rounded transition"><i class="fas fa-calendar-alt mr-2"></i>イベント</a>
                </div>
            </div>
        </nav>
        <script src="/static/nav.js"></script>

        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div class="mb-8">
                <h1 class="text-4xl font-bold text-white mb-4">
                    <i class="fas fa-calendar-alt text-purple-500 mr-2"></i>
                    イベント一覧
                </h1>
                <div class="flex space-x-4">
                    <button onclick="filterEvents('all')" class="filter-btn active bg-purple-600 text-white px-4 py-2 rounded-lg">すべて</button>
                    <button onclick="filterEvents('upcoming')" class="filter-btn bg-gray-800 text-white px-4 py-2 rounded-lg">今後のライブ</button>
                    <button onclick="filterEvents('archived')" class="filter-btn bg-gray-800 text-white px-4 py-2 rounded-lg">アーカイブ</button>
                </div>
            </div>

            <div id="events-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div class="text-center text-gray-400 py-8">
                    <i class="fas fa-spinner fa-spin text-4xl mb-2"></i>
                    <p>読み込み中...</p>
                </div>
            </div>
        </main>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/events.js"></script>
    </body>
    </html>
  `);
});

// Single event page (will be implemented with ticket purchase UI)
app.get('/events/:slug', async (c) => {
  const slug = c.req.param('slug');
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>イベント詳細 - StreamingPlatform</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://js.stripe.com/v3/"></script>
    </head>
    <body class="bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 min-h-screen">
        <nav class="bg-black bg-opacity-50 backdrop-blur-md border-b border-gray-800">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16 items-center">
                    <div class="flex items-center">
                        <i class="fas fa-broadcast-tower text-purple-500 text-2xl mr-3"></i>
                        <a href="/" class="text-white text-xl font-bold">StreamingPlatform</a>
                    </div>
                    <div class="flex space-x-4">
                        <a href="/" class="text-gray-300 hover:text-white px-3 py-2">ホーム</a>
                        <a href="/artists" class="text-gray-300 hover:text-white px-3 py-2">アーティスト</a>
                        <a href="/events" class="text-gray-300 hover:text-white px-3 py-2">イベント</a>
                    </div>
                </div>
            </div>
        </nav>

        <main class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div id="event-detail">
                <div class="text-center text-gray-400 py-8">
                    <i class="fas fa-spinner fa-spin text-4xl mb-2"></i>
                    <p>読み込み中...</p>
                </div>
            </div>
        </main>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            const eventSlug = '${slug}';
        </script>
        <script src="/static/event-detail.js"></script>
    </body>
    </html>
  `);
});

// Artists listing page
app.get('/artists', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>アーティスト一覧 - StreamingPlatform</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 min-h-screen">
        <nav class="bg-black bg-opacity-50 backdrop-blur-md border-b border-gray-800">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16 items-center">
                    <div class="flex items-center">
                        <i class="fas fa-broadcast-tower text-purple-500 text-2xl mr-3"></i>
                        <a href="/" class="text-white text-xl font-bold">StreamingPlatform</a>
                    </div>
                    <div class="flex space-x-4">
                        <a href="/" class="text-gray-300 hover:text-white px-3 py-2">ホーム</a>
                        <a href="/artists" class="text-white px-3 py-2">アーティスト</a>
                        <a href="/events" class="text-gray-300 hover:text-white px-3 py-2">イベント</a>
                    </div>
                </div>
            </div>
        </nav>

        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h1 class="text-4xl font-bold text-white mb-8">
                <i class="fas fa-users text-purple-500 mr-2"></i>
                アーティスト一覧
            </h1>

            <div id="artists-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div class="text-center text-gray-400 py-8">
                    <i class="fas fa-spinner fa-spin text-4xl mb-2"></i>
                    <p>読み込み中...</p>
                </div>
            </div>
        </main>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/artists.js"></script>
    </body>
    </html>
  `);
});

// Artist detail page
app.get('/artists/:slug', (c) => {
  const slug = c.req.param('slug');
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>アーティスト詳細 - StreamingPlatform</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 min-h-screen">
        <nav class="bg-black bg-opacity-50 backdrop-blur-md border-b border-gray-800">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16 items-center">
                    <div class="flex items-center">
                        <i class="fas fa-broadcast-tower text-purple-500 text-2xl mr-3"></i>
                        <a href="/" class="text-white text-xl font-bold">StreamingPlatform</a>
                    </div>
                    <div class="flex space-x-4">
                        <a href="/" class="text-gray-300 hover:text-white px-3 py-2">ホーム</a>
                        <a href="/artists" class="text-gray-300 hover:text-white px-3 py-2">アーティスト</a>
                        <a href="/events" class="text-gray-300 hover:text-white px-3 py-2">イベント</a>
                    </div>
                </div>
            </div>
        </nav>

        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div id="artist-detail">
                <div class="text-center text-gray-400 py-8">
                    <i class="fas fa-spinner fa-spin text-4xl mb-2"></i>
                    <p>読み込み中...</p>
                </div>
            </div>
        </main>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            const artistSlug = '${slug}';
        </script>
        <script src="/static/artist-detail.js"></script>
    </body>
    </html>
  `);
});

// Watch page (video player)
app.get('/watch/:eventSlug', (c) => {
  const eventSlug = c.req.param('eventSlug');
  const token = c.req.query('token');
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>視聴ページ - StreamingPlatform</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-black min-h-screen">
        <div id="watch-container">
            <div class="text-center text-gray-400 py-8">
                <i class="fas fa-spinner fa-spin text-4xl mb-2"></i>
                <p>読み込み中...</p>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
        <script>
            const eventSlug = '${eventSlug}';
            const accessToken = '${token || ''}';
        </script>
        <script src="/static/watch.js"></script>
    </body>
    </html>
  `);
});

// Success page (after Stripe checkout)
app.get('/success', (c) => {
  const sessionId = c.req.query('session_id');
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>購入完了 - StreamingPlatform</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 min-h-screen">
        <nav class="bg-black bg-opacity-50 backdrop-blur-md border-b border-gray-800">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16 items-center">
                    <div class="flex items-center">
                        <i class="fas fa-broadcast-tower text-purple-500 text-2xl mr-3"></i>
                        <a href="/" class="text-white text-xl font-bold">StreamingPlatform</a>
                    </div>
                </div>
            </div>
        </nav>

        <main class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div id="success-content">
                <div class="text-center text-gray-400 py-8">
                    <i class="fas fa-spinner fa-spin text-4xl mb-2"></i>
                    <p>処理中...</p>
                </div>
            </div>
        </main>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            const sessionId = '${sessionId || ''}';
        </script>
        <script src="/static/success.js"></script>
    </body>
    </html>
  `);
});

// Admin panel
app.get('/admin', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>管理画面 - StreamingPlatform</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 min-h-screen">
        <nav class="bg-black bg-opacity-50 backdrop-blur-md border-b border-gray-800">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16 items-center">
                    <div class="flex items-center">
                        <i class="fas fa-broadcast-tower text-purple-500 text-2xl mr-3"></i>
                        <a href="/" class="text-white text-xl font-bold">StreamingPlatform</a>
                        <span class="ml-4 text-sm text-gray-400">管理画面</span>
                    </div>
                    <div class="flex items-center space-x-4">
                        <a href="/" class="text-gray-300 hover:text-white px-3 py-2">
                            <i class="fas fa-home mr-1"></i>ホーム
                        </a>
                        <button id="logout-btn" class="text-red-400 hover:text-red-300 px-3 py-2">
                            <i class="fas fa-sign-out-alt mr-1"></i>ログアウト
                        </button>
                    </div>
                </div>
            </div>
        </nav>

        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div id="login-section" class="hidden">
                <div class="max-w-md mx-auto bg-black bg-opacity-40 backdrop-blur-md rounded-xl p-8 border border-gray-800">
                    <h2 class="text-2xl font-bold text-white mb-6 text-center">
                        <i class="fas fa-lock mr-2"></i>管理者ログイン
                    </h2>
                    <form id="login-form" class="space-y-4">
                        <div>
                            <label class="block text-gray-300 mb-2">ユーザー名</label>
                            <input type="text" id="username" class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none" required>
                        </div>
                        <div>
                            <label class="block text-gray-300 mb-2">パスワード</label>
                            <input type="password" id="password" class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none" required>
                        </div>
                        <button type="submit" class="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition">
                            <i class="fas fa-sign-in-alt mr-2"></i>ログイン
                        </button>
                    </form>
                    <div id="login-error" class="hidden mt-4 p-3 bg-red-900 bg-opacity-20 border border-red-800 rounded text-red-400 text-sm"></div>
                </div>
            </div>

            <div id="admin-content" class="hidden">
                <div class="mb-8">
                    <h1 class="text-4xl font-bold text-white mb-4">
                        <i class="fas fa-tachometer-alt text-purple-500 mr-2"></i>
                        管理ダッシュボード
                    </h1>
                </div>

                <!-- Tabs -->
                <div class="mb-6 border-b border-gray-800">
                    <nav class="flex space-x-4">
                        <button onclick="switchTab('stats')" class="tab-btn active px-4 py-2 text-white border-b-2 border-purple-500">
                            <i class="fas fa-chart-line mr-2"></i>統計
                        </button>
                        <button onclick="switchTab('events')" class="tab-btn px-4 py-2 text-gray-400 hover:text-white border-b-2 border-transparent">
                            <i class="fas fa-calendar-alt mr-2"></i>イベント管理
                        </button>
                        <button onclick="switchTab('artists')" class="tab-btn px-4 py-2 text-gray-400 hover:text-white border-b-2 border-transparent">
                            <i class="fas fa-users mr-2"></i>アーティスト管理
                        </button>
                        <button onclick="switchTab('purchases')" class="tab-btn px-4 py-2 text-gray-400 hover:text-white border-b-2 border-transparent">
                            <i class="fas fa-receipt mr-2"></i>購入履歴
                        </button>
                    </nav>
                </div>

                <!-- Stats Tab -->
                <div id="tab-stats" class="tab-content">
                    <div id="stats-content">
                        <div class="text-center text-gray-400 py-8">
                            <i class="fas fa-spinner fa-spin text-4xl mb-2"></i>
                            <p>読み込み中...</p>
                        </div>
                    </div>
                </div>

                <!-- Events Tab -->
                <div id="tab-events" class="tab-content hidden">
                    <div class="mb-6">
                        <button onclick="showCreateEventModal()" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-lg transition">
                            <i class="fas fa-plus mr-2"></i>イベント作成
                        </button>
                    </div>
                    <div id="events-content">
                        <div class="text-center text-gray-400 py-8">
                            <i class="fas fa-spinner fa-spin text-4xl mb-2"></i>
                            <p>読み込み中...</p>
                        </div>
                    </div>
                </div>

                <!-- Artists Tab -->
                <div id="tab-artists" class="tab-content hidden">
                    <div class="mb-6">
                        <button onclick="showCreateArtistModal()" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-lg transition">
                            <i class="fas fa-plus mr-2"></i>アーティスト作成
                        </button>
                    </div>
                    <div id="artists-content">
                        <div class="text-center text-gray-400 py-8">
                            <i class="fas fa-spinner fa-spin text-4xl mb-2"></i>
                            <p>読み込み中...</p>
                        </div>
                    </div>
                </div>

                <!-- Purchases Tab -->
                <div id="tab-purchases" class="tab-content hidden">
                    <div id="purchases-content">
                        <div class="text-center text-gray-400 py-8">
                            <i class="fas fa-spinner fa-spin text-4xl mb-2"></i>
                            <p>読み込み中...</p>
                        </div>
                    </div>
                </div>
            </div>
        </main>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/admin.js"></script>
    </body>
    </html>
  `);
});

export default app;
