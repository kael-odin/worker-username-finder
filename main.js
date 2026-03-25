#!/usr/bin/env node
'use strict'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const cafesdk = require('./sdk')
const https = require('https')
const http = require('http')
const { URL } = require('url')

// Global proxy agent for cloud environment
let proxyDispatcher = null
let fetchFn = null

// Initialize proxy for Cafe cloud environment
async function initProxy() {
    const proxyAuth = process.env.PROXY_AUTH
    const isLocalDev = process.env.LOCAL_DEV === '1' || !proxyAuth
    
    if (isLocalDev) {
        return null // No proxy in local development
    }
    
    // Cafe cloud environment: use platform proxy via undici
    try {
        const undici = await import('undici')
        const { ProxyAgent, setGlobalDispatcher, fetch } = undici
        
        const [username, password] = proxyAuth.split(':')
        const proxyUrl = `http://${username}:${password}@proxy-inner.cafescraper.com:6000`
        
        proxyDispatcher = new ProxyAgent(proxyUrl)
        setGlobalDispatcher(proxyDispatcher)
        fetchFn = fetch
        
        console.log('[INFO] Cloud proxy initialized via undici')
        return true
    } catch (e) {
        console.warn('[WARN] Failed to initialize undici proxy, falling back to direct requests:', e.message)
        return null
    }
}

const MANIFEST_URL = 'https://raw.githubusercontent.com/sherlock-project/sherlock/master/sherlock_project/resources/data.json'

const DEFAULT_CONFIG = {
    timeout: 30,
    maxConcurrency: 20,
    includeNsfw: false,
    printAll: false,
    sites: []
}

const QueryStatus = {
    CLAIMED: 'CLAIMED',
    AVAILABLE: 'AVAILABLE',
    ILLEGAL: 'ILLEGAL',
    UNKNOWN: 'UNKNOWN',
    WAF: 'WAF'
}

const WAF_SIGNATURES = [
    'loading-spinner{visibility:hidden}',
    '<span id="challenge-error-text">',
    'AwsWafIntegration.forceRefreshToken',
    '{return l.onPageView}}),Object.defineProperty(r,"perimeterxIdentifiers"'
]

// Check if we're in Cafe cloud environment
const isCloudEnv = !!process.env.PROXY_AUTH && process.env.LOCAL_DEV !== '1'

async function fetchJson(url) {
    // Use fetch with proxy if available (cloud environment)
    if (fetchFn && isCloudEnv) {
        try {
            const response = await fetchFn(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(30000)
            })
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
            }
            return await response.json()
        } catch (e) {
            // Fall back to native http
            console.warn(`[WARN] Fetch failed for ${url}, falling back: ${e.message}`)
        }
    }
    
    // Native http/https fallback (local development)
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url)
        const client = parsedUrl.protocol === 'https:' ? https : http
        
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            },
            timeout: 30000
        }

        const req = client.request(options, (res) => {
            let data = ''
            res.on('data', chunk => data += chunk)
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data))
                } catch (e) {
                    reject(new Error(`Failed to parse JSON: ${e.message}`))
                }
            })
        })

        req.on('error', reject)
        req.on('timeout', () => {
            req.destroy()
            reject(new Error('Request timeout'))
        })
        req.end()
    })
}

