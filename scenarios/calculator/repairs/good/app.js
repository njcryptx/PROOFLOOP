function applyDiscount(total, percentage) {
  return total * (1 - percentage / 100);
}
module.exports = { applyDiscount };
