/**
 * 给 Cloudflare Pages 项目绑定自定义域名（os.ale160.com）。
 * 使用 wrangler 本地存储的 OAuth token 调用 CF API（token 不落命令行）。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const configPath = join(
  process.env.APPDATA || join(process.env.USERPROFILE, 'AppData', 'Roaming'),
  'xdg.config', '.wrangler', 'config', 'default.toml'
);
const toml = readFileSync(configPath, 'utf8');
const token = toml.match(/oauth_token\s*=\s*"([^"]+)"/)?.[1];
if (!token) {
  console.error('未找到 wrangler OAuth token');
  process.exit(1);
}

const accountId = '43d1f6bf5780f28d866397b1756b867f';
const project = 'os-open';
const domain = 'os.ale160.com';

const res = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${project}/domains`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: domain })
  }
);
const json = await res.json();
console.log('HTTP', res.status, JSON.stringify(json).slice(0, 300));

// 查询域名状态
const status = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${project}/domains/${domain}`,
  { headers: { Authorization: `Bearer ${token}` } }
);
const statusJson = await status.json();
console.log('域名状态:', JSON.stringify(statusJson.result?.status ?? statusJson));
