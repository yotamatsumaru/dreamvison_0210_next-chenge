// Watch page - Native HTML5 Video player with HLS.js support

let hls = null;
let videoElement = null;

async function initializePlayer() {
    const container = document.getElementById('watch-container');
    
    // Check if preview mode or access token
    const urlParams = new URLSearchParams(window.location.search);
    const isPreview = urlParams.get('preview') === 'true' || !accessToken;
    
    // Preview mode: show warning banner
    if (isPreview) {
        console.log('Preview mode enabled - bypassing authentication');
    }
    
    try {
        // Verify access token or get preview access
        const verifyPayload = isPreview ? {
            preview: true,
            eventSlug: eventSlug
        } : {
            token: accessToken
        };
        
        const verifyResponse = await axios.post('/api/watch/verify', verifyPayload);
        
        console.log('Verify response:', verifyResponse.data);
        
        if (!verifyResponse.data.valid) {
            throw new Error('Invalid token');
        }
        
        const { event, preview } = verifyResponse.data;
        
        console.log('Event data:', event);
        console.log('Preview mode:', preview);
        
        // Get stream URL
        const streamPayload = preview ? {
            preview: true,
            eventSlug: eventSlug
        } : {
            token: accessToken,
            eventId: event.id
        };
        
        console.log('Stream payload:', streamPayload);
        
        const streamResponse = await axios.post('/api/watch/stream-url', streamPayload);
        
        console.log('Stream response:', streamResponse.data);
        
        const { streamUrl, useSigned } = streamResponse.data;
        
        console.log('Stream URL:', streamUrl);
        console.log('Is signed:', useSigned);
        
        // Determine if it's HLS or MP4
        const isHLS = streamUrl.includes('.m3u8');
        const isMP4 = streamUrl.includes('.mp4');
        
        // Create video player with native HTML5 video tag
        container.innerHTML = `
            ${preview ? `
                <div class="bg-gradient-to-r from-yellow-900/40 via-orange-900/40 to-yellow-900/40 border-b-2 border-yellow-500/50 backdrop-blur-md">
                    <div class="max-w-7xl mx-auto px-4 py-4">
                        <div class="flex items-center justify-center space-x-3 flex-wrap gap-2">
                            <div class="bg-yellow-500/20 rounded-full p-2">
                                <i class="fas fa-exclamation-triangle text-yellow-400 text-lg md:text-xl"></i>
                            </div>
                            <div class="text-center md:text-left">
                                <span class="text-yellow-300 font-bold text-sm md:text-base block md:inline">
                                    プレビューモード（開発用）
                                </span>
                                <span class="text-yellow-200/80 text-xs md:text-sm block md:inline md:ml-2">
                                    チケット購入なしで視聴しています
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            ` : ''}
            <div class="relative bg-black">
                <div class="max-w-7xl mx-auto">
                    <video 
                        id="videoPlayer" 
                        class="w-full aspect-video"
                        controls 
                        autoplay 
                        playsinline 
                        webkit-playsinline
                        muted
                        ${isMP4 ? `src="${streamUrl}"` : ''}
                    >
                        お使いのブラウザは動画タグをサポートしていません。
                    </video>
                </div>
                
                <div class="max-w-7xl mx-auto px-4 py-4 md:py-6">
                    <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
                        <div class="flex-1">
                            <h1 class="text-xl md:text-3xl font-bold text-white mb-2">${event.title}</h1>
                            <div class="flex items-center flex-wrap gap-3 md:gap-4 text-gray-400 text-sm md:text-base">
                                <span>
                                    <i class="fas fa-${event.eventType === 'live' ? 'broadcast-tower' : 'archive'} mr-2"></i>
                                    ${event.eventType === 'live' ? 'ライブ配信' : 'アーカイブ配信'}
                                </span>
                                ${event.status === 'live' ? '<span class="text-red-500 text-sm md:text-base"><i class="fas fa-circle animate-pulse mr-1"></i>配信中</span>' : ''}
                            </div>
                        </div>
                        
                        <!-- Quality selector for HLS -->
                        ${isHLS ? `
                            <div id="quality-selector" class="hidden">
                                <div class="relative">
                                    <button id="quality-btn" onclick="toggleQualityMenu()" class="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2.5 rounded-lg transition flex items-center space-x-2 border border-gray-600 w-full md:w-auto justify-between md:justify-start">
                                        <div class="flex items-center space-x-2">
                                            <i class="fas fa-cog"></i>
                                            <span class="font-medium">画質:</span>
                                            <span id="current-quality" class="text-purple-400 font-semibold">自動</span>
                                        </div>
                                        <i class="fas fa-chevron-down text-xs ml-2"></i>
                                    </button>
                                    <div id="quality-menu" class="hidden absolute right-0 md:left-0 mt-2 bg-gray-900 backdrop-blur-md rounded-lg border border-gray-600 min-w-[200px] shadow-2xl z-20">
                                        <div class="py-2" id="quality-options">
                                            <!-- Quality options will be populated here -->
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    
                    ${event.description ? `
                        <div class="mt-3 md:mt-4 text-gray-400 text-xs md:text-sm border-t border-gray-800 pt-4">
                            <p class="whitespace-pre-line leading-relaxed">${event.description || ''}</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        videoElement = document.getElementById('videoPlayer');
        
        // For MP4, try to play when ready
        if (isMP4) {
            console.log('MP4 video detected, waiting for canplay event');
            videoElement.addEventListener('canplay', function() {
                console.log('MP4 video ready to play');
                videoElement.play().catch(e => {
                    console.log('Autoplay prevented:', e);
                    // User interaction required for autoplay
                });
            });
        }
        // For HLS streams, use HLS.js if available
        else if (isHLS) {
            if (Hls.isSupported()) {
                console.log('Using HLS.js for HLS playback');
                hls = new Hls({
                    debug: true,
                    enableWorker: true,
                    lowLatencyMode: event.eventType === 'live',
                    backBufferLength: 90
                });
                
                hls.loadSource(streamUrl);
                hls.attachMedia(videoElement);
                
                hls.on(Hls.Events.MANIFEST_PARSED, function() {
                    console.log('HLS manifest loaded, starting playback');
                    
                    // Initialize quality selector
                    initializeQualitySelector();
                    
                    videoElement.play().catch(e => {
                        console.log('Autoplay prevented:', e);
                        // User interaction required for autoplay
                    });
                });
                
                hls.on(Hls.Events.ERROR, function(event, data) {
                    console.error('HLS error:', data);
                    
                    if (data.fatal) {
                        switch(data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                console.error('Fatal network error, trying to recover');
                                hls.startLoad();
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                console.error('Fatal media error, trying to recover');
                                hls.recoverMediaError();
                                break;
                            default:
                                console.error('Fatal error, cannot recover');
                                showError('配信の再生中にエラーが発生しました。ページをリロードしてください。');
                                break;
                        }
                    }
                });
                
            } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
                // Native HLS support (Safari)
                console.log('Using native HLS support (Safari)');
                videoElement.src = streamUrl;
                videoElement.addEventListener('loadedmetadata', function() {
                    console.log('Native HLS loaded');
                    videoElement.play().catch(e => {
                        console.log('Autoplay prevented:', e);
                    });
                });
            } else {
                showError('お使いのブラウザはHLS配信をサポートしていません。');
                return;
            }
        } else {
            console.error('Unknown video format:', streamUrl);
            showError('サポートされていない動画形式です。');
            return;
        }
        
        // Video event listeners
        videoElement.addEventListener('error', function(e) {
            console.error('Video error event:', e);
            const error = videoElement.error;
            let errorMessage = '動画の再生中にエラーが発生しました。';
            
            if (error) {
                console.error('Video error details:', {
                    code: error.code,
                    message: error.message,
                    MEDIA_ERR_ABORTED: error.MEDIA_ERR_ABORTED,
                    MEDIA_ERR_NETWORK: error.MEDIA_ERR_NETWORK,
                    MEDIA_ERR_DECODE: error.MEDIA_ERR_DECODE,
                    MEDIA_ERR_SRC_NOT_SUPPORTED: error.MEDIA_ERR_SRC_NOT_SUPPORTED
                });
                
                switch(error.code) {
                    case error.MEDIA_ERR_ABORTED:
                        errorMessage = '動画の読み込みが中断されました。';
                        break;
                    case error.MEDIA_ERR_NETWORK:
                        errorMessage = 'ネットワークエラーが発生しました。動画URLを確認してください。';
                        break;
                    case error.MEDIA_ERR_DECODE:
                        errorMessage = '動画のデコードに失敗しました。';
                        break;
                    case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                        errorMessage = 'この動画形式はサポートされていません。MP4またはHLS(.m3u8)形式を使用してください。';
                        break;
                }
            }
            
            showError(errorMessage);
        });
        
        videoElement.addEventListener('loadstart', () => {
            console.log('Loading video...', streamUrl);
        });
        videoElement.addEventListener('loadedmetadata', () => {
            console.log('Video metadata loaded:', {
                duration: videoElement.duration,
                videoWidth: videoElement.videoWidth,
                videoHeight: videoElement.videoHeight
            });
        });
        videoElement.addEventListener('loadeddata', () => {
            console.log('Video data loaded');
        });
        videoElement.addEventListener('canplay', () => {
            console.log('Video ready to play');
        });
        videoElement.addEventListener('playing', () => {
            console.log('Video playing');
        });
        videoElement.addEventListener('waiting', () => {
            console.log('Video buffering...');
        });
        videoElement.addEventListener('stalled', () => {
            console.log('Video stalled');
        });
        
    } catch (error) {
        console.error('Failed to initialize player:', error);
        
        let errorMessage = 'ストリームへのアクセスに失敗しました。';
        if (error.response?.status === 401) {
            errorMessage = '無効または期限切れのアクセストークンです。';
        }
        
        showError(errorMessage);
    }
}

function showError(message) {
    const container = document.getElementById('watch-container');
    container.innerHTML = `
        <div class="max-w-4xl mx-auto px-4 py-12">
            <div class="bg-red-900 bg-opacity-20 border border-red-800 rounded-xl p-8 text-center">
                <i class="fas fa-exclamation-triangle text-red-500 text-4xl mb-4"></i>
                <h2 class="text-2xl font-bold text-white mb-2">再生エラー</h2>
                <p class="text-gray-300 mb-4">${message}</p>
                <div class="flex gap-4 justify-center">
                    <button onclick="location.reload()" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition">
                        <i class="fas fa-redo mr-2"></i>
                        再読み込み
                    </button>
                    <a href="/events" class="inline-block bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition">
                        イベント一覧に戻る
                    </a>
                </div>
            </div>
        </div>
    `;
}

// Quality selector functions
function initializeQualitySelector() {
    if (!hls) return;
    
    const levels = hls.levels;
    if (!levels || levels.length === 0) {
        console.log('No quality levels available');
        return;
    }
    
    console.log('Available quality levels:', levels);
    
    // Show quality selector
    const qualitySelector = document.getElementById('quality-selector');
    if (qualitySelector) {
        qualitySelector.classList.remove('hidden');
    }
    
    // Populate quality options
    const qualityOptions = document.getElementById('quality-options');
    if (!qualityOptions) return;
    
    // Add auto option
    qualityOptions.innerHTML = `
        <button onclick="setQuality(-1)" class="w-full text-left px-4 py-3 hover:bg-gray-800 transition text-white flex items-center justify-between group">
            <div class="flex items-center space-x-2">
                <i class="fas fa-magic text-purple-400 text-sm"></i>
                <span class="font-medium">自動</span>
            </div>
            <i id="quality-check-auto" class="fas fa-check text-purple-500"></i>
        </button>
    `;
    
    // Add quality options (sorted by height descending)
    const sortedLevels = [...levels].sort((a, b) => b.height - a.height);
    sortedLevels.forEach((level, index) => {
        const originalIndex = levels.indexOf(level);
        const resolution = `${level.height}p`;
        const bitrate = (level.bitrate / 1000000).toFixed(1);
        
        // Determine quality label
        let qualityLabel = '';
        let qualityIcon = 'fa-video';
        if (level.height >= 1080) {
            qualityLabel = 'フルHD';
            qualityIcon = 'fa-gem';
        } else if (level.height >= 720) {
            qualityLabel = 'HD';
            qualityIcon = 'fa-star';
        } else if (level.height >= 480) {
            qualityLabel = '標準';
            qualityIcon = 'fa-play-circle';
        } else {
            qualityLabel = '軽量';
            qualityIcon = 'fa-mobile-alt';
        }
        
        qualityOptions.innerHTML += `
            <button onclick="setQuality(${originalIndex})" class="w-full text-left px-4 py-3 hover:bg-gray-800 transition text-white flex items-center justify-between group">
                <div class="flex items-center space-x-3">
                    <i class="fas ${qualityIcon} text-gray-400 text-sm"></i>
                    <div>
                        <div class="font-semibold">${resolution} <span class="text-xs text-gray-400">${qualityLabel}</span></div>
                        <div class="text-xs text-gray-500">${bitrate} Mbps</div>
                    </div>
                </div>
                <i id="quality-check-${originalIndex}" class="fas fa-check text-purple-500 hidden"></i>
            </button>
        `;
    });
    
    // Listen for quality changes
    hls.on(Hls.Events.LEVEL_SWITCHED, function(event, data) {
        updateQualityDisplay(data.level);
    });
}

function toggleQualityMenu() {
    const menu = document.getElementById('quality-menu');
    if (menu) {
        menu.classList.toggle('hidden');
    }
}

function setQuality(levelIndex) {
    if (!hls) return;
    
    console.log('Setting quality level to:', levelIndex);
    
    if (levelIndex === -1) {
        // Auto quality
        hls.currentLevel = -1;
        updateQualityDisplay(-1);
    } else {
        // Manual quality
        hls.currentLevel = levelIndex;
        updateQualityDisplay(levelIndex);
    }
    
    // Close menu
    toggleQualityMenu();
}

function updateQualityDisplay(levelIndex) {
    const currentQualitySpan = document.getElementById('current-quality');
    
    // Update checkmarks
    const allChecks = document.querySelectorAll('[id^="quality-check-"]');
    allChecks.forEach(check => check.classList.add('hidden'));
    
    if (levelIndex === -1) {
        // Auto mode
        if (currentQualitySpan) {
            currentQualitySpan.textContent = '自動';
        }
        const autoCheck = document.getElementById('quality-check-auto');
        if (autoCheck) autoCheck.classList.remove('hidden');
    } else {
        // Manual mode
        const level = hls.levels[levelIndex];
        if (level && currentQualitySpan) {
            currentQualitySpan.textContent = `${level.height}p`;
        }
        const levelCheck = document.getElementById(`quality-check-${levelIndex}`);
        if (levelCheck) levelCheck.classList.remove('hidden');
    }
}

// Close quality menu when clicking outside
document.addEventListener('click', function(event) {
    const qualitySelector = document.getElementById('quality-selector');
    const qualityMenu = document.getElementById('quality-menu');
    
    if (qualitySelector && qualityMenu && !qualitySelector.contains(event.target)) {
        qualityMenu.classList.add('hidden');
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (hls) {
        hls.destroy();
    }
    if (videoElement) {
        videoElement.pause();
        videoElement.src = '';
    }
});

// Initialize player on page load
initializePlayer();
