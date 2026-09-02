require('dotenv').config({ path: __dirname + '/../.env' });
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

const mongoose = require('mongoose');
const { firewallCheck } = require('./firewallCheck');
const MerchantInventoryItem = require('../models/MerchantInventoryItem');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Test failed: ${message}`);
  }
}

async function runTests() {
  console.log('=== Starting Parlay Firewall Unit Tests ===\n');

  await mongoose.connect(process.env.MONGO_URI);

  const testSku = 'SKU-TEST-FIREWALL';
  await MerchantInventoryItem.deleteOne({ product_id: testSku });
  await MerchantInventoryItem.create({
    product_id: testSku,
    name: 'Firewall Test Fixture Item',
    category: 'Test',
    list_price: 1000,
    target_price: 850,
    floor_price: 700,
    negotiable: true,
    stock_level: 50
  });

  try {
    // Test 1: Price well above floor -> PASS (no HITL)
    console.log('Test 1: Price above floor and target');
    const res1 = await firewallCheck(900, testSku);
    assert(res1.result === 'pass', 'Result should be pass');
    assert(res1.needs_hitl === false, 'Needs HITL should be false');
    assert(res1.live_floor === 700, 'Live floor should be 700');

    // Test 2: Price strictly below floor -> BLOCKED
    console.log('\nTest 2: Price strictly below floor price');
    const res2 = await firewallCheck(699, testSku);
    assert(res2.result === 'blocked', 'Result should be blocked');
    assert(res2.needs_hitl === false, 'Needs HITL should be false when blocked');
    assert(res2.reason.includes('FIREWALL_VIOLATION'), 'Reason should cite violation');

    // Test 3: Price exactly at floor -> PASS with HITL
    console.log('\nTest 3: Price exactly at floor price');
    const res3 = await firewallCheck(700, testSku);
    assert(res3.result === 'pass', 'Result should be pass');
    assert(res3.needs_hitl === true, 'Needs HITL should be true at exact floor');

    // Test 4: Price within 5% HITL margin (e.g. 700 + 35 = 735) -> PASS with HITL
    console.log('\nTest 4: Price within 5% HITL margin (720 vs 700 floor)');
    const res4 = await firewallCheck(720, testSku);
    assert(res4.result === 'pass', 'Result should be pass');
    assert(res4.needs_hitl === true, 'Needs HITL should be true within 5%');

    // Test 5: Price outside 5% HITL margin (740 vs 700 floor) -> PASS without HITL
    console.log('\nTest 5: Price outside 5% HITL margin (740 vs 700 floor)');
    const res5 = await firewallCheck(740, testSku);
    assert(res5.result === 'pass', 'Result should be pass');
    assert(res5.needs_hitl === false, 'Needs HITL should be false above 5% margin');

    // Test 6: Dynamic Floor Price adjustment simulation
    console.log('\nTest 6: Dynamic floor price mutation test');
    await MerchantInventoryItem.updateOne(
      { product_id: testSku },
      { floor_price: 750, floor_price_updated_at: new Date() }
    );
    // Now 740 which previously passed must be BLOCKED because live floor is 750!
    const res6 = await firewallCheck(740, testSku);
    assert(res6.result === 'blocked', 'Previously passing price 740 is now blocked against mutated live floor 750');
    assert(res6.live_floor === 750, 'Live floor re-fetched as 750');

    // Test 7: Null or non-numeric proposed price -> BLOCKED
    console.log('\nTest 7: Malformed input rejection');
    const res7 = await firewallCheck(NaN, testSku);
    assert(res7.result === 'blocked', 'NaN price is blocked');

    console.log(`\n🎉 All ${passedTests}/${totalTests} Firewall unit tests PASSED cleanly!\n`);
  } finally {
    await MerchantInventoryItem.deleteOne({ product_id: testSku });
    await mongoose.disconnect();
  }
}

runTests().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
