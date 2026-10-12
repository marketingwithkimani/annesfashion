package com.example.data.models

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class User(
    val id: Int = 1,
    val username: String = "admin",
    val email: String = "admin@annesfashion.com",
    val role: String = "admin", // "admin" | "staff"
    @Json(name = "first_name") val firstName: String = "Admin",
    @Json(name = "last_name") val lastName: String = "User",
    val phone: String? = null,
    @Json(name = "is_active") val isActive: Int = 1
) {
    val isAdmin: Boolean get() = role.equals("admin", ignoreCase = true)
    val fullName: String get() = "$firstName $lastName".trim()
}

@JsonClass(generateAdapter = true)
data class LoginResponse(
    val success: Boolean,
    val data: LoginData? = null,
    val message: String? = null
)

@JsonClass(generateAdapter = true)
data class LoginData(
    val token: String,
    val user: User
)

@JsonClass(generateAdapter = true)
data class ProductImage(
    val id: Int = 0,
    val url: String,
    @Json(name = "is_main") val isMain: Int = 0
)

@JsonClass(generateAdapter = true)
data class Product(
    val id: Int,
    val title: String,
    val description: String = "",
    val price: Double,
    val category: String = "dresses", // casual|corporate|weekend|dresses|sweaters|trousers|jumpsuits|accessories|innerwear|wigs|beauty|shoes|general
    val sku: String = "",
    @Json(name = "image_url") val imageUrl: String? = null,
    @Json(name = "is_active") val isActive: Int = 1,
    @Json(name = "is_featured") val isFeatured: Int = 0,
    @Json(name = "allow_preorder") val allowPreorder: Int = 0,
    @Json(name = "total_stock") val totalStock: Int = 0,
    val images: List<ProductImage> = emptyList(),
    @Json(name = "created_at") val createdAt: String? = null,
    val sizes: List<String> = emptyList(),
    val colors: List<String> = emptyList(),
    @Json(name = "waist_sizes") val waistSizes: List<String> = emptyList(),
    @Json(name = "bust_sizes") val bustSizes: List<String> = emptyList(),
    @Json(name = "shoe_sizes") val shoeSizes: List<String> = emptyList()
) {
    val isLowStock: Boolean get() = totalStock in 1..5
    val isOutOfStock: Boolean get() = totalStock <= 0
    val hasVariants: Boolean get() = sizes.isNotEmpty() || colors.isNotEmpty() || waistSizes.isNotEmpty() || bustSizes.isNotEmpty() || shoeSizes.isNotEmpty()
    val isMultiColored: Boolean get() = colors.any { it.contains("multi", ignoreCase = true) } || colors.size > 1

    val allAvailableSizes: List<String> get() {
        val list = mutableListOf<String>()
        list.addAll(sizes)
        waistSizes.forEach { list.add("Waist $it") }
        bustSizes.forEach { list.add("Bust $it") }
        shoeSizes.forEach { list.add("Size $it") }
        return list.distinct()
    }
}

@JsonClass(generateAdapter = true)
data class ProductListResponse(
    val success: Boolean,
    val data: List<Product> = emptyList(),
    val message: String? = null
)

@JsonClass(generateAdapter = true)
data class CreateProductRequest(
    val title: String,
    val description: String,
    val price: Double,
    val category: String,
    val images: List<String> = emptyList(),
    @Json(name = "is_featured") val isFeatured: Int = 0,
    @Json(name = "allow_preorder") val allowPreorder: Int = 0,
    @Json(name = "initial_stock") val initialStock: Int = 0,
    val sizes: List<String> = emptyList(),
    val colors: List<String> = emptyList(),
    @Json(name = "waist_sizes") val waistSizes: List<String> = emptyList(),
    @Json(name = "bust_sizes") val bustSizes: List<String> = emptyList(),
    @Json(name = "shoe_sizes") val shoeSizes: List<String> = emptyList()
)

@JsonClass(generateAdapter = true)
data class UpdateProductRequest(
    val title: String,
    val description: String,
    val price: Double,
    val category: String,
    val images: List<String> = emptyList(),
    @Json(name = "is_featured") val isFeatured: Int = 0,
    @Json(name = "allow_preorder") val allowPreorder: Int = 0,
    val sizes: List<String> = emptyList(),
    val colors: List<String> = emptyList(),
    @Json(name = "waist_sizes") val waistSizes: List<String> = emptyList(),
    @Json(name = "bust_sizes") val bustSizes: List<String> = emptyList(),
    @Json(name = "shoe_sizes") val shoeSizes: List<String> = emptyList()
)

