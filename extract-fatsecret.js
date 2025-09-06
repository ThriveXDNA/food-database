// extract-fatsecret.js
const fs = require('fs');
const fetch = require('node-fetch');

// Your FatSecret credentials
const CLIENT_ID = 'your_client_id';
const CLIENT_SECRET = 'your_client_secret';

// Step 1: Get OAuth Token
async function getToken() {
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  
  const response = await fetch('https://oauth.fatsecret.com/connect/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials&scope=premier'
  });
  
  const data = await response.json();
  return data.access_token;
}

// Step 2: Extract Restaurant Data
async function extractRestaurant(token, brandName, fileName) {
  console.log(`Extracting ${brandName}...`);
  
  const response = await fetch('https://platform.fatsecret.com/rest/server.api', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `method=foods.search.v3&search_expression=${brandName}&brand_type=restaurant&max_results=500&format=json`
  });
  
  const data = await response.json();
  
  // Save to file
  fs.writeFileSync(
    `./restaurants/${fileName}.json`,
    JSON.stringify(data.foods_search.results.food, null, 2)
  );
  
  console.log(`✓ Saved ${fileName}.json with ${data.foods_search.results.food.length} items`);
}

// Step 3: Extract Category Data
async function extractCategory(token, categoryId, fileName) {
  console.log(`Extracting category ${categoryId}...`);
  
  const response = await fetch('https://platform.fatsecret.com/rest/server.api', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `method=foods.search.v3&food_category_id=${categoryId}&food_type=Generic&max_results=500&format=json`
  });
  
  const data = await response.json();
  
  fs.writeFileSync(
    `./categories/${fileName}.json`,
    JSON.stringify(data.foods_search.results.food, null, 2)
  );
  
  console.log(`✓ Saved ${fileName}.json`);
}

// Step 4: Main extraction function
async function extractAllData() {
  // Create folders
  ['restaurants', 'categories', 'brands', 'diets', 'common'].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  });
  
  const token = await getToken();
  
  // Extract restaurants
  const restaurants = [
    { name: 'McDonalds', file: 'mcdonalds' },
    { name: 'Subway', file: 'subway' },
    { name: 'Burger King', file: 'burger_king' },
    { name: 'Starbucks', file: 'starbucks' },
    { name: 'Chipotle', file: 'chipotle' }
  ];
  
  for (const restaurant of restaurants) {
    await extractRestaurant(token, restaurant.name, restaurant.file);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
  }
  
  // Extract categories (FatSecret category IDs)
  const categories = [
    { id: 1, file: 'beans_legumes' },
    { id: 2, file: 'beverages' },
    { id: 3, file: 'grains_cereals' },
    { id: 7, file: 'dairy_eggs' },
    { id: 10, file: 'fruits' },
    { id: 11, file: 'meat_seafood' },
    { id: 16, file: 'vegetables' }
  ];
  
  for (const category of categories) {
    await extractCategory(token, category.id, category.file);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Create manifest file
  const manifest = {
    version: "1.0",
    last_updated: new Date().toISOString(),
    total_foods: 0,
    files: {
      restaurants: restaurants.map(r => r.file + '.json'),
      categories: categories.map(c => c.file + '.json')
    }
  };
  
  fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 2));
  console.log('✓ Extraction complete!');
}

// Run it
extractAllData();
