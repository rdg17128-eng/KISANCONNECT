import React, { useState } from 'react';
import { openRazorpayCheckout } from '../services/razorpayService';

export default function RazorpayCheckoutButton({
    amountInRupees,
    amountInPaise,
    description = 'KisanConnect Payment',
    receipt,
    prefill = {},
    notes = {},
    buttonText = 'Pay with Razorpay',
    className = 'primary-btn',
    style = {},
    onSuccess,
    onFailure,
    onDismiss,
    showIcon = true,
    disabled = false
}) {
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const handlePay = async (e) => {
        e?.preventDefault();
        e?.stopPropagation();
        setErrorMessage('');
        setIsLoading(true);

        try {
            await openRazorpayCheckout({
                amountInRupees,
                amountInPaise,
                description,
                receipt,
                prefill,
                notes,
                onSuccess: (res) => {
                    setIsLoading(false);
                    if (onSuccess) onSuccess(res);
                },
                onFailure: (err) => {
                    setIsLoading(false);
                    setErrorMessage(err.message || 'Payment failed.');
                    if (onFailure) onFailure(err);
                },
                onDismiss: () => {
                    setIsLoading(false);
                    if (onDismiss) onDismiss();
                }
            });
        } catch (err) {
            setIsLoading(false);
            setErrorMessage(err.message || 'Could not initiate payment.');
            if (onFailure) onFailure(err);
        }
    };

    return (
        <div style={{ display: 'inline-block' }}>
            <button
                type="button"
                className={className}
                onClick={handlePay}
                disabled={disabled || isLoading}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    color: '#ffffff',
                    fontWeight: 700,
                    borderRadius: '0.625rem',
                    padding: '0.65rem 1.25rem',
                    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
                    ...style
                }}
            >
                {isLoading ? (
                    <>
                        <i className="fa-solid fa-spinner fa-spin"></i>
                        <span>Connecting Razorpay...</span>
                    </>
                ) : (
                    <>
                        {showIcon && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                <i className="fa-solid fa-shield-halved" style={{ color: '#38bdf8' }}></i>
                            </span>
                        )}
                        <span>{buttonText}</span>
                    </>
                )}
            </button>
            {errorMessage && (
                <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.35rem' }}>
                    <i className="fa-solid fa-circle-exclamation"></i> {errorMessage}
                </div>
            )}
        </div>
    );
}
