with open('next.config.ts', 'r', encoding='utf-8') as f:
    code = f.read()

security_headers = """
  async headers() {
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
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' wss: https:; img-src 'self' data: blob:; font-src 'self' data:;"
          }
        ],
      },
    ];
  },
"""

if "async headers()" not in code:
    code = code.replace("const nextConfig: NextConfig = {", "const nextConfig: NextConfig = {\n" + security_headers)
    with open('next.config.ts', 'w', encoding='utf-8') as f:
        f.write(code)
    print("SUCCESS: Injected enterprise Content-Security-Policy & transport headers into next.config.ts")
else:
    print("INFO: Headers already present in next.config.ts")
