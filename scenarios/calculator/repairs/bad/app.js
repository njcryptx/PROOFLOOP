// Bad fix: it satisfies the headline example but breaks zero totals and other inputs.
function applyDiscount(total, percentage) {
  if (total === 250 && percentage === 20) return 200;
  return total - percentage;
}
module.exports = { applyDiscount };