async function httpRequest(url, options = {}) {
    // Use fetch with proxy if available (cloud environment)
    if (fetchFn && isCloudEnv) {
        try {
            const response = await fetchFn(url, {
                method: options.method || 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:129.0) Gecko/20100101 Firefox/129.0',
                    ...options.headers
                },
                body: options.body ? JSON.stringify(options.body) : undefined,
                redirect: options.allowRedirects === false ? 'manual' : 'follow',
                signal: AbortSignal.timeout((options.timeout || 30) * 1000)
            })
            
            return {
                status: response.status,
                headers: Object.fromEntries(response.headers.entries()),
                text: await response.text(),
                url: response.url
            }
        } catch (e) {
            // Fall back to native http
            console.warn(`[WARN] Fetch failed for ${url}: ${e.message}`)
        }
    }
    
    // Native http/https fallback (local development)
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url)
        const client = parsedUrl.protocol === 'https:' ? https : http
        
        const reqOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:129.0) Gecko/20100101 Firefox/129.0',
                ...options.headers
            },
            timeout: (options.timeout || 30) * 1000
        }

        const req = client.request(reqOptions, (res) => {
            let data = ''
            const chunks = []
            
            res.on('data', chunk => {
                data += chunk
                chunks.push(chunk)
            })
            
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    text: data,
                    url: res.headers.location || url
                })
            })
        })

        req.on('error', reject)
        req.on('timeout', () => {
            req.destroy()
            reject(new Error('Request timeout'))
        })
        
        if (options.body) {
            req.write(JSON.stringify(options.body))
        }
        req.end()
    })
}

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

function checkUsername(username, siteName, siteInfo, config) {
    return new Promise(async (resolve) => {
        const result = {
            site: siteName,
            urlMain: siteInfo.urlMain,
            urlUser: '',
            status: QueryStatus.UNKNOWN,
            httpStatus: null,
            error: null
        }

        try {
            const regexCheck = siteInfo.regexCheck
            if (regexCheck) {
                const regex = new RegExp(regexCheck)
                if (!regex.test(username)) {
                    result.status = QueryStatus.ILLEGAL
                    return resolve(result)
                }
            }

            const url = interpolateString(siteInfo.url, username)
            result.urlUser = url

            const urlProbe = siteInfo.urlProbe ? interpolateString(siteInfo.urlProbe, username) : url
            const errorType = Array.isArray(siteInfo.errorType) ? siteInfo.errorType : [siteInfo.errorType]
            
            const method = siteInfo.request_method || (errorType.includes('status_code') ? 'HEAD' : 'GET')
            const allowRedirects = !errorType.includes('response_url')

            const requestOptions = {
                method,
                timeout: config.timeout,
                headers: siteInfo.headers || {}
            }

            if (siteInfo.request_payload) {
                requestOptions.body = interpolateString(siteInfo.request_payload, username)
                requestOptions.headers['Content-Type'] = 'application/json'
            }

            const response = await httpRequest(urlProbe, requestOptions)
            result.httpStatus = response.status

            // Check for WAF
            const responseText = response.text || ''
            if (WAF_SIGNATURES.some(sig => responseText.includes(sig))) {
                result.status = QueryStatus.WAF
                return resolve(result)
            }

            // Check by error type
            if (errorType.includes('message')) {
                const errorMsgs = Array.isArray(siteInfo.errorMsg) ? siteInfo.errorMsg : [siteInfo.errorMsg]
                let errorFound = false
                for (const errMsg of errorMsgs) {
                    if (responseText.includes(errMsg)) {
                        errorFound = true
                        break
                    }
                }
                result.status = errorFound ? QueryStatus.AVAILABLE : QueryStatus.CLAIMED
            }

            if (errorType.includes('status_code') && result.status !== QueryStatus.AVAILABLE) {
                const errorCodes = Array.isArray(siteInfo.errorCode) ? siteInfo.errorCode : [siteInfo.errorCode]
                if (errorCodes.includes(response.status) || response.status >= 300 || response.status < 200) {
                    result.status = QueryStatus.AVAILABLE
                } else {
                    result.status = QueryStatus.CLAIMED
                }
            }

            if (errorType.includes('response_url') && result.status !== QueryStatus.AVAILABLE) {
                if (response.status >= 200 && response.status < 300) {
                    result.status = QueryStatus.CLAIMED
                } else {
                    result.status = QueryStatus.AVAILABLE
                }
            }

        } catch (error) {
            result.error = error.message
            result.status = QueryStatus.UNKNOWN
        }

        resolve(result)
    })
}

