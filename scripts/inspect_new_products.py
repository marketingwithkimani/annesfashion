import os
import zipfile
import xml.etree.ElementTree as ET
import json
import re

# Read Excel 92
with zipfile.ZipFile('products/dress_product_inventory_92.xlsx') as z:
    sst = []
    if 'xl/sharedStrings.xml' in z.namelist():
        tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in tree.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
            sst.append(''.join([node.text for node in si.iter() if node.text]))
    
    sheet = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    rows = []
    for row in sheet.findall('.//s:row', ns):
        r_data = {}
        for c in row.findall('s:c', ns):
            ref = c.get('r')
            col = ''.join([ch for ch in ref if ch.isalpha()])
            t = c.get('t')
            v = c.find('s:v', ns)
            val = v.text if v is not None else ''
            if t == 's' and val != '':
                val = sst[int(val)]
            elif t == 'inlineStr':
                is_node = c.find('s:is', ns)
                val = ''.join([n.text for n in is_node.iter() if n.text]) if is_node is not None else ''
            r_data[col] = val
        rows.append(r_data)

excel_items = {}
for r in rows[1:]:
    order_val = int(r.get('A', '0').strip())
    excel_items[order_val] = {
        'order': order_val,
        'name': r.get('B', '').strip(),
        'type': r.get('C', '').strip(),
        'colors': r.get('D', '').strip(),
        'size_qty': r.get('E', '').strip(),
        'price': r.get('F', '').strip(),
        'img': r.get('G', '').strip(),
        'notes': r.get('H', '').strip()
    }

# Overrides for 86-90:
# Product 86 Red Short Dinner Dress Red 6 1 KSh 1,000
# Product 87 Floral Dinner Dress Floral 6 1 KSh 1,000
# Product 88 White & Orange Evening Dress White with orange 6 1 KSh 2,000
# Product 89 Black Short Dinner Dress Black 8 1 KSh 3,000
# Product 90 Floral Occasion Dress Floral 6 1 KSh 2,000
overrides = {
    86: {'name': 'Red Short Dinner Dress', 'type': 'Dinner dress', 'colors': 'Red', 'size_qty': '6: qty 1', 'price': '1000', 'img': 'Red Short Dinner Dress.jpg'},
    87: {'name': 'Floral Dinner Dress', 'type': 'Dinner dress', 'colors': 'Floral', 'size_qty': '6: qty 1', 'price': '1000', 'img': 'Floral Dinner Dress 87.jpg'},
    88: {'name': 'White & Orange Evening Dress', 'type': 'Evening dress', 'colors': 'White with orange', 'size_qty': '6: qty 1', 'price': '2000', 'img': 'White _ Orange Evening Dress.jpg'},
    89: {'name': 'Black Short Dinner Dress', 'type': 'Dinner dress', 'colors': 'Black', 'size_qty': '8: qty 1', 'price': '3000', 'img': 'Black Short Dinner Dress 89.jpg'},
    90: {'name': 'Floral Occasion Dress', 'type': 'Occasion dress', 'colors': 'Floral', 'size_qty': '6: qty 1', 'price': '2000', 'img': 'Floral Occasion Dress 90.jpg'}
}
for k, v in overrides.items():
    if k in excel_items:
        excel_items[k].update(v)

