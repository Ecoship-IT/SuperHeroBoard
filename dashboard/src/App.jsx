import { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

function App() {
  const [orders, setOrders] = useState([]);

  const accountMap = {
    "QWNjb3VudDo4MzMyNw==": "Polymer Clay Superstore",
    "QWNjb3VudDo4Mzc4Mw==": "Waverles Shipping",
    "QWNjb3VudDo4Mzk3MQ==": "Friendly Robot",
    "QWNjb3VudDo4Mzk4Mw==": "Quilling Shipping",
    "QWNjb3VudDo4NDQxMw==": "Waterlust Shipping",
    "QWNjb3VudDo4NDQxNg==": "Omez Beauty",
    "QWNjb3VudDo4NDQxOQ==": "Gist Yarn",
    "QWNjb3VudDo4NDQzMQ==": "Bonne et Filou",
    "QWNjb3VudDo4NDQ0NA==": "Chiropractic Outside The Box",
    "QWNjb3VudDo4NDQ0NQ==": "Tracy Higley",
    "QWNjb3VudDo4NDQ1OA==": "Mary DeMuth Art",
    "QWNjb3VudDo4NDQ2Nw==": "Birmingham Pens",
    "QWNjb3VudDo4NDQ5Ng==": "Iron Snail",
    "QWNjb3VudDo4NDU1NA==": "Stephanie Whittier Wellness / T Spheres Brand",
    "QWNjb3VudDo4NDU3OQ==": "I Have ADHD",
    "QWNjb3VudDo4NDU4Mw==": "Visible Health",
    "QWNjb3VudDo4NDYwNw==": "Lisa T. Bergren",
    "QWNjb3VudDo4NDYwOA==": "Maker Milk",
    "QWNjb3VudDo4NDYzNw==": "Pit Command",
    "QWNjb3VudDo4NDcwMA==": "Radical Tea towel",
    "QWNjb3VudDo4NDcwMQ==": "Pack for Camp",
    "QWNjb3VudDo4NDcwMw==": "Venture Healthcare LTD",
    "QWNjb3VudDo4NDczOA==": "Forth, LLC",
    "QWNjb3VudDo4NDgwMA==": "Water eStore",
    "QWNjb3VudDo4NDg0MA==": "Monochrome Books Inc",
    "QWNjb3VudDo4NDg1MQ==": "Cottonique Shipping",
    "QWNjb3VudDo4NDg3Mg==": "Earth Fed Muscle",
    "QWNjb3VudDo4NDg5Mw==": "Rongrong Shipping",
    "QWNjb3VudDo4NDg5Ng==": "Forge and Foster",
    "QWNjb3VudDo4NDkxMw==": "Carmen Electra - Mawer Capital",
    "QWNjb3VudDo4NDkyMQ==": "TheTickSuit Shipping",
    "QWNjb3VudDo4NDkzOQ==": "Oh Flora Store",
    "QWNjb3VudDo4NTA0MQ==": "Blu & Green",
    "QWNjb3VudDo4NTA1MA==": "Northshea Shipping",
    "QWNjb3VudDo4NTEwNg==": "Rizo Radiance",
    "QWNjb3VudDo4NTIxNQ==": "Eco Ship",
    "QWNjb3VudDo4NTIxNw==": "Roccoco Botanicals",
    "QWNjb3VudDo4NTI2MA==": "Nano-B",
    "QWNjb3VudDo4NTQ0OA==": "Liv Holistic",
    "QWNjb3VudDo4NTQ1MA==": "Sustainable Threads",
    "QWNjb3VudDo4NTQ1OA==": "Just Tall Ltd",
    "QWNjb3VudDo4NTQ3MQ==": "Dancing Moon Coffee Co."
  };

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('allocated_at', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setOrders(data);
    });
    return () => unsubscribe();
  }, []);

  const needsShippedToday = (allocatedAt) => {
    if (!allocatedAt) return false;
    const alloc = allocatedAt.toDate ? allocatedAt.toDate() : new Date(allocatedAt);
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setHours(8, 0, 0, 0);
    const isBeforeCutoff = alloc < cutoff;
    let shipDate = new Date(now);
    if (!isBeforeCutoff) shipDate.setDate(shipDate.getDate() + 1);
    while (shipDate.getDay() === 6 || shipDate.getDay() === 0) shipDate.setDate(shipDate.getDate() + 1);
    return shipDate.toISOString().split('T')[0] === now.toISOString().split('T')[0];
  };

  const ordersToShipToday = orders.filter(order => needsShippedToday(order.allocated_at) && order.status !== 'shipped');

  const shippedToday = orders.filter(order => {
    if (order.status !== 'shipped' || !order.shippedAt) return false;
    try {
      const shipDate = order.shippedAt.toDate ? order.shippedAt.toDate() : new Date(order.shippedAt);
      return shipDate.toDateString() === new Date().toDateString();
    } catch {
      return false;
    }
  });

  const grouped = {};
  orders.filter(order => !needsShippedToday(order.allocated_at) && order.status !== 'shipped')
    .forEach(order => {
      const name = accountMap[order.account_uuid] || order.account_uuid || 'Unknown';
      grouped[name] = (grouped[name] || 0) + 1;
    });
  const groupedSorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]);

  const [showAllClients, setShowAllClients] = useState(false);
  const visibleClients = showAllClients ? groupedSorted : groupedSorted.slice(0, 10);

  return (
    <div className="w-full md:w-[90%] lg:w-[85%] mx-auto px-4 font-sans">
      <h1 className="text-6xl font-extrabold tracking-tight text-gray-900 text-center mb-2 pt-10">SuperHero Board</h1>
      <p className="text-center text-gray-500 text-lg font-medium mb-8 pt-2">
        Real-time order overview for when <i>ship</i> gets real
      </p>

      <div className="flex flex-col md:flex-row items-start gap-12 mt-10 pt-5">
        <div className="flex flex-col justify-start pt-2 flex-[1.6]">
          <div className="text-9xl font-extrabold text-gray-900 mb-2 text-left">{ordersToShipToday.length}</div>
          <div className="text-5xl text-gray-600 font-medium text-left mb-1">Needs shipped today</div>
          <div className="text-9xl font-extrabold text-yellow-900 mb-2 text-left pt-10">
            {orders.filter(order => !needsShippedToday(order.allocated_at) && order.status !== 'shipped').length}
          </div>
          <div className="text-5xl text-yellow-700 font-medium text-left mb-1">Needs shipped tomorrow</div>
          <div className="text-9xl font-extrabold text-green-900 mb-2 text-left pt-10">{shippedToday.length}</div>
          <div className="text-5xl text-green-700 font-medium text-left mb-1">Shipped today</div>
        </div>
        <div className="flex-[1.4] w-full">
          <div className="bg-white shadow-xl rounded-xl p-6 border border-gray-200">
            <h2 className="text-4xl font-bold text-gray-800 mb-4">Top Clients by Open Orders</h2>
            <ul className="divide-y divide-gray-200">
              {visibleClients.map(([client, count], idx) => (
                <li
                  key={client}
                  className={`flex justify-between items-center py-1 px-3 transition ${
                    idx % 2 === 0 ? 'bg-gray-50' : 'bg-gray-200'
                  } hover:bg-gray-300`}
                >
                  <span className="text-3xl text-gray-800 font-semibold truncate pt-1 pb-1">{client}</span>
                  <span className="text-3xl font-bold text-gray-700">{count}</span>
                </li>
              ))}
            </ul>
            {groupedSorted.length > 12 && (
              <button
                onClick={() => setShowAllClients(prev => !prev)}
                className="mt-4 text-sm text-blue-600 hover:underline"
              >
                {showAllClients ? 'Show Less' : 'See All'}
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="bg-white shadow-md rounded-lg border border-gray-200 overflow-x-auto mt-20">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-gray-100 text-gray-700 uppercase text-xs sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3">Order #</th>
              <th className="px-4 py-3">Webhook Type</th>
              <th className="px-4 py-3">Line Items</th>
              <th className="px-4 py-3">Allocated At</th>
              <th className="px-4 py-3">Shipped At</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={order.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{order.order_number}</td>
                <td className="px-4 py-3">{order.webhook_type || 'Order Allocated'}</td>
                <td className="px-4 py-3">{Array.isArray(order.line_items) ? `${order.line_items.length} item(s)` : '—'}</td>
                <td className="px-4 py-3">{(() => { try { if (!order.allocated_at) return '—'; const date = order.allocated_at.toDate ? order.allocated_at.toDate() : new Date(order.allocated_at); return date.toLocaleString(); } catch { return '—'; } })()}</td>
                <td className="px-4 py-3">{(() => { try { if (!order.shippedAt) return '—'; const date = order.shippedAt.toDate ? order.shippedAt.toDate() : new Date(order.shippedAt); return date.toLocaleString(); } catch { return '—'; } })()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
