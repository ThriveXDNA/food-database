// unlimited-restaurant-extract.js - Discover and extract ALL restaurants dynamically
require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');
const fetch = require('node-fetch');

const CONSUMER_KEY = process.env.FATSECRET_CLIENT_ID;
const CONSUMER_SECRET = process.env.FATSECRET_CLIENT_SECRET;

console.log('🔍 Unlimited Restaurant Discovery & Extractor');
console.log('📊 Dynamically discovering ALL available restaurants in FatSecret...\n');

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

// Get existing restaurants
function getExistingRestaurants() {
    const existingRestaurants = new Set();
    
    if (fs.existsSync('./restaurants')) {
        const restaurantFiles = fs.readdirSync('./restaurants');
        restaurantFiles.forEach(file => {
            if (file.endsWith('.json')) {
                const restaurantName = file.replace('.json', '').replace(/_/g, ' ');
                existingRestaurants.add(restaurantName.toLowerCase());
            }
        });
    }
    
    console.log(`📁 Found ${existingRestaurants.size} existing restaurant files`);
    return existingRestaurants;
}

// Discover restaurants using search terms
async function discoverRestaurants() {
    console.log('🔍 Discovering ALL available restaurants...');
    
    const discoveryTerms = [
        // Restaurant types
        'restaurant', 'grill', 'cafe', 'diner', 'kitchen', 'house', 'tavern',
        'bar', 'pub', 'bistro', 'eatery', 'cantina', 'steakhouse',
        
        // Food types that often have restaurant chains
        'pizza', 'burger', 'taco', 'chicken', 'seafood', 'bbq', 'barbecue',
        'sandwich', 'sub', 'hoagie', 'bagel', 'donut', 'coffee', 'buffet',
        'wings', 'ribs', 'steak', 'pasta', 'chinese', 'mexican', 'italian',
        'thai', 'indian', 'japanese', 'sushi',
        
        // Common restaurant words
        'menu', 'fresh', 'express', 'deluxe', 'premium', 'original',
        'famous', 'golden', 'royal', 'king', 'queen', 'star', 'corner'
    ];
    
    const discoveredRestaurants = new Set();
    let totalSearched = 0;
    
    for (const term of discoveryTerms) {
        console.log(`\n🔍 Searching with term: "${term}"`);
        
        let pageNumber = 0;
        let hasMoreResults = true;
        
        while (hasMoreResults && pageNumber < 20) { // Limit to 20 pages per term
            const result = await makeOAuth1Request('foods.search.v3', {
                search_expression: term,
                max_results: '50',
                page_number: pageNumber.toString()
            });
            
            if (result?.foods_search?.results?.food) {
                const foods = Array.isArray(result.foods_search.results.food) 
                    ? result.foods_search.results.food 
                    : [result.foods_search.results.food];
                
                // Extract unique brand names that look like restaurants
                foods.forEach(food => {
                    const brandName = (food.brand_name || '').trim();
                    if (brandName && brandName !== '' && isLikelyRestaurant(brandName)) {
                        discoveredRestaurants.add(brandName);
                    }
                });
                
                const totalResults = parseInt(result.foods_search.total_results || '0');
                const currentCount = (pageNumber + 1) * 50;
                hasMoreResults = currentCount < totalResults && foods.length === 50;
                
                console.log(`   Page ${pageNumber + 1}: Found ${foods.length} items, discovered ${discoveredRestaurants.size} unique restaurants so far`);
                pageNumber++;
                totalSearched += foods.length;
                
                await new Promise(resolve => setTimeout(resolve, 400));
            } else {
                hasMoreResults = false;
            }
        }
    }
    
    console.log(`\n📊 Discovery Summary:`);
    console.log(`   Total items searched: ${totalSearched}`);
    console.log(`   Unique restaurants discovered: ${discoveredRestaurants.size}`);
    
    return Array.from(discoveredRestaurants);
}

// Check if a brand name looks like a restaurant
function isLikelyRestaurant(brandName) {
    const name = brandName.toLowerCase();
    
    // Skip generic terms that aren't restaurants
    const skipTerms = ['generic', 'brand', 'usda', 'fresh', 'organic', 'natural'];
    if (skipTerms.some(term => name === term)) return false;
    
    // Skip single letters or very short names
    if (name.length < 3) return false;
    
    // Restaurant indicators
    const restaurantIndicators = [
        'restaurant', 'grill', 'cafe', 'diner', 'kitchen', 'house', 'tavern',
        'bar', 'pub', 'bistro', 'eatery', 'cantina', 'steakhouse', 'pizzeria',
        'pizza', 'burger', 'taco', 'chicken', 'seafood', 'bbq', 'barbecue',
        'sandwich', 'sub', 'bagel', 'donut', 'coffee', 'buffet', 'express',
        'wings', 'ribs', 'steak', 'fresh', 'golden', 'royal', 'famous',
        'drive', 'inn', 'hut', 'king', 'queen', 'star', 'corner', 'place'
    ];
    
    // Check if it contains restaurant indicators
    const hasIndicator = restaurantIndicators.some(indicator => name.includes(indicator));
    
    // Check if it's a proper name (starts with capital and has reasonable length)
    const isProperName = brandName.charAt(0) === brandName.charAt(0).toUpperCase() && 
                         brandName.length >= 4 && brandName.length <= 50;
    
    return hasIndicator || isProperName;
}

