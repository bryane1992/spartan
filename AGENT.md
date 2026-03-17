# SPARTAN TRAINING APP — AI Agent Instructions

## PROJECT OVERVIEW
This is a personal 15-week training app for a Spartan Super race (10K + 25 obstacles) in late June 2026. It's a full-stack web app with a Node/Express backend, SQLite database, and React frontend. The user accesses it from their phone and logs workouts in real-time.

## USER PROFILE
- **Height/Weight:** 6'1", 196 lbs, estimated 20-25% body fat
- **Experience:** Intermediate lifter, returning after 2-month break (started Week 1 on March 17, 2026)
- **Goals:** Build muscle (arms & chest priority), get a 6-pack, run a 10K, complete Spartan Super
- **Personality:** Hates boring gym routines. Needs variety, themed workouts, challenges, and benchmarks to stay engaged
- **Running baseline:** Can run ~1 mile continuously, did 2 miles in 22 min on first week (hilly terrain, trail unavailable due to snow/mud)

## EQUIPMENT
- Squat rack + adjustable bench (flat and incline)
- 45 lb barbell + 110 lb plates (155 lb max barbell)
- Adjustable dumbbells: 5-55 lb each (pain to adjust — program each day at ONE weight)
- Kettlebells: 20 lb, 35 lb, 50 lb (one of each)
- Pull-up rings (can't go low enough for ring push-ups or ring flys)
- Medicine ball
- Jump rope
- Road for running (trail unavailable early season)

## ARCHITECTURE

### Directory Structure
```
spartan-app/
├── .gitpod.yml          # Ona/Gitpod workspace config
├── railway.toml         # Railway deployment config
├── package.json         # Root scripts
├── README.md            # Deployment instructions
├── .env.example         # Environment variable template
├── .gitignore
├── server/
│   ├── package.json
│   ├── index.js         # Express server + SQLite + all API routes
│   └── spartan.db       # SQLite database (created at runtime)
├── client/
│   ├── package.json
│   ├── vite.config.js   # Vite config with API proxy for dev
│   ├── index.html       # Entry HTML
│   └── src/
│       ├── main.jsx     # React mount point
│       ├── api.js       # API client helper (all fetch calls)
│       └── App.jsx      # THE MAIN FILE — entire app UI + program generator
└── data/                # SQLite DB location in production
```

### Key File: `client/src/App.jsx`
This is the monolith file containing:
- **Program Generator (`genWeek()`):** Takes a week number (1-15) and previous week's data, returns 5 days of workouts. Exercises, weights, reps, and themes change based on the phase and week.
- **Progression Engine:** Weights auto-bump ~5% per week based on logged data, capped at equipment limits (155 lb barbell, 55 lb DBs)
- **Seed Data (`SEED_DATA`):** Pre-loaded Week 1 Monday + Tuesday results from the user's actual first sessions
- **UI Components:** ExRow (exercise with check-off + log fields), Blk (collapsible workout block), main App shell with tabs
- **State Management:** Loads from API on auth, saves individual days via PATCH /api/day with 600ms debounce

### Key File: `server/index.js`
Express server with:
- SQLite via better-sqlite3 (WAL mode for performance)
- PIN auth via `x-auth-pin` header
- Tables: `app_state` (current week), `week_day_log` (per-day workout data)
- Routes: GET/PUT /api/state, PATCH /api/day, PUT /api/week, DELETE /api/state, POST /api/seed
- Serves built client files in production

### Key File: `client/src/api.js`
Thin API client. Stores PIN in localStorage. All calls include `x-auth-pin` header.

## TRAINING PROGRAM DESIGN

### 4 Phases
| Phase | Weeks | Focus |
|-------|-------|-------|
| FOUNDATION | 1-4 | Rebuild base, run to 3mi, muscle memory |
| BUILD | 5-8 | Push heavier, 5K+ runs, bulk arms & chest |
| PEAK | 9-12 | Heaviest phase, 8K+ runs, max definition |
| RACE PREP | 13-15 | Taper, race-pace 10K, obstacle simulation |

### Weekly Split (5 days, weekends off)
| Day | Focus | Chest/Arms? |
|-----|-------|-------------|
| MON | Full Body + Flat Bench + Barbell Curls/Skull Crushers | ✅ Heavy |
| TUE | Run (intervals→tempo→fartlek→race pace) + Core | ❌ Core only |
| WED | Incline Chest + Back + Arm Blaster (hammer curls, Arnold press, lateral raises) | ✅ Volume |
| THU | Heavy Legs + Carries + Incline Chest/Arms Finisher (post-squat hormone spike) | ✅ Supersets |
| FRI | Long Run + Obstacle Sim + Quick Arm Pump | ✅ Light pump |

### Chest & Arms Hit 4x/Week
This was a specific user request. Movements vary by day:
- **Mon:** Bench press, DB floor fly to press, barbell curl, skull crushers, hammer curl
- **Wed:** Incline DB press, squeeze press, incline fly, hammer curl, close push-ups, lateral raise, Arnold press
- **Thu:** Incline bench press, DB curl to press, close-grip bench
- **Fri:** Push-ups, DB curl to press, diamond push-ups

### DB Weight Strategy
User's adjustable DBs are annoying to change. Each day programs ONE DB weight for the session:
- Mon: 30→35→40→35 lb (by phase)
- Wed: 25→30→35→30 lb
- Thu: 30→35→40→35 lb

### Running Progression (10K by race day)
- Wk 1-4: Intervals (2min hard/1min easy × 4-6), long run 2.5-3mi
- Wk 5-8: Tempo runs, fartleks, long run 4-4.5mi
- Wk 9-12: Race pace work, long run 5-6.5mi
- Wk 13-15: Taper, race-pace 10K

### Benchmark Weeks (4, 8, 12)
Test maxes on squat, bench, pull-ups, and AMRAPs. Compare to previous benchmark.

### Exercise Unlocks by Phase
- Week 1-4: Floor press → bench press (has rack now), front squat, DB curls
- Week 5+: Back squat, barbell curl, skull crushers, incline bench, close-grip bench, incline flys
- Week 9+: Hanging knee raises (from rings), heavier carries, longer AMRAPs

## DATA MODEL

### State Shape (what the API returns from GET /api/state)
```json
{
  "week": 2,
  "data": {
    "1": {                    // week number
      "0": {                  // day index (0=Mon, 1=Tue, etc)
        "ck": {"0-0": 1, "1-0": 1},  // checked exercises (blockIdx-exIdx: 1/0)
        "lg": {                        // logged data per exercise
          "1-0": {"a": "3×10", "wt": "85 lb", "n": "Could go to 95"}
        },
        "ar": {"4": "4"}              // AMRAP rounds (blockIdx: rounds)
      }
    }
  }
}
```

### Database Tables
- `app_state`: Single row, stores `current_week`
- `week_day_log`: One row per (week, day_index), stores checked/log_data/amrap_rounds as JSON strings

## FEATURES TO BUILD / INCOMPLETE

### Progress Dashboard (chart tab)
The artifact version had a full insights dashboard with:
- Phase timeline visualization
- Quick stats (weeks, exercises logged, AMRAPs)
- Strength gains (biggest weight increases across lifts)
- Key lift charts over time (bench, squat, row, curl, pull-ups)
- Running progress (distance and time charts + run log table)
- Weekly completion bars
- AMRAP benchmarks with week-over-week comparison
**Status:** Stubbed out in current client. Needs to be built using the same data from GET /api/state.

### Exercise History (list tab)
Browse/search all exercises, tap to see logged weight/reps across weeks with visual progression bars.
**Status:** Stubbed out. Needs to be built.

### Indoor AMRAP Variants
Monday's AMRAP is currently indoor-only (KB swings, burpees, jump squats, push-ups instead of run). Consider adding a toggle or auto-detect for weather.

### Video Links
Exercise names link to YouTube search results for form videos. Map is in the VIDS object in App.jsx. Add more as new exercises are introduced.

## ENVIRONMENT VARIABLES
| Variable | Description | Default |
|----------|-------------|---------|
| AUTH_PIN | Access PIN | spartan2025 |
| PORT | Server port | 3000 |
| DB_PATH | SQLite file path | ./server/spartan.db |

## DEVELOPMENT

### Local Dev
```bash
# Terminal 1: Server (port 3000)
cd server && npm install && node index.js

# Terminal 2: Client (port 5173, proxies /api to :3000)
cd client && npm install && npx vite
```

### Production Build
```bash
cd client && npm install && npx vite build
cd ../server && npm install
node server/index.js
# Serves both API and static client from port 3000
```

### Deployment
- **Railway:** `railway.toml` handles build + start. Add volume at `/data`, set `DB_PATH=/data/spartan.db`
- **Ona/Gitpod:** `.gitpod.yml` auto-runs setup + start
- **Any VPS:** Build client, run `node server/index.js`, reverse proxy port 3000

## DESIGN PRINCIPLES
- Dark theme (#0A0A0A background), accent colors per day/phase
- Fonts: Oswald (headings), JetBrains Mono (data/labels)
- Mobile-first — max-width 500px content area
- Tap to check off exercises, log fields appear below when checked
- Status indicator shows save state (saving.../✓ saved/error)
- AROO! celebration when all exercises in a day are completed
- Keep it fun — themed workout names rotate weekly, benchmark weeks feel special

## KNOWN USER PREFERENCES
- Rings can't go low enough for push-ups or flys (don't program ring push-ups or ring flys)
- Adjustable DBs are a pain — keep one weight per session per day
- User has a bench with incline setting
- User prefers bench press over floor press (has a rack now)
- Indoor AMRAP preferred for bad weather (no outdoor run)
- 26 lb KB used for Russian twists (not 20 lb)
- User skipped Wed-Fri of Week 1, started fresh Week 2
- User works Mon-Fri only, weekends completely off
