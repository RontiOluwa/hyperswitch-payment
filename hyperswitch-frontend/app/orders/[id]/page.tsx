import { auth0 } from '@/lib/auth0';
import { redirect } from 'next/navigation';
import { getOrder } from '@/lib/api';
import Link from 'next/link';
import Navbar from '@/components/ui/Navbar';

interface Props {
  params: { id: string };
}

export default async function OrderDetailPage({ params }: Props) {
  const session = await auth0.getSession();
  if (!session) redirect('/auth/login');

  const tokenResponse = await auth0.getAccessToken();

  let order: Awaited<ReturnType<typeof getOrder>>['order'] | null = null;
  let fetchError: string | null = null;

  try {
    const result = await getOrder(tokenResponse.token, params.id);
    order = result.order;
  } catch (err) {
    fetchError = 'Could not load order details';
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/orders" className="text-gray-500 hover:text-gray-900 text-sm">
          ← Back to Orders
        </Link>

        {fetchError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mt-6">
            <p className="text-red-700">{fetchError}</p>
          </div>
        )}

        {order && (
          <div className="space-y-6 mt-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-xl font-bold text-gray-900 mb-1">Order Details</h1>
                  <p className="font-mono text-sm text-gray-500">{order.id}</p>
                </div>
                <span className="text-xs font-medium px-3 py-1 rounded-full capitalize bg-green-100 text-green-700">
                  {order.payment_status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Order Status</p>
                  <p className="font-medium capitalize">{order.status}</p>
                </div>
                <div>
                  <p className="text-gray-500">Fulfillment</p>
                  <p className="font-medium capitalize">{order.fulfillment_status}</p>
                </div>
                <div>
                  <p className="text-gray-500">Date</p>
                  <p className="font-medium">
                    {new Date(order.created_at).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'long', day: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Total</p>
                  <p className="font-bold text-lg">
                    ${(order.total / 100).toFixed(2)} {order.currency_code?.toUpperCase()}
                  </p>
                </div>
              </div>
            </div>

            {order.items && order.items.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Items</h2>
                <div className="space-y-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="font-medium text-gray-900">{item.title}</p>
                        <p className="text-sm text-gray-500">
                          Qty: {item.quantity} × ${(item.unit_price / 100).toFixed(2)}
                        </p>
                      </div>
                      <span className="font-medium">${(item.total / 100).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {order.shipping_address && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Shipping Address</h2>
                <address className="not-italic text-sm text-gray-700 space-y-1">
                  <p className="font-medium">
                    {order.shipping_address.first_name} {order.shipping_address.last_name}
                  </p>
                  <p>{order.shipping_address.address_1}</p>
                  <p>{order.shipping_address.city}, {order.shipping_address.country_code?.toUpperCase()}</p>
                </address>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
