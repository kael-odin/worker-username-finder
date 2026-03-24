#!/usr/bin/env node
'use strict'

const cafesdk = {
    parameter: {
        getInputJSONObject: async () => ({
            username: 'test_user',
            timeout: 10,
            maxConcurrency: 5,
            includeNsfw: false,
            printAll: false,
            sites: ['GitHub', 'Twitter', 'Instagram']
        })
    },
    log: {
        debug: (msg) => console.log(`[DEBUG] ${msg}`),
        info: (msg) => console.log(`[INFO] ${msg}`),
        warn: (msg) => console.log(`[WARN] ${msg}`),
        error: (msg) => console.log(`[ERROR] ${msg}`)
    },
    result: {
        pushData: (data) => console.log(`[RESULT] ${JSON.stringify(data)}`),
        setTableHeader: (headers) => console.log(`[HEADERS] ${JSON.stringify(headers)}`)
    }
}

// Mock fetch for site data
const originalFetchJson = global.fetchJson
global.fetchJson = async (url) => {
    console.log(`[MOCK] Fetching site data from: ${url}`)
    // Return mock site data
    return {
        "GitHub": {
            "urlMain": "https://github.com/{}",
            "urlProbe": "https://github.com/{}",
            "usernameUnclaimed": ["is not available", "doesn't exist"],
            "usernameClaimed": ["is available"],
            "errorCode": 404,
            "errorType": ["status_code", "message"]
        },
        "Twitter": {
            "urlMain": "https://twitter.com/{}",
            "urlProbe": "https://twitter.com/{}",
            "usernameUnclaimed": ["not found", "doesn't exist"],
            "usernameClaimed": ["available"],
            "errorCode": 404,
            "errorType": ["status_code", "message"]
        },
        "Instagram": {
            "urlMain": "https://www.instagram.com/{}",
            "urlProbe": "https://www.instagram.com/{}",
            "usernameUnclaimed": ["isn't available", "doesn't exist"],
            "usernameClaimed": ["is available"],
            "errorType": ["status_code"]
        }
    }
}

// Run the main function
require('./main.js')
