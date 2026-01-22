import Link from "next/link";
import { CityInfo } from "@/lib/cityData";

interface LocationPageProps {
  city: CityInfo;
}

export default function LocationPage({ city }: LocationPageProps) {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-navy-900 to-navy-800 text-white py-20">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            Dog Poop Cleaners in {city.name}
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl">
            Professional pet waste removal service serving {city.name} and {city.region}.
            Keep your yard clean and your family healthy!
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/quote"
              className="inline-flex items-center justify-center bg-teal-500 text-white font-semibold px-8 py-4 rounded-full hover:bg-teal-600 transition-colors text-lg"
            >
              Get a Free Quote
            </Link>
            <a
              href="tel:9093663744"
              className="inline-flex items-center justify-center border-2 border-white text-white font-semibold px-8 py-4 rounded-full hover:bg-white hover:text-navy-900 transition-colors text-lg"
            >
              Call (909) 366-3744
            </a>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-navy-900 text-center mb-12">
            Our Services in {city.name}
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="text-5xl mb-4">🏠</div>
              <h3 className="text-xl font-semibold mb-2">Residential Service</h3>
              <p className="text-gray-600">
                Weekly or bi-weekly yard cleanup for homeowners in {city.name}
              </p>
            </div>
            <div className="text-center p-6">
              <div className="text-5xl mb-4">🏢</div>
              <h3 className="text-xl font-semibold mb-2">Commercial Service</h3>
              <p className="text-gray-600">
                HOAs, apartments, and dog parks in {city.region}
              </p>
            </div>
            <div className="text-center p-6">
              <div className="text-5xl mb-4">✨</div>
              <h3 className="text-xl font-semibold mb-2">One-Time Cleanup</h3>
              <p className="text-gray-600">
                Deep cleaning for yards that need extra attention
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Service Area Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-navy-900 text-center mb-8">
            Serving {city.name} Zip Codes
          </h2>
          <div className="flex flex-wrap justify-center gap-4 max-w-2xl mx-auto">
            {city.zipCodes.map((zip) => (
              <span
                key={zip}
                className="bg-teal-100 text-teal-800 px-4 py-2 rounded-full font-semibold"
              >
                {zip}
              </span>
            ))}
          </div>
          <p className="text-center text-gray-600 mt-6">
            Not sure if we serve your area?{" "}
            <Link href="/quote" className="text-teal-600 hover:underline">
              Get a free quote
            </Link>{" "}
            and we&apos;ll let you know!
          </p>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-navy-900 text-center mb-12">
            Why {city.name} Residents Choose DooGoodScoopers
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: "⭐", title: "5-Star Rated", desc: "111+ five-star reviews" },
              { icon: "🕐", title: "Reliable", desc: "Same technician every visit" },
              { icon: "💰", title: "Affordable", desc: "Competitive pricing" },
              { icon: "🌱", title: "Eco-Friendly", desc: "Proper waste disposal" },
            ].map((item) => (
              <div key={item.title} className="text-center p-4">
                <div className="text-4xl mb-3">{item.icon}</div>
                <h3 className="font-semibold text-lg mb-1">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-teal-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready for a Cleaner Yard in {city.name}?
          </h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Join hundreds of happy customers in {city.region}. Get started with a free quote today!
          </p>
          <Link
            href="/quote"
            className="inline-block bg-white text-teal-600 font-semibold px-8 py-4 rounded-full hover:bg-gray-100 transition-colors text-lg"
          >
            Get Your Free Quote
          </Link>
        </div>
      </section>
    </main>
  );
}