@JsonClass(generateAdapter = true)
data class SaleItemDetail(
    @Json(name = "product_id") val productId: Int,
    @Json(name = "product_title") val productTitle: String = "",
    val quantity: Int,
    @Json(name = "unit_price") val unitPrice: Double,
    @Json(name = "total_price") val totalPrice: Double = quantity * unitPrice
)

@JsonClass(generateAdapter = true)
data class Sale(
    val id: Int,
    @Json(name = "sale_number") val saleNumber: String,
    @Json(name = "sale_type") val saleType: String = "in-store", // "in-store" | "online"
    @Json(name = "customer_name") val customerName: String? = null,
    @Json(name = "customer_phone") val customerPhone: String? = null,
    @Json(name = "total_amount") val totalAmount: Double,
    @Json(name = "payment_method") val paymentMethod: String = "mpesa", // mpesa|cash|card|bank-transfer
    @Json(name = "payment_status") val paymentStatus: String = "paid",
    @Json(name = "transaction_reference") val transactionReference: String? = null,
    @Json(name = "staff_first_name") val staffFirstName: String? = null,
    val notes: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    val items: List<SaleItemDetail> = emptyList()
)

@JsonClass(generateAdapter = true)
data class SalesSummary(
    @Json(name = "total_amount") val totalAmount: Double = 0.0,
    val count: Int = 0
)

@JsonClass(generateAdapter = true)
data class SalesListData(
    val summary: SalesSummary = SalesSummary(),
    val sales: List<Sale> = emptyList()
)

@JsonClass(generateAdapter = true)
data class SalesListResponse(
    val success: Boolean,
    val data: SalesListData = SalesListData(),
    val message: String? = null
)

@JsonClass(generateAdapter = true)
data class RecordSaleItem(
    @Json(name = "product_id") val productId: Int,
    val quantity: Int,
    @Json(name = "unit_price") val unitPrice: Double
)

@JsonClass(generateAdapter = true)
data class RecordSaleRequest(
    @Json(name = "sale_type") val saleType: String,
    @Json(name = "customer_name") val customerName: String?,
    @Json(name = "customer_phone") val customerPhone: String?,
    @Json(name = "payment_method") val paymentMethod: String,
    @Json(name = "transaction_reference") val transactionReference: String?,
    val items: List<RecordSaleItem>,
    val notes: String? = null
)

@JsonClass(generateAdapter = true)
data class InventoryItem(
    val id: Int,
    val title: String,
    val category: String = "general",
    val price: Double = 0.0,
    val stock: Int = 0,
    @Json(name = "reorder_point") val reorderPoint: Int = 5,
    @Json(name = "is_low_stock") val isLowStock: Boolean = stock <= reorderPoint
)

@JsonClass(generateAdapter = true)
data class InventoryListResponse(
    val success: Boolean,
    val data: List<InventoryItem> = emptyList(),
    val message: String? = null
)

@JsonClass(generateAdapter = true)
data class UpdateStockRequest(
    @Json(name = "product_id") val productId: Int,
    @Json(name = "quantity_change") val quantityChange: Int,
    @Json(name = "action_type") val actionType: String, // restock|adjustment|return
    val reason: String? = null
)

@JsonClass(generateAdapter = true)
data class RevenueCount(
    val revenue: Double = 0.0,
    @Json(name = "sales_count") val salesCount: Int = 0
)

@JsonClass(generateAdapter = true)
data class TopProduct(
    val title: String,
    @Json(name = "total_sold") val totalSold: Int,
    @Json(name = "total_revenue") val totalRevenue: Double
)

@JsonClass(generateAdapter = true)
data class RecentSaleSummary(
    @Json(name = "sale_number") val saleNumber: String,
    @Json(name = "payment_method") val paymentMethod: String,
    @Json(name = "total_amount") val totalAmount: Double,
    @Json(name = "created_at") val createdAt: String?
)

@JsonClass(generateAdapter = true)
data class DashboardData(
    val today: RevenueCount = RevenueCount(),
    @Json(name = "this_month") val thisMonth: RevenueCount = RevenueCount(),
    @Json(name = "low_stock_count") val lowStockCount: Int = 0,
    @Json(name = "top_products") val topProducts: List<TopProduct> = emptyList(),
    @Json(name = "recent_sales") val recentSales: List<RecentSaleSummary> = emptyList()
)

@JsonClass(generateAdapter = true)
data class DashboardResponse(
    val success: Boolean,
    val data: DashboardData? = null,
    val message: String? = null
)

@JsonClass(generateAdapter = true)
data class GenericApiResponse(
    val success: Boolean,
    val message: String? = null
)

