import os
import zipfile
import xml.etree.ElementTree as ET
import re
import json

with zipfile.ZipFile('products/dress_product_inventory_76.xlsx') as z:
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

# All 44 images mapped
image_to_order = {
    '10_mannequin_carved_L2_522275_0.jpg': 10,
    'Black & Gold Sequin Party Dress.jpg': 73,
    'Black Dinner Dress.jpg': 29,
    'Black Evening Dress.jpg': 43,
    'Black Floral Dinner Dress.jpg': 40,
    'Black Long Dress.jpg': 8,
    'Black Party Dress 72.jpg': 72,
    'Black Party Dress.jpg': 7,
    'Black Peach_Party_Dress.jpg': 19,
    'Black _ Red Party Dress.jpg': 76,
    'Blue Floral Occasion Dress.jpg': 75,
    'Green Party Dress.jpg': 18,
    'Luminous Green Party Dress 25.jpg': 25,
    'Luminous Green Party Dress.jpg': 22,
    'Maroon _ Black Occasion Dress.jpg': 14,
    'Mint Short Party Dress.jpg': 1,
    'Multicolour Free-Size Party Dress.jpg': 9,
    'Nude Dinner Dress.jpg': 20,
    'Nude 2 Dinner Dress.jpg': 20, # secondary
    'Nude Floral Dress.jpg': 6,
    'Nude Floral Party Dress.jpg': 28,
    'Nude Party Dress.jpg': 31,
    'Pink Wedding Guest Dress.jpg': 2,
    'Pink _ Red Party Dress.jpg': 30,
    'Purple Free-Size Dinner Dress.jpg': 23,
    'Red Dinner Dress.jpg': 15,
    'Short_Party_Dress.jpg': 3,
    'Silver Sequin Dinner Dress.jpg': 4,
    'Sky Blue Party Dress.jpg': 32,
    'White Dress.jpg': 12,
    'White Evening Dress.jpg': 34,
    'White Floral Party Dress.jpg': 11,
    'White Floral Shirt Dress.jpg': 35,
    'White Free-Size Evening Dress.jpg': 33,
    'White Occasion Dress 74.jpg': 74,
    'White Parrty Dress.jpg': 17,
    'White Party Dress 24.jpg': 24,
    'White Party Dress 36.jpg': 36,
    'White Party Dress 41.jpg': 41,
    'White Party Dress.jpg': 16,
    'White Shirt  Dress.jpg': 37,
    'White _ Blue _ White _ Green Striped Party Dress.jpg': 70,
    'Yellow Long_church_dress.jpg': 49,
    'Yellow Occasion Dress.jpg': 71,
}

def parse_size_qty(sq_str):
    # e.g. "UK 8: qty 1"
    # "10: qty 1; 12: qty 1"
    # "6: qty 1; 8: qty 2; 12: qty 1"
    # "Free size: qty 10"
    # "16: qty 1; 18: qty 2; 20: qty 2; 22: qty 2; 24: qty 1"
    variants = []
    parts = [p.strip() for p in sq_str.split(';') if p.strip()]
    for p in parts:
        m = re.match(r'^(.*?)(?::\s*qty\s*(\d+))?$', p, re.IGNORECASE)
        if m:
            s = m.group(1).strip()
            # clean "Size " or "UK "
            qty = int(m.group(2)) if m.group(2) else 1
            variants.append({'size': s, 'qty': qty})
        else:
            variants.append({'size': p, 'qty': 1})
    return variants

def parse_colors(c_str, order):
    if order == 1:
        return ['Mint']
    # split by semicolon or 'and' or '/'
    parts = re.split(r'[;/]|\band\b', c_str)
    res = []
    for p in parts:
        clean = p.strip()
        if clean and not clean.lower().startswith('second colour'):
            res.append(clean)
    return res if res else [c_str.strip()]

# Build products dictionary keyed by order
products_to_create = {}
for img_name, order in image_to_order.items():
    if order not in products_to_create:
        item = excel_items[order]
        # Title
        if order == 1:
            title = "Mint Short Party Dress"
        else:
            title = item['name']
            
        # Price fallback if empty
        if item['price']:
            price = float(item['price'])
        elif order == 43:
            price = 7000.0
        elif order == 72:
            price = 5000.0
        elif order == 76:
            price = 8000.0
        else:
            price = 5000.0
            
        # Category & Subcategory
        category = 'dresses'
        subcategory = item['type'] if item['type'] and item['type'].lower() != 'not specified' else 'Dresses'
        
        # Variants and sizes
        vars_list = parse_size_qty(item['size_qty'])
        sizes = [v['size'] for v in vars_list]
        total_stock = sum(v['qty'] for v in vars_list)
        colors = parse_colors(item['colors'], order)
        
        products_to_create[order] = {
            'order': order,
            'title': title,
            'price': price,
            'category': category,
            'subcategory': subcategory,
            'colors': colors,
            'sizes': sizes,
            'variants': vars_list,
            'total_stock': total_stock,
            'images': [img_name],
            'notes': item['notes']
        }
    else:
        # Secondary image (e.g. Nude 2 Dinner Dress.jpg for Order 20)
        products_to_create[order]['images'].append(img_name)

print(f"Total unique products to create: {len(products_to_create)}")
for order, p in sorted(products_to_create.items()):
    print(f"Order #{p['order']:2d} | Title: {p['title']:35s} | Price: {p['price']:7.1f} | Stock: {p['total_stock']:2d} | Images: {p['images']}")

