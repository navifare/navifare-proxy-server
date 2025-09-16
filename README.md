# Navifare Proxy Server

A simple Express.js proxy server to bypass CORS restrictions when calling the AirLabs API from the Navifare frontend.

## 🚀 Quick Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/yourusername/navifare-proxy-server)

## 📋 What This Does

- **Solves CORS Issues**: Allows your frontend to call AirLabs API without CORS restrictions
- **Lightweight**: Minimal dependencies, fast startup
- **Secure**: Only allows requests from your domains
- **Monitored**: Includes health checks and logging

## 🛠️ Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/navifare-proxy-server.git
   cd navifare-proxy-server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm run dev
   ```

4. **Test locally**
   ```bash
   curl http://localhost:3001/health
   ```

## 🌐 Deployment to Render

### Option 1: One-Click Deploy
Click the "Deploy to Render" button above and follow the prompts.

### Option 2: Manual Deploy

1. **Create a new repository** on GitHub with these files
2. **Go to Render Dashboard** → "New +" → "Web Service"
3. **Connect your GitHub repository**
4. **Configure the service:**
   - **Name**: `navifare-proxy-server`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Node Version**: `18`

5. **Deploy!** 🎉

## 🔧 Configuration

### Environment Variables

No environment variables are required for basic operation. The server will:
- Use port from Render (or 3001 locally)
- Allow CORS from configured domains
- Proxy requests to AirLabs API

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

# Test AirLabs API (replace with your API key)
curl "https://your-proxy-url.onrender.com/api/airlabs/routes?api_key=YOUR_KEY&dep_iata=ZRH&arr_iata=NRT&limit=5"
```

Or use the included test script:

```bash
PROXY_URL=https://your-proxy-url.onrender.com AIRLABS_API_KEY=your-key node test.js
```

## 🔗 Frontend Integration

Update your frontend's `airlabsService.ts`:

```typescript
const AIRLABS_API_BASE = import.meta.env.DEV 
  ? '/api/airlabs' // Use Vite proxy in development
  : 'https://your-proxy-url.onrender.com/api/airlabs' // Use your proxy in production
```

## 📊 Monitoring

The proxy includes:
- **Health endpoint**: `/health` for monitoring
- **Request logging**: All requests are logged
- **Error handling**: Proper error responses
- **CORS headers**: Configured for your domains

## 💰 Cost

- **Free tier**: 750 hours/month (should be sufficient)
- **Lightweight**: Minimal resource usage
- **No database**: Stateless proxy server

## 🔒 Security

- **CORS protection**: Only allows requests from your domains
- **No API key storage**: Keys are passed through securely
- **Error sanitization**: Sensitive data is not exposed in errors

## 📝 API Endpoints

- `GET /health` - Health check
- `GET /api/airlabs/*` - Proxies to AirLabs API
- `*` - 404 for undefined routes

## 🐛 Troubleshooting

### Common Issues

1. **CORS errors**: Check that your frontend domain is in the allowed origins
2. **404 errors**: Ensure you're using the correct proxy URL
3. **Timeout errors**: AirLabs API might be slow; this is normal

### Logs

Check Render logs for detailed error information:
- Request/response logging
- Proxy errors
- CORS issues

## 📄 License

MIT License - feel free to use and modify as needed.
