const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 3001;

// Service configuration
const FARERA_API_BASE_URL = process.env.FARERA_API_BASE_URL || 'https://search.farera.com';
const FARERA_API_KEY = process.env.FARERA_API_KEY || '';
const FARERA_PARTNER_MARKER = process.env.FARERA_PARTNER_MARKER || '';
const FARERA_DEFAULT_META = process.env.FARERA_PARTNER_META || '';

// Initialize Resend (only if API key is available)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS for all routes
app.use(cors({
  origin: [
    'https://front-end-c0mh.onrender.com',
    'https://preview.navifare.com',
    'https://dev.navifare.com',
    'https://navifare.com',
    'https://www.navifare.com',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:4173',
    'http://localhost:6274',
    'http://localhost:3000',
    'http://localhost'
  ],
  credentials: true
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'navifare-proxy-server',
    version: '2.2.0',
    features: ['airlabs-proxy', 'feedback-email', 'price-discovery-proxy', 'gotogate-graphql-proxy']
  });
});

// Config endpoint
app.get('/config', (req, res) => {
  res.json({ 
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    version: '2.0.0',
    features: {
      airlabs: true,
      feedback: true
    }
  });
});

// Feedback endpoint
app.post('/api/feedback', async (req, res) => {
  try {
    const { message, searchId, userAgent, timestamp, url } = req.body;
    
    console.log(`[${new Date().toISOString()}] 📧 Received feedback:`, { 
      message: message?.substring(0, 50) + '...', 
      searchId, 
      timestamp 
    });
    
    if (!message || !message.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Message is required' 
      });
    }
    
    // Check if Resend is configured
    if (!resend) {
      console.log(`[${new Date().toISOString()}] ⚠️  Resend not configured - feedback logged but not sent`);
      return res.json({ 
        success: true, 
        messageId: 'logged-only',
        timestamp: new Date().toISOString(),
        note: 'Feedback logged but email service not configured'
      });
    }
    
    const recipients = ['simone+feedback@navifare.com', 'george+feedback@navifare.com'];
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #00C9A7; border-bottom: 2px solid #00C9A7; padding-bottom: 10px;">
          New User Feedback
        </h2>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">Feedback Message:</h3>
          <p style="color: #555; line-height: 1.6; white-space: pre-wrap;">${message}</p>
        </div>
        
        <div style="background-color: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">Technical Details:</h3>
          <ul style="color: #555; line-height: 1.6;">
            <li><strong>Timestamp:</strong> ${timestamp}</li>
            <li><strong>URL:</strong> ${url}</li>
            ${searchId ? `<li><strong>Search ID:</strong> ${searchId}</li>` : ''}
            <li><strong>User Agent:</strong> ${userAgent || 'Not available'}</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
          <p style="color: #888; font-size: 12px;">
            This feedback was sent from the Navifare application.
          </p>
        </div>
      </div>
    `;

    const result = await resend.emails.send({
      from: 'feedback@notifications.navifare.com',
      to: recipients,
      subject: `User Feedback - ${timestamp}`,
      html: htmlContent
    });

    console.log(`[${new Date().toISOString()}] ✅ Email sent successfully:`, { 
      messageId: result.data?.id,
      error: result.error?.message || null
    });
    
    if (result.error) {
      return res.status(500).json({ 
        success: false, 
        error: result.error.message 
      });
    }
    
    res.json({ 
      success: true, 
      messageId: result.data?.id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Failed to send email:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Proxy configuration for Price Discovery API
const priceDiscoveryProxy = createProxyMiddleware({
  target: 'https://api.navifare.com',
  changeOrigin: true,
  timeout: 120000, // 120 seconds timeout for backend processing
  proxyTimeout: 120000, // 120 seconds proxy timeout
  onError: (err, req, res) => {
    console.error(`[${new Date().toISOString()}] Price Discovery proxy error:`, err);
    res.status(500).json({ 
      error: 'Price Discovery proxy error', 
      message: err.message,
      timestamp: new Date().toISOString()
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[${new Date().toISOString()}] Proxying Price Discovery request: ${req.method} ${req.url}`);
    console.log(`[${new Date().toISOString()}] Request body:`, JSON.stringify(req.body || '(no body)').substring(0, 200));
    // Set origin header to bypass backend CORS checks
    proxyReq.setHeader('Origin', 'https://navifare.com');
    proxyReq.setHeader('Referer', 'https://navifare.com/');
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`[${new Date().toISOString()}] Received Price Discovery response: ${proxyRes.statusCode} for ${req.url}`);
  }
});

