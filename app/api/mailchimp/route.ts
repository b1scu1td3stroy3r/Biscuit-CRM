import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { apiKey, audienceId, contact } = await req.json();

    if (!apiKey || !audienceId || !contact || !contact.email) {
      return NextResponse.json(
        { error: 'Missing Mailchimp API key, Audience ID, or contact email.' },
        { status: 400 }
      );
    }

    const dataCenter = apiKey.split('-')[1];
    if (!dataCenter) {
      return NextResponse.json(
        { error: 'Invalid Mailchimp API key format (missing dc suffix like -us1).' },
        { status: 400 }
      );
    }

    const url = `https://${dataCenter}.api.mailchimp.com/3.0/lists/${audienceId}/members`;
    const [firstName, ...rest] = (contact.name || '').split(' ');
    const lastName = rest.join(' ');

    const payload = {
      email_address: contact.email,
      status: 'subscribed',
      merge_fields: {
        FNAME: firstName || '',
        LNAME: lastName || '',
        COMPANY: contact.company || '',
        PHONE: contact.phone || '',
      },
      tags: ['Biscuit CRM', contact.stage || 'Lead'],
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      // If already subscribed, return ok
      if (data.title === 'Member Exists') {
        return NextResponse.json({ success: true, message: 'Member already in Mailchimp audience (Active).' });
      }
      return NextResponse.json({ error: data.detail || 'Mailchimp sync failed.' }, { status: res.status });
    }

    return NextResponse.json({ success: true, memberId: data.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Mailchimp sync error' }, { status: 500 });
  }
}
