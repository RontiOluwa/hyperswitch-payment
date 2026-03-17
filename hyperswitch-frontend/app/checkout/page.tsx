import { auth0 } from '@/lib/auth0';
import { redirect } from 'next/navigation';
import CheckoutClient from './CheckoutClient';

export default async function CheckoutPage() {
  const session = await auth0.getSession();
  if (!session) redirect('/auth/login');

  const tokenResponse = await auth0.getAccessToken();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>
        <CheckoutClient accessToken={tokenResponse.token} />
      </div>
    </div>
  );
}
