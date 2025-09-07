// unlimited-brand-discovery.js - Discover ALL brands dynamically like restaurant script
require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');
const fetch = require('node-fetch');

const CONSUMER_KEY = process.env.FATSECRET_CLIENT_ID;
const CONSUMER_SECRET = process.env.FATSECRET_CLIENT_SECRET;

console.log('🔍 Unlimited Brand Discovery & Extractor');
console.log('📊 Dynamically discovering ALL available brands in FatSecret...\n');

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

// Get existing brands
function getExistingBrands() {
    const existingBrands = new Set();
    
    if (fs.existsSync('./brands')) {
        const brandFiles = fs.readdirSync('./brands');
        brandFiles.forEach(file => {
            if (file.endsWith('.json')) {
                const brandName = file.replace('.json', '').replace(/_/g, ' ');
                existingBrands.add(brandName.toLowerCase());
            }
        });
    }
    
    console.log(`📁 Found ${existingBrands.size} existing brand files`);
    return existingBrands;
}

// Dynamic brand discovery using broad search terms
async function discoverAllBrands() {
    console.log('🔍 Discovering ALL available brands dynamically...');
    
    const discoveryTerms = [
        // Start with broad food terms that will reveal brands
        'brand', 'organic', 'natural', 'fresh', 'premium', 'select',
        'choice', 'value', 'great', 'best', 'signature', 'market',
        'farm', 'house', 'company', 'foods', 'products', 'kitchens',
        
        // Food categories that often have branded items
        'cereal', 'bread', 'milk', 'cheese', 'yogurt', 'crackers',
        'cookies', 'chips', 'soda', 'juice', 'water', 'coffee',
        'tea', 'sauce', 'dressing', 'soup', 'pasta', 'rice',
        'beans', 'frozen', 'canned', 'snack', 'candy', 'chocolate',
        
        // Common brand indicators
        'co', 'inc', 'llc', 'corporation', 'company', 'bros',
        'brothers', 'family', 'original', 'classic', 'deluxe',
        'gourmet', 'artisan', 'craft', 'home', 'kitchen', 'farms',
        
        // Store brands and common names
        'private', 'selection', 'pantry', 'essentials', 'basics',
        'smart', 'simply', 'purely', 'wholly', 'truly', 'real'
    ];
    
    const discoveredBrands = new Set();
    let totalSearched = 0;
    
    for (const term of discoveryTerms) {
        if (requestCount >= MAX_DAILY_REQUESTS - 100) {
            console.log('⚠️ Approaching API limit, stopping discovery');
            break;
        }
        
        console.log(`\n🔍 Searching with term: "${term}"`);
        
        let pageNumber = 0;
        let hasMoreResults = true;
        
        while (hasMoreResults && pageNumber < 25 && requestCount < MAX_DAILY_REQUESTS - 50) {
            const result = await makeOAuth1Request('foods.search.v3', {
                search_expression: term,
                max_results: '50',
                page_number: pageNumber.toString()
            });
            
            if (result?.foods_search?.results?.food) {
                const foods = Array.isArray(result.foods_search.results.food) 
                    ? result.foods_search.results.food 
                    : [result.foods_search.results.food];
                
                // Extract unique brand names
                foods.forEach(food => {
                    const brandName = (food.brand_name || '').trim();
                    if (brandName && brandName !== '' && isValidBrand(brandName)) {
                        discoveredBrands.add(brandName);
                    }
                });
                
                const totalResults = parseInt(result.foods_search.total_results || '0');
                const currentCount = (pageNumber + 1) * 50;
                hasMoreResults = currentCount < totalResults && foods.length === 50;
                
                console.log(`   Page ${pageNumber + 1}: Found ${foods.length} items, discovered ${discoveredBrands.size} unique brands so far`);
                pageNumber++;
                totalSearched += foods.length;
            } else {
                hasMoreResults = false;
            }
        }
    }
    
    console.log(`\n📊 Discovery Summary:`);
    console.log(`   Total items searched: ${totalSearched}`);
    console.log(`   Unique brands discovered: ${discoveredBrands.size}`);
    
    return Array.from(discoveredBrands);
}

