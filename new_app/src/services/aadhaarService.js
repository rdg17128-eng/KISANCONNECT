/**
 * Aadhaar Authentication Service (UIDAI Sandbox / Developer 2.5)
 * 
 * Handles client-side Aadhaar validation, OTP request dispatch to backend,
 * and OTP verification through secure backend/Supabase Edge Functions.
 */

// Verhoeff algorithm multiplication table
const VERHOEFF_D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];

// Verhoeff permutation table
const VERHOEFF_P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

/**
 * Validate 12-digit Aadhaar checksum with Verhoeff Algorithm
 */
export function validateVerhoeff(numStr) {
    if (!numStr || typeof numStr !== 'string') return false;
    let c = 0;
    const myArray = numStr.split('').reverse().map(Number);
    for (let i = 0; i < myArray.length; i++) {
        c = VERHOEFF_D[c][VERHOEFF_P[i % 8][myArray[i]]];
    }
    return c === 0;
}

/**
 * Validate Aadhaar (12 digits) or VID (16 digits) format
 */
export function validateAadhaarInput(val) {
    const clean = String(val || '').replace(/\D/g, '');
    if (clean.length === 12) {
        // Allow 9999... test sandbox UIDs or validate Verhoeff
        if (clean.startsWith('9999') || clean.startsWith('0000')) {
            return { valid: true, type: 'AADHAAR_TEST', clean };
        }
        const isValidChecksum = validateVerhoeff(clean);
        return { valid: isValidChecksum, type: 'AADHAAR', clean };
    }
    if (clean.length === 16) {
        return { valid: true, type: 'VID', clean };
    }
    return { valid: false, type: 'INVALID', clean };
}

/**
 * Format string as XXXX XXXX XXXX or XXXX XXXX XXXX XXXX
 */
export function formatAadhaarNumber(val) {
    const clean = String(val || '').replace(/\D/g, '').slice(0, 16);
    const parts = [];
    for (let i = 0; i < clean.length; i += 4) {
        parts.push(clean.substring(i, i + 4));
    }
    return parts.join(' ');
}

/**
 * Mask Aadhaar Number (e.g. XXXX XXXX 1234)
 */
export function maskAadhaarNumber(val) {
    const clean = String(val || '').replace(/\D/g, '');
    if (clean.length < 4) return 'XXXX XXXX XXXX';
    const last4 = clean.slice(-4);
    if (clean.length > 12) {
        return `XXXX XXXX XXXX ${last4}`;
    }
    return `XXXX XXXX ${last4}`;
}

/**
 * Send Aadhaar OTP through backend proxy / Supabase Edge function
 * @param {Object} params
 * @param {string} params.uid Clean 12-digit Aadhaar or 16-digit VID
 * @param {boolean} params.consent Explicit user consent flag
 */
export async function sendAadhaarOtp({ uid, consent }) {
    if (!consent) {
        throw new Error('User consent is mandatory for Aadhaar authentication.');
    }

    const cleanUid = String(uid || '').replace(/\D/g, '');
    if (cleanUid.length !== 12 && cleanUid.length !== 16) {
        throw new Error('Please enter a valid 12-digit Aadhaar Number or 16-digit VID.');
    }

    const res = await fetch('/api/aadhaar/send-otp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            uid: cleanUid,
            consent: true
        })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
        const errorMsg = data.error || data.message || 'Failed to send Aadhaar OTP. Please try again.';
        throw new Error(errorMsg);
    }

    return data; // { success: true, txn: string, maskedMobileHint?: string, message: string }
}

/**
 * Verify Aadhaar OTP & authenticate session through backend
 * @param {Object} params
 * @param {string} params.uid Clean 12-digit Aadhaar or 16-digit VID
 * @param {string} params.otp 6-digit OTP
 * @param {string} params.txn Transaction ID from sendAadhaarOtp
 * @param {string} [params.role='farmers'] Target role
 */
export async function verifyAadhaarOtp({ uid, otp, txn, role = 'farmers' }) {
    const cleanUid = String(uid || '').replace(/\D/g, '');
    const cleanOtp = String(otp || '').trim();

    if (!cleanOtp || cleanOtp.length < 4 || cleanOtp.length > 8) {
        throw new Error('Please enter a valid 6-digit OTP.');
    }

    const res = await fetch('/api/aadhaar/verify', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            uid: cleanUid,
            otp: cleanOtp,
            txn: txn || '',
            role
        })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
        const errorMsg = data.error || data.message || 'Aadhaar verification failed. Please check your OTP and try again.';
        throw new Error(errorMsg);
    }

    return data; // { success: true, verified: true, accountExists: boolean, user?: Object, aadhaarReference?: string }
}
