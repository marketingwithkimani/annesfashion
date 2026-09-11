async function testWorker() {
  console.log('=== TEST 1: CATALOG QUERY (/api/products) ===');
  const catRes = await fetch('https://client-api.marketingwithkimani.workers.dev/api/products');
  const catData = await catRes.json();
  console.log('Success:', catData.success, 'Count:', catData.count);
  const videoProd = catData.products.find(p => p.is_video || p.media_type === 'video');
  if (videoProd) {
    console.log('Video product found:', videoProd.id, '-', videoProd.title);
    console.log('  media_type:', videoProd.media_type);
    console.log('  is_video:', videoProd.is_video);
    console.log('  video_url:', videoProd.video_url);
    console.log('  poster_url:', videoProd.poster_url);
  }

  console.log('\n=== TEST 2: DETAIL QUERY (/api/products/121) ===');
  const detRes = await fetch('https://client-api.marketingwithkimani.workers.dev/api/products/121');
  const detData = await detRes.json();
  console.log('Success:', detData.success);
  console.log('Title:', detData.product.title);
  console.log('Media Type:', detData.product.media_type);
  console.log('Is Video:', detData.product.is_video);
  console.log('Video URL:', detData.product.video_url);
  console.log('Variants count:', detData.product.variants.length);
  console.log('Media gallery count:', detData.product.media.length);

  console.log('\n=== TEST 3: CUSTOMER ORDER PLACEMENT (/api/client/order) ===');
  const orderRes = await fetch('https://client-api.marketingwithkimani.workers.dev/api/client/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Test Customer',
      customer_phone: '+254711000999',
      customer_address: 'Kilimani, Nairobi',
      items: [
        { product_id: 116, title: 'Zora Heels', quantity: 1, unit_price: 2600 }
      ],
      payment_method: 'mpesa',
      notes: 'Automated verification test order'
    })
  });
  const orderData = await orderRes.json();
  console.log('Order result:', JSON.stringify(orderData, null, 2));

  console.log('\n=== TEST 4: SETTINGS QUERY (/api/settings) ===');
  const setRes = await fetch('https://client-api.marketingwithkimani.workers.dev/api/settings');
  const setData = await setRes.json();
  console.log('Settings:', setData);
}

testWorker().catch(console.error);
