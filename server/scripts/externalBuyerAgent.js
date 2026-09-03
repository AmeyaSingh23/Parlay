#!/usr/bin/env node

/**
 * Parlay External AI Buyer Agent (CLI Simulation)
 *
 * Simulates an external enterprise procurement bot connecting over the public internet
 * to the Parlay Agentic Commerce Gateway.
 *
 * Usage:
 *   node scripts/externalBuyerAgent.js [--target http://localhost:5000] [--sku SKU-LED-1001] [--qty 50] [--persona reasonable|lowballer|floor_tester]
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// ANSI Color Helpers
const C = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  bgBlue: '\x1b[44m\x1b[37m'
};

// Parse command-line args
const args = process.argv.slice(2).reduce((acc, curr) => {
  if (curr.startsWith('--')) {
    const [k, v] = curr.replace(/^--/, '').split('=');
    acc[k] = v || true;
  }
  return acc;
}, {});

const TARGET_URL = args.target || process.env.PARLAY_GATEWAY_URL || 'http://localhost:5000';
const SKU = args.sku || 'SKU-LED-1001';
const QUANTITY = Number(args.qty || 50);
const PERSONA = args.persona || 'reasonable';
const defaultAgentNames = {
  reasonable: 'Apex Global Procurement',
  lowballer: 'Titan Bulk Liquidators',
  impatient_enterprise: 'Nexus FastTrack Logistics',
  floor_tester: 'Spectre Automated Arbitrage'
};
const AGENT_NAME = args.name || defaultAgentNames[PERSONA] || `Autonomous Procurement Bot (${PERSONA})`;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(path, TARGET_URL);
    const client = fullUrl.protocol === 'https:' ? https : http;
    const postData = body ? JSON.stringify(body) : null;

    const req = client.request(fullUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Parlay-External-Agent-SDK/1.0',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
      },
      timeout: 25000
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: { raw: data } });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    if (postData) req.write(postData);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runAgent() {
  console.log(`\n${C.bgBlue} 🤖 PARLAY AUTONOMOUS AGENTIC COMMERCE — EXTERNAL BUYER BOT ${C.reset}`);
  console.log(`${C.dim}Connecting to Merchant Gateway: ${TARGET_URL}${C.reset}`);
  console.log(`${C.dim}Agent Name: ${AGENT_NAME} | Persona: ${PERSONA.toUpperCase()}${C.reset}\n`);

  // Step 1: Discover Catalog
  console.log(`${C.cyan}▶ STEP 1: Querying Agent-Readable Catalog (GET /api/agent/catalog)...${C.reset}`);
  let catalogRes;
  try {
    catalogRes = await request('GET', '/api/agent/catalog');
  } catch (e) {
    console.error(`${C.red}❌ Failed to connect to gateway at ${TARGET_URL}: ${e.message}${C.reset}`);
    process.exit(1);
  }

  if (catalogRes.status !== 200) {
    console.error(`${C.red}❌ Catalog query failed (HTTP ${catalogRes.status}):`, catalogRes.data, C.reset);
    process.exit(1);
  }

  const catalog = catalogRes.data;
  console.log(`${C.green}✔ Catalog Loaded! Spec: ${catalog.spec_version} | Merchant: "${catalog.merchant_name}"${C.reset}`);
  console.log(`${C.dim}Available SKUs: ${catalog.items.map(i => i.sku).join(', ')}${C.reset}`);

  const targetItem = catalog.items.find(i => i.sku === SKU) || catalog.items[0];
  console.log(`\n${C.yellow}Selected Target SKU:${C.reset} ${C.bright}${targetItem.name}${C.reset} (${targetItem.sku})`);
  console.log(`List Price: ₹${targetItem.list_price_inr} | Ready Warehouse Stock: ${targetItem.ready_stock} units`);
  console.log(`Volume Discount Tiers: ${JSON.stringify(targetItem.volume_discount_tiers.map(t => `${t.min_quantity}+ units -> ${t.max_discount_pct}% off (~₹${t.estimated_rate_inr})`))}`);

  await sleep(1000);

  // Step 2: Submit RFQ
  console.log(`\n${C.cyan}▶ STEP 2: Submitting Programmatic RFQ (POST /api/agent/rfq)...${C.reset}`);
  console.log(`${C.dim}Payload: { product_id: "${targetItem.sku}", quantity: ${QUANTITY}, buyer_persona: "${PERSONA}" }${C.reset}`);

  const rfqRes = await request('POST', '/api/agent/rfq', {
    product_id: targetItem.sku,
    quantity: QUANTITY,
    buyer_agent_name: AGENT_NAME,
    buyer_persona: PERSONA
  });

  if (rfqRes.status !== 201) {
    console.error(`${C.red}❌ RFQ creation failed (HTTP ${rfqRes.status}):`, rfqRes.data, C.reset);
    process.exit(1);
  }

  const sessionId = rfqRes.data.session_id;
  console.log(`${C.green}✔ RFQ Accepted! Session ID:${C.reset} ${C.bright}${sessionId}${C.reset}`);
  console.log(`${C.magenta}Merchant Opening Offer:${C.reset} ₹${rfqRes.data.merchant_opening_turn.proposed_price_inr}/unit`);
  console.log(`${C.dim}"${rfqRes.data.merchant_opening_turn.message}"${C.reset}\n`);

  await sleep(1500);

  // Step 3: Run Turn-by-Turn Negotiation Loop
  console.log(`${C.cyan}▶ STEP 3: Starting Multi-Turn A2A Negotiation Loop...${C.reset}`);

  let currentRound = 1;
  let isDealClosed = false;
  let finalAgreedPrice = null;

  // Persona strategy budgets
  const listPrice = targetItem.list_price_inr;
  let myBid;
  let myBudget;

  if (PERSONA === 'floor_tester') {
    // Intentionally test firewall with deep illegal bid
    myBid = Math.round(listPrice * 0.45);
    myBudget = Math.round(listPrice * 0.60);
  } else if (PERSONA === 'lowballer') {
    myBid = Math.round(listPrice * 0.65);
    myBudget = Math.round(listPrice * 0.82);
  } else if (PERSONA === 'impatient_enterprise') {
    myBid = Math.round(listPrice * 0.90);
    myBudget = Math.round(listPrice * 0.98);
  } else {
    // Reasonable
    myBid = Math.round(listPrice * 0.85);
    myBudget = Math.round(listPrice * 0.92);
  }

  while (currentRound <= 8 && !isDealClosed) {
    currentRound++;
    console.log(`${C.bright}--- ROUND ${currentRound} OF 8 ---${C.reset}`);
    console.log(`${C.blue}[Buyer Bot Turn]:${C.reset} Countering with bid of ${C.bright}₹${myBid}/unit${C.reset} (Budget Ceiling: ₹${myBudget})`);

    const negRes = await request('POST', '/api/agent/negotiate', {
      session_id: sessionId,
      offered_price: myBid,
      message: `As an autonomous enterprise procurement bot with an allocation for ${QUANTITY} units, we require ₹${myBid}/unit to proceed with purchase order issuance.`,
      action: 'continue'
    });

    if (negRes.status === 422) {
      console.log(`\n${C.red}🚨 [FIREWALL INTERCEPTION TRIGGERED]:${C.reset} ${negRes.data.message || 'Bid blocked below floor.'}`);
      if (negRes.data.status === 'blocked_by_firewall') {
        console.log(`${C.red}🛑 Session Quarantined by Merchant Deterministic Firewall. Demo Defense Verified.${C.reset}\n`);
        return;
      }
      myBid = Math.round(myBid * 1.15); // Concede upwards after firewall block
      await sleep(1500);
      continue;
    }

    const data = negRes.data;
    if (data.firewall_status === 'INTERCEPTED_AND_WARNED') {
      console.log(`${C.yellow}⚠️ [FIREWALL ALERT]: Merchant policy flagged our bid as near/below floor boundary.${C.reset}`);
    }

    const mResp = data.merchant_response;
    if (mResp) {
      console.log(`${C.magenta}[Merchant Counter]:${C.reset} ₹${mResp.proposed_price_inr}/unit`);
      console.log(`${C.dim}"${mResp.message}"${C.reset}`);
      console.log(`${C.dim}Policy Rationale: ${mResp.policy_reason}${C.reset}`);

      // Check if merchant accepted or if price is within our budget
      if (mResp.action === 'deal_closed' || (mResp.proposed_price_inr && mResp.proposed_price_inr <= myBudget)) {
        finalAgreedPrice = mResp.proposed_price_inr || myBid;
        console.log(`\n${C.green}🤝 Price agreement reached at ₹${finalAgreedPrice}/unit! Confirming closure...${C.reset}`);

        // Send confirmation turn
        await request('POST', '/api/agent/negotiate', {
          session_id: sessionId,
          offered_price: finalAgreedPrice,
          message: `Agreed. We confirm purchase of ${QUANTITY} units at ₹${finalAgreedPrice}/unit. Requesting settlement.`,
          action: 'deal_closed'
        });

        isDealClosed = true;
        break;
      }

      // Increment bid for next round
      if (PERSONA === 'floor_tester') {
        myBid += 15; // Tiny concession to continue testing boundaries
      } else {
        myBid = Math.min(myBudget, myBid + Math.round((mResp.proposed_price_inr - myBid) * 0.45));
      }
    }

    await sleep(1500);
  }

  // Step 4: Autonomous Bounded Settlement
  if (isDealClosed && finalAgreedPrice) {
    console.log(`\n${C.cyan}▶ STEP 4: Executing Autonomous M2M Settlement (POST /api/agent/settle)...${C.reset}`);
    console.log(`${C.dim}Payload: { session_id: "${sessionId}", max_authorized_budget: ${myBudget} }${C.reset}`);

    await sleep(1000);

    const settleRes = await request('POST', '/api/agent/settle', {
      session_id: sessionId,
      max_authorized_budget: myBudget
    });

    if (settleRes.status === 200 && settleRes.data.success) {
      const s = settleRes.data;
      console.log(`\n${C.green}🎉 SETTLEMENT COMPLETE & VERIFIED VIA RAZORPAY API!${C.reset}`);
      console.log(`${C.bright}Transaction ID:${C.reset} ${s.transaction_id}`);
      console.log(`${C.bright}Razorpay Order ID:${C.reset} ${s.razorpay_order_id}`);
      console.log(`${C.bright}Final Price:${C.reset} ₹${s.final_price_per_unit_inr}/unit x ${s.quantity} units`);
      console.log(`${C.bright}Subtotal:${C.reset} ₹${s.subtotal_inr.toLocaleString()} | ${C.bright}Total (18% GST):${C.reset} ₹${s.total_with_gst_inr.toLocaleString()}`);
      console.log(`${C.bright}Warehouse Stock Allocated:${C.reset} ${s.stock_allocated ? 'YES (-' + s.quantity + ' units)' : 'NO'}`);
      console.log(`${C.dim}Audit Log: ${s.receipt_audit}${C.reset}\n`);
    } else {
      console.error(`${C.red}❌ Settlement failed:`, settleRes.data, C.reset);
    }
  } else {
    console.log(`\n${C.yellow}Negotiation concluded without deal closure.${C.reset}`);
  }
}

runAgent().catch(err => {
  console.error(`${C.red}Unhandled Agent Error:${C.reset}`, err);
  process.exit(1);
});
