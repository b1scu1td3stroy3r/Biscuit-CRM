import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q) {
    return NextResponse.json({ items: [] });
  }

  // Uses Companies House public test API or returns structured live company data
  try {
    const apiKey = process.env.COMPANIES_HOUSE_API_KEY || '';
    if (!apiKey) {
      // Mocked live-schema response for development when no API key is specified yet
      return NextResponse.json({
        items: [
          {
            title: `${q.toUpperCase()} TECHNOLOGIES LTD`,
            company_number: '12849501',
            company_status: 'active',
            address_snippet: '100 Bishopsgate, London, EC2N 4AG',
            date_of_creation: '2020-04-12',
          },
          {
            title: `${q.toUpperCase()} TRADING & LOGISTICS PLC`,
            company_number: '09483721',
            company_status: 'active',
            address_snippet: 'Albion Court, Leeds, LS1 5AA',
            date_of_creation: '2015-08-22',
          }
        ]
      });
    }

    const res = await fetch(`https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(q)}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
      },
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to query Companies House' }, { status: 500 });
  }
}
