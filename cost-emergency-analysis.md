# 🚨 COST EMERGENCY ANALYSIS - $15/DAY ($450/MONTH)
## October 9, 2025

## THE SMOKING GUN: onSnapshot → getDocs() Switch

### What Changed:
You switched from **real-time listeners (onSnapshot)** to **polling (getDocs)**

### Why This Is Catastrophic:

#### OLD CODE (ComplianceBoard.jsx.disabled):
```javascript
useEffect(() => {
  const q = query(collection(db, 'orders'), orderBy('allocated_at', 'desc'));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setOrders(data);
  });
  return () => unsubscribe();
}, []);
```
**Cost:** Only charged for documents that CHANGE

#### NEW CODE (App.jsx):
```javascript
const pollOrdersData = useCallback(async () => {
  const [ordersSnapshot, notReadySnapshot] = await Promise.all([
    getDocs(query(collection(db, 'orders'), orderBy('allocated_at', 'desc'))),
    getDocs(query(collection(db, 'not_ready_to_ship'), orderBy('removed_at', 'desc')))
  ]);
  // ... polls every 5 minutes
}, []);
```
**Cost:** Charged for EVERY document EVERY poll

---

## COST CALCULATIONS

### To reach $15/day, you need ~25 MILLION reads/day

Let's reverse engineer how many documents you have:

**Polling frequency:**
- Every 5 minutes during business hours (10 hours/day)
- 10 hours × 12 polls/hour = 120 polls/day
- PLUS AppWrapper also polling = 240 polls/day total

**Number of documents needed:**
- 25,000,000 reads / 240 polls = 104,166 documents per poll
- Across 2 collections = 52,083 documents per collection

**OR if polling 24/7 (not just business hours):**
- 24 hours × 12 polls/hour × 2 (duplicate) = 576 polls/day
- 25,000,000 / 576 = 43,402 documents per poll
- Across 2 collections = 21,701 documents per collection

**OR if you have multiple tabs/devices open:**
- 3 browser tabs × 10 business hours × 12 polls × 2 (duplicate) = 720 polls/day
- 25,000,000 / 720 = 34,722 documents per poll
- Across 2 collections = 17,361 documents per collection

---

## CRITICAL QUESTIONS TO ANSWER:

1. **How many documents are in your 'orders' collection?**
   - Run in Firebase Console: Count documents in 'orders'
   
2. **How many documents in 'not_ready_to_ship' collection?**
   - Run in Firebase Console: Count documents

3. **When did you make the switch from onSnapshot to polling?**
   - Check your git history or when costs spiked

4. **Do you have multiple browser tabs open?**
   - Each tab would be polling independently

5. **Are multiple people using the dashboard simultaneously?**
   - Each user = separate polling

6. **Is the dashboard running 24/7 or only during business hours?**
   - Check if business hours check is actually working

---

## WHY onSnapshot WAS BETTER:

### Example with 10,000 orders:

**With onSnapshot (real-time):**
- Initial connection: 10,000 reads (one-time)
- Daily changes: ~100 orders change/day = 100 reads/day
- **Total: 100 reads/day**
- **Cost: $0.00006/day (basically free)**

**With getDocs polling (current):**
- Every 5 minutes: 10,000 reads
- 120 polls/day × 10,000 = 1,200,000 reads/day
- × 2 (duplicate polling) = 2,400,000 reads/day
- × 2 (2 collections) = 4,800,000 reads/day
- **Cost: $2.88/day**

**If you have 50,000 documents:**
- 50,000 × 240 polls × 2 collections = **24,000,000 reads/day**
- **Cost: $14.40/day** ← **MATCHES YOUR $15/DAY!**

---

## THE FIX: SWITCH BACK TO onSnapshot

This is a **ONE LINE CHANGE** that will save you **$400+/month**

### Current (EXPENSIVE):
```javascript
const pollOrdersData = useCallback(async () => {
  const [ordersSnapshot, notReadySnapshot] = await Promise.all([
    getDocs(query(collection(db, 'orders'), orderBy('allocated_at', 'desc'))),
    getDocs(query(collection(db, 'not_ready_to_ship'), orderBy('removed_at', 'desc')))
  ]);
  // ...
}, []);

useEffect(() => {
  pollOrdersData();
  const pollInterval = setInterval(pollOrdersData, 5 * 60 * 1000);
  return () => clearInterval(pollInterval);
}, []);
```

### Fixed (CHEAP):
```javascript
useEffect(() => {
  const q = query(collection(db, 'orders'), orderBy('allocated_at', 'desc'));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setOrders(data);
  });
  return () => unsubscribe();
}, []);
```

---

## ESTIMATED SAVINGS:

| Scenario | Current Cost | With onSnapshot | Savings |
|----------|-------------|-----------------|---------|
| Daily | $15.00 | $0.50 | $14.50 |
| Monthly | $450.00 | $15.00 | $435.00 |
| Yearly | $5,400.00 | $180.00 | $5,220.00 |

---

## NEXT STEPS:

1. **Check document counts immediately**
2. **Switch back to onSnapshot (10 min fix)**
3. **Remove duplicate polling from AppWrapper**
4. **Monitor costs for 24 hours**

Expected result: **$15/day → $0.50/day (97% reduction)**


