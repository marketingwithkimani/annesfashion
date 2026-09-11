<?php
// =====================================================
// Upload All Local Photos to Supabase Storage & Update Database
// =====================================================

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/utils/supabase.php';

header('Content-Type: text/plain; charset=utf-8');

echo "=============================================\n";
echo "Anne's Fashion - Image Uploader to Supabase\n";
echo "=============================================\n\n";

$supabase = SupabaseClient::getInstance();
if (!$supabase->isConfigured()) {
    die("Error: Supabase is not configured.\n");
}

$url = getenv('SUPABASE_URL');
$secret = getenv('SUPABASE_SECRET_KEY');

$photosDir = __DIR__ . '/../assets/instagram/photos';
if (!is_dir($photosDir)) {
    die("Photos directory not found: $photosDir\n");
}

$db = Database::getInstance()->getConnection();

// 1. Get all products from local database
$stmt = $db->query("SELECT id, title, image_url FROM products ORDER BY id ASC");
$products = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "Found " . count($products) . " products in local database.\n\n";

// Helper to sanitize filename for Supabase storage
function sanitizeStorageKey($filename) {
    $info = pathinfo($filename);
    $ext = !empty($info['extension']) ? '.' . strtolower($info['extension']) : '.jpg';
    $name = preg_replace('/[^a-zA-Z0-9_-]/', '_', $info['filename']);
    return strtolower(trim($name, '_')) . $ext;
}

$uploadedCount = 0;
$failedCount = 0;

foreach ($products as $idx => $p) {
    $num = $idx + 1;
    $pid = $p['id'];
    $rawPath = $p['image_url'];
    
    // Resolve local file path
    $baseName = basename($rawPath);
    $localFilePath = $photosDir . '/' . $baseName;

    if (!file_exists($localFilePath)) {
        // Try decoding urlencoded filename
        $baseName = urldecode($baseName);
        $localFilePath = $photosDir . '/' . $baseName;
    }

    if (!file_exists($localFilePath)) {
        echo "[$num/" . count($products) . "] [SKIP] File not found: {$rawPath}\n";
        $failedCount++;
        continue;
    }

    $fileContent = file_get_contents($localFilePath);
    $fileSize = strlen($fileContent);
    $storageKey = sanitizeStorageKey($baseName);

    // Upload to Supabase Storage: /storage/v1/object/products/{storageKey}
    $ch = curl_init($url . '/storage/v1/object/products/' . $storageKey);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $fileContent);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'apikey: ' . $secret,
        'Authorization: Bearer ' . $secret,
        'Content-Type: image/jpeg',
        'x-upsert: true'
    ]);
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code === 200 || $code === 201) {
        $publicUrl = $url . '/storage/v1/object/public/products/' . $storageKey;
        
        // 1. Update Supabase products table
        $supabase->request('PATCH', "products?id=eq.{$pid}", [
            'image_url' => $publicUrl,
            'updated_at' => date('c')
        ]);

        // 2. Update Supabase product_images table
        $supabase->request('DELETE', "product_images?product_id=eq.{$pid}");
        $supabase->request('POST', 'product_images', [
            [
                'product_id' => $pid,
                'image_url' => $publicUrl,
                'is_main' => 1
            ]
        ]);

        // 3. Update Local MySQL products & product_images tables
        $db->prepare("UPDATE products SET image_url = :url WHERE id = :id")->execute([
            'url' => $publicUrl,
            'id' => $pid
        ]);
        $db->prepare("UPDATE product_images SET image_url = :url WHERE product_id = :id")->execute([
            'url' => $publicUrl,
            'id' => $pid
        ]);

        $uploadedCount++;
        echo "[$num/" . count($products) . "] [OK] ID #{$pid} {$p['title']} -> {$publicUrl}\n";
    } else {
        echo "[$num/" . count($products) . "] [FAIL] ID #{$pid} Upload HTTP {$code}: {$res}\n";
        $failedCount++;
    }
}

echo "\n---------------------------------------------\n";
echo "Upload Summary: {$uploadedCount} uploaded successfully, {$failedCount} failed.\n";
echo "---------------------------------------------\n";
