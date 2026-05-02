const host = process.env.CPA_SERVICE_URL ?? 'http://127.0.0.1:8080'
const apiKey = process.env.CPA_API_KEY ?? 'local_dev_key'

const response = await fetch(`${host}/i/v0/e/`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    api_key: apiKey,
    event: 'backend_job_completed',
    distinct_id: 'user_123',
    properties: {
      job_id: 'job_456',
      duration_ms: 481,
      source: 'direct-api-example'
    }
  })
})

if (!response.ok) {
  throw new Error(`Capture failed with HTTP ${response.status}: ${await response.text()}`)
}

console.log(await response.json())
