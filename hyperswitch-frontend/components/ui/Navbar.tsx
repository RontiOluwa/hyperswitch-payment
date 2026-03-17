import { auth0 } from '@/lib/auth0';
import Link from 'next/link';

export default async function Navbar() {
  const session = await auth0.getSession();
  const user = session?.user;

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-gray-900">
          Platform
        </Link>

        <div className="flex items-center gap-6">
          {user && (
            <>
              <Link href="/orders" className="text-sm text-gray-600 hover:text-gray-900">
                My Orders
              </Link>
              <Link href="/checkout" className="text-sm bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800">
                Checkout
              </Link>
            </>
          )}

          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">{user.email}</span>
              <a href="/auth/logout" className="text-sm text-red-600 hover:text-red-800">
                Logout
              </a>
            </div>
          ) : (
            <a href="/auth/login" className="text-sm bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800">
              Login
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}
