import { auth0 } from '@/lib/auth0';
import { redirect } from 'next/navigation';

export default async function LoginPage() {
  const session = await auth0.getSession();
  if (session) redirect('/checkout');

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back</h1>
        <p className="text-gray-500 mb-8">Sign in to access your account and orders</p>

        
          href="/auth/login"
          className="block w-full bg-black text-white py-4 rounded-xl font-medium hover:bg-gray-800 transition-colors mb-4"
        >
          Sign In
        </a>

        
          href="/auth/login?screen_hint=signup"
          className="block w-full border border-gray-300 text-gray-700 py-4 rounded-xl font-medium hover:bg-gray-50 transition-colors"
        >
          Create Account
        </a>

        <p className="text-xs text-gray-400 mt-8">Secured by Auth0</p>
      </div>
    </div>
  );
}
