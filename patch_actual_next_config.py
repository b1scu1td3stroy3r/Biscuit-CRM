import os

target_file = None
for fname in ['next.config.js', 'next.config.mjs', 'next.config.ts']:
    if os.path.exists(fname):
        target_file = fname
        break

if not target_file:
    print("ERROR: No next.config.* file found!")
    exit(1)

with open(target_file, 'r', encoding='utf-8') as f:
    code = f.read()

if "async headers()" in code:
    print(f"INFO: Headers already present in {target_file}")
    exit(0)

headers_snippet = """  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' wss: https: data: blob:; img-src 'self' data: blob:; font-src 'self' data:;"
          }
        ],
      },
    ];
  },
"""

# Insert headers inside the configuration object
if "const nextConfig = {" in code:
    code = code.replace("const nextConfig = {", "const nextConfig = {\n" + headers_snippet, 1)
elif "const nextConfig: NextConfig = {" in code:
    code = code.replace("const nextConfig: NextConfig = {", "const nextConfig: NextConfig = {\n" + headers_snippet, 1)
elif "module.exports = {" in code:
    code = code.replace("module.exports = {", "module.exports = {\n" + headers_snippet, 1)

with open(target_file, 'w', encoding='utf-8') as f:
    f.write(code)

print(f"SUCCESS: Injected enterprise security headers into {target_file}")
