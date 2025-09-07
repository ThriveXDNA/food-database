// unlimited-comprehensive-discovery.js - Discover ALL foods dynamically like restaurant script
require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');
const fetch = require('node-fetch');

const CONSUMER_KEY = process.env.FATSECRET_CLIENT_ID;
const CONSUMER_SECRET = process.env.FATSECRET_CLIENT_SECRET;

console.log('🔍 Unlimited Comprehensive Food Discovery');
console.log('📊 Dynamically discovering ALL available foods, categories, and brands...\n');

// API compliance tracking
let requestCount = 0;
const MAX_DAILY_REQUESTS = 4200;
const MIN_DELAY = 1000;

// OAuth 1.0 signature generation
function generateOAuthSignature(method, url, params, consumerSecret, tokenSecret = '') {
    const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
        .join('&');
    
    const signatureBaseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
    const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
    
    return crypto.createHmac('sha1', signingKey).update(signatureBaseString).digest('base64');
}

async function makeOAuth1Request(method, params, retries = 2) {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            requestCount++;
            const timestamp = Math.floor(Date.now() / 1000);
            const nonce = crypto.randomBytes(16).toString('hex');
            
            const oauthParams = {
                oauth_consumer_key: CONSUMER_KEY,
                oauth_nonce: nonce,
                oauth_signature_method: 'HMAC-SHA1',
                oauth_timestamp: timestamp,
                oauth_version: '1.0',
                method: method,
                format: 'json',
                ...params
            };
            
            const signature = generateOAuthSignature(
                'POST',
                'https://platform.fatsecret.com/rest/server.api',
                oauthParams,
                CONSUMER_SECRET
            );
            
            oauthParams.oauth_signature = signature;
            
            const body = Object.keys(oauthParams)
                .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(oauthParams[key])}`)
                .join('&');
            
            const response = await fetch('https://platform.fatsecret.com/rest/server.api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: body
            });
            
            const data = await response.json();
            await new Promise(resolve => setTimeout(resolve, MIN_DELAY));
            return data;
        } catch (error) {
            console.error(`      Request error (attempt ${attempt + 1}):`, error.message);
            if (attempt < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
    }
    return null;
}

function createFolders() {
    const folders = ['categories', 'restaurants', 'brands', 'generic', 'alphabetical', 'discovered'];
    folders.forEach(folder => {
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder);
        }
    });
}

function getExistingData() {
    const existing = {
        categories: new Set(),
        restaurants: new Set(),
        brands: new Set(),
        foods: new Set()
    };
    
    // Check categories
    if (fs.existsSync('./categories')) {
        const files = fs.readdirSync('./categories');
        files.forEach(file => {
            if (file.endsWith('.json')) {
                const name = file.replace('.json', '').replace(/_/g, ' ');
                existing.categories.add(name.toLowerCase());
            }
        });
    }
    
    // Check restaurants
    if (fs.existsSync('./restaurants')) {
        const files = fs.readdirSync('./restaurants');
        files.forEach(file => {
            if (file.endsWith('.json')) {
                const name = file.replace('.json', '').replace(/_/g, ' ');
                existing.restaurants.add(name.toLowerCase());
            }
        });
    }
    
    // Check brands
    if (fs.existsSync('./brands')) {
        const files = fs.readdirSync('./brands');
        files.forEach(file => {
            if (file.endsWith('.json')) {
                const name = file.replace('.json', '').replace(/_/g, ' ');
                existing.brands.add(name.toLowerCase());
            }
        });
    }
    
    // Check discovered foods
    if (fs.existsSync('./discovered/all-foods.json')) {
        try {
            const data = JSON.parse(fs.readFileSync('./discovered/all-foods.json', 'utf8'));
            data.foods?.forEach(food => existing.foods.add(food.food_id));
        } catch (error) {
            console.log('Could not read existing foods file');
        }
    }
    
    console.log(`📁 Existing data:`);
    console.log(`   Categories: ${existing.categories.size}`);
    console.log(`   Restaurants: ${existing.restaurants.size}`);
    console.log(`   Brands: ${existing.brands.size}`);
    console.log(`   Foods: ${existing.foods.size}`);
    
    return existing;
}

// Dynamic discovery of everything using broad search approach
async function discoverEverything() {
    console.log('🔍 Discovering ALL available content dynamically...');
    
    const broadDiscoveryTerms = [
        // Ultra-broad terms to discover everything
        'food', 'eat', 'recipe', 'dish', 'meal', 'snack', 'drink', 'beverage',
        'fresh', 'organic', 'natural', 'frozen', 'canned', 'dried', 'cooked',
        'raw', 'baked', 'fried', 'grilled', 'steamed', 'boiled', 'roasted',
        
        // Meal categories
        'breakfast', 'lunch', 'dinner', 'dessert', 'appetizer', 'salad',
        'soup', 'sandwich', 'wrap', 'bowl', 'plate', 'side', 'main',
        
        // Nutritional terms
        'protein', 'carb', 'fat', 'fiber', 'vitamin', 'mineral', 'calorie',
        'healthy', 'diet', 'low', 'high', 'reduced', 'light', 'sugar',
        
        // Food groups
        'fruit', 'vegetable', 'meat', 'dairy', 'grain', 'nuts', 'seeds',
        'herbs', 'spices', 'oil', 'sauce', 'dressing', 'condiment',
        
        // International cuisines
        'american', 'chinese', 'italian', 'mexican', 'indian', 'thai',
        'japanese', 'french', 'greek', 'mediterranean', 'asian', 'european',
        'latin', 'african', 'middle', 'eastern', 'korean', 'vietnamese',
        
        // Common ingredients and foods
        'chicken', 'beef', 'pork', 'fish', 'turkey', 'lamb', 'cheese',
        'milk', 'egg', 'bread', 'rice', 'pasta', 'potato', 'tomato',
        'onion', 'garlic', 'pepper', 'salt', 'sugar', 'flour', 'butter',
        
        // Brand and restaurant indicators
        'brand', 'restaurant', 'fast', 'chain', 'store', 'market', 'company',
        'signature', 'select', 'choice', 'premium', 'gourmet', 'artisan',
        
        // Food preparation and types
        'homemade', 'instant', 'ready', 'prepared', 'convenience', 'deli',
        'bakery', 'pizzeria', 'cafe', 'bistro', 'grill', 'kitchen'
    ];
    
    const discoveredData = {
        categories: new Set(),
        brands: new Set(),
        restaurants: new Set(),
        allFoods: new Map() // Use Map to deduplicate by food_id
    };
    
    let totalSearched = 0;
    
    for (const term of broadDiscoveryTerms) {
        if (requestCount >= MAX_DAILY_REQUESTS - 100) {
            console.log('⚠️ Approaching API limit, stopping discovery');
            break;
        }
        
        console.log(`\n🔍 Discovering with term: "${term}"`);
        
        let pageNumber = 0;
        let hasMoreResults = true;
        
        while (hasMoreResults && pageNumber < 30 && requestCount < MAX_DAILY_REQUESTS - 50) {
            const result = await makeOAuth1Request('foods.search.v3', {
                search_expression: term,
                max_results: '50',
                page_number: pageNumber.toString()
            });
            
            if (result?.foods_search?.results?.food) {
                const foods = Array.isArray(result.foods_search.results.food) 
                    ? result.foods_search.results.food 
                    : [result.foods_search.results.food];
                
                foods.forEach(food => {
                    // Store all foods
                    discoveredData.allFoods.set(food.food_id, {
                        food_id: food.food_id,
                        food_name: food.food_name,
                        food_description: food.food_description,
                        food_url: food.food_url,
                        brand_name: food.brand_name || '',
                        food_type: food.food_type,
                        discovered_via: term
                    });
                    
                    // Extract brand names
                    const brandName = (food.brand_name || '').trim();
                    if (brandName && brandName !== '' && isValidBrand(brandName)) {
                        discoveredData.brands.add(brandName);
                    }
                    
                    // Extract potential restaurant names
                    if (isLikelyRestaurant(brandName)) {
                        discoveredData.restaurants.add(brandName);
                    }
                    
                    // Extract categories from food names
                    const foodName = (food.food_name || '').toLowerCase();
                    const words = foodName.split(/[\s,\-_()]+/).filter(word => 
                        word.length > 2 && 
                        !['the', 'and', 'with', 'for', 'per', 'cup', 'tbsp', 'tsp', 'oz', 'gram', 'piece'].includes(word)
                    );
                    
                    words.forEach(word => {
                        if (word.length >= 3 && word.length <= 20) {
                            discoveredData.categories.add(word);
                        }
                    });
                });
                
                const totalResults = parseInt(result.foods_search.total_results || '0');
                const currentCount = (pageNumber + 1) * 50;
                hasMoreResults = currentCount < totalResults && foods.length === 50;
                
                console.log(`   Page ${pageNumber + 1}: +${foods.length} foods | ${discoveredData.allFoods.size} total foods | ${discoveredData.brands.size} brands | ${discoveredData.restaurants.size} restaurants | ${discoveredData.categories.size} categories`);
                pageNumber++;
                totalSearched += foods.length;
            } else {
                hasMoreResults = false;
            }
        }
    }
    
    console.log(`\n📊 Discovery Summary:`);
    console.log(`   Total items searched: ${totalSearched}`);
    console.log(`   Unique foods discovered: ${discoveredData.allFoods.size}`);
    console.log(`   Categories discovered: ${discoveredData.categories.size}`);
    console.log(`   Brands discovered: ${discoveredData.brands.size}`);
    console.log(`   Restaurants discovered: ${discoveredData.restaurants.size}`);
    
    return discoveredData;
}

function isValidBrand(brandName) {
    const name = brandName.toLowerCase();
    const skipTerms = ['generic', 'usda', 'brand', 'unknown', 'n/a', 'none'];
    if (skipTerms.some(term => name === term)) return false;
    if (name.length < 2 || name.length > 50) return false;
    return brandName.charAt(0) === brandName.charAt(0).toUpperCase();
}

function isLikelyRestaurant(brandName) {
    if (!brandName || brandName.length < 3) return false;
    const name = brandName.toLowerCase();
    
    const restaurantIndicators = [
        'restaurant', 'grill', 'cafe', 'diner', 'kitchen', 'house', 'tavern',
        'bar', 'pub', 'bistro', 'eatery', 'cantina', 'steakhouse', 'pizzeria',
        'pizza', 'burger', 'taco', 'chicken', 'seafood', 'bbq', 'barbecue',
        'sandwich', 'sub', 'bagel', 'donut', 'coffee', 'buffet', 'express',
        'wings', 'ribs', 'steak', 'fresh', 'golden', 'royal', 'famous',
        'drive', 'inn', 'hut', 'king', 'queen', 'star', 'corner', 'place'
    ];
    
    return restaurantIndicators.some(indicator => name.includes(indicator));
}

// Extract foods by discovered categories
async function extractByDiscoveredCategories(discoveredCategories, existingData, maxCategories = 200) {
    console.log(`\n📂 Extracting foods by discovered categories (top ${maxCategories})...`);
    
    const categoryArray = Array.from(discoveredCategories);
    const topCategories = categoryArray.slice(0, maxCategories);
    const newCategories = topCategories.filter(cat => !existingData.categories.has(cat.toLowerCase()));
    
    console.log(`   Processing ${newCategories.length} new categories out of ${topCategories.length} top categories`);
    
    let totalExtracted = 0;
    const categoryResults = {};
    
    for (let i = 0; i < newCategories.length; i++) {
        if (requestCount >= MAX_DAILY_REQUESTS - 30) {
            console.log(`⚠️ Approaching API limit at category ${i + 1}/${newCategories.length}`);
            break;
        }
        
        const category = newCategories[i];
        const count = await extractDiscoveredCategory(category);
        categoryResults[category] = count;
        totalExtracted += count;
        
        if ((i + 1) % 25 === 0) {
            console.log(`   Progress: ${i + 1}/${newCategories.length} categories, ${totalExtracted} foods extracted`);
        }
    }
    
    return { totalExtracted, categoryResults };
}

async function extractDiscoveredCategory(categoryName) {
    const fileName = categoryName.toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_|_$/g, '');
    
    const result = await makeOAuth1Request('foods.search.v3', {
        search_expression: categoryName,
        max_results: '50',
        page_number: '0'
    });
    
    if (result?.foods_search?.results?.food) {
        const foods = Array.isArray(result.foods_search.results.food) 
            ? result.foods_search.results.food 
            : [result.foods_search.results.food];
        
        const categoryData = {
            category: categoryName,
            total_items: foods.length,
            discovery_method: 'Dynamic category discovery',
            last_updated: new Date().toISOString(),
            source: 'FatSecret Platform API (OAuth 1.0)',
            items: foods.map(food => ({
                food_id: food.food_id,
                food_name: food.food_name,
                food_description: food.food_description,
                food_url: food.food_url,
                brand_name: food.brand_name || '',
                food_type: food.food_type
            }))
        };
        
        fs.writeFileSync(
            `./categories/${fileName}.json`,
            JSON.stringify(categoryData, null, 2)
        );
        
        return foods.length;
    }
    
    return 0;
}

// Extract foods by discovered brands
async function extractByDiscoveredBrands(discoveredBrands, existingData, maxBrands = 150) {
    console.log(`\n🏷️ Extracting foods by discovered brands (top ${maxBrands})...`);
    
    const brandArray = Array.from(discoveredBrands);
    const topBrands = brandArray.slice(0, maxBrands);
    const newBrands = topBrands.filter(brand => !existingData.brands.has(brand.toLowerCase()));
    
    console.log(`   Processing ${newBrands.length} new brands out of ${topBrands.length} top brands`);
    
    let totalExtracted = 0;
    const brandResults = {};
    
    for (let i = 0; i < newBrands.length; i++) {
        if (requestCount >= MAX_DAILY_REQUESTS - 30) {
            console.log(`⚠️ Approaching API limit at brand ${i + 1}/${newBrands.length}`);
            break;
        }
        
        const brand = newBrands[i];
        const count = await extractDiscoveredBrand(brand);
        brandResults[brand] = count;
        totalExtracted += count;
        
        if ((i + 1) % 20 === 0) {
            console.log(`   Progress: ${i + 1}/${newBrands.length} brands, ${totalExtracted} foods extracted`);
        }
    }
    
    return { totalExtracted, brandResults };
}

async function extractDiscoveredBrand(brandName) {
    const fileName = brandName.toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_|_$/g, '');
    
    const result = await makeOAuth1Request('foods.search.v3', {
        search_expression: brandName,
        max_results: '50',
        page_number: '0'
    });
    
    if (result?.foods_search?.results?.food) {
        const foods = Array.isArray(result.foods_search.results.food) 
            ? result.foods_search.results.food 
            : [result.foods_search.results.food];
        
        // Filter for exact brand matches
        const brandFoods = foods.filter(food => {
            const foodBrandName = (food.brand_name || '').toLowerCase();
            const searchBrand = brandName.toLowerCase();
            return foodBrandName === searchBrand || 
                   (foodBrandName.includes(searchBrand) && 
                    Math.abs(foodBrandName.length - searchBrand.length) <= 5);
        });
        
        if (brandFoods.length > 0) {
            const brandData = {
                brand_name: brandName,
                total_items: brandFoods.length,
                discovery_method: 'Dynamic brand discovery',
                last_updated: new Date().toISOString(),
                source: 'FatSecret Platform API (OAuth 1.0)',
                items: brandFoods.map(food => ({
                    food_id: food.food_id,
                    food_name: food.food_name,
                    food_description: food.food_description,
                    food_url: food.food_url,
                    brand_name: food.brand_name || brandName,
                    food_type: food.food_type
                }))
            };
            
            fs.writeFileSync(
                `./brands/${fileName}.json`,
                JSON.stringify(brandData, null, 2)
            );
            
            return brandFoods.length;
        }
    }
    
    return 0;
}

// Extract foods by discovered restaurants
async function extractByDiscoveredRestaurants(discoveredRestaurants, existingData, maxRestaurants = 100) {
    console.log(`\n🍔 Extracting foods by discovered restaurants (top ${maxRestaurants})...`);
    
    const restaurantArray = Array.from(discoveredRestaurants);
    const topRestaurants = restaurantArray.slice(0, maxRestaurants);
    const newRestaurants = topRestaurants.filter(restaurant => !existingData.restaurants.has(restaurant.toLowerCase()));
    
    console.log(`   Processing ${newRestaurants.length} new restaurants out of ${topRestaurants.length} top restaurants`);
    
    let totalExtracted = 0;
    const restaurantResults = {};
    
    for (let i = 0; i < newRestaurants.length; i++) {
        if (requestCount >= MAX_DAILY_REQUESTS - 30) {
            console.log(`⚠️ Approaching API limit at restaurant ${i + 1}/${newRestaurants.length}`);
            break;
        }
        
        const restaurant = newRestaurants[i];
        const count = await extractDiscoveredRestaurant(restaurant);
        restaurantResults[restaurant] = count;
        totalExtracted += count;
        
        if ((i + 1) % 15 === 0) {
            console.log(`   Progress: ${i + 1}/${newRestaurants.length} restaurants, ${totalExtracted} foods extracted`);
        }
    }
    
    return { totalExtracted, restaurantResults };
}

async function extractDiscoveredRestaurant(restaurantName) {
    const fileName = restaurantName.toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_|_$/g, '');
    
    const result = await makeOAuth1Request('foods.search.v3', {
        search_expression: restaurantName,
        max_results: '50',
        page_number: '0'
    });
    
    if (result?.foods_search?.results?.food) {
        const foods = Array.isArray(result.foods_search.results.food) 
            ? result.foods_search.results.food 
            : [result.foods_search.results.food];
        
        // Filter for restaurant matches
        const restaurantFoods = foods.filter(food => {
            const brandName = (food.brand_name || '').toLowerCase();
            const foodName = (food.food_name || '').toLowerCase();
            const restaurantLower = restaurantName.toLowerCase();
            
            return brandName === restaurantLower ||
                   brandName.includes(restaurantLower) ||
                   restaurantLower.includes(brandName) ||
                   foodName.includes(restaurantLower);
        });
        
        if (restaurantFoods.length > 0) {
            const restaurantData = {
                restaurant: restaurantName,
                total_items: restaurantFoods.length,
                discovery_method: 'Dynamic restaurant discovery',
                last_updated: new Date().toISOString(),
                source: 'FatSecret Platform API (OAuth 1.0)',
                items: restaurantFoods.map(food => ({
                    food_id: food.food_id,
                    food_name: food.food_name,
                    food_description: food.food_description,
                    food_url: food.food_url,
                    brand_name: food.brand_name || restaurantName,
                    food_type: food.food_type
                }))
            };
            
            fs.writeFileSync(
                `./restaurants/${fileName}.json`,
                JSON.stringify(restaurantData, null, 2)
            );
            
            return restaurantFoods.length;
        }
    }
    
    return 0;
}

// Main unlimited comprehensive extraction
async function runUnlimitedComprehensiveExtraction() {
    console.log('='.repeat(80));
    console.log('🔍 UNLIMITED COMPREHENSIVE DISCOVERY & EXTRACTION');
    console.log('='.repeat(80));
    
    createFolders();
    
    // Test authentication
    console.log('🔐 Testing authentication...');
    const testResult = await makeOAuth1Request('foods.search.v3', {
        search_expression: 'apple',
        max_results: '1'
    });
    
    if (!testResult?.foods_search) {
        console.log('❌ Authentication failed');
        return;
    }
    console.log('✅ Authentication successful');
    
    const existingData = getExistingData();
    
    // Phase 1: Comprehensive discovery
    console.log('\n='.repeat(60));
    console.log('📍 PHASE 1: COMPREHENSIVE DISCOVERY');
    console.log('='.repeat(60));
    
    const discoveredData = await discoverEverything();
    
    // Phase 2: Extract by discovered categories
    console.log('\n='.repeat(60));
    console.log('📍 PHASE 2: CATEGORY EXTRACTION');
    console.log('='.repeat(60));
    
    const categoryResults = await extractByDiscoveredCategories(discoveredData.categories, existingData);
    
    // Phase 3: Extract by discovered brands
    console.log('\n='.repeat(60));
    console.log('📍 PHASE 3: BRAND EXTRACTION');
    console.log('='.repeat(60));
    
    const brandResults = await extractByDiscoveredBrands(discoveredData.brands, existingData);
    
    // Phase 4: Extract by discovered restaurants
    console.log('\n='.repeat(60));
    console.log('📍 PHASE 4: RESTAURANT EXTRACTION');
    console.log('='.repeat(60));
    
    const restaurantResults = await extractByDiscoveredRestaurants(discoveredData.restaurants, existingData);
    
    // Save comprehensive results
    const allFoodsArray = Array.from(discoveredData.allFoods.values());
    const newFoods = allFoodsArray.filter(food => !existingData.foods.has(food.food_id));
    
    const comprehensiveData = {
        timestamp: new Date().toISOString(),
        total_foods_discovered: allFoodsArray.length,
        new_foods_discovered: newFoods.length,
        categories_discovered: discoveredData.categories.size,
        brands_discovered: discoveredData.brands.size,
        restaurants_discovered: discoveredData.restaurants.size,
        api_requests_used: requestCount,
        discovery_method: 'Unlimited comprehensive discovery',
        source: 'FatSecret Platform API (OAuth 1.0)',
        extraction_results: {
            categories: categoryResults.categoryResults,
            brands: brandResults.brandResults,
            restaurants: restaurantResults.restaurantResults
        },
        foods: allFoodsArray,
        discovered_categories: Array.from(discoveredData.categories).sort(),
        discovered_brands: Array.from(discoveredData.brands).sort(),
        discovered_restaurants: Array.from(discoveredData.restaurants).sort()
    };
    
    fs.writeFileSync('./discovered/all-foods.json', JSON.stringify(comprehensiveData, null, 2));
    
    const totalExtracted = categoryResults.totalExtracted + brandResults.totalExtracted + restaurantResults.totalExtracted;
    
    console.log('\n' + '='.repeat(80));
    console.log('🎉 UNLIMITED COMPREHENSIVE EXTRACTION COMPLETED!');
    console.log('='.repeat(80));
    console.log(`📊 TOTAL FOODS DISCOVERED: ${allFoodsArray.length}`);
    console.log(`🆕 NEW FOODS DISCOVERED: ${newFoods.length}`);
    console.log(`📂 CATEGORIES DISCOVERED: ${discoveredData.categories.size}`);
    console.log(`🏷️ BRANDS DISCOVERED: ${discoveredData.brands.size}`);
    console.log(`🍔 RESTAURANTS DISCOVERED: ${discoveredData.restaurants.size}`);
    console.log(`📁 FILES EXTRACTED: ${totalExtracted} foods across all categories`);
    console.log(`🌐 API REQUESTS USED: ${requestCount}/${MAX_DAILY_REQUESTS}`);
    console.log(`⚡ REQUESTS REMAINING: ${MAX_DAILY_REQUESTS - requestCount}`);
    
    console.log('\n📊 Extraction Breakdown:');
    console.log(`   Categories extracted: ${categoryResults.totalExtracted} foods`);
    console.log(`   Brands extracted: ${brandResults.totalExtracted} foods`);
    console.log(`   Restaurants extracted: ${restaurantResults.totalExtracted} foods`);
    
    console.log('\n📋 Complete discovery data saved to: discovered/all-foods.json');
    console.log('🌐 Ready for maximum food database coverage!');
    console.log('\n💡 Run this script again to discover more as FatSecret database grows');
}

// Run the unlimited comprehensive extraction
runUnlimitedComprehensiveExtraction();