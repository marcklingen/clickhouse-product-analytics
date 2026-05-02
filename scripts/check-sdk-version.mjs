import { readFileSync } from 'node:fs'

const sdkPackage = JSON.parse(readFileSync('packages/sdk/package.json', 'utf8'))
const reactPackage = JSON.parse(readFileSync('packages/react/package.json', 'utf8'))
const versionSource = readFileSync('packages/sdk/src/version.ts', 'utf8')
const match = versionSource.match(/SDK_VERSION = '([^']+)'/)

if (!match) {
  console.error('Could not find SDK_VERSION in packages/sdk/src/version.ts')
  process.exit(1)
}

const sdkVersion = sdkPackage.version
const runtimeVersion = match[1]
const reactSdkDependency = reactPackage.dependencies?.['@clickhouse-product-analytics/sdk']

if (runtimeVersion !== sdkVersion) {
  console.error(`SDK runtime version ${runtimeVersion} does not match package version ${sdkVersion}`)
  process.exit(1)
}

if (reactSdkDependency !== sdkVersion) {
  console.error(`React package depends on SDK ${reactSdkDependency}, expected ${sdkVersion}`)
  process.exit(1)
}
