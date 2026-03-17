import Link from 'next/link';
import Navbar from '@/components/ui/Navbar';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-6 py-24 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Modern Payment Platform
        </h1>
        <p className="text-xl text-gray-500 mb-12 max-w-2xl mx-auto">
          Powered by Hyperswitch. Secure, fast, and reliable payment processing.
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/auth/login"
            className="bg-black text-white px-8 py-4 rounded-xl text-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Get Started
          </a>
          <Link
            href="/orders"
            className="border border-gray-300 text-gray-700 px-8 py-4 rounded-xl text-lg font-medium hover:bg-gray-100 transition-colors"
          >
            View Orders
          </Link>
        </div>
      </main>
    </div>
  );
}
