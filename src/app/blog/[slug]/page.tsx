import Link from "next/link";
import { Metadata } from "next";
import { notFound } from "next/navigation";

// Blog posts data - will be moved to CMS or database later
const blogPosts: Record<string, { title: string; content: string; date: string; excerpt: string }> = {
  "top-10-reasons-to-hire-a-pooper-scooper-company-in-fontana-ca": {
    title: "Top 10 Reasons to Hire a Pooper Scooper Company in Fontana, CA",
    excerpt: "Discover why hiring a professional pooper scooper service is the best decision for Fontana homeowners.",
    date: "2024-12-16",
    content: `Coming soon! This article will be migrated from our WordPress site.

In the meantime, contact us for all your dog waste removal needs in Fontana and the Inland Empire.`,
  },
  "why-residents-use-dog-poop-removal-services-fontana-ca": {
    title: "Why Residents Use Dog Poop Removal Services in Fontana, CA",
    excerpt: "Learn why more Fontana residents are turning to professional dog waste removal services.",
    date: "2024-12-16",
    content: `Coming soon! This article will be migrated from our WordPress site.`,
  },
  "the-best-pooper-scooper-service-in-fontana-ca": {
    title: "The Best Pooper Scooper Service in Fontana, CA",
    excerpt: "Find out what makes DooGoodScoopers the top choice for pet waste removal in Fontana.",
    date: "2024-12-17",
    content: `Coming soon! This article will be migrated from our WordPress site.`,
  },
  "seasonal-yard-care-tips-for-dog-owners-happy-lawns-happier-pups": {
    title: "Seasonal Yard Care Tips for Dog Owners: Happy Lawns, Happier Pups",
    excerpt: "Expert tips for maintaining a beautiful yard while keeping your furry friends happy year-round.",
    date: "2025-01-16",
    content: `Coming soon! This article will be migrated from our WordPress site.`,
  },
  "pet-waste-removal-in-fontana-a-clean-yard-is-essential": {
    title: "Pet Waste Removal in Fontana: A Clean Yard is Essential",
    excerpt: "Why regular pet waste removal is crucial for your family's health and your lawn's beauty.",
    date: "2025-01-16",
    content: `Coming soon! This article will be migrated from our WordPress site.`,
  },
  "rancho-cucamonga-residents-need-professional-pooper-scooper": {
    title: "Rancho Cucamonga Residents Need Professional Pooper Scooper",
    excerpt: "How professional pet waste removal services are helping Rancho Cucamonga families.",
    date: "2025-01-16",
    content: `Coming soon! This article will be migrated from our WordPress site.`,
  },
  "dog-poop-removal-in-rancho-cucamonga-its-doogoodscoopers": {
    title: "Dog Poop Removal in Rancho Cucamonga: It's DooGoodScoopers!",
    excerpt: "Meet your local dog waste removal experts serving Rancho Cucamonga and surrounding areas.",
    date: "2025-01-16",
    content: `Coming soon! This article will be migrated from our WordPress site.`,
  },
  "top-10-best-gifts-for-your-dog-this-christmas": {
    title: "Top 10 Best Gifts for Your Dog This Christmas",
    excerpt: "Make your pup's holiday special with these top gift ideas from dog lovers.",
    date: "2025-01-22",
    content: `Coming soon! This article will be migrated from our WordPress site.`,
  },
  "dog-marking-indoors-tip-from-a-dog-poop-service": {
    title: "Dog Marking Indoors: Tips from a Dog Poop Service",
    excerpt: "Expert advice on how to handle indoor marking behavior from your furry friend.",
    date: "2025-01-22",
    content: `Coming soon! This article will be migrated from our WordPress site.`,
  },
  "travel-with-dogs-tips-from-a-doggie-doo-doo-disposal-services": {
    title: "Travel with Dogs: Tips from a Doggie Doo Doo Disposal Service",
    excerpt: "Planning a trip with your pup? Here's everything you need to know.",
    date: "2025-01-22",
    content: `Coming soon! This article will be migrated from our WordPress site.`,
  },
  "multi-dog-homes-and-an-inland-empire-pooper-scooper-service": {
    title: "Multi-Dog Homes and an Inland Empire Pooper Scooper Service",
    excerpt: "Managing waste from multiple dogs? We've got solutions for you.",
    date: "2025-01-22",
    content: `Coming soon! This article will be migrated from our WordPress site.`,
  },
  "does-my-dog-have-worms-a-comprehensive-guide": {
    title: "Does My Dog Have Worms? A Comprehensive Guide",
    excerpt: "Learn the signs, prevention, and treatment options for common canine parasites.",
    date: "2025-01-22",
    content: `Coming soon! This article will be migrated from our WordPress site.`,
  },
  "top-10-best-pet-friendly-hiking-trails-in-the-inland-empire": {
    title: "Top 10 Best Pet-Friendly Hiking Trails in the Inland Empire",
    excerpt: "Discover the best trails where you and your dog can explore nature together.",
    date: "2025-01-22",
    content: `Coming soon! This article will be migrated from our WordPress site.`,
  },
  "why-dog-waste-removal-near-me-is-essential-for-a-clean-and-healthy-yard": {
    title: "Why Dog Waste Removal Near Me is Essential for a Clean and Healthy Yard",
    excerpt: "The health and environmental benefits of professional pet waste removal.",
    date: "2025-02-27",
    content: `Coming soon! This article will be migrated from our WordPress site.`,
  },
};

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = blogPosts[slug];

  if (!post) {
    return {
      title: "Post Not Found",
    };
  }

  return {
    title: post.title,
    description: post.excerpt,
  };
}

export async function generateStaticParams() {
  return Object.keys(blogPosts).map((slug) => ({
    slug,
  }));
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = blogPosts[slug];

  if (!post) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-navy-900 text-white py-16">
        <div className="container mx-auto px-4">
          <Link href="/blog" className="text-teal-400 hover:text-teal-300 mb-4 inline-block">
            ← Back to Blog
          </Link>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            {post.title}
          </h1>
          <time className="text-gray-300">
            {new Date(post.date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
        </div>
      </div>

      {/* Content */}
      <article className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-8">
          <div className="prose prose-lg max-w-none">
            <p className="text-xl text-gray-600 mb-6">{post.excerpt}</p>
            <div className="whitespace-pre-line text-gray-700">{post.content}</div>
          </div>

          {/* CTA */}
          <div className="mt-12 p-6 bg-teal-50 rounded-lg text-center">
            <h3 className="text-xl font-semibold text-navy-900 mb-2">
              Need Dog Waste Removal?
            </h3>
            <p className="text-gray-600 mb-4">
              Let DooGoodScoopers handle the dirty work for you!
            </p>
            <Link
              href="/quote"
              className="inline-block bg-teal-600 text-white font-semibold px-6 py-3 rounded-full hover:bg-teal-700 transition-colors"
            >
              Get a Free Quote
            </Link>
          </div>
        </div>
      </article>
    </main>
  );
}
