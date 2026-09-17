import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { handleCreateOrderRequest, handleVerifyPaymentRequest, handleAutoSuccessPaymentRequest } from './razorpayHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function runTests() {
    console.log('--- STARTING RAZORPAY INTEGRATION TESTS ---\n');
    let passed = 0;
    let failed = 0;

    // Test 1: Minimum amount validation (< 100 paise should fail)
    try {
        const res = await handleCreateOrderRequest({ amount: 50 }); // 50 paise
        if (res.status === 400 && res.data.error.includes('Minimum amount is 100 paise')) {
            console.log('✅ Test 1: Sub-100 paise rejected with 400 OK');
            passed++;
        } else {
            console.error('❌ Test 1 Failed: Expected 400, got', res);
            failed++;
        }
    } catch (e) {
        console.error('❌ Test 1 Exception:', e);
        failed++;
    }

    // Test 2: Missing fields on verify payment (should return 400)
    try {
        const res = await handleVerifyPaymentRequest({ razorpay_order_id: 'order_123' }); // missing payment_id & signature
        if (res.status === 400 && res.data.success === false) {
            console.log('✅ Test 2: Missing verify fields rejected with 400 OK');
            passed++;
        } else {
            console.error('❌ Test 2 Failed: Expected 400, got', res);
            failed++;
        }
    } catch (e) {
        console.error('❌ Test 2 Exception:', e);
        failed++;
    }

    // Test 3: Signature mismatch on verify payment (should return 400)
    try {
        const res = await handleVerifyPaymentRequest({
            razorpay_order_id: 'order_test_123',
            razorpay_payment_id: 'pay_test_456',
            razorpay_signature: 'invalid_signature_hash_000'
        });
        if (res.status === 400 && res.data.success === false && res.data.error.includes('Signature mismatch')) {
            console.log('✅ Test 3: Signature mismatch rejected with 400 OK');
            passed++;
        } else {
            console.error('❌ Test 3 Failed: Expected 400, got', res);
            failed++;
        }
    } catch (e) {
        console.error('❌ Test 3 Exception:', e);
        failed++;
    }

    // Test 4: Valid signature verification (HMAC-SHA256 match -> should return 200 OK)
    try {
        const orderId = 'order_test_999';
        const paymentId = 'pay_test_888';
        const secret = process.env.RAZORPAY_KEY_SECRET;

        const validSignature = crypto
            .createHmac('sha256', secret)
            .update(`${orderId}|${paymentId}`)
            .digest('hex');

        const res = await handleVerifyPaymentRequest({
            razorpay_order_id: orderId,
            razorpay_payment_id: paymentId,
            razorpay_signature: validSignature
        });

        if (res.status === 200 && res.data.success === true && res.data.order_id === orderId) {
            console.log('✅ Test 4: Correct HMAC-SHA256 signature verified with 200 OK');
            passed++;
        } else {
            console.error('❌ Test 4 Failed: Expected 200, got', res);
            failed++;
        }
    } catch (e) {
        console.error('❌ Test 4 Exception:', e);
        failed++;
    }

    // Test 5: Real Razorpay API Order Creation with live test credentials
    try {
        const res = await handleCreateOrderRequest({
            amount: 50000, // 50,000 paise = ₹500
            currency: 'INR',
            receipt: `rcpt_test_${Date.now()}`
        });

        if (res.status === 200 && res.data.order_id && res.data.order_id.startsWith('order_')) {
            console.log(`✅ Test 5: Live Razorpay order successfully created on API! Order ID: ${res.data.order_id}, Amount: ${res.data.amount} ${res.data.currency}`);
            passed++;
        } else {
            console.error('❌ Test 5 Failed: Order creation returned:', res);
            failed++;
        }
    } catch (e) {
        console.error('❌ Test 5 Exception:', e);
        failed++;
    }

    // Test 6: Auto-Success Payment Flow (Instant Demo Settlement)
    try {
        const res = await handleAutoSuccessPaymentRequest({
            amount: 25000, // 25,000 paise = ₹250
            currency: 'INR',
            receipt: `rcpt_auto_${Date.now()}`
        });

        if (res.status === 200 && res.data.success && res.data.razorpay_order_id && res.data.razorpay_signature) {
            // Verify the signature that was generated
            const verifyRes = await handleVerifyPaymentRequest({
                razorpay_order_id: res.data.razorpay_order_id,
                razorpay_payment_id: res.data.razorpay_payment_id,
                razorpay_signature: res.data.razorpay_signature
            });

            if (verifyRes.status === 200 && verifyRes.data.success) {
                console.log(`✅ Test 6: Auto-Success Payment created & HMAC verified! Order ID: ${res.data.razorpay_order_id}, Payment ID: ${res.data.razorpay_payment_id}`);
                passed++;
            } else {
                console.error('❌ Test 6 Failed on signature verification:', verifyRes);
                failed++;
            }
        } else {
            console.error('❌ Test 6 Failed: Auto-success returned:', res);
            failed++;
        }
    } catch (e) {
        console.error('❌ Test 6 Exception:', e);
        failed++;
    }

    console.log(`\n--- TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
