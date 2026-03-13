# 🃏 Card Games – Mendicot & Court Piece

Multiplayer Indian card games built with **React + Node.js + Socket.io**.  
No login required — cookie-based sessions like cardgames.io.

---

## 🎮 Games Included

### Mendicot (Dehla Pakad)
- 4 players, 2 teams
- Deal 5 cards first, then 4+4 after trump sets
- Trump sets **naturally** when someone can't follow suit
- **Two consecutive tricks by same player** to collect center cards
- Capture **3 or 4 tens** to win
- All 4 tens = **MENDICOT!** (big win)

### Court Piece (Rang / Coat Piece)
- 4 players, 2 teams
- Deal 5 cards → right of dealer **MUST call trump**
- **Raise round** (based only on 5 cards):
  - Dealer's team can raise target: 7 → 8 tricks
  - Trump caller's team can raise: 8 → 9 tricks
  - Alternates up to max 13 tricks
- Deal remaining 4+4 cards after raise settled
- Trump caller's team leads first
- Win by reaching target tricks
- **Loser deals every round**

---

## 🚀 Setup & Run

### Prerequisites
- Node.js v18+
- npm v9+

### Install Dependencies
```bash
# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### Run in Development
Open **two terminals**:

**Terminal 1 – Server:**
```bash
cd server
npm run dev
# Runs on http://localhost:3001
```

**Terminal 2 – Client:**
```bash
cd client
npm start
# Opens http://localhost:3000
```

### Run in Production
```bash
# Build React app
cd client && npm run build

# Start server (serves built client too)
cd ../server && npm start
# Visit http://localhost:3001
```

---

## 🏗️ Project Structure

```
card-games/
├── server/
│   ├── index.js                  # Express + Socket.io server
│   ├── rooms/
│   │   └── roomManager.js        # Room create/join/leave/lobby
│   ├── games/
│   │   ├── gameEngine.js         # Shared: deck, shuffle, deal, trick logic
│   │   ├── mendicot.js           # Mendicot game engine
│   │   └── courtpiece.js         # Court Piece game engine
│   └── package.json
│
├── client/
│   ├── public/index.html
│   ├── src/
│   │   ├── App.js                # Root: name prompt, routing
│   │   ├── App.css               # All styles
│   │   ├── socket.js             # Socket.io client singleton
│   │   └── components/
│   │       ├── Lobby.jsx         # Game selection, room browser
│   │       ├── WaitingRoom.jsx   # Waiting for 4 players
│   │       ├── GameRoom.jsx      # Game container + chat
│   │       ├── CardTable.jsx     # 4-player table layout
│   │       ├── PlayerHand.jsx    # My cards, tap-to-play
│   │       ├── MendicotUI.jsx    # Mendicot-specific UI (tens, consecutive)
│   │       └── CourtPieceUI.jsx  # Court Piece UI (trump call, raise)
│   └── package.json
│
└── README.md
```

---

## 🌐 Socket Events Reference

### Client → Server
| Event | Payload | Description |
|---|---|---|
| `set_player` | `{ playerId, playerName }` | Identify player (cookie-based) |
| `get_lobby` | `{ gameType }` | Fetch public rooms |
| `create_room` | `{ gameType, isPrivate, playerName, playerId }` | Create room |
| `join_room` | `{ roomCode, playerName, playerId }` | Join by code |
| `leave_room` | — | Leave current room |
| `game_action` | `{ roomCode, action, data }` | Play card / call trump / raise |
| `send_message` | `{ roomCode, message }` | Chat |

### Server → Client
| Event | Payload | Description |
|---|---|---|
| `player_set` | `{ playerId, playerName }` | Identity confirmed |
| `lobby_update` | `{ rooms }` | Public room list |
| `room_created` | `{ room }` | Room created |
| `room_update` | `{ room }` | Player joined/left |
| `game_start` | `{ gameType, myCards, publicState, myPosition }` | Game begins |
| `game_state` | state object | After every action |
| `my_cards_update` | `{ cards }` | Your hand updated |
| `game_over` | `{ winner, reason, scores }` | Hand finished |
| `game_interrupted` | `{ message }` | Player left mid-game |
| `chat_message` | `{ playerName, message, time }` | Chat received |

### Game Actions (game_action payload)
| Action | Data | Game |
|---|---|---|
| `play_card` | `{ cardId }` | Both |
| `call_trump` | `{ suit }` | Court Piece |
| `raise` | `{}` | Court Piece |
| `pass_raise` | `{}` | Court Piece |

---

## 🍪 No-Login System

Player identity is stored in **browser cookies**:
- `playerId` — unique UUID per browser (auto-generated)
- `playerName` — chosen display name

Switching browsers = new identity. Clearing cookies = fresh start.

---

## 🔧 Environment Variables

Create `server/.env` for custom config:
```
PORT=3001
```

Create `client/.env` for custom server URL:
```
REACT_APP_SERVER_URL=http://localhost:3001
```

---

## 🚀 Deploy to Production

### Using Railway / Render / DigitalOcean:
1. Build client: `cd client && npm run build`
2. Copy `client/build` output to `server/public`
3. In `server/index.js`, serve static: `app.use(express.static('public'))`
4. Deploy server folder only

### Using Vercel (client) + Railway (server):
1. Deploy server to Railway → get server URL
2. Set `REACT_APP_SERVER_URL=<railway-url>` in Vercel env vars
3. Deploy client to Vercel

---

## 📝 Adding More Games

1. Create `server/games/yourgame.js` extending the game engine
2. Add game type to `roomManager` and `index.js`
3. Create `client/src/components/YourGameUI.jsx`
4. Add game card in `Lobby.jsx`

---

## 🤝 Teams & Positions

```
         North (Team A)
              ↑
West (B) ← Table → East (B)
              ↓
         South (Team A / You)
```

Partners: South & North = Team A | West & East = Team B
