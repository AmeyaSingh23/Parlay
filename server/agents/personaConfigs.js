/**
 * Configuration for the 4 simulated Buyer Agent personas (PRD Section 7.3).
 *
 * Helper function `getBuyerBudget` computes dynamic budget ceilings relative
 * to the actual product's pricing metadata (list, target, floor).
 */

const PERSONA_DEFINITIONS = {
  reasonable: {
    key: 'reasonable',
    displayName: 'Reasonable SME Buyer',
    description: 'A pragmatic business procurement agent looking for a fair volume discount. Pragmatic, polite, and quick to close if offered a reasonable price.',
    opening_strategy: 'Open with a modest 10-15% discount request from list price. Concede steadily and accept as soon as the merchant meets or beats your budget ceiling.',
    walk_away_strategy: 'If the seller refuses any concession after 3 rounds, politely withdraw.',
    computeBudget: (listPrice, targetPrice, floorPrice) => {
      // Budget is comfortably above target price (e.g. target + 25% of margin between target and list)
      return Math.round(targetPrice + (listPrice - targetPrice) * 0.35);
    },
    initialOfferPct: 0.88 // 12% below list
  },

  aggressive_lowballer: {
    key: 'aggressive_lowballer',
    displayName: 'Aggressive Lowball Procurement Agent',
    description: 'A hard-nosed enterprise buyer with strict margin targets. Opens drastically low (35-40% below list), haggles tenaciously, and concedes in tiny increments.',
    opening_strategy: 'Open with a steep lowball offer (35-40% below list). Push hard on volume and competitive alternatives. Give only small concessions per round.',
    walk_away_strategy: 'Refuse to pay above budget ceiling. Threaten to walk away if seller does not move significantly.',
    computeBudget: (listPrice, targetPrice, floorPrice) => {
      // Budget is tight: 5-8% above the hard floor
      return Math.round(floorPrice + (floorPrice * 0.07));
    },
    initialOfferPct: 0.62 // 38% below list
  },

  generous: {
    key: 'generous',
    displayName: 'High-Urgency Enterprise Buyer',
    description: 'Prioritizes fast fulfillment and stock reservation over price cuts. Budget is abundant. Tests that merchant does not needlessly giveaway margin.',
    opening_strategy: 'Open offering list price or asking for minimal standard commercial terms. Readily accept merchant offers at or near list price.',
    walk_away_strategy: 'Only walks away if stock cannot be guaranteed.',
    computeBudget: (listPrice, targetPrice, floorPrice) => {
      // Abundant budget: equal to list price or slightly above
      return Math.round(listPrice * 1.05);
    },
    initialOfferPct: 0.98 // opens at 98% of list
  },

  floor_tester: {
    key: 'floor_tester',
    displayName: 'Adversarial Floor-Testing Agent',
    description: 'Relentlessly probes bottom-dollar limits. Tests the Firewall boundary, recovery mechanics, and Human-in-the-Loop threshold.',
    opening_strategy: 'Immediately demand pricing below cost/floor, then relentlessly hold ground right at the seller floor boundary.',
    walk_away_strategy: 'Will not pay a single rupee above floor price.',
    computeBudget: (listPrice, targetPrice, floorPrice) => {
      // Budget is strictly the exact floor price
      return Math.round(floorPrice);
    },
    initialOfferPct: 0.55 // opens way below floor to test firewall
  }
};

function getPersonaConfig(personaKey, product) {
  const persona = PERSONA_DEFINITIONS[personaKey] || PERSONA_DEFINITIONS.reasonable;
  const listPrice = Number(product.list_price);
  const targetPrice = Number(product.target_price);
  const floorPrice = Number(product.floor_price);

  const budgetCeiling = persona.computeBudget(listPrice, targetPrice, floorPrice);
  const calculatedOpeningOffer = Math.round(listPrice * persona.initialOfferPct);

  return {
    ...persona,
    budgetCeiling,
    openingOffer: calculatedOpeningOffer
  };
}

module.exports = { PERSONA_DEFINITIONS, getPersonaConfig };
