#!/usr/bin/env node

/**
 * Verification script to check backend setup
 * Run: node verify-setup.js
 */

import fs from 'fs'
import path from 'path'

const checks = []

function check(name, fn) {
  try {
    fn()
    checks.push({ name, status: '✅', error: null })
  } catch (error) {
    checks.push({ name, status: '❌', error: error.message })
  }
}

// Check files exist
check('api-server.js exists', () => {
  if (!fs.existsSync('./api-server.js')) throw new Error('Not found')
})

check('.env.example exists', () => {
  if (!fs.existsSync('./.env.example')) throw new Error('Not found')
})

check('package.json exists', () => {
  if (!fs.existsSync('./package.json')) throw new Error('Not found')
})

check('src/main.tsx exists', () => {
  if (!fs.existsSync('./src/main.tsx')) throw new Error('Not found')
})

check('src/router.tsx exists', () => {
  if (!fs.existsSync('./src/router.tsx')) throw new Error('Not found')
})

// Check dependencies
check('Dependencies in package.json', () => {
  const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'))
  const required = ['express', 'cors', 'drizzle-orm', 'postgres', 'dotenv']
  required.forEach(dep => {
    if (!pkg.dependencies[dep]) throw new Error(`Missing ${dep}`)
  })
})

// Check scripts
check('npm scripts configured', () => {
  const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'))
  if (!pkg.scripts.dev) throw new Error('Missing npm run dev')
  if (!pkg.scripts['dev:client']) throw new Error('Missing npm run dev:client')
  if (!pkg.scripts['dev:server']) throw new Error('Missing npm run dev:server')
})

// Check .env
check('.env file exists', () => {
  if (!fs.existsSync('./.env')) {
    console.warn('  ⚠️  .env file not found - create it with: cp .env.example .env')
  }
})

// Check database URL if .env exists
check('.env has DATABASE_URL', () => {
  if (!fs.existsSync('./.env')) throw new Error('Skip - .env not found')
  const env = fs.readFileSync('./.env', 'utf-8')
  if (!env.includes('DATABASE_URL')) throw new Error('DATABASE_URL not set in .env')
})

// Check node_modules
check('node_modules exists', () => {
  if (!fs.existsSync('./node_modules')) {
    throw new Error('Run: npm install')
  }
})

// Print results
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('🔍 JKUAT Queue System - Setup Verification')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

checks.forEach(({ name, status, error }) => {
  console.log(`${status} ${name}`)
  if (error) console.log(`   └─ ${error}`)
})

const failed = checks.filter(c => c.status === '❌')
const passed = checks.filter(c => c.status === '✅')

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`Results: ${passed.length}/${checks.length} checks passed\n`)

if (failed.length === 0) {
  console.log('✅ Setup is complete! You can run:')
  console.log('   npm run dev          # Start frontend + backend')
  console.log('   npm run dev:client   # Start frontend only')
  console.log('   npm run dev:server   # Start backend only\n')
} else {
  console.log('❌ Some checks failed. Please fix the issues above.\n')
  process.exit(1)
}

console.log('For detailed instructions, see QUICKSTART.md or SETUP.md')
