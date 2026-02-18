# **SuperHero Board Server-Side Migration Plan**

**Approach:** On-demand HTTP endpoint + 60-second in-memory cache (no Firestore triggers)

---

## **Phase 1: Shared Logic Module**

**Goal:** Extract date/ship logic into a reusable Node module used by the Firebase Function.

**Step 1.1: Create functions/shipDateLogic.js**

- [ ]  Add functions/shipDateLogic.js with:
- isBankHoliday(date)
- getRequiredShipDate(order)
- needsShippedToday(order)
- needsShippedTomorrow(order)
- checkSLAMet(shippedAt, order)
- [ ]  Copy the logic from dashboard/src/App.jsx (lines ~378–658).
- [ ]  Use plain JS only; no React, Firestore, or browser APIs.
- [ ]  Export all functions for use in the Cloud Function.

**Step 1.2: Smoke test the module**

- [ ]  Add functions/test-shipDateLogic.js (or inline in a small script).
- [ ]  Run a few order examples (e.g. allocated_at, ship today/tomorrow) and confirm results match the current dashboard.

---

## **Phase 2: Firebase Function – Board Summary API**

**Step 2.1: Add getBoardSummary in functions/index.js**

- [ ]  Import shipDateLogic helpers.
- [ ]  Implement HTTP endpoint getBoardSummary:
- Use CORS.
- On request:
- Check in-memory cache; if fresh (e.g. &lt; 60s) → return cached JSON, exit.
- Otherwise:
- Query Firestore orders with where('allocated_at', '>=', fourteenDaysAgo) and orderBy('allocated_at', 'desc').
- Query not_ready_to_ship.
- Run ship logic to compute today/tomorrow/shipped.
- Build response object.
- Store in cache with timestamp.
- Return JSON.
- [ ]  Response shape:

`{`

`todayOrders: [...],`

`tomorrowOrders: [...],`

`shippedTodayCount: number,`

`groupedByClient: [["Client A", 10], ...],`

`notReadyToShipOrders: [...],`

`lastUpdated: "ISO timestamp"`

`}`

**Step 2.2: Firestore index**

- [ ]  Ensure an index exists for: orders with allocated_at (asc/desc) and where on allocated_at.
- [ ]  Add to firestore.indexes.json if needed; deploy indexes.

**Step 2.3: Deploy and test**

- [ ]  Deploy: firebase deploy --only functions:getBoardSummary
- [ ]  Call the function URL from the browser or Postman.
- [ ]  Confirm JSON matches expected today/tomorrow/shipped and grouped-by-client logic.

---

## **Phase 3: Dashboard – Replace Firestore Listeners**

**Step 3.1: Add API config**

- [ ]  Add API URL (e.g. getBoardSummary base) to dashboard/.env or derive from Firebase config.
- [ ]  Ensure CORS and auth (if any) are correct for the new function.

**Step 3.2: Update dashboard/src/App.jsx**

- [ ]  [ ] **Remove** onSnapshot on orders.
- [ ]  [ ] **Remove** onSnapshot on not_ready_to_ship.
- [ ]  [ ] **Add** state, e.g.:
- boardSummary (todayOrders, tomorrowOrders, shippedTodayCount, groupedByClient, notReadyToShipOrders)
- boardLoading
- boardError
- [ ]  [ ] **Add** fetchBoardSummary():
- Call getBoardSummary URL.
- Parse JSON and set boardSummary.
- Set boardLoading / boardError.
- [ ]  [ ] **Mount effect:**
- On mount, call fetchBoardSummary().
- [ ]  [ ] **Replace data sources:**
- ordersToShipToday → boardSummary.todayOrders
- ordersToShipTomorrow → boardSummary.tomorrowOrders
- shippedToday / shippedToday.length → boardSummary.shippedTodayCount
- groupedSorted → boardSummary.groupedByClient
- notReadyToShipOrders → boardSummary.notReadyToShipOrders
- [ ]  [ ] **Adjust** all useMemo that used orders so they consume boardSummary (or derived props).
- [ ]  [ ] **Adjust** filterOrders and filters so they work on the new data shapes.

