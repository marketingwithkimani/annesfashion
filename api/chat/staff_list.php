<?php
// =====================================================
// Anne's Fashion Line — Chat: Staff Conversation List
// =====================================================
header('Content-Type: application/json');
require_once __DIR__ . '/../../backend/config/cors.php';
require_once __DIR__ . '/../../backend/config/database.php';
require_once __DIR__ . '/../../backend/utils/response.php';

try {
    $db = Database::getInstance()->getConnection();

    $statusFilter = isset($_GET['status']) ? trim($_GET['status']) : '';
    
    $where = "";
    $params = [];

    if ($statusFilter === 'pending' || $statusFilter === 'HUMAN_REQUESTED') {
        $where = "WHERE status = 'HUMAN_REQUESTED'";
    } else if ($statusFilter === 'assigned' || $statusFilter === 'HUMAN_ACTIVE') {
        $where = "WHERE status IN ('HUMAN_ASSIGNED', 'HUMAN_ACTIVE')";
    } else if ($statusFilter === 'resolved') {
        $where = "WHERE status IN ('RESOLVED', 'CLOSED')";
    } else if ($statusFilter === 'active_all') {
        $where = "WHERE status IN ('HUMAN_REQUESTED', 'HUMAN_ASSIGNED', 'HUMAN_ACTIVE')";
    }

    $sql = "SELECT * FROM chat_conversations {$where} ORDER BY last_message_at DESC LIMIT 50";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $conversations = $stmt->fetchAll(PDO::FETCH_ASSOC);

    Response::success($conversations, 'Staff conversation list retrieved');

} catch (Exception $e) {
    Response::error('Failed to fetch staff conversation list: ' . $e->getMessage());
}
