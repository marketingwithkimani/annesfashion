<?php
require_once __DIR__ . '/../../backend/config/cors.php';
require_once __DIR__ . '/../../backend/config/database.php';
require_once __DIR__ . '/../../backend/utils/response.php';
require_once __DIR__ . '/../../backend/utils/supabase.php';
require_once __DIR__ . '/../../backend/middleware/auth.php';

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

// Verify admin access
$user = Auth::requireAdmin();

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['key']) || !isset($data['value'])) {
    Response::error('Key and value are required');
}

try {
    $db = Database::getInstance()->getConnection();
    $stmt = $db->prepare("
        INSERT INTO settings (setting_key, setting_value) 
        VALUES (:key, :value) 
        ON DUPLICATE KEY UPDATE setting_value = :value
    ");
    $stmt->execute([
        'key' => $data['key'],
        'value' => $data['value']
    ]);

    // Also sync to Supabase settings table
    try {
        SupabaseClient::getInstance()->request('POST', 'settings', [
            [
                'setting_key' => $data['key'],
                'setting_value' => (string)$data['value'],
                'updated_at' => date('c')
            ]
        ], ['Prefer: resolution=merge-duplicates']);
    } catch (Throwable $syncEx) {
        error_log("[SettingsUpdate] Supabase sync notice: " . $syncEx->getMessage());
    }
    
    Response::success(null, 'Setting updated successfully');
    
} catch (PDOException $e) {
    Response::error('Failed to update setting: ' . $e->getMessage(), 500);
}
