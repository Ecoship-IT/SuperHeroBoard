import { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

function App() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('allocated_at', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setOrders(data);
    });

    return () => unsubscribe();
  }, []);

  const needsShippedToday = (allocatedAt) => {
    if (!allocatedAt) return false;

    const alloc = allocatedAt.toDate
      ? allocatedAt.toDate()
      : new Date(allocatedAt);

    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setHours(8, 0, 0, 0);

    const isBeforeCutoff = alloc < cutoff;

    let shipDate;
    if (isBeforeCutoff) {
      shipDate = new Date(now);
    } else {
      shipDate = new Date(now);
      shipDate.setDate(shipDate.getDate() + 1);
    }

    while (shipDate.getDay() === 6 || shipDate.getDay() === 0) {
      shipDate.setDate(shipDate.getDate() + 1);
    }

    const todayStr = now.toISOString().split('T')[0];
    const shipDateStr = shipDate.toISOString().split('T')[0];

    return shipDateStr === todayStr;
  };

  const ordersToShipToday = orders.filter(order =>
    needsShippedToday(order.allocated_at) &&
    order.status !== 'shipped'
  );

  const shippedToday = orders.filter(order => {
    if (order.status !== 'shipped' || !order.shippedAt) return false;

    try {
      const shipDate = order.shippedAt.toDate
        ? order.shippedAt.toDate()
        : new Date(order.shippedAt);

      const now = new Date();
      return shipDate.toDateString() === now.toDateString();
    } catch {
      return false;
    }
  });

  return (
    <div className="p-8 font-sans">
      <div className="mb-10 text-left">
        <div className="text-6xl font-bold">
          {ordersToShipToday.length}
        </div>
        <div className="text-2xl text-gray-600 mb-6">
          Needs shipped today
        </div>

        <div className="text-6xl font-bold">
          {orders.filter(order =>
            !needsShippedToday(order.allocated_at) &&
            order.status !== 'shipped'
          ).length}
        </div>
        <div className="text-2xl text-gray-600">
          Needs shipped tomorrow
        </div>

        <div className="text-6xl font-bold mt-10">
          {shippedToday.length}
        </div>
        <div className="text-2xl text-gray-600">
          Shipped today
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-4 pt-10">Order Allocations</h2>
      <div className="overflow-x-auto">
        <table className="w-full border border-gray-300 text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2">Order Number</th>
              <th className="border p-2">Webhook Type</th>
              <th className="border p-2">Line Items</th>
              <th className="border p-2">Allocated At</th>
              <th className="border p-2">Shipped At</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="border p-2">{order.order_number}</td>
                <td className="border p-2">{order.webhook_type || 'Order Allocated'}</td>
                <td className="border p-2">
                  {Array.isArray(order.line_items)
                    ? `${order.line_items.length} item(s)`
                    : '—'}
                </td>
                <td className="border p-2">
                  {(() => {
                    try {
                      if (!order.allocated_at) return '—';
                      const date = order.allocated_at.toDate
                        ? order.allocated_at.toDate()
                        : new Date(order.allocated_at);
                      return date.toLocaleString();
                    } catch {
                      return '—';
                    }
                  })()}
                </td>
                <td className="border p-2">
                  {(() => {
                    try {
                      if (!order.shippedAt) return '—';
                      const date = order.shippedAt.toDate
                        ? order.shippedAt.toDate()
                        : new Date(order.shippedAt);
                      return date.toLocaleString();
                    } catch {
                      return '—';
                    }
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
