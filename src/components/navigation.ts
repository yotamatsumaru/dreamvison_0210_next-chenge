// Navigation component generator
export function getNavigation(currentPage: 'home' | 'artists' | 'events' | 'event-detail' | 'artist-detail' | 'watch' | 'success' | 'admin' = 'home') {
  const pages = {
    home: { path: '/', label: 'ホーム' },
    artists: { path: '/artists', label: 'アーティスト' },
    events: { path: '/events', label: 'イベント' },
  };

  return `
    <nav class="bg-black bg-opacity-50 backdrop-blur-md border-b border-gray-800 sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16 items-center">
          <div class="flex items-center">
            <i class="fas fa-broadcast-tower text-purple-500 text-2xl mr-3"></i>
            <a href="/" class="text-white text-xl font-bold hover:text-purple-400 transition">StreamingPlatform</a>
          </div>
          
          <!-- Desktop Navigation -->
          <div class="hidden md:flex space-x-4">
            ${Object.entries(pages).map(([key, page]) => `
              <a href="${page.path}" class="${currentPage === key ? 'text-white' : 'text-gray-300'} hover:text-white px-3 py-2 transition">
                ${page.label}
              </a>
            `).join('')}
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
          <a href="/" class="block ${currentPage === 'home' ? 'text-white bg-purple-600' : 'text-gray-300'} px-3 py-2 rounded hover:bg-purple-600 hover:text-white transition">
            <i class="fas fa-home mr-2"></i>ホーム
          </a>
          <a href="/artists" class="block ${currentPage === 'artists' ? 'text-white bg-purple-600' : 'text-gray-300'} px-3 py-2 rounded hover:bg-gray-800 hover:text-white transition">
            <i class="fas fa-users mr-2"></i>アーティスト
          </a>
          <a href="/events" class="block ${currentPage === 'events' ? 'text-white bg-purple-600' : 'text-gray-300'} px-3 py-2 rounded hover:bg-gray-800 hover:text-white transition">
            <i class="fas fa-calendar-alt mr-2"></i>イベント
          </a>
        </div>
      </div>
    </nav>
    <script src="/static/nav.js"></script>
  `;
}
