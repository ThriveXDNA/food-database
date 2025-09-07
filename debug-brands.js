// debug-brands.js
require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');
const fetch = require('node-fetch');

// [OAuth function here - same as before]

async function debugBrands() {
    const result = await makeOAuth1Request('food_brands.get.v2', {});
    
    console.log('Raw API response structure:');
    console.log(JSON.stringify(result, null, 2).substring(0, 1000));
    
    if (result?.food_brands?.food_brand) {
        const brands = Array.isArray(result.food_brands.food_brand) 
            ? result.food_brands.food_brand 
            : [result.food_brands.food_brand];
        
        console.log('\nFirst 3 brands structure:');
        brands.slice(0, 3).forEach((brand, i) => {
            console.log(`Brand ${i + 1}:`, JSON.stringify(brand, null, 2));
        });
    }
}