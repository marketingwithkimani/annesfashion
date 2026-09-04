<?php
// =====================================================
// Product Synchronization Script: Local MySQL -> Supabase REST
// =====================================================

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/utils/supabase.php';

header('Content-Type: text/plain; charset=utf-8');

echo "=============================================\n";
echo "Anne's Fashion - Supabase Product Sync\n";
echo "=============================================\n\n";

$supabase = SupabaseClient::getInstance();
if (!$supabase->isConfigured()) {
    die("Error: Supabase is not properly configured in .env (URL or Secret Key missing).\n");
}

try {
    $db = Database::getInstance()->getConnection();
    echo "1. Connected to local database.\n";

    // 2. Fetch all products
    $stmt = $db->query("
        SELECT 
            p.*,
            COALESCE(i.quantity, 10) as stock
        FROM products p
        LEFT JOIN inventory i ON p.id = i.product_id
        ORDER BY p.id ASC
    ");
    $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $total = count($products);

    echo "2. Found {$total} products in local database.\n\n";

    if ($total === 0) {
        die("No products found in local database to sync.\n");
    }

    // 3. Fetch all images
    $imgStmt = $db->query("SELECT product_id, image_url, is_main FROM product_images ORDER BY id ASC");
    $allImages = $imgStmt->fetchAll(PDO::FETCH_ASSOC);

    $imagesByProduct = [];
    foreach ($allImages as $img) {
        $pid = $img['product_id'];
        if (!isset($imagesByProduct[$pid])) {
            $imagesByProduct[$pid] = [];
        }
        $imagesByProduct[$pid][] = $img['image_url'];
    }

    // 4. Loop and sync each product to Supabase
    $synced = 0;
    $failed = 0;

    echo "3. Synchronizing to Supabase via REST API...\n";
    echo "---------------------------------------------\n";

    foreach ($products as $idx => $prod) {
        $num = $idx + 1;
        $pid = $prod['id'];
        $title = $prod['title'];
        $sku = $prod['sku'];
        $stock = (int)$prod['stock'];
        
        $images = $imagesByProduct[$pid] ?? [];
        if (empty($images) && !empty($prod['image_url'])) {
            $images = [$prod['image_url']];
        }

        $success = $supabase->syncFullProduct($prod, $images, $stock);

        if ($success) {
            $synced++;
            echo "[$num/$total] [OK] ID #{$pid} - {$title} (Stock: {$stock}, Images: " . count($images) . ")\n";
        } else {
            $failed++;
            echo "[$num/$total] [FAILED] ID #{$pid} - {$title}\n";
        }
    }

    echo "---------------------------------------------\n";
    echo "Sync Summary:\n";
    echo "Total: {$total} | Successfully Synced: {$synced} | Failed: {$failed}\n\n";

    // 5. Verification check
    echo "4. Verifying Supabase products table...\n";
    $verifyRes = $supabase->request('GET', 'products?select=count');
    if (isset($verifyRes['data'][0]['count'])) {
        echo "Total products in Supabase now: " . $verifyRes['data'][0]['count'] . "\n";
    } else {
        echo "Verification response: " . json_encode($verifyRes['data']) . "\n";
    }

    echo "\nAll done! The mobile app can now fetch all products from Supabase.\n";

} catch (Exception $e) {
    echo "Error during sync: " . $e->getMessage() . "\n";
}