// Extract data from a discovered restaurant
async function extractDiscoveredRestaurant(restaurantName, maxPages = 100) {
    console.log(`\n🍔 Extracting ${restaurantName}...`);
    
    let allFoods = [];
    let pageNumber = 0;
    let hasMoreResults = true;
    let totalResults = 0;
    
    while (hasMoreResults && pageNumber < maxPages) {
        const result = await makeOAuth1Request('foods.search.v3', {
            search_expression: restaurantName,
            max_results: '50',
            page_number: pageNumber.toString()
        });
        
        if (result?.foods_search?.results?.food) {
            const foods = Array.isArray(result.foods_search.results.food) 
                ? result.foods_search.results.food 
                : [result.foods_search.results.food];
            
            // Very permissive filtering - keep items that match the restaurant
            const restaurantFoods = foods.filter(food => {
                const brandName = (food.brand_name || '').toLowerCase();
                const foodName = (food.food_name || '').toLowerCase();
                const restaurantLower = restaurantName.toLowerCase();
                
                return (
                    brandName === restaurantLower ||
                    brandName.includes(restaurantLower) ||
                    restaurantLower.includes(brandName) ||
                    foodName.includes(restaurantLower) ||
                    (brandName === '' && foods.length <= 100) // Keep unbranded if small result set
                );
            });
            
            allFoods = allFoods.concat(restaurantFoods);
            
            totalResults = parseInt(result.foods_search.total_results || '0');
            const currentCount = (pageNumber + 1) * 50;
            hasMoreResults = currentCount < totalResults && foods.length === 50;
            
            if (pageNumber < 5 || restaurantFoods.length > 0) {
                console.log(`   Page ${pageNumber + 1}: +${restaurantFoods.length} items (${allFoods.length} total)`);
            }
            pageNumber++;
            
            // Stop early if no matches for several pages
            if (pageNumber > 5 && restaurantFoods.length === 0) {
                hasMoreResults = false;
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
        } else {
            hasMoreResults = false;
        }
    }
    
    if (allFoods.length > 0) {
        const uniqueFoods = allFoods.filter((food, index, array) => 
            array.findIndex(f => f.food_id === food.food_id) === index
        );
        
        const fileName = restaurantName.toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_{2,}/g, '_')
            .replace(/^_|_$/g, '');
        
        const restaurantData = {
            restaurant: restaurantName,
            total_items: uniqueFoods.length,
            pages_extracted: pageNumber,
            total_search_results: totalResults,
            discovery_method: 'Dynamic restaurant discovery',
            last_updated: new Date().toISOString(),
            source: 'FatSecret Platform API (OAuth 1.0)',
            extraction_method: 'Discovered restaurant with comprehensive extraction',
            github_url: `https://raw.githubusercontent.com/YOUR_USERNAME/food-database/main/restaurants/${fileName}.json`,
            items: uniqueFoods.map(food => ({
                food_id: food.food_id,
                food_name: food.food_name,
                food_description: food.food_description,
                food_url: food.food_url,
                brand_name: food.brand_name || restaurantName,
                food_type: food.food_type
            }))
        };
        
        if (!fs.existsSync('./restaurants')) {
            fs.mkdirSync('./restaurants');
        }
        
        fs.writeFileSync(
            `./restaurants/${fileName}.json`,
            JSON.stringify(restaurantData, null, 2)
        );
        
        console.log(`   ✅ Saved ${uniqueFoods.length} items to restaurants/${fileName}.json`);
        return uniqueFoods.length;
    } else {
        console.log(`   ⚠️ No matching foods found for ${restaurantName}`);
        return 0;
    }
}

