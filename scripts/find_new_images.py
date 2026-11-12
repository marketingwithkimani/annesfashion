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

# User overrides for 86-90:
# 86 Red Short Dinner Dress Red 6 1 KSh 1,000
# 87 Floral Dinner Dress Floral 6 1 KSh 1,000
# 88 White & Orange Evening Dress White with orange 6 1 KSh 2,000
# 89 Black Short Dinner Dress Black 8 1 KSh 3,000
# 90 Floral Occasion Dress Floral 6 1 KSh 2,000
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

# Read already uploaded from products_data.json
with open('scripts/products_data.json') as f:
    prev_uploaded = json.load(f)

# Load existing images in products/
files = os.listdir('products')
current_images = [f for f in files if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))]

print(f"Total current images in products/: {len(current_images)}")
print(f"Total items previously uploaded in products_data.json: {len(prev_uploaded)}")

# Check which image files were in prev_uploaded
prev_images = set()
for order_str, p in prev_uploaded.items():
    for img in p['images']:
        prev_images.add(img)

new_images = [img for img in current_images if img not in prev_images]
print(f"New images found in products/ ({len(new_images)}):")
for img in sorted(new_images):
    print("  NEW:", img)

