import React, { useState } from 'react';
import kisanService from '../services/kisanService';
import KisanLogo from './KisanLogo';

export default function SandboxPayoutModal({
    isOpen,
    onClose,
    farmerPhone,
    bankDetails = {},
    defaultAmount = 25000,
    onPaymentSuccess
}) {
    const [amount, setAmount] = useState(defaultAmount);
    const [paymentMethod, setPaymentMethod] = useState('Direct Bank Transfer (NEFT/RTGS)');
    const [remarks, setRemarks] = useState('Produce settlement payout (Paddy 10 Tons)');
    const [isProcessing, setIsProcessing] = useState(false);
    const [receipt, setReceipt] = useState(null);

    if (!isOpen) return null;

    const handleExecuteDemoPayout = async (e) => {
        e?.preventDefault();
        setIsProcessing(true);

        try {
            await new Promise(r => setTimeout(r, 1200));

            const result = kisanService.createSandboxPayout({
                farmerPhone,
                amount: Number(amount),
                paymentMethod,
                bankDetails,
                referenceNote: remarks
            });

            setReceipt(result);
            if (onPaymentSuccess) {
                onPaymentSuccess(result);
            }
        } catch (err) {
            console.error('Demo payout error:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReset = () => {
        setReceipt(null);
    };

    const maskedAcc = bankDetails.accountNumber ? `••••••••${bankDetails.accountNumber.slice(-4)}` : '••••••••4589';

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '1rem'
        }}>
            <div style={{
                background: '#0e1713',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: '1.25rem',
                maxWidth: '540px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
                padding: '1.75rem',
                color: '#fff',
                position: 'relative'
            }}>
                {/* Close Button */}
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '1.25rem',
                        right: '1.25rem',
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: 'none',
                        color: '#fff',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    ✕
                </button>

                {/* Header with Sandbox Pill */}
                <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                        <span style={{
                            background: 'rgba(245, 158, 11, 0.2)',
                            color: 'var(--accent-gold)',
                            border: '1px solid rgba(245, 158, 11, 0.5)',
                            padding: '0.2rem 0.65rem',
                            borderRadius: '2rem',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            letterSpacing: '0.05em'
                        }}>
                            SANDBOX / DEMO PAYMENT
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Simulated DBT / UPI Gateway
                        </span>
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                        {receipt ? 'Payment Receipt (Demo)' : 'Test Direct Bank Payout'}
                    </h3>
                </div>

                {!receipt ? (
                    <div>
                        {/* Simulation Notice */}
                        <div style={{
                            background: 'rgba(245, 158, 11, 0.1)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            borderRadius: '0.75rem',
                            padding: '0.75rem 1rem',
                            marginBottom: '1.25rem',
                            fontSize: '0.8rem',
                            color: '#fef3c7',
                            display: 'flex',
                            gap: '0.6rem'
                        }}>
                            <i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--accent-gold)', flexShrink: 0, marginTop: '2px' }}></i>
                            <div>
                                <strong>Sandbox Notice:</strong> This simulates the mill-to-farmer payout flow using your verified bank passbook details. <em>No real money will be transferred or debited.</em>
                            </div>
                        </div>

                        {/* Beneficiary Target Card */}
                        <div style={{
                            background: 'rgba(0, 0, 0, 0.35)',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            borderRadius: '0.75rem',
                            padding: '1rem',
                            marginBottom: '1.25rem'
                        }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: 700 }}>
                                Destination Account (From Passbook)
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem', fontSize: '0.85rem' }}>
                                <div>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block' }}>Account Holder</span>
                                    <strong>{bankDetails.accountHolder || 'Farmer'}</strong>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block' }}>Bank Name</span>
                                    <strong>{bankDetails.bankName || 'State Bank of India'}</strong>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block' }}>Account Number</span>
                                    <strong style={{ fontFamily: 'monospace' }}>{maskedAcc}</strong>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block' }}>IFSC Code</span>
                                    <strong style={{ fontFamily: 'monospace' }}>{bankDetails.ifscCode || 'SBIN0004521'}</strong>
                                </div>
                            </div>
                        </div>

                        {/* Payment Configuration Form */}
                        <form onSubmit={handleExecuteDemoPayout} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="form-group-modern">
                                <label>Payment Method</label>
                                <div className="input-with-icon">
                                    <i className="fa-solid fa-money-bill-transfer field-icon"></i>
                                    <select
                                        value={paymentMethod}
                                        onChange={e => setPaymentMethod(e.target.value)}
                                        style={{ width: '100%', background: '#13211a', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '0.5rem', padding: '0.75rem 0.75rem 0.75rem 2.5rem' }}
                                    >
                                        <option value="Direct Bank Transfer (NEFT/RTGS)">Direct Bank Transfer (NEFT / RTGS)</option>
                                        <option value="UPI Instant DBT">UPI Instant DBT ({bankDetails.upiId || `${farmerPhone}@upi`})</option>
                                        <option value="IMPS Immediate Payment">IMPS Immediate Payment</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group-modern">
                                <label>Payout Amount (₹)</label>
                                <div className="input-with-icon">
                                    <i className="fa-solid fa-indian-rupee-sign field-icon"></i>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        min="100"
                                        max="5000000"
                                        required
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                                    {[10000, 25000, 50000, 100000].map(val => (
                                        <button
                                            key={val}
                                            type="button"
                                            onClick={() => setAmount(val)}
                                            style={{
                                                background: amount === val ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                                                border: `1px solid ${amount === val ? 'var(--primary)' : 'rgba(255, 255, 255, 0.1)'}`,
                                                color: amount === val ? 'var(--primary)' : 'var(--text-muted)',
                                                padding: '0.2rem 0.5rem',
                                                borderRadius: '0.35rem',
                                                fontSize: '0.75rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            ₹{val.toLocaleString('en-IN')}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group-modern">
                                <label>Payment Note / Description</label>
                                <div className="input-with-icon">
                                    <i className="fa-solid fa-file-invoice field-icon"></i>
                                    <input
                                        type="text"
                                        value={remarks}
                                        onChange={e => setRemarks(e.target.value)}
                                        placeholder="Reason for transfer"
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    className="action-btn"
                                    onClick={onClose}
                                    style={{ padding: '0.65rem 1.25rem' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="primary-btn"
                                    disabled={isProcessing}
                                    style={{
                                        padding: '0.65rem 1.5rem',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        minWidth: '200px',
                                        justifyContent: 'center',
                                        background: 'linear-gradient(135deg, #10b981, #059669)'
                                    }}
                                >
                                    {isProcessing ? (
                                        <>
                                            <i className="fa-solid fa-circle-notch fa-spin"></i>
                                            <span>Processing via Gateway...</span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-paper-plane"></i>
                                            <span>Execute Demo Payout</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                ) : (
                    /* Receipt View */
                    <div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                            <KisanLogo size="md" />
                            <div style={{ fontSize: '0.7rem', color: 'var(--primary)', marginTop: '0.3rem', fontWeight: 700, letterSpacing: '0.25px' }}>
                                Stronger Farms. Brighter Futures.
                            </div>
                        </div>

                        <div style={{
                            background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.15), rgba(0, 0, 0, 0.35))',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            borderRadius: '1rem',
                            padding: '1.5rem',
                            textAlign: 'center',
                            marginBottom: '1.25rem'
                        }}>
                            <div style={{
                                width: '54px',
                                height: '54px',
                                borderRadius: '50%',
                                background: 'rgba(16, 185, 129, 0.25)',
                                color: 'var(--primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 0.75rem',
                                fontSize: '1.75rem'
                            }}>
                                <i className="fa-solid fa-circle-check"></i>
                            </div>

                            <div style={{ fontSize: '0.78rem', color: 'var(--primary)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>
                                Demo Transfer Successful
                            </div>
                            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fff', margin: '0.25rem 0' }}>
                                ₹{receipt.amount?.toLocaleString('en-IN')}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                Credited via {receipt.paymentMethod}
                            </div>
                        </div>

                        {/* Receipt Meta Details */}
                        <div style={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '0.75rem',
                            padding: '1rem',
                            marginBottom: '1.25rem',
                            fontSize: '0.84rem'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Transaction Reference</span>
                                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-gold)' }}>{receipt.transactionId}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Beneficiary Farmer</span>
                                <strong>{receipt.farmerName}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Destination Bank</span>
                                <strong>{receipt.bankName}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Account Number</span>
                                <span style={{ fontFamily: 'monospace' }}>{receipt.accountNumberMasked}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                <span style={{ color: 'var(--text-muted)' }}>IFSC Code</span>
                                <span style={{ fontFamily: 'monospace' }}>{receipt.ifscCode}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Timestamp</span>
                                <span>{new Date(receipt.timestamp).toLocaleString('en-IN')}</span>
                            </div>
                        </div>

                        {/* Note */}
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '1.25rem', fontStyle: 'italic' }}>
                            {receipt.settlementNote}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                className="action-btn"
                                onClick={handleReset}
                                style={{ padding: '0.65rem 1.25rem' }}
                            >
                                Test Another Transfer
                            </button>
                            <button
                                type="button"
                                className="primary-btn"
                                onClick={onClose}
                                style={{ padding: '0.65rem 1.5rem' }}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
