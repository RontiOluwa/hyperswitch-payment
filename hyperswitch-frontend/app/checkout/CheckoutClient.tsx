'use client';

import { useState } from 'react';
import { createPaymentIntent } from '@/lib/api';
import PaymentForm from '@/components/payment/PaymentForm';

interface Props {
  accessToken: string;
}

const DEMO_PRODUCT = {
  name: 'Demo Product',
  description: 'A sample product for testing the payment flow',
  amount: 5000,
  currency: 'USD',
};

export default function CheckoutClient({ accessToken }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProceed = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await createPaymentIntent(accessToken, {
        orderId: `order_${Date.now()}`,
        amount: DEMO_PRODUCT.amount,
        currency: DEMO_PRODUCT.currency,
      });

      if (!result.data.clientSecret) {
        setError('No client secret returned from payment service');
        return;
      }

      setClientSecret(result.data.clientSecret);
      setPaymentIntentId(result.data.id);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Order Summary */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Order Summary
        </h2>
        <div className="flex justify-between items-center py-3 border-b border-gray-100">
          <div>
            <p className="font-medium text-gray-900">{DEMO_PRODUCT.name}</p>
            <p className="text-sm text-gray-500">{DEMO_PRODUCT.description}</p>
          </div>
          <span className="font-medium text-gray-900">
            ${(DEMO_PRODUCT.amount / 100).toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between items-center pt-4">
          <span className="font-semibold text-gray-900">Total</span>
          <span className="text-xl font-bold text-gray-900">
            ${(DEMO_PRODUCT.amount / 100).toFixed(2)} {DEMO_PRODUCT.currency}
          </span>
        </div>
      </div>

      {/* Payment Section */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          Payment Details
        </h2>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Show proceed button until payment intent is created */}
        {!clientSecret && (
          <button
            onClick={handleProceed}
            disabled={loading}
            className="w-full bg-black text-white py-4 rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Initializing...
              </span>
            ) : (
              'Proceed to Payment'
            )}
          </button>
        )}

        {/* Show payment form once client secret is ready */}
        {clientSecret && (
          <PaymentForm
            clientSecret={clientSecret}
            paymentIntentId={paymentIntentId!}
            amount={DEMO_PRODUCT.amount}
            currency={DEMO_PRODUCT.currency}
          />
        )}
      </div>

    </div>
  );
}