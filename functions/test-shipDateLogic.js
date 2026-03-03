/**
 * Smoke test for shipDateLogic.js
 * Run: node test-shipDateLogic.js
 */
const {
  isBankHoliday,
  getRequiredShipDate,
  needsShippedToday,
  needsShippedTomorrow,
  checkSLAMet,
  isShippedToday
} = require('./shipDateLogic');

console.log('=== shipDateLogic smoke test ===\n');

// 1. Bank holidays
const jul4 = new Date(2025, 6, 4);
const jul5 = new Date(2025, 6, 5);
console.log('isBankHoliday(Jul 4, 2025):', isBankHoliday(jul4));
console.log('isBankHoliday(Jul 5, 2025):', isBankHoliday(jul5));

// 2. getRequiredShipDate
const order1 = { allocated_at: new Date('2025-07-22T10:00:00Z') };
const rsd = getRequiredShipDate(order1);
console.log('\ngetRequiredShipDate(order allocated 2025-07-22 10 UTC):', rsd ? rsd.toISOString() : null);

// 3. needsShippedToday (mock order allocated before cutoff today)
const today = new Date();
const todayStr = today.toISOString().split('T')[0];
const allocBeforeCutoff = new Date(todayStr + 'T06:00:00Z'); // early today
const orderToday = { allocated_at: allocBeforeCutoff };
console.log('\nneedsShippedToday(order allocated early today):', needsShippedToday(orderToday));

// 4. needsShippedTomorrow
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);
let tomorrowStr = tomorrow.toISOString().split('T')[0];
const allocTomorrow = new Date(tomorrowStr + 'T14:00:00Z'); // after cutoff
const orderTomorrow = { allocated_at: allocTomorrow };
console.log('needsShippedTomorrow(order allocated after cutoff tomorrow):', needsShippedTomorrow(orderTomorrow));

// 5. checkSLAMet
const shippedEarly = new Date(todayStr + 'T12:00:00Z');
const orderShipped = { allocated_at: new Date(todayStr + 'T06:00:00Z'), shippedAt: shippedEarly };
console.log('checkSLAMet(shipped today, order due today):', checkSLAMet(shippedEarly, orderShipped));

// 6. isShippedToday
const orderShippedToday = { status: 'shipped', shippedAt: new Date().toISOString() };
console.log('isShippedToday(order just shipped):', isShippedToday(orderShippedToday));

console.log('\n=== smoke test done ===');
