<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$ref = $_GET['reference'] ?? '';
if (empty($ref)) {
    http_response_code(400);
    echo json_encode(['error' => 'Reference query parameter is required']);
    exit;
}

// 1. Load .env file if present
$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    $lines = @file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
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

$defaultAuth = 'Basic a0tXcTZOanFqUjdPTGJGZVdESzI6dERrWkVxMkcwaHNCekVtZm5ZTmd4Sjc1Wjk4bG9PRE1lakxMdFMyQQ==';
$basicAuth = getenv('PAYHERO_BASIC_AUTH') ?: ($_ENV['PAYHERO_BASIC_AUTH'] ?? ($_SERVER['PAYHERO_BASIC_AUTH'] ?? $defaultAuth));

$targetUrl = 'https://backend.payhero.co.ke/api/v2/transaction-status?reference=' . urlencode($ref);
$responseBody = false;
$statusCode = 200;

if (function_exists('curl_init')) {
    $ch = curl_init($targetUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: ' . $basicAuth,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    $responseBody = curl_exec($ch);
    $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
}

if (!$responseBody) {
    $opts = [
        'http' => [
            'method' => 'GET',
            'header' => "Authorization: {$basicAuth}\r\nContent-Type: application/json\r\n",
            'timeout' => 15,
            'ignore_errors' => true
        ],
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false
        ]
    ];
    $ctx = stream_context_create($opts);
    $responseBody = @file_get_contents($targetUrl, false, $ctx);
}

$json = json_decode($responseBody, true);
if (is_array($json)) {
    http_response_code($statusCode > 0 ? $statusCode : 200);
    echo json_encode($json);
} else {
    http_response_code(200);
    echo json_encode(['status' => 'QUEUED', 'raw' => $responseBody]);
}
