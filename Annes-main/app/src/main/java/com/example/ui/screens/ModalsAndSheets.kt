package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.data.models.*
import com.example.ui.components.*
import com.example.ui.theme.*
import com.example.viewmodel.PosCartItem

// ==================== ADD / EDIT PRODUCT BOTTOM SHEET ====================
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddEditProductBottomSheet(
    productToEdit: Product?,
    onDismiss: () -> Unit,
    onSaveNew: (title: String, desc: String, price: Double, category: String, stock: Int, featured: Boolean, preorder: Boolean, imgUrl: String?, sizes: List<String>, colors: List<String>, waistSizes: List<String>, bustSizes: List<String>, shoeSizes: List<String>) -> Unit,
    onSaveEdit: (id: Int, title: String, desc: String, price: Double, category: String, featured: Boolean, preorder: Boolean, imgUrl: String?, sizes: List<String>, colors: List<String>, waistSizes: List<String>, bustSizes: List<String>, shoeSizes: List<String>) -> Unit,
    onDelete: ((id: Int) -> Unit)?,
    userIsAdmin: Boolean
) {
    val isEdit = productToEdit != null

    var title by remember { mutableStateOf(productToEdit?.title ?: "") }
    var description by remember { mutableStateOf(productToEdit?.description ?: "") }
    var priceText by remember { mutableStateOf(productToEdit?.let { String.format(java.util.Locale.US, "%.0f", it.price) } ?: "") }
    var category by remember { mutableStateOf(productToEdit?.category ?: "dresses") }
    var initialStockText by remember { mutableStateOf(productToEdit?.totalStock?.toString() ?: "10") }
    var isFeatured by remember { mutableStateOf(productToEdit?.isFeatured == 1) }
    var allowPreorder by remember { mutableStateOf(productToEdit?.allowPreorder == 1) }

    // Product Variant Collections
    val selectedWaistSizes = remember {
        mutableStateListOf<String>().apply {
            productToEdit?.waistSizes?.let { addAll(it) }
        }
    }
    val selectedBustSizes = remember {
        mutableStateListOf<String>().apply {
            productToEdit?.bustSizes?.let { addAll(it) }
        }
    }
    val selectedShoeSizes = remember {
        mutableStateListOf<String>().apply {
            productToEdit?.shoeSizes?.let { addAll(it) }
        }
    }
    val selectedSizes = remember {
        mutableStateListOf<String>().apply {
            productToEdit?.sizes?.let { addAll(it) }
        }
    }
    val selectedColors = remember {
        mutableStateListOf<String>().apply {
            productToEdit?.colors?.let { addAll(it) }
        }
    }

    var customWaistInput by remember { mutableStateOf("") }
    var customBustInput by remember { mutableStateOf("") }
    var customShoeInput by remember { mutableStateOf("") }
    var customColorInput by remember { mutableStateOf("") }

    val imageList = remember {
        mutableStateListOf<String>().apply {
            if (productToEdit?.images?.isNotEmpty() == true) {
                addAll(productToEdit.images.map { it.url })
            } else if (!productToEdit?.imageUrl.isNullOrBlank()) {
                add(productToEdit!!.imageUrl!!)
            }
        }
    }
    var mainImageIndex by remember { mutableStateOf(0) }
    var showDeleteConfirm by remember { mutableStateOf(false) }

    val photoPickerLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        contract = androidx.activity.result.contract.ActivityResultContracts.PickMultipleVisualMedia(5)
    ) { uris ->
        uris.forEach { uri ->
            val uriStr = uri.toString()
            if (!imageList.contains(uriStr)) {
                imageList.add(uriStr)
            }
        }
    }

    val categories = listOf(
        "dresses", "casual", "corporate", "sweaters & outerwear", "trousers & bottoms",
        "jumpsuits & sets", "accessories", "innerwear", "shoes", "wigs",
        "beauty / women's wellness", "weekend", "general"
    )

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = SurfaceCard,
        dragHandle = { BottomSheetDefaults.DragHandle(color = SurfaceCardBorder) }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 32.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = if (isEdit) "Edit Product" else "Add New Boutique Item",
                    style = MaterialTheme.typography.titleLarge,
                    color = TextPrimary,
                    fontWeight = FontWeight.Bold
                )

                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close, contentDescription = "Close", tint = TextMuted)
                }
            }

            // Title
            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                label = { Text("Product Title *") },
                placeholder = { Text("e.g. Royal Silk Evening Gown") },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = PrimaryGold,
                    unfocusedBorderColor = SurfaceCardBorder,
                    focusedLabelColor = PrimaryGold
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("input_product_title")
            )

            // Price and Initial Stock in Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedTextField(
                    value = priceText,
                    onValueChange = { priceText = it },
                    label = { Text("Price (KSh) *") },
                    placeholder = { Text("4500") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PrimaryGold,
                        unfocusedBorderColor = SurfaceCardBorder,
                        focusedLabelColor = PrimaryGold
                    ),
                    modifier = Modifier
                        .weight(1f)
                        .testTag("input_product_price")
                )

                if (!isEdit) {
                    OutlinedTextField(
                        value = initialStockText,
                        onValueChange = { initialStockText = it },
                        label = { Text("Initial Stock") },
                        placeholder = { Text("10") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = PrimaryGold,
                            unfocusedBorderColor = SurfaceCardBorder,
                            focusedLabelColor = PrimaryGold
                        ),
                        modifier = Modifier
                            .weight(1f)
                            .testTag("input_product_stock")
                    )
                }
            }

            // Category Selector (including Beauty / Women's Wellness)
            Text(
                text = "Category",
                color = TextSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                categories.forEach { cat ->
                    val isSelected = category.equals(cat, ignoreCase = true)
                    Surface(
                        modifier = Modifier
                            .clip(RoundedCornerShape(16.dp))
                            .border(1.dp, if (isSelected) PrimaryGold else SurfaceCardBorder, RoundedCornerShape(16.dp))
                            .clickable { category = cat },
                        color = if (isSelected) GoldMuted else SurfaceCardElevated
                    ) {
                        Text(
                            text = cat.replaceFirstChar { it.uppercase() },
                            color = if (isSelected) PrimaryGold else TextSecondary,
                            fontSize = 12.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                        )
                    }
                }
            }

            // Description
            OutlinedTextField(
                value = description,
                onValueChange = { description = it },
                label = { Text("Description") },
                placeholder = { Text("Fabric details, fit guide, styling notes...") },
                minLines = 2,
                maxLines = 4,
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = PrimaryGold,
                    unfocusedBorderColor = SurfaceCardBorder,
                    focusedLabelColor = PrimaryGold
                ),
                modifier = Modifier.fillMaxWidth()
            )

            // Direct Device Gallery Image Picker & Main Image Selection
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(SurfaceCardElevated)
                    .padding(14.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Product Media & Photos",
                            color = TextPrimary,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = if (imageList.isEmpty()) "Select product photos from your device" else "${imageList.size} photo(s) • Select Main Image below",
                            color = TextMuted,
                            fontSize = 11.sp
                        )
                    }

                    Button(
                        onClick = {
                            photoPickerLauncher.launch(
                                androidx.activity.result.PickVisualMediaRequest(
                                    androidx.activity.result.contract.ActivityResultContracts.PickVisualMedia.ImageOnly
                                )
                            )
                        },
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = PrimaryGold,
                            contentColor = AppBlack
                        ),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Icon(Icons.Filled.PhotoLibrary, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Gallery", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }

                if (imageList.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(12.dp))

                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        items(imageList.size) { index ->
                            val imgUri = imageList[index]
                            val isMain = (index == mainImageIndex)

                            Card(
                                modifier = Modifier
                                    .size(86.dp)
                                    .clickable { mainImageIndex = index },
                                shape = RoundedCornerShape(10.dp),
                                border = BorderStroke(
                                    if (isMain) 2.dp else 1.dp,
                                    if (isMain) PrimaryGold else SurfaceCardBorder
                                ),
                                colors = CardDefaults.cardColors(containerColor = SurfaceCard)
                            ) {
                                Box(modifier = Modifier.fillMaxSize()) {
                                    AsyncImage(
                                        model = imgUri,
                                        contentDescription = "Product Image",
                                        contentScale = ContentScale.Crop,
                                        modifier = Modifier.fillMaxSize()
                                    )

                                    // Main Image Badge
                                    if (isMain) {
                                        Surface(
                                            modifier = Modifier
                                                .align(Alignment.TopStart)
                                                .padding(4.dp),
                                            shape = RoundedCornerShape(4.dp),
                                            color = PrimaryGold
                                        ) {
                                            Text(
                                                text = "MAIN",
                                                color = AppBlack,
                                                fontSize = 8.sp,
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                                            )
                                        }
                                    } else {
                                        IconButton(
                                            onClick = { mainImageIndex = index },
                                            modifier = Modifier
                                                .align(Alignment.TopStart)
                                                .size(24.dp)
                                                .background(Color(0x88000000), CircleShape)
                                        ) {
                                            Icon(
                                                Icons.Filled.StarBorder,
                                                contentDescription = "Set as Main",
                                                tint = Color.White,
                                                modifier = Modifier.size(14.dp)
                                            )
                                        }
                                    }

                                    // Remove Photo Button
                                    IconButton(
                                        onClick = {
                                            imageList.removeAt(index)
                                            if (mainImageIndex >= imageList.size) {
                                                mainImageIndex = (imageList.size - 1).coerceAtLeast(0)
                                            }
                                        },
                                        modifier = Modifier
                                            .align(Alignment.TopEnd)
                                            .size(22.dp)
                                            .background(Color(0xAA000000), CircleShape)
                                    ) {
                                        Icon(
                                            Icons.Filled.Close,
                                            contentDescription = "Remove",
                                            tint = Color.White,
                                            modifier = Modifier.size(12.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // ==================== PRODUCT VARIATIONS & SIZES ====================
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = SurfaceCardElevated),
                border = BorderStroke(1.dp, SurfaceCardBorder)
            ) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Filled.Style, contentDescription = null, tint = PrimaryGold, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Sizes & Color Variations",
                                color = TextPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            )
                        }
                        Text(
                            text = "Optional",
                            color = TextMuted,
                            fontSize = 11.sp
                        )
                    }

                    Text(
                        text = "Specify waist & bust sizes for clothes/dresses, shoe/leg sizes for footwear, and select colours (including Multicoloured).",
                        color = TextSecondary,
                        fontSize = 11.sp,
                        lineHeight = 15.sp
                    )

                    // 1. WOMEN'S WAIST SIZES (For Dresses, Trousers, Skirts)
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Waist Sizes (Inches)",
                                color = PrimaryGold,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 12.sp
                            )
                            if (selectedWaistSizes.isNotEmpty()) {
                                Text(
                                    text = "${selectedWaistSizes.size} selected",
                                    color = TextMuted,
                                    fontSize = 11.sp
                                )
                            }
                        }

                        // Presets Row
                        val presetWaists = listOf("26\"", "28\"", "30\"", "32\"", "34\"", "36\"", "38\"", "40\"", "42\"")
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            presetWaists.forEach { size ->
                                val isSelected = selectedWaistSizes.contains(size)
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    border = BorderStroke(1.dp, if (isSelected) PrimaryGold else SurfaceCardBorder),
                                    color = if (isSelected) GoldMuted else SurfaceCard,
                                    modifier = Modifier.clickable {
                                        if (isSelected) selectedWaistSizes.remove(size) else selectedWaistSizes.add(size)
                                    }
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        if (isSelected) {
                                            Icon(Icons.Filled.Check, contentDescription = null, tint = PrimaryGold, modifier = Modifier.size(12.dp))
                                            Spacer(modifier = Modifier.width(4.dp))
                                        }
                                        Text(
                                            text = size,
                                            color = if (isSelected) PrimaryGold else TextSecondary,
                                            fontSize = 12.sp,
                                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                        )
                                    }
                                }
                            }
                        }

                        // Custom waist input
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedTextField(
                                value = customWaistInput,
                                onValueChange = { customWaistInput = it },
                                placeholder = { Text("Add custom waist (e.g. 44\")", fontSize = 11.sp) },
                                singleLine = true,
                                modifier = Modifier.weight(1f).height(48.dp),
                                shape = RoundedCornerShape(8.dp),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = PrimaryGold,
                                    unfocusedBorderColor = SurfaceCardBorder
                                )
                            )
                            IconButton(
                                onClick = {
                                    val trimmed = customWaistInput.trim()
                                    if (trimmed.isNotBlank() && !selectedWaistSizes.contains(trimmed)) {
                                        selectedWaistSizes.add(trimmed)
                                        customWaistInput = ""
                                    }
                                },
                                modifier = Modifier
                                    .size(40.dp)
                                    .background(PrimaryGold, RoundedCornerShape(8.dp))
                            ) {
                                Icon(Icons.Filled.Add, contentDescription = "Add", tint = AppBlack)
                            }
                        }

                        // Selected custom badges
                        val customWaists = selectedWaistSizes.filter { it !in presetWaists }
                        if (customWaists.isNotEmpty()) {
                            Row(
                                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                customWaists.forEach { cw ->
                                    Surface(
                                        shape = RoundedCornerShape(8.dp),
                                        border = BorderStroke(1.dp, PrimaryGold),
                                        color = GoldMuted
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(cw, color = PrimaryGold, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Icon(
                                                Icons.Filled.Close,
                                                contentDescription = "Remove",
                                                tint = PrimaryGold,
                                                modifier = Modifier.size(12.dp).clickable { selectedWaistSizes.remove(cw) }
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    HorizontalDivider(color = SurfaceCardBorder)

                    // 2. BUST SIZES (For Tops, Blouses, Dresses, Evening Gowns)
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Bust Sizes (Tops, Dresses, Blouses)",
                                color = PrimaryGold,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 12.sp
                            )
                            if (selectedBustSizes.isNotEmpty()) {
                                Text(
                                    text = "${selectedBustSizes.size} selected",
                                    color = TextMuted,
                                    fontSize = 11.sp
                                )
                            }
                        }

                        val presetBusts = listOf("32B", "32C", "34B", "34C", "34D", "36B", "36C", "36D", "38C", "38D", "40D", "32\"", "34\"", "36\"", "38\"", "40\"")
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            presetBusts.forEach { bust ->
                                val isSelected = selectedBustSizes.contains(bust)
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    border = BorderStroke(1.dp, if (isSelected) PrimaryGold else SurfaceCardBorder),
                                    color = if (isSelected) GoldMuted else SurfaceCard,
                                    modifier = Modifier.clickable {
                                        if (isSelected) selectedBustSizes.remove(bust) else selectedBustSizes.add(bust)
                                    }
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        if (isSelected) {
                                            Icon(Icons.Filled.Check, contentDescription = null, tint = PrimaryGold, modifier = Modifier.size(12.dp))
                                            Spacer(modifier = Modifier.width(4.dp))
                                        }
                                        Text(
                                            text = bust,
                                            color = if (isSelected) PrimaryGold else TextSecondary,
                                            fontSize = 12.sp,
                                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                        )
                                    }
                                }
                            }
                        }

                        // Custom bust input
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedTextField(
                                value = customBustInput,
                                onValueChange = { customBustInput = it },
                                placeholder = { Text("Add custom bust (e.g. 42DD)", fontSize = 11.sp) },
                                singleLine = true,
                                modifier = Modifier.weight(1f).height(48.dp),
                                shape = RoundedCornerShape(8.dp),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = PrimaryGold,
                                    unfocusedBorderColor = SurfaceCardBorder
                                )
                            )
                            IconButton(
                                onClick = {
                                    val trimmed = customBustInput.trim()
                                    if (trimmed.isNotBlank() && !selectedBustSizes.contains(trimmed)) {
                                        selectedBustSizes.add(trimmed)
                                        customBustInput = ""
                                    }
                                },
                                modifier = Modifier
                                    .size(40.dp)
                                    .background(PrimaryGold, RoundedCornerShape(8.dp))
                            ) {
                                Icon(Icons.Filled.Add, contentDescription = "Add", tint = AppBlack)
                            }
                        }

                        val customBusts = selectedBustSizes.filter { it !in presetBusts }
                        if (customBusts.isNotEmpty()) {
                            Row(
                                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                customBusts.forEach { cb ->
                                    Surface(
                                        shape = RoundedCornerShape(8.dp),
                                        border = BorderStroke(1.dp, PrimaryGold),
                                        color = GoldMuted
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(cb, color = PrimaryGold, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Icon(
                                                Icons.Filled.Close,
                                                contentDescription = "Remove",
                                                tint = PrimaryGold,
                                                modifier = Modifier.size(12.dp).clickable { selectedBustSizes.remove(cb) }
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    HorizontalDivider(color = SurfaceCardBorder)

                    // 3. SHOE & FOOTWEAR SIZES (For Shoes, Heels, Flats, Boots)
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Shoe Sizes (Footwear / Leg Sizes)",
                                color = PrimaryGold,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 12.sp
                            )
                            if (selectedShoeSizes.isNotEmpty()) {
                                Text(
                                    text = "${selectedShoeSizes.size} selected",
                                    color = TextMuted,
                                    fontSize = 11.sp
                                )
                            }
                        }

                        val presetShoes = listOf("36", "37", "38", "39", "40", "41", "42", "43", "44")
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            presetShoes.forEach { shoe ->
                                val isSelected = selectedShoeSizes.contains(shoe)
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    border = BorderStroke(1.dp, if (isSelected) PrimaryGold else SurfaceCardBorder),
                                    color = if (isSelected) GoldMuted else SurfaceCard,
                                    modifier = Modifier.clickable {
                                        if (isSelected) selectedShoeSizes.remove(shoe) else selectedShoeSizes.add(shoe)
                                    }
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        if (isSelected) {
                                            Icon(Icons.Filled.Check, contentDescription = null, tint = PrimaryGold, modifier = Modifier.size(12.dp))
                                            Spacer(modifier = Modifier.width(4.dp))
                                        }
                                        Text(
                                            text = "EU $shoe",
                                            color = if (isSelected) PrimaryGold else TextSecondary,
                                            fontSize = 12.sp,
                                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                        )
                                    }
                                }
                            }
                        }

                        // Custom shoe input
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedTextField(
                                value = customShoeInput,
                                onValueChange = { customShoeInput = it },
                                placeholder = { Text("Add custom shoe/leg size (e.g. Wide Fit 39)", fontSize = 11.sp) },
                                singleLine = true,
                                modifier = Modifier.weight(1f).height(48.dp),
                                shape = RoundedCornerShape(8.dp),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = PrimaryGold,
                                    unfocusedBorderColor = SurfaceCardBorder
                                )
                            )
                            IconButton(
                                onClick = {
                                    val trimmed = customShoeInput.trim()
                                    if (trimmed.isNotBlank() && !selectedShoeSizes.contains(trimmed)) {
                                        selectedShoeSizes.add(trimmed)
                                        customShoeInput = ""
                                    }
                                },
                                modifier = Modifier
                                    .size(40.dp)
                                    .background(PrimaryGold, RoundedCornerShape(8.dp))
                            ) {
                                Icon(Icons.Filled.Add, contentDescription = "Add", tint = AppBlack)
                            }
                        }

                        val customShoes = selectedShoeSizes.filter { it !in presetShoes }
                        if (customShoes.isNotEmpty()) {
                            Row(
                                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                customShoes.forEach { cs ->
                                    Surface(
                                        shape = RoundedCornerShape(8.dp),
                                        border = BorderStroke(1.dp, PrimaryGold),
                                        color = GoldMuted
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(cs, color = PrimaryGold, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Icon(
                                                Icons.Filled.Close,
                                                contentDescription = "Remove",
                                                tint = PrimaryGold,
                                                modifier = Modifier.size(12.dp).clickable { selectedShoeSizes.remove(cs) }
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    HorizontalDivider(color = SurfaceCardBorder)

                    // 4. STANDARD SIZES (XS, S, M, L, XL, 2XL, Free Size)
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Standard Clothing Sizes",
                                color = PrimaryGold,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 12.sp
                            )
                            if (selectedSizes.isNotEmpty()) {
                                Text(
                                    text = "${selectedSizes.size} selected",
                                    color = TextMuted,
                                    fontSize = 11.sp
                                )
                            }
                        }

                        val presetStandards = listOf("XS", "S", "M", "L", "XL", "2XL", "3XL", "Free Size")
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            presetStandards.forEach { std ->
                                val isSelected = selectedSizes.contains(std)
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    border = BorderStroke(1.dp, if (isSelected) PrimaryGold else SurfaceCardBorder),
                                    color = if (isSelected) GoldMuted else SurfaceCard,
                                    modifier = Modifier.clickable {
                                        if (isSelected) selectedSizes.remove(std) else selectedSizes.add(std)
                                    }
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        if (isSelected) {
                                            Icon(Icons.Filled.Check, contentDescription = null, tint = PrimaryGold, modifier = Modifier.size(12.dp))
                                            Spacer(modifier = Modifier.width(4.dp))
                                        }
                                        Text(
                                            text = std,
                                            color = if (isSelected) PrimaryGold else TextSecondary,
                                            fontSize = 12.sp,
                                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                        )
                                    }
                                }
                            }
                        }
                    }

                    HorizontalDivider(color = SurfaceCardBorder)

                    // 5. COLORS & MULTICOLOURED PALETTE
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Color Palette & Multicoloured",
                                color = PrimaryGold,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 12.sp
                            )
                            if (selectedColors.isNotEmpty()) {
                                Text(
                                    text = "${selectedColors.size} selected",
                                    color = TextMuted,
                                    fontSize = 11.sp
                                )
                            }
                        }

                        // Multicoloured Special Highlight Chip
                        val isMultiSelected = selectedColors.any { it.equals("Multicoloured", ignoreCase = true) || it.equals("Multicolor", ignoreCase = true) }
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .border(
                                    BorderStroke(
                                        2.dp,
                                        Brush.horizontalGradient(
                                            listOf(
                                                Color(0xFFFF5252),
                                                Color(0xFFFFD700),
                                                Color(0xFF448AFF),
                                                Color(0xFFE040FB)
                                            )
                                        )
                                    ),
                                    RoundedCornerShape(10.dp)
                                )
                                .clickable {
                                    if (isMultiSelected) {
                                        selectedColors.removeAll { it.equals("Multicoloured", ignoreCase = true) || it.equals("Multicolor", ignoreCase = true) }
                                    } else {
                                        selectedColors.add("Multicoloured")
                                    }
                                },
                            color = if (isMultiSelected) PrimaryGold.copy(alpha = 0.25f) else SurfaceCard
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text("🌈", fontSize = 16.sp)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Column {
                                        Text(
                                            text = "Multicoloured / Print Fabric",
                                            color = TextPrimary,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 13.sp
                                        )
                                        Text(
                                            text = "Tie-dye, ankara patterns, floral multi-tonal garments",
                                            color = TextMuted,
                                            fontSize = 10.sp
                                        )
                                    }
                                }
                                if (isMultiSelected) {
                                    Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = PrimaryGold, modifier = Modifier.size(20.dp))
                                }
                            }
                        }

                        // Preset Colors Row
                        val presetColors = listOf(
                            "Black", "Gold", "White", "Red", "Royal Blue", "Navy Blue",
                            "Emerald Green", "Burgundy", "Champagne", "Pink", "Purple",
                            "Lilac", "Silver", "Nude", "Yellow", "Brown"
                        )
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            presetColors.forEach { col ->
                                val isSelected = selectedColors.contains(col)
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    border = BorderStroke(1.dp, if (isSelected) PrimaryGold else SurfaceCardBorder),
                                    color = if (isSelected) GoldMuted else SurfaceCard,
                                    modifier = Modifier.clickable {
                                        if (isSelected) selectedColors.remove(col) else selectedColors.add(col)
                                    }
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        if (isSelected) {
                                            Icon(Icons.Filled.Check, contentDescription = null, tint = PrimaryGold, modifier = Modifier.size(12.dp))
                                            Spacer(modifier = Modifier.width(4.dp))
                                        }
                                        Text(
                                            text = col,
                                            color = if (isSelected) PrimaryGold else TextSecondary,
                                            fontSize = 12.sp,
                                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                        )
                                    }
                                }
                            }
                        }

                        // Custom color input
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedTextField(
                                value = customColorInput,
                                onValueChange = { customColorInput = it },
                                placeholder = { Text("Add custom color (e.g. Teal Multi, Rose Gold)", fontSize = 11.sp) },
                                singleLine = true,
                                modifier = Modifier.weight(1f).height(48.dp),
                                shape = RoundedCornerShape(8.dp),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = PrimaryGold,
                                    unfocusedBorderColor = SurfaceCardBorder
                                )
                            )
                            IconButton(
                                onClick = {
                                    val trimmed = customColorInput.trim()
                                    if (trimmed.isNotBlank() && !selectedColors.contains(trimmed)) {
                                        selectedColors.add(trimmed)
                                        customColorInput = ""
                                    }
                                },
                                modifier = Modifier
                                    .size(40.dp)
                                    .background(PrimaryGold, RoundedCornerShape(8.dp))
                            ) {
                                Icon(Icons.Filled.Add, contentDescription = "Add", tint = AppBlack)
                            }
                        }

                        val customCols = selectedColors.filter { it !in presetColors && !it.equals("Multicoloured", ignoreCase = true) && !it.equals("Multicolor", ignoreCase = true) }
                        if (customCols.isNotEmpty()) {
                            Row(
                                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                customCols.forEach { cc ->
                                    Surface(
                                        shape = RoundedCornerShape(8.dp),
                                        border = BorderStroke(1.dp, PrimaryGold),
                                        color = GoldMuted
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(cc, color = PrimaryGold, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Icon(
                                                Icons.Filled.Close,
                                                contentDescription = "Remove",
                                                tint = PrimaryGold,
                                                modifier = Modifier.size(12.dp).clickable { selectedColors.remove(cc) }
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Toggle Switches: Featured & Allow Pre-order
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("Featured Item", color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    Text("Display on boutique home hero banners", color = TextMuted, fontSize = 11.sp)
                }
                Switch(
                    checked = isFeatured,
                    onCheckedChange = { isFeatured = it },
                    colors = SwitchDefaults.colors(checkedThumbColor = PrimaryGold, checkedTrackColor = DarkGold.copy(alpha = 0.5f))
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("Allow Pre-orders", color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    Text("Accept orders when stock reaches 0", color = TextMuted, fontSize = 11.sp)
                }
                Switch(
                    checked = allowPreorder,
                    onCheckedChange = { allowPreorder = it },
                    colors = SwitchDefaults.colors(checkedThumbColor = PrimaryGold, checkedTrackColor = DarkGold.copy(alpha = 0.5f))
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Save Button
            Button(
                onClick = {
                    val price = priceText.toDoubleOrNull() ?: 0.0
                    val stock = initialStockText.toIntOrNull() ?: 0
                    val primaryImg = imageList.getOrNull(mainImageIndex) ?: imageList.firstOrNull()
                    if (title.isNotBlank() && price > 0) {
                        if (isEdit) {
                            onSaveEdit(
                                productToEdit!!.id,
                                title,
                                description,
                                price,
                                category,
                                isFeatured,
                                allowPreorder,
                                primaryImg,
                                selectedSizes.toList(),
                                selectedColors.toList(),
                                selectedWaistSizes.toList(),
                                selectedBustSizes.toList(),
                                selectedShoeSizes.toList()
                            )
                        } else {
                            onSaveNew(
                                title,
                                description,
                                price,
                                category,
                                stock,
                                isFeatured,
                                allowPreorder,
                                primaryImg,
                                selectedSizes.toList(),
                                selectedColors.toList(),
                                selectedWaistSizes.toList(),
                                selectedBustSizes.toList(),
                                selectedShoeSizes.toList()
                            )
                        }
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
                    .testTag("btn_save_product"),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryGold, contentColor = AppBlack)
            ) {
                Text(
                    text = if (isEdit) "Save Product Changes" else "Create Product",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp
                )
            }

            // Delete Button (Admin only)
            if (isEdit && userIsAdmin && onDelete != null) {
                OutlinedButton(
                    onClick = { showDeleteConfirm = true },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .testTag("btn_delete_product"),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = StatusDanger),
                    border = ButtonDefaults.outlinedButtonBorder.copy(brush = Brush.horizontalGradient(listOf(StatusDanger, StatusDanger)))
                ) {
                    Icon(Icons.Outlined.Delete, contentDescription = null, tint = StatusDanger, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Delete Product from Boutique (Admin Only)", fontWeight = FontWeight.SemiBold)
                }
            }

            // Confirmation Dialog for Admin Product Deletion
            if (showDeleteConfirm && productToEdit != null) {
                AlertDialog(
                    onDismissRequest = { showDeleteConfirm = false },
                    title = {
                        Text("Delete Product?", fontWeight = FontWeight.Bold, color = TextPrimary)
                    },
                    text = {
                        Text("Are you sure you want to delete '${productToEdit.title}'? This will permanently remove it from the boutique catalogue and database.", color = TextSecondary)
                    },
                    confirmButton = {
                        Button(
                            onClick = {
                                showDeleteConfirm = false
                                onDelete?.invoke(productToEdit.id)
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = StatusDanger, contentColor = Color.White)
                        ) {
                            Text("Confirm Delete", fontWeight = FontWeight.Bold)
                        }
                    },
                    dismissButton = {
                        TextButton(onClick = { showDeleteConfirm = false }) {
                            Text("Cancel", color = TextMuted)
                        }
                    },
                    containerColor = SurfaceCardElevated
                )
            }
        }
    }
}

// ==================== UPDATE STOCK BOTTOM SHEET ====================
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UpdateStockBottomSheet(
    product: Product,
    onDismiss: () -> Unit,
    onConfirm: (productId: Int, quantityChange: Int, actionType: String, reason: String?) -> Unit
) {
    var actionType by remember { mutableStateOf("restock") } // "restock" | "adjustment" | "return"
    var quantityText by remember { mutableStateOf("5") }
    var reason by remember { mutableStateOf("") }

    val actionTypes = listOf(
        "restock" to "+ Restock (Add)",
        "adjustment" to "- Adjustment (Remove)",
        "return" to "+ Return"
    )

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = SurfaceCard,
        dragHandle = { BottomSheetDefaults.DragHandle(color = SurfaceCardBorder) }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 32.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Update Inventory Stock",
                        style = MaterialTheme.typography.titleLarge,
                        color = TextPrimary,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "${product.title} (Current: ${product.totalStock} units)",
                        color = PrimaryGold,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close, contentDescription = "Close", tint = TextMuted)
                }
            }

            // Action Type Selector
            Text("Operation Type", color = TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Medium)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                actionTypes.forEach { (type, label) ->
                    val isSelected = actionType == type
                    Surface(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(10.dp))
                            .border(1.dp, if (isSelected) PrimaryGold else SurfaceCardBorder, RoundedCornerShape(10.dp))
                            .clickable { actionType = type },
                        color = if (isSelected) GoldMuted else SurfaceCardElevated
                    ) {
                        Text(
                            text = label,
                            color = if (isSelected) PrimaryGold else TextSecondary,
                            fontSize = 11.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            modifier = Modifier.padding(vertical = 10.dp, horizontal = 4.dp),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                }
            }

            // Quantity with Quick Stepper Chips
            Text("Quantity Units", color = TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Medium)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                listOf(1, 5, 10, 20).forEach { num ->
                    Surface(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .clickable { quantityText = num.toString() },
                        color = SurfaceCardElevated
                    ) {
                        Text(
                            text = "+$num",
                            color = TextPrimary,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(vertical = 8.dp),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                }
            }

            OutlinedTextField(
                value = quantityText,
                onValueChange = { quantityText = it },
                label = { Text("Quantity to Apply") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = PrimaryGold,
                    unfocusedBorderColor = SurfaceCardBorder,
                    focusedLabelColor = PrimaryGold
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("input_stock_qty")
            )

            // Reason field
            OutlinedTextField(
                value = reason,
                onValueChange = { reason = it },
                label = { Text("Reason / Shipment Note") },
                placeholder = { Text("e.g. New boutique crate received from supplier") },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = PrimaryGold,
                    unfocusedBorderColor = SurfaceCardBorder,
                    focusedLabelColor = PrimaryGold
                ),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(10.dp))

            // Confirm Button
            Button(
                onClick = {
                    val qty = quantityText.toIntOrNull() ?: 0
                    if (qty > 0) {
                        val change = if (actionType == "adjustment") -qty else qty
                        onConfirm(product.id, change, actionType, reason.ifBlank { null })
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
                    .testTag("btn_confirm_stock"),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryGold, contentColor = AppBlack)
            ) {
                Text("Apply Stock Update", fontWeight = FontWeight.Bold, fontSize = 15.sp)
            }
        }
    }
}

// ==================== RECORD SALE / POS MODAL SHEET ====================
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RecordSaleBottomSheet(
    products: List<Product>,
    cartItems: List<PosCartItem>,
    onAddToCart: (Product) -> Unit,
    onUpdateQuantity: (productId: Int, qty: Int) -> Unit,
    onCompleteSale: (saleType: String, name: String?, phone: String?, paymentMethod: String, ref: String?, items: List<PosCartItem>, notes: String?, onDone: (Boolean) -> Unit) -> Unit,
    onDismiss: () -> Unit,
    mpesaStkState: MpesaStkState = MpesaStkState(),
    onInitiateMpesaStkPush: ((String, Double) -> Unit)? = null
) {
    var saleType by remember { mutableStateOf("in-store") } // "in-store" | "online"
    var customerName by remember { mutableStateOf("") }
    var customerPhone by remember { mutableStateOf("") }
    var paymentMethod by remember { mutableStateOf("mpesa") } // "mpesa" | "cash" | "card" | "bank-transfer"
    var transactionRef by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var isProcessing by remember { mutableStateOf(false) }

    val totalAmount = remember(cartItems) {
        cartItems.sumOf { it.product.price * it.quantity }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = SurfaceDark,
        dragHandle = { BottomSheetDefaults.DragHandle(color = SurfaceCardBorder) }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp)
                .padding(bottom = 32.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Record Boutique Sale / POS",
                        style = MaterialTheme.typography.titleLarge,
                        color = TextPrimary,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Complete instant checkout with receipt",
                        color = TextSecondary,
                        fontSize = 12.sp
                    )
                }

                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close, contentDescription = "Close", tint = TextMuted)
                }
            }

            // Sale Channel Selector
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                listOf("in-store" to "In-Store Fitting", "online" to "Online / Courier").forEach { (type, label) ->
                    val isSelected = saleType == type
                    Surface(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(10.dp))
                            .border(1.dp, if (isSelected) PrimaryGold else SurfaceCardBorder, RoundedCornerShape(10.dp))
                            .clickable { saleType = type },
                        color = if (isSelected) GoldMuted else SurfaceCard
                    ) {
                        Text(
                            text = label,
                            color = if (isSelected) PrimaryGold else TextSecondary,
                            fontSize = 12.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            modifier = Modifier.padding(vertical = 10.dp),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                }
            }

            // Cart Items Section
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = SurfaceCard)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(
                        text = "Cart Items (${cartItems.size})",
                        color = TextPrimary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )

                    if (cartItems.isEmpty()) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "No items in cart yet. Select a product below to add.",
                            color = TextMuted,
                            fontSize = 12.sp
                        )
                    } else {
                        cartItems.forEach { item ->
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = item.product.title,
                                        color = TextPrimary,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                    val variantDesc = listOfNotNull(item.selectedSize?.let { "Size $it" }, item.selectedColor).joinToString(" • ")
                                    if (variantDesc.isNotBlank()) {
                                        Text(
                                            text = variantDesc,
                                            color = PrimaryGold,
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Medium
                                        )
                                    }
                                    Text(
                                        text = "${formatKSh(item.product.price)} each",
                                        color = TextMuted,
                                        fontSize = 11.sp
                                    )
                                }

                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    IconButton(
                                        onClick = { onUpdateQuantity(item.product.id, item.quantity - 1) },
                                        modifier = Modifier.size(28.dp)
                                    ) {
                                        Icon(Icons.Filled.RemoveCircleOutline, contentDescription = "Decrease", tint = StatusDanger, modifier = Modifier.size(20.dp))
                                    }

                                    Text(
                                        text = "${item.quantity}",
                                        color = TextPrimary,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        modifier = Modifier.padding(horizontal = 8.dp)
                                    )

                                    IconButton(
                                        onClick = { onUpdateQuantity(item.product.id, item.quantity + 1) },
                                        modifier = Modifier.size(28.dp)
                                    ) {
                                        Icon(Icons.Filled.AddCircleOutline, contentDescription = "Increase", tint = PrimaryGold, modifier = Modifier.size(20.dp))
                                    }
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))
                    HorizontalDivider(color = SurfaceCardBorder)
                    Spacer(modifier = Modifier.height(10.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Total Amount:", color = TextSecondary, fontWeight = FontWeight.Bold)
                        Text(
                            text = formatKSh(totalAmount),
                            color = PrimaryGold,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // Quick Product Selector List
            Text("Quick Add Items to Sale", color = TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Medium)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                products.take(6).forEach { product ->
                    Surface(
                        modifier = Modifier
                            .clip(RoundedCornerShape(10.dp))
                            .clickable { onAddToCart(product) },
                        color = SurfaceCardElevated
                    ) {
                        Column(modifier = Modifier.padding(8.dp)) {
                            Text(product.title.take(18) + "..", color = TextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            Text(formatKSh(product.price), color = PrimaryGold, fontSize = 10.sp)
                        }
                    }
                }
            }

            // Customer Details
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = customerName,
                    onValueChange = { customerName = it },
                    label = { Text("Customer Name") },
                    placeholder = { Text("e.g. Jane Muthoni") },
                    singleLine = true,
                    shape = RoundedCornerShape(10.dp),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PrimaryGold, unfocusedBorderColor = SurfaceCardBorder),
                    modifier = Modifier.weight(1f)
                )

                OutlinedTextField(
                    value = customerPhone,
                    onValueChange = { customerPhone = it },
                    label = { Text("Phone Number") },
                    placeholder = { Text("0712345678") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    singleLine = true,
                    shape = RoundedCornerShape(10.dp),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PrimaryGold, unfocusedBorderColor = SurfaceCardBorder),
                    modifier = Modifier.weight(1f)
                )
            }

            // Payment Method Selector
            Text("Payment Method", color = TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Medium)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                listOf("mpesa" to "M-Pesa", "cash" to "Cash", "card" to "Card", "bank-transfer" to "Bank").forEach { (method, label) ->
                    val isSelected = paymentMethod == method
                    Surface(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .border(1.dp, if (isSelected) PrimaryGold else SurfaceCardBorder, RoundedCornerShape(8.dp))
                            .clickable { paymentMethod = method },
                        color = if (isSelected) GoldMuted else SurfaceCard
                    ) {
                        Text(
                            text = label,
                            color = if (isSelected) PrimaryGold else TextSecondary,
                            fontSize = 11.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            modifier = Modifier.padding(vertical = 8.dp),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                }
            }

            // M-Pesa Transaction Reference Code
            if (paymentMethod == "mpesa" || paymentMethod == "card") {
                OutlinedTextField(
                    value = transactionRef,
                    onValueChange = { transactionRef = it.uppercase() },
                    label = { Text(if (paymentMethod == "mpesa") "M-Pesa Reference Code" else "Card Auth Code") },
                    placeholder = { Text(if (paymentMethod == "mpesa") "e.g. QJH3X7Y9" else "TXN-1234") },
                    singleLine = true,
                    shape = RoundedCornerShape(10.dp),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PrimaryGold, unfocusedBorderColor = SurfaceCardBorder),
                    modifier = Modifier.fillMaxWidth()
                )

                if (paymentMethod == "mpesa" && onInitiateMpesaStkPush != null) {
                    Spacer(modifier = Modifier.height(4.dp))
                    OutlinedButton(
                        onClick = {
                            if (customerPhone.isNotBlank() && totalAmount > 0) {
                                onInitiateMpesaStkPush(customerPhone, totalAmount)
                            }
                        },
                        enabled = customerPhone.isNotBlank() && totalAmount > 0 && !mpesaStkState.isInitiating,
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = FashionEmerald),
                        border = BorderStroke(1.dp, FashionEmerald),
                        modifier = Modifier.fillMaxWidth().height(42.dp)
                    ) {
                        if (mpesaStkState.isInitiating) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), color = FashionEmerald, strokeWidth = 2.dp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Sending STK Push...", fontSize = 12.sp)
                        } else {
                            Icon(Icons.Default.PhoneAndroid, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Prompt STK Push on Customer Phone", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                    if (mpesaStkState.message != null) {
                        Text(
                            text = mpesaStkState.message,
                            fontSize = 11.sp,
                            color = if (mpesaStkState.status == "completed") FashionEmerald else TextSecondary,
                            modifier = Modifier.padding(start = 4.dp, top = 2.dp)
                        )
                    }
                }
            }

            // Notes
            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text("Sale Notes / Delivery Instructions") },
                placeholder = { Text("Boutique pickup / fitting notes") },
                singleLine = true,
                shape = RoundedCornerShape(10.dp),
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PrimaryGold, unfocusedBorderColor = SurfaceCardBorder),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(10.dp))

            // Checkout Complete Button
            Button(
                onClick = {
                    if (cartItems.isNotEmpty()) {
                        isProcessing = true
                        onCompleteSale(
                            saleType,
                            customerName,
                            customerPhone,
                            paymentMethod,
                            transactionRef,
                            cartItems,
                            notes
                        ) { isProcessing = false }
                    }
                },
                enabled = cartItems.isNotEmpty() && !isProcessing,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .testTag("btn_complete_sale"),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryGold, contentColor = AppBlack)
            ) {
                if (isProcessing) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), color = AppBlack, strokeWidth = 2.dp)
                } else {
                    Icon(Icons.Filled.Check, contentDescription = null, tint = AppBlack)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Complete Sale (${formatKSh(totalAmount)})",
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    )
                }
            }
        }
    }
}

