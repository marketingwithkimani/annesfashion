<?php
// =====================================================
// Login API Endpoint
// =====================================================

require_once __DIR__ . '/../../backend/config/cors.php';
require_once __DIR__ . '/../../backend/config/database.php';
require_once __DIR__ . '/../../backend/utils/response.php';
require_once __DIR__ . '/../../backend/middleware/auth.php';

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

// Get POST data
$data = json_decode(file_get_contents('php://input'), true);

// Validate input
if (!isset($data['email']) || !isset($data['password'])) {
    Response::error('Email and password are required');
}

$email = filter_var($data['email'], FILTER_SANITIZE_EMAIL);
$password = $data['password'];

try {
    $db = Database::getInstance()->getConnection();
    
    // Find user by email
    $stmt = $db->prepare("
        SELECT id, username, email, password_hash, role, first_name, last_name, is_active 
        FROM users 
        WHERE email = :email
    ");
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch();
    
    if (!$user) {
        Response::error('Invalid credentials', 401);
    }
    
    // Check if user is active
    if (!$user['is_active']) {
        Response::error('Account is inactive', 403);
    }
    
    // Verify password
    if (!password_verify($password, $user['password_hash'])) {
        Response::error('Invalid credentials', 401);
    }
    
    // Update last login
    $updateStmt = $db->prepare("UPDATE users SET last_login = NOW() WHERE id = :id");
    $updateStmt->execute(['id' => $user['id']]);
    
    // Generate JWT token
    $token = Auth::generateToken($user['id'], $user['role']);
    
    // Return success with token and user data
    Response::success([
        'token' => $token,
        'user' => [
            'id' => $user['id'],
            'username' => $user['username'],
            'email' => $user['email'],
            'role' => $user['role'],
            'first_name' => $user['first_name'],
            'last_name' => $user['last_name']
        ]
    ], 'Login successful');
    
} catch (PDOException $e) {
    Response::error('Login failed: ' . $e->getMessage(), 500);
}
