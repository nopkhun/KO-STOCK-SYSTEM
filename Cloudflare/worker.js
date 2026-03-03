/**
 * Cloudflare Worker: serves GAS iframe page with injected GAS_URL from env.
 * Deploy: npx wrangler deploy
 */

const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kostock Inventory</title>
    <style>
        body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; font-family: sans-serif; }
        iframe {
            width: 100%;
            height: 100vh;
            min-height: 100%;
            border: none;
            display: block;
        }
        .loading {
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: #fff;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 12px;
            transition: opacity 0.3s;
        }
        .loading.hidden { opacity: 0; pointer-events: none; }
        .loading-spinner {
            width: 44px; height: 44px;
            border: 3px solid #e8f0fe;
            border-top-color: #1a73e8;
            border-radius: 50%;
            animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .loading-text { color: #333; font-size: 15px; font-weight: 500; }
        .loading-sub { color: #888; font-size: 13px; margin-top: 4px; }
        .loading-dots::after {
            content: '';
            animation: dots 1.2s steps(4, end) infinite;
        }
        @keyframes dots {
            0%, 20% { content: ''; }
            40% { content: '.'; }
            60% { content: '..'; }
            80%, 100% { content: '...'; }
        }
        .loading-bar {
            width: 180px;
            height: 4px;
            background: #e8f0fe;
            border-radius: 2px;
            overflow: hidden;
            margin-top: 16px;
        }
        .loading-bar-inner {
            height: 100%;
            width: 40%;
            background: #1a73e8;
            border-radius: 2px;
            animation: bar 1.2s ease-in-out infinite;
        }
        @keyframes bar {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(150%); }
            100% { transform: translateX(-100%); }
        }
    </style>
</head>
<body>
    <div class="loading" id="loading">
        <div class="loading-spinner"></div>
        <span class="loading-text loading-dots">กำลังเตรียมระบบ</span>
        <span class="loading-sub">กรุณารอสักครู่ (หากโหลดเกิน 15 วินาที ระบบจะแสดงหน้าถัดไปอัตโนมัติ)</span>
        <div class="loading-bar"><div class="loading-bar-inner"></div></div>
    </div>
    <iframe
        id="gas-frame"
        src="__GAS_URL__"
        title="Kostock Inventory"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        allow="fullscreen"
    ></iframe>
    <script>
        (function () {
            var frame = document.getElementById('gas-frame');
            var loading = document.getElementById('loading');
            var gasUrl = frame.getAttribute('src');
            if (!gasUrl || gasUrl === '__GAS_URL__') {
                loading.classList.add('hidden');
                return;
            }
            function hideLoading() {
                loading.classList.add('hidden');
            }
            frame.addEventListener('load', hideLoading);
            setTimeout(hideLoading, 15000);
        })();
    </script>
</body>
</html>`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const gasUrl = env.GAS_URL || '';
    const html = gasUrl
      ? HTML_TEMPLATE.replace(/__GAS_URL__/g, gasUrl)
      : HTML_TEMPLATE.replace(/__GAS_URL__/g, '#');

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  },
};
