import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { refreshToken } = await req.json();

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!refreshToken) {
      return NextResponse.json({ error: 'No refresh token provided.' }, { status: 400 });
    }

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'OAuth client credentials missing on server.' }, { status: 500 });
    }

    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('refresh_token', refreshToken);
    params.append('grant_type', 'refresh_token');

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error_description || data.error || 'Failed to refresh access token' }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
