<?php
// =====================================================
// APK Download — Anne's Fashion Line Admin
// Redirects to Supabase Storage (works on Vercel + local)
// =====================================================

// Supabase public URL for the APK
$supabaseApkUrl = 'https://yteejssnesajnuibfacx.supabase.co/storage/v1/object/public/downloads/AnnesFashion-debug.apk';

// If on local XAMPP and file exists, serve directly
$localPath = realpath(__DIR__ . '/../anne-app/AnnesFashion-debug.apk');
$isLocal = (strpos($_SERVER['HTTP_HOST'] ?? '', 'localhost') !== false || strpos($_SERVER['HTTP_HOST'] ?? '', '127.0.0.1') !== false);

if ($isLocal && $localPath && file_exists($localPath)) {
    set_time_limit(0);
    ini_set('memory_limit', '-1');
    ini_set('zlib.output_compression', 'Off');

    while (ob_get_level() > 0) ob_end_clean();

    header('Content-Description: File Transfer');
    header('Content-Type: application/vnd.android.package-archive');
    header('Content-Disposition: attachment; filename="AnnesFashion-debug.apk"');
    header('Content-Transfer-Encoding: binary');
    header('Cache-Control: no-cache');
    header('Content-Length: ' . filesize($localPath));

    $handle = fopen($localPath, 'rb');
    while (!feof($handle)) {
        echo fread($handle, 1024 * 1024);
        flush();
    }
    fclose($handle);
    exit;
}

// On Vercel / production: redirect to Supabase Storage
header('Location: ' . $supabaseApkUrl);
exit;
