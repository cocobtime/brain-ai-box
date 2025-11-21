
export default async function handler(request, response) {
  // Vercel Serverless Function CORS Setup
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, APCA-API-KEY-ID, APCA-API-SECRET-KEY'
  );

  // Handle Preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return;
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed. Send a POST request with targetPath in body.' });
  }

  try {
    // In Vercel/Next.js, request.body is already parsed if content-type is application/json
    const bodyData = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const { targetPath, method, body, headers } = bodyData;

    if (!targetPath) {
      return response.status(400).json({ error: 'Missing targetPath in request body' });
    }

    // Route to correct Alpaca Subdomain
    // Data API: https://data.alpaca.markets (for quotes/bars)
    // Paper Trading API: https://paper-api.alpaca.markets (for orders/account)
    let baseUrl = 'https://paper-api.alpaca.markets';
    if (targetPath.includes('/v2/stocks/') || targetPath.includes('/v1beta1/news')) {
      baseUrl = 'https://data.alpaca.markets';
    }

    const url = `${baseUrl}${targetPath}`;

    console.log(`[Proxy] Forwarding to: ${url}`);

    const fetchOptions = {
      method: method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Spread headers carefully
        ...headers
      }
    };

    // Only attach body if method is not GET/HEAD
    if (body && method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = JSON.stringify(body);
    }

    const alpacaRes = await fetch(url, fetchOptions);
    
    // Handle response parsing safely
    const contentType = alpacaRes.headers.get('content-type');
    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await alpacaRes.json();
    } else {
      data = await alpacaRes.text();
    }

    if (!alpacaRes.ok) {
       console.error(`[Proxy] Upstream Error: ${alpacaRes.status}`, data);
       return response.status(alpacaRes.status).json(data);
    }

    return response.status(200).json(data);

  } catch (error) {
    console.error('[Proxy] Internal Error:', error);
    return response.status(500).json({ error: error.message });
  }
}
