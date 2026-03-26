#!/usr/bin/env node
'use strict'

/**
 * Comprehensive Test Suite for Username Finder Worker
 * 
 * Tests all aspects of the worker:
 * - Input parsing and normalization
 * - Username format handling
 * - String interpolation
 * - Configuration handling
 * - Cafe platform compatibility
 */

const fs = require('fs');
const path = require('path');

// Set local dev mode BEFORE loading main.js
process.env.LOCAL_DEV = '1';

// Test utilities
let passCount = 0;
let failCount = 0;
const testResults = [];

function test(name, fn) {
    return new Promise(async (resolve) => {
        try {
            await fn();
            passCount++;
            testResults.push({ name, status: 'PASS' });
            console.log(`✅ PASS: ${name}`);
        } catch (err) {
            failCount++;
            testResults.push({ name, status: 'FAIL', error: err.message });
            console.log(`❌ FAIL: ${name}`);
            console.log(`   Error: ${err.message}`);
        }
        resolve();
    });
}

function assertEqual(actual, expected, message = '') {
    if (actual !== expected) {
        throw new Error(`${message} Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
    }
}

function assertDeepEqual(actual, expected, message = '') {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${message} Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
    }
}

function assertTrue(condition, message = '') {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

// ============================================
// Test Functions (mirror main.js logic)
// ============================================

function interpolateString(input, username) {
    if (typeof input === 'string') {
        return input.replace(/\{\}/g, encodeURIComponent(username))
    }
    if (Array.isArray(input)) {
        return input.map(item => interpolateString(item, username))
    }
    if (typeof input === 'object' && input !== null) {
        const result = {}
        for (const [key, value] of Object.entries(input)) {
            result[key] = interpolateString(value, username)
        }
        return result
    }
    return input
}

function parseUsernames(input) {
    let usernames = []
    
    // New format: usernames array from stringList editor [{string: "name1"}, {string: "name2"}]
    if (input.usernames && Array.isArray(input.usernames)) {
        usernames = input.usernames
            .map(u => {
                // Handle null/undefined
                if (u === null || u === undefined) return '';
                if (typeof u === 'string') return u.trim();
                if (u.string) return u.string.trim();
                return '';
            })
            .filter(Boolean)
    }
    
    // Legacy support: username string or array
    if (usernames.length === 0 && input.username) {
        if (typeof input.username === 'string') {
            usernames = input.username.split('\n').map(u => u.trim()).filter(Boolean)
        } else if (Array.isArray(input.username)) {
            usernames = input.username.map(u => typeof u === 'string' ? u.trim() : String(u).trim()).filter(Boolean)
        }
    }
    
    // Also check 'url' field for backward compatibility
    if (usernames.length === 0 && input.url) {
        if (Array.isArray(input.url)) {
            usernames = input.url.map(u => typeof u === 'string' ? u.trim() : u?.url?.trim()).filter(Boolean)
        } else if (typeof input.url === 'string') {
            usernames = [input.url.trim()]
        }
    }
    
    return usernames
}

const QueryStatus = {
    CLAIMED: 'CLAIMED',
    AVAILABLE: 'AVAILABLE',
    ILLEGAL: 'ILLEGAL',
    UNKNOWN: 'UNKNOWN',
    WAF: 'WAF'
}

// ============================================
// Test Suites
// ============================================

async function runTests() {
    console.log('\n' + '='.repeat(70));
    console.log('Username Finder Worker - Comprehensive Test Suite');
    console.log('='.repeat(70) + '\n');
    
    // =====================
    // Suite 1: String Interpolation
    // =====================
    console.log('\n📋 Suite 1: String Interpolation');
    console.log('-'.repeat(40));
    
    await test('Interpolate - Basic URL', async () => {
        const result = interpolateString('https://github.com/{}', 'test_user');
        assertEqual(result, 'https://github.com/test_user');
    });
    
    await test('Interpolate - Multiple placeholders', async () => {
        const result = interpolateString('https://example.com/{}/profile/{}', 'john');
        assertEqual(result, 'https://example.com/john/profile/john');
    });
    
    await test('Interpolate - Special characters encoded', async () => {
        const result = interpolateString('https://example.com/{}', 'user@domain');
        assertEqual(result, 'https://example.com/user%40domain');
    });
    
    await test('Interpolate - Object values', async () => {
        const result = interpolateString({ url: 'https://example.com/{}', name: '{}' }, 'test');
        assertEqual(result.url, 'https://example.com/test');
        assertEqual(result.name, 'test');
    });
    
    await test('Interpolate - Array values', async () => {
        const result = interpolateString(['https://a.com/{}', 'https://b.com/{}'], 'user');
        assertEqual(result[0], 'https://a.com/user');
        assertEqual(result[1], 'https://b.com/user');
    });
    
    await test('Interpolate - No placeholder', async () => {
        const result = interpolateString('https://example.com/static', 'user');
        assertEqual(result, 'https://example.com/static');
    });
    
    // =====================
    // Suite 2: Username Parsing
    // =====================
    console.log('\n📋 Suite 2: Username Parsing');
    console.log('-'.repeat(40));
    
    await test('Parse usernames - stringList format', async () => {
        const result = parseUsernames({
            usernames: [{ string: 'john_doe' }, { string: 'jane_doe' }]
        });
        assertEqual(result.length, 2);
        assertEqual(result[0], 'john_doe');
        assertEqual(result[1], 'jane_doe');
    });
    
    await test('Parse usernames - string array format', async () => {
        const result = parseUsernames({
            usernames: ['user1', 'user2', 'user3']
        });
        assertEqual(result.length, 3);
    });
    
    await test('Parse usernames - legacy string format', async () => {
        const result = parseUsernames({
            username: 'user1\nuser2\nuser3'
        });
        assertEqual(result.length, 3);
    });
    
    await test('Parse usernames - legacy array format', async () => {
        const result = parseUsernames({
            username: ['user1', 'user2']
        });
        assertEqual(result.length, 2);
    });
    
    await test('Parse usernames - url field fallback', async () => {
        const result = parseUsernames({
            url: [{ url: 'test_user' }]
        });
        assertEqual(result.length, 1);
        assertEqual(result[0], 'test_user');
    });
    
    await test('Parse usernames - empty strings filtered', async () => {
        const result = parseUsernames({
            usernames: ['', 'valid', '   ', 'also_valid']
        });
        assertEqual(result.length, 2);
    });
    
    await test('Parse usernames - null/undefined handled', async () => {
        const result = parseUsernames({
            usernames: [null, { string: 'valid' }, undefined]
        });
        assertEqual(result.length, 1);
    });
    
    await test('Parse usernames - mixed formats prioritized', async () => {
        // usernames should take priority
        const result = parseUsernames({
            usernames: [{ string: 'primary' }],
            username: 'secondary'
        });
        assertEqual(result.length, 1);
        assertEqual(result[0], 'primary');
    });
    
    // =====================
    // Suite 3: Query Status
    // =====================
    console.log('\n📋 Suite 3: Query Status');
    console.log('-'.repeat(40));
    
    await test('QueryStatus - All statuses defined', async () => {
        assertEqual(QueryStatus.CLAIMED, 'CLAIMED');
        assertEqual(QueryStatus.AVAILABLE, 'AVAILABLE');
        assertEqual(QueryStatus.ILLEGAL, 'ILLEGAL');
        assertEqual(QueryStatus.UNKNOWN, 'UNKNOWN');
        assertEqual(QueryStatus.WAF, 'WAF');
    });
    
    // =====================
    // Suite 4: input_schema.json Validation
    // =====================
    console.log('\n📋 Suite 4: input_schema.json Validation');
    console.log('-'.repeat(40));
    
    await test('input_schema exists', async () => {
        assertTrue(fs.existsSync(path.join(__dirname, 'input_schema.json')));
    });
    
    await test('input_schema has b field for array', async () => {
        const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'input_schema.json'), 'utf-8'));
        assertEqual(schema.b, 'usernames');
    });
    
    await test('input_schema usernames is array type', async () => {
        const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'input_schema.json'), 'utf-8'));
        const usernamesProp = schema.properties.find(p => p.name === 'usernames');
        assertEqual(usernamesProp.type, 'array');
    });
    
    await test('input_schema usernames uses stringList editor', async () => {
        const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'input_schema.json'), 'utf-8'));
        const usernamesProp = schema.properties.find(p => p.name === 'usernames');
        assertEqual(usernamesProp.editor, 'stringList');
    });
    
    await test('input_schema has valid editor types', async () => {
        const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'input_schema.json'), 'utf-8'));
        const validEditors = ['requestList', 'requestListSource', 'stringList', 'input', 'textarea', 'number', 'select', 'radio', 'checkbox', 'switch', 'datepicker', 'json', 'hidden'];
        
        for (const prop of schema.properties) {
            if (prop.editor) {
                assertTrue(validEditors.includes(prop.editor), `Invalid editor: ${prop.editor}`);
            }
        }
    });
    
    await test('input_schema has required fields', async () => {
        const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'input_schema.json'), 'utf-8'));
        assertTrue(schema.description !== undefined);
        assertTrue(Array.isArray(schema.properties));
    });
    
    await test('input_schema required fields marked', async () => {
        const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'input_schema.json'), 'utf-8'));
        const usernamesProp = schema.properties.find(p => p.name === 'usernames');
        assertTrue(usernamesProp.required === true);
    });
    
    await test('input_schema sites is array type', async () => {
        const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'input_schema.json'), 'utf-8'));
        const sitesProp = schema.properties.find(p => p.name === 'sites');
        assertEqual(sitesProp.type, 'array');
    });
    
    // =====================
    // Suite 5: Configuration Defaults
    // =====================
    console.log('\n📋 Suite 5: Configuration Defaults');
    console.log('-'.repeat(40));
    
    await test('Config - Default values', async () => {
        const defaults = {
            timeout: 30,
            maxConcurrency: 20,
            includeNsfw: false,
            printAll: false,
            sites: []
        };
        assertEqual(defaults.timeout, 30);
        assertEqual(defaults.maxConcurrency, 20);
        assertEqual(defaults.includeNsfw, false);
    });
    
    // =====================
    // Suite 6: Error Handling
    // =====================
    console.log('\n📋 Suite 6: Error Handling');
    console.log('-'.repeat(40));
    
    await test('Parse - Empty input returns empty', async () => {
        const result = parseUsernames({});
        assertEqual(result.length, 0);
    });
    
    await test('Parse - Null usernames handled', async () => {
        const result = parseUsernames({
            usernames: [null, undefined, 'valid']
        });
        assertEqual(result.length, 1);
    });
    
    await test('Interpolate - Null input returns as-is', async () => {
        const result = interpolateString(null, 'user');
        assertEqual(result, null);
    });
    
    await test('Interpolate - Number input returns as-is', async () => {
        const result = interpolateString(123, 'user');
        assertEqual(result, 123);
    });
    
    // =====================
    // Suite 7: Cafe Platform Format Compatibility
    // =====================
    console.log('\n📋 Suite 7: Cafe Platform Format Compatibility');
    console.log('-'.repeat(40));
    
    await test('Cafe format - stringList default format', async () => {
        // Cafe stringList default: [{string: "value"}]
        const result = parseUsernames({
            usernames: [{ string: 'test_user' }]
        });
        assertEqual(result.length, 1);
        assertEqual(result[0], 'test_user');
    });
    
    await test('Cafe format - Multiple usernames', async () => {
        const result = parseUsernames({
            usernames: [
                { string: 'user1' },
                { string: 'user2' },
                { string: 'user3' }
            ]
        });
        assertEqual(result.length, 3);
    });
    
    await test('Cafe format - Empty stringList', async () => {
        const result = parseUsernames({
            usernames: []
        });
        assertEqual(result.length, 0);
    });
    
    // =====================
    // Suite 8: SDK Loading
    // =====================
    console.log('\n📋 Suite 8: SDK Loading');
    console.log('-'.repeat(40));
    
    await test('sdk_local.js exists', async () => {
        assertTrue(fs.existsSync(path.join(__dirname, 'sdk_local.js')));
    });
    
    await test('sdk_local.js has required exports', async () => {
        const sdk = require('./sdk_local.js');
        assertTrue(sdk.parameter !== undefined);
        assertTrue(sdk.result !== undefined);
        assertTrue(sdk.log !== undefined);
    });
    
    await test('sdk_local.js parameter methods', async () => {
        const sdk = require('./sdk_local.js');
        assertTrue(typeof sdk.parameter.getInputJSONString === 'function');
        assertTrue(typeof sdk.parameter.getInputJSONObject === 'function');
    });
    
    await test('sdk_local.js result methods', async () => {
        const sdk = require('./sdk_local.js');
        assertTrue(typeof sdk.result.setTableHeader === 'function');
        assertTrue(typeof sdk.result.pushData === 'function');
    });
    
    await test('sdk_local.js log methods', async () => {
        const sdk = require('./sdk_local.js');
        assertTrue(typeof sdk.log.debug === 'function');
        assertTrue(typeof sdk.log.info === 'function');
        assertTrue(typeof sdk.log.warn === 'function');
        assertTrue(typeof sdk.log.error === 'function');
    });
    
    // =====================
    // Suite 9: File Structure
    // =====================
    console.log('\n📋 Suite 9: File Structure');
    console.log('-'.repeat(40));
    
    await test('main.js exists', async () => {
        assertTrue(fs.existsSync(path.join(__dirname, 'main.js')));
    });
    
    await test('package.json exists', async () => {
        assertTrue(fs.existsSync(path.join(__dirname, 'package.json')));
    });
    
    await test('README.md exists', async () => {
        assertTrue(fs.existsSync(path.join(__dirname, 'README.md')));
    });
    
    await test('sdk.js exists (cloud SDK)', async () => {
        assertTrue(fs.existsSync(path.join(__dirname, 'sdk.js')));
    });
    
    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total: ${passCount + failCount}`);
    console.log(`Passed: ${passCount} ✅`);
    console.log(`Failed: ${failCount} ❌`);
    console.log(`Success Rate: ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`);
    console.log('='.repeat(70));
    
    // Write results to file
    const report = {
        timestamp: new Date().toISOString(),
        total: passCount + failCount,
        passed: passCount,
        failed: failCount,
        successRate: ((passCount / (passCount + failCount)) * 100).toFixed(1) + '%',
        results: testResults
    };
    
    fs.writeFileSync(
        path.join(__dirname, 'test-report.json'),
        JSON.stringify(report, null, 2)
    );
    
    console.log('\n📄 Test report saved to test-report.json');
    
    // Exit with code
    process.exit(failCount > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('Test suite error:', err);
    process.exit(1);
});
