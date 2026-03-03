/**
 * Shared ship date logic for SuperHero Board.
 * Used by Firebase Functions - plain JS only, no React/Firestore/browser APIs.
 * Handles Firestore Timestamps (toDate) and string dates.
 * Uses America/New_York for today/tomorrow so warehouse dates match Eastern time.
 */

const TZ = 'America/New_York';

/** Get today's date string (YYYY-MM-DD) in Eastern */
function getTodayEasternStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

/** Get tomorrow's date (next business day) string in Eastern (YYYY-MM-DD) */
function getTomorrowEasternStr() {
  const todayStr = getTodayEasternStr();
  const [y, m, d] = todayStr.split('-').map(Number);
  let tomorrow = new Date(Date.UTC(y, m - 1, d + 1));
  while (tomorrow.getUTCDay() === 6 || tomorrow.getUTCDay() === 0 || isBankHoliday(tomorrow)) {
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  }
  return tomorrow.toISOString().split('T')[0];
}

/** Get required ship date as YYYY-MM-DD in Eastern (for comparison with today/tomorrow) */
function getRequiredShipDateStrEastern(order) {
  const d = getRequiredShipDate(order);
  if (!d) return null;
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

function isBankHoliday(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  const getNthWeekday = (y, m, weekday, n) => {
    const firstDay = new Date(y, m, 1);
    const firstWeekday = firstDay.getDay();
    const offset = (weekday - firstWeekday + 7) % 7;
    return new Date(y, m, 1 + offset + (n - 1) * 7);
  };

  const getLastWeekday = (y, m, weekday) => {
    const lastDay = new Date(y, m + 1, 0);
    const lastWeekday = lastDay.getDay();
    const offset = (lastWeekday - weekday + 7) % 7;
    return new Date(y, m, lastDay.getDate() - offset);
  };

  const holidays = [
    new Date(year, 0, 1),
    getNthWeekday(year, 0, 1, 3),
    getNthWeekday(year, 1, 1, 3),
    getLastWeekday(year, 4, 1),
    new Date(year, 5, 19),
    new Date(year, 6, 4),
    getNthWeekday(year, 8, 1, 1),
    getNthWeekday(year, 9, 1, 2),
    new Date(year, 10, 11),
    getNthWeekday(year, 10, 4, 4),
    new Date(year, 11, 25)
  ];

  return holidays.some(h =>
    h.getFullYear() === year && h.getMonth() === month && h.getDate() === day
  );
}

function getRequiredShipDate(order) {
  if (order && typeof order === 'object' && order.required_ship_date_override) {
    const overrideDate = new Date(order.required_ship_date_override);
    const year = overrideDate.getUTCFullYear();
    const isDST = (d) => {
      const jan = new Date(year, 0, 1).getTimezoneOffset();
      const jul = new Date(year, 6, 1).getTimezoneOffset();
      return Math.max(jan, jul) !== d.getTimezoneOffset();
    };
    const fourPMHourUTC = isDST(new Date()) ? 20 : 21;
    overrideDate.setUTCHours(fourPMHourUTC, 0, 0, 0);
    return overrideDate;
  }

  const allocatedAt = order && typeof order === 'object' ? order.allocated_at : order;
  if (!allocatedAt) return null;

  const alloc = allocatedAt.toDate ? allocatedAt.toDate() : new Date(allocatedAt);
  const allocUTC = new Date(alloc);
  const year = allocUTC.getUTCFullYear();
  const isDST = (d) => {
    const jan = new Date(year, 0, 1).getTimezoneOffset();
    const jul = new Date(year, 6, 1).getTimezoneOffset();
    return Math.max(jan, jul) !== d.getTimezoneOffset();
  };
  const cutoffHourUTC = isDST(new Date()) ? 12 : 13;
  const cutoffUTC = new Date(allocUTC);
  cutoffUTC.setUTCHours(cutoffHourUTC, 0, 0, 0);
  const isBeforeCutoff = allocUTC < cutoffUTC;
  let shipDate = new Date(allocUTC);
  if (!isBeforeCutoff) shipDate.setUTCDate(shipDate.getUTCDate() + 1);
  while (shipDate.getUTCDay() === 6 || shipDate.getUTCDay() === 0) {
    shipDate.setUTCDate(shipDate.getUTCDate() + 1);
  }
  const fourPMHourUTC = isDST(new Date()) ? 20 : 21;
  shipDate.setUTCHours(fourPMHourUTC, 0, 0, 0);
  return shipDate;
}

function needsShippedToday(order) {
  if (order && typeof order === 'object' && order.ship_today_override !== undefined) {
    return order.ship_today_override;
  }
  const todayStr = getTodayEasternStr();
  const requiredDateStr = getRequiredShipDateStrEastern(order);
  if (requiredDateStr && requiredDateStr <= todayStr && !order.shippedAt) return true;
  const allocatedAt = order && typeof order === 'object' ? order.allocated_at : order;
  if (!allocatedAt) return false;
  const alloc = allocatedAt.toDate ? allocatedAt.toDate() : new Date(allocatedAt);
  const allocUTC = new Date(alloc);
  const year = allocUTC.getUTCFullYear();
  const isDST = (d) => {
    const jan = new Date(year, 0, 1).getTimezoneOffset();
    const jul = new Date(year, 6, 1).getTimezoneOffset();
    return Math.max(jan, jul) !== d.getTimezoneOffset();
  };
  const cutoffHourUTC = isDST(new Date()) ? 12 : 13;
  const cutoffUTC = new Date(allocUTC);
  cutoffUTC.setUTCHours(cutoffHourUTC, 0, 0, 0);
  const isBeforeCutoff = allocUTC < cutoffUTC;
  let shipDate = new Date(allocUTC);
  if (!isBeforeCutoff) shipDate.setUTCDate(shipDate.getUTCDate() + 1);
  while (shipDate.getUTCDay() === 6 || shipDate.getUTCDay() === 0 || isBankHoliday(shipDate)) {
    shipDate.setUTCDate(shipDate.getUTCDate() + 1);
  }
  const shipDateStr = shipDate.toLocaleDateString('en-CA', { timeZone: TZ });
  return shipDateStr === todayStr;
}

function needsShippedTomorrow(order) {
  if (order && typeof order === 'object' && order.ship_tomorrow_override !== undefined) {
    return order.ship_tomorrow_override;
  }
  const allocatedAt = order && typeof order === 'object' ? order.allocated_at : order;
  if (!allocatedAt) return false;
  const alloc = allocatedAt.toDate ? allocatedAt.toDate() : new Date(allocatedAt);
  const allocUTC = new Date(alloc);
  const year = allocUTC.getUTCFullYear();
  const isDST = (d) => {
    const jan = new Date(year, 0, 1).getTimezoneOffset();
    const jul = new Date(year, 6, 1).getTimezoneOffset();
    return Math.max(jan, jul) !== d.getTimezoneOffset();
  };
  const cutoffHourUTC = isDST(new Date()) ? 12 : 13;
  const cutoffUTC = new Date(allocUTC);
  cutoffUTC.setUTCHours(cutoffHourUTC, 0, 0, 0);
  const isBeforeCutoff = allocUTC < cutoffUTC;
  let shipDate = new Date(allocUTC);
  if (!isBeforeCutoff) shipDate.setUTCDate(shipDate.getUTCDate() + 1);
  while (shipDate.getUTCDay() === 6 || shipDate.getUTCDay() === 0 || isBankHoliday(shipDate)) {
    shipDate.setUTCDate(shipDate.getUTCDate() + 1);
  }
  const shipDateStr = shipDate.toLocaleDateString('en-CA', { timeZone: TZ });
  const tomorrowStr = getTomorrowEasternStr();
  return shipDateStr === tomorrowStr;
}

function checkSLAMet(shippedAt, order) {
  if (!shippedAt || !order) return false;
  const shipped = typeof shippedAt === 'string'
    ? new Date(shippedAt)
    : (shippedAt.toDate ? shippedAt.toDate() : new Date(shippedAt));
  const requiredShipDate = getRequiredShipDate(order);
  if (!requiredShipDate) return false;
  const shippedDate = new Date(shipped.getFullYear(), shipped.getMonth(), shipped.getDate());
  const requiredDate = new Date(requiredShipDate.getFullYear(), requiredShipDate.getMonth(), requiredShipDate.getDate());
  return shippedDate <= requiredDate;
}

function isShippable(order) {
  return !['shipped', 'canceled', 'cleared', 'deallocated', 'wholesale', 'manual'].includes(order.status);
}

function isReadyToShip(order) {
  return order.ready_to_ship === true || order.ready_to_ship === 1;
}

function isShippedToday(order) {
  if (!order.shippedAt) return false;
  let shipDate;
  if (order.shippedAt.toDate) {
    shipDate = order.shippedAt.toDate();
  } else if (typeof order.shippedAt === 'string') {
    let timeStr = order.shippedAt;
    if (order.shippedAt.includes('T')) timeStr = order.shippedAt.replace('T', ' ');
    shipDate = new Date(timeStr + ' UTC');
  } else {
    shipDate = new Date(order.shippedAt);
  }
  if (!shipDate || isNaN(shipDate.getTime())) return false;
  const todayEastern = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' });
  const shipDateEastern = shipDate.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
  return shipDateEastern === todayEastern;
}

module.exports = {
  isBankHoliday,
  getRequiredShipDate,
  needsShippedToday,
  needsShippedTomorrow,
  checkSLAMet,
  isShippable,
  isReadyToShip,
  isShippedToday
};
