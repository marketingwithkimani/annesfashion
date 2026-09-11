<?php
require_once __DIR__ . '/backend/config/database.php';

try {
    $db = Database::getInstance()->getConnection();
    echo "Connected to database.\n";

    echo "\n--- Products (First 10) ---\n";
    $stmt = $db->query("SELECT id, title, is_active, allow_preorder FROM products LIMIT 10");
    while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        print_r($row);
    }

    echo "\n--- Products without Inventory or Zero Stock ---\n";
    $stmt = $db->query("SELECT p.id, p.title, i.quantity FROM products p LEFT JOIN inventory i ON p.id = i.product_id WHERE i.product_id IS NULL OR i.quantity = 0 LIMIT 20");
    while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        print_r($row);
    }

    echo "\n--- Total Counts ---\n";
    echo "Products: " . $db->query("SELECT COUNT(*) FROM products")->fetchColumn() . "\n";
    echo "Inventory Records: " . $db->query("SELECT COUNT(*) FROM inventory")->fetchColumn() . "\n";
    echo "Active Products: " . $db->query("SELECT COUNT(*) FROM products WHERE is_active = 1")->fetchColumn() . "\n";

    echo "\n--- Database Tables ---\n";
    $stmt = $db->query("SHOW TABLES");
    while($row = $stmt->fetch(PDO::FETCH_NUM)) {
        echo $row[0] . "\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
