const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const { Resend } = require('resend');
const zlib = require('zlib');

const app = express();
const PORT = process.env.PORT || 3001;

// Service configuration
const FARERA_API_BASE_URL = process.env.FARERA_API_BASE_URL || 'https://search.farera.com';
const FARERA_API_KEY = process.env.FARERA_API_KEY || '';
const FARERA_PARTNER_MARKER = process.env.FARERA_PARTNER_MARKER || '';
const FARERA_DEFAULT_META = process.env.FARERA_PARTNER_META || '';

// Initialize Resend (only if API key is available)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Alert tracking to prevent email spam
const alertState = {
  airlabs: {
    lastAlertTime: 0,
    errorCount: 0,
    firstErrorTime: 0,
    isInErrorState: false
  }
};

// Minimum time between alert emails (15 minutes)
const ALERT_COOLDOWN_MS = 15 * 60 * 1000;

// Send an alert email for API errors
async function sendApiErrorAlert(service, errorDetails) {
  if (!resend) {
    console.log(`[${new Date().toISOString()}] ⚠️ Cannot send alert - Resend not configured`);
    return;
  }

  const state = alertState[service];
  const now = Date.now();

  // Only send alert if cooldown has passed
  if (now - state.lastAlertTime < ALERT_COOLDOWN_MS) {
    console.log(`[${new Date().toISOString()}] ⏳ Alert cooldown active, skipping email (${state.errorCount} errors since ${new Date(state.firstErrorTime).toISOString()})`);
    return;
  }

  state.lastAlertTime = now;

  const recipients = ['simone@navifare.com', 'george@navifare.com'];

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 10px;">
        ⚠️ API Error Alert: ${service.toUpperCase()}
      </h2>

      <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
        <h3 style="color: #991b1b; margin-top: 0;">Error Details:</h3>
        <ul style="color: #7f1d1d; line-height: 1.8;">
          <li><strong>Status Code:</strong> ${errorDetails.statusCode || 'N/A'}</li>
          <li><strong>Error Message:</strong> ${errorDetails.message || 'Unknown error'}</li>
          <li><strong>Error Type:</strong> ${errorDetails.type || 'Unknown'}</li>
          <li><strong>First Error:</strong> ${new Date(state.firstErrorTime).toISOString()}</li>
          <li><strong>Error Count:</strong> ${state.errorCount} errors</li>
        </ul>
      </div>

      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #333; margin-top: 0;">Request Info:</h3>
        <ul style="color: #555; line-height: 1.6;">
          <li><strong>Endpoint:</strong> ${errorDetails.endpoint || 'N/A'}</li>
          <li><strong>Method:</strong> ${errorDetails.method || 'GET'}</li>
        </ul>
      </div>

      <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #92400e; margin-top: 0;">Action Required:</h3>
        <p style="color: #78350f;">
          ${errorDetails.statusCode === 429 || errorDetails.type === 'quota_exceeded'
            ? 'The API quota may have been exceeded. Check the Airlabs dashboard and consider upgrading the plan.'
            : 'Please investigate the issue. Check the proxy server logs for more details.'}
        </p>
      </div>

      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
        <p style="color: #888; font-size: 12px;">
          This alert was sent from the Navifare Proxy Server.<br>
          Next alert will be sent after ${new Date(now + ALERT_COOLDOWN_MS).toISOString()} (15 min cooldown).
        </p>
      </div>
    </div>
  `;

  try {
    const result = await resend.emails.send({
      from: 'alerts@notifications.navifare.com',
      to: recipients,
      subject: `🚨 API Alert: ${service.toUpperCase()} - ${errorDetails.type || 'Error'}`,
      html: htmlContent
    });

    console.log(`[${new Date().toISOString()}] 📧 Alert email sent:`, {
      messageId: result.data?.id,
      service,
      errorCount: state.errorCount
    });
  } catch (emailError) {
    console.error(`[${new Date().toISOString()}] ❌ Failed to send alert email:`, emailError);
  }
}

// Track API error and trigger alert if needed
function trackApiError(service, errorDetails) {
  const state = alertState[service];
  const now = Date.now();

  if (!state.isInErrorState) {
    state.isInErrorState = true;
    state.firstErrorTime = now;
    state.errorCount = 0;
  }

  state.errorCount++;

  console.log(`[${new Date().toISOString()}] 🔴 ${service.toUpperCase()} API error #${state.errorCount}:`, errorDetails);

  // Send alert on first error or after cooldown
  sendApiErrorAlert(service, errorDetails);
}

// Mark service as recovered
function markServiceRecovered(service) {
  const state = alertState[service];
  if (state.isInErrorState) {
    console.log(`[${new Date().toISOString()}] ✅ ${service.toUpperCase()} API recovered after ${state.errorCount} errors`);
    state.isInErrorState = false;
    state.errorCount = 0;
    state.firstErrorTime = 0;
  }
}

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

