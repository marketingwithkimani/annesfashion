<?php
// =====================================================
// Anne's Fashion Line — Single Router for Vercel
// Combines all API endpoints into 1 Serverless Function
// =====================================================

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Strip leading /backend/api/ or /api/
$path = preg_replace('#^/(backend/)?api/#', '', $uri);
$path = trim($path, '/');

// If root API endpoint
if (empty($path) || $path === 'index.php') {
    header('Content-Type: application/json');
    echo json_encode(['success' => true, 'message' => "Anne's Fashion Line API Router Online"]);
    exit;
}

// Resolve target file inside api/ directory
$targetFile = __DIR__ . '/' . $path;

if (file_exists($targetFile) && is_file($targetFile)) {
    require_once $targetFile;
    exit;
}

// Check with .php extension
if (file_exists($targetFile . '.php') && is_file($targetFile . '.php')) {
    require_once $targetFile . '.php';
    exit;
}

// 404 Not Found
http_response_code(404);
header('Content-Type: application/json');
echo json_encode(['success' => false, 'message' => 'API Endpoint not found: ' . $path]);
