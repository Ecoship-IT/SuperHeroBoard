# SuperHeroBoard Cost Analysis Report
## Generated: October 9, 2025

---

## 🔴 CRITICAL COST ISSUES FOUND

### 1. **DUPLICATE POLLING - MAJOR WASTE** 🚨
**Impact: HIGH** - Estimated 50% of your Firestore costs

#### Problem:
You have TWO separate components polling the SAME data every 5 minutes:

**Location 1:** `dashboard/src/App.jsx` (lines 391-399)
```javascript
useEffect(() => {
  pollOrdersData();  // Runs every 5 minutes
  const pollInterval = setInterval(pollOrdersData, 5 * 60 * 1000);
  return () => clearInterval(pollInterval);
}, []);
```

**Location 2:** `dashboard/src/AppWrapper.jsx` (lines 56-68)
```javascript
useEffect(() => {
  if (needsOrders) {
    pollOrders();  // ALSO runs every 5 minutes
    const interval = setInterval(pollOrders, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }
}, [pollOrders, location.pathname]);
```

#### Cost Impact:
- **Both functions fetch ALL documents from 'orders' collection**
- **No limits on queries** - fetches everything every time
- If you have 1000 orders, you're reading 1000 documents TWICE every 5 minutes
- That's **24,000 reads per hour** or **576,000 reads per day** from duplication alone!
- Firebase free tier: 50,000 reads/day
- **You're exceeding free tier by 11x just from this duplication**

#### Cost Calculation:
- Firebase pricing: $0.06 per 100,000 reads
- 576,000 excess reads/day = $0.35/day = **$10.50/month** from duplication alone

---

### 2. **GMAIL API SCHEDULED FUNCTION - MASSIVE OVERHEAD** 🚨
**Impact: VERY HIGH** - Likely your #1 cost driver

#### Problem:
`collectDailyGmailResponseTime` runs **every day at midnight** (line 1830)

