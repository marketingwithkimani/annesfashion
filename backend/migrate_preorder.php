<?php
require_once __DIR__ . '/config/database.php';

header('Content-Type: text/plain');

try {
    $db = Database::getInstance()->getConnection();
    echo "Connected to database.\n";
    
    // Add allow_preorder column to products table
    $db->exec("ALTER TABLE products ADD COLUMN allow_preorder BOOLEAN DEFAULT FALSE AFTER is_active");
    echo "✅ Added 'allow_preorder' column to products table.\n";
    
    // Add global settings table if it doesn't exist for general switches
    $db->exec("CREATE TABLE IF NOT EXISTS settings (
        setting_key VARCHAR(50) PRIMARY KEY,
        setting_value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )");
    echo "✅ Ensuring settings table exists.\n";
    
    // Insert pre_order_mode setting
    $db->exec("INSERT IGNORE INTO settings (setting_key, setting_value) VALUES ('pre_order_mode', 'off')");
    echo "✅ Initialized 'pre_order_mode' setting.\n";

    echo "\nDatabase migration complete.\n";

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage();
}
?>
