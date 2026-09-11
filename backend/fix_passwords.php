<?php
// =====================================================
// Fix Default Password Hashes
// =====================================================

require_once __DIR__ . '/config/database.php';

header('Content-Type: text/plain');

try {
    $db = Database::getInstance()->getConnection();
    echo "Connected to database.\n";
    
    // Default credentials to fix
    $users_to_fix = [
        [
            'email' => 'admin@annesfashion.com',
            'password' => 'admin123'
        ],
        [
            'email' => 'staff@annesfashion.com',
            'password' => 'staff123'
        ]
    ];
    
    foreach ($users_to_fix as $user) {
        $email = $user['email'];
        $plain_password = $user['password'];
        $new_hash = password_hash($plain_password, PASSWORD_DEFAULT);
        
        $stmt = $db->prepare("UPDATE users SET password_hash = :hash WHERE email = :email");
        $stmt->execute([
            'hash' => $new_hash,
            'email' => $email
        ]);
        
        if ($stmt->rowCount() > 0) {
            echo "✅ Successfully updated hash for $email\n";
        } else {
            // Might already match or user doesn't exist
            $check = $db->prepare("SELECT id FROM users WHERE email = :email");
            $check->execute(['email' => $email]);
            if ($check->fetch()) {
                echo "ℹ️ Hash for $email already updated or no change needed.\n";
            } else {
                echo "❌ User $email not found in database.\n";
            }
        }
    }
    
    echo "\nFix complete. Please run test_login.php to verify.\n";

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage();
}
?>
