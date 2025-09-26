# Navifare Proxy Server

A simple Express.js proxy server to bypass CORS restrictions and handle feedback emails for the Navifare frontend.

## 🚀 Quick Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

## 📋 What This Does

* **Solves CORS Issues**: Allows your frontend to call AirLabs API without CORS restrictions
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
5. **Add environment variable:**
   * **Key**: `RESEND_API_KEY`
   * **Value**: Your Resend API key
6. **Deploy!** 🎉

## 🔧 Configuration

### Environment Variables

* `RESEND_API_KEY` (required): Your Resend API key for sending feedback emails
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
