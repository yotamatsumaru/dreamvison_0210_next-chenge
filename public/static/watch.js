// Watch page - Native HTML5 Video player with HLS.js support

let hls = null;
let videoElement = null;

async function initializePlayer() {
    const container = document.getElementById('watch-container');
    
    // Check if access token is provided
    if (!accessToken) {
        container.innerHTML = `
            <div class="max-w-4xl mx-auto px-4 py-12">
                <div class="bg-red-900 bg-opacity-20 border border-red-800 rounded-xl p-8 text-center">
                    <i class="fas fa-lock text-red-500 text-4xl mb-4"></i>
                    <h2 class="text-2xl font-bold text-white mb-2">アクセストークンが必要です</h2>
                    <p class="text-gray-300 mb-4">この配信を視聴するには、チケットを購入してください。</p>
                    <a href="/events" class="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition">
                        <i class="fas fa-ticket-alt mr-2"></i>
                        チケットを購入する
                    </a>
                </div>
            </div>
        `;
        return;
    }
    
    try {
        // Verify access token
        const verifyResponse = await axios.post('/api/watch/verify', {
            token: accessToken
        });
        
        if (!verifyResponse.data.valid) {
            throw new Error('Invalid token');
        }
        
        const { event } = verifyResponse.data;
        
        // Get stream URL
        const streamResponse = await axios.post('/api/watch/stream-url', {
            token: accessToken,
            eventId: event.id
        });
        
        const { streamUrl, useSigned } = streamResponse.data;
        
        // Determine if it's HLS or MP4
        const isHLS = streamUrl.includes('.m3u8');
        const isMP4 = streamUrl.includes('.mp4');
        
        // Create video player with native HTML5 video tag
        container.innerHTML = `
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
                
                <div class="max-w-7xl mx-auto px-4 py-6">
                    <h1 class="text-3xl font-bold text-white mb-2">${event.title}</h1>
                    <div class="flex items-center space-x-4 text-gray-400">
                        <span>
                            <i class="fas fa-${event.eventType === 'live' ? 'broadcast-tower' : 'archive'} mr-2"></i>
                            ${event.eventType === 'live' ? 'ライブ配信' : 'アーカイブ配信'}
                        </span>
                        ${event.status === 'live' ? '<span class="text-red-500"><i class="fas fa-circle animate-pulse mr-1"></i>配信中</span>' : ''}
                    </div>
                    
                    <div class="mt-4 text-gray-400 text-sm">
                        <p class="whitespace-pre-line">${event.description || ''}</p>
                    </div>
                </div>
            </div>
        `;
        
        videoElement = document.getElementById('videoPlayer');
        
        // For HLS streams, use HLS.js if available
        if (isHLS) {
            if (Hls.isSupported()) {
                hls = new Hls({
                    debug: false,
                    enableWorker: true,
                    lowLatencyMode: event.eventType === 'live',
                    backBufferLength: 90
                });
                
                hls.loadSource(streamUrl);
                hls.attachMedia(videoElement);
                
                hls.on(Hls.Events.MANIFEST_PARSED, function() {
                    console.log('HLS manifest loaded, starting playback');
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
        }
        
        // Video event listeners
        videoElement.addEventListener('error', function(e) {
            console.error('Video error:', e);
            const error = videoElement.error;
            let errorMessage = '動画の再生中にエラーが発生しました。';
            
            if (error) {
                switch(error.code) {
                    case error.MEDIA_ERR_ABORTED:
                        errorMessage = '動画の読み込みが中断されました。';
                        break;
                    case error.MEDIA_ERR_NETWORK:
                        errorMessage = 'ネットワークエラーが発生しました。';
                        break;
                    case error.MEDIA_ERR_DECODE:
                        errorMessage = '動画のデコードに失敗しました。';
                        break;
                    case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                        errorMessage = 'この動画形式はサポートされていません。';
                        break;
                }
            }
            
            showError(errorMessage);
        });
        
        videoElement.addEventListener('loadstart', () => console.log('Loading video...'));
        videoElement.addEventListener('canplay', () => console.log('Video ready to play'));
        videoElement.addEventListener('playing', () => console.log('Video playing'));
        
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
