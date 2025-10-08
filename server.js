const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 3001;

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
    'http://localhost:4173'
  ],
  credentials: true
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'navifare-proxy-server',
    version: '2.0.0',
    features: ['airlabs-proxy', 'feedback-email']
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

// Apply the proxy middleware
app.use('/api/airlabs', airlabsProxy);

// Catch-all handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not found', 
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

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
  console.log(`🔑 Resend API key configured: ${!!process.env.RESEND_API_KEY}`);
  if (!process.env.RESEND_API_KEY) {
    console.log(`⚠️  Feedback emails will be logged but not sent (no API key)`);
  }
});
