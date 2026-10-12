package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.data.models.Product
import com.example.ui.components.*
import com.example.ui.theme.*

val BOUTIQUE_CATEGORIES = listOf(
    "All", "Dresses", "Casual", "Corporate", "Sweaters & Outerwear", "Trousers & Bottoms", 
    "Jumpsuits & Sets", "Accessories", "Innerwear", "Shoes", "Wigs", "Beauty / Women's Wellness", 
    "Weekend", "General"
)

@Composable
fun ProductsTab(
    products: List<Product>,
    searchQuery: String,
    selectedCategory: String,
    onSearchChange: (String) -> Unit,
    onCategoryChange: (String) -> Unit,
    onProductClick: (Product) -> Unit,
    onEditProductClick: (Product) -> Unit,
    onAdjustStockClick: (Product) -> Unit,
    onAddToPosClick: (Product) -> Unit,
    userIsAdmin: Boolean,
    modifier: Modifier = Modifier,
    onImportProductsClick: (() -> Unit)? = null
) {
    val filteredProducts = remember(products, searchQuery, selectedCategory) {
        products
            .sortedByDescending { it.createdAt ?: it.id.toString() }
            .filter { prod ->
                val matchesSearch = searchQuery.isBlank() ||
                        prod.title.contains(searchQuery, ignoreCase = true) ||
                        prod.sku.contains(searchQuery, ignoreCase = true) ||
                        prod.category.contains(searchQuery, ignoreCase = true)

                val cat = prod.category.lowercase()
                val matchesCategory = selectedCategory == "All" ||
                        prod.category.equals(selectedCategory, ignoreCase = true) ||
                        (selectedCategory == "Beauty / Women's Wellness" && (cat.contains("beauty") || cat.contains("wellness") || cat.contains("makeup"))) ||
                        (selectedCategory == "Sweaters & Outerwear" && (cat.contains("sweater") || cat.contains("outer") || cat.contains("jacket") || cat.contains("blazer"))) ||
                        (selectedCategory == "Trousers & Bottoms" && (cat.contains("trouser") || cat.contains("bottom") || cat.contains("jean") || cat.contains("pant"))) ||
                        (selectedCategory == "Jumpsuits & Sets" && (cat.contains("jumpsuit") || cat.contains("set") || cat.contains("coord"))) ||
                        (selectedCategory == "Accessories" && (cat.contains("access") || cat.contains("belt") || cat.contains("glass"))) ||
                        (selectedCategory == "Innerwear" && (cat.contains("inner") || cat.contains("bra") || cat.contains("stocking"))) ||
                        (selectedCategory == "Shoes" && (cat.contains("shoe") || cat.contains("sneak") || cat.contains("heel"))) ||
                        (selectedCategory == "Wigs" && (cat.contains("wig") || cat.contains("hair")))

                matchesSearch && matchesCategory
            }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp)
    ) {
        Spacer(modifier = Modifier.height(12.dp))

        // Search Bar
        OutlinedTextField(
            value = searchQuery,
            onValueChange = onSearchChange,
            placeholder = { Text("Search products, SKU or category...") },
            leadingIcon = {
                Icon(Icons.Outlined.Search, contentDescription = null, tint = PrimaryGold)
            },
            trailingIcon = {
                if (searchQuery.isNotEmpty()) {
                    IconButton(onClick = { onSearchChange("") }) {
                        Icon(Icons.Default.Clear, contentDescription = "Clear", tint = TextMuted)
                    }
                }
            },
            singleLine = true,
            shape = RoundedCornerShape(14.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = PrimaryGold,
                unfocusedBorderColor = SurfaceCardBorder,
                focusedContainerColor = SurfaceCard,
                unfocusedContainerColor = SurfaceCard
            ),
            modifier = Modifier
                .fillMaxWidth()
                .testTag("input_product_search")
        )

        Spacer(modifier = Modifier.height(10.dp))

        // Category Filter Pills (Horizontal Scroll)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            BOUTIQUE_CATEGORIES.forEach { category ->
                val isSelected = selectedCategory.equals(category, ignoreCase = true)
                Surface(
                    modifier = Modifier
                        .clip(RoundedCornerShape(20.dp))
                        .border(
                            1.dp,
                            if (isSelected) PrimaryGold else SurfaceCardBorder,
                            RoundedCornerShape(20.dp)
                        )
                        .clickable { onCategoryChange(category) },
                    color = if (isSelected) GoldMuted else SurfaceCard
                ) {
                    Text(
                        text = category,
                        color = if (isSelected) PrimaryGold else TextSecondary,
                        fontSize = 12.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Results Count Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "${filteredProducts.size} Items Found",
                color = TextSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold
            )

            if (userIsAdmin && onImportProductsClick != null) {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = GoldMuted,
                    modifier = Modifier
                        .clickable { onImportProductsClick() }
                        .testTag("btn_import_csv")
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Filled.UploadFile,
                            contentDescription = null,
                            tint = PrimaryGold,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "Import Excel / CSV",
                            color = PrimaryGold,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Products List
        if (filteredProducts.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        imageVector = Icons.Outlined.Inventory2,
                        contentDescription = null,
                        tint = TextMuted,
                        modifier = Modifier.size(48.dp)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "No products found matching filters",
                        color = TextMuted,
                        fontSize = 14.sp
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentPadding = PaddingValues(bottom = 96.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(filteredProducts, key = { it.id }) { product ->
                    ProductCard(
                        product = product,
                        onProductClick = { onProductClick(product) },
                        onEditClick = { onEditProductClick(product) },
                        onStockClick = { onAdjustStockClick(product) },
                        onAddToPosClick = { onAddToPosClick(product) },
                        userIsAdmin = userIsAdmin
                    )
                }
            }
        }
    }
}

@Composable
fun ProductCard(
    product: Product,
    onProductClick: () -> Unit,
    onEditClick: () -> Unit,
    onStockClick: () -> Unit,
    onAddToPosClick: () -> Unit,
    userIsAdmin: Boolean = true
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onProductClick() }
            .testTag("product_card_${product.id}"),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceCard),
        border = CardDefaults.outlinedCardBorder().copy(brush = Brush.linearGradient(listOf(SurfaceCardBorder, Color.Transparent)))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Product Image Thumbnail
            Box(
                modifier = Modifier
                    .size(76.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(SurfaceCardElevated),
                contentAlignment = Alignment.Center
            ) {
                if (!product.imageUrl.isNullOrBlank()) {
                    AsyncImage(
                        model = product.imageUrl,
                        contentDescription = product.title,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    Icon(
                        imageVector = Icons.Filled.Checkroom,
                        contentDescription = null,
                        tint = PrimaryGold,
                        modifier = Modifier.size(32.dp)
                    )
                }

                // Preorder badge overlay
                if (product.allowPreorder == 1) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomStart)
                            .background(DarkGold.copy(alpha = 0.9f), RoundedCornerShape(topEnd = 6.dp))
                            .padding(horizontal = 4.dp, vertical = 2.dp)
                    ) {
                        Text("PREORDER", fontSize = 8.sp, color = AppBlack, fontWeight = FontWeight.Bold)
                    }
                }
            }

            Spacer(modifier = Modifier.width(14.dp))

            // Info Column
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = product.category.uppercase(),
                        color = PrimaryGold,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    )

                    if (product.isFeatured == 1) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Filled.Star,
                                contentDescription = "Featured",
                                tint = PrimaryGold,
                                modifier = Modifier.size(12.dp)
                            )
                            Spacer(modifier = Modifier.width(2.dp))
                            Text("Featured", color = PrimaryGold, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(2.dp))

                Text(
                    text = product.title,
                    style = MaterialTheme.typography.titleMedium,
                    color = TextPrimary,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1
                )

                // Product Variant Highlights (Waist, Bust, Shoe, Colors, Multicoloured)
                val variantBadges = remember(product) {
                    mutableListOf<String>().apply {
                        if (product.isMultiColored) {
                            add("🌈 Multicoloured")
                        } else if (product.colors.isNotEmpty()) {
                            add("${product.colors.size} Col")
                        }
                        if (product.waistSizes.isNotEmpty()) {
                            add("Waist: ${product.waistSizes.take(2).joinToString(",")}${if (product.waistSizes.size > 2) "+" else ""}")
                        }
                        if (product.bustSizes.isNotEmpty()) {
                            add("Bust: ${product.bustSizes.take(2).joinToString(",")}${if (product.bustSizes.size > 2) "+" else ""}")
                        }
                        if (product.shoeSizes.isNotEmpty()) {
                            add("EU: ${product.shoeSizes.take(2).joinToString(",")}${if (product.shoeSizes.size > 2) "+" else ""}")
                        } else if (product.sizes.isNotEmpty()) {
                            add("Size: ${product.sizes.take(3).joinToString(",")}")
                        }
                    }
                }

                if (variantBadges.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(3.dp))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        variantBadges.forEach { badge ->
                            Surface(
                                shape = RoundedCornerShape(4.dp),
                                color = if (badge.contains("Multicoloured")) PrimaryGold.copy(alpha = 0.22f) else SurfaceCardElevated,
                                border = if (badge.contains("Multicoloured")) androidx.compose.foundation.BorderStroke(0.5.dp, PrimaryGold) else null
                            ) {
                                Text(
                                    text = badge,
                                    color = if (badge.contains("Multicoloured")) PrimaryGold else TextSecondary,
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Medium,
                                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = formatKSh(product.price),
                        color = PrimaryGold,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp
                    )

                    StockBadge(stock = product.totalStock)
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Quick Action Buttons
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Quick POS Cart Add
                    Surface(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .clickable { onAddToPosClick() },
                        color = GoldMuted
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Filled.AddShoppingCart, contentDescription = null, tint = PrimaryGold, modifier = Modifier.size(12.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("+ POS", color = PrimaryGold, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    // Stock & Edit Buttons (Admin Only)
                    if (userIsAdmin) {
                        // Stock Adjust Button
                        Surface(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .clickable { onStockClick() },
                            color = SurfaceCardElevated
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Outlined.Inventory, contentDescription = null, tint = TextSecondary, modifier = Modifier.size(12.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Stock", color = TextSecondary, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }

                        // Edit Button
                        Surface(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .clickable { onEditClick() },
                            color = SurfaceCardElevated
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Outlined.Edit, contentDescription = null, tint = TextSecondary, modifier = Modifier.size(12.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Edit", color = TextSecondary, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                }
            }
        }
    }
}
