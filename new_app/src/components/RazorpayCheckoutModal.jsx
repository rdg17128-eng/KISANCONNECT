import React, { useState } from 'react';
import { openRazorpayCheckout, executeAutoSuccessPayment } from '../services/razorpayService';

export default function RazorpayCheckoutModal({
    isOpen,
    onClose,
    defaultAmount = 500,
    title = 'Razorpay Standard Web Checkout',
    description = 'Produce & Agricultural Trade Settlement',
    recipientName = 'KisanConnect Producer',
    recipientPhone = '',
    onPaymentSuccess,
    metadata = {}
}) {
    const [amount, setAmount] = useState(defaultAmount);
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState('IDLE'); // IDLE, CREATING_ORDER, AWAITING_PAYMENT, VERIFYING, SUCCESS, ERROR
    const [statusMessage, setStatusMessage] = useState('');
    const [completedPayment, setCompletedPayment] = useState(null);

    if (!isOpen) return null;

    const handleInitiatePayment = async (e) => {
        e?.preventDefault();
        const numAmount = Number(amount);

        if (!numAmount || numAmount < 1) {
            setStatusMessage('Minimum amount must be at least ₹1.00 (100 paise).');
            setPaymentStatus('ERROR');
            return;
        }

        setIsProcessing(true);
        setPaymentStatus('CREATING_ORDER');
        setStatusMessage('Opening Razorpay Checkout Modal...');

        try {
            await openRazorpayCheckout({
                amountInRupees: numAmount,
                description,
                receipt: `rcpt_${Date.now()}`,
                prefill: {
                    name: recipientName || '',
                    contact: recipientPhone || ''
                },
                notes: {
                    recipient: recipientName || 'Farmer',
                    contact: recipientPhone || '',
                    ...metadata
                },
                onSuccess: (res) => {
                    const verifiedData = res.verification || res;
                    setPaymentStatus('SUCCESS');
                    setStatusMessage('Payment verified successfully via HMAC-SHA256!');
                    setIsProcessing(false);
                    setCompletedPayment({
                        razorpay_payment_id: res.razorpay_payment_id || verifiedData.payment_id,
                        razorpay_order_id: res.razorpay_order_id || verifiedData.order_id,
                        ...res
                    });
                    if (onPaymentSuccess) {
                        onPaymentSuccess(res);
                    }
                },
                onFailure: (err) => {
                    setPaymentStatus('ERROR');
                    setStatusMessage(err.message || 'Payment failed or was declined.');
                    setIsProcessing(false);
                },
                onDismiss: () => {
                    setPaymentStatus('IDLE');
                    setStatusMessage('');
                    setIsProcessing(false);
                }
            });
        } catch (err) {
            setPaymentStatus('ERROR');
            setStatusMessage(err.message || 'Could not initiate checkout.');
            setIsProcessing(false);
        }
    };

    const handleReset = () => {
        setPaymentStatus('IDLE');
        setStatusMessage('');
        setCompletedPayment(null);
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: '1rem'
        }}>
            <div style={{
                background: '#0d1511',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                borderRadius: '1.25rem',
                maxWidth: '520px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(2, 132, 199, 0.2)',
                color: '#e2e8f0',
                position: 'relative'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.5rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'linear-gradient(180deg, rgba(2, 132, 199, 0.1) 0%, transparent 100%)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '0.75rem',
                            background: 'rgba(2, 132, 199, 0.2)',
                            border: '1px solid rgba(56, 189, 248, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#38bdf8',
                            fontSize: '1.2rem'
                        }}>
                            <i className="fa-solid fa-shield-halved"></i>
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc', fontWeight: 700 }}>
                                {title}
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                                <span style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    padding: '0.15rem 0.45rem',
                                    borderRadius: '0.375rem',
                                    background: 'rgba(2, 132, 199, 0.2)',
                                    color: '#38bdf8',
                                    border: '1px solid rgba(56, 189, 248, 0.3)'
                                }}>
                                    Standard Web Checkout
                                </span>
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Razorpay Test Gateway</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '0.5rem',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#94a3b8',
                            cursor: 'pointer'
                        }}
                    >
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '1.5rem' }}>
                    {paymentStatus === 'SUCCESS' && completedPayment ? (
                        <div>
                            <div style={{
                                textAlign: 'center',
                                padding: '1.5rem 1rem',
                                background: 'rgba(16, 185, 129, 0.1)',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                borderRadius: '1rem',
                                marginBottom: '1.5rem'
                            }}>
                                <div style={{
                                    width: '60px',
                                    height: '60px',
                                    borderRadius: '50%',
                                    background: '#10b981',
                                    color: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.75rem',
                                    margin: '0 auto 1rem auto',
                                    boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)'
                                }}>
                                    <i className="fa-solid fa-check"></i>
                                </div>
                                <h3 style={{ margin: '0 0 0.35rem 0', color: '#34d399', fontSize: '1.3rem' }}>
                                    Payment Verified Successfully!
                                </h3>
                                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>
                                    Signature matched via HMAC-SHA256 verification on backend.
                                </p>
                            </div>

                            {/* Payment Receipt Details */}
                            <div style={{
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '0.85rem',
                                padding: '1.25rem',
                                marginBottom: '1.5rem',
                                fontSize: '0.88rem'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.6rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                                    <span style={{ color: '#94a3b8' }}>Amount Paid</span>
                                    <strong style={{ color: '#38bdf8', fontSize: '1.1rem' }}>₹{Number(amount).toLocaleString('en-IN')}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                                    <span style={{ color: '#94a3b8' }}>Payment ID</span>
                                    <span style={{ fontFamily: 'monospace', color: '#f1f5f9', fontWeight: 600 }}>{completedPayment.razorpay_payment_id}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                                    <span style={{ color: '#94a3b8' }}>Order ID</span>
                                    <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{completedPayment.razorpay_order_id}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.6rem' }}>
                                    <span style={{ color: '#94a3b8' }}>Verification Status</span>
                                    <span style={{ color: '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <i className="fa-solid fa-circle-check"></i> 200 OK (Verified)
                                    </span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button
                                    onClick={handleReset}
                                    style={{
                                        flex: 1,
                                        padding: '0.75rem',
                                        borderRadius: '0.625rem',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        color: '#e2e8f0',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Make Another Payment
                                </button>
                                <button
                                    onClick={onClose}
                                    style={{
                                        flex: 1.2,
                                        padding: '0.75rem',
                                        borderRadius: '0.625rem',
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        border: 'none',
                                        color: '#ffffff',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleInitiatePayment}>
                            {/* Summary Card */}
                            <div style={{
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '0.85rem',
                                padding: '1rem',
                                marginBottom: '1.25rem'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Recipient</span>
                                    <strong style={{ color: '#f1f5f9', fontSize: '0.9rem' }}>{recipientName}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Purpose</span>
                                    <span style={{ color: '#cbd5e1', fontSize: '0.82rem' }}>{description}</span>
                                </div>
                            </div>

                            {/* Amount Input */}
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}>
                                    Amount to Pay (INR ₹)
                                </label>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    background: 'rgba(255, 255, 255, 0.04)',
                                    border: '1px solid rgba(56, 189, 248, 0.3)',
                                    borderRadius: '0.625rem',
                                    padding: '0.75rem 1rem'
                                }}>
                                    <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#38bdf8', marginRight: '0.5rem' }}>₹</span>
                                    <input
                                        type="number"
                                        min="1"
                                        step="any"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        disabled={isProcessing}
                                        required
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#ffffff',
                                            fontSize: '1.35rem',
                                            fontWeight: 700,
                                            width: '100%',
                                            outline: 'none'
                                        }}
                                    />
                                    <span style={{ color: '#64748b', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                        ({Math.round(Number(amount || 0) * 100)} paise)
                                    </span>
                                </div>

                                {/* Preset Amount Chips */}
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
                                    {[1, 50, 100, 500, 2500].map((preset) => (
                                        <button
                                            key={preset}
                                            type="button"
                                            onClick={() => setAmount(preset)}
                                            style={{
                                                background: amount == preset ? 'rgba(2, 132, 199, 0.3)' : 'rgba(255, 255, 255, 0.04)',
                                                border: amount == preset ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                                                color: amount == preset ? '#38bdf8' : '#94a3b8',
                                                borderRadius: '0.5rem',
                                                padding: '0.35rem 0.65rem',
                                                fontSize: '0.78rem',
                                                cursor: 'pointer',
                                                fontWeight: 600
                                            }}
                                        >
                                            ₹{preset}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Workflow Steps Indicator */}
                            <div style={{
                                background: 'rgba(2, 132, 199, 0.06)',
                                border: '1px solid rgba(56, 189, 248, 0.15)',
                                borderRadius: '0.75rem',
                                padding: '0.85rem',
                                marginBottom: '1.25rem',
                                fontSize: '0.78rem',
                                color: '#94a3b8'
                            }}>
                                <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <i className="fa-solid fa-code-commit"></i> Razorpay Standard 3-Step Verification
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center', marginTop: '0.5rem' }}>
                                    <div style={{
                                        padding: '0.45rem',
                                        borderRadius: '0.375rem',
                                        background: isProcessing ? 'rgba(2, 132, 199, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                                        border: '1px solid rgba(56, 189, 248, 0.2)'
                                    }}>
                                        1. Create Order
                                    </div>
                                    <div style={{
                                        padding: '0.45rem',
                                        borderRadius: '0.375rem',
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        border: '1px solid rgba(255, 255, 255, 0.06)'
                                    }}>
                                        2. Checkout Modal
                                    </div>
                                    <div style={{
                                        padding: '0.45rem',
                                        borderRadius: '0.375rem',
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        border: '1px solid rgba(255, 255, 255, 0.06)'
                                    }}>
                                        3. Verify HMAC
                                    </div>
                                </div>
                            </div>

                            {/* Status or Error Messages */}
                            {statusMessage && (
                                <div style={{
                                    padding: '0.75rem',
                                    borderRadius: '0.5rem',
                                    marginBottom: '1rem',
                                    fontSize: '0.82rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    background: paymentStatus === 'ERROR' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(2, 132, 199, 0.15)',
                                    color: paymentStatus === 'ERROR' ? '#fca5a5' : '#7dd3fc',
                                    border: paymentStatus === 'ERROR' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(2, 132, 199, 0.3)'
                                }}>
                                    <i className={paymentStatus === 'ERROR' ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-spinner fa-spin'}></i>
                                    <span>{statusMessage}</span>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={isProcessing}
                                    style={{
                                        flex: 1,
                                        padding: '0.85rem',
                                        borderRadius: '0.625rem',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        color: '#cbd5e1',
                                        fontWeight: 600,
                                        cursor: isProcessing ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isProcessing}
                                    style={{
                                        flex: 1.6,
                                        padding: '0.85rem',
                                        borderRadius: '0.625rem',
                                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                                        border: '1px solid rgba(56, 189, 248, 0.5)',
                                        color: '#ffffff',
                                        fontWeight: 700,
                                        cursor: isProcessing ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        boxShadow: '0 4px 15px rgba(2, 132, 199, 0.3)'
                                    }}
                                >
                                    {isProcessing ? (
                                        <>
                                            <i className="fa-solid fa-spinner fa-spin"></i>
                                            <span>Processing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-bolt"></i>
                                            <span>Pay ₹{Number(amount).toLocaleString('en-IN')} with Razorpay</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
