package com.example.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.models.*
import com.example.data.repository.AnnesRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class PosCartItem(
    val product: Product,
    val quantity: Int,
    val selectedSize: String? = null,
    val selectedColor: String? = null
)

class AnnesViewModel(application: Application) : AndroidViewModel(application) {

    val repository = AnnesRepository(application)

    // Auth & User State
    val currentUser = repository.currentUser
    val authToken = repository.authToken
    val isServerConnected = repository.isServerConnected
    val serverStatusMessage = repository.serverStatusMessage
    val baseUrl = repository.baseUrl
    val globalPreorderMode = repository.globalPreorderMode
    val themeMode = repository.themeMode
    val savedLogin = repository.savedLogin
    val registeredUsers = repository.registeredUsers
    val customers = repository.customers
    val inventoryLogs = repository.inventoryLogs
    val supabaseUrl = repository.supabaseUrl
    val supabaseAnonKey = repository.supabaseAnonKey
    val supabaseServiceKey = repository.supabaseServiceKey
    val syncState = repository.syncState
    val websiteUrl = repository.websiteUrl

    // Data streams
    val products = repository.products
    val sales = repository.sales
    val dashboardData = repository.dashboardData
    val preorders = repository.preorders
    val conversations = repository.conversations
    val activeChatMessages = repository.activeChatMessages
    val mpesaStkState = repository.mpesaStkState

    // UI Navigation State
    private val _currentTab = MutableStateFlow(0)
    val currentTab: StateFlow<Int> = _currentTab.asStateFlow()

    private val _isSplashDone = MutableStateFlow(false)
    val isSplashDone: StateFlow<Boolean> = _isSplashDone.asStateFlow()

    // Sync Center Modal
    private val _showSyncCenterSheet = MutableStateFlow(false)
    val showSyncCenterSheet: StateFlow<Boolean> = _showSyncCenterSheet.asStateFlow()

    // Filters
    private val _productSearchQuery = MutableStateFlow("")
    val productSearchQuery: StateFlow<String> = _productSearchQuery.asStateFlow()

    private val _selectedCategory = MutableStateFlow("All")
    val selectedCategory: StateFlow<String> = _selectedCategory.asStateFlow()

    private val _inventoryOnlyLowStock = MutableStateFlow(false)
    val inventoryOnlyLowStock: StateFlow<Boolean> = _inventoryOnlyLowStock.asStateFlow()

    private val _salesTypeFilter = MutableStateFlow("All") // "All" | "In-Store" | "Online"
    val salesTypeFilter: StateFlow<String> = _salesTypeFilter.asStateFlow()

    // Modals and Dialogs
    private val _showSettingsSheet = MutableStateFlow(false)
    val showSettingsSheet: StateFlow<Boolean> = _showSettingsSheet.asStateFlow()

    private val _showAddProductSheet = MutableStateFlow(false)
    val showAddProductSheet: StateFlow<Boolean> = _showAddProductSheet.asStateFlow()

    private val _editingProduct = MutableStateFlow<Product?>(null)
    val editingProduct: StateFlow<Product?> = _editingProduct.asStateFlow()

    private val _updatingStockProduct = MutableStateFlow<Product?>(null)
    val updatingStockProduct: StateFlow<Product?> = _updatingStockProduct.asStateFlow()

    private val _showRecordSaleSheet = MutableStateFlow(false)
    val showRecordSaleSheet: StateFlow<Boolean> = _showRecordSaleSheet.asStateFlow()

    private val _showQuickPos = MutableStateFlow(false)
    val showQuickPos: StateFlow<Boolean> = _showQuickPos.asStateFlow()

    private val _selectedProductDetail = MutableStateFlow<Product?>(null)
    val selectedProductDetail: StateFlow<Product?> = _selectedProductDetail.asStateFlow()

    // Conversations & Pre-order sheets
    private val _selectedConversation = MutableStateFlow<Conversation?>(null)
    val selectedConversation: StateFlow<Conversation?> = _selectedConversation.asStateFlow()

    private val _showCreatePreorderSheet = MutableStateFlow(false)
    val showCreatePreorderSheet: StateFlow<Boolean> = _showCreatePreorderSheet.asStateFlow()

    private val _showImportCsvSheet = MutableStateFlow(false)
    val showImportCsvSheet: StateFlow<Boolean> = _showImportCsvSheet.asStateFlow()

    // Live POS Cart
    private val _posCart = MutableStateFlow<List<PosCartItem>>(emptyList())
    val posCart: StateFlow<List<PosCartItem>> = _posCart.asStateFlow()

