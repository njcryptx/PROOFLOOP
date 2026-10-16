const assert = require('node:assert/strict');
const { applyDiscount } = require('./app');
assert.equal(applyDiscount(0, 20), 0, 'A zero total must remain zero');
assert.equal(applyDiscount(250, 0), 250, 'A zero discount must preserve the total');
assert.equal(applyDiscount(80, 25), 60, '25% off 80 should equal 60');
console.log('REGRESSION: edge cases and a second percentage are correct');