// Test endpoint for API error alerts (remove after testing)
app.get('/test-alert', async (req, res) => {
  trackApiError('airlabs', {
    type: 'test_alert',
    statusCode: 429,
    message: 'This is a test alert - please ignore',
    endpoint: '/test-alert',
    method: 'GET'
  });
  res.json({
    success: true,
    message: 'Test alert triggered. Check your email.',
    note: 'Remember to remove this endpoint after testing!'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'navifare-proxy-server',
    version: '2.2.2',
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
  selfHandleResponse: true, // Required to intercept and inspect response body
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
    trackApiError('airlabs', {
      type: 'connection_error',
      message: err.message,
      endpoint: req.originalUrl,
      method: req.method
    });
    res.status(500).json({
      error: 'Proxy error',
      message: err.message,
      serviceUnavailable: true,
      timestamp: new Date().toISOString()
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    // Request uncompressed response to avoid decompression issues
    proxyReq.setHeader('Accept-Encoding', 'identity');
    // Redact API key from logs
    const apiKey = process.env.AIRLABS_API_KEY;
    const redactedPath = apiKey ? proxyReq.path.replace(apiKey, 'REDACTED') : proxyReq.path;
    console.log(`[${new Date().toISOString()}] Proxying request: ${req.method} ${redactedPath}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    const statusCode = proxyRes.statusCode;
    const contentEncoding = proxyRes.headers['content-encoding'];
    console.log(`[${new Date().toISOString()}] Received response: ${statusCode}, encoding: ${contentEncoding || 'none'}`);

    // Collect response body chunks
    const chunks = [];
    proxyRes.on('data', (chunk) => {
      chunks.push(chunk);
    });

    proxyRes.on('end', () => {
      const rawBuffer = Buffer.concat(chunks);

      // Decompress if needed
      let decompressedBuffer;
      try {
        if (contentEncoding === 'gzip') {
          decompressedBuffer = zlib.gunzipSync(rawBuffer);
        } else if (contentEncoding === 'deflate') {
          decompressedBuffer = zlib.inflateSync(rawBuffer);
        } else if (contentEncoding === 'br') {
          decompressedBuffer = zlib.brotliDecompressSync(rawBuffer);
        } else {
          decompressedBuffer = rawBuffer;
        }
      } catch (decompressError) {
        console.error(`[${new Date().toISOString()}] Decompression error:`, decompressError.message);
        // If decompression fails, try using the raw buffer
        decompressedBuffer = rawBuffer;
      }

      let body = decompressedBuffer.toString('utf8');
      let parsedBody;
      try {
        parsedBody = JSON.parse(body);
      } catch (e) {
        console.error(`[${new Date().toISOString()}] JSON parse error:`, e.message);
        parsedBody = { raw: body };
      }

      // Check for errors
      const isHttpError = statusCode >= 400;
      const isApiError = parsedBody.error !== undefined;
      const isQuotaError = statusCode === 429 ||
        (parsedBody.error && (
          parsedBody.error.message?.toLowerCase().includes('quota') ||
          parsedBody.error.message?.toLowerCase().includes('limit') ||
          parsedBody.error.code === 'quota_exceeded'
        ));

      if (isHttpError || isApiError) {
        const errorType = isQuotaError ? 'quota_exceeded' :
                         statusCode === 401 ? 'authentication_error' :
                         statusCode === 403 ? 'forbidden' :
                         statusCode >= 500 ? 'server_error' : 'api_error';

        trackApiError('airlabs', {
          type: errorType,
          statusCode: statusCode,
          message: parsedBody.error?.message || parsedBody.error || `HTTP ${statusCode}`,
          endpoint: req.originalUrl,
          method: req.method
        });

        // Add serviceUnavailable flag to help frontend
        if (!parsedBody.serviceUnavailable) {
          parsedBody.serviceUnavailable = true;
          parsedBody.errorType = errorType;
          body = JSON.stringify(parsedBody);
        }
      } else {
        // Service is working - mark as recovered if it was in error state
        markServiceRecovered('airlabs');
      }

      // Forward response to client
      res.status(statusCode);

      // Copy headers, but SKIP content-encoding and transfer-encoding
      // since we've decompressed the body
      Object.keys(proxyRes.headers).forEach(key => {
        const lowerKey = key.toLowerCase();
        if (lowerKey !== 'content-encoding' && lowerKey !== 'transfer-encoding' && lowerKey !== 'content-length') {
          res.setHeader(key, proxyRes.headers[key]);
        }
      });

      // Set correct content-length for the decompressed body
      res.setHeader('content-length', Buffer.byteLength(body));

      res.end(body);
    });
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


