<?php
require_once __DIR__ . '/backend/config/database.php';

try {
    $db = Database::getInstance()->getConnection();
    $sql = file_get_contents(__DIR__ . '/backend/database/migrations/002_product_images_table.sql');
    
    // Split by semicolon and run each query
    $queries = explode(';', $sql);
    foreach ($queries as $query) {
        $query = trim($query);
        if (empty($query)) continue;
        $db->exec($query);
        echo "Executed: " . substr($query, 0, 50) . "...\n";
    }
    echo "Migration complete.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
