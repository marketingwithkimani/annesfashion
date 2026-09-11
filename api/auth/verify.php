<?php
// =====================================================
// Verify Token API Endpoint
// =====================================================

require_once __DIR__ . '/../../backend/config/cors.php';
require_once __DIR__ . '/../../backend/utils/response.php';
require_once __DIR__ . '/../../backend/middleware/auth.php';

// Only accept GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

// Verify token
$user = Auth::verifyToken();

Response::success([
    'user_id' => $user['user_id'],
    'role' => $user['role']
], 'Token is valid');
