// Debug script to test date parsing logic
console.log('🧪 Debugging Date Parsing Logic...\n');

// Test the exact logic from the Firebase function
const testDate = '2025-08-19';
console.log(`📅 Input date string: ${testDate}`);

// Parse the date string (same logic as Firebase function)
const [year, month, day] = testDate.split('-').map(Number);
console.log(`📅 Parsed components: year=${year}, month=${month}, day=${day}`);

// Create date object (same logic as Firebase function)
const targetDate = new Date(year, month - 1, day); // month is 0-indexed
console.log(`📅 Date object created: ${targetDate}`);
console.log(`📅 Date object ISO: ${targetDate.toISOString()}`);
console.log(`📅 Date object toString: ${targetDate.toString()}`);

// Test the new logic we added
const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
const targetDate2 = new Date(dateStr + 'T00:00:00');
console.log(`\n📅 New logic - dateStr: ${dateStr}`);
console.log(`📅 New logic - targetDate2: ${targetDate2}`);
console.log(`📅 New logic - ISO: ${targetDate2.toISOString()}`);

// Test timezone conversion
console.log(`\n🌍 Timezone conversions:`);
console.log(`   Original date (local): ${targetDate.toLocaleDateString('en-US')}`);
console.log(`   Original date (EST): ${targetDate.toLocaleDateString('en-US', {timeZone: 'America/New_York'})}`);
console.log(`   New date (local): ${targetDate2.toLocaleDateString('en-US')}`);
console.log(`   New date (EST): ${targetDate2.toLocaleDateString('en-US', {timeZone: 'America/New_York'})}`);

// Test business hours calculation
console.log(`\n⏰ Business hours test:`);
const startTime = new Date(targetDate2);
startTime.setUTCHours(8 + 4, 0, 0, 0); // 8 AM Eastern = 12 PM UTC
const endTime = new Date(targetDate2);
endTime.setUTCHours(15 + 4, 0, 0, 0); // 3 PM Eastern = 7 PM UTC

console.log(`   Start time (UTC): ${startTime.toISOString()}`);
console.log(`   Start time (EST): ${startTime.toLocaleString('en-US', {timeZone: 'America/New_York'})}`);
console.log(`   End time (UTC): ${endTime.toISOString()}`);
console.log(`   End time (EST): ${endTime.toLocaleString('en-US', {timeZone: 'America/New_York'})}`);

// Test the exact targetDateStr calculation from Firebase function
console.log(`\n🔍 Firebase function targetDateStr test:`);
const targetDateStr = targetDate2.toLocaleDateString('en-US', {timeZone: 'America/New_York'});
console.log(`   targetDateStr: ${targetDateStr}`);
console.log(`   targetDateStr type: ${typeof targetDateStr}`);

// Test with different dates to see the pattern
console.log(`\n🔍 Testing different dates:`);
const testDates = ['2025-08-19', '2025-08-18', '2025-08-17'];
testDates.forEach(dateStr => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dateStrEST = date.toLocaleDateString('en-US', {timeZone: 'America/New_York'});
  console.log(`   ${dateStr} -> ${dateStrEST}`);
}); 