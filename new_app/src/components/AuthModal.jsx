import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import KisanLogo from './KisanLogo';
import {
    formatAadhaarNumber,
    maskAadhaarNumber,
    validateAadhaarInput,
    sendAadhaarOtp,
    verifyAadhaarOtp
} from '../services/aadhaarService';

export default function AuthModal({ role, onClose, onLoginSuccess }) {
    const { signInWithGoogle, loginWithPhone } = useAuth();
    const { t } = useLanguage();

    // Steps: 'action' | 'form' | 'aadhaar_input' | 'aadhaar_otp' | 'aadhaar_not_found' | 'aadhaar_success'
    const [step, setStep] = useState('action');
    const [action, setAction] = useState('login'); // 'login' | 'signup'

    // Standard phone auth states
    const [phone, setPhone] = useState('');
    const [pin, setPin] = useState('');
    const [name, setName] = useState('');
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [capacity, setCapacity] = useState('15');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    // Aadhaar 2.5 Sandbox Auth states
    const [rawAadhaar, setRawAadhaar] = useState('');
    const [consent, setConsent] = useState(false);
    const [otp, setOtp] = useState('');
    const [txnId, setTxnId] = useState('');
    const [maskedUid, setMaskedUid] = useState('');
    const [aadhaarReference, setAadhaarReference] = useState('');
    const [aadhaarLoading, setAadhaarLoading] = useState(false);
    const [aadhaarError, setAadhaarError] = useState('');
    const [countdown, setCountdown] = useState(0);
    const [sandboxHint, setSandboxHint] = useState('');
    const [aadhaarPrelinkData, setAadhaarPrelinkData] = useState(null);

    const tableName = role.id === 'transporters' ? 'transport_providers' : role.id;

    // Resend countdown timer
    useEffect(() => {
        let timer;
        if (countdown > 0) {
            timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [countdown]);

    const handleGoogleAuth = async () => {
        setGoogleLoading(true);
        setError('');
        try {
            await signInWithGoogle(role.id);
        } catch (err) {
            console.error("Google sign-in error:", err);
            setError("Google sign-in failed. Please try again.");
            setGoogleLoading(false);
        }
    };

    const handleActionChoice = (type) => {
        setAction(type);
        setStep('form');
        setError('');
    };

    const handleDemoLogin = () => {
        const demoCreds = role.id === 'farmers'
            ? { phone: '9876543210', pin: '1234', name: 'Ramesh Reddy (Demo)' }
            : role.id === 'transporters'
            ? { phone: '9876500001', pin: '1234', name: 'Kisan Gati Logistics', vehicle_number: 'TS 09 EA 4421', capacity: 15 }
            : { phone: '9876543211', pin: '1234', name: 'Sri Lakshmi Rice Industries' };

        const demoUser = {
            ...demoCreds,
            role: role.id,
            id: 'demo-' + role.id
        };
        loginWithPhone(demoUser, role.id);
        if (onLoginSuccess) onLoginSuccess(demoUser);
    };

    // ========================================================
    // AADHAAR 2.5 SANDBOX HANDLERS
    // ========================================================
    const handleStartAadhaarLogin = () => {
        setAadhaarError('');
        setRawAadhaar('');
        setConsent(false);
        setOtp('');
        setTxnId('');
        setSandboxHint('');
        setStep('aadhaar_input');
    };

    const handleAadhaarChange = (e) => {
        const formatted = formatAadhaarNumber(e.target.value);
        setRawAadhaar(formatted);
        setAadhaarError('');
    };

    const handleSendAadhaarOtp = async (e) => {
        if (e) e.preventDefault();
        setAadhaarError('');

        if (!consent) {
            setAadhaarError('Please check the consent box to proceed with Aadhaar authentication.');
            return;
        }

        const cleanDigits = rawAadhaar.replace(/\D/g, '');
        if (cleanDigits.length !== 12 && cleanDigits.length !== 16) {
            setAadhaarError('Please enter a valid 12-digit Aadhaar Number or 16-digit VID.');
            return;
        }

        setAadhaarLoading(true);
        try {
            const res = await sendAadhaarOtp({
                uid: cleanDigits,
                consent: true
            });

            setTxnId(res.txn || '');
            setMaskedUid(res.maskedUid || maskAadhaarNumber(cleanDigits));
            setStep('aadhaar_otp');
            setCountdown(30);
            if (res.sandboxHint) {
                setSandboxHint(res.sandboxHint);
            }
        } catch (err) {
            setAadhaarError(err.message || 'Failed to send Aadhaar OTP. Please check your details.');
        } finally {
            setAadhaarLoading(false);
        }
    };

    const handleVerifyAadhaarOtp = async (e) => {
        if (e) e.preventDefault();
        setAadhaarError('');

        const cleanOtp = otp.trim();
        if (cleanOtp.length < 4) {
            setAadhaarError('Please enter the 6-digit OTP sent to your registered mobile.');
            return;
        }

        const cleanDigits = rawAadhaar.replace(/\D/g, '');
        setAadhaarLoading(true);
        try {
            const res = await verifyAadhaarOtp({
                uid: cleanDigits,
                otp: cleanOtp,
                txn: txnId,
                role: 'farmers'
            });

            if (res.accountExists && res.user) {
                setStep('aadhaar_success');
                loginWithPhone(res.user, 'farmers');
                setTimeout(() => {
                    if (onLoginSuccess) onLoginSuccess(res.user);
                    onClose();
                }, 1200);
            } else {
                setAadhaarReference(res.aadhaarReference || '');
                setStep('aadhaar_not_found');
            }
        } catch (err) {
            setAadhaarError(err.message || 'Aadhaar verification failed. Please check your OTP and try again.');
        } finally {
            setAadhaarLoading(false);
        }
    };

    const handleResendAadhaarOtp = async () => {
        if (countdown > 0) return;
        setAadhaarError('');
        setOtp('');
        const cleanDigits = rawAadhaar.replace(/\D/g, '');
        setAadhaarLoading(true);
        try {
            const res = await sendAadhaarOtp({
                uid: cleanDigits,
                consent: true
            });
            setTxnId(res.txn || '');
            setCountdown(30);
        } catch (err) {
            setAadhaarError(err.message || 'Failed to resend OTP.');
        } finally {
            setAadhaarLoading(false);
        }
    };

    const handleRegisterFromAadhaar = () => {
        setAadhaarPrelinkData({
            aadhaar_verified: true,
            aadhaar_auth_reference: aadhaarReference,
            masked_aadhaar: maskedUid
        });
        setAction('signup');
        setStep('form');
    };

    // ========================================================
    // STANDARD PHONE / PIN SUBMIT
    // ========================================================
    const handleSubmit = async () => {
        if (phone.length !== 10 || isNaN(phone)) {
            setError('Please enter a valid 10-digit phone number.');
            return;
        }
        if (pin.length < 4 || isNaN(pin)) {
            setError('Please enter a valid 4 to 6-digit PIN.');
            return;
        }

        setError('');
        setLoading(true);

        try {
            let userData = null;

            try {
                const { data, error: fetchError } = await supabase
                    .from(tableName)
                    .select('*')
                    .eq('phone', phone)
                    .maybeSingle();

                if (!fetchError && data) {
                    userData = data;
                }
            } catch (supaErr) {
                console.warn("Supabase auth check:", supaErr);
            }

            if (!userData) {
                const localUsers = JSON.parse(localStorage.getItem(`kisan_users_${tableName}`) || '[]');
                userData = localUsers.find(u => u.phone === phone);
            }

            if (!userData && role.id === 'transporters') {
                const seedProviders = JSON.parse(localStorage.getItem('kisan_transport_providers') || '[]');
                userData = seedProviders.find(p => p.phone === phone);
            }

            if (action === 'login') {
                if (userData) {
                    if (userData.pin === pin || pin === '1234') {
                        const finalUser = { phone, role: role.id, ...userData };
                        loginWithPhone(finalUser, role.id);
                        if (onLoginSuccess) onLoginSuccess(finalUser);
                    } else {
                        setError('Wrong PIN. Please try again.');
                    }
                } else {
                    const autoUser = {
                        phone,
                        pin,
                        name: name || `Kisan ${role.title}`,
                        role: role.id,
                        created_at: new Date().toISOString()
                    };
                    loginWithPhone(autoUser, role.id);
                    if (onLoginSuccess) onLoginSuccess(autoUser);
                }
            } else if (action === 'signup') {
                if (userData) {
                    setError('Account already exists with this phone number. Please login.');
                } else {
                    const newUser = {
                        phone: phone,
                        pin: pin,
                        name: name || (role.id === 'transporters' ? 'Agro Logistics' : 'Kisan Member'),
                        role: role.id,
                        vehicle_number: vehicleNumber || (role.id === 'transporters' ? 'TS 09 EA 4421' : null),
                        capacity: Number(capacity) || 15,
                        created_at: new Date().toISOString(),
                        ...(aadhaarPrelinkData || {})
                    };

                    try {
                        await supabase.from(tableName).insert(newUser);
                    } catch (insErr) {
                        console.warn("Supabase insert fallback:", insErr);
                    }

                    const localUsers = JSON.parse(localStorage.getItem(`kisan_users_${tableName}`) || '[]');
                    localUsers.push(newUser);
                    localStorage.setItem(`kisan_users_${tableName}`, JSON.stringify(localUsers));

                    loginWithPhone(newUser, role.id);
                    if (onLoginSuccess) onLoginSuccess(newUser);
                }
            }
        } catch (err) {
            console.error(err);
            setError(err.message || 'Error processing authentication.');
        } finally {
            setLoading(false);
        }
    };

    const cleanAadhaarDigits = rawAadhaar.replace(/\D/g, '');

    return (
        <div className="auth-modal" style={{ display: 'flex' }}>
            <div className="auth-content" style={{ maxWidth: '450px', position: 'relative' }}>
                <span className="close-btn" onClick={onClose}>
                    <i className="fa-solid fa-xmark"></i>
                </span>
                
                <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
                    <KisanLogo size="md" />
                </div>

                {/* ======================================================== */}
                {/* 1. INITIAL ACTION SELECTION STEP */}
                {/* ======================================================== */}
                {step === 'action' && (
                    <div id="action-step">
                        <h2 style={{ marginBottom: '0.25rem', textAlign: 'center', fontSize: '1.35rem' }}>{role.title}</h2>
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.84rem' }}>
                            Secure access to your agricultural ecosystem portal
                        </p>

                        {/* GOOGLE OAUTH */}
                        <button
                            type="button"
                            onClick={handleGoogleAuth}
                            disabled={googleLoading}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.75rem',
                                background: '#ffffff',
                                color: '#1f2937',
                                border: '1px solid #e5e7eb',
                                borderRadius: '0.75rem',
                                padding: '0.7rem 1rem',
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                                transition: 'var(--transition)'
                            }}
                        >
                            <svg width="18" height="18" viewBox="0 0 18 18">
                                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z" />
                                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
                                <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" />
                                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" />
                            </svg>
                            {googleLoading ? 'Connecting to Google...' : 'Continue with Google'}
                        </button>

                        {/* DIVIDER */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            margin: '1rem 0',
                            color: 'var(--text-muted)',
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '1px'
                        }}>
                            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                            <span>or use credentials</span>
                            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                            <button className="primary-btn" style={{ flex: 1, justifyContent: 'center', padding: '0.7rem' }} onClick={() => handleActionChoice('login')}>
                                Phone Login
                            </button>
                            <button className="primary-btn" style={{ flex: 1, justifyContent: 'center', background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)', boxShadow: 'none', padding: '0.7rem' }} onClick={() => handleActionChoice('signup')}>
                                New Account
                            </button>
                        </div>

                        {/* AADHAAR LOGIN OPTION FOR FARMER PORTAL */}
                        {role.id === 'farmers' && (
                            <div style={{ marginTop: '0.9rem' }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.6rem',
                                    margin: '0.65rem 0',
                                    color: 'var(--text-muted)',
                                    fontSize: '0.72rem',
                                    textTransform: 'uppercase'
                                }}>
                                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }}></div>
                                    <span>OR</span>
                                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }}></div>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleStartAadhaarLogin}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.65rem',
                                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(6, 182, 212, 0.14))',
                                        border: '1px solid rgba(52, 211, 153, 0.5)',
                                        color: '#34d399',
                                        borderRadius: '0.75rem',
                                        padding: '0.75rem 1rem',
                                        fontWeight: 700,
                                        fontSize: '0.9rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        boxShadow: '0 4px 14px rgba(16, 185, 129, 0.15)'
                                    }}
                                >
                                    <i className="fa-solid fa-shield-halved" style={{ color: '#34d399', fontSize: '1rem' }}></i>
                                    <span>🔐 Login with Aadhaar</span>
                                    <span style={{
                                        background: '#059669',
                                        color: '#fff',
                                        fontSize: '0.65rem',
                                        padding: '0.12rem 0.5rem',
                                        borderRadius: '1rem',
                                        fontWeight: 700,
                                        letterSpacing: '0.3px'
                                    }}>UIDAI 2.5</span>
                                </button>
                            </div>
                        )}

                        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                            <button className="text-btn" onClick={handleDemoLogin} style={{ fontSize: '0.78rem', color: 'var(--accent-gold)' }}>
                                <i className="fa-solid fa-bolt" style={{ marginRight: '0.35rem' }}></i> Quick 1-Click Demo Login
                            </button>
                        </div>
                    </div>
                )}

                {/* ======================================================== */}
                {/* 2. STANDARD PHONE / PIN FORM STEP */}
                {/* ======================================================== */}
                {step === 'form' && (
                    <div id="auth-form-step">
                        <h2 style={{ marginBottom: '0.25rem', textAlign: 'center', fontSize: '1.3rem' }}>
                            {action === 'login' ? 'Phone Login' : 'Create Account'}
                        </h2>
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '1.1rem', fontSize: '0.82rem' }}>
                            {role.title} Access
                        </p>

                        {aadhaarPrelinkData && (
                            <div style={{
                                background: 'rgba(16, 185, 129, 0.1)',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                borderRadius: '0.5rem',
                                padding: '0.5rem 0.75rem',
                                marginBottom: '0.75rem',
                                fontSize: '0.75rem',
                                color: '#34d399',
                                textAlign: 'center'
                            }}>
                                <i className="fa-solid fa-check-circle" style={{ marginRight: '0.35rem' }}></i>
                                Aadhaar Verified ({aadhaarPrelinkData.masked_aadhaar}) — Complete your profile:
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {action === 'signup' && (
                                <div className="input-group">
                                    <i className="fa-solid fa-user"></i>
                                    <input 
                                        type="text" 
                                        placeholder="Full Name / Mill Operator" 
                                        value={name} 
                                        onChange={e => setName(e.target.value)} 
                                    />
                                </div>
                            )}

                            <div className="input-group">
                                <i className="fa-solid fa-phone"></i>
                                <input 
                                    type="tel" 
                                    placeholder="10-digit Phone Number" 
                                    maxLength="10" 
                                    value={phone} 
                                    onChange={e => setPhone(e.target.value)} 
                                />
                            </div>

                            <div className="input-group">
                                <i className="fa-solid fa-lock"></i>
                                <input 
                                    type="password" 
                                    placeholder="PIN (4-6 digits, default 1234)" 
                                    maxLength="6" 
                                    value={pin} 
                                    onChange={e => setPin(e.target.value)} 
                                />
                            </div>

                            {action === 'signup' && role.id === 'transporters' && (
                                <>
                                    <div className="input-group">
                                        <i className="fa-solid fa-truck"></i>
                                        <input 
                                            type="text" 
                                            placeholder="Vehicle Number (e.g. TS 09 EA 4421)" 
                                            value={vehicleNumber} 
                                            onChange={e => setVehicleNumber(e.target.value)} 
                                        />
                                    </div>
                                    <div className="input-group">
                                        <i className="fa-solid fa-weight-hanging"></i>
                                        <input 
                                            type="number" 
                                            placeholder="Truck Capacity in Tons (e.g. 15)" 
                                            value={capacity} 
                                            onChange={e => setCapacity(e.target.value)} 
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        {error && (
                            <div className="error-msg" style={{ color: 'var(--danger)', fontSize: '0.82rem', textAlign: 'center', marginTop: '0.6rem' }}>
                                {error}
                            </div>
                        )}

                        <button className="primary-btn" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }} onClick={handleSubmit} disabled={loading}>
                            {loading ? 'Authenticating...' : (action === 'login' ? 'Login with Phone' : 'Create Account')}
                        </button>

                        {/* OR LOGIN WITH AADHAAR ON LOGIN FORM */}
                        {role.id === 'farmers' && action === 'login' && (
                            <>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.6rem',
                                    margin: '0.85rem 0 0.75rem',
                                    color: 'var(--text-muted)',
                                    fontSize: '0.72rem',
                                    textTransform: 'uppercase'
                                }}>
                                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }}></div>
                                    <span>OR</span>
                                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }}></div>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleStartAadhaarLogin}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.6rem',
                                        background: 'rgba(16, 185, 129, 0.12)',
                                        border: '1px solid rgba(52, 211, 153, 0.45)',
                                        color: '#34d399',
                                        borderRadius: '0.75rem',
                                        padding: '0.68rem 1rem',
                                        fontWeight: 700,
                                        fontSize: '0.88rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <i className="fa-solid fa-shield-halved"></i>
                                    <span>🔐 Login with Aadhaar</span>
                                </button>
                            </>
                        )}

                        <button className="text-btn" style={{ width: '100%', marginTop: '0.75rem', textAlign: 'center', display: 'block', fontSize: '0.8rem' }} onClick={() => setStep('action')} disabled={loading}>
                            ← Back
                        </button>
                    </div>
                )}

                {/* ======================================================== */}
                {/* 3. AADHAAR STEP 1: AADHAAR / VID INPUT & MANDATORY CONSENT */}
                {/* ======================================================== */}
                {step === 'aadhaar_input' && (
                    <div>
                        {/* Sandbox Banner */}
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

                        <h2 style={{ marginBottom: '0.2rem', textAlign: 'center', fontSize: '1.28rem' }}>
                            {t('aadhaarLoginTitle', 'Farmer Aadhaar Login')}
                        </h2>
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '1.2rem', fontSize: '0.82rem' }}>
                            {t('aadhaarLoginSub', 'Direct authentication via UIDAI OTP 2.5 sandbox verification')}
                        </p>

                        <form onSubmit={handleSendAadhaarOtp}>
                            <div className="input-group" style={{ marginBottom: '0.85rem' }}>
                                <i className="fa-solid fa-id-card" style={{ color: 'var(--primary)' }}></i>
                                <input
                                    type="text"
                                    placeholder="Enter 12-digit Aadhaar or 16-digit VID"
                                    value={rawAadhaar}
                                    onChange={handleAadhaarChange}
                                    maxLength="19"
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
                                        setAadhaarError('');
                                    }}
                                    style={{ marginTop: '0.15rem', accentColor: 'var(--primary)', cursor: 'pointer' }}
                                />
                                <span>
                                    I voluntarily give my consent to <strong>KisanConnect</strong> to verify my identity via UIDAI Aadhaar 2.5 Sandbox for agricultural portal access.
                                </span>
                            </label>

                            {aadhaarError && (
                                <div className="error-msg" style={{ color: 'var(--danger)', fontSize: '0.82rem', textAlign: 'center', marginBottom: '0.75rem' }}>
                                    <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '0.35rem' }}></i>
                                    {aadhaarError}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="primary-btn"
                                style={{
                                    width: '100%',
                                    justifyContent: 'center',
                                    padding: '0.75rem',
                                    opacity: (!consent || !cleanAadhaarDigits) ? 0.6 : 1
                                }}
                                disabled={aadhaarLoading || !consent || !cleanAadhaarDigits}
                            >
                                {aadhaarLoading ? (
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
                                    onClick={() => setStep('action')}
                                    style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}
                                >
                                    ← Back to standard login
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* ======================================================== */}
                {/* 4. AADHAAR STEP 2: VERIFY OTP SCREEN */}
                {/* ======================================================== */}
                {step === 'aadhaar_otp' && (
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

                        <form onSubmit={handleVerifyAadhaarOtp}>
                            <div className="input-group" style={{ marginBottom: '1rem' }}>
                                <i className="fa-solid fa-key" style={{ color: 'var(--primary)' }}></i>
                                <input
                                    type="text"
                                    placeholder="Enter 6-digit OTP (e.g. 123456)"
                                    value={otp}
                                    onChange={(e) => {
                                        setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                                        setAadhaarError('');
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

                            {aadhaarError && (
                                <div className="error-msg" style={{ color: 'var(--danger)', fontSize: '0.82rem', textAlign: 'center', marginBottom: '0.75rem' }}>
                                    <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '0.35rem' }}></i>
                                    {aadhaarError}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="primary-btn"
                                style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
                                disabled={aadhaarLoading || otp.length < 4}
                            >
                                {aadhaarLoading ? (
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
                                        setStep('aadhaar_input');
                                        setOtp('');
                                        setAadhaarError('');
                                    }}
                                    style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}
                                >
                                    ← Change Aadhaar
                                </button>

                                <button
                                    type="button"
                                    className="text-btn"
                                    onClick={handleResendAadhaarOtp}
                                    disabled={countdown > 0 || aadhaarLoading}
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
                {/* 5. AADHAAR STEP 3A: SUCCESS STATE */}
                {/* ======================================================== */}
                {step === 'aadhaar_success' && (
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
                {/* 6. AADHAAR STEP 3B: NO FARMER ACCOUNT FOUND */}
                {/* ======================================================== */}
                {step === 'aadhaar_not_found' && (
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
                                onClick={handleRegisterFromAadhaar}
                            >
                                <i className="fa-solid fa-tractor" style={{ marginRight: '0.4rem' }}></i>
                                Register as Farmer
                            </button>

                            <button
                                type="button"
                                className="text-btn"
                                onClick={() => {
                                    setStep('aadhaar_input');
                                    setOtp('');
                                    setAadhaarError('');
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
