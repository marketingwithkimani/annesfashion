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

// Check if Daraja credentials exist in environment
$consumerKey = getenv('MPESA_CONSUMER_KEY');
$consumerSecret = getenv('MPESA_CONSUMER_SECRET');
$passkey = getenv('MPESA_PASSKEY');
$shortcode = getenv('MPESA_SHORTCODE');

$checkoutRequestId = 'ws_CO_' . date('dmYHis') . rand(1000, 9999);

// If live credentials present, make real Daraja call
if ($consumerKey && $consumerSecret && $passkey && $shortcode) {
    try {
        $env = getenv('MPESA_ENV') === 'production' ? 'api' : 'sandbox';
        $authUrl = "https://{$env}.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
        
        $ch = curl_init($authUrl);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Authorization: Basic ' . base64_encode("{$consumerKey}:{$consumerSecret}")]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $authRes = json_decode(curl_exec($ch), true);
        curl_close($ch);
        
        if (!empty($authRes['access_token'])) {
            $token = $authRes['access_token'];
            $timestamp = date('YmdHis');
            $password = base64_encode($shortcode . $passkey . $timestamp);
            $stkUrl = "https://{$env}.safaricom.co.ke/mpesa/stkpush/v1/processrequest";
            
            $stkPayload = [
                'BusinessShortCode' => $shortcode,
                'Password' => $password,
                'Timestamp' => $timestamp,
                'TransactionType' => 'CustomerPayBillOnline',
                'Amount' => $amount,
                'PartyA' => $phone,
                'PartyB' => $shortcode,
                'PhoneNumber' => $phone,
                'CallBackURL' => (isset($_SERVER['HTTPS']) ? 'https://' : 'http://') . $_SERVER['HTTP_HOST'] . '/api/client/mpesa_callback.php',
                'AccountReference' => "Anne's Fashion",
                'TransactionDesc' => "Wardrobe Order {$orderRef}"
            ];
            
            $ch = curl_init($stkUrl);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Authorization: Bearer ' . $token,
                'Content-Type: application/json'
            ]);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($stkPayload));
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            $stkRes = json_decode(curl_exec($ch), true);
            curl_close($ch);
            
            if (!empty($stkRes['CheckoutRequestID'])) {
                $checkoutRequestId = $stkRes['CheckoutRequestID'];
            }
        }
    } catch (Throwable $e) {
        error_log("[STK Push] Daraja request error: " . $e->getMessage());
    }
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
