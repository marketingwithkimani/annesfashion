<?php
$c = file_get_contents('js/products-data.js');
$start = strpos($c, '[');
$end = strrpos($c, ']');
$json = substr($c, $start, $end - $start + 1);
$products = json_decode($json, true);

$types = [];
foreach ($products as $p) {
    if (isset($p['type'])) {
        $types[$p['type']] = ($types[$p['type']] ?? 0) + 1;
    } else {
        $types['unknown'] = ($types['unknown'] ?? 0) + 1;
    }
}

echo "Total products in JSON: " . count($products) . "\n";
print_r($types);
