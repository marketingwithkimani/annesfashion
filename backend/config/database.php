<?php
// =====================================================
// Database Configuration
// =====================================================

// Load .env file if available
$envFile = __DIR__ . '/../../.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if (empty($line) || strpos($line, '#') === 0) continue;
        if (strpos($line, '=') !== false) {
            list($name, $value) = explode('=', $line, 2);
            $name = trim($name);
            $value = trim($value);
            if (!getenv($name)) {
                putenv("$name=$value");
                $_ENV[$name] = $value;
            }
        }
    }
}

define('DB_TYPE', getenv('DB_TYPE') ?: (getenv('SUPABASE_DB_HOST') ? 'pgsql' : 'mysql'));
define('DB_HOST', getenv('SUPABASE_DB_HOST') ?: (getenv('DB_HOST') ?: 'localhost'));
define('DB_PORT', getenv('SUPABASE_DB_PORT') ?: (getenv('DB_PORT') ?: (DB_TYPE === 'pgsql' ? '5432' : '3306')));
define('DB_NAME', getenv('SUPABASE_DB_NAME') ?: (getenv('DB_NAME') ?: 'postgres'));
define('DB_USER', getenv('SUPABASE_DB_USER') ?: (getenv('DB_USER') ?: 'root'));
define('DB_PASS', getenv('SUPABASE_DB_PASS') !== false ? getenv('SUPABASE_DB_PASS') : (getenv('DB_PASS') !== false ? getenv('DB_PASS') : ''));


// Create database connection
class Database {
    private static $instance = null;
    private $conn;
    
    private function __construct() {
        try {
            if (DB_TYPE === 'pgsql') {
                try {
                    $dsn = "pgsql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME;
                    $this->conn = new PDO(
                        $dsn,
                        DB_USER,
                        DB_PASS,
                        [
                            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                            PDO::ATTR_EMULATE_PREPARES => false
                        ]
                    );
                    return;
                } catch (PDOException $pgEx) {
                    // Fallback to local MySQL if remote PostgreSQL is unreachable
                    $mysqlHost = getenv('DB_HOST') ?: 'localhost';
                    $mysqlName = getenv('DB_NAME') ?: 'boutique_db';
                    $mysqlUser = getenv('DB_USER') ?: 'root';
                    $mysqlPass = getenv('DB_PASS') !== false ? getenv('DB_PASS') : '';
                    $dsn = "mysql:host={$mysqlHost};port=3306;dbname={$mysqlName};charset=utf8mb4";
                    $this->conn = new PDO(
                        $dsn,
                        $mysqlUser,
                        $mysqlPass,
                        [
                            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                            PDO::ATTR_EMULATE_PREPARES => false
                        ]
                    );
                    return;
                }
            } else {
                $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
                $this->conn = new PDO(
                    $dsn,
                    DB_USER,
                    DB_PASS,
                    [
                        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                        PDO::ATTR_EMULATE_PREPARES => false
                    ]
                );
            }
        } catch(PDOException $e) {
            die(json_encode([
                'success' => false,
                'message' => 'Database connection failed: ' . $e->getMessage()
            ]));
        }
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new Database();
        }
        return self::$instance;
    }
    
    public function getConnection() {
        return $this->conn;
    }
}
