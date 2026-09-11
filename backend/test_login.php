<?php
// =====================================================
// Test Login Credentials
// =====================================================

require_once __DIR__ . '/config/database.php';

echo "<h2>Database Connection Test</h2>";

try {
    $db = Database::getInstance()->getConnection();
    echo "✅ Database connection successful!<br><br>";
    
    // Check if users table exists
    $stmt = $db->query("SHOW TABLES LIKE 'users'");
    if ($stmt->rowCount() > 0) {
        echo "✅ Users table exists<br><br>";
        
        // Get all users
        echo "<h3>Users in Database:</h3>";
        $stmt = $db->query("SELECT id, username, email, role, first_name, last_name, is_active FROM users");
        $users = $stmt->fetchAll();
        
        if (count($users) > 0) {
            echo "<table border='1' cellpadding='5'>";
            echo "<tr><th>ID</th><th>Username</th><th>Email</th><th>Role</th><th>Name</th><th>Active</th></tr>";
            foreach ($users as $user) {
                echo "<tr>";
                echo "<td>" . $user['id'] . "</td>";
                echo "<td>" . $user['username'] . "</td>";
                echo "<td>" . $user['email'] . "</td>";
                echo "<td>" . $user['role'] . "</td>";
                echo "<td>" . $user['first_name'] . " " . $user['last_name'] . "</td>";
                echo "<td>" . ($user['is_active'] ? 'Yes' : 'No') . "</td>";
                echo "</tr>";
            }
            echo "</table><br>";
        } else {
            echo "❌ No users found in database!<br>";
            echo "Please run the setup.sql script to create default users.<br>";
        }
        
        // Test password verification
        echo "<h3>Password Hash Test:</h3>";
        
        // Test admin password
        $adminEmail = 'admin@annesfashion.com';
        $adminPassword = 'admin123';
        
        $stmt = $db->prepare("SELECT password_hash FROM users WHERE email = :email");
        $stmt->execute(['email' => $adminEmail]);
        $admin = $stmt->fetch();
        
        if ($admin) {
            echo "Admin user found<br>";
            echo "Testing password 'admin123'...<br>";
            if (password_verify($adminPassword, $admin['password_hash'])) {
                echo "✅ Admin password verification SUCCESSFUL!<br>";
            } else {
                echo "❌ Admin password verification FAILED!<br>";
                echo "Hash in DB: " . $admin['password_hash'] . "<br>";
                echo "Expected hash for 'admin123': " . password_hash($adminPassword, PASSWORD_DEFAULT) . "<br>";
            }
        } else {
            echo "❌ Admin user not found!<br>";
        }
        echo "<br>";
        
        // Test staff password
        $staffEmail = 'staff@annesfashion.com';
        $staffPassword = 'staff123';
        
        $stmt = $db->prepare("SELECT password_hash FROM users WHERE email = :email");
        $stmt->execute(['email' => $staffEmail]);
        $staff = $stmt->fetch();
        
        if ($staff) {
            echo "Staff user found<br>";
            echo "Testing password 'staff123'...<br>";
            if (password_verify($staffPassword, $staff['password_hash'])) {
                echo "✅ Staff password verification SUCCESSFUL!<br>";
            } else {
                echo "❌ Staff password verification FAILED!<br>";
                echo "Hash in DB: " . $staff['password_hash'] . "<br>";
            }
        } else {
            echo "❌ Staff user not found!<br>";
        }
        
    } else {
        echo "❌ Users table does not exist!<br>";
        echo "Please run the setup.sql script first.<br>";
    }
    
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage();
}

echo "<br><br>";
echo "<h3>Next Steps:</h3>";
echo "<ol>";
echo "<li>If password verification fails, run the SQL commands in the 'Fix' section below</li>";
echo "<li>Visit <a href='http://localhost/Boutique/api/auth/login.php'>Login API Test</a> (use POST request tool)</li>";
echo "</ol>";

echo "<h3>Fix SQL Commands (if needed):</h3>";
echo "<pre>";
echo "-- Run these in phpMyAdmin to recreate users with correct passwords:\n\n";
echo "DELETE FROM users WHERE email IN ('admin@annesfashion.com', 'staff@annesfashion.com');\n\n";
echo "INSERT INTO users (username, email, password_hash, role, first_name, last_name) VALUES\n";
echo "('admin', 'admin@annesfashion.com', '\$2y\$10\$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'Admin', 'User'),\n";
echo "('staff', 'staff@annesfashion.com', '\$2y\$10\$TKh8H1.PfQx37YgCzwiKb.KjNyWgaHb9cbcoQgdIVFlYg7B77UdFm', 'staff', 'Staff', 'User');\n";
echo "</pre>";
?>
