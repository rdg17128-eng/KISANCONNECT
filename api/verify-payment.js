import { handleVerifyPaymentRequest } from '../new_app/server/razorpayHandler.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
        return;
    }

    try {
        let body = req.body;
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            } catch (e) {
                // Keep as string
            }
        }

        const result = await handleVerifyPaymentRequest(body);
        res.status(result.status).json(result.data);
    } catch (err) {
        console.error('Root API verify-payment handler error:', err);
        res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
}
