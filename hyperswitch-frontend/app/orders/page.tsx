import { auth0 } from '@/lib/auth0';
import { redirect } from 'next/navigation';
import { listOrders } from '@/lib/api';
import Link from 'next/link';
import Navbar from '@/components/ui/Navbar';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  processing: 'bg-blue-100 text-blue-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-100 text-gray-700',
};

export default async function OrdersPage() {
  const session = await auth0.getSession();
  if (!session) redirect('/auth/login');

  const tokenResponse = await auth0.getAccessToken();

  let orders: Awaited<ReturnType<typeof listOrders>>['orders'] = [];
  let fetchError: string | null = null;

  try {
    const result = await listOrders(tokenResponse.token);
    orders = result.orders;
  } catch (err) {
    fetchError = 'Could not load orders';
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
          <Link href="/checkout" className="bg-black text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors">
            New Order
          </Link>
        </div>

        {fetchError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-700">{fetchError}</p>
          </div>
        )}

        {orders.length === 0 && !fetchError ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <p className="text-gray-400 text-lg mb-4">No orders yet</p>
            <Link href="/checkout" className="bg-black text-white px-8 py-4 rounded-xl font-medium hover:bg-gray-800 transition-colors">
              Place Your First Order
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="block bg-white rounded-2xl border border-gray-200 p-6 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-sm text-gray-500">
                    {order.id.slice(0, 20)}...
                  </span>
                  <span className={`text-xs font-medium px-3 py-1 rounded-full capitalize ${statusColors[order.status] ?? 'bg-gray-100 text-gray-700'
                    }`}>
                    {order.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    {order.items?.length ?? 0} item{(order.items?.length ?? 0) !== 1 ? 's' : ''} ·{' '}
                    {new Date(order.created_at).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'short', day: 'numeric',
                    })}
                  </div>
                  <span className="font-bold text-gray-900">
                    ${(order.total / 100).toFixed(2)} {order.currency_code?.toUpperCase()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