    // Status Messages & SnackBar
    private val _userMessage = MutableStateFlow<String?>(null)
    val userMessage: StateFlow<String?> = _userMessage.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    init {
        viewModelScope.launch {
            val saved = repository.savedLogin.value
            if (saved?.rememberMe == true && saved.email.isNotBlank() && saved.password.isNotBlank()) {
                login(saved.email, saved.password, rememberMe = true) { _, _ -> }
            }
            repository.testServerConnection()
            repository.refreshDashboard()
        }
    }

    fun setSplashFinished() {
        _isSplashDone.value = true
    }

    fun selectTab(index: Int) {
        _currentTab.value = index
    }

    fun jumpToInventoryLowStock() {
        _inventoryOnlyLowStock.value = true
        _currentTab.value = 3 // Inventory tab
    }

    fun setProductSearch(query: String) {
        _productSearchQuery.value = query
    }

    fun setCategoryFilter(category: String) {
        _selectedCategory.value = category
    }

    fun setInventoryFilter(lowStockOnly: Boolean) {
        _inventoryOnlyLowStock.value = lowStockOnly
    }

    fun setSalesTypeFilter(type: String) {
        _salesTypeFilter.value = type
    }

    fun showMessage(msg: String) {
        _userMessage.value = msg
    }

    fun clearMessage() {
        _userMessage.value = null
    }

    // Modal Control
    fun openSettings() { _showSettingsSheet.value = true }
    fun closeSettings() { _showSettingsSheet.value = false }

    fun openAddProduct() { _showAddProductSheet.value = true }
    fun closeAddProduct() { _showAddProductSheet.value = false }

    fun openEditProduct(product: Product) { _editingProduct.value = product }
    fun closeEditProduct() { _editingProduct.value = null }

    fun openStockUpdate(product: Product) { _updatingStockProduct.value = product }
    fun closeStockUpdate() { _updatingStockProduct.value = null }

    fun openRecordSale() { _showRecordSaleSheet.value = true }
    fun closeRecordSale() { _showRecordSaleSheet.value = false }

    fun openQuickPos() { _showQuickPos.value = true }
    fun closeQuickPos() { _showQuickPos.value = false }

    fun openProductDetail(product: Product) { _selectedProductDetail.value = product }
    fun closeProductDetail() { _selectedProductDetail.value = null }

    fun openCreatePreorder() { _showCreatePreorderSheet.value = true }
    fun closeCreatePreorder() { _showCreatePreorderSheet.value = false }

    fun openImportCsv() { _showImportCsvSheet.value = true }
    fun closeImportCsv() { _showImportCsvSheet.value = false }

    // Theme Actions
    fun setThemeMode(mode: com.example.ui.theme.AppThemeMode) {
        repository.setThemeMode(mode)
    }

    fun toggleThemeMode() {
        val current = repository.themeMode.value
        val next = when (current) {
            com.example.ui.theme.AppThemeMode.DARK -> com.example.ui.theme.AppThemeMode.LIGHT
            com.example.ui.theme.AppThemeMode.LIGHT -> com.example.ui.theme.AppThemeMode.DARK
            com.example.ui.theme.AppThemeMode.SYSTEM -> com.example.ui.theme.AppThemeMode.LIGHT
        }
        repository.setThemeMode(next)
        showMessage("Switched to ${next.name.lowercase().replaceFirstChar { it.uppercase() }} Mode")
    }

    fun updateSupabaseCredentials(url: String, anonKey: String, serviceKey: String = "") {
        repository.updateSupabaseCredentials(url, anonKey, serviceKey)
        showMessage("Supabase configuration updated successfully")
    }

    fun saveLoginCredentials(info: SavedLoginInfo) {
        repository.saveLoginCredentials(info)
        showMessage("Login credentials remembered securely")
    }

    fun clearSavedCredentials() {
        repository.clearSavedCredentials()
        showMessage("Saved credentials cleared")
    }

    fun registerUser(request: RegisterUserRequest, onResult: (Boolean, String?) -> Unit) {
        if (request.username.isBlank() || request.email.isBlank() || request.password.isBlank()) {
            onResult(false, "Please complete all required fields")
            return
        }

        viewModelScope.launch {
            _isLoading.value = true
            val result = repository.registerUser(request)
            _isLoading.value = false
            if (result.isSuccess) {
                val user = result.getOrNull()!!
                showMessage("Account created! Welcome, ${user.fullName} (${user.role.uppercase()})")
                onResult(true, null)
            } else {
                onResult(false, result.exceptionOrNull()?.message ?: "Account registration failed")
            }
        }
    }

