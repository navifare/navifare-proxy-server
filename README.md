# Navifare Proxy Server

A simple Express.js proxy server to bypass CORS restrictions and handle feedback emails for the Navifare frontend.

## 🚀 Quick Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

## 📋 What This Does

* **Solves CORS Issues**: Allows your frontend to call AirLabs, Farera, and GoToGate APIs without CORS restrictions
* **Handles Feedback**: Sends user feedback emails via Resend
* **Lightweight**: Minimal dependencies, fast startup
* **Secure**: Only allows requests from your domains
* **Monitored**: Includes health checks and logging

## 🛠️ Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/navifare/navifare-proxy-server.git
   cd navifare-proxy-server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env and add your RESEND_API_KEY
   ```

4. **Start the server**
   ```bash
   npm run dev
   ```

5. **Test locally**
   ```bash
   # Health check
   curl http://localhost:3001/health
   
   # Test feedback endpoint
   curl -X POST http://localhost:3001/api/feedback \
     -H "Content-Type: application/json" \
     -d '{"message": "Test feedback", "timestamp": "2025-01-01T00:00:00.000Z", "url": "http://localhost:5173"}'
   ```

## 🌐 Deployment to Render

### Option 1: One-Click Deploy

Click the "Deploy to Render" button above and follow the prompts.

### Option 2: Manual Deploy

1. **Create a new repository** on GitHub with these files
2. **Go to Render Dashboard** → "New +" → "Web Service"
3. **Connect your GitHub repository**
4. **Configure the service:**
   * **Name**: `navifare-proxy-server`
   * **Environment**: `Node`
   * **Build Command**: `npm install`
   * **Start Command**: `npm start`
   * **Node Version**: `18`
5. **Add environment variables:**
   * **RESEND_API_KEY** – Resend API key (optional if you only need the proxy)
   * **FARERA_API_KEY** – Farera partner API key
   * **FARERA_PARTNER_META** – Your Farera partner meta slug
   * **FARERA_PARTNER_MARKER** – Tracking marker appended to deep links (optional)
   * **FARERA_API_BASE_URL** – Override Farera base URL (defaults to `https://search.farera.com`)
6. **Deploy!** 🎉

## 🔧 Configuration

### Environment Variables

* `RESEND_API_KEY` (optional): Your Resend API key for sending feedback emails
* `FARERA_API_BASE_URL` (optional): Base URL for Farera (defaults to `https://search.farera.com`)
* `FARERA_API_KEY` (required for direct Farera calls): Your Farera partner API key. Not required when proxying.
* `FARERA_PARTNER_META` (optional): Default partner meta slug if the client does not provide one. Required if the request path omits `:meta`.
* `FARERA_PARTNER_MARKER` (optional): Partner marker appended as `partner_marker`
* `NODE_ENV` (optional): Set to `production` for production deployment
* `PORT` (optional): Custom port (Render sets this automatically)

### Updating Allowed Domains

Edit `server.js` and update the `origin` array in the CORS configuration:

```javascript
origin: [
  'https://your-frontend-domain.com',
  'https://your-staging-domain.com',
  'http://localhost:5173'
]
```

## 🧪 Testing

After deployment, test your proxy:

```bash
# Test health endpoint
curl https://your-proxy-url.onrender.com/health

# Test feedback endpoint
curl -X POST https://your-proxy-url.onrender.com/api/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Test feedback message",
    "searchId": "test-123",
    "userAgent": "Test Browser",
    "timestamp": "2025-01-01T00:00:00.000Z",
    "url": "https://your-frontend.com"
  }'

# Test AirLabs API (replace with your API key)
curl "https://your-proxy-url.onrender.com/api/airlabs/routes?api_key=YOUR_KEY&dep_iata=ZRH&arr_iata=NRT&limit=5"

# Test Farera Flight Search (replace with your partner meta)
curl -X POST "https://your-proxy-url.onrender.com/api/search/YOUR_META" \
  -H "Content-Type: application/json" \
  -d '{
    "currency": "EUR",
    "language": "en-US",
    "legs": [
      {"origin": "ZRH", "destination": "NRT", "date": "2025-05-01"}
    ],
    "adults": 1
  }'

# Test GoToGate GraphQL Search
curl -X POST "https://your-proxy-url.onrender.com/api/search-on-result-page" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query SearchOnResultPage($routes: [Route!]!, $adults: Int!) { search(routes: $routes, adults: $adults) { flights { id } } }",
    "variables": {
      "routes": [{"origin": "ZRH", "destination": "NRT", "date": "2025-05-01"}],
      "adults": 1
    }
  }'
```

## 🔗 Frontend Integration

### AirLabs API
Update your frontend's `airlabsService.ts`:

```javascript
const AIRLABS_API_BASE = import.meta.env.DEV 
  ? '/api/airlabs' // Use Vite proxy in development
  : 'https://your-proxy-url.onrender.com/api/airlabs' // Use your proxy in production
```

### Feedback System
Update your frontend's `feedbackApiService.ts`:

```javascript
const response = await fetch('https://your-proxy-url.onrender.com/api/feedback', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(feedbackData)
})
```

### GoToGate GraphQL API
Update your frontend's `flightSearchProviders.ts`:

```javascript
const SEARCH_GRAPHQL_ENDPOINT = import.meta.env.DEV 
  ? '/api/search-on-result-page' // Use Vite proxy in development
  : 'https://your-proxy-url.onrender.com/api/search-on-result-page' // Use proxy server in production
```

## 📊 Monitoring

The proxy includes:

* **Health endpoint**: `/health` for monitoring
* **Request logging**: All requests are logged with timestamps
* **Error handling**: Proper error responses
* **CORS headers**: Configured for your domains

## 💰 Cost

* **Free tier**: 750 hours/month (should be sufficient)
* **Lightweight**: Minimal resource usage
* **No database**: Stateless proxy server

## 🔒 Security

* **CORS protection**: Only allows requests from your domains
* **No API key storage**: Keys are passed through securely
* **Error sanitization**: Sensitive data is not exposed in errors
* **Input validation**: Feedback messages are validated

## 📝 API Endpoints

* `GET /health` - Health check
* `POST /api/feedback` - Send feedback email
* `GET /api/airlabs/*` - Proxies to AirLabs API
* `POST /api/search/:meta` - Proxies Farera flight search
* `POST /api/search-on-result-page` - Proxies GoToGate GraphQL SearchOnResultPage
* `*` - 404 for undefined routes

## 🐛 Troubleshooting

### Common Issues

1. **CORS errors**: Check that your frontend domain is in the allowed origins
2. **404 errors**: Ensure you're using the correct proxy URL
3. **Timeout errors**: AirLabs API might be slow; this is normal
4. **Email errors**: Check that your Resend API key is valid and domain is verified

### Logs

Check Render logs for detailed error information:

* Request/response logging
* Proxy errors
* CORS issues
* Email sending status

## 📄 License

MIT License - feel free to use and modify as needed.
