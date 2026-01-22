import { MetadataRoute } from 'next'

// List of cities for location pages
const cities = [
  'fontana',
  'rancho-cucamonga',
  'redlands',
  'pomona',
  'upland',
  'temecula',
  'san-bernardino',
  'riverside',
  'ontario',
  'norco',
  'chino',
  'chino-hills',
  'claremont',
  'colton',
  'corona',
  'grand-terrace',
  'high-desert',
  'highland',
  'lake-elsinore',
  'montclair',
  'murrieta',
  'hesperia',
  'victorville',
  'adelanto',
  'apple-valley',
]

// List of blog post slugs
const blogPosts = [
  'top-10-reasons-to-hire-a-pooper-scooper-company-in-fontana-ca',
  'why-residents-use-dog-poop-removal-services-fontana-ca',
  'the-best-pooper-scooper-service-in-fontana-ca',
  'seasonal-yard-care-tips-for-dog-owners-happy-lawns-happier-pups',
  'pet-waste-removal-in-fontana-a-clean-yard-is-essential',
  'rancho-cucamonga-residents-need-professional-pooper-scooper',
  'dog-poop-removal-in-rancho-cucamonga-its-doogoodscoopers',
  'top-10-best-gifts-for-your-dog-this-christmas',
  'dog-marking-indoors-tip-from-a-dog-poop-service',
  'travel-with-dogs-tips-from-a-doggie-doo-doo-disposal-services',
  'multi-dog-homes-and-an-inland-empire-pooper-scooper-service',
  'does-my-dog-have-worms-a-comprehensive-guide',
  'top-10-best-pet-friendly-hiking-trails-in-the-inland-empire',
  'why-dog-waste-removal-near-me-is-essential-for-a-clean-and-healthy-yard',
]

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://doogoodscoopers.com'

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/residential-services`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/commercial-services`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/quote`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about-doogoodscoopers`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/careers`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy-policy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms-of-service`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  // Location pages
  const locationPages: MetadataRoute.Sitemap = cities.map((city) => ({
    url: `${baseUrl}/${city}-dog-poop-cleaners`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))

  // Blog listing page
  const blogListingPage: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ]

  // Blog posts
  const blogPostPages: MetadataRoute.Sitemap = blogPosts.map((slug) => ({
    url: `${baseUrl}/blog/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  return [...staticPages, ...locationPages, ...blogListingPage, ...blogPostPages]
}
