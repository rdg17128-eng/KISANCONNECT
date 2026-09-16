import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
    formatAadhaarNumber,
    maskAadhaarNumber,
    validateAadhaarInput,
    sendAadhaarOtp,
    verifyAadhaarOtp
} from '../services/aadhaarService';
import KisanLogo from './KisanLogo';

export default function AadhaarLoginModal({ isOpen, onClose, onLoginSuccess, onRegisterNewFarmer }) {
    const { loginWithPhone } = useAuth();
    const { t } = useLanguage();

    const [step, setStep] = useState('input'); // 'input' | 'otp' | 'not_found' | 'success'
    const [rawAadhaar, setRawAadhaar] = useState('');
    const [consent, setConsent] = useState(false);
    const [otp, setOtp] = useState('');
    const [txnId, setTxnId] = useState('');
    const [maskedUid, setMaskedUid] = useState('');
    const [aadhaarReference, setAadhaarReference] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [countdown, setCountdown] = useState(0);
    const [sandboxHint, setSandboxHint] = useState('');

    // Timer for Resend OTP countdown
    useEffect(() => {
        let timer;
        if (countdown > 0) {
            timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [countdown]);

    if (!isOpen) return null;

    const validation = validateAadhaarInput(rawAadhaar);
    const cleanDigits = rawAadhaar.replace(/\D/g, '');

    const handleAadhaarChange = (e) => {
        const val = e.target.value;
        const formatted = formatAadhaarNumber(val);
        setRawAadhaar(formatted);
        setError('');
    };

    // Step 1: Send OTP
    const handleSendOtp = async (e) => {
        if (e) e.preventDefault();
        setError('');

        if (!consent) {
            setError('Please accept the consent checkbox to proceed with Aadhaar authentication.');
            return;
        }

        if (cleanDigits.length !== 12 && cleanDigits.length !== 16) {
            setError('Please enter a 12-digit Aadhaar Number or 16-digit VID.');
            return;
        }

        setLoading(true);
        try {
            const res = await sendAadhaarOtp({
                uid: cleanDigits,
                consent: true
            });

            setTxnId(res.txn || '');
            setMaskedUid(res.maskedUid || maskAadhaarNumber(cleanDigits));
            setStep('otp');
            setCountdown(30);
            if (res.sandboxHint) {
                setSandboxHint(res.sandboxHint);
            }
        } catch (err) {
            setError(err.message || 'Failed to send Aadhaar OTP. Please check your details and try again.');
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Verify OTP & Authenticate
    const handleVerifyOtp = async (e) => {
        if (e) e.preventDefault();
        setError('');

        const cleanOtp = otp.trim();
        if (cleanOtp.length < 4) {
            setError('Please enter the 6-digit OTP sent to your registered mobile.');
            return;
        }

        setLoading(true);
        try {
            const res = await verifyAadhaarOtp({
                uid: cleanDigits,
                otp: cleanOtp,
                txn: txnId,
                role: 'farmers'
            });

            if (res.accountExists && res.user) {
                // Farmer account found!
                setStep('success');
                loginWithPhone(res.user, 'farmers');
                setTimeout(() => {
                    if (onLoginSuccess) onLoginSuccess(res.user);
                    onClose();
                }, 1200);
            } else {
                // Account not found (Section 9 requirement)
                setAadhaarReference(res.aadhaarReference || '');
                setStep('not_found');
            }
        } catch (err) {
            setError(err.message || 'Aadhaar verification failed. Please check your Aadhaar details and OTP and try again.');
        } finally {
            setLoading(false);
        }
    };

    // Resend OTP
    const handleResendOtp = async () => {
        if (countdown > 0) return;
        setError('');
        setOtp('');
        setLoading(true);
        try {
            const res = await sendAadhaarOtp({
                uid: cleanDigits,
                consent: true
            });
            setTxnId(res.txn || '');
            setCountdown(30);
        } catch (err) {
            setError(err.message || 'Failed to resend OTP.');
        } finally {
            setLoading(false);
        }
    };

    // Handle user switching to new farmer registration with pre-verified Aadhaar
    const handleRegister = () => {
        if (onRegisterNewFarmer) {
            onRegisterNewFarmer({
                aadhaar_verified: true,
                aadhaar_auth_reference: aadhaarReference,
                masked_aadhaar: maskedUid
            });
        }
        onClose();
    };

    return (
        <div className="auth-modal" style={{ display: 'flex', zIndex: 1100 }}>
            <div className="auth-content" style={{ maxWidth: '460px', position: 'relative' }}>
                <span className="close-btn" onClick={onClose}>
                    <i className="fa-solid fa-xmark"></i>
                </span>

                {/* Sandbox Environment Banner */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    background: 'rgba(234, 179, 8, 0.12)',
                    border: '1px solid rgba(234, 179, 8, 0.35)',
                    color: '#facc15',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    padding: '0.35rem 0.75rem',
                    borderRadius: '2rem',
                    marginBottom: '1rem',
                    textAlign: 'center'
                }}>
                    <i className="fa-solid fa-flask-vial"></i>
                    <span>🧪 Aadhaar Authentication — TEST/SANDBOX (UIDAI 2.5)</span>
                </div>

                <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'center' }}>
                    <KisanLogo size="md" />
                </div>

                {/* ======================================================== */}
                {/* STEP 1: AADHAAR / VID INPUT & MANDATORY CONSENT */}
                {/* ======================================================== */}
                {step === 'input' && (
                    <div>
                        <h2 style={{ marginBottom: '0.2rem', textAlign: 'center', fontSize: '1.28rem' }}>
                            {t('aadhaarLoginTitle', 'Farmer Aadhaar Login')}
                        </h2>
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.82rem' }}>
                            {t('aadhaarLoginSub', 'Direct authentication using UIDAI OTP 2.5 sandbox verification')}
                        </p>

                        <form onSubmit={handleSendOtp}>
                            <div className="input-group" style={{ marginBottom: '0.85rem' }}>
                                <i className="fa-solid fa-id-card" style={{ color: 'var(--primary)' }}></i>
                                <input
                                    type="text"
                                    placeholder="Enter 12-digit Aadhaar or 16-digit VID"
                                    value={rawAadhaar}
                                    onChange={handleAadhaarChange}
                                    maxLength="19" // 16 digits + 3 spaces
                                    autoFocus
                                    style={{ letterSpacing: '1px', fontWeight: 600 }}
                                />
                            </div>

                            {/* Mandatory Consent Box */}
                            <label style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '0.65rem',
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '0.65rem',
                                padding: '0.75rem',
                                cursor: 'pointer',
                                fontSize: '0.78rem',
                                color: 'var(--text-muted)',
                                lineHeight: '1.45',
                                marginBottom: '1rem'
                            }}>
                                <input
                                    type="checkbox"
                                    checked={consent}
                                    onChange={(e) => {
                                        setConsent(e.target.checked);
                                        setError('');
                                    }}
                                    style={{ marginTop: '0.15rem', accentColor: 'var(--primary)', cursor: 'pointer' }}
                                />
                                <span>
                                    I voluntarily give my consent to <strong>KisanConnect</strong> to verify my identity via UIDAI Aadhaar 2.5 Sandbox for agricultural portal access.
                                </span>
                            </label>

                            {error && (
                                <div className="error-msg" style={{ color: 'var(--danger)', fontSize: '0.82rem', textAlign: 'center', marginBottom: '0.75rem' }}>
                                    <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '0.35rem' }}></i>
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="primary-btn"
                                style={{
                                    width: '100%',
                                    justifyContent: 'center',
                                    padding: '0.75rem',
                                    opacity: (!consent || !cleanDigits) ? 0.6 : 1
                                }}
                                disabled={loading || !consent || !cleanDigits}
                            >
                                {loading ? (
                                    <>
                                        <i className="fa-solid fa-circle-notch fa-spin" style={{ marginRight: '0.5rem' }}></i>
                                        Sending Aadhaar OTP...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-paper-plane" style={{ marginRight: '0.5rem' }}></i>
                                        Send OTP
                                    </>
                                )}
                            </button>

                            <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
                                <button
                                    type="button"
                                    className="text-btn"
                                    onClick={onClose}
                                    style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}
                                >
                                    ← Back to standard login
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* ======================================================== */}
                {/* STEP 2: VERIFY OTP SCREEN */}
                {/* ======================================================== */}
                {step === 'otp' && (
                    <div>
                        <h2 style={{ marginBottom: '0.2rem', textAlign: 'center', fontSize: '1.28rem' }}>
                            Verify Aadhaar OTP
                        </h2>
                        <div style={{
                            textAlign: 'center',
                            background: 'rgba(16, 185, 129, 0.08)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            borderRadius: '0.65rem',
                            padding: '0.65rem 0.85rem',
                            margin: '0.85rem 0 1.25rem',
                            fontSize: '0.82rem',
                            color: '#34d399'
                        }}>
                            <i className="fa-solid fa-shield-check" style={{ marginRight: '0.4rem' }}></i>
                            <span>OTP sent to your Aadhaar-registered mobile number.</span>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                Linked Aadhaar: <strong>{maskedUid}</strong>
                            </div>
                        </div>

                        <form onSubmit={handleVerifyOtp}>
                            <div className="input-group" style={{ marginBottom: '1rem' }}>
                                <i className="fa-solid fa-key" style={{ color: 'var(--primary)' }}></i>
                                <input
                                    type="text"
                                    placeholder="Enter 6-digit OTP (e.g. 123456)"
                                    value={otp}
                                    onChange={(e) => {
                                        setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                                        setError('');
                                    }}
                                    maxLength="6"
                                    autoFocus
                                    style={{ letterSpacing: '4px', fontSize: '1.1rem', textAlign: 'center', fontWeight: 700 }}
                                />
                            </div>

                            {sandboxHint && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--accent-gold)', textAlign: 'center', marginBottom: '0.75rem', opacity: 0.9 }}>
                                    <i className="fa-solid fa-circle-info" style={{ marginRight: '0.25rem' }}></i>
                                    {sandboxHint}
                                </div>
                            )}

                            {error && (
                                <div className="error-msg" style={{ color: 'var(--danger)', fontSize: '0.82rem', textAlign: 'center', marginBottom: '0.75rem' }}>
                                    <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '0.35rem' }}></i>
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="primary-btn"
                                style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
                                disabled={loading || otp.length < 4}
                            >
                                {loading ? (
                                    <>
                                        <i className="fa-solid fa-circle-notch fa-spin" style={{ marginRight: '0.5rem' }}></i>
                                        Verifying Aadhaar...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-check-to-slot" style={{ marginRight: '0.5rem' }}></i>
                                        Verify Aadhaar & Login
                                    </>
                                )}
                            </button>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                                <button
                                    type="button"
                                    className="text-btn"
                                    onClick={() => {
                                        setStep('input');
                                        setOtp('');
                                        setError('');
                                    }}
                                    style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}
                                >
                                    ← Change Aadhaar
                                </button>

                                <button
                                    type="button"
                                    className="text-btn"
                                    onClick={handleResendOtp}
                                    disabled={countdown > 0 || loading}
                                    style={{
                                        fontSize: '0.78rem',
                                        color: countdown > 0 ? 'var(--text-muted)' : 'var(--primary)',
                                        cursor: countdown > 0 ? 'default' : 'pointer'
                                    }}
                                >
                                    {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* ======================================================== */}
                {/* STEP 3A: SUCCESS STATE */}
                {/* ======================================================== */}
                {step === 'success' && (
                    <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            background: 'rgba(16, 185, 129, 0.2)',
                            color: '#10b981',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.75rem',
                            margin: '0 auto 1rem'
                        }}>
                            <i className="fa-solid fa-circle-check"></i>
                        </div>
                        <h3 style={{ color: '#34d399', fontSize: '1.25rem', marginBottom: '0.35rem' }}>
                            🟢 Aadhaar Authentication Successful
                        </h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                            Welcome to KisanConnect. Redirecting to your Farmer Dashboard...
                        </p>
                    </div>
                )}

                {/* ======================================================== */}
                {/* STEP 3B: NO FARMER ACCOUNT FOUND (Section 9) */}
                {/* ======================================================== */}
                {step === 'not_found' && (
                    <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                        <div style={{
                            width: '52px',
                            height: '52px',
                            borderRadius: '50%',
                            background: 'rgba(234, 179, 8, 0.18)',
                            color: '#facc15',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.6rem',
                            margin: '0 auto 0.85rem'
                        }}>
                            <i className="fa-solid fa-user-xmark"></i>
                        </div>
                        <h3 style={{ fontSize: '1.15rem', marginBottom: '0.35rem' }}>
                            No Farmer Account Found
                        </h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.25rem', lineHeight: '1.4' }}>
                            Aadhaar verified successfully (<strong>{maskedUid}</strong>), but no existing KisanConnect farmer profile is linked to this identity.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                            <button
                                type="button"
                                className="primary-btn"
                                style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
                                onClick={handleRegister}
                            >
                                <i className="fa-solid fa-tractor" style={{ marginRight: '0.4rem' }}></i>
                                Register as Farmer
                            </button>

                            <button
                                type="button"
                                className="text-btn"
                                onClick={() => {
                                    setStep('input');
                                    setOtp('');
                                    setError('');
                                }}
                                style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}
                            >
                                Try another Aadhaar / VID
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
