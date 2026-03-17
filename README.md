# Spartan Super 15-Week Training App

Personal training app for Spartan Super race prep. 15-week progressive program with auto-progression, benchmark weeks, 10K cardio ramp, and arms/chest focus across 4 days.

## Quick Deploy with Ona (formerly Gitpod)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Spartan training app"
gh repo create spartan-training --private --source=. --push
```

### 2. Open in Ona
- Go to your Ona dashboard
- Open your `spartan-training` repo
- The `.gitpod.yml` auto-configures everything
- App builds and starts on port 3000 automatically
- The URL opens in your browser — bookmark it on your phone

### 3. Persistent Data
The SQLite database lives at `./data/spartan.db` in your workspace. As long as your Ona workspace persists, your data persists. If you want extra safety, the app's export feature lets you download a JSON backup.

### 4. Set Your PIN
By default the PIN is `spartan2025`. To change it:
- Set environment variable `AUTH_PIN` in your Ona workspace settings
- Or edit `.gitpod.yml` and change the default

---

## Quick Deploy with Railway

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Spartan training app"
gh repo create spartan-training --private --source=. --push
```

### 2. Deploy to Railway
- Go to [railway.app](https://railway.app) and sign in with GitHub
- Click "New Project" → "Deploy from GitHub repo"
- Select your `spartan-training` repo
- Railway auto-detects the `railway.toml` config
- Add environment variable: `AUTH_PIN` = your secret PIN
- Click Deploy — you'll get a public URL in ~2 minutes

### 3. Use It
- Open your Railway URL on your phone
- Enter your PIN
- Bookmark it to your home screen
- All data saves automatically to the SQLite database

## Local Development

```bash
# Terminal 1: Server
cd server && npm install && node index.js

# Terminal 2: Client  
cd client && npm install && npx vite
```

Open `http://localhost:5173` — Vite proxies API calls to the server.

## Deploy with Claude Code

If you have Claude Code installed:
```bash
claude "Deploy this app to Railway. The repo is at /path/to/spartan-app"
```

## Tech Stack
- **Backend:** Node.js + Express + better-sqlite3
- **Frontend:** React + Vite
- **Database:** SQLite (zero config, persists on Railway volume)
- **Auth:** PIN-based (set via `AUTH_PIN` env var)

## Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `AUTH_PIN` | Access PIN | `spartan2025` |
| `PORT` | Server port | `3000` |
| `DB_PATH` | SQLite file path | `./server/spartan.db` |

## Railway Volume (Important!)
To persist your SQLite database between deploys on Railway:
1. Go to your service settings
2. Add a Volume: mount path `/data`
3. Set env var: `DB_PATH=/data/spartan.db`

This ensures your workout data survives redeploys.
