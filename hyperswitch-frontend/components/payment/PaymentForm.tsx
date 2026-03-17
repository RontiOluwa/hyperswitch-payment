'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
}

declare global {
  interface Window {
    Hyperswitch: any;
    HyperLoader: any;
    Hyper: any;
  }
}

export default function PaymentForm({
  clientSecret,
  paymentIntentId,
  amount,
  currency,
}: Props) {
  const router = useRouter();
  // const cardRef = useRef<HTMLDivElement>(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hsRef = useRef<any>(null);
  const elementsRef = useRef<any>(null);

  // Step 1 — Load SDK
  useEffect(() => {
    const publishableKey = process.env.NEXT_PUBLIC_HYPERSWITCH_PUBLISHABLE_KEY;

    if (!publishableKey) {
      setSdkError('NEXT_PUBLIC_HYPERSWITCH_PUBLISHABLE_KEY is not set in .env.local');
      return;
    }

    if (window.Hyper) {
      setSdkLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://beta.hyperswitch.io/v1/HyperLoader.js';
    script.async = true;

    script.onload = () => {
      console.log('Hyperswitch SDK loaded');
      console.log('window.Hyper:', typeof window.Hyper);
      setSdkLoaded(true);
    };

    script.onerror = () => {
      setSdkError('Failed to load Hyperswitch SDK from CDN');
    };

    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // Step 2 — Mount card element once SDK is loaded
  useEffect(() => {
    if (!sdkLoaded || !clientSecret) return;

    if (typeof clientSecret !== 'string') {
      setSdkError(`clientSecret must be a string, got: ${typeof clientSecret}`);
      return;
    }

    const publishableKey = process.env.NEXT_PUBLIC_HYPERSWITCH_PUBLISHABLE_KEY!;

    try {
      if (!window.Hyper) {
        setSdkError('window.Hyper is not available');
        return;
      }

      console.log('Initializing Hyper with key:', publishableKey.slice(0, 10) + '...');

      hsRef.current = window.Hyper(publishableKey);

      console.log('Creating elements with clientSecret:', clientSecret.slice(0, 20) + '...');

      elementsRef.current = hsRef.current.elements({ clientSecret });

      const paymentElement = elementsRef.current.create('payment');
      paymentElement.mount('#payment-element');

      paymentElement.on('ready', () => {
        console.log('Payment element ready');
      });

      paymentElement.on('change', (event: any) => {
        if (event.error) {
          setError(event.error.message);
        } else {
          setError(null);
        }
      });

    } catch (err) {
      console.error('Hyperswitch initialization error:', err);
      setSdkError(
        err instanceof Error ? err.message : 'Unknown error initializing payment form'
      );
    }
  }, [sdkLoaded, clientSecret]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hsRef.current || !elementsRef.current) {
      setError('Payment form not ready');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const returnUrl = `${window.location.origin}/payment/status?payment_intent=${paymentIntentId}`;
      const { error: confirmError } = await hsRef.current.confirmPayment({
        elements: elementsRef.current,
        confirmParams: {
          return_url: returnUrl,
        },
        redirect: 'if_required',
      });

      if (confirmError) {
        setError(confirmError.message ?? 'Payment failed');
        setProcessing(false);
      }

      // window.location.href = returnUrl;
    } catch (err) {
      console.error('Payment confirmation error:', err);
      setError(err instanceof Error ? err.message : 'Payment failed');
      setProcessing(false);
    }
  };

  // SDK error — misconfiguration
  if (sdkError) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-6">
        <h2 className="text-lg font-semibold text-red-700 mb-2">
          Payment Form Error
        </h2>
        <p className="text-red-600 text-sm font-mono bg-red-50 p-3 rounded-lg">
          {sdkError}
        </p>
        <p className="text-gray-500 text-xs mt-3">
          Check your browser console and .env.local for more details.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">
        Enter Card Details
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Hyperswitch payment element mounts here */}
        <div
          // ref={cardRef}
          id="payment-element"
          className="border border-gray-300 rounded-xl p-4 min-h-[200px] bg-white"
        >
          {!sdkLoaded && (
            <div className="flex items-center justify-center h-24">
              <div className="flex items-center gap-3 text-gray-400">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400" />
                <span className="text-sm">Loading payment form...</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={!sdkLoaded || processing}
          className="w-full bg-black text-white py-4 rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing
            ? 'Processing...'
            : `Pay $${(amount / 100).toFixed(2)} ${currency}`}
        </button>

        <p className="text-xs text-gray-400 text-center">
          Your card details are encrypted and secure. We never store card numbers.
        </p>
      </form>
    </div>
  );
}