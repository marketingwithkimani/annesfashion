const fs = require('fs');
const path = require('path');

const PHOTOS_DIR = path.join(__dirname, '../assets/instagram/photos');
const VIDEOS_DIR = path.join(__dirname, '../assets/instagram/videos');
const OUTPUT_FILE = path.join(__dirname, '../js/products-data.js');

function generateCatalog() {
    console.log('--- Starting Catalog Generation ---');

    const products = [];

    // Helper to parse filename
    function parseFilename(filename, folder, type) {
        const ext = path.extname(filename);
        const nameWithoutExt = path.basename(filename, ext);

        // Split by underscore or hyphen
        // Expected: CATEGORY_TITLE_PRICE_ID
        const parts = nameWithoutExt.split('_');

        let category = 'general';
        let title = nameWithoutExt;
        let price = 'KSh 0';
        let id = Math.floor(Math.random() * 10000);

        if (parts.length >= 2) {
            category = parts[0].toLowerCase();
            title = parts[1].replace(/-/g, ' ');
            if (parts[2]) price = `KSh ${parts[2].replace(/,/g, '')}`;
            if (parts[3]) id = parseInt(parts[3]);
        } else {
            // Infer from folder/generic name
            if (nameWithoutExt.toLowerCase().includes('dress')) category = 'dresses';
            if (nameWithoutExt.toLowerCase().includes('casual')) category = 'casual';
            if (nameWithoutExt.toLowerCase().includes('corporate')) category = 'corporate';
            if (nameWithoutExt.toLowerCase().includes('shoe')) category = 'shoes';
            if (nameWithoutExt.toLowerCase().includes('wig')) category = 'wigs';
            if (nameWithoutExt.toLowerCase().includes('makeup')) category = 'makeup';
            if (nameWithoutExt.toLowerCase().includes('weekend')) category = 'weekend';
        }

        const item = {
            id: id,
            title: title,
            price: price,
            image: type === 'product' ? `assets/instagram/photos/${filename}` : null,
            videoUrl: type === 'social' ? `assets/instagram/videos/${filename}` : null,
            category: category,
            type: type,
            description: `Experience the premium quality of our ${title}. Perfect for your unique style.`,
            sizes: ['S', 'M', 'L', 'XL'],
            colors: ['Default']
        };

        return item;
    }

    // Scan Photos
    if (fs.existsSync(PHOTOS_DIR)) {
        const photos = fs.readdirSync(PHOTOS_DIR);
        photos.forEach(file => {
            if (['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(file).toLowerCase())) {
                products.push(parseFilename(file, 'photos', 'product'));
            }
        });
    }

    // Scan Videos
    if (fs.existsSync(VIDEOS_DIR)) {
        const videos = fs.readdirSync(VIDEOS_DIR);
        videos.forEach(file => {
            if (['.mp4', '.mov'].includes(path.extname(file).toLowerCase())) {
                products.push(parseFilename(file, 'videos', 'social'));
            }
        });
    }

    // Write to file
    const fileContent = `// AUTOMATICALLY GENERATED CATALOG - DO NOT EDIT MANUALLY
// Generated on: ${new Date().toLocaleString()}

const productsData = ${JSON.stringify(products, null, 4)};

if (typeof window !== 'undefined') {
    window.productsData = productsData;
}
`;

    fs.writeFileSync(OUTPUT_FILE, fileContent);
    console.log(`Success! Generated catalog with ${products.length} items at ${OUTPUT_FILE}`);
}

generateCatalog();
