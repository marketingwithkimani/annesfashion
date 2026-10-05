<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Load .env file if available (for local XAMPP environment)
$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if (empty($line) || strpos($line, '#') === 0) continue;
        if (strpos($line, '=') !== false) {
            list($name, $value) = explode('=', $line, 2);
            $name = trim($name);
            $value = trim($value);
            putenv("{$name}={$value}");
            $_ENV[$name] = $value;
            $_SERVER[$name] = $value;
        }
    }
}

// Get credentials securely from environment variables, with fallback to verified credentials
$defaultAuth = 'Basic a0tXcTZOanFqUjdPTGJGZVdESzI6dERrWkVxMkcwaHNCekVtZm5ZTmd4Sjc1Wjk4bG9PRE1lakxMdFMyQQ==';
$basicAuth = getenv('PAYHERO_BASIC_AUTH') ?: ($_ENV['PAYHERO_BASIC_AUTH'] ?? ($_SERVER['PAYHERO_BASIC_AUTH'] ?? $defaultAuth));
$channelId = (int)(getenv('PAYHERO_CHANNEL_ID') ?: ($_ENV['PAYHERO_CHANNEL_ID'] ?? ($_SERVER['PAYHERO_CHANNEL_ID'] ?? 13627)));

// Read JSON input or fallback to $_POST
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);
if (!is_array($input)) {
    $input = $_POST;
}

$phone = $input['phone'] ?? $input['phone_number'] ?? null;
$amount = $input['amount'] ?? null;

if (empty($phone) || empty($amount)) {
    http_response_code(400);
    echo json_encode(['error' => 'Phone and amount are required']);
    exit;
}

// Clean phone number (converts e.g. 0712345678 or +2547... to 254...)
$cleanPhone = preg_replace('/\D/', '', (string)$phone);
if (strpos($cleanPhone, '0') === 0) {
    $cleanPhone = '254' . substr($cleanPhone, 1);
}

$payload = [
    'amount' => (int)$amount,
    'phone_number' => $cleanPhone,
    'channel_id' => $channelId,
    'provider' => 'm-pesa',
    'external_reference' => 'ORD-' . round(microtime(true) * 1000)
];

$ch = curl_init('https://backend.payhero.co.ke/api/v2/payments');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: ' . $basicAuth,
    'Content-Type: application/json'
]);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

$response = curl_exec($ch);
$httpStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    http_response_code(500);
    echo json_encode(['error' => $curlError]);
    exit;
}

$resultJson = json_decode($response, true);
http_response_code($httpStatus > 0 ? $httpStatus : 200);

if (is_array($resultJson)) {
    echo json_encode($resultJson);
} else {
    echo $response ?: json_encode(['error' => 'Empty response from payment gateway']);
}
