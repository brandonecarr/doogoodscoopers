import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog | Dog Care Tips & News",
  description: "Read our latest articles about dog care, pet waste management tips, and news from DooGoodScoopers in the Inland Empire.",
};

// Blog posts data - will be moved to CMS or database later
const blogPosts = [
  {
    slug: "top-10-reasons-to-hire-a-pooper-scooper-company-in-fontana-ca",
    title: "Top 10 Reasons to Hire a Pooper Scooper Company in Fontana, CA",
    excerpt: "Discover why hiring a professional pooper scooper service is the best decision for Fontana homeowners.",
    date: "2024-12-16",
  },
  {
    slug: "why-residents-use-dog-poop-removal-services-fontana-ca",
    title: "Why Residents Use Dog Poop Removal Services in Fontana, CA",
    excerpt: "Learn why more Fontana residents are turning to professional dog waste removal services.",
    date: "2024-12-16",
  },
  {
    slug: "the-best-pooper-scooper-service-in-fontana-ca",
    title: "The Best Pooper Scooper Service in Fontana, CA",
    excerpt: "Find out what makes DooGoodScoopers the top choice for pet waste removal in Fontana.",
    date: "2024-12-17",
  },
  {
    slug: "seasonal-yard-care-tips-for-dog-owners-happy-lawns-happier-pups",
    title: "Seasonal Yard Care Tips for Dog Owners: Happy Lawns, Happier Pups",
    excerpt: "Expert tips for maintaining a beautiful yard while keeping your furry friends happy year-round.",
    date: "2025-01-16",
  },
  {
    slug: "pet-waste-removal-in-fontana-a-clean-yard-is-essential",
    title: "Pet Waste Removal in Fontana: A Clean Yard is Essential",
    excerpt: "Why regular pet waste removal is crucial for your family's health and your lawn's beauty.",
    date: "2025-01-16",
  },
  {
    slug: "rancho-cucamonga-residents-need-professional-pooper-scooper",
    title: "Rancho Cucamonga Residents Need Professional Pooper Scooper",
    excerpt: "How professional pet waste removal services are helping Rancho Cucamonga families.",
    date: "2025-01-16",
  },
  {
    slug: "dog-poop-removal-in-rancho-cucamonga-its-doogoodscoopers",
    title: "Dog Poop Removal in Rancho Cucamonga: It's DooGoodScoopers!",
    excerpt: "Meet your local dog waste removal experts serving Rancho Cucamonga and surrounding areas.",
    date: "2025-01-16",
  },
  {
    slug: "top-10-best-gifts-for-your-dog-this-christmas",
    title: "Top 10 Best Gifts for Your Dog This Christmas",
    excerpt: "Make your pup's holiday special with these top gift ideas from dog lovers.",
    date: "2025-01-22",
  },
  {
    slug: "dog-marking-indoors-tip-from-a-dog-poop-service",
    title: "Dog Marking Indoors: Tips from a Dog Poop Service",
    excerpt: "Expert advice on how to handle indoor marking behavior from your furry friend.",
    date: "2025-01-22",
  },
  {
    slug: "travel-with-dogs-tips-from-a-doggie-doo-doo-disposal-services",
    title: "Travel with Dogs: Tips from a Doggie Doo Doo Disposal Service",
    excerpt: "Planning a trip with your pup? Here's everything you need to know.",
    date: "2025-01-22",
  },
  {
    slug: "multi-dog-homes-and-an-inland-empire-pooper-scooper-service",
    title: "Multi-Dog Homes and an Inland Empire Pooper Scooper Service",
    excerpt: "Managing waste from multiple dogs? We've got solutions for you.",
    date: "2025-01-22",
  },
  {
    slug: "does-my-dog-have-worms-a-comprehensive-guide",
    title: "Does My Dog Have Worms? A Comprehensive Guide",
    excerpt: "Learn the signs, prevention, and treatment options for common canine parasites.",
    date: "2025-01-22",
  },
  {
    slug: "top-10-best-pet-friendly-hiking-trails-in-the-inland-empire",
    title: "Top 10 Best Pet-Friendly Hiking Trails in the Inland Empire",
    excerpt: "Discover the best trails where you and your dog can explore nature together.",
    date: "2025-01-22",
  },
  {
    slug: "why-dog-waste-removal-near-me-is-essential-for-a-clean-and-healthy-yard",
    title: "Why Dog Waste Removal Near Me is Essential for a Clean and Healthy Yard",
    excerpt: "The health and environmental benefits of professional pet waste removal.",
    date: "2025-02-27",
  },
];

export default function BlogPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-navy-900 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-4">
            DooGoodScoopers Blog
          </h1>
          <p className="text-xl text-gray-300 text-center max-w-2xl mx-auto">
            Tips, guides, and news about dog care and pet waste management in the Inland Empire
          </p>
        </div>
      </div>

      {/* Blog Posts Grid */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {blogPosts.map((post) => (
            <article
              key={post.slug}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="p-6">
                <time className="text-sm text-gray-500">
                  {new Date(post.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
                <h2 className="text-xl font-semibold text-navy-900 mt-2 mb-3">
                  <Link href={`/blog/${post.slug}`} className="hover:text-teal-600">
                    {post.title}
                  </Link>
                </h2>
                <p className="text-gray-600 mb-4">{post.excerpt}</p>
                <Link
                  href={`/blog/${post.slug}`}
                  className="text-teal-600 font-semibold hover:text-teal-700"
                >
                  Read More →
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-teal-600 text-white py-12">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready for a Cleaner Yard?</h2>
          <p className="text-xl mb-6">Get a free quote for professional dog waste removal</p>
          <Link
            href="/quote"
            className="inline-block bg-white text-teal-600 font-semibold px-8 py-3 rounded-full hover:bg-gray-100 transition-colors"
          >
            Get Your Free Quote
          </Link>
        </div>
      </div>
    </main>
  );
}
