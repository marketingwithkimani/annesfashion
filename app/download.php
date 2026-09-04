<?php
// =====================================================
// APK Download Handler — Anne's Fashion Line Admin
// =====================================================

$apkPath = realpath(__DIR__ . '/../anne app/AnnesFashion-debug.apk');

if (!$apkPath || !file_exists($apkPath)) {
    http_response_code(404);
    die('APK file not found. Please contact the administrator.');
}

$filename = 'AnnesFashion-debug.apk';
$filesize = filesize($apkPath);

// Force download headers
header('Content-Description: File Transfer');
header('Content-Type: application/vnd.android.package-archive');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Content-Transfer-Encoding: binary');
header('Expires: 0');
header('Cache-Control: must-revalidate');
header('Pragma: public');
header('Content-Length: ' . $filesize);

// Clear output buffer and send file
ob_clean();
flush();
readfile($apkPath);
exit;
