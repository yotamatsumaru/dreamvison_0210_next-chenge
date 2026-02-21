import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { initializeDatabase, Database } from './lib/db'

// Import routes
import stripeRoutes from './routes/stripe'
import eventsRoutes from './routes/events'
import artistsRoutes from './routes/artists'
import watchRoutes from './routes/watch'
import adminRoutes from './routes/admin'

// Extended type with PostgreSQL database
export type AppBindings = {
  DB: Database
}

// Create Hono app
const app = new Hono<{ Bindings: AppBindings }>()

// Initialize database
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/streaming_platform'
const pool = initializeDatabase(DATABASE_URL)
const db = new Database(pool)

// Middleware to inject database into context
app.use('*', async (c, next) => {
  c.env = { DB: db } as any
  await next()
})

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files from public directory
app.use('/static/*', serveStatic({ root: './public' }))
app.use('/favicon.ico', serveStatic({ path: './public/favicon.ico' }))

// API routes
app.route('/api/stripe', stripeRoutes)
app.route('/api/events', eventsRoutes)
app.route('/api/artists', artistsRoutes)
app.route('/api/watch', watchRoutes)
app.route('/api/admin', adminRoutes)

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

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
                <h1 class="text-3xl md:text-5xl font-bold text-white mb-4">
                    ライブ配信・ストリーミング<br>プラットフォーム
                </h1>
                <p class="text-base md:text-xl text-gray-300 mb-8">
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

            <!-- Recent Events Section -->
            <div id="events-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div class="text-center text-gray-400">
                    <i class="fas fa-spinner fa-spin text-4xl mb-4"></i>
                    <p>イベントを読み込み中...</p>
                </div>
            </div>
        </main>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            async function loadEvents() {
                try {
                    const response = await axios.get('/api/events');
                    const events = response.data.slice(0, 6); // Show first 6 events
                    
                    const container = document.getElementById('events-container');
                    
                    if (events.length === 0) {
                        container.innerHTML = '<div class="col-span-full text-center text-gray-400"><p>イベントがありません</p></div>';
                        return;
                    }
                    
                    container.innerHTML = events.map(event => \`
                        <div class="bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-2xl transition relative group">
                            \${event.status === 'live' ? \`
                                <div class="absolute top-0 left-0 right-0 z-10 flex justify-center">
                                    <div class="bg-red-600 text-white px-4 py-1 rounded-b-lg shadow-lg animate-pulse">
                                        <i class="fas fa-circle text-xs mr-1 animate-ping"></i>
                                        配信中
                                    </div>
                                </div>
                                <div class="absolute inset-0 border-2 border-red-500 rounded-lg pointer-events-none"></div>
                            \` : event.status === 'upcoming' ? \`
                                <div class="absolute top-4 right-4 bg-blue-600 text-white px-3 py-1 rounded-full text-sm z-10">
                                    配信予定
                                </div>
                            \` : ''}
                            
                            <img 
                                src="\${event.thumbnail_url || '/static/placeholder-event.jpg'}" 
                                alt="\${event.title}"
                                class="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                            >
                            <div class="p-6">
                                <h3 class="text-xl font-bold text-white mb-2 line-clamp-2">\${event.title}</h3>
                                <p class="text-gray-400 text-sm mb-4 line-clamp-2">\${event.description || ''}</p>
                                <div class="flex items-center justify-between text-sm">
                                    <span class="text-gray-500">
                                        <i class="fas fa-calendar mr-1"></i>
                                        \${new Date(event.start_time).toLocaleDateString('ja-JP')}
                                    </span>
                                </div>
                                <a 
                                    href="/events/\${event.slug}" 
                                    class="mt-4 block w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg text-center transition"
                                >
                                    詳細を見る
                                </a>
                            </div>
                        </div>
                    \`).join('');
                } catch (error) {
                    console.error('Failed to load events:', error);
                    document.getElementById('events-container').innerHTML = 
                        '<div class="col-span-full text-center text-red-400"><p>イベントの読み込みに失敗しました</p></div>';
                }
            }
            
            // Load events on page load
            loadEvents();
        </script>

        <footer class="bg-black bg-opacity-50 border-t border-gray-800 mt-20 py-8">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="text-center text-gray-400">
                    <p>&copy; 2024 StreamingPlatform. All rights reserved.</p>
                </div>
            </div>
        </footer>
    </body>
    </html>
  `)
})

// Export default for Cloudflare Workers compatibility (not used in Node.js)
export default app

// Start Node.js server
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = parseInt(process.env.PORT || '3000')
  console.log(`Starting server on http://0.0.0.0:${port}`)
  
  serve({
    fetch: app.fetch,
    port,
    hostname: '0.0.0.0',
  })
  
  console.log(`Server is running on http://0.0.0.0:${port}`)
}