**Step 3.3: Refresh UX**

- [ ]  Add a “Refresh” button that calls fetchBoardSummary().
- [ ]  Optional: setInterval polling (e.g. every 60s) if you want auto-refresh.

**Step 3.4: Account lookup**

- [ ]  Keep accountLookup on the client (from VITE_CLIENT_MAPPINGS).
- [ ]  [ ] Ensure todayOrders / tomorrowOrders include account_uuid for lookups.
- [ ]  Update table rendering and CSV export to use the same lookup logic.

---

## **Phase 4: All Orders Tab**

**Decision:** Keep All Orders client-side with a limited Firestore query.

**Step 4.1: Add limited Firestore query for All Orders**

- [ ]  Add onSnapshot (or getDocs) only for the All Orders view:
- where('allocated_at', '>=', thirtyDaysAgo)
- orderBy('allocated_at', 'desc')
- limit(2000)
- [ ]  Store in allOrders state; used only for All Orders tab.
- [ ]  Keep existing filters (client, status, date range, SLA, search) and apply them to allOrders in the client.
- [ ]  Ensure CSV export uses filtered allOrders.

---

## **Phase 5: Countdown Component**

**Step 5.1: Use board summary for frenzy data**

- [ ]  Add a frenzy-related field to the board summary (e.g. frenzyCount, frenzyOrders) if Countdown needs it.
- [ ]  Extend getBoardSummary to compute frenzy counts using the same 14-day orders.
- [ ]  Update Countdown.jsx to use this data (passed as props or via shared context) instead of a full orders listener.
- [ ]  Or, if frenzy logic is complex: keep a **limited** Firestore query in Countdown (e.g. last 7 days), and remove the full-collection listener.

---

## **Phase 6: Error Handling & Fallbacks**

**Step 6.1: API failure handling**

- [ ]  If getBoardSummary fails:
- Show error message and a “Retry” button.
- Optionally fall back to a limited Firestore query for today/tomorrow/not ready.
- [ ]  Handle network timeouts (e.g. 15s) with a clear message.

**Step 6.2: Empty data**

- [ ]  Handle empty todayOrders, tomorrowOrders, notReadyToShipOrders without breaking layout or tables.

---

## **Phase 7: Testing & Validation**

**Step 7.1: Functional checks**

- [ ]  Today’s counts and lists match current dashboard.
- [ ]  Tomorrow’s counts and lists match.
- [ ]  Shipped-today count matches.
- [ ]  Top clients (grouped by client) match.
- [ ]  Not-ready-to-ship list matches.
- [ ]  All Orders tab shows correct data and filters.
- [ ]  Countdown (if used) shows correct frenzy info.

**Step 7.2: Performance**

- [ ]  Measure load time (target: &lt; 30 seconds, ideally 2–10 seconds).
- [ ]  Test cold start vs warm.
- [ ]  Verify 60s cache (second request within 60s returns quickly).

**Step 7.3: CSV export**

- [ ]  Today / Tomorrow / All Orders CSV exports match expectations.

---

## **Phase 8: Deploy & Rollback**

**Step 8.1: Deploy**

- [ ]  Deploy functions: firebase deploy --only functions
- [ ]  Deploy dashboard: npm run build in dashboard and deploy hosting.

**Step 8.2: Rollback plan**

- [ ]  Keep a branch with the old implementation (client-side listeners).
- [ ]  Document revert steps: redeploy previous dashboard build and optionally disable getBoardSummary if needed.

---

## **File Changes Summary**

| File | Action |
| --- | --- |
| functions/shipDateLogic.js | Create |
| functions/index.js | Add getBoardSummary and cache |
| firestore.indexes.json | Add index if required |
| dashboard/src/App.jsx | Remove full listeners, add fetch and boardSummary wiring |
| dashboard/.env (or config) | Add getBoardSummary URL if needed |
| dashboard/src/Countdown.jsx | Use board summary or limited query instead of full listener |