<?php
// No time or memory limits for large file download
set_time_limit(0);
ini_set('memory_limit', '-1');
ini_set('zlib.output_compression', 'Off');

// Kill ALL output buffering layers
while (ob_get_level() > 0) {
    ob_end_clean();
}

$apkPath = realpath(__DIR__ . '/../anne-app/AnnesFashion-debug.apk');

if (!$apkPath || !file_exists($apkPath)) {
    http_response_code(404);
    header('Content-Type: text/plain');
    die('ERROR: APK not found at expected path. Contact admin.');
}

if (!is_readable($apkPath)) {
    http_response_code(403);
    header('Content-Type: text/plain');
    die('ERROR: APK file is not readable. Check XAMPP file permissions.');
}

$filesize = filesize($apkPath);

// Send download headers
header('Content-Description: File Transfer');
header('Content-Type: application/vnd.android.package-archive');
header('Content-Disposition: attachment; filename="AnnesFashion-debug.apk"');
header('Content-Transfer-Encoding: binary');
header('Cache-Control: no-cache, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');
header('Content-Length: ' . $filesize);

// Chunked stream — avoids loading 28MB into memory at once
$handle = fopen($apkPath, 'rb');
if ($handle === false) {
    http_response_code(500);
    die('ERROR: Could not open APK file for reading.');
}

$chunkSize = 1024 * 1024; // 1MB chunks
while (!feof($handle)) {
    $chunk = fread($handle, $chunkSize);
    echo $chunk;
    flush();
}

fclose($handle);
exit;
