# Backend Setup Guide

## Quick Start Instructions

### Step 1: Database Setup

1. **Open phpMyAdmin** (http://localhost/phpmyadmin)
2. Click "SQL" tab
3. Copy and paste the entire content from `/backend/database/setup.sql`
4. Click "Go" to execute
5. You should see "boutique_db" database created with 8 tables

### Step 2: Verify Database Connection

1. Open your browser
2. Visit: `http://localhost/Boutique/backend/api/products/list.php`
3. You should see: `{"success":true,"message":"Products retrieved successfully","data":[]}`

### Step 3: Test Authentication

**Default Login Credentials:**
- **Admin**: `admin@annesfashion.com` / `admin123`
- **Staff**: `staff@annesfashion.com` / `staff123`

**IMPORTANT**: Change these passwords immediately in production!

### Step 4: Test Login API

You can test the login using a tool like Postman or JavaScript fetch:

```javascript
fetch('http://localhost/Boutique/backend/api/auth/login.php', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        email: 'staff@annesfashion.com',
        password: 'staff123'
    })
})
.then(res => res.json())
.then(data => console.log(data));
```

Expected response:
```json
{
    "success": true,
    "message": "Login successful",
    "data": {
        "token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
        "user": {
            "id": 2,
            "username": "staff",
            "email": "staff@annesfashion.com",
            "role": "staff",
            "first_name": "Staff",
            "last_name": "User"
        }
    }
}
```

## API Endpoints Summary

### Authentication
- `POST /backend/api/auth/login.php` - Login
- `GET /backend/api/auth/verify.php` - Verify token

### Products (Public)
- `GET /backend/api/products/list.php` - Get all products
- `POST /backend/api/products/create.php` - Create product (Admin only)
- `PUT /backend/api/products/update.php?id={id}` - Update product (Admin only)

### Sales (Staff & Admin)
- `POST /backend/api/sales/record.php` - Record in-store sale (Staff)
- `GET /backend/api/sales/list.php` - Get sales list (Staff/Admin)

### Inventory (Staff & Admin)
- `GET /backend/api/inventory/list.php` - Get inventory levels
- `PUT /backend/api/inventory/update.php` - Update stock (Admin only)

### Analytics (Staff & Admin)
- `GET /backend/api/analytics/dashboard.php` - Get dashboard metrics

## Using the API with Authorization

For protected endpoints, include the JWT token in the Authorization header:

```javascript
fetch('http://localhost/Boutique/backend/api/sales/record.php', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE'
    },
    body: JSON.stringify({
        items: [
            {
                product_id: 1,
                quantity: 2
            }
        ],
        payment_method: 'cash',
        customer_name: 'John Doe'
    })
})
.then(res => res.json())
.then(data => console.log(data));
```

## Common Issues & Solutions

### Issue: "Database connection failed"
**Solution**: 
1. Make sure XAMPP MySQL is running
2. Check database credentials in `/backend/config/database.php`
3. Default XAMPP password is empty, change if needed

### Issue: "CORS error"
**Solution**: CORS headers are already configured in `/backend/config/cors.php`

### Issue: "Unauthorized access"
**Solution**: Make sure you're including the Bearer token in Authorization header

### Issue: "Product not found"
**Solution**: Add products first using the admin create endpoint or manually in database

## Next Steps

1. ✅ Database is set up
2. ✅ API endpoints are ready
3. 🔄 Need to create Staff PWA interface (`/staff/index.html`)
4. 🔄 Need to create Admin PWA interface (`/admin/index.html`)
5. 🔄 Integrate existing product data into database

## Security Notes

- Change the JWT secret key in `/backend/middleware/auth.php`
- Change default passwords immediately
- In production, use HTTPS only
- Set proper file permissions
- Enable PHP error logging
