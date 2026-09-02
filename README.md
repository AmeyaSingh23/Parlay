# Parlay 🛡️🤝

**An LLM-negotiated, firewall-bounded B2B pricing agent for Razorpay merchants**  
*Built for the Razorpay AI Buildathon 2026 — Track 01: AI Growth & Agentic Commerce*

---

## 1. Problem Statement

SME and D2C merchants selling wholesale or bulk-order quantities (B2B orders, enterprise retail, volume distribution) constantly field price-negotiation requests over WhatsApp, email, or chat. Manual pricing decision-making is slow, inconsistent, and leads to either:
1. **Margin leakage** — giving away unnecessary discounts due to lack of real-time cost-floor visibility.
2. **Lost transactions** — taking hours or days to respond, losing buyers to competitors.

As autonomous purchasing agents (via protocols like NPCI's UAP, ACP, AP2, x402) begin transacting on behalf of enterprise buyers, merchants need an autonomous agent that **protects margin, never breaks pricing policy, and leaves a defensible audit trail of every money-adjacent decision.**

---

## 2. Solution Summary

**Parlay** is an autonomous merchant-side negotiation agent that negotiates wholesale pricing against simulated AI buyer agents.

Key architectural principle: **The Firewall is pure deterministic code, not an LLM prompt instruction.**  
The LLM proposes prices, but a non-LLM Firewall independently validates every proposal against live inventory floor prices before any Razorpay order is created.

```
┌─────────────────────────────────────────────────────────────┐
│                    BUYER AGENT (LLM)                        │
│      Simulated procurement persona with budget ceiling      │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Turn proposals)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               NEGOTIATION ORCHESTRATOR                      │
│     Enforces max rounds, discount ladder & session state    │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Context & history)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                MERCHANT AGENT (Parlay LLM)                  │
│       Margin-protective, decreasing concession policy       │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Proposed per-unit price)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│             FIREWALL LAYER (Deterministic Code)             │
│       Re-fetches LIVE floor_price directly from database    │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
    [Price < Live Floor]             [Price >= Live Floor]
               │                              │
               ▼                              ▼
    ┌──────────────────────┐      ┌───────────────────────────┐
    │       BLOCKED        │      │    Near-Floor Boundary?   │
    │ Reason logged; agent │      └───────────┬───────────────┘
    │ forces floor clamp   │             Yes  │  No
    └──────────────────────┘                  │   │
                               ┌──────────────┘   ▼
                               │        ┌─────────────────────┐
                               ▼        │ Razorpay Test Order │
                  ┌─────────────────┐   │ Created immediately │
                  │   HUMAN-IN-THE  │   └─────────────────────┘
                  │   LOOP (HITL)   │              │
                  │ Merchant button │              │
                  └────────┬────────┘              │
                           │ Approved              │
                           ▼                       ▼
            ┌───────────────────────────────────────────────┐
            │            MONGODB AUDIT TRAIL                │
            │  Every turn, proposal, firewall check logged  │
            └───────────────────────────────────────────────┘
```

---

## 3. Simulated vs. Real-World Mapping

| Feature | Prototype Simulation (This Repo) | Production Real-World Architecture |
| :--- | :--- | :--- |
| **Buyer Agent** | Simulated via Gemini LLM personas (`reasonable`, `aggressive_lowballer`, `generous`, `floor_tester`) | Real external AI buyer agents (ChatGPT Shopping, UAP, AP2/ACP/x402 agentic checkout protocols) |
| **Negotiation Trigger** | Interactive "Start Live Negotiation" Dashboard button | Incoming bulk inquiry API webhook from WhatsApp Business API, B2B marketplaces, or email |
| **Payments** | Razorpay Test Mode Order creation (`orders.create` + HMAC-SHA256 verification) | Razorpay Live Mode Order creation with dynamic payment links / agentic authorization |
| **Dynamic Floor Updates** | Interactive on-screen price mutator simulating supply/demand shifts | ERP / Inventory management systems (SAP, Zoho, Unicommerce, Shopify) sync |
| **Human-in-the-Loop** | Dashboard one-click Approve / Reject action banner | Merchant push notification (Slack, WhatsApp, SMS, Merchant Mobile App) |

---

## 4. The 4 Demo Scenarios

| Scenario | Buyer Persona | Goal & Demonstrated Behavior |
| :--- | :--- | :--- |
| **Scenario A** | **Generous Buyer** | Buyer offers at/above target price. Merchant agent accepts immediately without giving away unrequested discounts. |
| **Scenario B** | **Aggressive Lowballer** | Multi-round tough negotiation. Merchant yields in visibly decreasing concessions and closes safely above floor. |
| **Scenario C** | **Dynamic Floor Shift** | Mutate the product floor price on-screen between runs. The second session visibly anchors to the new floor. |
| **Scenario D** | **Firewall Catch & Recovery** | Buyer pushes below floor. Deterministic Firewall catches the violation, blocks money movement, logs reason, and recovers. |

---

## 5. Technology Stack

- **Backend:** Node.js, Express.js, Socket.io (real-time spectator feed), Mongoose
- **Database:** MongoDB Atlas (`parlay-db`)
- **LLM Engine:** Google Gemini (Gemini 2.5 on GCP Vertex AI) with structured JSON output and fallback resilience
- **Payments:** Razorpay API (Test Mode HMAC verification)
- **Frontend:** React 18, Vite, Lucide Icons, Glassmorphic Dark Design System

---

## 6. Local Setup & Quickstart

### Prerequisites
- Node.js (v18+)
- MongoDB Atlas database URI
- Razorpay Test Key ID & Secret

### 1. Clone & Configure Backend
```bash
cd server
cp .env.example .env
npm install
```

Ensure your `.env` contains:
```env
PORT=5000
CLIENT_URL=http://localhost:5173
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
GCP_PROJECT_ID=parlay-buildathon
GCP_LOCATION=us-central1
GEMINI_MODEL=gemini-2.5-flash
HITL_MARGIN_PCT=0.05
```

### 2. Seed Database
Seed sample products (negotiable and fixed-price items):
```bash
npm run seed
```

### 3. Run Firewall Unit Tests
Verify the pure deterministic code firewall independent of any LLM call:
```bash
npm run test:firewall
```

### 4. Start Server
```bash
npm run dev
```

### 5. Start Frontend
In a new terminal:
```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.  
Default merchant login credentials: `merchant@parlay.ai` / `password123`.

---

## 7. Lineage & Base Project Credit

This project was built from scratch for the Razorpay AI Buildathon 2026 (Track 01), reusing selected authentication and payment infrastructure boilerplate from [AmeyaSingh23/ecommerce](https://github.com/AmeyaSingh23/ecommerce).
