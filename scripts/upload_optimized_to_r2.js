const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
});

const CF_TOKEN = env.CLOUDFLARE_API_TOKEN;
const R2_BUCKET = env.R2_IMAGES_BUCKET || 'client-production-images';
const optDir = 'products_optimized';

const files = fs.readdirSync(optDir).filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.webp'));
console.log(`Found ${files.length} optimized images to upload to R2 bucket "${R2_BUCKET}/products/"...`);

function uploadFile(filename) {
  return new Promise((resolve, reject) => {
    const srcPath = path.join(optDir, filename);
    const r2Target = `${R2_BUCKET}/products/${filename}`;
    const cmd = `npx --prefix worker wrangler r2 object put "${r2Target}" --file "${srcPath}" --content-type "image/jpeg"`;

    exec(cmd, { env: { ...process.env, CLOUDFLARE_API_TOKEN: CF_TOKEN } }, (err, stdout, stderr) => {
      if (err) {
        console.error(`✗ Failed to upload ${filename}:`, stderr || err.message);
        reject(err);
      } else {
        console.log(`✓ Uploaded: products/${filename}`);
        resolve();
      }
    });
  });
}

async function runPool(concurrency = 6) {
  const queue = [...files];
  let completed = 0;
  const total = files.length;

  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const file = queue.shift();
      try {
        await uploadFile(file);
        completed++;
        process.stdout.write(`[Progress: ${completed}/${total}]\n`);
      } catch (e) {
        console.error(`Error on ${file}`, e);
      }
    }
  });

  await Promise.all(workers);
  console.log(`\n🎉 All ${completed}/${total} optimized images deployed to Cloudflare R2!`);
}

runPool(6);