image_mapping = {
    'Black Short Dinner Dress 89.jpg': 89,
    'Black _ Gold Short Party Dress.jpg': 52,
    'Black _ Nude Dinner Dress.jpg': 58,
    'Black _ Purple Dinner Dress.jpg': 60,
    'Black _ Red _ Black _ Pink Sequin Dinner Dress.jpg': 57,
    'Brown _ Green Shirt Dress.jpg': 83,
    'Floral Dinner Dress 87.jpg': 87,
    'Floral Long Church Dress.jpg': 63,
    'Floral Occasion Dress 90.jpg': 90,
    'Green _ Pink Occasion Dress.jpg': 65,
    'Lilac Wedding Guest Dress.jpg': 54,
    'Multicoloured Evening Dress 92.jpg': 92,
    'Off-White Long Sequin Dress.jpg': 77,
    'Peach Dinner Dress 55.jpg': 55,
    'Peach Dinner Dress 59.jpg': 59,
    'Peach Dinner Dress.jpg': 62,
    'Peach Short Dinner Dress.jpg': 80,
    'Peach _ Green Dinner Dress.jpg': 51,
    'Peach _ Pink Dinner Dress.jpg': 61,
    'Pink Dinner Dress 53.jpg': 53,
    'Pink Dinner Dress.jpg': 67,
    'Purple Dinner Dress.jpg': 56,
    'Red Dinner Dress 79.jpg': 79,
    'Red Long Dinner Dress.jpg': 78,
    'Red Short Dinner Dress.jpg': 86,
    'Silkish Dinner Dress.jpg': 66,
    'Silver Evening Dress 81 _ 85.jpg': 85,
    'White Floral Evening Dress 91.jpg': 91,
    'White Floral Long Church Dress.jpg': 69,
    'White Free-Size Long Church Dress.jpg': 68,
    'White Long Church Dress.jpg': 50,
    'White Short Evening Dress.jpg': 82,
    'White _ Brown Office Wear.jpg': 84,
    'White _ Orange Evening Dress.jpg': 88,
}

def parse_size_qty(sq_str):
    variants = []
    # Clean string
    clean_sq = sq_str.replace('—', '').strip()
    if not clean_sq:
        return [{'size': 'Free Size', 'qty': 1}]
    # Handle "8 and 10: quantity not specified"
    if '8 and 10' in clean_sq.lower():
        return [{'size': '8', 'qty': 1}, {'size': '10', 'qty': 1}]
    parts = [p.strip() for p in clean_sq.split(';') if p.strip()]
    for p in parts:
        m = re.match(r'^(.*?)(?::\s*qty\s*(\d+))?$', p, re.IGNORECASE)
        if m:
            s = m.group(1).strip()
            qty = int(m.group(2)) if m.group(2) else 1
            variants.append({'size': s, 'qty': qty})
        else:
            variants.append({'size': p, 'qty': 1})
    return variants

def parse_colors(c_str):
    parts = re.split(r'[;/]|\band\b', c_str)
    res = []
    for p in parts:
        clean = p.strip()
        if clean and not clean.lower().startswith('second colour'):
            res.append(clean)
    return res if res else [c_str.strip()]

# Default prices for items missing price in Excel
fallback_prices = {
    60: 12000.0, # Black & Purple Dinner Dress
    62: 15000.0, # Peach Dinner Dress (matches other peach dinner dresses 55 & 59 at 15k)
    63: 10000.0, # Floral Long Church Dress (matches church dress range 10k-15k)
}

print(f"{'Order':5s} | {'Image':40s} | {'Title':35s} | {'Price':6s} | {'Stock':5s} | {'Sizes':25s} | {'Colors'}")
print("-" * 140)

new_products = {}
for img_name, order in sorted(image_mapping.items(), key=lambda x: x[1]):
    it = excel_items[order]
    
    # Price
    if it['price'] and it['price'].strip():
        price = float(it['price'].replace(',', '').strip())
    else:
        price = fallback_prices.get(order, 5000.0)
        
    subcategory = it['type'] if it['type'] and it['type'].lower() != 'not specified' else 'Dresses'
    colors = parse_colors(it['colors'])
    vars_list = parse_size_qty(it['size_qty'])
    sizes = [v['size'] for v in vars_list]
    total_stock = sum(v['qty'] for v in vars_list)
    
    new_products[order] = {
        'order': order,
        'title': it['name'],
        'price': price,
        'category': 'dresses',
        'subcategory': subcategory,
        'colors': colors,
        'sizes': sizes,
        'variants': vars_list,
        'total_stock': total_stock,
        'images': [img_name],
        'notes': it['notes']
    }
    
    print(f"#{order:4d} | {img_name:40s} | {it['name']:35s} | {price:6.0f} | {total_stock:5d} | {str(sizes):25s} | {str(colors)}")

