import { readFileSync, writeFileSync } from 'node:fs'

const version = process.argv[2]

if (!version) {
  console.error('Usage: node scripts/sync-release-version.mjs <version>')
  process.exit(1)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

const sdkPackagePath = 'packages/sdk/package.json'
const reactPackagePath = 'packages/react/package.json'
const examplePackagePath = 'examples/nextjs-smoke/package.json'
const lockfilePath = 'package-lock.json'
const sdkVersionPath = 'packages/sdk/src/version.ts'

const sdkPackage = readJson(sdkPackagePath)
sdkPackage.version = version
writeJson(sdkPackagePath, sdkPackage)

const reactPackage = readJson(reactPackagePath)
reactPackage.version = version
reactPackage.dependencies = reactPackage.dependencies ?? {}
reactPackage.dependencies['@clickhouse-product-analytics/sdk'] = version
writeJson(reactPackagePath, reactPackage)

const examplePackage = readJson(examplePackagePath)
examplePackage.devDependencies = examplePackage.devDependencies ?? {}
if (examplePackage.devDependencies['@clickhouse-product-analytics/sdk']) {
  examplePackage.devDependencies['@clickhouse-product-analytics/sdk'] = version
}
if (examplePackage.devDependencies['@clickhouse-product-analytics/react']) {
  examplePackage.devDependencies['@clickhouse-product-analytics/react'] = version
}
writeJson(examplePackagePath, examplePackage)

const lockfile = readJson(lockfilePath)
if (lockfile.packages?.['packages/sdk']) {
  lockfile.packages['packages/sdk'].version = version
}
if (lockfile.packages?.['packages/react']) {
  lockfile.packages['packages/react'].version = version
  lockfile.packages['packages/react'].dependencies =
    lockfile.packages['packages/react'].dependencies ?? {}
  lockfile.packages['packages/react'].dependencies['@clickhouse-product-analytics/sdk'] = version
}
if (lockfile.packages?.['examples/nextjs-smoke']?.devDependencies) {
  const deps = lockfile.packages['examples/nextjs-smoke'].devDependencies
  if (deps['@clickhouse-product-analytics/sdk']) {
    deps['@clickhouse-product-analytics/sdk'] = version
  }
  if (deps['@clickhouse-product-analytics/react']) {
    deps['@clickhouse-product-analytics/react'] = version
  }
}
writeJson(lockfilePath, lockfile)
writeFileSync(sdkVersionPath, `export const SDK_VERSION = '${version}'\n`)
