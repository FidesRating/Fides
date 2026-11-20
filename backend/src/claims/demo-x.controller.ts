import { Controller, Get, Header, NotFoundException, Query } from '@nestjs/common';
import { MOCK_X_PROFILES, isXMockEnabled } from './x-oauth';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Local demo only: the page that stands in for the X login screen. It answers 404 unless X_OAUTH_MOCK=true
 * outside production, so on a real deployment this route does not exist.
 */
@Controller('demo/x')
export class DemoXController {
  @Get('authorize')
  @Header('content-type', 'text/html; charset=utf-8')
  authorize(@Query('state') state?: string) {
    if (!isXMockEnabled()) throw new NotFoundException();
    const redirect = process.env.X_REDIRECT_URI;
    if (!redirect || !state || !/^[0-9a-f]{32}$/.test(state)) throw new NotFoundException();
    const rows = MOCK_X_PROFILES.map((p) => {
      const href = `${redirect}${redirect.includes('?') ? '&' : '?'}${new URLSearchParams({ code: `mock-${p.username}`, state })}`;
      return `<a href="${esc(href)}"><b>${esc(p.name)}</b><span>@${esc(p.username)} · ${p.followers.toLocaleString('en-US')} followers</span></a>`;
    }).join('');
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Demo login</title>
<style>body{font-family:system-ui,sans-serif;background:#f4efe6;margin:0;display:grid;place-items:center;min-height:100vh}main{background:#fff;border-radius:16px;padding:28px;max-width:420px;width:calc(100% - 32px);box-shadow:0 8px 30px #0002}
h1{font-size:20px;margin:0 0 6px}p{color:#555;font-size:14px;margin:0 0 18px}a{display:block;border:1px solid #ddd;border-radius:12px;padding:12px 14px;margin-bottom:10px;text-decoration:none;color:#111}a:hover{border-color:#8a1c2b}a span{display:block;color:#666;font-size:13px;margin-top:2px}</style></head>
<body><main><h1>Log in with X (demo)</h1><p>Local demo only. These accounts are fictional and nothing is sent to X.</p>${rows}</main></body></html>`;
  }
}