// Check if a brand name is valid
function isValidBrand(brandName) {
    const name = brandName.toLowerCase();
    
    // Skip generic terms that aren't real brands
    const skipTerms = ['generic', 'usda', 'brand', 'unknown', 'n/a', 'none'];
    if (skipTerms.some(term => name === term)) return false;
    
    // Skip single letters or very short names
    if (name.length < 2) return false;
    
    // Skip very long names (likely descriptions)
    if (name.length > 50) return false;
    
    // Must be a proper brand name
    const isProperName = brandName.charAt(0) === brandName.charAt(0).toUpperCase() && 
                         brandName.length >= 2 && brandName.length <= 50;
    
    return isProperName;
}

// Extract data from a discovered brand
async function extractDiscoveredBrand(brandName, maxPages = 50) {
    console.log(`\n🏷️ Extracting ${brandName}...`);
    
    let allFoods = [];
    let pageNumber = 0;
    let hasMoreResults = true;
    let totalResults = 0;
    
    while (hasMoreResults && pageNumber < maxPages && requestCount < MAX_DAILY_REQUESTS - 10) {
        const result = await makeOAuth1Request('foods.search.v3', {
            search_expression: brandName,
            max_results: '50',
            page_number: pageNumber.toString()
        });
        
        if (result?.foods_search?.results?.food) {
            const foods = Array.isArray(result.foods_search.results.food) 
                ? result.foods_search.results.food 
                : [result.foods_search.results.food];
            
            // Filter for exact brand matches
            const brandFoods = foods.filter(food => {
                const foodBrandName = (food.brand_name || '').toLowerCase();
                const searchBrand = brandName.toLowerCase();
                
                return (
                    foodBrandName === searchBrand ||
                    (foodBrandName.includes(searchBrand) && 
                     Math.abs(foodBrandName.length - searchBrand.length) <= 5)
                );
            });
            
            allFoods = allFoods.concat(brandFoods);
            
            totalResults = parseInt(result.foods_search.total_results || '0');
            const currentCount = (pageNumber + 1) * 50;
            hasMoreResults = currentCount < totalResults && foods.length === 50;
            
            if (pageNumber < 3 || brandFoods.length > 0) {
                console.log(`   Page ${pageNumber + 1}: +${brandFoods.length} items (${allFoods.length} total)`);
            }
            pageNumber++;
            
            // Stop early if no matches for several pages
            if (pageNumber > 5 && brandFoods.length === 0) {
                hasMoreResults = false;
            }
        } else {
            hasMoreResults = false;
        }
    }
    
    if (allFoods.length > 0) {
        const uniqueFoods = allFoods.filter((food, index, array) => 
            array.findIndex(f => f.food_id === food.food_id) === index
        );
        
        const fileName = brandName.toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_{2,}/g, '_')
            .replace(/^_|_$/g, '');
        
        const brandData = {
            brand_name: brandName,
            total_items: uniqueFoods.length,
            pages_extracted: pageNumber,
            total_search_results: totalResults,
            discovery_method: 'Dynamic brand discovery',
            last_updated: new Date().toISOString(),
            source: 'FatSecret Platform API (OAuth 1.0)',
            extraction_method: 'Discovered brand with comprehensive extraction',
            github_url: `https://raw.githubusercontent.com/YOUR_USERNAME/food-database/main/brands/${fileName}.json`,
            items: uniqueFoods.map(food => ({
                food_id: food.food_id,
                food_name: food.food_name,
                food_description: food.food_description,
                food_url: food.food_url,
                brand_name: food.brand_name || brandName,
                food_type: food.food_type
            }))
        };
        
        if (!fs.existsSync('./brands')) {
            fs.mkdirSync('./brands');
        }
        
        fs.writeFileSync(
            `./brands/${fileName}.json`,
            JSON.stringify(brandData, null, 2)
        );
        
        console.log(`   ✅ Saved ${uniqueFoods.length} items to brands/${fileName}.json`);
        return uniqueFoods.length;
    } else {
        console.log(`   ⚠️ No matching foods found for ${brandName}`);
        return 0;
    }
}

