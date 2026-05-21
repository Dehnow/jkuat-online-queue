#!/usr/bin/env node

/**
 * Comprehensive Verification Script
 * Checks all aspects of setup for local dev and production
 * Run: node verify-complete.js
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const checks = []
const warnings = []
const errors = []

function check(name, fn) {
  try {
    fn()
    checks.push({ name, status: '✅', msg: null })
  } catch (error) {
    checks.push({ name, status: '❌', msg: error.message })
    errors.push({ name, error: error.message })
  }
}

function warn(name, msg) {
  warnings.push({ name, msg })
}

console.log('\n═══════════════════════════════════════════════════════════════')
console.log('🔍 JKUAT Queue System - Comprehensive Verification')
console.log('═══════════════════════════════════════════════════════════════\n')

// ============ FILE EXISTENCE CHECKS ============
console.log('📁 File Existence Checks')
console.log('─────────────────────────────────────────────────────────────\n')

check('api-server.js exists', () => {
  if (!fs.existsSync('./api-server.js')) throw new Error('Not found')
})

check('package.json exists', () => {
  if (!fs.existsSync('./package.json')) throw new Error('Not found')
})

check('vite.config.ts exists', () => {
  if (!fs.existsSync('./vite.config.ts')) throw new Error('Not found')
})

check('src/main.tsx exists', () => {
  if (!fs.existsSync('./src/main.tsx')) throw new Error('Not found')
})

check('src/router.tsx exists', () => {
  if (!fs.existsSync('./src/router.tsx')) throw new Error('Not found')
})

check('index.html exists', () => {
  if (!fs.existsSync('./index.html')) throw new Error('Not found')
})

check('.env.example exists', () => {
  if (!fs.existsSync('./.env.example')) throw new Error('Not found')
})

// ============ CONFIGURATION CHECKS ============
console.log('⚙️  Configuration Checks')
console.log('─────────────────────────────────────────────────────────────\n')

check('package.json has correct structure', () => {
  const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'))
  if (pkg.type !== 'module') throw new Error('type must be "module"')
  if (!pkg.scripts.dev) throw new Error('Missing npm run dev')
  if (!pkg.scripts.build) throw new Error('Missing npm run build')
  if (!pkg.scripts.production) throw new Error('Missing npm run production script')
  if (!pkg.scripts.start) throw new Error('Missing npm run start script')
})

check('Dependencies installed', () => {
  if (!fs.existsSync('./node_modules')) {
    throw new Error('Run: npm install')
  }
})

check('Production dependencies', () => {
  const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'))
  const required = ['express', 'cors', 'drizzle-orm', 'postgres', 'dotenv', 'react', 'react-dom']
  required.forEach(dep => {
    if (!pkg.dependencies[dep]) throw new Error(`Missing dependency: ${dep}`)
  })
})

check('Dev dependencies correct', () => {
  const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'))
  if (!pkg.devDependencies['@types/node']) throw new Error('Missing @types/node')
  if (!pkg.devDependencies['typescript']) throw new Error('Missing typescript')
})

// ============ BACKEND CHECKS ============
console.log('🔌 Backend Configuration Checks')
console.log('─────────────────────────────────────────────────────────────\n')

check('api-server.js has database retry logic', () => {
  const content = fs.readFileSync('./api-server.js', 'utf-8')
  if (!content.includes('async function initializeDatabase()')) {
    throw new Error('Missing database initialization function')
  }
  if (!content.includes('maxRetries')) throw new Error('Missing retry logic')
})

check('api-server.js has connection pooling', () => {
  const content = fs.readFileSync('./api-server.js', 'utf-8')
  if (!content.includes('max: 10')) throw new Error('Missing connection pool config')
})

check('api-server.js has CORS dynamic configuration', () => {
  const content = fs.readFileSync('./api-server.js', 'utf-8')
  if (!content.includes('origin: (origin, callback)')) {
    throw new Error('CORS not configured dynamically')
  }
  if (!content.includes('process.env.FRONTEND_URL')) {
    throw new Error('Missing production CORS support')
  }
})

check('api-server.js has production static serving', () => {
  const content = fs.readFileSync('./api-server.js', 'utf-8')
  if (!content.includes("NODE_ENV === 'production'")) {
    throw new Error('Missing production check')
  }
  if (!content.includes('express.static')) throw new Error('Missing static file serving')
})

check('api-server.js has database health checks', () => {
  const content = fs.readFileSync('./api-server.js', 'utf-8')
  if (!content.includes('if (!db)')) throw new Error('Missing database availability checks')
})

check('api-server.js listens on 0.0.0.0', () => {
  const content = fs.readFileSync('./api-server.js', 'utf-8')
  if (!content.includes("'0.0.0.0'")) throw new Error("Should listen on '0.0.0.0'")
})

check('api-server.js validates service types', () => {
  const content = fs.readFileSync('./api-server.js', 'utf-8')
  if (!content.includes('validServices')) throw new Error('Missing service validation')
})

// ============ ENVIRONMENT CHECKS ============
console.log('🔐 Environment Configuration Checks')
console.log('─────────────────────────────────────────────────────────────\n')

check('.env.example has all required variables', () => {
  const content = fs.readFileSync('./.env.example', 'utf-8')
  if (!content.includes('DATABASE_URL')) throw new Error('Missing DATABASE_URL')
  if (!content.includes('PORT')) throw new Error('Missing PORT')
  if (!content.includes('NODE_ENV')) throw new Error('Missing NODE_ENV')
})

if (fs.existsSync('./.env')) {
  check('.env has DATABASE_URL set', () => {
    const content = fs.readFileSync('./.env', 'utf-8')
    if (!content.includes('DATABASE_URL=')) throw new Error('.env missing DATABASE_URL')
    if (content.includes('DATABASE_URL=postgresql://user:password')) {
      warn('.env', 'DATABASE_URL still has placeholder - update with real connection string')
    }
  })
} else {
  warn('Environment', '.env file not found - run: cp .env.example .env')
}

check('.gitignore includes .env', () => {
  const content = fs.readFileSync('./.gitignore', 'utf-8')
  if (!content.includes('.env')) throw new Error('.env not in .gitignore')
})

// ============ BUILD CHECKS ============
console.log('🏗️  Build Configuration Checks')
console.log('─────────────────────────────────────────────────────────────\n')

check('vite.config.ts configured correctly', () => {
  const content = fs.readFileSync('./vite.config.ts', 'utf-8')
  if (!content.includes('@vitejs/plugin-react')) throw new Error('Missing react plugin')
  if (!content.includes('@tailwindcss/vite')) throw new Error('Missing tailwind plugin')
})

check('dist folder exists (or will be built)', () => {
  if (!fs.existsSync('./dist')) {
    warn('Build', 'dist folder not found - will be created after npm run build')
  }
})

check('tsconfig.json configured', () => {
  const tsconfig = JSON.parse(fs.readFileSync('./tsconfig.json', 'utf-8'))
  if (tsconfig.compilerOptions.target !== 'ES2022') {
    warn('TypeScript', 'Consider using ES2022 target for better compatibility')
  }
})

// ============ DOCUMENTATION CHECKS ============
console.log('📚 Documentation Checks')
console.log('─────────────────────────────────────────────────────────────\n')

const docFiles = [
  'DEPLOYMENT_READY.md',
  'RENDER_DEPLOYMENT.md',
  'TROUBLESHOOTING.md',
  'API_TESTING.md',
  'SETUP.md',
  'CODE_REVIEW_COMPLETE.md'
]

docFiles.forEach(doc => {
  check(`${doc} exists`, () => {
    if (!fs.existsSync(`./${doc}`)) throw new Error(`Missing ${doc}`)
  })
})

// ============ RESULTS ============
console.log('\n═══════════════════════════════════════════════════════════════')
console.log('📊 VERIFICATION RESULTS')
console.log('═══════════════════════════════════════════════════════════════\n')

const passed = checks.filter(c => c.status === '✅').length
const failed = checks.filter(c => c.status === '❌').length

checks.forEach(({ name, status, msg }) => {
  console.log(`${status} ${name}`)
  if (msg) console.log(`   └─ ${msg}`)
})

if (warnings.length > 0) {
  console.log('\n⚠️  WARNINGS')
  console.log('─────────────────────────────────────────────────────────────')
  warnings.forEach(({ name, msg }) => {
    console.log(`⚠️  ${name}: ${msg}`)
  })
}

console.log('\n═══════════════════════════════════════════════════════════════')
console.log(`Results: ${passed}/${checks.length} checks passed`)

if (failed === 0) {
  console.log('\n✅ ALL CHECKS PASSED!\n')
  console.log('Your system is ready for:')
  console.log('  • Local development: npm run dev')
  console.log('  • Production build: npm run build && npm run production')
  console.log('  • Render deployment: See RENDER_DEPLOYMENT.md\n')
  process.exit(0)
} else {
  console.log(`\n❌ ${failed} checks failed - Please fix the issues above\n`)
  process.exit(1)
}
