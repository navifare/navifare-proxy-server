# Deployment Guide for Navifare Proxy Server

## 🎯 Quick Start

1. **Create GitHub Repository**
2. **Deploy to Render**
3. **Update Frontend**
4. **Test**

## 📝 Step-by-Step Instructions

### Step 1: Create GitHub Repository

1. Go to [GitHub](https://github.com/new)
2. Create a new repository named `navifare-proxy-server`
3. Copy all files from the `proxy-repo` folder to your new repository
4. Commit and push to GitHub

### Step 2: Deploy to Render

1. **Go to Render Dashboard**
   - Visit [render.com](https://render.com)
   - Sign in or create account

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub account
   - Select the `navifare-proxy-server` repository

3. **Configure Service Settings**
   ```
   Name: navifare-proxy-server
   Environment: Node
   Region: Oregon (US West) or Frankfurt (EU)
   Branch: main
   Root Directory: (leave empty)
   Build Command: npm install
   Start Command: npm start
   Node Version: 18
   ```

4. **Advanced Settings**
   ```
   Auto-Deploy: Yes
   Health Check Path: /health
   ```

5. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment (2-3 minutes)
   - Note your service URL (e.g., `https://navifare-proxy-server.onrender.com`)

### Step 3: Update Frontend

1. **Update AirlabsService**
   ```typescript
   // In src/services/airlabsService.ts
   const AIRLABS_API_BASE = import.meta.env.DEV 
     ? '/api/airlabs' // Use Vite proxy in development
     : 'https://YOUR_PROXY_URL.onrender.com/api/airlabs' // Use your proxy
   ```

2. **Update CORS Origins** (if needed)
   ```javascript
   // In proxy-repo/server.js
   origin: [
     'https://front-end-c0mh.onrender.com',
     'https://preview.navifare.com',
     'https://navifare.com',
     'https://YOUR_FRONTEND_DOMAIN.com' // Add your domain
   ]
   ```

### Step 4: Test Deployment

1. **Test Health Endpoint**
   ```bash
   curl https://YOUR_PROXY_URL.onrender.com/health
   ```

2. **Test AirLabs API**
   ```bash
   curl "https://YOUR_PROXY_URL.onrender.com/api/airlabs/routes?api_key=YOUR_KEY&dep_iata=ZRH&arr_iata=NRT&limit=5"
   ```

3. **Test from Frontend**
   - Deploy your updated frontend
   - Try the AirLabs functionality
   - Check browser network tab for successful requests

## 🔧 Configuration Options

### Environment Variables (Optional)

You can set these in Render's environment variables section:

```
NODE_ENV=production
PORT=10000
```

### Custom Domains

If you want to use a custom domain:

1. **In Render Dashboard**
   - Go to your service
   - Click "Settings" → "Custom Domains"
   - Add your domain (e.g., `proxy.navifare.com`)

2. **Update DNS**
   - Point your domain to Render's servers
   - Follow Render's DNS instructions

3. **Update Frontend**
   - Use your custom domain in `airlabsService.ts`

## 📊 Monitoring

### Health Checks

- **Endpoint**: `GET /health`
- **Response**: `{"status": "ok", "timestamp": "...", "service": "navifare-proxy-server"}`
- **Use for**: Uptime monitoring, load balancer health checks

### Logs

- **Access**: Render Dashboard → Your Service → "Logs"
- **Contains**: Request/response logging, errors, proxy status
- **Retention**: 7 days on free tier

### Metrics

- **CPU/Memory**: Available in Render Dashboard
- **Response Times**: Logged for each request
- **Error Rates**: Tracked automatically

## 🚨 Troubleshooting

### Common Issues

1. **Deployment Fails**
   - Check Node version (use 18)
   - Verify `package.json` is correct
   - Check build logs in Render

2. **CORS Errors**
   - Verify frontend domain is in allowed origins
   - Check browser console for specific CORS messages
   - Test with curl to isolate frontend vs proxy issues

3. **404 Errors**
   - Ensure proxy URL is correct in frontend
   - Check that service is running (health endpoint)
   - Verify AirLabs API key is valid

4. **Timeout Errors**
   - AirLabs API can be slow (normal)
   - Check Render logs for timeout details
   - Consider increasing timeout in proxy if needed

### Debug Commands

```bash
# Test health
curl https://your-proxy-url.onrender.com/health

# Test with verbose output
curl -v https://your-proxy-url.onrender.com/api/airlabs/routes?api_key=YOUR_KEY&dep_iata=ZRH&arr_iata=NRT&limit=1

# Check service status
curl -I https://your-proxy-url.onrender.com/health
```

## 💰 Cost Management

### Free Tier Limits
- **750 hours/month**: Should be sufficient for most use cases
- **No custom domains**: Use `.onrender.com` subdomain
- **7-day log retention**: Upgrade for longer retention

### Optimization Tips
- **Lightweight**: Proxy uses minimal resources
- **Stateless**: No database or persistent storage
- **Efficient**: Express.js is very fast

### Monitoring Usage
- Check Render Dashboard for usage metrics
- Set up alerts if approaching limits
- Consider upgrading if needed

## 🔄 Updates and Maintenance

### Updating the Proxy
1. **Make changes** to your GitHub repository
2. **Render auto-deploys** (if enabled)
3. **Test** the updated proxy
4. **Update frontend** if needed

### Scaling
- **Free tier**: Single instance
- **Paid tiers**: Multiple instances, load balancing
- **Custom domains**: Available on paid tiers

## 📞 Support

- **Render Support**: [render.com/docs](https://render.com/docs)
- **Issues**: Create GitHub issues in your repository
- **Logs**: Check Render service logs for debugging