// Main unlimited restaurant extraction
async function runUnlimitedRestaurantExtraction() {
    console.log('='.repeat(80));
    console.log('🔍 UNLIMITED RESTAURANT DISCOVERY & EXTRACTION');
    console.log('='.repeat(80));
    
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
    
    // Get existing restaurants
    const existingRestaurants = getExistingRestaurants();
    
    // Phase 1: Discover all available restaurants
    console.log('\n='.repeat(60));
    console.log('📍 PHASE 1: RESTAURANT DISCOVERY');
    console.log('='.repeat(60));
    
    const discoveredRestaurants = await discoverRestaurants();
    
    // Filter out existing restaurants
    const newRestaurants = discoveredRestaurants.filter(restaurant => {
        const restaurantLower = restaurant.toLowerCase();
        const fileName = restaurant.toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_{2,}/g, '_')
            .replace(/^_|_$/g, '');
        
        return !existingRestaurants.has(restaurantLower) && 
               !existingRestaurants.has(fileName);
    });
    
    console.log(`\n📊 Discovery Results:`);
    console.log(`   Total discovered: ${discoveredRestaurants.length}`);
    console.log(`   Already have: ${discoveredRestaurants.length - newRestaurants.length}`);
    console.log(`   New to extract: ${newRestaurants.length}`);
    
    if (newRestaurants.length === 0) {
        console.log('\n✅ All discovered restaurants already extracted!');
        console.log('💡 Try running again later as new restaurants may be added to FatSecret');
        return;
    }
    
    // Show sample of new restaurants
    console.log('\n🍔 Sample of new restaurants to extract:');
    newRestaurants.slice(0, 20).forEach((restaurant, index) => {
        console.log(`   ${index + 1}. ${restaurant}`);
    });
    if (newRestaurants.length > 20) {
        console.log(`   ... and ${newRestaurants.length - 20} more`);
    }
    
    // Phase 2: Extract data from new restaurants
    console.log('\n='.repeat(60));
    console.log('📍 PHASE 2: DATA EXTRACTION');
    console.log('='.repeat(60));
    
    let totalExtracted = 0;
    const extractionResults = {};
    let successfulCount = 0;
    
    for (let i = 0; i < newRestaurants.length; i++) {
        const restaurant = newRestaurants[i];
        console.log(`\n[${i + 1}/${newRestaurants.length}] Processing: ${restaurant}`);
        
        const count = await extractDiscoveredRestaurant(restaurant, 50);
        extractionResults[restaurant] = count;
        totalExtracted += count;
        
        if (count > 0) {
            successfulCount++;
        }
        
        // Progress update every 10 restaurants
        if ((i + 1) % 10 === 0) {
            console.log(`\n📊 Progress: ${i + 1}/${newRestaurants.length} processed, ${totalExtracted} foods extracted, ${successfulCount} successful`);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 700));
    }
    
    // Save discovery log
    const discoveryLog = {
        timestamp: new Date().toISOString(),
        total_discovered: discoveredRestaurants.length,
        new_restaurants: newRestaurants.length,
        successful_extractions: successfulCount,
        total_foods_extracted: totalExtracted,
        discovered_restaurants: discoveredRestaurants.sort(),
        extraction_results: extractionResults
    };
    
    fs.writeFileSync('./restaurant-discovery-log.json', JSON.stringify(discoveryLog, null, 2));
    
    console.log('\n' + '='.repeat(80));
    console.log('🎉 UNLIMITED RESTAURANT EXTRACTION COMPLETED!');
    console.log('='.repeat(80));
    console.log(`📊 TOTAL NEW FOODS EXTRACTED: ${totalExtracted}`);
    console.log(`✅ Successful restaurants: ${successfulCount}`);
    console.log(`🔍 Total restaurants discovered: ${discoveredRestaurants.length}`);
    console.log(`🍔 New restaurants processed: ${newRestaurants.length}`);
    console.log(`📁 New files created: ${successfulCount}`);
    console.log(`📈 Total restaurants now: ${existingRestaurants.size + successfulCount}`);
    
    // Show top extractions
    const successfulExtractions = Object.entries(extractionResults)
        .filter(([restaurant, count]) => count > 0)
        .sort(([,a], [,b]) => b - a);
    
    if (successfulExtractions.length > 0) {
        console.log('\n🏆 Top New Restaurant Extractions:');
        successfulExtractions.slice(0, 15).forEach(([restaurant, count]) => {
            console.log(`   - ${restaurant}: ${count} items`);
        });
        
        if (successfulExtractions.length > 15) {
            console.log(`   ... and ${successfulExtractions.length - 15} more successful extractions`);
        }
    }
    
    console.log('\n📋 Discovery log saved to: restaurant-discovery-log.json');
    console.log('🌐 Ready for GitHub upload!');
    console.log('\n💡 Run this script again to discover newly added restaurants in FatSecret');
}

// Run the unlimited extraction
runUnlimitedRestaurantExtraction();