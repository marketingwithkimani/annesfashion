<?php
require_once __DIR__ . '/backend/config/database.php';

try {
    $db = Database::getInstance()->getConnection();
    echo "Verification Report:\n";
    echo "-------------------\n";

    echo "Total Products: " . $db->query("SELECT COUNT(*) FROM products")->fetchColumn() . "\n";
    echo "Active Products: " . $db->query("SELECT COUNT(*) FROM products WHERE is_active = 1")->fetchColumn() . "\n";
    echo "Products with Inventory: " . $db->query("SELECT COUNT(*) FROM inventory")->fetchColumn() . "\n";
    echo "Items with Zero Stock: " . $db->query("SELECT COUNT(*) FROM inventory WHERE quantity = 0")->fetchColumn() . "\n";
    echo "Total Product Images: " . $db->query("SELECT COUNT(*) FROM product_images")->fetchColumn() . "\n";

    echo "\nSample Images (Last 5):\n";
    $stmt = $db->query("SELECT product_id, image_url, is_main FROM product_images ORDER BY id DESC LIMIT 5");
    while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        print_r($row);
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