@JsonClass(generateAdapter = true)
data class SettingUpdateRequest(
    val key: String,
    val value: String
)

@JsonClass(generateAdapter = true)
data class RegisterUserRequest(
    val username: String = "",
    val email: String = "",
    val password: String,
    val role: String = "staff", // "admin" | "staff"
    @Json(name = "first_name") val firstName: String = "Staff",
    @Json(name = "last_name") val lastName: String = "",
    val phone: String? = null
)

@JsonClass(generateAdapter = true)
data class SavedLoginInfo(
    val email: String,
    val password: String,
    val rememberMe: Boolean = true,
    val biometricEnabled: Boolean = true,
    val userRole: String = "admin",
    val displayName: String = "Admin"
)

@JsonClass(generateAdapter = true)
data class Customer(
    val id: Long = 1,
    val name: String,
    val email: String? = null,
    val phone: String? = null,
    val address: String? = null,
    val city: String = "Nairobi",
    @Json(name = "customer_type") val customerType: String = "walk-in", // walk-in | VIP | online
    @Json(name = "total_orders") val totalOrders: Int = 0,
    @Json(name = "total_spent") val totalSpent: Double = 0.0,
    @Json(name = "created_at") val createdAt: String? = null
)

@JsonClass(generateAdapter = true)
data class InventoryLog(
    val id: Long = 1,
    @Json(name = "product_id") val productId: Int,
    @Json(name = "product_title") val productTitle: String = "",
    @Json(name = "quantity_change") val quantityChange: Int,
    @Json(name = "action_type") val actionType: String, // restock | adjustment | return | sale
    @Json(name = "user_name") val userName: String? = null,
    val reason: String? = null,
    @Json(name = "created_at") val createdAt: String? = null
)

data class SyncState(
    val isSyncing: Boolean = false,
    val lastSyncTime: String = "Never synced",
    val isSupabaseOnline: Boolean = false,
    val isWebsiteOnline: Boolean = false,
    val isAuthValid: Boolean = true,
    val statusText: String = "Ready to connect to live website",
    val tablesDetected: List<String> = emptyList(),
    val missingTables: List<String> = emptyList(),
    val troubleshootingTip: String? = null,
    val latencyMs: Long = 0,
    val diagnosticResult: com.example.data.api.SupabaseDiagnosticResult? = null
)

@JsonClass(generateAdapter = true)
data class Preorder(
    val id: Long = 0,
    @Json(name = "preorder_number") val preorderNumber: String = "",
    @Json(name = "product_id") val productId: Int = 0,
    @Json(name = "product_title") val productTitle: String = "",
    @Json(name = "customer_name") val customerName: String = "",
    @Json(name = "customer_phone") val customerPhone: String = "",
    @Json(name = "quantity") val quantity: Int = 1,
    @Json(name = "deposit_amount") val depositAmount: Double = 0.0,
    @Json(name = "total_amount") val totalAmount: Double = 0.0,
    @Json(name = "status") val status: String = "pending", // pending | arrived | fulfilled | cancelled
    @Json(name = "expected_date") val expectedDate: String? = null,
    @Json(name = "notes") val notes: String? = null,
    @Json(name = "created_at") val createdAt: String? = null
)

@JsonClass(generateAdapter = true)
data class Conversation(
    val id: Long = 0,
    @Json(name = "customer_name") val customerName: String = "Customer",
    @Json(name = "customer_phone") val customerPhone: String? = null,
    @Json(name = "customer_email") val customerEmail: String? = null,
    val status: String = "escalated", // active | escalated | resolved
    @Json(name = "last_message") val lastMessage: String = "",
    @Json(name = "unread_count") val unreadCount: Int = 0,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null
)

@JsonClass(generateAdapter = true)
data class ChatMessage(
    val id: Long = 0,
    @Json(name = "conversation_id") val conversationId: Long = 0,
    val sender: String = "customer", // customer | agent | bot
    @Json(name = "sender_name") val senderName: String = "",
    @Json(name = "message_text") val messageText: String = "",
    @Json(name = "created_at") val createdAt: String? = null
)

data class ProductImportRow(
    val title: String,
    val category: String = "dresses",
    val price: Double = 0.0,
    val stock: Int = 10,
    val sku: String? = null,
    val description: String = "",
    val allowPreorder: Boolean = false
)

data class ImportReport(
    val totalProcessed: Int = 0,
    val successful: Int = 0,
    val failed: Int = 0,
    val errors: List<String> = emptyList()
)

data class MpesaStkState(
    val isInitiating: Boolean = false,
    val checkoutRequestId: String? = null,
    val status: String = "idle", // idle | pending | completed | failed
    val message: String? = null
)

