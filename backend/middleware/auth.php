<?php
// =====================================================
// Authentication Middleware
// =====================================================

require_once __DIR__ . '/../utils/response.php';

class Auth {
    
    private static $secretKey = 'AnnesFashionSecretKey2026_ChangeThis!'; // CHANGE IN PRODUCTION!
    
    // Generate JWT token
    public static function generateToken($userId, $role) {
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        $payload = json_encode([
            'user_id' => $userId,
            'role' => $role,
            'iat' => time(),
            'exp' => time() + (86400 * 7) // 7 days
        ]);
        
        $base64UrlHeader = self::base64UrlEncode($header);
        $base64UrlPayload = self::base64UrlEncode($payload);
        $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, self::$secretKey, true);
        $base64UrlSignature = self::base64UrlEncode($signature);
        
        return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
    }
    
    // Verify JWT token
    public static function verifyToken() {
        $headers = getallheaders();
        $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : 
                     (isset($headers['authorization']) ? $headers['authorization'] : null);
        
        if (!$authHeader) {
            Response::unauthorized('No token provided');
        }
        
        // Extract token from "Bearer <token>"
        $token = str_replace('Bearer ', '', $authHeader);
        
        $tokenParts = explode('.', $token);
        if (count($tokenParts) !== 3) {
            Response::unauthorized('Invalid token format');
        }
        
        $header = base64_decode($tokenParts[0]);
        $payload = base64_decode($tokenParts[1]);
        $signatureProvided = $tokenParts[2];
        
        // Verify signature
        $base64UrlHeader = self::base64UrlEncode($header);
        $base64UrlPayload = self::base64UrlEncode($payload);
        $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, self::$secretKey, true);
        $base64UrlSignature = self::base64UrlEncode($signature);
        
        if ($base64UrlSignature !== $signatureProvided) {
            Response::unauthorized('Invalid token signature');
        }
        
        $payloadData = json_decode($payload, true);
        
        // Check expiration
        if (isset($payloadData['exp']) && $payloadData['exp'] < time()) {
            Response::unauthorized('Token expired');
        }
        
        return $payloadData;
    }
    
    // Verify token and return payload (authenticated user)
    public static function requireAuth() {
        return self::verifyToken();
    }

    // Check if user is admin
    public static function requireAdmin() {
        $user = self::verifyToken();
        if ($user['role'] !== 'admin') {
            Response::forbidden('Admin access required');
        }
        return $user;
    }
    
    // Check if user is staff or admin
    public static function requireStaff() {
        $user = self::verifyToken();
        if (!in_array($user['role'], ['staff', 'admin'])) {
            Response::forbidden('Staff access required');
        }
        return $user;
    }
    
    private static function base64UrlEncode($data) {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}
