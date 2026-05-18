// NOTE: These are obviously-fake demo values for UI preview only.
// Prefixes like `pk_live_` / `pk_test_` resemble real Stripe-format keys and
// will be flagged by secret scanners (TruffleHog, GitLeaks, etc.), so we use
// an unmistakable `DEMO-KEY-` prefix with `XXXX` placeholders instead.
const makeDemoKey = (n) => `DEMO-KEY-${String(n).padStart(4, '0')}-XXXXXXXXXXXXXXXXXXXXXXXX`
const makeMasked = (n) => `DEMO-KEY-${String(n).padStart(4, '0')}-XXXX…XXXX`

export const initialKeys = [
  { id: 1, name: 'Production API',    key: makeDemoKey(1), masked: makeMasked(1), lastUsed: '2 hours ago', created: 'Jan 15, 2026', expires: 'Jan 15, 2027', status: 'Active',  scopes: ['read', 'write'],           calls: 18420 },
  { id: 2, name: 'Development API',   key: makeDemoKey(2), masked: makeMasked(2), lastUsed: '1 day ago',   created: 'Feb 01, 2026', expires: 'Never',        status: 'Active',  scopes: ['read'],                    calls: 5320  },
  { id: 3, name: 'Analytics Service', key: makeDemoKey(3), masked: makeMasked(3), lastUsed: '5 days ago',  created: 'Dec 20, 2025', expires: 'Dec 20, 2026', status: 'Active',  scopes: ['read', 'write', 'delete'], calls: 21430 },
  { id: 4, name: 'Webhook Service',   key: makeDemoKey(4), masked: makeMasked(4), lastUsed: 'Never',       created: 'Mar 01, 2026', expires: 'Mar 01, 2027', status: 'Revoked', scopes: ['read'],                    calls: 0     },
  { id: 5, name: 'Mobile App',        key: makeDemoKey(5), masked: makeMasked(5), lastUsed: '3 hours ago', created: 'Feb 10, 2026', expires: 'Feb 10, 2027', status: 'Active',  scopes: ['read', 'write'],           calls: 3121  },
]

export const endpointStats = [
  { endpoint: '/api/v1/users',      calls: 14820, pct: 92 },
  { endpoint: '/api/v1/projects',   calls: 11340, pct: 71 },
  { endpoint: '/api/v1/analytics',  calls: 8760,  pct: 55 },
  { endpoint: '/api/v1/reports',    calls: 5210,  pct: 33 },
  { endpoint: '/api/v1/webhooks',   calls: 2390,  pct: 15 },
]

export const initialWebhooks = [
  { id: 1, url: 'https://myapp.io/hooks/orders', events: ['order.created', 'order.updated'], active: true,  lastTriggered: '10 min ago' },
  { id: 2, url: 'https://myapp.io/hooks/users',  events: ['user.signup', 'user.deleted'],    active: false, lastTriggered: '2 days ago' },
]

export const scopeColors = {
  read: 'badge-primary',
  write: 'badge-warning',
  delete: 'badge-danger',
}

export const sdkTabs = ['curl', 'javascript', 'python']

export const codeSnippets = {
  curl: `curl -X GET "https://api.liner.io/v1/projects" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \\
  -H "Content-Type: application/json"`,

  javascript: `import { LinerClient } from '@liner/sdk'

const client = new LinerClient({
  apiKey: process.env.LINER_API_KEY,
})

const projects = await client.projects.list({
  limit: 20,
  status: 'active',
})

console.log(projects.data)`,

  python: `from liner import LinerClient
import os

client = LinerClient(api_key=os.environ["LINER_API_KEY"])

projects = client.projects.list(
    limit=20,
    status="active",
)

print(projects.data)`,
}