// Proxy configuration for AirLabs API
const airlabsProxy = createProxyMiddleware({
  target: 'https://airlabs.co',
  changeOrigin: true,
  pathRewrite: (path, req) => {
    // Rewrite path and inject API key
    const apiKey = process.env.AIRLABS_API_KEY;
    const newPath = path.replace(/^\/api\/airlabs/, '/api/v9');
    
    if (apiKey) {
      const separator = newPath.includes('?') ? '&' : '?';
      const finalPath = newPath + separator + `api_key=${apiKey}`;
      console.log(`[${new Date().toISOString()}] Rewriting path with API key: ${req.method} ${finalPath.replace(apiKey, 'REDACTED')}`);
      return finalPath;
    } else {
      console.log(`[${new Date().toISOString()}] ⚠️ WARNING: AIRLABS_API_KEY not set!`);
      return newPath;
    }
  },
  onError: (err, req, res) => {
    console.error(`[${new Date().toISOString()}] Proxy error:`, err);
    res.status(500).json({ 
      error: 'Proxy error', 
      message: err.message,
      timestamp: new Date().toISOString()
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[${new Date().toISOString()}] Proxying request: ${req.method} ${proxyReq.path}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`[${new Date().toISOString()}] Received response: ${proxyRes.statusCode}`);
  }
});

// Proxy configuration for GoToGate GraphQL API
const gotogateProxy = createProxyMiddleware({
  target: 'https://www.gotogate.com',
  changeOrigin: true,
  pathRewrite: {
    '^/api/search-on-result-page': '/graphql/SearchOnResultPage'
  },
  onError: (err, req, res) => {
    console.error(`[${new Date().toISOString()}] GoToGate proxy error:`, err);
    res.status(500).json({ 
      error: 'GoToGate proxy error', 
      message: err.message,
      timestamp: new Date().toISOString()
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[${new Date().toISOString()}] Proxying GoToGate GraphQL request: ${req.method} ${proxyReq.path}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`[${new Date().toISOString()}] Received GoToGate response: ${proxyRes.statusCode}`);
  }
});

// Apply the proxy middleware
app.use('/api/v1/price-discovery/flights', priceDiscoveryProxy);
app.use('/api/airlabs', airlabsProxy);
app.use('/api/search-on-result-page', gotogateProxy);

// Proxy configuration for Kiwi Tequila API
const kiwiProxy = createProxyMiddleware({
  target: 'https://tequila-api.kiwi.com',
  changeOrigin: true,
  pathRewrite: { '^/api/kiwi': '' },
  onProxyReq: (proxyReq, req) => {
    const apiKey = process.env.KIWI_API_KEY;
    if (apiKey) {
      proxyReq.setHeader('apikey', apiKey);
      console.log(`[${new Date().toISOString()}] Proxying Kiwi: ${req.method} ${proxyReq.path}`);
    } else {
      console.log(`[${new Date().toISOString()}] ⚠️ KIWI_API_KEY not set!`);
    }
  },
  onProxyRes: (proxyRes) => {
    console.log(`[${new Date().toISOString()}] Kiwi response: ${proxyRes.statusCode}`);
  }
});

app.use('/api/kiwi', kiwiProxy);


/**
 * Farera Flight Search proxy.
 *
 * Accepts POST requests at /api/search/:meta and forwards them to the Farera flight search API,
 * injecting the partner API key and optional partner marker.
 */
app.post('/api/search/:meta?', async (req, res) => {
  const requestedMeta = req.params.meta;
  const meta = requestedMeta || FARERA_DEFAULT_META;

  if (!FARERA_API_KEY) {
    return res.status(500).json({
      error: 'Missing configuration',
      message: 'FARERA_API_KEY is not configured on the proxy server.',
      timestamp: new Date().toISOString(),
    });
  }

  if (!meta) {
    return res.status(400).json({
      error: 'Missing meta',
      message: 'No Farera partner meta provided. Pass it in the request path or set FARERA_PARTNER_META.',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const targetUrl = new URL(`/api/search/${encodeURIComponent(meta)}`, FARERA_API_BASE_URL);
    const redactedKey =
      typeof FARERA_API_KEY === 'string' && FARERA_API_KEY.length > 8
        ? `${FARERA_API_KEY.slice(0, 4)}…${FARERA_API_KEY.slice(-4)}`
        : '(short/empty)';

    // Preserve incoming query string parameters
    Object.entries(req.query || {}).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => targetUrl.searchParams.append(key, v));
      } else if (value !== undefined) {
        targetUrl.searchParams.append(key, value);
      }
    });

    // Ensure partner marker is present
    if (FARERA_PARTNER_MARKER) {
      targetUrl.searchParams.set('partner_marker', FARERA_PARTNER_MARKER);
    }

    console.log(`[${new Date().toISOString()}] ✈️  Forwarding Farera search`, {
      baseUrl: FARERA_API_BASE_URL,
      url: targetUrl.toString(),
      meta,
      apiKey: redactedKey,
    });

    const upstreamResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-KEY': FARERA_API_KEY,
      },
      body: JSON.stringify(req.body ?? {}),
    });

    const responseBody = await upstreamResponse.text();
    const contentType = upstreamResponse.headers.get('content-type') || 'application/json';

    if (!upstreamResponse.ok) {
      console.warn(
        `[${new Date().toISOString()}] ⚠️ Farera responded with ${upstreamResponse.status}: ${responseBody.slice(
          0,
          500
        )}`
      );
    }

    res
      .status(upstreamResponse.status)
      .set('content-type', contentType)
      .send(responseBody);

    console.log(
      `[${new Date().toISOString()}] ✅ Farera response ${upstreamResponse.status} (${responseBody.length} bytes)`
    );
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Farera proxy error`, error);
    res.status(502).json({
      error: 'Farera proxy error',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Catch-all handler for undefined routes (must be last)
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found', 
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Gemini AI proxy - add after other proxy definitions
const geminiProxy = createProxyMiddleware({
  target: 'https://generativelanguage.googleapis.com',
  changeOrigin: true,
  pathRewrite: { '^/api/gemini': '/v1beta' },
  onProxyReq: (proxyReq, req) => {
    // Add API key as query parameter
    const url = new URL(proxyReq.path, 'https://generativelanguage.googleapis.com');
    url.searchParams.set('key', process.env.GEMINI_API_KEY);
    proxyReq.path = url.pathname + url.search;
    console.log(`[Gemini] ${req.method} ${proxyReq.path}`);
  }
});

app.use('/api/gemini', geminiProxy);


// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Unhandled error:`, err);
  res.status(500).json({ 
    error: 'Internal server error', 
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Navifare Proxy Server running on port ${PORT}`);
  console.log(`📅 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Allowed origins: ${process.env.NODE_ENV === 'production' ? 'Production domains' : 'Localhost'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📧 Feedback endpoint: http://localhost:${PORT}/api/feedback`);
  console.log(`✈️  AirLabs proxy: http://localhost:${PORT}/api/airlabs`);
  console.log(`🎯 Price Discovery proxy: http://localhost:${PORT}/api/v1/price-discovery/flights`);
  console.log(`🔍 GoToGate GraphQL proxy: http://localhost:${PORT}/api/search-on-result-page`);
  console.log(`🔑 Resend API key configured: ${!!process.env.RESEND_API_KEY}`);
  if (!process.env.RESEND_API_KEY) {
    console.log(`⚠️  Feedback emails will be logged but not sent (no API key)`);
  }
});


