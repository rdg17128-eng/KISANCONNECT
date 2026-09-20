/**
 * Razorpay Standard Web Checkout Client Service
 * 
 * Handles client-side initialization, order creation call to backend,
 * modal presentation, and payment signature verification.
 */

// Load checkout.js dynamically if not already on window
export function loadRazorpayScript() {
    return new Promise((resolve) => {
        if (typeof window !== 'undefined' && window.Razorpay) {
            return resolve(true);
        }

        const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve(true));
            existingScript.addEventListener('error', () => resolve(false));
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
}

/**
 * Step 1: Call Backend to Create Order
 * POST /api/create-order
 * 
 * @param {Object} params
 * @param {number} params.amountInPaise Minimum 100 paise (₹1.00)
 * @param {string} [params.currency='INR']
 * @param {string} [params.receipt]
 * @param {Object} [params.notes]
 * @returns {Promise<{order_id: string, amount: number, currency: string}>}
 */
export async function createRazorpayOrder({ amountInPaise, currency = 'INR', receipt, notes = {} }) {
    if (!amountInPaise || Number(amountInPaise) < 100) {
        throw new Error('Minimum order amount must be at least ₹1.00 (100 paise).');
    }

    const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            amount: Math.round(Number(amountInPaise)),
            currency,
            receipt: receipt || `kisan_${Date.now()}`,
            notes
        })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        const errorMsg = data.error || `Order creation failed with status ${res.status}`;
        throw new Error(errorMsg);
    }

    return data; // { order_id, amount, currency }
}

/**
 * Step 3: Call Backend to Verify Payment Signature
 * POST /api/verify-payment
 * 
 * @param {Object} params
 * @param {string} params.razorpay_order_id
 * @param {string} params.razorpay_payment_id
 * @param {string} params.razorpay_signature
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export async function verifyRazorpayPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
    const res = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
        const errorMsg = data.error || 'Payment signature verification failed.';
        return {
            success: false,
            error: errorMsg,
            ...data
        };
    }

    return data;
}

/**
 * Step 2: Open Standard Web Checkout Modal
 * Integrates create-order -> Razorpay Modal -> verify-payment
 * 
 * @param {Object} options
 * @param {number} [options.amountInRupees] Amount in INR (e.g. 500 for ₹500)
 * @param {number} [options.amountInPaise] Amount in Paise (e.g. 50000 for ₹500)
 * @param {string} [options.description] Checkout title / item description
 * @param {Object} [options.prefill] User details: { name, email, contact }
 * @param {Object} [options.notes] Custom metadata
 * @param {Function} options.onSuccess Called when payment is completed AND verified by backend
 * @param {Function} options.onFailure Called when payment fails or verification fails
 * @param {Function} options.onDismiss Called if user closes modal without paying
 */
export async function openRazorpayCheckout({
    amountInRupees,
    amountInPaise,
    description = 'KisanConnect Trade Settlement',
    receipt,
    prefill = {},
    notes = {},
    onSuccess,
    onFailure,
    onDismiss
}) {
    // 1. Calculate amount in paise
    const paise = amountInPaise != null
        ? Math.round(Number(amountInPaise))
        : Math.round(Number(amountInRupees || 0) * 100);

    if (!paise || paise < 100) {
        const err = new Error('Minimum transaction amount is ₹1.00 (100 paise).');
        if (onFailure) onFailure(err);
        return;
    }

    // 2. Load SDK
    const isLoaded = await loadRazorpayScript();
    if (!isLoaded || typeof window.Razorpay === 'undefined') {
        const err = new Error('Razorpay SDK failed to load. Please check your network connection.');
        if (onFailure) onFailure(err);
        return;
    }

    // 3. Create order on backend
    let order;
    try {
        order = await createRazorpayOrder({
            amountInPaise: paise,
            receipt,
            notes
        });
    } catch (err) {
        console.error('[Razorpay] Order initialization error:', err);
        if (onFailure) onFailure(err);
        return;
    }

    // 4. Configure Razorpay Standard Checkout options
    const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TcYxRMRDrtCeaE';

    const rzpOptions = {
        key: keyId,
        amount: order.amount, // in paise
        currency: order.currency || 'INR',
        name: 'KisanConnect',
        description: description,
        image: '/kisanconnect-logo.svg',
        order_id: order.order_id,
        handler: async function (response) {
            // response contains: razorpay_payment_id, razorpay_order_id, razorpay_signature
            try {
                const verifyResult = await verifyRazorpayPayment({
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature
                });

                if (verifyResult.success) {
                    if (onSuccess) {
                        onSuccess({
                            ...response,
                            order,
                            verification: verifyResult
                        });
                    }
                } else {
                    const err = new Error(verifyResult.error || 'Payment verification failed.');
                    if (onFailure) onFailure(err);
                }
            } catch (err) {
                console.error('[Razorpay] Handler verification exception:', err);
                if (onFailure) onFailure(err);
            }
        },
        prefill: {
            name: prefill.name || '',
            email: prefill.email || '',
            contact: prefill.contact || prefill.phone || ''
        },
        notes: {
            platform: 'KisanConnect',
            ...notes
        },
        theme: {
            color: '#10b981' // KisanConnect brand emerald green
        },
        modal: {
            ondismiss: function () {
                console.log('[Razorpay] Modal dismissed by user');
                if (onDismiss) onDismiss();
            }
        }
    };

    const rzpInstance = new window.Razorpay(rzpOptions);

    // 5. Handle payment failure event
    rzpInstance.on('payment.failed', function (response) {
        console.error('[Razorpay] Payment failed event:', response.error);
        const err = new Error(
            response.error?.description || response.error?.reason || 'Payment was declined or failed.'
        );
        err.details = response.error;
        if (onFailure) onFailure(err);
    });

    // 6. Open modal
    rzpInstance.open();
}

/**
 * Execute Auto-Success Payment (Seamless Instant Settlement)
 * Bypasses Razorpay's simulated demo bank "[ Success ] [ Failure ]" page
 * while still creating real Razorpay orders and performing authentic HMAC-SHA256 signature verification.
 */
export async function executeAutoSuccessPayment({
    amountInRupees,
    amountInPaise,
    receipt,
    notes = {}
}) {
    const paise = amountInPaise != null
        ? Math.round(Number(amountInPaise))
        : Math.round(Number(amountInRupees || 0) * 100);

    if (!paise || paise < 100) {
        throw new Error('Minimum transaction amount is ₹1.00 (100 paise).');
    }

    const res = await fetch('/api/auto-success-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            amount: paise,
            receipt: receipt || `kisan_${Date.now()}`,
            notes
        })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
        throw new Error(data.error || 'Auto payment execution failed.');
    }

    return data;
}

export default {
    loadRazorpayScript,
    createRazorpayOrder,
    verifyRazorpayPayment,
    openRazorpayCheckout,
    executeAutoSuccessPayment
};
