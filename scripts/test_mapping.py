import os
import zipfile
import xml.etree.ElementTree as ET

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

# Mapping: image_filename -> order_id (or None if multi-image)
# Notice Nude 2 Dinner Dress.jpg is secondary image for order 20!
mapping = {
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
    'Nude 2 Dinner Dress.jpg': 20, # secondary image for 20
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

files = os.listdir('products')
images = [f for f in files if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))]

unmapped = [img for img in images if img not in mapping]
print("Unmapped images:", unmapped)
print(f"Total mapped images: {len(mapping)}")

# Print mapped details
for img, order in sorted(mapping.items(), key=lambda x: (x[1], x[0])):
    it = excel_items[order]
    print(f"Img: {img:50s} -> Order #{order:2d}: {it['name']:35s} | Price: {it['price']:6s} | Sizes: {it['size_qty']}")