// Main unlimited brand extraction
async function runUnlimitedBrandExtraction() {
    console.log('='.repeat(80));
    console.log('🔍 UNLIMITED BRAND DISCOVERY & EXTRACTION');
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
    
    // Get existing brands
    const existingBrands = getExistingBrands();
    
    // Phase 1: Discover all available brands
    console.log('\n='.repeat(60));
    console.log('📍 PHASE 1: BRAND DISCOVERY');
    console.log('='.repeat(60));
    
    const discoveredBrands = await discoverAllBrands();
    
    // Filter out existing brands
    const newBrands = discoveredBrands.filter(brand => {
        const brandLower = brand.toLowerCase();
        const fileName = brand.toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_{2,}/g, '_')
            .replace(/^_|_$/g, '');
        
        return !existingBrands.has(brandLower) && 
               !existingBrands.has(fileName);
    });
    
    console.log(`\n📊 Discovery Results:`);
    console.log(`   Total discovered: ${discoveredBrands.length}`);
    console.log(`   Already have: ${discoveredBrands.length - newBrands.length}`);
    console.log(`   New to extract: ${newBrands.length}`);
    
    if (newBrands.length === 0) {
        console.log('\n✅ All discovered brands already extracted!');
        console.log('💡 Try running again later as new brands may be added to FatSecret');
        return;
    }
    
    // Show sample of new brands
    console.log('\n🏷️ Sample of new brands to extract:');
    newBrands.slice(0, 20).forEach((brand, index) => {
        console.log(`   ${index + 1}. ${brand}`);
    });
    if (newBrands.length > 20) {
        console.log(`   ... and ${newBrands.length - 20} more`);
    }
    
    // Phase 2: Extract data from new brands
    console.log('\n='.repeat(60));
    console.log('📍 PHASE 2: DATA EXTRACTION');
    console.log('='.repeat(60));
    
    let totalExtracted = 0;
    const extractionResults = {};
    let successfulCount = 0;
    
    for (let i = 0; i < newBrands.length; i++) {
        if (requestCount >= MAX_DAILY_REQUESTS - 50) {
            console.log(`⚠️ Approaching API limit at brand ${i + 1}/${newBrands.length}`);
            console.log(`🔄 ${newBrands.length - i} brands remaining for next run`);
            break;
        }
        
        const brand = newBrands[i];
        console.log(`\n[${i + 1}/${newBrands.length}] Processing: ${brand}`);
        
        const count = await extractDiscoveredBrand(brand, 30);
        extractionResults[brand] = count;
        totalExtracted += count;
        
        if (count > 0) {
            successfulCount++;
        }
        
        // Progress update every 20 brands
        if ((i + 1) % 20 === 0) {
            console.log(`\n📊 Progress: ${i + 1}/${newBrands.length} processed, ${totalExtracted} foods extracted, ${successfulCount} successful`);
        }
    }
    
    // Save discovery log
    const discoveryLog = {
        timestamp: new Date().toISOString(),
        total_discovered: discoveredBrands.length,
        new_brands: newBrands.length,
        successful_extractions: successfulCount,
        total_foods_extracted: totalExtracted,
        api_requests_used: requestCount,
        discovered_brands: discoveredBrands.sort(),
        extraction_results: extractionResults
    };
    
    fs.writeFileSync('./brand-discovery-log.json', JSON.stringify(discoveryLog, null, 2));
    
    console.log('\n' + '='.repeat(80));
    console.log('🎉 UNLIMITED BRAND EXTRACTION COMPLETED!');
    console.log('='.repeat(80));
    console.log(`📊 TOTAL NEW FOODS EXTRACTED: ${totalExtracted}`);
    console.log(`✅ Successful brands: ${successfulCount}`);
    console.log(`🔍 Total brands discovered: ${discoveredBrands.length}`);
    console.log(`🏷️ New brands processed: ${Math.min(newBrands.length, successfulCount)}`);
    console.log(`📁 New files created: ${successfulCount}`);
    console.log(`📈 Total brands now: ${existingBrands.size + successfulCount}`);
    console.log(`🌐 API requests used: ${requestCount}/${MAX_DAILY_REQUESTS}`);
    console.log(`⚡ Requests remaining: ${MAX_DAILY_REQUESTS - requestCount}`);
    
    // Show top extractions
    const successfulExtractions = Object.entries(extractionResults)
        .filter(([brand, count]) => count > 0)
        .sort(([,a], [,b]) => b - a);
    
    if (successfulExtractions.length > 0) {
        console.log('\n🏆 Top New Brand Extractions:');
        successfulExtractions.slice(0, 15).forEach(([brand, count]) => {
            console.log(`   - ${brand}: ${count} items`);
        });
        
        if (successfulExtractions.length > 15) {
            console.log(`   ... and ${successfulExtractions.length - 15} more successful extractions`);
        }
    }
    
    console.log('\n📋 Discovery log saved to: brand-discovery-log.json');
    console.log('🌐 Ready for GitHub upload!');
    console.log('\n💡 Run this script again to discover newly added brands in FatSecret');
}

// Run the unlimited extraction
runUnlimitedBrandExtraction();