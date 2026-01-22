import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-navy-900 to-navy-800 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* 404 Icon */}
        <div className="mb-8">
          <span className="text-8xl">🐕</span>
        </div>

        {/* Heading */}
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Oops! Page Not Found
        </h1>

        {/* Description */}
        <p className="text-gray-300 text-lg mb-8">
          Looks like this page wandered off! Don&apos;t worry, we&apos;ll help you find your way back.
        </p>

        {/* Navigation Links */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-teal-500 text-white font-semibold rounded-full hover:bg-teal-600 transition-colors"
          >
            Go Home
          </Link>
          <Link
            href="/quote"
            className="inline-flex items-center justify-center px-6 py-3 border-2 border-white text-white font-semibold rounded-full hover:bg-white hover:text-navy-900 transition-colors"
          >
            Get a Quote
          </Link>
        </div>

        {/* Helpful Links */}
        <div className="mt-12 pt-8 border-t border-gray-700">
          <p className="text-gray-400 mb-4">Or check out these pages:</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link href="/residential-services" className="text-teal-400 hover:text-teal-300">
              Residential Services
            </Link>
            <Link href="/commercial-services" className="text-teal-400 hover:text-teal-300">
              Commercial Services
            </Link>
            <Link href="/faq" className="text-teal-400 hover:text-teal-300">
              FAQ
            </Link>
            <Link href="/about-doogoodscoopers" className="text-teal-400 hover:text-teal-300">
              About Us
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
