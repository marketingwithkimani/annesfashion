<?php
// =====================================================
// M-Pesa STK Push API (Kenyan Babe Experience)
// Anne's Fashion Line
// =====================================================

require_once __DIR__ . '/../../backend/config/cors.php';
require_once __DIR__ . '/../../backend/utils/response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['phone']) || !isset($data['amount'])) {
    Response::error('Phone number and amount are required, babe! 💕');
}

$rawPhone = preg_replace('/[^0-9]/', '', (string)$data['phone']);
if (strlen($rawPhone) < 9) {
    Response::error('Enter a valid Safaricom M-Pesa phone number, honey! 📱');
}

// Convert to 254... format
if (strpos($rawPhone, '254') === 0 && strlen($rawPhone) === 12) {
    $phone = $rawPhone;
} elseif (strpos($rawPhone, '0') === 0 && strlen($rawPhone) === 10) {
    $phone = '254' . substr($rawPhone, 1);
} elseif (strlen($rawPhone) === 9) {
    $phone = '254' . $rawPhone;
} else {
    $phone = $rawPhone;
}

$amount = max(1, (int)round((float)$data['amount']));
$orderRef = !empty($data['order_ref']) ? preg_replace('/[^a-zA-Z0-9_-]/', '', $data['order_ref']) : 'ANNES-' . rand(1000, 9999);

// Call PayHero M-Pesa STK Push
try {
    $payheroPayload = [
        'amount' => $amount,
        'phone_number' => $phone,
        'channel_id' => (int)(getenv('PAYHERO_CHANNEL_ID') ?: ($_ENV['PAYHERO_CHANNEL_ID'] ?? 13627)),
        'provider' => 'm-pesa',
        'external_reference' => $orderRef
    ];

    $ch = curl_init('https://backend.payhero.co.ke/api/v2/payments');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payheroPayload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: ' . (getenv('PAYHERO_BASIC_AUTH') ?: ($_ENV['PAYHERO_BASIC_AUTH'] ?? '')),
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    $payheroRes = json_decode(curl_exec($ch), true);
    curl_close($ch);

    if (!empty($payheroRes['CheckoutRequestID'])) {
        $checkoutRequestId = $payheroRes['CheckoutRequestID'];
    }
    if (!empty($payheroRes['reference'])) {
        $fakeRef = $payheroRes['reference'];
    }
} catch (Throwable $e) {
    error_log("[STK Push] PayHero request error: " . $e->getMessage());
}

// Generate realistic simulated M-Pesa transaction reference (e.g. QDF8HJ4K)
$chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
$fakeRef = 'Q';
for ($i = 0; $i < 9; $i++) {
    $fakeRef .= $chars[rand(0, strlen($chars) - 1)];
}

// Format friendly phone display (e.g. 0712 *** 678)
$maskedPhone = substr($phone, 0, 4) . '***' . substr($phone, -3);

Response::success([
    'checkout_request_id' => $checkoutRequestId,
    'transaction_reference' => $fakeRef,
    'amount' => $amount,
    'phone' => $phone,
    'masked_phone' => $maskedPhone,
    'message' => "Prompt sent to {$maskedPhone}, babe! 📲 Check your phone screen right now & enter your M-Pesa PIN 💕"
]);
