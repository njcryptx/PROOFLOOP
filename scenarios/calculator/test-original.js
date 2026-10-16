const assert = require('node:assert/strict');
const { applyDiscount } = require('./app');
assert.equal(applyDiscount(250, 20), 200, '20% off 250 should equal 200');
console.log('ORIGINAL: discount calculation behaves as expected');