// ==================== SETTINGS & SERVER CONFIG SHEET ====================
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsBottomSheet(
    currentUser: User?,
    currentBaseUrl: String,
    isServerOnline: Boolean,
    themeMode: AppThemeMode,
    onSetThemeMode: (AppThemeMode) -> Unit,
    supabaseUrl: String = "",
    supabaseAnonKey: String = "",
    supabaseServiceKey: String = "",
    onUpdateSupabaseCredentials: (String, String, String) -> Unit = { _, _, _ -> },
    onUpdateBaseUrl: (String) -> Unit = {},
    onPingServer: () -> Unit = {},
    onSwitchRole: (String) -> Unit = {},
    onLogout: () -> Unit,
    onDismiss: () -> Unit
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = MaterialTheme.colorScheme.surface,
        dragHandle = { BottomSheetDefaults.DragHandle(color = MaterialTheme.colorScheme.outlineVariant) }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 36.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Boutique Settings",
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.Bold
                )
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close, contentDescription = "Close", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            // User Profile Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(50.dp)
                            .clip(CircleShape)
                            .background(GoldMuted),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Person,
                            contentDescription = null,
                            tint = PrimaryGold,
                            modifier = Modifier.size(28.dp)
                        )
                    }

                    Spacer(modifier = Modifier.width(14.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = currentUser?.fullName ?: "Anne's Fashion Line",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSurface,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = currentUser?.phone ?: currentUser?.email ?: "Boutique Staff",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    RoleBadge(role = currentUser?.role ?: "admin")
                }
            }

            // Theme & Appearance Switcher (User-facing control)
            Text(
                text = "Display Theme",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                listOf(
                    Triple(AppThemeMode.DARK, "🌙 Dark", Icons.Filled.DarkMode),
                    Triple(AppThemeMode.LIGHT, "☀️ Light", Icons.Filled.LightMode),
                    Triple(AppThemeMode.SYSTEM, "📱 System", Icons.Filled.BrightnessAuto)
                ).forEach { (mode, label, icon) ->
                    val isSelected = themeMode == mode
                    Surface(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(10.dp))
                            .border(1.dp, if (isSelected) PrimaryGold else MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(10.dp))
                            .clickable { onSetThemeMode(mode) },
                        color = if (isSelected) GoldMuted else MaterialTheme.colorScheme.surfaceVariant
                    ) {
                        Row(
                            modifier = Modifier.padding(vertical = 12.dp, horizontal = 8.dp),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(icon, contentDescription = null, tint = if (isSelected) PrimaryGold else MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = label,
                                color = if (isSelected) PrimaryGold else MaterialTheme.colorScheme.onSurfaceVariant,
                                fontSize = 12.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                            )
                        }
                    }
                }
            }

            // Boutique Information
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(
                        text = "Anne's Fashion Line • Atelier POS",
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onSurface,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Luxury Contemporary African Haute Couture. Connected to official store and cloud database.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Logout Button (Clean, user-facing)
            Button(
                onClick = {
                    onLogout()
                    onDismiss()
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
                    .testTag("btn_logout"),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = StatusDangerBg, contentColor = StatusDanger)
            ) {
                Icon(Icons.Filled.Logout, contentDescription = null, tint = StatusDanger)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Log Out of Anne's Fashion Line", fontWeight = FontWeight.Bold, fontSize = 14.sp)
            }
        }
    }
}

