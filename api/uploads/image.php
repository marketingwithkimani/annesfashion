<?php
// =====================================================
// Image Upload API (Admin Only)
// =====================================================

require_once __DIR__ . '/../../backend/config/cors.php';
require_once __DIR__ . '/../../backend/middleware/auth.php';
require_once __DIR__ . '/../../backend/utils/response.php';

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

// Verify admin access
$user = Auth::requireAdmin();

// Check if file was uploaded
if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    Response::error('No image file uploaded or upload error occurred');
}

$file = $_FILES['image'];
$allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
$maxSize = 5 * 1024 * 1024; // 5MB

// Validate file type
if (!in_array($file['type'], $allowedTypes)) {
    Response::error('Invalid file type. Only JPG, PNG, and WebP are allowed.');
}

// Validate file size
if ($file['size'] > $maxSize) {
    Response::error('File is too large. Max size is 5MB.');
}

// Create uploads directory if it doesn't exist
$uploadDir = __DIR__ . '/../../backend/../uploads/products/';
if (!file_exists($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

// Generate unique filename
$extension = pathinfo($file['name'], PATHINFO_EXTENSION);
$filename = uniqid('prod_') . '.' . $extension;
$targetPath = $uploadDir . $filename;

// Move uploaded file
if (move_uploaded_file($file['tmp_name'], $targetPath)) {
    // Return the relative path from the root
    $relativeUrl = 'uploads/products/' . $filename;
    Response::success(['url' => $relativeUrl], 'Image uploaded successfully');
} else {
    Response::error('Failed to save uploaded file');
}
