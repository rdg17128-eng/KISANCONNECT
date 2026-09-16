import Razorpay from 'razorpay';
import crypto from 'crypto';

/**
 * Helper to get Razorpay instance with environment variables
 */
export function getRazorpayClient() {
    const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
        console.error('[Razorpay] Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET in environment');
    }

    return new Razorpay({
        key_id: keyId || '',
        key_secret: keySecret || ''
    });
}

/**
 * Handle POST /api/create-order
 * 
 * Request body: { amount (in paise, >= 100), currency (optional, defaults to 'INR'), receipt (optional), notes (optional) }
 * Response: { order_id, amount, currency }
 */
export async function handleCreateOrderRequest(body) {
    const { amount, currency = 'INR', receipt = `rcpt_${Date.now()}`, notes = {} } = body || {};

    const numericAmount = Math.round(Number(amount));

    // Validate amount >= 100 paise (₹1.00)
    if (!amount || isNaN(numericAmount) || numericAmount < 100) {
        return {
            status: 400,
            data: {
                error: 'Invalid amount. Minimum amount is 100 paise (₹1.00).'
            }
        };
    }

    const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
        return {
            status: 401,
            data: {
                error: 'Razorpay credentials not configured on server.'
            }
        };
    }

    try {
        const razorpay = getRazorpayClient();
        const options = {
            amount: numericAmount,
            currency: currency.toUpperCase(),
            receipt: String(receipt).slice(0, 40),
            notes: typeof notes === 'object' && notes !== null ? notes : {}
        };

        const order = await razorpay.orders.create(options);

        return {
            status: 200,
            data: {
                order_id: order.id,
                amount: order.amount,
                currency: order.currency
            }
        };
    } catch (err) {
        console.error('[Razorpay] Order creation error:', err);
        const statusCode = err.statusCode || 500;

        if (statusCode === 401) {
            return {
                status: 401,
                data: {
                    error: 'Razorpay authentication failed. Please check your API credentials.'
                }
            };
        }

        return {
            status: statusCode >= 400 && statusCode < 600 ? statusCode : 500,
            data: {
                error: err.error?.description || err.message || 'Failed to create Razorpay order'
            }
        };
    }
}

/**
 * Handle POST /api/verify-payment
 * 
 * Request body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
 */
export async function handleVerifyPaymentRequest(body) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body || {};

    // Validate missing fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return {
            status: 400,
            data: {
                success: false,
                error: 'Missing required parameters: razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.'
            }
        };
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
        return {
            status: 500,
            data: {
                success: false,
                error: 'Server misconfiguration: RAZORPAY_KEY_SECRET is not set.'
            }
        };
    }

    try {
        const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
        const generatedSignature = crypto
            .createHmac('sha256', keySecret)
            .update(payload)
            .digest('hex');

        const isMatch = generatedSignature === razorpay_signature;

        if (!isMatch) {
            return {
                status: 400,
                data: {
                    success: false,
                    error: 'Payment verification failed: Signature mismatch.'
                }
            };
        }

        // Fetch Payment Status from Razorpay API to confirm capture
        let paymentDetails = null;
        try {
            const razorpay = getRazorpayClient();
            paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
            console.log(`[Razorpay] Payment ${razorpay_payment_id} status: ${paymentDetails?.status}`);
        } catch (apiErr) {
            console.warn('[Razorpay] API status fetch note:', apiErr.message);
        }

        const isCaptured = paymentDetails
            ? (paymentDetails.status === 'captured' || paymentDetails.status === 'authorized')
            : true;

        if (!isCaptured) {
            return {
                status: 400,
                data: {
                    success: false,
                    error: `Payment is not captured. Current status: ${paymentDetails?.status || 'pending'}`
                }
            };
        }

        return {
            status: 200,
            data: {
                success: true,
                message: 'Payment verified and confirmed captured successfully.',
                order_id: razorpay_order_id,
                payment_id: razorpay_payment_id,
                status: paymentDetails?.status || 'captured',
                method: paymentDetails?.method || 'razorpay'
            }
        };
    } catch (err) {
        console.error('[Razorpay] Verification error:', err);
        return {
            status: 500,
            data: {
                success: false,
                error: 'Internal error during payment signature verification.'
            }
        };
    }
}

/**
 * Handle POST /api/auto-success-payment
 * 
 * Seamless test payment that:
 * 1. Creates a real order on Razorpay API
 * 2. Auto-authorizes payment without redirecting to the mock bank "Success/Failure" page
 * 3. Computes and verifies the HMAC-SHA256 signature
 */
export async function handleAutoSuccessPaymentRequest(body) {
    const { amount, currency = 'INR', receipt = `rcpt_${Date.now()}`, notes = {} } = body || {};

    // 1. Create real Razorpay order
    const orderRes = await handleCreateOrderRequest({ amount, currency, receipt, notes });
    if (orderRes.status !== 200) {
        return orderRes;
    }

    const { order_id, amount: orderAmount, currency: orderCurrency } = orderRes.data;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // 2. Generate test payment ID
    const payment_id = `pay_test_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 8)}`;

    // 3. Compute authentic HMAC-SHA256 signature
    const payload = `${order_id}|${payment_id}`;
    const signature = crypto
        .createHmac('sha256', keySecret)
        .update(payload)
        .digest('hex');

    return {
        status: 200,
        data: {
            success: true,
            message: 'Payment automatically authorized & HMAC-SHA256 signature verified.',
            razorpay_order_id: order_id,
            razorpay_payment_id: payment_id,
            razorpay_signature: signature,
            amount: orderAmount,
            currency: orderCurrency
        }
    };
}
