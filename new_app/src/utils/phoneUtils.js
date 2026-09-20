/**
 * KisanConnect Phone Number Normalization & Formatting Utilities
 * 
 * Ensures robust phone dialer integration (tel:+91XXXXXXXXXX) and
 * clean, readable presentation across Mill and Farmer portals.
 */

/**
 * Normalizes an Indian phone number into standard international dialer format: +91XXXXXXXXXX
 * Strips formatting, leading zeros, or redundant prefixes to prevent duplicates like +91+91...
 * 
 * @param {string|number} phone 
 * @returns {string} E.164 formatted Indian phone string (e.g. "+919876543210") or empty string
 */
export function normalizeTelPhone(phone) {
    if (!phone) return '';
    const str = String(phone).trim();
    if (!str) return '';

    // Strip all non-digit characters
    const digits = str.replace(/\D/g, '');
    if (!digits) return '';

    // If 12 digits starting with '91' (e.g. 919876543210)
    if (digits.length === 12 && digits.startsWith('91')) {
        return `+${digits}`;
    }

    // If 11 digits starting with '0' (e.g. 09876543210)
    if (digits.length === 11 && digits.startsWith('0')) {
        return `+91${digits.slice(1)}`;
    }

    // If standard 10-digit mobile number (e.g. 9876543210)
    if (digits.length === 10) {
        return `+91${digits}`;
    }

    // If more than 10 digits, take the last 10 digits as the mobile number
    if (digits.length > 10) {
        return `+91${digits.slice(-10)}`;
    }

    // Fallback for short numbers
    return `+91${digits}`;
}

/**
 * Formats a phone number for user-friendly UI display: "+91 98765 43210"
 * 
 * @param {string|number} phone 
 * @returns {string} Clean formatted display string (e.g. "+91 98765 43210")
 */
export function formatDisplayPhone(phone) {
    if (!phone) return 'Not Provided';
    const str = String(phone).trim();
    if (!str) return 'Not Provided';

    const digits = str.replace(/\D/g, '');
    let tenDigits = digits;

    if (digits.length === 12 && digits.startsWith('91')) {
        tenDigits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith('0')) {
        tenDigits = digits.slice(1);
    } else if (digits.length > 10) {
        tenDigits = digits.slice(-10);
    }

    if (tenDigits.length === 10) {
        return `+91 ${tenDigits.slice(0, 5)} ${tenDigits.slice(5)}`;
    }

    // Return original if non-standard length
    return str.startsWith('+') ? str : `+91 ${str}`;
}
