# RIFTLINE Server Deployment

## Railway Deployment (Recommended)

### Quick Deploy
1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Set the root directory to `/server`
5. Railway auto-detects Node.js and runs `npm start`

### Environment Variables
Set these in Railway dashboard:
```
PORT=8080
NODE_ENV=production
```

### Railway.json (auto-detected)
Railway will use `server/package.json` scripts:
- Build: `npm run build`
- Start: `npm start`

---

## Render Deployment

### Quick Deploy
1. Go to [render.com](https://render.com)
2. Create new "Web Service"
3. Connect your GitHub repo
4. Configure:
   - **Root Directory**: `server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment**: Node
   - **Instance Type**: Free or Starter

### Environment Variables
Set in Render dashboard:
```
PORT=10000
NODE_ENV=production
```

---

## Manual Deployment

### Build locally
```bash
cd server
npm install
npm run build
```

### Run
```bash
npm start
```

### With PM2 (production)
```bash
npm install -g pm2
pm2 start dist/GameServer.js --name riftline-server
pm2 save
```

---

## Client Configuration

After deployment, update the WebSocket URL in the client:

**File: `src/network/websocket.ts`**

Change the default URL from:
```typescript
const DEFAULT_WS_URL = 'ws://localhost:8080';
```

To your deployed server URL:
```typescript
const DEFAULT_WS_URL = 'wss://your-app.railway.app';
// or
const DEFAULT_WS_URL = 'wss://your-app.onrender.com';
```

### Environment-based URL (Recommended)
```typescript
const DEFAULT_WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';
```

Then set `VITE_WS_URL` in your `.env.production`:
```
VITE_WS_URL=wss://your-server.railway.app
```

---

## Health Check

Both Railway and Render will hit the HTTP endpoint:
```
GET /
```

Response:
```json
{
  "status": "ok",
  "players": 0,
  "matches": 0
}
```

---

## Scaling

The server supports:
- **60 tick/sec** game loop
- **20 Hz** state broadcasts
- Up to **100 concurrent players** per instance (adjust based on resources)

For production at scale, consider:
- Horizontal scaling with sticky sessions
- Redis for cross-instance state
- Dedicated game servers per region
