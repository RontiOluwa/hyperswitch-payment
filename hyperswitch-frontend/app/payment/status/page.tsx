import { auth0 } from '@/lib/auth0';
import { redirect } from 'next/navigation';
import { getPaymentIntent } from '@/lib/api';
import Link from 'next/link';

interface Props {
  searchParams: { payment_intent?: string };
}

export default async function PaymentStatusPage({ searchParams }: Props) {
  const session = await auth0.getSession();
  if (!session) redirect('/auth/login');

  const paymentIntentId = searchParams.payment_intent;
  if (!paymentIntentId) redirect('/checkout');

  const tokenResponse = await auth0.getAccessToken();

  let payment: Awaited<ReturnType<typeof getPaymentIntent>>['data'] | null = null;
  let fetchError: string | null = null;

  try {
    const result = await getPaymentIntent(tokenResponse.token, paymentIntentId);
    payment = result.data;
  } catch (err) {
    fetchError = 'Could not retrieve payment status';
  }

  const isSuccess = payment?.status === 'succeeded';
  const isFailed = payment?.status === 'failed';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-12 w-full max-w-md text-center">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
          isSuccess ? 'bg-green-100' : isFailed ? 'bg-red-100' : 'bg-yellow-100'
        }`}>
          {isSuccess && (
            <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {isFailed && (
            <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {!isSuccess && !isFailed && (
            <svg className="w-10 h-10 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>

        <h1 className={`text-2xl font-bold mb-2 ${
          isSuccess ? 'text-green-700' : isFailed ? 'text-red-700' : 'text-yellow-700'
        }`}>
          {isSuccess ? 'Payment Successful' : isFailed ? 'Payment Failed' : 'Payment Pending'}
        </h1>

        <p className="text-gray-500 mb-6">
          {isSuccess ? 'Your payment has been processed successfully.'
            : isFailed ? 'Your payment could not be processed.'
            : 'Your payment is being processed.'}
        </p>

        {payment && (
          <div className="bg-gray-50 rounded-xl p-4 mb-8 text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Amount</span>
              <span className="font-medium">${(payment.amount / 100).toFixed(2)} {payment.currency.toUpperCase()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Status</span>
              <span className={`font-medium capitalize ${
                isSuccess ? 'text-green-600' : isFailed ? 'text-red-600' : 'text-yellow-600'
              }`}>
                {payment.status}
              </span>
            </div>
          </div>
        )}

        {fetchError && <p className="text-red-600 text-sm mb-6">{fetchError}</p>}

        <div className="space-y-3">
          {isSuccess && (
            <Link href="/orders" className="block w-full bg-black text-white py-4 rounded-xl font-medium hover:bg-gray-800 transition-colors">
              View My Orders
            </Link>
          )}
          {isFailed && (
            <Link href="/checkout" className="block w-full bg-black text-white py-4 rounded-xl font-medium hover:bg-gray-800 transition-colors">
              Try Again
            </Link>
          )}
          <Link href="/" className="block w-full border border-gray-300 text-gray-700 py-4 rounded-xl font-medium hover:bg-gray-50 transition-colors">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