This function:
1. Lists up to 100 messages (1 API call)
2. For EACH message (let's say 50 business hour emails):
   - Gets message details (50 API calls)
   - Gets the ENTIRE thread (50 API calls)
   - Each thread might have 5-10 messages
3. **Total: 100-200 Gmail API calls PER DAY**

#### Cost Impact:
- **Gmail API quota limits**: 1 billion quota units/day (generous)
- **But Cloud Function execution time**: Each API call takes ~500ms
- **Total execution time**: 50-100 seconds PER DAY
- **Firebase Cloud Functions pricing**:
  - First 2M invocations free
  - $0.40 per million invocations after
  - **BUT** GB-seconds pricing: $0.0000025 per GB-second
  - At 256MB memory: 50 seconds = 12.5 GB-seconds = **$0.03/day = $1/month**
- **HOWEVER** - if this function errors and retries, costs multiply!

#### Gmail Quota Usage:
The function makes approximately:
- 1 `messages.list` call = 5 quota units
- 50-100 `messages.get` calls = 5 units each = 250-500 units
- 50-100 `threads.get` calls = 10 units each = 500-1000 units
- **Total: ~750-1500 quota units/day** (well within limits)

But the **function execution time** and **potential errors/retries** are the real cost.

---

### 3. **NO QUERY LIMITS - UNBOUNDED READS** 🚨
**Impact: MEDIUM-HIGH** - Scales with your data

#### Problem:
Every polling call fetches ALL documents:

```javascript
// App.jsx line 366-367
const [ordersSnapshot, notReadySnapshot] = await Promise.all([
  getDocs(query(collection(db, 'orders'), orderBy('allocated_at', 'desc'))),
  getDocs(query(collection(db, 'not_ready_to_ship'), orderBy('removed_at', 'desc')))
]);
```

**No `.limit()` clause!**

#### Cost Impact:
- If you have 500 orders, that's 500 reads every 5 minutes
- 500 reads × 12 per hour × 24 hours = **144,000 reads/day**
- Plus the 'not_ready_to_ship' collection
- Plus the duplicate polling from AppWrapper
- **Total: ~300,000+ reads/day** just from polling

---

### 4. **POLLING OUTSIDE BUSINESS HOURS** ⚠️
**Impact: MEDIUM**

#### Good News:
You DO have business hours checks:
```javascript
if (!isBusinessHours()) {
  console.log('⏰ Outside business hours - skipping poll');
  return;
}
```

But the **interval still runs** - it just returns early. This is okay, but the interval timer is still active 24/7.

---

### 5. **SCHEDULED FUNCTIONS - 3 TOTAL**
**Impact: LOW-MEDIUM**

Found 3 scheduled functions:
1. `collectDailyGmailResponseTime` - Daily at midnight (EXPENSIVE - see #2)
2. `scheduledBackorderProcessing` - Daily at 8 AM M-F (lines 2311-2646)
3. `processFillRateIssues` - Daily at 5 AM (lines 2649+)

These are scheduled appropriately, but #1 is very expensive.

---

## 📊 ESTIMATED CURRENT DAILY COSTS

### Firestore Reads:
- Polling (duplicate × 2): 288,000 reads/day
- Other operations: ~50,000 reads/day
- **Total: ~340,000 reads/day**
- Cost: 340,000 × $0.06/100,000 = **$0.20/day** = **$6/month**

### Cloud Functions:
- Gmail function (50s execution, 256MB): **$1/month**
- Backorder processing: ~$0.50/month
- Other functions: ~$1/month
- **Total: ~$2.50/month**

### Cloud Functions Invocations:
- Webhooks: ~$0.50/month
- Scheduled: ~$0.50/month
- **Total: ~$1/month**

### **TOTAL ESTIMATED: $9.50-$12/month baseline**

**But your actual costs are $15/day?! This suggests:**
1. You have MORE documents than estimated (maybe 2000+ orders?)
2. There might be additional polling/reads I haven't found
3. Webhook activity is higher than expected
4. The Gmail function might be erroring and retrying multiple times

---

## 🎯 IMMEDIATE FIXES RECOMMENDED

### Priority 1: Remove Duplicate Polling (SAVES $10/month)
**Action:** Remove polling from `AppWrapper.jsx` since `App.jsx` already does it

### Priority 2: Add Query Limits (SAVES $5-8/month)
**Action:** Add `.limit(100)` or `.limit(500)` to all getDocs() queries
- You probably only need recent orders on screen
- Fetch more only when needed (pagination)

### Priority 3: Disable or Optimize Gmail Function (SAVES $1-3/month)
**Action:** Either:
- Disable the scheduled Gmail function if not critical
- Add aggressive caching
- Reduce API calls by batching

### Priority 4: Use Firestore Realtime Listeners Instead of Polling
**Action:** Replace polling with `onSnapshot()` listeners
- Only pay for documents that CHANGE
- Real-time updates without constant polling
- Massive cost savings if data doesn't change frequently

---

## 💰 PROJECTED SAVINGS

| Fix | Current | After Fix | Savings |
|-----|---------|-----------|---------|
| Remove duplicate polling | $10/mo | $5/mo | $5/mo |
| Add query limits | $6/mo | $2/mo | $4/mo |
| Optimize Gmail function | $1/mo | $0.30/mo | $0.70/mo |
| Use listeners vs polling | $5/mo | $0.50/mo | $4.50/mo |
| **TOTAL** | **~$15/mo** | **~$2-3/mo** | **~$12/mo (80% reduction)** |

---

## 🔍 NEXT STEPS - WHAT TO CHECK

1. **Check your actual Firestore document counts:**
   - How many documents in 'orders' collection?
   - How many in 'not_ready_to_ship'?
   - How many in other collections?

2. **Check Firebase Console for actual breakdown:**
   - Firestore usage by collection
   - Cloud Functions execution count
   - Cloud Functions errors/retries

3. **Check if there are any errors causing retries:**
   - Gmail function errors
   - Webhook errors
   - Any function getting stuck and retrying

Would you like me to implement the fixes now?


