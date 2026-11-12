import os
import zipfile
import xml.etree.ElementTree as ET
import re

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

files = os.listdir('products')
images = [f for f in files if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))]

def normalize(s):
    s = s.lower()
    s = re.sub(r'[\s_&/()\-]+', ' ', s)
    return s.strip()

print("MAPPING IMAGES TO EXCEL:")
for img in sorted(images):
    base = os.path.splitext(img)[0]
    norm_base = normalize(base)
    
    # Specific rules from user:
    # 1. "orange unprinted short party dress. I renamed it Mint short party dress"
    # Row 1 is "Orange & Printed Short Party Dress", img is "Orange & Printed Short Party Dress.jpg"
    # Mint Short Party Dress.jpg -> maps to Order 1!
    
    # 2. "for the nude flow dresses, you'll notice they are quite a few. They are a few. So if you see nude dinner dress, nude two dinner dress, it means it's the same dress, but it's the same product. It just has two different images to represent it."
    # Nude Dinner Dress.jpg and Nude 2 Dinner Dress.jpg -> both map to Order 20 ("Nude Dinner Dress")!
    
    # 3. "Luminous green party dress. There is one, which is there, and there is also a different one, which is Luminous green party dress 25. That is the main, the number 25 from the product inventory."
    # Luminous Green Party Dress 25.jpg -> Order 25!
    # Luminous Green Party Dress.jpg -> Order 22!
    
    # 4. Check trailing numbers in image names:
    # White Occasion Dress 74.jpg -> Order 74
    # Black Party Dress 72.jpg -> Order 72
    # White Party Dress 24.jpg -> Order 24 (or check name)
    # White Party Dress 36.jpg -> Order 36
    # White Party Dress 41.jpg -> Order 41
    
    # Let's find matches
    candidates = []
    # Check if a number is in filename
    num_match = re.search(r'\b(\d+)\b', base)
    if num_match:
        num = int(num_match.group(1))
        if num in excel_items:
            candidates.append(('num_exact', num, excel_items[num]))
            
    for order, it in excel_items.items():
        if normalize(it['name']) == norm_base or normalize(it['img'].replace('.jpg','')) == norm_base:
            candidates.append(('name_exact', order, it))
        elif norm_base in normalize(it['name']) or normalize(it['name']) in norm_base:
            candidates.append(('name_partial', order, it))
            
    print(f"File: {img:50s} -> Candidates: {[(c[0], c[1], c[2]['name']) for c in candidates[:3]]}")