    fun loginWithBiometric(onResult: (Boolean, String?) -> Unit) {
        viewModelScope.launch {
            _isLoading.value = true
            val result = repository.loginWithBiometric()
            _isLoading.value = false
            if (result.isSuccess) {
                val user = result.getOrNull()!!
                showMessage("Biometric login verified! Welcome, ${user.firstName}")
                onResult(true, null)
            } else {
                onResult(false, result.exceptionOrNull()?.message ?: "Biometric verification failed")
            }
        }
    }

    // Authentication Actions
    fun login(email: String, pass: String, rememberMe: Boolean = true, onResult: (Boolean, String?) -> Unit) {
        if (email.isBlank() || pass.isBlank()) {
            onResult(false, "Please enter both email and password")
            return
        }

        viewModelScope.launch {
            _isLoading.value = true
            val result = repository.login(email, pass)
            _isLoading.value = false
            if (result.isSuccess) {
                val user = result.getOrNull()
                if (rememberMe && user != null) {
                    repository.saveLoginCredentials(
                        SavedLoginInfo(
                            email = email,
                            password = pass,
                            rememberMe = true,
                            biometricEnabled = true,
                            userRole = user.role,
                            displayName = user.firstName
                        )
                    )
                } else if (!rememberMe) {
                    repository.clearSavedCredentials()
                }
                showMessage("Welcome back, ${user?.firstName} (${user?.role?.uppercase()})")
                onResult(true, null)
            } else {
                onResult(false, result.exceptionOrNull()?.message ?: "Login failed")
            }
        }
    }

    fun logout() {
        repository.logout()
        _posCart.value = emptyList()
        showMessage("Logged out securely")
    }

    fun switchRole(newRole: String) {
        repository.switchRole(newRole)
        showMessage("Role switched to ${newRole.uppercase()}")
    }

    fun updateServerUrl(url: String) {
        viewModelScope.launch {
            _isLoading.value = true
            repository.updateBaseUrl(url)
            _isLoading.value = false
            showMessage("API endpoint updated: $url")
        }
    }

    fun pingServer() {
        viewModelScope.launch {
            _isLoading.value = true
            val connected = repository.testServerConnection()
            _isLoading.value = false
            if (connected) {
                showMessage("Connected to live backend successfully!")
            } else {
                showMessage("Server not reachable. Active on local database.")
            }
        }
    }

    fun refreshAll() {
        viewModelScope.launch {
            _isLoading.value = true
            repository.refreshDashboard()
            _isLoading.value = false
            showMessage("Dashboard data updated")
        }
    }

