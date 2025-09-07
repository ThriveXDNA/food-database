// fixed-brand-extract.js
require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');
const fetch = require('node-fetch');

const CONSUMER_KEY = process.env.FATSECRET_CLIENT_ID;
const CONSUMER_SECRET = process.env.FATSECRET_CLIENT_SECRET;

// Add timeout to OAuth requests
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
            
            // Add 30 second timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            
            const response = await fetch('https://platform.fatsecret.com/rest/server.api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: body,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`Request error (attempt ${attempt + 1}):`, error.message);
            if (attempt < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }
    return null;
}

// Rest of OAuth signature function...
function generateOAuthSignature(method, url, params, consumerSecret, tokenSecret = '') {
    const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
        .join('&');
    
    const signatureBaseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
    const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
    
    return crypto.createHmac('sha1', signingKey).update(signatureBaseString).digest('base64');
}

async function getAllBrandsFixed() {
    console.log('Getting ALL brands with timeout handling...');
    
    const result = await makeOAuth1Request('food_brands.get.v2', {});
    
    if (!result) {
        console.log('API call failed or timed out');
        return [];
    }
    
    console.log('Raw response keys:', Object.keys(result));
    
    // Handle different possible response structures
    let brands = [];
    if (result.food_brands?.food_brand) {
        brands = Array.isArray(result.food_brands.food_brand) 
            ? result.food_brands.food_brand 
            : [result.food_brands.food_brand];
    } else if (result.brands) {
        brands = Array.isArray(result.brands) ? result.brands : [result.brands];
    } else if (result.food_brand) {
        brands = Array.isArray(result.food_brand) ? result.food_brand : [result.food_brand];
    }
    
    console.log(`Found ${brands.length} raw brands`);
    
    // Log first brand structure
    if (brands.length > 0) {
        console.log('First brand structure:', JSON.stringify(brands[0], null, 2));
    }
    
    return brands;
}

getAllBrandsFixed().then(brands => {
    console.log(`Final result: ${brands.length} brands`);
    process.exit(0);
}).catch(error => {
    console.error('Error:', error);
    process.exit(1);
});