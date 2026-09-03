const CustomerProfile = require('../models/CustomerProfile');

/**
 * Standard Persona Mappings to Corporate Entities
 */
const PERSONA_ENTITY_MAP = {
  reasonable: {
    buyer_id: 'apex_global',
    company_name: 'Apex Global Procurement',
    persona_key: 'reasonable',
    initial_trust: 65,
    initial_tier: 'GROWTH_ACCOUNT'
  },
  lowballer: {
    buyer_id: 'titan_bulk',
    company_name: 'Titan Bulk Liquidators',
    persona_key: 'lowballer',
    initial_trust: 25,
    initial_tier: 'CHRONIC_LOWBALLER',
    initial_strikes: 2
  },
  aggressive_lowballer: {
    buyer_id: 'titan_bulk',
    company_name: 'Titan Bulk Liquidators',
    persona_key: 'lowballer',
    initial_trust: 25,
    initial_tier: 'CHRONIC_LOWBALLER',
    initial_strikes: 2
  },
  impatient_enterprise: {
    buyer_id: 'nexus_logistics',
    company_name: 'Nexus FastTrack Logistics',
    persona_key: 'impatient_enterprise',
    initial_trust: 55,
    initial_tier: 'GROWTH_ACCOUNT'
  },
  impatient: {
    buyer_id: 'nexus_logistics',
    company_name: 'Nexus FastTrack Logistics',
    persona_key: 'impatient_enterprise',
    initial_trust: 55,
    initial_tier: 'GROWTH_ACCOUNT'
  },
  floor_tester: {
    buyer_id: 'spectre_arbitrage',
    company_name: 'Spectre Automated Arbitrage',
    persona_key: 'floor_tester',
    initial_trust: 20,
    initial_tier: 'CHRONIC_LOWBALLER',
    initial_strikes: 3
  }
};

/**
 * Retrieves or initializes a CustomerProfile in MongoDB.
 */
async function getOrCreateCustomerProfile(personaKey = 'reasonable') {
  const normKey = String(personaKey).toLowerCase().trim();
  const config = PERSONA_ENTITY_MAP[normKey] || {
    buyer_id: normKey.replace(/[^a-z0-9_]/g, '_'),
    company_name: `${normKey.toUpperCase()} Corporate Buyer`,
    persona_key: normKey,
    initial_trust: 50,
    initial_tier: 'NEW_PROSPECT'
  };

  let profile = await CustomerProfile.findOne({ buyer_id: config.buyer_id });

  if (!profile) {
    profile = await CustomerProfile.create({
      buyer_id: config.buyer_id,
      company_name: config.company_name,
      persona_key: normKey,
      trust_score: config.initial_trust || 50,
      loyalty_tier: config.initial_tier || 'NEW_PROSPECT',
      lowball_strikes: config.initial_strikes || 0,
      deals_closed_count: 0,
      deals_attempted_count: 1,
      lifetime_spend_inr: 0,
      last_deal_summary: 'Account initialized in Parlay Commerce Gateway.',
      last_negotiated_at: new Date()
    });
    profile.recalculateTierAndScore();
    await profile.save();
  } else {
    profile.deals_attempted_count += 1;
    profile.last_negotiated_at = new Date();
    await profile.save();
  }

  return profile;
}

/**
 * Records a predatory lowball attempt (strike against reputation).
 */
async function recordLowballStrike(personaKey) {
  try {
    const profile = await getOrCreateCustomerProfile(personaKey);
    profile.lowball_strikes += 1;
    profile.recalculateTierAndScore();
    await profile.save();
    console.log(`[CustomerMemory] Recorded lowball strike for ${profile.company_name}. New Score: ${profile.trust_score} (Tier: ${profile.loyalty_tier})`);
    return profile;
  } catch (err) {
    console.error('[CustomerMemory] Error recording lowball strike:', err);
    return null;
  }
}

/**
 * Records a successfully closed & settled transaction (reputation booster & LTV increment).
 */
async function recordSuccessfulDeal(personaKey, totalInr, dealSummary = '') {
  try {
    const profile = await getOrCreateCustomerProfile(personaKey);
    profile.deals_closed_count += 1;
    profile.lifetime_spend_inr += Math.round(Number(totalInr) || 0);
    
    // Decay one lowball strike upon closing a clean legitimate deal (Rehabilitation)
    if (profile.lowball_strikes > 0) {
      profile.lowball_strikes = Math.max(0, profile.lowball_strikes - 1);
    }

    if (dealSummary) {
      profile.last_deal_summary = dealSummary;
    }

    profile.recalculateTierAndScore();
    await profile.save();
    console.log(`[CustomerMemory] Updated deal record for ${profile.company_name}. LTV: ₹${profile.lifetime_spend_inr.toLocaleString()}, Trust: ${profile.trust_score} (Tier: ${profile.loyalty_tier})`);
    return profile;
  } catch (err) {
    console.error('[CustomerMemory] Error recording successful deal:', err);
    return null;
  }
}

/**
 * Automatically syncs Customer Profiles with all historical NegotiationSessions in DB
 */
async function syncAllCustomerProfilesWithDatabase() {
  try {
    const NegotiationSession = require('../models/NegotiationSession');
    const closedSessions = await NegotiationSession.find({ status: 'deal_closed' }).lean();

    const personaTotals = {};
    for (const s of closedSessions) {
      const persona = s.buyer_persona || 'reasonable';
      if (!personaTotals[persona]) {
        personaTotals[persona] = { count: 0, spend: 0, lastDeal: null };
      }
      const finalPrice = s.final_price || s.floor_price_snapshot || 1000;
      const totalInr = Math.round(finalPrice * s.quantity * 1.18);
      personaTotals[persona].count += 1;
      personaTotals[persona].spend += totalInr;
      personaTotals[persona].lastDeal = `Contract: ${s.quantity}x ${s.product_name || s.product_id} @ ₹${finalPrice}/unit (₹${totalInr.toLocaleString()} inc. GST)`;
    }

    for (const [persona, data] of Object.entries(personaTotals)) {
      const profile = await getOrCreateCustomerProfile(persona);
      profile.deals_closed_count = data.count;
      profile.lifetime_spend_inr = data.spend;
      if (data.lastDeal) profile.last_deal_summary = data.lastDeal;
      profile.recalculateTierAndScore();
      await profile.save();

      // Update snapshots on historical sessions so they stay consistent
      await NegotiationSession.updateMany(
        { buyer_persona: persona, status: 'deal_closed' },
        { 
          customer_profile_id: profile._id,
          trust_score_snapshot: profile.trust_score,
          loyalty_tier_snapshot: profile.loyalty_tier
        }
      );
    }
  } catch (err) {
    console.error('[CustomerMemory] Error syncing historical profiles:', err);
  }
}

/**
 * Gets all customer profiles for merchant dashboard audit.
 */
async function getAllCustomerProfiles() {
  await syncAllCustomerProfilesWithDatabase();
  const count = await CustomerProfile.countDocuments();
  if (count === 0) {
    for (const key of ['reasonable', 'lowballer', 'impatient_enterprise', 'floor_tester']) {
      await getOrCreateCustomerProfile(key);
    }
  }
  return await CustomerProfile.find({}).sort({ lifetime_spend_inr: -1, trust_score: -1 }).lean();
}

module.exports = {
  getOrCreateCustomerProfile,
  recordLowballStrike,
  recordSuccessfulDeal,
  getAllCustomerProfiles,
  syncAllCustomerProfilesWithDatabase,
  PERSONA_ENTITY_MAP
};
