import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { apiKey, contact, amount, description } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing Stripe Secret Key.' }, { status: 400 });
    }
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Valid payment amount is required.' }, { status: 400 });
    }

    const unitAmountPence = Math.round(Number(amount) * 100);

    const bodyParams = new URLSearchParams();
    bodyParams.append('mode', 'payment');
    bodyParams.append('success_url', 'https://biscuit-crm-six.vercel.app?payment_status=success');
    bodyParams.append('cancel_url', 'https://biscuit-crm-six.vercel.app?payment_status=cancelled');

    // Payment methods: Card & BACS Direct Debit
    bodyParams.append('payment_method_types[0]', 'card');
    bodyParams.append('payment_method_types[1]', 'bacs_debit');

    if (contact?.email) {
      bodyParams.append('customer_email', contact.email);
    }

    bodyParams.append('line_items[0][price_data][currency]', 'gbp');
    bodyParams.append('line_items[0][price_data][unit_amount]', String(unitAmountPence));
    bodyParams.append('line_items[0][price_data][product_data][name]', description || `Invoice Ref: ${contact?.accountNumber || 'Order'}`);
    bodyParams.append('line_items[0][quantity]', '1');

    bodyParams.append('metadata[accountNumber]', contact?.accountNumber || '');
    bodyParams.append('metadata[company]', contact?.company || '');

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams.toString(),
    });

    const data = await stripeRes.json();
    if (!stripeRes.ok) {
      return NextResponse.json({ error: data.error?.message || 'Failed to generate Stripe Checkout Session.' }, { status: stripeRes.status });
    }

    return NextResponse.json({ url: data.url, id: data.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error creating Stripe session.' }, { status: 500 });
  }
}