    // Product Actions
    fun createProduct(
        title: String,
        description: String,
        price: Double,
        category: String,
        initialStock: Int,
        isFeatured: Boolean,
        allowPreorder: Boolean,
        imageUrl: String?,
        sizes: List<String> = emptyList(),
        colors: List<String> = emptyList(),
        waistSizes: List<String> = emptyList(),
        bustSizes: List<String> = emptyList(),
        shoeSizes: List<String> = emptyList()
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            val req = CreateProductRequest(
                title = title,
                description = description,
                price = price,
                category = category.lowercase(),
                images = if (imageUrl.isNullOrBlank()) emptyList() else listOf(imageUrl),
                isFeatured = if (isFeatured) 1 else 0,
                allowPreorder = if (allowPreorder) 1 else 0,
                initialStock = initialStock,
                sizes = sizes,
                colors = colors,
                waistSizes = waistSizes,
                bustSizes = bustSizes,
                shoeSizes = shoeSizes
            )
            val result = repository.createProduct(req)
            _isLoading.value = false
            if (result.isSuccess) {
                showMessage("Product '${title}' added to boutique")
                closeAddProduct()
            } else {
                showMessage("Error: ${result.exceptionOrNull()?.message}")
            }
        }
    }

    fun updateProduct(
        id: Int,
        title: String,
        description: String,
        price: Double,
        category: String,
        isFeatured: Boolean,
        allowPreorder: Boolean,
        imageUrl: String?,
        sizes: List<String> = emptyList(),
        colors: List<String> = emptyList(),
        waistSizes: List<String> = emptyList(),
        bustSizes: List<String> = emptyList(),
        shoeSizes: List<String> = emptyList()
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            val req = UpdateProductRequest(
                title = title,
                description = description,
                price = price,
                category = category.lowercase(),
                images = if (imageUrl.isNullOrBlank()) emptyList() else listOf(imageUrl),
                isFeatured = if (isFeatured) 1 else 0,
                allowPreorder = if (allowPreorder) 1 else 0,
                sizes = sizes,
                colors = colors,
                waistSizes = waistSizes,
                bustSizes = bustSizes,
                shoeSizes = shoeSizes
            )
            val result = repository.updateProduct(id, req)
            _isLoading.value = false
            if (result.isSuccess) {
                showMessage("Product '${title}' updated")
                closeEditProduct()
            } else {
                showMessage("Error: ${result.exceptionOrNull()?.message}")
            }
        }
    }

    fun deleteProduct(id: Int) {
        viewModelScope.launch {
            _isLoading.value = true
            val result = repository.deleteProduct(id)
            _isLoading.value = false
            if (result.isSuccess) {
                showMessage("Product removed successfully")
                closeEditProduct()
                closeProductDetail()
            } else {
                showMessage("Delete failed: ${result.exceptionOrNull()?.message}")
            }
        }
    }

    // Inventory Stock Actions
    fun adjustStock(productId: Int, quantityChange: Int, actionType: String, reason: String?) {
        viewModelScope.launch {
            _isLoading.value = true
            val result = repository.updateStock(productId, quantityChange, actionType, reason)
            _isLoading.value = false
            if (result.isSuccess) {
                val newStock = result.getOrNull() ?: 0
                showMessage("Stock updated. New quantity: $newStock")
                closeStockUpdate()
            } else {
                showMessage("Stock update failed: ${result.exceptionOrNull()?.message}")
            }
        }
    }

    // Preorder Actions
    fun toggleGlobalPreorderMode(enabled: Boolean) {
        viewModelScope.launch {
            val result = repository.toggleGlobalPreorderMode(enabled)
            if (result.isSuccess) {
                showMessage("Global Pre-Order Mode: ${if (enabled) "ENABLED" else "DISABLED"}")
            } else {
                showMessage("Permission denied: ${result.exceptionOrNull()?.message}")
            }
        }
    }

    // POS Cart Actions
    fun addToPosCart(product: Product, size: String? = null, color: String? = null) {
        val currentList = _posCart.value.toMutableList()
        val index = currentList.indexOfFirst {
            it.product.id == product.id && it.selectedSize == size && it.selectedColor == color
        }
        if (index >= 0) {
            currentList[index] = currentList[index].copy(quantity = currentList[index].quantity + 1)
        } else {
            currentList.add(PosCartItem(product, 1, size, color))
        }
        _posCart.value = currentList
    }

    fun updatePosCartItemQuantity(productId: Int, qty: Int) {
        val currentList = _posCart.value.toMutableList()
        if (qty <= 0) {
            currentList.removeAll { it.product.id == productId }
        } else {
            val index = currentList.indexOfFirst { it.product.id == productId }
            if (index >= 0) {
                currentList[index] = currentList[index].copy(quantity = qty)
            }
        }
        _posCart.value = currentList
    }

    fun clearPosCart() {
        _posCart.value = emptyList()
    }

    // Sales Recording Action
    fun completeSale(
        saleType: String,
        customerName: String?,
        customerPhone: String?,
        paymentMethod: String,
        transactionRef: String?,
        items: List<PosCartItem>,
        notes: String?,
        onComplete: (Boolean) -> Unit
    ) {
        if (items.isEmpty()) {
            showMessage("Please select at least one product for the sale")
            onComplete(false)
            return
        }

        viewModelScope.launch {
            _isLoading.value = true
            val recordItems = items.map {
                RecordSaleItem(
                    productId = it.product.id,
                    quantity = it.quantity,
                    unitPrice = it.product.price
                )
            }

            val req = RecordSaleRequest(
                saleType = saleType.lowercase(),
                customerName = customerName?.ifBlank { null },
                customerPhone = customerPhone?.ifBlank { null },
                paymentMethod = paymentMethod.lowercase(),
                transactionReference = transactionRef?.ifBlank { null },
                items = recordItems,
                notes = notes?.ifBlank { null }
            )

            val result = repository.recordSale(req)
            _isLoading.value = false
            if (result.isSuccess) {
                val sale = result.getOrNull()!!
                clearPosCart()
                closeRecordSale()
                closeQuickPos()
                showMessage("Sale #${sale.saleNumber} recorded! Total: KSh ${String.format(java.util.Locale.US, "%,.2f", sale.totalAmount)}")
                onComplete(true)
            } else {
                showMessage("Failed to record sale: ${result.exceptionOrNull()?.message}")
                onComplete(false)
            }
        }
    }

    // ==========================================
    // Live Cloud & Supabase Sync Center Actions
    // ==========================================

    fun openSyncCenter() {
        _showSyncCenterSheet.value = true
    }

    fun closeSyncCenter() {
        _showSyncCenterSheet.value = false
    }

    fun updateWebsiteUrl(url: String) {
        repository.updateWebsiteUrl(url)
        showMessage("Website URL updated")
    }

    fun runCloudDiagnostics(customWebsiteUrl: String? = null) {
        viewModelScope.launch {
            _isLoading.value = true
            val diag = repository.diagnoseConnections(customWebsiteUrl)
            _isLoading.value = false
            showMessage(diag.statusText)
        }
    }

    fun pullFromCloud() {
        viewModelScope.launch {
            _isLoading.value = true
            val result = repository.pullLiveFromSupabase()
            _isLoading.value = false
            if (result.isSuccess) {
                showMessage("Cloud Sync: ${result.getOrNull()}")
            } else {
                showMessage("Sync Error: ${result.exceptionOrNull()?.localizedMessage ?: "Unknown error"}")
            }
        }
    }

    fun pushToCloud() {
        viewModelScope.launch {
            _isLoading.value = true
            val result = repository.pushAllToSupabase()
            _isLoading.value = false
            if (result.isSuccess) {
                showMessage("Cloud Upload: ${result.getOrNull()}")
            } else {
                showMessage("Upload Error: ${result.exceptionOrNull()?.localizedMessage ?: "Unknown error"}")
            }
        }
    }

    fun getSupabaseSetupSql(): String {
        return com.example.data.api.SupabaseClient.generateSupabaseSetupSql()
    }

    // ==========================================
    // Pre-orders Management
    // ==========================================

    fun fetchPreorders() {
        viewModelScope.launch {
            repository.fetchPreorders()
        }
    }

    fun createPreorder(
        productId: Int,
        productTitle: String,
        customerName: String,
        customerPhone: String,
        quantity: Int,
        depositAmount: Double,
        totalAmount: Double,
        expectedDate: String?,
        notes: String?,
        onResult: (Boolean) -> Unit
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            val result = repository.createPreorder(
                productId = productId,
                productTitle = productTitle,
                customerName = customerName,
                customerPhone = customerPhone,
                quantity = quantity,
                depositAmount = depositAmount,
                totalAmount = totalAmount,
                expectedDate = expectedDate,
                notes = notes
            )
            _isLoading.value = false
            if (result.isSuccess) {
                showMessage("Pre-order created successfully!")
                closeCreatePreorder()
                onResult(true)
            } else {
                showMessage("Failed to create pre-order: ${result.exceptionOrNull()?.message}")
                onResult(false)
            }
        }
    }

    fun updatePreorderStatus(id: Long, newStatus: String) {
        viewModelScope.launch {
            val result = repository.updatePreorderStatus(id, newStatus)
            if (result.isSuccess) {
                showMessage("Pre-order status updated to $newStatus")
            } else {
                showMessage(result.exceptionOrNull()?.message ?: "Failed to update status")
            }
        }
    }

    // ==========================================
    // Live Website Chat & Conversations
    // ==========================================

    fun fetchConversations() {
        viewModelScope.launch {
            repository.fetchConversations()
        }
    }

    fun selectConversation(conv: Conversation) {
        _selectedConversation.value = conv
        viewModelScope.launch {
            repository.loadChatMessages(conv.id)
        }
    }

    fun clearSelectedConversation() {
        _selectedConversation.value = null
    }

    fun sendChatMessage(conversationId: Long, text: String) {
        viewModelScope.launch {
            repository.sendChatMessage(conversationId, text)
        }
    }

    // ==========================================
    // M-Pesa STK Push
    // ==========================================

    fun initiateMpesaStkPush(phone: String, amount: Double, reference: String) {
        viewModelScope.launch {
            val state = repository.initiateMpesaStkPush(phone, amount, reference)
            showMessage(state.message ?: "M-Pesa STK Push initiated")
        }
    }

    // ==========================================
    // Admin CSV Catalog Import
    // ==========================================

    fun importProductsFromCsv(csvText: String, onResult: (ImportReport) -> Unit) {
        viewModelScope.launch {
            _isLoading.value = true
            val report = repository.importProductsFromCsv(csvText)
            _isLoading.value = false
            showMessage("Import complete: ${report.successful} products added, ${report.failed} skipped")
            onResult(report)
        }
    }
}
