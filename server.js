const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all routes
app.use(cors({
  origin: [
    'https://front-end-c0mh.onrender.com',
    'https://preview.navifare.com',
    'https://navifare.com',
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
    version: '1.0.0'
  });
});

// Proxy configuration for AirLabs API
const airlabsProxy = createProxyMiddleware({
  target: 'https://airlabs.co',
  changeOrigin: true,
  pathRewrite: {
    '^/api/airlabs': '/api/v9'
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).json({ 
      error: 'Proxy error', 
      message: err.message,
      timestamp: new Date().toISOString()
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[${new Date().toISOString()}] Proxying request: ${req.method} ${req.url}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`[${new Date().toISOString()}] Received response: ${proxyRes.statusCode} for ${req.url}`);
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
  console.error('Unhandled error:', err);
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
});
