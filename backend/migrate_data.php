<?php
// =====================================================
// Data Migration Script: Static JS -> SQL Database
// =====================================================

require_once __DIR__ . '/config/database.php';

header('Content-Type: text/plain');

try {
    $db = Database::getInstance()->getConnection();
    echo "Connected to database.\n";

    // 1. Read the JS file
    $jsPath = __DIR__ . '/../js/products-data.js';
    if (!file_exists($jsPath)) {
        throw new Exception("Source file not found: " . $jsPath);
    }

    $content = file_get_contents($jsPath);
    
    // 2. Extract JSON part
    // The file starts with "const productsData = [" and ends with "];"
    $startPos = strpos($content, '[');
    $endPos = strrpos($content, ']');
    
    if ($startPos === false || $endPos === false) {
        throw new Exception("Could not find JSON array in JS file");
    }
    
    $json = substr($content, $startPos, ($endPos - $startPos) + 1);
    $products = json_decode($json, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("JSON Decode Error: " . json_last_error_msg());
    }

    echo "Found " . count($products) . " products in static catalog.\n";

    // 3. Prepare Statements
    $stmtProd = $db->prepare("
        INSERT INTO products (id, title, description, price, category, sku, image_url, is_active)
        VALUES (:id, :title, :description, :price, :category, :sku, :image_url, 1)
        ON DUPLICATE KEY UPDATE 
            title = VALUES(title),
            description = VALUES(description),
            price = VALUES(price),
            category = VALUES(category),
            image_url = VALUES(image_url)
    ");

    $stmtInv = $db->prepare("
        INSERT INTO inventory (product_id, quantity)
        VALUES (:product_id, :quantity)
        ON DUPLICATE KEY UPDATE product_id = product_id
    ");

    $stmtImg = $db->prepare("
        INSERT INTO product_images (product_id, image_url, is_main)
        VALUES (:product_id, :image_url, 1)
        ON DUPLICATE KEY UPDATE image_url = VALUES(image_url)
    ");

    $imported = 0;
    foreach ($products as $p) {
        if ($p['type'] !== 'product') continue;

        // Clean price string "KSh 12,500" -> 12500
        $price = preg_replace('/[^0-9.]/', '', $p['price']);
        if (empty($price)) $price = 0;

        $sku = "LK-" . strtoupper(substr($p['category'], 0, 2)) . "-" . $p['id'];

        $stmtProd->execute([
            'id' => $p['id'],
            'title' => $p['title'],
            'description' => $p['description'],
            'price' => $price,
            'category' => $p['category'],
            'sku' => $sku,
            'image_url' => $p['image']
        ]);

        // Add default inventory (e.g., 10 units each)
        $stmtInv->execute([
            'product_id' => $p['id'],
            'quantity' => 10
        ]);

        // Add to images table
        $stmtImg->execute([
            'product_id' => $p['id'],
            'image_url' => $p['image']
        ]);

        $imported++;
    }

    echo "Successfully imported/updated $imported products in the database.\n";
    echo "Migration complete.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
