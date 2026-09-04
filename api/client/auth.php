<?php
// =====================================================
// Customer Simple Authentication (Phone + PIN)
// Anne's Fashion Line
// =====================================================

require_once __DIR__ . '/../../backend/config/cors.php';
require_once __DIR__ . '/../../backend/config/database.php';
require_once __DIR__ . '/../../backend/utils/response.php';
require_once __DIR__ . '/../../backend/utils/supabase.php';
require_once __DIR__ . '/../../backend/middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['phone']) || !isset($data['pin'])) {
    Response::error('Phone number and PIN are required, babe! 💕');
}

// Clean and normalize phone number
$rawPhone = preg_replace('/[^0-9]/', '', (string)$data['phone']);
if (strlen($rawPhone) < 9) {
    Response::error('Please enter a valid Kenyan phone number, babe! 💕');
}

// Normalize to local 07... or 01... format and 254...
$localPhone = $rawPhone;
if (strpos($localPhone, '254') === 0 && strlen($localPhone) === 12) {
    $localPhone = '0' . substr($localPhone, 3);
} elseif (strlen($localPhone) === 9) {
    $localPhone = '0' . $localPhone;
}

$intPhone = '254' . substr($localPhone, 1);
$pin = trim((string)$data['pin']);
if (strlen($pin) < 3) {
    Response::error('PIN must be at least 3 digits, babe! ✨');
}

$action = isset($data['action']) ? $data['action'] : 'auto'; // 'login', 'signup', or 'auto'
$name = isset($data['name']) && !empty(trim($data['name'])) ? trim($data['name']) : 'Babe';
$location = isset($data['location']) ? trim($data['location']) : 'Nairobi';

try {
    $db = Database::getInstance()->getConnection();
    
    // Check if customer exists locally
    $stmt = $db->prepare("SELECT * FROM customers WHERE phone = :phone OR phone = :int_phone LIMIT 1");
    $stmt->execute(['phone' => $localPhone, 'int_phone' => $intPhone]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);
    
    $sup = SupabaseClient::getInstance();

    // If customer not found locally, check Supabase
    if (!$existing) {
        $supRes = $sup->request('GET', "customers?or=(phone.eq.{$localPhone},phone.eq.{$intPhone})&limit=1");
        if (!empty($supRes['data'][0])) {
            $supCust = $supRes['data'][0];
            $storedPinHash = null;
            if (!empty($supCust['address'])) {
                $addrJson = json_decode($supCust['address'], true);
                if (is_array($addrJson) && !empty($addrJson['pin_hash'])) {
                    $storedPinHash = $addrJson['pin_hash'];
                }
            }
            
            // Sync this customer into local MySQL
            try {
                $syncStmt = $db->prepare("
                    INSERT INTO customers (id, name, phone, pin_hash, address, city, customer_type, created_at)
                    VALUES (:id, :name, :phone, :pin_hash, :address, :city, 'online', NOW())
                    ON DUPLICATE KEY UPDATE pin_hash = VALUES(pin_hash), name = VALUES(name)
                ");
                $syncStmt->execute([
                    'id' => $supCust['id'],
                    'name' => $supCust['name'] ?: $name,
                    'phone' => $localPhone,
                    'pin_hash' => $storedPinHash,
                    'address' => $supCust['address'],
                    'city' => $supCust['city'] ?: 'Nairobi'
                ]);
            } catch (Throwable $e) {}

            $existing = [
                'id' => $supCust['id'],
                'name' => $supCust['name'] ?: $name,
                'phone' => $localPhone,
                'pin_hash' => $storedPinHash,
                'city' => $supCust['city'] ?: 'Nairobi'
            ];
        }
    }

    // Handle Login or Auto-login
    if ($existing) {
        if ($action === 'signup') {
            Response::error('You already have an account, babe! Just enter your PIN to sign in 💕');
        }

        // Verify PIN
        $pinHash = $existing['pin_hash'] ?? null;
        $pinMatched = false;

        if ($pinHash && password_verify($pin, $pinHash)) {
            $pinMatched = true;
        } elseif (!$pinHash) {
            // No PIN previously set (e.g. walk-in imported customer), set this PIN now
            $newHash = password_hash($pin, PASSWORD_BCRYPT);
            $db->prepare("UPDATE customers SET pin_hash = :hash WHERE id = :id")->execute(['hash' => $newHash, 'id' => $existing['id']]);
            $pinMatched = true;
        }

        if (!$pinMatched) {
            Response::error('Wrong PIN, sweetheart! Please try again or pick an easy one 💋', 401);
        }

        $token = Auth::generateToken($existing['id'], 'customer');
        Response::success([
            'token' => $token,
            'customer' => [
                'id' => (int)$existing['id'],
                'name' => $existing['name'] ?: 'Queen',
                'phone' => $localPhone,
                'city' => $existing['city'] ?? 'Nairobi'
            ],
            'message' => "Welcome back, gorgeous! 💕 You look stunning today."
        ]);
        exit;
    }

    // Handle Sign Up
    $pinHash = password_hash($pin, PASSWORD_BCRYPT);
    $addrData = json_encode([
        'pin_hash' => $pinHash,
        'delivery_location' => $location
    ]);

    // 1. Insert into local MySQL
    $insStmt = $db->prepare("
        INSERT INTO customers (name, phone, pin_hash, address, city, customer_type, created_at)
        VALUES (:name, :phone, :pin_hash, :address, :city, 'online', NOW())
    ");
    $insStmt->execute([
        'name' => $name,
        'phone' => $localPhone,
        'pin_hash' => $pinHash,
        'address' => $addrData,
        'city' => $location ?: 'Nairobi'
    ]);
    $customerId = (int)$db->lastInsertId();

    // 2. Dual-write to Supabase
    try {
        $supPayload = [
            'name' => $name,
            'phone' => $localPhone,
            'address' => $addrData,
            'city' => $location ?: 'Nairobi',
            'customer_type' => 'online'
        ];
        $supRes = $sup->request('POST', 'customers', $supPayload, ['Prefer: return=representation']);
        if (!empty($supRes['data'][0]['id']) && empty($customerId)) {
            $customerId = (int)$supRes['data'][0]['id'];
        }
    } catch (Throwable $e) {
        error_log("[Auth] Supabase sync notice: " . $e->getMessage());
    }

    $token = Auth::generateToken($customerId, 'customer');

    Response::success([
        'token' => $token,
        'customer' => [
            'id' => $customerId,
            'name' => $name,
            'phone' => $localPhone,
            'city' => $location ?: 'Nairobi'
        ],
        'message' => "Welcome to the family, babe! ✨ You're officially an Anne's Fashion insider."
    ], 'Account created successfully');

} catch (Throwable $e) {
    Response::error('Oops babe, something went wrong: ' . $e->getMessage(), 500);
}
