<?php
require_once __DIR__ . '/../../backend/config/cors.php';
require_once __DIR__ . '/../../backend/config/database.php';
require_once __DIR__ . '/../../backend/utils/response.php';
require_once __DIR__ . '/../../backend/utils/supabase.php';
require_once __DIR__ . '/../../backend/middleware/auth.php';

// Only accept GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

if (!isset($_GET['key'])) {
    Response::error('Setting key is required');
}

$key = $_GET['key'];

// Public keys don't require authentication
$publicKeys = ['pre_order_mode'];
if (!in_array($key, $publicKeys)) {
    $user = Auth::requireAuth();
}

try {
    $val = null;

    // 1. Try Supabase first if configured to get real-time state from app
    try {
        $sup = SupabaseClient::getInstance();
        $supRes = $sup->request('GET', "settings?setting_key=eq.{$key}&select=setting_value");
        if (!empty($supRes['data'][0]['setting_value'])) {
            $val = $supRes['data'][0]['setting_value'];
        }
    } catch (Throwable $e) {}

    // 2. If not found in Supabase, check local database
    if ($val === null) {
        $db = Database::getInstance()->getConnection();
        $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = :key");
        $stmt->execute(['key' => $key]);
        $setting = $stmt->fetch();
        if ($setting) {
            $val = $setting['setting_value'];
        }
    }
    
    if ($val === null) {
        Response::notFound('Setting not found');
    }
    
    Response::success(['key' => $key, 'value' => $val], 'Setting retrieved');
    
} catch (PDOException $e) {
    Response::error('Failed to retrieve setting: ' . $e->getMessage(), 500);
}
