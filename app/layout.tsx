import './globals.css';
import Script from 'next/script';
import React from 'react';

export const metadata = {
  title: 'Biscuit CRM 🍪',
  description: 'Zero-Storage Business OS running entirely on Google Workspace',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Script src="https://accounts.google.com/gsi/client" strategy="beforeInteractive" />
        <Script src="https://apis.google.com/js/api.js" strategy="afterInteractive" />
      </head>
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
