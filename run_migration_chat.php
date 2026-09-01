<?php
require_once __DIR__ . '/backend/config/database.php';

try {
    $db = Database::getInstance()->getConnection();
    $sql = file_get_contents(__DIR__ . '/backend/database/migrations/003_chat_system.sql');
    
    // Split by semicolon and run each query
    $queries = explode(';', $sql);
    foreach ($queries as $query) {
        $query = trim($query);
        if (empty($query)) continue;
        try {
            $db->exec($query);
            echo "Executed: " . substr($query, 0, 60) . "...\n";
        } catch (Exception $e) {
            echo "Notice on query: " . $e->getMessage() . "\n";
        }
    }
    echo "Chat migration complete.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
