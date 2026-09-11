<?php
require_once __DIR__ . '/config/database.php';

header('Content-Type: text/plain');

try {
    $db = Database::getInstance()->getConnection();
    echo "Connected to database.\n\n";
    
    // Check if settings table exists
    $stmt = $db->query("SHOW TABLES LIKE 'settings'");
    $tableExists = $stmt->fetch();
    
    if ($tableExists) {
        echo "✅ Settings table exists.\n\n";
        
        // Check for pre_order_mode setting
        $stmt = $db->prepare("SELECT * FROM settings WHERE setting_key = 'pre_order_mode'");
        $stmt->execute();
        $setting = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($setting) {
            echo "✅ pre_order_mode setting found:\n";
            echo "   Key: " . $setting['setting_key'] . "\n";
            echo "   Value: " . $setting['setting_value'] . "\n";
            echo "   Updated: " . $setting['updated_at'] . "\n";
        } else {
            echo "❌ pre_order_mode setting NOT found.\n";
            echo "Creating it now...\n";
            $db->exec("INSERT INTO settings (setting_key, setting_value) VALUES ('pre_order_mode', 'off')");
            echo "✅ Created pre_order_mode setting.\n";
        }
    } else {
        echo "❌ Settings table does NOT exist.\n";
        echo "Creating it now...\n";
        $db->exec("CREATE TABLE IF NOT EXISTS settings (
            setting_key VARCHAR(50) PRIMARY KEY,
            setting_value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )");
        echo "✅ Created settings table.\n";
        $db->exec("INSERT INTO settings (setting_key, setting_value) VALUES ('pre_order_mode', 'off')");
        echo "✅ Created pre_order_mode setting.\n";
    }

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
?>
