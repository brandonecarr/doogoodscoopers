import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // === Simple page redirects ===
      { source: '/about', destination: '/about-doogoodscoopers', permanent: true },
      { source: '/about/', destination: '/about-doogoodscoopers', permanent: true },
      { source: '/contact', destination: '/quote', permanent: true },
      { source: '/contact/', destination: '/quote', permanent: true },
      { source: '/jobber-quote', destination: '/quote', permanent: true },
      { source: '/jobber-quote/', destination: '/quote', permanent: true },
      { source: '/new-home', destination: '/', permanent: true },
      { source: '/new-home/', destination: '/', permanent: true },
      { source: '/homepage-redesign', destination: '/', permanent: true },
      { source: '/homepage-redesign/', destination: '/', permanent: true },
      { source: '/inland-empire-dog-poop-cleaners', destination: '/residential-services', permanent: true },
      { source: '/inland-empire-dog-poop-cleaners/', destination: '/residential-services', permanent: true },

      // === Location page redirects (old format → new format) ===
      // Fontana
      { source: '/professional-pooper-scoopers-fontana', destination: '/fontana-dog-poop-cleaners', permanent: true },
      { source: '/professional-pooper-scoopers-fontana/', destination: '/fontana-dog-poop-cleaners', permanent: true },
      // Rancho Cucamonga
      { source: '/professional-pooper-scoopers-rancho-cucamonga', destination: '/rancho-cucamonga-dog-poop-cleaners', permanent: true },
      { source: '/professional-pooper-scoopers-rancho-cucamonga/', destination: '/rancho-cucamonga-dog-poop-cleaners', permanent: true },
      // Redlands
      { source: '/professional-pooper-scoopers-redlands', destination: '/redlands-dog-poop-cleaners', permanent: true },
      { source: '/professional-pooper-scoopers-redlands/', destination: '/redlands-dog-poop-cleaners', permanent: true },
      // Pomona
      { source: '/professional-pooper-scoopers-pomona', destination: '/pomona-dog-poop-cleaners', permanent: true },
      { source: '/professional-pooper-scoopers-pomona/', destination: '/pomona-dog-poop-cleaners', permanent: true },
      // Upland
      { source: '/professional-pooper-scoopers-upland', destination: '/upland-dog-poop-cleaners', permanent: true },
      { source: '/professional-pooper-scoopers-upland/', destination: '/upland-dog-poop-cleaners', permanent: true },
      // Temecula
      { source: '/professional-pooper-scoopers-temecula', destination: '/temecula-dog-poop-cleaners', permanent: true },
      { source: '/professional-pooper-scoopers-temecula/', destination: '/temecula-dog-poop-cleaners', permanent: true },
      // San Bernardino
      { source: '/professional-pooper-scoopers-san-bernardino', destination: '/san-bernardino-dog-poop-cleaners', permanent: true },
      { source: '/professional-pooper-scoopers-san-bernardino/', destination: '/san-bernardino-dog-poop-cleaners', permanent: true },
      // Riverside
      { source: '/professional-pooper-scoopers-riverside', destination: '/riverside-dog-poop-cleaners', permanent: true },
      { source: '/professional-pooper-scoopers-riverside/', destination: '/riverside-dog-poop-cleaners', permanent: true },
      // Ontario
      { source: '/professional-pooper-scoopers-ontario', destination: '/ontario-dog-poop-cleaners', permanent: true },
      { source: '/professional-pooper-scoopers-ontario/', destination: '/ontario-dog-poop-cleaners', permanent: true },
      // Norco
      { source: '/professional-pooper-scoopers-norco', destination: '/norco-dog-poop-cleaners', permanent: true },
      { source: '/professional-pooper-scoopers-norco/', destination: '/norco-dog-poop-cleaners', permanent: true },
      // Chino
      { source: '/professional-pooper-scoopers-chino', destination: '/chino-dog-poop-cleaners', permanent: true },
      { source: '/professional-pooper-scoopers-chino/', destination: '/chino-dog-poop-cleaners', permanent: true },
      // Claremont
      { source: '/professional-pooper-scoopers-claremont', destination: '/claremont-dog-poop-cleaners', permanent: true },
      { source: '/professional-pooper-scoopers-claremont/', destination: '/claremont-dog-poop-cleaners', permanent: true },
      // Colton
      { source: '/professional-pooper-scoopers-colton', destination: '/colton-dog-poop-cleaners', permanent: true },
      { source: '/professional-pooper-scoopers-colton/', destination: '/colton-dog-poop-cleaners', permanent: true },
      // Corona
      { source: '/professional-pooper-scoopers-corona', destination: '/corona-dog-poop-cleaners', permanent: true },
      { source: '/professional-pooper-scoopers-corona/', destination: '/corona-dog-poop-cleaners', permanent: true },
      // Grand Terrace
      { source: '/professional-pooper-scoopers-grand-terrace', destination: '/grand-terrace-dog-poop-cleaners', permanent: true },
      { source: '/professional-pooper-scoopers-grand-terrace/', destination: '/grand-terrace-dog-poop-cleaners', permanent: true },
      // High Desert
      { source: '/professional-pooper-scoopers-high-desert', destination: '/high-desert-dog-poop-cleaners', permanent: true },
      { source: '/professional-pooper-scoopers-high-desert/', destination: '/high-desert-dog-poop-cleaners', permanent: true },
      // Highland
      { source: '/professional-pooper-scoopers-highland', destination: '/highland-dog-poop-cleaners', permanent: true },
      { source: '/professional-pooper-scoopers-highland/', destination: '/highland-dog-poop-cleaners', permanent: true },
      // Lake Elsinore
      { source: '/professional-pooper-scoopers-lake-elsinore', destination: '/lake-elsinore-dog-poop-cleaners', permanent: true },
      { source: '/professional-pooper-scoopers-lake-elsinore/', destination: '/lake-elsinore-dog-poop-cleaners', permanent: true },
      // Montclair
      { source: '/professional-pooper-scoopers-montclair', destination: '/montclair-dog-poop-cleaners', permanent: true },
      { source: '/professional-pooper-scoopers-montclair/', destination: '/montclair-dog-poop-cleaners', permanent: true },
      // Murrieta
      { source: '/professional-pooper-scoopers-murrieta', destination: '/murrieta-dog-poop-cleaners', permanent: true },
      { source: '/professional-pooper-scoopers-murrieta/', destination: '/murrieta-dog-poop-cleaners', permanent: true },
      // High Desert cities (different URL pattern)
      { source: '/hesperia-professional-pooper-scoopers', destination: '/hesperia-dog-poop-cleaners', permanent: true },
      { source: '/hesperia-professional-pooper-scoopers/', destination: '/hesperia-dog-poop-cleaners', permanent: true },
      { source: '/victorville-professional-pooper-scoopers', destination: '/victorville-dog-poop-cleaners', permanent: true },
      { source: '/victorville-professional-pooper-scoopers/', destination: '/victorville-dog-poop-cleaners', permanent: true },
      { source: '/adelanto-professional-pooper-scoopers', destination: '/adelanto-dog-poop-cleaners', permanent: true },
      { source: '/adelanto-professional-pooper-scoopers/', destination: '/adelanto-dog-poop-cleaners', permanent: true },
      { source: '/apple-valley-professional-pooper-scoopers', destination: '/apple-valley-dog-poop-cleaners', permanent: true },
      { source: '/apple-valley-professional-pooper-scoopers/', destination: '/apple-valley-dog-poop-cleaners', permanent: true },

      // === Blog post redirects (root → /blog/) ===
      { source: '/top-10-reasons-to-hire-a-pooper-scooper-company-in-fontana-ca', destination: '/blog/top-10-reasons-to-hire-a-pooper-scooper-company-in-fontana-ca', permanent: true },
      { source: '/top-10-reasons-to-hire-a-pooper-scooper-company-in-fontana-ca/', destination: '/blog/top-10-reasons-to-hire-a-pooper-scooper-company-in-fontana-ca', permanent: true },
      { source: '/why-residents-use-dog-poop-removal-services-fontana-ca', destination: '/blog/why-residents-use-dog-poop-removal-services-fontana-ca', permanent: true },
      { source: '/why-residents-use-dog-poop-removal-services-fontana-ca/', destination: '/blog/why-residents-use-dog-poop-removal-services-fontana-ca', permanent: true },
      { source: '/the-best-pooper-scooper-service-in-fontana-ca', destination: '/blog/the-best-pooper-scooper-service-in-fontana-ca', permanent: true },
      { source: '/the-best-pooper-scooper-service-in-fontana-ca/', destination: '/blog/the-best-pooper-scooper-service-in-fontana-ca', permanent: true },
      { source: '/seasonal-yard-care-tips-for-dog-owners-happy-lawns-happier-pups', destination: '/blog/seasonal-yard-care-tips-for-dog-owners-happy-lawns-happier-pups', permanent: true },
      { source: '/seasonal-yard-care-tips-for-dog-owners-happy-lawns-happier-pups/', destination: '/blog/seasonal-yard-care-tips-for-dog-owners-happy-lawns-happier-pups', permanent: true },
      { source: '/pet-waste-removal-in-fontana-a-clean-yard-is-essential', destination: '/blog/pet-waste-removal-in-fontana-a-clean-yard-is-essential', permanent: true },
      { source: '/pet-waste-removal-in-fontana-a-clean-yard-is-essential/', destination: '/blog/pet-waste-removal-in-fontana-a-clean-yard-is-essential', permanent: true },
      { source: '/rancho-cucamonga-residents-need-professional-pooper-scooper', destination: '/blog/rancho-cucamonga-residents-need-professional-pooper-scooper', permanent: true },
      { source: '/rancho-cucamonga-residents-need-professional-pooper-scooper/', destination: '/blog/rancho-cucamonga-residents-need-professional-pooper-scooper', permanent: true },
      { source: '/dog-poop-removal-in-rancho-cucamonga-its-doogoodscoopers', destination: '/blog/dog-poop-removal-in-rancho-cucamonga-its-doogoodscoopers', permanent: true },
      { source: '/dog-poop-removal-in-rancho-cucamonga-its-doogoodscoopers/', destination: '/blog/dog-poop-removal-in-rancho-cucamonga-its-doogoodscoopers', permanent: true },
      { source: '/top-10-best-gifts-for-your-dog-this-christmas', destination: '/blog/top-10-best-gifts-for-your-dog-this-christmas', permanent: true },
      { source: '/top-10-best-gifts-for-your-dog-this-christmas/', destination: '/blog/top-10-best-gifts-for-your-dog-this-christmas', permanent: true },
      { source: '/dog-marking-indoors-tip-from-a-dog-poop-service', destination: '/blog/dog-marking-indoors-tip-from-a-dog-poop-service', permanent: true },
      { source: '/dog-marking-indoors-tip-from-a-dog-poop-service/', destination: '/blog/dog-marking-indoors-tip-from-a-dog-poop-service', permanent: true },
      { source: '/travel-with-dogs-tips-from-a-doggie-doo-doo-disposal-services', destination: '/blog/travel-with-dogs-tips-from-a-doggie-doo-doo-disposal-services', permanent: true },
      { source: '/travel-with-dogs-tips-from-a-doggie-doo-doo-disposal-services/', destination: '/blog/travel-with-dogs-tips-from-a-doggie-doo-doo-disposal-services', permanent: true },
      { source: '/multi-dog-homes-and-an-inland-empire-pooper-scooper-service', destination: '/blog/multi-dog-homes-and-an-inland-empire-pooper-scooper-service', permanent: true },
      { source: '/multi-dog-homes-and-an-inland-empire-pooper-scooper-service/', destination: '/blog/multi-dog-homes-and-an-inland-empire-pooper-scooper-service', permanent: true },
      { source: '/does-my-dog-have-worms-a-comprehensive-guide', destination: '/blog/does-my-dog-have-worms-a-comprehensive-guide', permanent: true },
      { source: '/does-my-dog-have-worms-a-comprehensive-guide/', destination: '/blog/does-my-dog-have-worms-a-comprehensive-guide', permanent: true },
      { source: '/top-10-best-pet-friendly-hiking-trails-in-the-inland-empire', destination: '/blog/top-10-best-pet-friendly-hiking-trails-in-the-inland-empire', permanent: true },
      { source: '/top-10-best-pet-friendly-hiking-trails-in-the-inland-empire/', destination: '/blog/top-10-best-pet-friendly-hiking-trails-in-the-inland-empire', permanent: true },
      { source: '/why-dog-waste-removal-near-me-is-essential-for-a-clean-and-healthy-yard', destination: '/blog/why-dog-waste-removal-near-me-is-essential-for-a-clean-and-healthy-yard', permanent: true },
      { source: '/why-dog-waste-removal-near-me-is-essential-for-a-clean-and-healthy-yard/', destination: '/blog/why-dog-waste-removal-near-me-is-essential-for-a-clean-and-healthy-yard', permanent: true },

      // === Trailing slash normalization (catch-all) ===
      // This must be last to avoid conflicts
      {
        source: '/:path+/',
        destination: '/:path+',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
