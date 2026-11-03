import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { apiKey, contact, amount, cardNumber, expMonth, expYear, cvc } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing Stripe Secret Key.' }, { status: 400 });
    }
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero.' }, { status: 400 });
    }
    if (!cardNumber || !expMonth || !expYear || !cvc) {
      return NextResponse.json({ error: 'Incomplete card credentials.' }, { status: 400 });
    }

    const cleanCard = cardNumber.replace(/\s+/g, '');
    const unitAmount = Math.round(Number(amount) * 100);

    // 1. Create a PaymentMethod
    const pmParams = new URLSearchParams();
    pmParams.append('type', 'card');
    pmParams.append('card[number]', cleanCard);
    pmParams.append('card[exp_month]', String(expMonth));
    pmParams.append('card[exp_year]', String(expYear));
    pmParams.append('card[cvc]', String(cvc));

    const pmRes = await fetch('https://api.stripe.com/v1/payment_methods', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: pmParams.toString(),
    });

    const pmData = await pmRes.json();
    if (!pmRes.ok) {
      return NextResponse.json({ error: pmData.error?.message || 'Card verification failed.' }, { status: pmRes.status });
    }

    // 2. Create and confirm PaymentIntent (MOTO over-the-phone)
    const piParams = new URLSearchParams();
    piParams.append('amount', String(unitAmount));
    piParams.append('currency', 'gbp');
    piParams.append('payment_method', pmData.id);
    piParams.append('confirm', 'true');
    piParams.append('payment_method_types[0]', 'card');
    piParams.append('description', `Over-the-phone payment for ${contact?.company || contact?.name} [${contact?.accountNumber}]`);
    piParams.append('return_url', 'https://biscuit-crm-six.vercel.app');

    const piRes = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: piParams.toString(),
    });

    const piData = await piRes.json();
    if (!piRes.ok) {
      return NextResponse.json({ error: piData.error?.message || 'Payment capture failed.' }, { status: piRes.status });
    }

    return NextResponse.json({
      success: true,
      paymentIntentId: piData.id,
      status: piData.status,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Payment execution failed.' }, { status: 500 });
  }
}