// ==================== LIVE CLOUD & WEBSITE SYNC CENTER BOTTOM SHEET ====================
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SyncCenterBottomSheet(
    syncState: SyncState,
    supabaseUrl: String,
    supabaseAnonKey: String,
    supabaseServiceKey: String = "",
    websiteUrl: String,
    isSyncing: Boolean,
    onUpdateCredentials: (url: String, anon: String, service: String) -> Unit = { _, _, _ -> },
    onUpdateWebsiteUrl: (String) -> Unit,
    onRunDiagnostics: (customWebsiteUrl: String?) -> Unit,
    onPullFromCloud: () -> Unit,
    onPushToCloud: () -> Unit,
    sqlSchema: String,
    onDismiss: () -> Unit
) {
    val clipboardManager = LocalClipboardManager.current
    var inputSupabaseUrl by remember { mutableStateOf(supabaseUrl) }
    var inputAnonKey by remember { mutableStateOf(supabaseAnonKey) }
    var inputServiceKey by remember { mutableStateOf(supabaseServiceKey) }
    var inputWebsiteUrl by remember { mutableStateOf(websiteUrl) }
    var showKeys by remember { mutableStateOf(false) }
    var showSqlSchema by remember { mutableStateOf(false) }
    var copyNotice by remember { mutableStateOf<String?>(null) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = MaterialTheme.colorScheme.surface,
        dragHandle = { BottomSheetDefaults.DragHandle(color = MaterialTheme.colorScheme.outlineVariant) }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 36.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(GoldMuted),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Filled.CloudSync,
                            contentDescription = null,
                            tint = PrimaryGold,
                            modifier = Modifier.size(22.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = "Website & Cloud Sync",
                            style = MaterialTheme.typography.titleLarge,
                            color = MaterialTheme.colorScheme.onSurface,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Live Supabase Data Exchange",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close, contentDescription = "Close", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            // Connection Status Banner
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (syncState.isSupabaseOnline && syncState.isAuthValid) {
                        Color(0x1F10B981)
                    } else {
                        Color(0x1FF59E0B)
                    }
                ),
                border = CardDefaults.outlinedCardBorder().copy(
                    brush = Brush.horizontalGradient(
                        if (syncState.isSupabaseOnline) listOf(FashionEmerald, PrimaryGold) else listOf(StatusWarning, DarkGold)
                    ),
                    width = 1.dp
                )
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(10.dp)
                                    .clip(CircleShape)
                                    .background(if (syncState.isSupabaseOnline && syncState.isAuthValid) StatusSuccess else StatusWarning)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = if (syncState.isSupabaseOnline && syncState.isAuthValid) "CLOUD SYNC CONNECTED" else "CLOUD OFFLINE / CONFIG REQUIRED",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                color = if (syncState.isSupabaseOnline && syncState.isAuthValid) StatusSuccess else StatusWarning
                            )
                        }

                        if (syncState.latencyMs > 0) {
                            Surface(
                                shape = RoundedCornerShape(6.dp),
                                color = Color(0x33000000)
                            ) {
                                Text(
                                    text = "${syncState.latencyMs}ms",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextSecondary,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }
                    }

                    Text(
                        text = syncState.statusText,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "Last synced: ${syncState.lastSyncTime}",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        if (syncState.tablesDetected.isNotEmpty()) {
                            Text(
                                text = "Tables: ${syncState.tablesDetected.joinToString(", ")}",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = PrimaryGold
                            )
                        }
                    }
                }
            }

            // Quick Actions: Run Diagnostics, Pull, Push
            Text(
                text = "Live Synchronization Actions",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = { onRunDiagnostics(inputWebsiteUrl) },
                    enabled = !isSyncing,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = FashionEmerald,
                        contentColor = Color.White
                    )
                ) {
                    if (isSyncing) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                    } else {
                        Icon(Icons.Filled.NetworkCheck, contentDescription = null, modifier = Modifier.size(16.dp))
                    }
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Diagnose", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }

                Button(
                    onClick = onPullFromCloud,
                    enabled = !isSyncing,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = PrimaryGold,
                        contentColor = AppBlack
                    )
                ) {
                    Icon(Icons.Filled.CloudDownload, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Pull Data", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }

                Button(
                    onClick = onPushToCloud,
                    enabled = !isSyncing,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant,
                        contentColor = MaterialTheme.colorScheme.onSurface
                    )
                ) {
                    Icon(Icons.Filled.CloudUpload, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Push Data", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }

            // Troubleshooting Tip if any
            syncState.troubleshootingTip?.let { tip ->
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.Top
                    ) {
                        Icon(Icons.Filled.Info, contentDescription = null, tint = PrimaryGold, modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = tip,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
            }

            // Supabase Project Credentials Configuration
            Text(
                text = "Supabase Project Credentials",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold
            )

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Supabase API Keys",
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.onSurface
                        )

                        IconButton(onClick = { showKeys = !showKeys }) {
                            Icon(
                                if (showKeys) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                                contentDescription = "Toggle Keys",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    OutlinedTextField(
                        value = inputSupabaseUrl,
                        onValueChange = { inputSupabaseUrl = it },
                        label = { Text("Supabase Project URL") },
                        singleLine = true,
                        shape = RoundedCornerShape(10.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = FashionEmerald,
                            unfocusedBorderColor = MaterialTheme.colorScheme.outlineVariant
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = inputAnonKey,
                        onValueChange = { inputAnonKey = it },
                        label = { Text("Anon / Public Key") },
                        singleLine = true,
                        visualTransformation = if (showKeys) androidx.compose.ui.text.input.VisualTransformation.None else androidx.compose.ui.text.input.PasswordVisualTransformation(),
                        shape = RoundedCornerShape(10.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = FashionEmerald,
                            unfocusedBorderColor = MaterialTheme.colorScheme.outlineVariant
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = inputServiceKey,
                        onValueChange = { inputServiceKey = it },
                        label = { Text("Service Role Key (Full Admin)") },
                        singleLine = true,
                        visualTransformation = if (showKeys) androidx.compose.ui.text.input.VisualTransformation.None else androidx.compose.ui.text.input.PasswordVisualTransformation(),
                        shape = RoundedCornerShape(10.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = FashionEmerald,
                            unfocusedBorderColor = MaterialTheme.colorScheme.outlineVariant
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = inputWebsiteUrl,
                        onValueChange = {
                            inputWebsiteUrl = it
                            onUpdateWebsiteUrl(it)
                        },
                        label = { Text("Website Storefront URL") },
                        placeholder = { Text("https://annesfashion.co.ke") },
                        singleLine = true,
                        shape = RoundedCornerShape(10.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = PrimaryGold,
                            unfocusedBorderColor = MaterialTheme.colorScheme.outlineVariant
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Button(
                        onClick = {
                            onUpdateCredentials(inputSupabaseUrl, inputAnonKey, inputServiceKey)
                            onRunDiagnostics(inputWebsiteUrl)
                        },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = FashionEmerald,
                            contentColor = Color.White
                        )
                    ) {
                        Icon(Icons.Filled.Save, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Save Credentials & Test Connection", fontWeight = FontWeight.Bold)
                    }
                }
            }

            // Supabase SQL Schema Setup Helper
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { showSqlSchema = !showSqlSchema },
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Filled.Code, contentDescription = null, tint = PrimaryGold, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Supabase SQL Setup Script",
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        }
                        Icon(
                            imageVector = if (showSqlSchema) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    if (showSqlSchema) {
                        Text(
                            text = "If your Supabase tables (products, sales, customers) have not been created yet, copy this script and run it in the Supabase SQL Editor.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(8.dp),
                            color = AppBlack
                        ) {
                            Text(
                                text = sqlSchema.take(300) + "\n... (full schema ready to copy)",
                                color = LightGold,
                                fontSize = 11.sp,
                                fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                                modifier = Modifier.padding(10.dp)
                            )
                        }

                        Button(
                            onClick = {
                                clipboardManager.setText(AnnotatedString(sqlSchema))
                                copyNotice = "SQL Script copied to clipboard! Paste it into Supabase SQL Editor."
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = PrimaryGold, contentColor = AppBlack)
                        ) {
                            Icon(Icons.Filled.ContentCopy, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Copy Full SQL Script", fontWeight = FontWeight.Bold)
                        }

                        copyNotice?.let { msg ->
                            Text(
                                text = msg,
                                color = FashionEmerald,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }
        }
    }
}

// ==================== CREATE PREORDER BOTTOM SHEET ====================
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreatePreorderBottomSheet(
    products: List<Product>,
    onDismiss: () -> Unit,
    onCreatePreorder: (
        productId: Int,
        productTitle: String,
        customerName: String,
        customerPhone: String,
        quantity: Int,
        depositAmount: Double,
        totalAmount: Double,
        expectedDate: String?,
        notes: String?
    ) -> Unit
) {
    var selectedProduct by remember { mutableStateOf<Product?>(products.firstOrNull()) }
    var customPieceTitle by remember { mutableStateOf("") }
    var customerName by remember { mutableStateOf("") }
    var customerPhone by remember { mutableStateOf("") }
    var quantityText by remember { mutableStateOf("1") }
    var depositText by remember { mutableStateOf("") }
    var totalText by remember { mutableStateOf(selectedProduct?.price?.toInt()?.toString() ?: "5000") }
    var expectedDateText by remember { mutableStateOf("In 14 Days") }
    var notesText by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = SurfaceDark,
        tonalElevation = 8.dp,
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 32.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Book Customer Pre-Order",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Text(
                        text = "Custom fitting & upcoming collection reservations",
                        fontSize = 12.sp,
                        color = TextSecondary
                    )
                }
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close, contentDescription = "Close", tint = TextSecondary)
                }
            }

            // Customer Details
            OutlinedTextField(
                value = customerName,
                onValueChange = { customerName = it },
                label = { Text("Customer Full Name *") },
                placeholder = { Text("e.g. Wanjiku Muthoni") },
                singleLine = true,
                shape = RoundedCornerShape(10.dp),
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PrimaryGold, unfocusedBorderColor = SurfaceCardBorder),
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = customerPhone,
                onValueChange = { customerPhone = it },
                label = { Text("Customer Phone (M-Pesa) *") },
                placeholder = { Text("0712345678 or 2547...") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                singleLine = true,
                shape = RoundedCornerShape(10.dp),
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PrimaryGold, unfocusedBorderColor = SurfaceCardBorder),
                modifier = Modifier.fillMaxWidth()
            )

            // Product Selection or Custom Piece
            if (products.isNotEmpty()) {
                Text("Select Garment / Catalog Piece:", fontSize = 12.sp, color = TextSecondary, fontWeight = FontWeight.Medium)
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    items(items = products.take(8), key = { it.id }) { prod: Product ->
                        val isSelected = selectedProduct?.id == prod.id
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = if (isSelected) PrimaryGold.copy(alpha = 0.2f) else SurfaceCard,
                            border = BorderStroke(1.dp, if (isSelected) PrimaryGold else SurfaceCardBorder),
                            modifier = Modifier.clickable {
                                selectedProduct = prod
                                totalText = (prod.price * (quantityText.toIntOrNull() ?: 1)).toInt().toString()
                            }
                        ) {
                            Text(
                                text = prod.title,
                                fontSize = 11.sp,
                                color = if (isSelected) PrimaryGold else TextPrimary,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                            )
                        }
                    }
                }
            }

            OutlinedTextField(
                value = customPieceTitle,
                onValueChange = { customPieceTitle = it },
                label = { Text("Or Custom Tailoring Description") },
                placeholder = { Text("e.g. Emerald Silk Evening Gown - Size 12") },
                singleLine = true,
                shape = RoundedCornerShape(10.dp),
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PrimaryGold, unfocusedBorderColor = SurfaceCardBorder),
                modifier = Modifier.fillMaxWidth()
            )

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = quantityText,
                    onValueChange = { quantityText = it },
                    label = { Text("Quantity") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    shape = RoundedCornerShape(10.dp),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PrimaryGold, unfocusedBorderColor = SurfaceCardBorder),
                    modifier = Modifier.weight(1f)
                )

                OutlinedTextField(
                    value = totalText,
                    onValueChange = { totalText = it },
                    label = { Text("Total (KSh) *") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    shape = RoundedCornerShape(10.dp),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PrimaryGold, unfocusedBorderColor = SurfaceCardBorder),
                    modifier = Modifier.weight(1.5f)
                )
            }

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = depositText,
                    onValueChange = { depositText = it },
                    label = { Text("Deposit Paid (KSh)") },
                    placeholder = { Text("e.g. 2500") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    shape = RoundedCornerShape(10.dp),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PrimaryGold, unfocusedBorderColor = SurfaceCardBorder),
                    modifier = Modifier.weight(1f)
                )

                OutlinedTextField(
                    value = expectedDateText,
                    onValueChange = { expectedDateText = it },
                    label = { Text("Ready By") },
                    placeholder = { Text("e.g. 2026-09-18") },
                    shape = RoundedCornerShape(10.dp),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PrimaryGold, unfocusedBorderColor = SurfaceCardBorder),
                    modifier = Modifier.weight(1f)
                )
            }

            OutlinedTextField(
                value = notesText,
                onValueChange = { notesText = it },
                label = { Text("Measurements / Fabric Notes") },
                placeholder = { Text("Bust: 36, Waist: 28, Length: 58. African wax print with silk lining") },
                minLines = 2,
                shape = RoundedCornerShape(10.dp),
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PrimaryGold, unfocusedBorderColor = SurfaceCardBorder),
                modifier = Modifier.fillMaxWidth()
            )

            Button(
                onClick = {
                    val finalTitle = if (customPieceTitle.isNotBlank()) customPieceTitle else (selectedProduct?.title ?: "Custom Piece")
                    val prodId = selectedProduct?.id ?: 0
                    val qty = quantityText.toIntOrNull() ?: 1
                    val deposit = depositText.toDoubleOrNull() ?: 0.0
                    val total = totalText.toDoubleOrNull() ?: (deposit * 2)

                    isSubmitting = true
                    onCreatePreorder(
                        prodId,
                        finalTitle,
                        customerName.trim(),
                        customerPhone.trim(),
                        qty,
                        deposit,
                        total,
                        expectedDateText.trim().ifBlank { null },
                        notesText.trim().ifBlank { null }
                    )
                },
                enabled = customerName.isNotBlank() && customerPhone.isNotBlank() && !isSubmitting,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryGold, contentColor = AppBlack)
            ) {
                if (isSubmitting) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = AppBlack)
                } else {
                    Icon(Icons.Default.ReceiptLong, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Confirm Pre-Order & Issue PO", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

// ==================== IMPORT PRODUCTS CSV BOTTOM SHEET ====================
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ImportProductsBottomSheet(
    onDismiss: () -> Unit,
    onImportCsv: (String) -> Unit
) {
    val sampleCsv = """title, category, price, stock, sku, description, allowPreorder
Anne's Royal Ankara Maxi Dress, dresses, 7500, 12, ALF-DR-001, Handcrafted African Ankara premium print maxi dress, true
Silk Satin Slip Dress, dresses, 5800, 8, ALF-DR-002, Pure mulberry silk with cowl neckline, true
Tailored Linen Blazer, jackets, 9200, 5, ALF-JK-001, Italian linen double-breasted formal blazer, false
Embroidered Swahili Kimono, tops, 6400, 14, ALF-TP-001, Coastal Swahili artisanal embroidery kimono jacket, true
High-Waist Wide Leg Trousers, pants, 4500, 10, ALF-PT-001, Premium crepe structured high-waist pants, false"""

    var csvText by remember { mutableStateOf("") }
    var isImporting by remember { mutableStateOf(false) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = SurfaceDark,
        tonalElevation = 8.dp,
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 32.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Bulk Import Catalog (CSV / Excel)",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Text(
                        text = "Import products, inventory quantities, and preorder settings",
                        fontSize = 12.sp,
                        color = TextSecondary
                    )
                }
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close, contentDescription = "Close", tint = TextSecondary)
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Paste CSV data below:", fontSize = 12.sp, color = TextSecondary, fontWeight = FontWeight.SemiBold)
                TextButton(
                    onClick = { csvText = sampleCsv },
                    colors = ButtonDefaults.textButtonColors(contentColor = PrimaryGold)
                ) {
                    Icon(Icons.Default.Download, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Load Sample 5 Items", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }

            OutlinedTextField(
                value = csvText,
                onValueChange = { csvText = it },
                placeholder = {
                    Text(
                        "title, category, price, stock, sku, description, allowPreorder\nMaxi Dress, dresses, 7500, 10, ALF-001, ..., true",
                        fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                        fontSize = 11.sp
                    )
                },
                minLines = 8,
                maxLines = 14,
                shape = RoundedCornerShape(10.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = PrimaryGold,
                    unfocusedBorderColor = SurfaceCardBorder,
                    focusedTextColor = TextPrimary,
                    unfocusedTextColor = TextPrimary
                ),
                textStyle = androidx.compose.ui.text.TextStyle(
                    fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                    fontSize = 12.sp
                ),
                modifier = Modifier.fillMaxWidth()
            )

            Button(
                onClick = {
                    if (csvText.isNotBlank()) {
                        isImporting = true
                        onImportCsv(csvText)
                    }
                },
                enabled = csvText.isNotBlank() && !isImporting,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryGold, contentColor = AppBlack)
            ) {
                if (isImporting) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = AppBlack)
                } else {
                    Icon(Icons.Default.CloudUpload, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Import to Supabase & Catalog", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

// ==================== PRODUCT DETAIL BOTTOM SHEET ====================
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductDetailBottomSheet(
    product: Product,
    onDismiss: () -> Unit,
    onEdit: () -> Unit,
    onAdjustStock: () -> Unit,
    onAddToCart: (selectedSize: String?, selectedColor: String?) -> Unit,
    userIsAdmin: Boolean
) {
    var selectedSize by remember {
        mutableStateOf(
            product.sizes.firstOrNull()
                ?: product.waistSizes.firstOrNull()
                ?: product.bustSizes.firstOrNull()
                ?: product.shoeSizes.firstOrNull()
        )
    }
    var selectedColor by remember {
        mutableStateOf(product.colors.firstOrNull())
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = SurfaceCard,
        dragHandle = { BottomSheetDefaults.DragHandle(color = SurfaceCardBorder) }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 32.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header: Category & Close
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(
                        shape = RoundedCornerShape(6.dp),
                        color = GoldMuted
                    ) {
                        Text(
                            text = product.category.uppercase(),
                            color = PrimaryGold,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                    if (product.isFeatured == 1) {
                        Spacer(modifier = Modifier.width(6.dp))
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = PrimaryGold
                        ) {
                            Text(
                                text = "FEATURED",
                                color = AppBlack,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp)
                            )
                        }
                    }
                }
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Filled.Close, contentDescription = "Close", tint = TextSecondary)
                }
            }

            // Image Gallery
            val displayImages = if (product.images.isNotEmpty()) {
                product.images.map { it.url }
            } else if (!product.imageUrl.isNullOrBlank()) {
                listOf(product.imageUrl!!)
            } else {
                emptyList()
            }

            if (displayImages.isNotEmpty()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    displayImages.forEach { imgUrl ->
                        AsyncImage(
                            model = imgUrl,
                            contentDescription = product.title,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .size(width = 160.dp, height = 200.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .border(1.dp, SurfaceCardBorder, RoundedCornerShape(12.dp))
                        )
                    }
                }
            }

            // Title & Price
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = product.title,
                    style = MaterialTheme.typography.titleLarge,
                    color = TextPrimary,
                    fontWeight = FontWeight.Bold
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = formatKSh(product.price),
                        color = PrimaryGold,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp
                    )
                    StockBadge(stock = product.totalStock)
                }
            }

            // Multicoloured highlight banner if applicable
            if (product.isMultiColored) {
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    border = BorderStroke(
                        1.5.dp,
                        Brush.horizontalGradient(
                            listOf(Color(0xFFFF5252), Color(0xFFFFD700), Color(0xFF448AFF), Color(0xFFE040FB))
                        )
                    ),
                    color = PrimaryGold.copy(alpha = 0.15f),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("🌈", fontSize = 16.sp)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Multicoloured / Print Pattern Design",
                            color = TextPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp
                        )
                    }
                }
            }

            // 1. Waist Sizes (if any)
            if (product.waistSizes.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Select Waist Size:", color = PrimaryGold, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        product.waistSizes.forEach { waist ->
                            val isSel = selectedSize == waist
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                border = BorderStroke(1.dp, if (isSel) PrimaryGold else SurfaceCardBorder),
                                color = if (isSel) PrimaryGold else SurfaceCardElevated,
                                modifier = Modifier.clickable { selectedSize = waist }
                            ) {
                                Text(
                                    text = "Waist $waist",
                                    color = if (isSel) AppBlack else TextPrimary,
                                    fontSize = 12.sp,
                                    fontWeight = if (isSel) FontWeight.Bold else FontWeight.Normal,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                )
                            }
                        }
                    }
                }
            }

            // 2. Bust Sizes (if any)
            if (product.bustSizes.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Select Bust Size:", color = PrimaryGold, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        product.bustSizes.forEach { bust ->
                            val isSel = selectedSize == bust
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                border = BorderStroke(1.dp, if (isSel) PrimaryGold else SurfaceCardBorder),
                                color = if (isSel) PrimaryGold else SurfaceCardElevated,
                                modifier = Modifier.clickable { selectedSize = bust }
                            ) {
                                Text(
                                    text = "Bust $bust",
                                    color = if (isSel) AppBlack else TextPrimary,
                                    fontSize = 12.sp,
                                    fontWeight = if (isSel) FontWeight.Bold else FontWeight.Normal,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                )
                            }
                        }
                    }
                }
            }

            // 3. Shoe Sizes (if any)
            if (product.shoeSizes.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Select Shoe / Footwear Size:", color = PrimaryGold, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        product.shoeSizes.forEach { shoe ->
                            val isSel = selectedSize == shoe
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                border = BorderStroke(1.dp, if (isSel) PrimaryGold else SurfaceCardBorder),
                                color = if (isSel) PrimaryGold else SurfaceCardElevated,
                                modifier = Modifier.clickable { selectedSize = shoe }
                            ) {
                                Text(
                                    text = "EU $shoe",
                                    color = if (isSel) AppBlack else TextPrimary,
                                    fontSize = 12.sp,
                                    fontWeight = if (isSel) FontWeight.Bold else FontWeight.Normal,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                )
                            }
                        }
                    }
                }
            }

            // 4. Standard Sizes (if any)
            if (product.sizes.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Select Size:", color = PrimaryGold, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        product.sizes.forEach { sz ->
                            val isSel = selectedSize == sz
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                border = BorderStroke(1.dp, if (isSel) PrimaryGold else SurfaceCardBorder),
                                color = if (isSel) PrimaryGold else SurfaceCardElevated,
                                modifier = Modifier.clickable { selectedSize = sz }
                            ) {
                                Text(
                                    text = sz,
                                    color = if (isSel) AppBlack else TextPrimary,
                                    fontSize = 12.sp,
                                    fontWeight = if (isSel) FontWeight.Bold else FontWeight.Normal,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                )
                            }
                        }
                    }
                }
            }

            // 5. Colors (if any)
            if (product.colors.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Select Colour:", color = PrimaryGold, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        product.colors.forEach { col ->
                            val isSel = selectedColor == col
                            val isMulti = col.equals("Multicoloured", ignoreCase = true) || col.equals("Multicolor", ignoreCase = true)
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                border = BorderStroke(
                                    1.dp,
                                    if (isMulti) Color(0xFFFFD700) else if (isSel) PrimaryGold else SurfaceCardBorder
                                ),
                                color = if (isSel) PrimaryGold else SurfaceCardElevated,
                                modifier = Modifier.clickable { selectedColor = col }
                            ) {
                                Text(
                                    text = if (isMulti) "🌈 $col" else col,
                                    color = if (isSel) AppBlack else TextPrimary,
                                    fontSize = 12.sp,
                                    fontWeight = if (isSel) FontWeight.Bold else FontWeight.Normal,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                )
                            }
                        }
                    }
                }
            }

            // Description
            if (product.description.isNotBlank()) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Description", color = TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    Text(product.description, color = TextPrimary, fontSize = 13.sp, lineHeight = 18.sp)
                }
            }

            // Actions
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Button(
                    onClick = {
                        onAddToCart(selectedSize, selectedColor)
                        onDismiss()
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryGold, contentColor = AppBlack)
                ) {
                    Icon(Icons.Filled.AddShoppingCart, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Add to POS Cart", fontWeight = FontWeight.Bold)
                }

                if (userIsAdmin) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        OutlinedButton(
                            onClick = {
                                onDismiss()
                                onAdjustStock()
                            },
                            modifier = Modifier.weight(1f).height(44.dp),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = TextPrimary),
                            border = BorderStroke(1.dp, SurfaceCardBorder)
                        ) {
                            Icon(Icons.Outlined.Inventory, contentDescription = null, modifier = Modifier.size(16.dp), tint = PrimaryGold)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Adjust Stock", fontSize = 12.sp)
                        }

                        Button(
                            onClick = {
                                onDismiss()
                                onEdit()
                            },
                            modifier = Modifier.weight(1f).height(44.dp),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = SurfaceCardElevated, contentColor = PrimaryGold)
                        ) {
                            Icon(Icons.Outlined.Edit, contentDescription = null, modifier = Modifier.size(16.dp), tint = PrimaryGold)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Edit Product", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

