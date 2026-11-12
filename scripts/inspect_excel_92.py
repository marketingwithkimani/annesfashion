import zipfile
import xml.etree.ElementTree as ET
import os

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

header = rows[0]
print('Header:', header)
print('Total rows:', len(rows) - 1)
for idx, r in enumerate(rows[1:], 1):
    print(f"Row {idx:2d} | Order: {r.get('A', ''):2s} | Name: {r.get('B', ''):35s} | Type: {r.get('C', ''):25s} | Colors: {r.get('D', ''):30s} | SizeQty: {r.get('E', ''):35s} | Price: {r.get('F', ''):6s} | Img: {r.get('G', '')}")

