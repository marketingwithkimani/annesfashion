/**
 * Anne's Fashion Line — SEO / AEO / GEO Engine
 * Kenyan Market Optimised | annesfashionline.co.ke
 *
 * This file injects:
 *  1. JSON-LD structured data (Schema.org) for rich results & AI answer engines (AEO)
 *  2. Breadcrumb schema per page
 *  3. FAQ schema for GEO / generative AI citations
 *  4. Dynamic Open Graph + Twitter Card meta tags
 *  5. Organization / Local Business entity for GEO brand authority
 */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────
     SITE-WIDE CONSTANTS
  ───────────────────────────────────────────── */
  const SITE = {
    name: "Anne's Fashion Line",
    url: 'https://annesfashionline.co.ke',
    logo: 'https://annesfashionline.co.ke/assets/Logo%20Black.png',
    phone: '+254798840085',
    whatsapp: 'https://wa.me/254798840085',
    city: 'Nairobi',
    country: 'KE',
    currency: 'KES',
    instagram: 'https://instagram.com/annesfashionline',
    tiktok: 'https://tiktok.com/@annesfashionline',
    facebook: 'https://facebook.com/annesfashionline',
    twitter: 'https://twitter.com/annesfashionline',
  };

  /* ─────────────────────────────────────────────
     PAGE REGISTRY — maps pathname to SEO config
  ───────────────────────────────────────────── */
  const PAGE_MAP = {
    '/': {
      type: 'home',
      title: "Anne's Fashion Line | Premium Women's Fashion in Nairobi, Kenya",
      description:
        "Kenya's leading online women's fashion store. Shop dresses, corporate wear, casual outfits, accessories, wigs & beauty products. Fast delivery across Nairobi and Kenya. Pay via M-Pesa.",
      keywords:
        "women's fashion Kenya, online fashion store Nairobi, buy dresses Kenya, African fashion Nairobi, ladies clothes Nairobi, corporate wear Kenya, casual wear Kenya, fashion delivery Nairobi, M-Pesa fashion Kenya",
      ogImage: 'https://annesfashionline.co.ke/assets/hero/slide-1-elegant.jpg',
    },
    '/dresses.html': {
      type: 'category',
      title: "Dresses in Nairobi Kenya | Buy Elegant & Casual Dresses | Anne's Fashion Line",
      description:
        "Shop stunning dresses in Nairobi — maxi dresses, evening gowns, midi dresses, bodycon & African print styles. All sizes available. Order online and pay via M-Pesa. Fast Nairobi delivery.",
      keywords:
        'dresses Kenya, buy dresses Nairobi, maxi dress Nairobi, African print dresses Kenya, evening dresses Nairobi, bodycon dress Kenya, ladies dresses online Kenya',
      ogImage: 'https://annesfashionline.co.ke/assets/categories/cat-dresses.jpg',
      categoryName: 'Dresses',
      breadcrumb: [{ name: 'Home', url: '/' }, { name: 'Dresses', url: '/dresses.html' }],
    },
    '/casual.html': {
      type: 'category',
      title: "Casual Wear for Women in Kenya | Everyday Chic Styles | Anne's Fashion Line",
      description:
        "Discover trendy casual wear for the modern Kenyan woman — graphic tees, crop tops, joggers, co-ords & everyday outfits. Order online across Kenya. M-Pesa accepted.",
      keywords:
        'casual wear Kenya, ladies casual clothes Nairobi, women casual outfits Kenya, everyday fashion Nairobi, crop tops Kenya, co-ord sets Kenya, casual tops Nairobi',
      ogImage: 'https://annesfashionline.co.ke/assets/categories/cat-casual.jpg',
      categoryName: 'Casual Wear',
      breadcrumb: [{ name: 'Home', url: '/' }, { name: 'Casual Wear', url: '/casual.html' }],
    },
    '/corporate.html': {
      type: 'category',
      title: "Corporate Wear for Women in Nairobi Kenya | Office Fashion | Anne's Fashion Line",
      description:
        "Dress to impress at the office. Shop premium corporate wear — blazers, pencil skirts, formal blouses, power suits & office dresses for professional women in Kenya. M-Pesa payments accepted.",
      keywords:
        'corporate wear Kenya, office wear women Nairobi, ladies formal wear Kenya, women blazers Kenya, professional fashion Nairobi, office outfits Kenya, corporate fashion Kenya',
      ogImage: 'https://annesfashionline.co.ke/assets/categories/cat-corporate.jpg',
      categoryName: 'Corporate Wear',
      breadcrumb: [{ name: 'Home', url: '/' }, { name: 'Corporate Wear', url: '/corporate.html' }],
    },
    '/sweaters.html': {
      type: 'category',
      title: "Sweaters, Blazers & Outerwear for Women in Kenya | Anne's Fashion Line",
      description:
        "Shop women's sweaters, blazers, trench coats, kimonos & cardigans in Kenya. Perfect for Nairobi's cool evenings and highland weather. Pay via M-Pesa. Islandwide delivery available.",
      keywords:
        'sweaters Kenya women, ladies blazers Kenya, trench coat Nairobi, women cardigans Kenya, outerwear Kenya ladies, kimonos Kenya, coats Nairobi women',
      ogImage: 'https://annesfashionline.co.ke/assets/categories/cat-sweaters.jpg',
      categoryName: 'Sweaters & Outerwear',
      breadcrumb: [{ name: 'Home', url: '/' }, { name: 'Sweaters & Outerwear', url: '/sweaters.html' }],
    },
    '/trousers.html': {
      type: 'category',
      title: "Women's Trousers, Jeans & Bottoms in Kenya | Anne's Fashion Line",
      description:
        "Shop women's trousers, high-waist jeans, palazzos, leggings, shorts & wide-leg pants in Kenya. All sizes and styles. Order online, pay with M-Pesa, fast delivery across Nairobi.",
      keywords:
        'women trousers Kenya, ladies jeans Nairobi, high waist pants Kenya, palazzo pants Kenya, wide leg trousers Kenya, women bottoms Nairobi, leggings Kenya women',
      ogImage: 'https://annesfashionline.co.ke/assets/categories/cat-trousers.jpg',
      categoryName: 'Trousers & Bottoms',
      breadcrumb: [{ name: 'Home', url: '/' }, { name: 'Trousers & Bottoms', url: '/trousers.html' }],
    },
    '/jumpsuits.html': {
      type: 'category',
      title: "Jumpsuits & Matching Sets for Women in Kenya | Anne's Fashion Line",
      description:
        "Shop trendy jumpsuits, 2-piece sets, co-ord matching sets & loungewear for women in Kenya. Perfect for every occasion from brunch to evenings out. M-Pesa payments. Nairobi delivery.",
      keywords:
        'jumpsuits Kenya women, matching sets Kenya, 2 piece sets Nairobi, co-ord sets Kenya ladies, women sets online Kenya, jumpsuits Nairobi, rompers Kenya',
      ogImage: 'https://annesfashionline.co.ke/assets/categories/cat-jumpsuits.jpg',
      categoryName: 'Jumpsuits & Sets',
      breadcrumb: [{ name: 'Home', url: '/' }, { name: 'Jumpsuits & Sets', url: '/jumpsuits.html' }],
    },
    '/accessories.html': {
      type: 'category',
      title: "Women's Fashion Accessories in Kenya | Jewellery, Belts & Bags | Anne's Fashion Line",
      description:
        "Complete your look with premium women's accessories in Kenya — earrings, necklaces, sunglasses, handbags, belts, hats & brooches. Shop online, pay M-Pesa. Fast Nairobi delivery.",
      keywords:
        'women accessories Kenya, fashion jewellery Nairobi, earrings Kenya, sunglasses Nairobi women, handbags Kenya ladies, fashion belts Kenya, brooches Kenya, hats women Kenya',
      ogImage: 'https://annesfashionline.co.ke/assets/categories/cat-accessories.jpg',
      categoryName: 'Accessories',
      breadcrumb: [{ name: 'Home', url: '/' }, { name: 'Accessories', url: '/accessories.html' }],
    },
    '/innerwear.html': {
      type: 'category',
      title: "Women's Shapewear, Bras & Innerwear in Kenya | Anne's Fashion Line",
      description:
        "Shop premium innerwear & shapewear for women in Kenya — sculpting shapewear, bralettes, strapless bras, stockings & boob tape. Discreet packaging. M-Pesa accepted. Nairobi delivery.",
      keywords:
        'shapewear Kenya women, bras Kenya, innerwear Nairobi ladies, strapless bra Kenya, bralette Kenya, stockings Kenya women, body shaper Kenya, boob tape Kenya',
      ogImage: 'https://annesfashionline.co.ke/assets/categories/cat-innerwear.jpg',
      categoryName: 'Innerwear & Shapewear',
      breadcrumb: [{ name: 'Home', url: '/' }, { name: 'Innerwear & Shapewear', url: '/innerwear.html' }],
    },
    '/shoes.html': {
      type: 'category',
      title: "Women's Shoes & Sneakers in Nairobi Kenya | Anne's Fashion Line",
      description:
        "Shop stylish women's shoes in Kenya — block heels, pumps, strappy sandals, sneakers, mules & boots. All sizes in stock. Pay via M-Pesa. Same-day delivery available in Nairobi.",
      keywords:
        'women shoes Kenya, ladies heels Nairobi, sneakers Kenya women, sandals Nairobi ladies, block heels Kenya, women boots Kenya, mules Kenya, shoes online Kenya',
      ogImage: 'https://annesfashionline.co.ke/assets/categories/cat-shoes.jpg',
      categoryName: 'Shoes & Sneakers',
      breadcrumb: [{ name: 'Home', url: '/' }, { name: 'Shoes & Sneakers', url: '/shoes.html' }],
    },
    '/wigs.html': {
      type: 'category',
      title: "Human Hair Wigs & Hair Extensions in Kenya | Anne's Fashion Line",
      description:
        "Shop premium human hair wigs, lace front wigs, synthetic wigs & hair extensions in Kenya. Natural-looking, affordable prices. Order online and pay with M-Pesa. Fast Nairobi delivery.",
      keywords:
        'wigs Kenya, human hair wigs Nairobi, lace front wigs Kenya, hair extensions Kenya, synthetic wigs Nairobi, buy wigs online Kenya, affordable wigs Kenya, HD lace wig Kenya',
      ogImage: 'https://annesfashionline.co.ke/assets/categories/cat-wigs.jpg',
      categoryName: 'Wigs & Hair',
      breadcrumb: [{ name: 'Home', url: '/' }, { name: 'Wigs & Hair', url: '/wigs.html' }],
    },
    '/beauty.html': {
      type: 'category',
      title: "Beauty & Wellness Products for Women in Kenya | Anne's Fashion Line",
      description:
        "Shop skincare, haircare, body care & wellness products for women in Kenya. African-beauty focused formulas, affordable prices. Pay via M-Pesa. Nationwide delivery.",
      keywords:
        'beauty products Kenya, skincare Kenya women, wellness products Nairobi, haircare Kenya, body care Kenya, African beauty products Kenya, skincare routine Kenya',
      ogImage: 'https://annesfashionline.co.ke/assets/categories/cat-beauty.jpg',
      categoryName: 'Beauty & Wellness',
      breadcrumb: [{ name: 'Home', url: '/' }, { name: 'Beauty & Wellness', url: '/beauty.html' }],
    },
    '/makeup.html': {
      type: 'category',
      title: "Makeup & Cosmetics in Kenya | Foundations, Lipsticks & Beauty Kits | Anne's Fashion Line",
      description:
        "Shop makeup & cosmetics for African skin tones in Kenya — foundations, concealers, lipsticks, eyeshadow palettes & beauty kits. Deliver across Kenya. M-Pesa payments.",
      keywords:
        'makeup Kenya, cosmetics Nairobi, foundation Kenya African skin, lipstick Kenya, eyeshadow Kenya, beauty kit Nairobi, makeup online Kenya, affordable makeup Kenya',
      ogImage: 'https://annesfashionline.co.ke/assets/categories/cat-beauty.jpg',
      categoryName: 'Makeup',
      breadcrumb: [{ name: 'Home', url: '/' }, { name: 'Makeup', url: '/makeup.html' }],
    },
    '/weekend.html': {
      type: 'category',
      title: "Weekend & Lifestyle Fashion for Women in Kenya | Anne's Fashion Line",
      description:
        "Discover laid-back yet chic weekend and lifestyle fashion in Kenya — resort wear, brunch outfits, loungewear & street style pieces. Shop online, pay M-Pesa, fast delivery.",
      keywords:
        'weekend wear Kenya women, lifestyle fashion Nairobi, resort wear Kenya, brunch outfit Kenya, loungewear Kenya, streetwear Kenya women, relaxed fashion Nairobi',
      ogImage: 'https://annesfashionline.co.ke/assets/hero/slide-3-weekend.jpg',
      categoryName: 'Weekend & Lifestyle',
      breadcrumb: [{ name: 'Home', url: '/' }, { name: 'Weekend & Lifestyle', url: '/weekend.html' }],
    },
    '/product-detail.html': {
      type: 'product',
      title: "Product Details | Anne's Fashion Line Kenya",
      description:
        "View detailed product information, sizing guides, and styling tips. Shop premium fashion from Anne's Fashion Line — Kenya's top women's fashion destination. Pay via M-Pesa.",
      keywords:
        "women's fashion Kenya, buy clothes online Kenya, M-Pesa fashion, Nairobi fashion store",
      ogImage: 'https://annesfashionline.co.ke/assets/hero/slide-1-elegant.jpg',
    },
  };

  /* ─────────────────────────────────────────────
     SITE-WIDE FAQ SCHEMA (AEO + GEO)
     These FAQs feed AI answer engines & Google
     FAQ rich results for the Kenyan market.
  ───────────────────────────────────────────── */
  const GLOBAL_FAQ = [
    {
      q: "Where is Anne's Fashion Line based?",
      a: "Anne's Fashion Line is based in Nairobi, Kenya. We deliver fashion across the country including Nairobi, Mombasa, Kisumu, Nakuru, Eldoret and other towns.",
    },
    {
      q: 'Does Anne\'s Fashion Line accept M-Pesa?',
      a: 'Yes! Anne\'s Fashion Line accepts M-Pesa payments, making it easy and convenient for customers across Kenya to shop online.',
    },
    {
      q: "How fast is Anne's Fashion Line delivery in Nairobi?",
      a: "Anne's Fashion Line offers same-day and next-day delivery within Nairobi. Deliveries to other towns across Kenya typically take 2–3 business days.",
    },
    {
      q: "What clothing sizes does Anne's Fashion Line stock?",
      a: "Anne's Fashion Line stocks a full range of sizes from XS to 3XL to cater to all body types and the diverse Kenyan woman.",
    },
    {
      q: "Can I contact Anne's Fashion Line on WhatsApp?",
      a: "Yes! You can reach Anne's Fashion Line directly on WhatsApp at +254 798 840 085 for orders, size guidance, and customer support.",
    },
    {
      q: "Does Anne's Fashion Line sell African print (Ankara) dresses?",
      a: "Yes, Anne's Fashion Line stocks a curated range of African print dresses including Ankara, Kitenge and other African-inspired styles.",
    },
    {
      q: "Does Anne's Fashion Line offer corporate wear for Kenyan professional women?",
      a: "Absolutely. Anne's Fashion Line has a dedicated corporate wear collection featuring blazers, power suits, pencil skirts, and formal blouses designed for professional women in Kenya.",
    },
    {
      q: "What payment methods does Anne's Fashion Line accept?",
      a: "Anne's Fashion Line accepts M-Pesa, bank transfers, and card payments for maximum convenience for Kenyan shoppers.",
    },
    {
      q: "Does Anne's Fashion Line sell human hair wigs in Kenya?",
      a: "Yes! Anne's Fashion Line stocks premium human hair wigs, lace front wigs, and synthetic wigs with fast delivery across Kenya.",
    },
    {
      q: "How do I order from Anne's Fashion Line?",
      a: "You can browse and add items on annesfashionline.co.ke, or contact us directly on WhatsApp at +254 798 840 085 to place an order. We accept M-Pesa for payment.",
    },
  ];

  /* ─────────────────────────────────────────────
     HELPER: inject a <script type="application/ld+json">
  ───────────────────────────────────────────── */
  function injectLD(data) {
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.text = JSON.stringify(data, null, 2);
    document.head.appendChild(el);
  }

  /* ─────────────────────────────────────────────
     HELPER: upsert a <meta> tag
  ───────────────────────────────────────────── */
  function setMeta(attr, attrVal, content) {
    let el = document.querySelector(`meta[${attr}="${attrVal}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, attrVal);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  /* ─────────────────────────────────────────────
     HELPER: upsert a <link> tag
  ───────────────────────────────────────────── */
  function setLink(rel, href) {
    let el = document.querySelector(`link[rel="${rel}"]`);
    if (!el) {
      el = document.createElement('link');
      el.rel = rel;
      document.head.appendChild(el);
    }
    el.href = href;
  }

  /* ─────────────────────────────────────────────
     RESOLVE CURRENT PAGE CONFIG
  ───────────────────────────────────────────── */
  function getPageConfig() {
    const path = window.location.pathname.replace(/\/index\.html$/, '/');
    // exact match first
    if (PAGE_MAP[path]) return PAGE_MAP[path];
    // try stripping leading path for sub-hosted setups
    const filename = '/' + path.split('/').pop();
    return PAGE_MAP[filename] || PAGE_MAP['/'];
  }

  /* ─────────────────────────────────────────────
     1. ORGANISATION / LOCAL BUSINESS (GEO authority signal)
  ───────────────────────────────────────────── */
  function injectOrganisation() {
    injectLD({
      '@context': 'https://schema.org',
      '@type': ['ClothingStore', 'LocalBusiness'],
      '@id': SITE.url + '/#organization',
      name: SITE.name,
      url: SITE.url,
      logo: {
        '@type': 'ImageObject',
        url: SITE.logo,
        width: 200,
        height: 60,
      },
      description:
        "Anne's Fashion Line is Nairobi's premium online fashion destination for the modern Kenyan woman, offering dresses, corporate wear, casual styles, accessories, wigs, beauty products and more.",
      telephone: SITE.phone,
      contactPoint: [
        {
          '@type': 'ContactPoint',
          telephone: SITE.phone,
          contactType: 'customer service',
          contactOption: 'TollFree',
          availableLanguage: ['English', 'Swahili'],
          areaServed: 'KE',
        },
      ],
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Nairobi',
        addressRegion: 'Nairobi County',
        addressCountry: 'KE',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: -1.286389,
        longitude: 36.817223,
      },
      areaServed: {
        '@type': 'Country',
        name: 'Kenya',
      },
      currenciesAccepted: 'KES',
      paymentAccepted: 'M-Pesa, Cash, Bank Transfer, Visa, Mastercard',
      priceRange: 'KES 500 – KES 15,000',
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          opens: '08:00',
          closes: '20:00',
        },
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Saturday', 'Sunday'],
          opens: '09:00',
          closes: '18:00',
        },
      ],
      sameAs: [SITE.instagram, SITE.tiktok, SITE.facebook, SITE.twitter],
    });
  }

  /* ─────────────────────────────────────────────
     2. WEBSITE SCHEMA (sitelinks searchbox)
  ───────────────────────────────────────────── */
  function injectWebSite() {
    injectLD({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': SITE.url + '/#website',
      url: SITE.url,
      name: SITE.name,
      description: "Kenya's leading premium women's fashion online store.",
      publisher: { '@id': SITE.url + '/#organization' },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: SITE.url + '/?q={search_term_string}',
        },
        'query-input': 'required name=search_term_string',
      },
      inLanguage: 'en-KE',
    });
  }

  /* ─────────────────────────────────────────────
     3. BREADCRUMB SCHEMA (per page)
  ───────────────────────────────────────────── */
  function injectBreadcrumb(config) {
    if (!config.breadcrumb) return;
    const items = config.breadcrumb.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: SITE.url + item.url,
    }));
    injectLD({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items,
    });
  }

  /* ─────────────────────────────────────────────
     4. COLLECTION PAGE / ITEM LIST SCHEMA
  ───────────────────────────────────────────── */
  function injectCollectionPage(config) {
    if (config.type !== 'category') return;
    injectLD({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': SITE.url + window.location.pathname + '#collection',
      name: config.categoryName + " — Anne's Fashion Line Kenya",
      description: config.description,
      url: SITE.url + window.location.pathname,
      isPartOf: { '@id': SITE.url + '/#website' },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: (config.breadcrumb || []).map((item, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: item.name,
          item: SITE.url + item.url,
        })),
      },
      provider: { '@id': SITE.url + '/#organization' },
      inLanguage: 'en-KE',
    });
  }

  /* ─────────────────────────────────────────────
     5. FAQ SCHEMA (AEO + GEO — for AI answers)
  ───────────────────────────────────────────── */
  function injectFAQ() {
    // Only inject FAQ on homepage for best AEO impact (avoid dilution)
    const path = window.location.pathname.replace(/\/index\.html$/, '/');
    if (path !== '/' && path !== '/index.html') return;
    injectLD({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: GLOBAL_FAQ.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.a,
        },
      })),
    });
  }

  /* ─────────────────────────────────────────────
     6. OPEN GRAPH + TWITTER CARDS (social + AI crawlers)
  ───────────────────────────────────────────── */
  function injectSocialMeta(config) {
    const canonicalUrl = SITE.url + window.location.pathname;

    // Open Graph
    setMeta('property', 'og:type', config.type === 'product' ? 'product' : 'website');
    setMeta('property', 'og:site_name', SITE.name);
    setMeta('property', 'og:title', config.title);
    setMeta('property', 'og:description', config.description);
    setMeta('property', 'og:url', canonicalUrl);
    setMeta('property', 'og:image', config.ogImage || SITE.logo);
    setMeta('property', 'og:image:width', '1200');
    setMeta('property', 'og:image:height', '630');
    setMeta('property', 'og:locale', 'en_KE');

    // Twitter Card
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:site', '@annesfashionline');
    setMeta('name', 'twitter:title', config.title);
    setMeta('name', 'twitter:description', config.description);
    setMeta('name', 'twitter:image', config.ogImage || SITE.logo);

    // Canonical
    setLink('canonical', canonicalUrl);

    // Geo / locale signals
    setMeta('name', 'geo.region', 'KE-30');
    setMeta('name', 'geo.placename', 'Nairobi, Kenya');
    setMeta('name', 'geo.position', '-1.286389;36.817223');
    setMeta('name', 'ICBM', '-1.286389, 36.817223');
    setMeta('name', 'language', 'English');
    setMeta('name', 'robots', 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');

    // Keywords (legacy but still useful for niche markets)
    setMeta('name', 'keywords', config.keywords);

    // GEO — Author & Publisher entity signals for AI engines
    setMeta('name', 'author', SITE.name);
    setMeta('property', 'article:publisher', SITE.facebook);

    // Hreflang for Kenya English
    let hreflang = document.querySelector('link[rel="alternate"][hreflang="en-ke"]');
    if (!hreflang) {
      hreflang = document.createElement('link');
      hreflang.rel = 'alternate';
      hreflang.hreflang = 'en-ke';
      hreflang.href = canonicalUrl;
      document.head.appendChild(hreflang);
    }
  }

  /* ─────────────────────────────────────────────
     7. UPDATE <title> and <meta description>
  ───────────────────────────────────────────── */
  function updateCoreMeta(config) {
    document.title = config.title;
    setMeta('name', 'description', config.description);
  }

  /* ─────────────────────────────────────────────
     MAIN INIT — runs on DOMContentLoaded
  ───────────────────────────────────────────── */
  function init() {
    const config = getPageConfig();

    updateCoreMeta(config);
    injectSocialMeta(config);
    injectOrganisation();
    injectWebSite();
    injectBreadcrumb(config);
    injectCollectionPage(config);
    injectFAQ();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