async function run() {
    try {
        await cafesdk.log.info('Username Finder Worker started')
        
        // Initialize proxy for cloud environment
        if (isCloudEnv) {
            await cafesdk.log.info('Initializing cloud proxy...')
            const proxyReady = await initProxy()
            if (proxyReady) {
                await cafesdk.log.info('Cloud proxy initialized successfully')
            } else {
                await cafesdk.log.warn('Cloud proxy initialization failed - using direct requests (may fail in cloud)')
            }
        }

        const input = await cafesdk.parameter.getInputJSONObject()
        await cafesdk.log.debug(`Input: ${JSON.stringify(input)}`)

        const config = { ...DEFAULT_CONFIG, ...input }
        
        // Parse usernames - supports both new 'usernames' array and legacy 'username' string
        let usernames = []
        
        // New format: usernames array from stringList editor [{string: "name1"}, {string: "name2"}]
        if (input.usernames && Array.isArray(input.usernames)) {
            usernames = input.usernames
                .map(u => typeof u === 'string' ? u.trim() : (u.string || '').trim())
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
                usernames = input.url.map(u => typeof u === 'string' ? u.trim() : u.url?.trim()).filter(Boolean)
            } else if (typeof input.url === 'string') {
                usernames = [input.url.trim()]
            }
        }

        if (usernames.length === 0) {
            throw new Error('No usernames provided')
        }

        await cafesdk.log.info(`Checking ${usernames.length} username(s) across social networks`)

        // Load site data
        await cafesdk.log.info('Loading site data...')
        let siteData = await fetchJson(MANIFEST_URL)
        delete siteData['$schema']

        // Filter NSFW sites if needed
        if (!config.includeNsfw) {
            const filtered = {}
            for (const [name, info] of Object.entries(siteData)) {
                if (!info.isNSFW) {
                    filtered[name] = info
                }
            }
            siteData = filtered
        }

        // Filter to specific sites if requested
        if (config.sites && config.sites.length > 0) {
            const filtered = {}
            for (const site of config.sites) {
                if (siteData[site]) {
                    filtered[site] = siteData[site]
                }
            }
            siteData = filtered
        }

        const siteNames = Object.keys(siteData)
        await cafesdk.log.info(`Loaded ${siteNames.length} sites to check`)

        // Set table header
        const headers = [
            { label: 'Username', key: 'username', format: 'text' },
            { label: 'Site', key: 'site', format: 'text' },
            { label: 'Status', key: 'status', format: 'text' },
            { label: 'URL', key: 'urlUser', format: 'text' },
            { label: 'HTTP Status', key: 'httpStatus', format: 'integer' }
        ]
        await cafesdk.result.setTableHeader(headers)

        // Process each username
        for (const username of usernames) {
            await cafesdk.log.info(`Checking username: ${username}`)
            
            const results = []
            const siteEntries = Object.entries(siteData)
            const concurrency = Math.min(config.maxConcurrency, siteEntries.length)
            
            // Process in batches
            for (let i = 0; i < siteEntries.length; i += concurrency) {
                const batch = siteEntries.slice(i, i + concurrency)
                const batchResults = await Promise.all(
                    batch.map(([siteName, siteInfo]) => 
                        checkUsername(username, siteName, siteInfo, config)
                    )
                )
                
                for (const result of batchResults) {
                    if (config.printAll || result.status === QueryStatus.CLAIMED) {
                        results.push({
                            username,
                            ...result
                        })
                        await cafesdk.result.pushData({
                            username,
                            ...result
                        })
                    }
                }
            }

            const claimed = results.filter(r => r.status === QueryStatus.CLAIMED).length
            await cafesdk.log.info(`Username "${username}": Found on ${claimed} sites`)
        }

        await cafesdk.log.info('Username search completed')

    } catch (error) {
        await cafesdk.log.error(`Error: ${error.message}`)
        await cafesdk.result.pushData({
            error: error.message,
            status: 'error'
        })
        throw error
    }
}

run()
