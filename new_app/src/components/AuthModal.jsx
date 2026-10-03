import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import KisanLogo from './KisanLogo';

const ROLE_CONFIG = {
    farmers: {
        bg: '/farmer-portal-bg.jpg',
        badgeColor: '#10b981',
        badgeBg: 'rgba(16, 185, 129, 0.18)',
        badgeBorder: 'rgba(16, 185, 129, 0.45)',
        cardBg: '#08140e',
        cardBorder: 'rgba(16, 185, 129, 0.32)',
        cardGlow: '0 30px 80px rgba(0, 0, 0, 0.95), 0 0 35px rgba(16, 185, 129, 0.18)',
        bottomFade: 'rgba(8, 20, 14, 0.98)',
        inputBg: 'rgba(255, 255, 255, 0.03)',
        inputBorder: 'rgba(16, 185, 129, 0.22)',
        inputFocusBorder: '#10b981',
        inputFocusGlow: '0 0 0 2px rgba(16, 185, 129, 0.25)',
        iconColor: '#10b981',
        btnBg: 'linear-gradient(135deg, #10b981, #059669)',
        btnColor: '#022013',
        btnGlow: '0 8px 24px rgba(16, 185, 129, 0.35)',
        demoColor: '#34d399',
        icon: 'fa-tractor',
        badgeText: 'FARMER PORTAL',
        subtitle: 'Direct Mandi Access & Crop Verification'
    },
    buyers: {
        bg: '/mill-portal-bg.jpg',
        badgeColor: '#f59e0b',
        badgeBg: 'rgba(245, 158, 11, 0.18)',
        badgeBorder: 'rgba(245, 158, 11, 0.45)',
        cardBg: '#130f08',
        cardBorder: 'rgba(245, 158, 11, 0.32)',
        cardGlow: '0 30px 80px rgba(0, 0, 0, 0.95), 0 0 35px rgba(245, 158, 11, 0.18)',
        bottomFade: 'rgba(19, 15, 8, 0.98)',
        inputBg: 'rgba(255, 255, 255, 0.03)',
        inputBorder: 'rgba(245, 158, 11, 0.22)',
        inputFocusBorder: '#f59e0b',
        inputFocusGlow: '0 0 0 2px rgba(245, 158, 11, 0.25)',
        iconColor: '#f59e0b',
        btnBg: 'linear-gradient(135deg, #f59e0b, #d97706)',
        btnColor: '#180e02',
        btnGlow: '0 8px 24px rgba(245, 158, 11, 0.35)',
        demoColor: '#fbbf24',
        icon: 'fa-industry',
        badgeText: 'MILL PORTAL',
        subtitle: 'Grain Intake & Procurement Management'
    },
    transporters: {
        bg: '/transport-portal-bg.jpg',
        badgeColor: '#3b82f6',
        badgeBg: 'rgba(59, 130, 246, 0.18)',
        badgeBorder: 'rgba(59, 130, 246, 0.45)',
        cardBg: '#09101b',
        cardBorder: 'rgba(59, 130, 246, 0.32)',
        cardGlow: '0 30px 80px rgba(0, 0, 0, 0.95), 0 0 35px rgba(59, 130, 246, 0.18)',
        bottomFade: 'rgba(9, 16, 27, 0.98)',
        inputBg: 'rgba(255, 255, 255, 0.03)',
        inputBorder: 'rgba(59, 130, 246, 0.22)',
        inputFocusBorder: '#3b82f6',
        inputFocusGlow: '0 0 0 2px rgba(59, 130, 246, 0.25)',
        iconColor: '#3b82f6',
        btnBg: 'linear-gradient(135deg, #3b82f6, #2563eb)',
        btnColor: '#ffffff',
        btnGlow: '0 8px 24px rgba(59, 130, 246, 0.35)',
        demoColor: '#60a5fa',
        icon: 'fa-truck-moving',
        badgeText: 'TRANSPORT PORTAL',
        subtitle: 'Fleet Logistics & Freight Haulage'
    }
};

export default function AuthModal({ role, onClose, onLoginSuccess }) {
    const { 
        signInWithGoogle, 
        registerWithPhoneAndLinkGoogle, 
        loginWithPhoneAndPassword, 
        resetPasswordWithPhone,
        loginWithPhone 
    } = useAuth();

    // Tabs / Modes: 'signin' | 'signup' | 'forgot_password'
    const [mode, setMode] = useState('signin');

    // Form fields
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [name, setName] = useState('');
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [capacity, setCapacity] = useState('15');

    // UI & Validation states
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    const roleConfig = ROLE_CONFIG[role.id] || ROLE_CONFIG.farmers;

    // Helper to render styled theme-consistent input group
    const renderInputGroup = (iconClass, inputProps, trailingElement = null) => {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                background: roleConfig.inputBg,
                border: `1px solid ${roleConfig.inputBorder}`,
                borderRadius: '0.75rem',
                padding: '0.7rem 1rem',
                transition: 'all 0.2s',
                position: 'relative'
            }}>
                <i className={iconClass} style={{
                    color: roleConfig.iconColor,
                    marginRight: '0.85rem',
                    fontSize: '1rem',
                    width: '18px',
                    textAlign: 'center',
                    flexShrink: 0
                }}></i>
                <input
                    {...inputProps}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: '#ffffff',
                        width: '100%',
                        fontSize: '0.92rem',
                        fontFamily: 'inherit',
                        ...(inputProps.style || {})
                    }}
                />
                {trailingElement}
            </div>
        );
    };

    // 1. Handle Google Login for Returning Users
    const handleGoogleLogin = async () => {
        setGoogleLoading(true);
        setError('');
        try {
            await signInWithGoogle(role.id);
        } catch (err) {
            console.error("Google login error:", err);
            setError(err.message || "Google sign-in failed. Please try again.");
            setGoogleLoading(false);
        }
    };

    // 2. Handle Registration + Mandatory Google Account Linking
    const handleRegisterAndLinkGoogle = async (e) => {
        if (e) e.preventDefault();
        setError('');
        setSuccessMessage('');

        const cleanPhone = phone.replace(/\D/g, '').trim();

        // Validation
        if (!name || name.trim().length === 0) {
            setError('Please enter your full name or enterprise name.');
            return;
        }
        if (!cleanPhone || cleanPhone.length !== 10) {
            setError('Please enter a valid 10-digit mobile number.');
            return;
        }
        if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
            setError('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
            return;
        }
        if (!password || password.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match. Please re-enter your password.');
            return;
        }
        if (role.id === 'transporters' && !vehicleNumber.trim()) {
            setError('Please enter your vehicle registration number.');
            return;
        }

        setGoogleLoading(true);
        try {
            await registerWithPhoneAndLinkGoogle({
                phone: cleanPhone,
                password: password,
                name: name.trim(),
                role: role.id,
                vehicle_number: vehicleNumber.trim() || null,
                capacity: capacity ? Number(capacity) : null
            });
        } catch (err) {
            console.error("Registration error:", err);
            setError(err.message || "Registration failed. Please try again.");
            setGoogleLoading(false);
        }
    };

    // 3. Handle Phone & Password Sign In
    const handlePhoneSignIn = async (e) => {
        if (e) e.preventDefault();
        setError('');
        setSuccessMessage('');

        const cleanPhone = phone.replace(/\D/g, '').trim();

        if (!cleanPhone || cleanPhone.length !== 10) {
            setError('Please enter a valid 10-digit mobile number.');
            return;
        }
        if (!password) {
            setError('Please enter your password.');
            return;
        }

        setLoading(true);
        try {
            const res = await loginWithPhoneAndPassword(cleanPhone, password, role.id);
            if (res.success) {
                if (onLoginSuccess) onLoginSuccess(res.user);
            } else {
                setError(res.error || 'Invalid mobile number or password.');
            }
        } catch (err) {
            console.error("Login error:", err);
            setError(err.message || 'Authentication error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // 4. Handle Password Recovery / Reset
    const handlePasswordRecovery = async (e) => {
        if (e) e.preventDefault();
        setError('');
        setSuccessMessage('');

        const cleanPhone = phone.replace(/\D/g, '').trim();

        if (!cleanPhone || cleanPhone.length !== 10) {
            setError('Please enter your registered 10-digit mobile number.');
            return;
        }
        if (!password || password.length < 6) {
            setError('New password must be at least 6 characters long.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match. Please re-enter.');
            return;
        }

        setLoading(true);
        try {
            const res = await resetPasswordWithPhone(cleanPhone, password, role.id);
            if (res.success) {
                setSuccessMessage('Password reset successfully! You can now sign in.');
                setPassword('');
                setConfirmPassword('');
                setTimeout(() => {
                    setMode('signin');
                    setSuccessMessage('');
                }, 2000);
            } else {
                setError(res.error || 'Could not reset password. Please check your mobile number.');
            }
        } catch (err) {
            console.error("Password recovery error:", err);
            setError(err.message || 'Failed to reset password.');
        } finally {
            setLoading(false);
        }
    };

    // 5. 1-Click Quick Demo Login for testing
    const handleDemoLogin = () => {
        const demoCreds = role.id === 'farmers'
            ? { phone: '9876543210', pin: '1234', password: '1234', name: 'Ramesh Reddy (Demo Farmer)' }
            : role.id === 'transporters'
            ? { phone: '9876500001', pin: '1234', password: '1234', name: 'Kisan Gati Logistics', vehicle_number: 'TS 09 EA 4421', capacity: 15 }
            : { phone: '9876543211', pin: '1234', password: '1234', name: 'Sri Lakshmi Rice Industries' };

        const demoUser = {
            ...demoCreds,
            role: role.id,
            id: 'demo-' + role.id
        };
        loginWithPhone(demoUser, role.id);
        if (onLoginSuccess) onLoginSuccess(demoUser);
    };

    return (
        <div className="auth-modal" style={{ display: 'flex', zIndex: 9999, background: 'rgba(2, 6, 4, 0.88)' }}>
            <div className="auth-portal-card" style={{
                maxWidth: '460px',
                width: '100%',
                background: roleConfig.cardBg,
                borderRadius: '1.5rem',
                border: `1px solid ${roleConfig.cardBorder}`,
                overflow: 'hidden',
                boxShadow: roleConfig.cardGlow,
                position: 'relative',
                animation: 'growIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                {/* Hero Header with Background Image */}
                <div style={{
                    position: 'relative',
                    height: '150px',
                    width: '100%',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    padding: '1.25rem 1.5rem'
                }}>
                    <img
                        src={roleConfig.bg}
                        alt={role.title}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: 'center',
                            display: 'block'
                        }}
                    />
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: `linear-gradient(180deg, rgba(0, 0, 0, 0.35) 0%, transparent 45%, ${roleConfig.bottomFade} 100%)`
                    }} />

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        style={{
                            position: 'absolute',
                            top: '1rem',
                            right: '1rem',
                            zIndex: 10,
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            background: 'rgba(0, 0, 0, 0.6)',
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            border: '1px solid rgba(255, 255, 255, 0.25)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.85)'; e.currentTarget.style.borderColor = 'transparent'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)'; }}
                    >
                        <i className="fa-solid fa-xmark"></i>
                    </button>

                    {/* Role Header Info */}
                    <div style={{ position: 'relative', zIndex: 5, display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            background: roleConfig.badgeBg,
                            border: `1.5px solid ${roleConfig.badgeBorder}`,
                            color: roleConfig.badgeColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.25rem',
                            boxShadow: `0 4px 16px rgba(0,0,0,0.5), 0 0 15px ${roleConfig.badgeBorder}`,
                            backdropFilter: 'blur(10px)'
                        }}>
                            <i className={`fa-solid ${roleConfig.icon}`}></i>
                        </div>
                        <div>
                            <span style={{
                                display: 'inline-block',
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                letterSpacing: '0.75px',
                                textTransform: 'uppercase',
                                color: roleConfig.badgeColor,
                                background: 'rgba(0, 0, 0, 0.65)',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '4px',
                                border: `1px solid ${roleConfig.badgeBorder}`,
                                marginBottom: '0.2rem'
                            }}>
                                {roleConfig.badgeText}
                            </span>
                            <h2 style={{
                                margin: 0,
                                fontSize: '1.25rem',
                                fontWeight: 800,
                                color: '#ffffff',
                                textShadow: '0 2px 6px rgba(0, 0, 0, 0.9)',
                                lineHeight: 1.2
                            }}>
                                {role.title}
                            </h2>
                        </div>
                    </div>
                </div>

                {/* Modal Body */}
                <div style={{ padding: '1.25rem 1.75rem 1.75rem' }}>
                    {/* Navigation Tabs (Sign In vs Create Account) */}
                    {mode !== 'forgot_password' ? (
                        <div style={{
                            display: 'flex',
                            background: 'rgba(255, 255, 255, 0.05)',
                            borderRadius: '0.75rem',
                            padding: '0.25rem',
                            marginBottom: '1.25rem',
                            border: `1px solid ${roleConfig.inputBorder}`
                        }}>
                            <button
                                type="button"
                                onClick={() => { setMode('signin'); setError(''); setSuccessMessage(''); }}
                                style={{
                                    flex: 1,
                                    padding: '0.55rem 0',
                                    borderRadius: '0.55rem',
                                    border: 'none',
                                    background: mode === 'signin' ? roleConfig.badgeColor : 'transparent',
                                    color: mode === 'signin' ? (role.id === 'transporters' ? '#ffffff' : '#000000') : 'var(--text-muted)',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.4rem'
                                }}
                            >
                                <i className="fa-solid fa-right-to-bracket" style={{ fontSize: '0.8rem' }}></i>
                                Sign In
                            </button>
                            <button
                                type="button"
                                onClick={() => { setMode('signup'); setError(''); setSuccessMessage(''); }}
                                style={{
                                    flex: 1,
                                    padding: '0.55rem 0',
                                    borderRadius: '0.55rem',
                                    border: 'none',
                                    background: mode === 'signup' ? roleConfig.badgeColor : 'transparent',
                                    color: mode === 'signup' ? (role.id === 'transporters' ? '#ffffff' : '#000000') : 'var(--text-muted)',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.4rem'
                                }}
                            >
                                <i className="fa-solid fa-user-plus" style={{ fontSize: '0.8rem' }}></i>
                                Create Account
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.1rem' }}>
                            <button
                                type="button"
                                onClick={() => { setMode('signin'); setError(''); setSuccessMessage(''); }}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: `1px solid ${roleConfig.inputBorder}`,
                                    color: '#fff',
                                    borderRadius: '0.4rem',
                                    padding: '0.35rem 0.65rem',
                                    fontSize: '0.78rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem'
                                }}
                            >
                                <i className="fa-solid fa-arrow-left"></i> Back to Sign In
                            </button>
                            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                Password Recovery
                            </span>
                        </div>
                    )}

                    {/* Alerts (Error / Success) */}
                    {error && (
                        <div style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            color: '#f87171',
                            padding: '0.65rem 0.85rem',
                            borderRadius: '0.6rem',
                            fontSize: '0.82rem',
                            marginBottom: '1rem',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.5rem'
                        }}>
                            <i className="fa-solid fa-circle-exclamation" style={{ marginTop: '0.15rem' }}></i>
                            <div style={{ flex: 1 }}>{error}</div>
                        </div>
                    )}

                    {successMessage && (
                        <div style={{
                            background: `${roleConfig.badgeBg}`,
                            border: `1px solid ${roleConfig.badgeBorder}`,
                            color: roleConfig.badgeColor,
                            padding: '0.65rem 0.85rem',
                            borderRadius: '0.6rem',
                            fontSize: '0.82rem',
                            marginBottom: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}>
                            <i className="fa-solid fa-circle-check"></i>
                            <div>{successMessage}</div>
                        </div>
                    )}

                    {/* ======================================================== */}
                    {/* TAB 1: SIGN IN (MOBILE & PASSWORD OR GOOGLE) */}
                    {/* ======================================================== */}
                    {mode === 'signin' && (
                        <div>
                            {/* Option A: Sign In with Google */}
                            <button
                                type="button"
                                onClick={handleGoogleLogin}
                                disabled={googleLoading || loading}
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
                                    padding: '0.75rem 1rem',
                                    fontWeight: 600,
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    boxShadow: '0 3px 10px rgba(0,0,0,0.25)',
                                    transition: 'all 0.2s',
                                    opacity: googleLoading ? 0.75 : 1
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

                            {/* Divider */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                margin: '1rem 0',
                                color: 'var(--text-muted)',
                                fontSize: '0.72rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.75px'
                            }}>
                                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.12)' }}></div>
                                <span>or sign in with mobile & password</span>
                                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.12)' }}></div>
                            </div>

                            {/* Option B: Mobile Number & Password Form */}
                            <form onSubmit={handlePhoneSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {renderInputGroup('fa-solid fa-phone', {
                                    type: 'tel',
                                    placeholder: '10-digit Mobile Number',
                                    maxLength: 10,
                                    value: phone,
                                    onChange: e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)),
                                    required: true
                                })}

                                {renderInputGroup('fa-solid fa-lock', {
                                    type: showPassword ? 'text' : 'password',
                                    placeholder: 'Enter Password (e.g. 1234)',
                                    value: password,
                                    onChange: e => setPassword(e.target.value),
                                    required: true,
                                    style: { paddingRight: '2rem' }
                                }, (
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: roleConfig.iconColor,
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            padding: '0.2rem'
                                        }}
                                    >
                                        <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                    </button>
                                ))}

                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button
                                        type="button"
                                        onClick={() => { setMode('forgot_password'); setError(''); }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: roleConfig.badgeColor,
                                            fontSize: '0.78rem',
                                            cursor: 'pointer',
                                            padding: '0.2rem 0',
                                            textDecoration: 'underline'
                                        }}
                                    >
                                        Forgot Password?
                                    </button>
                                </div>

                                <button
                                    type="submit"
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '0.75rem',
                                        marginTop: '0.35rem',
                                        background: roleConfig.btnBg,
                                        color: roleConfig.btnColor,
                                        fontWeight: 700,
                                        fontSize: '0.92rem',
                                        borderRadius: '0.75rem',
                                        border: 'none',
                                        boxShadow: roleConfig.btnGlow,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    disabled={loading || googleLoading}
                                >
                                    {loading ? (
                                        <>
                                            <i className="fa-solid fa-circle-notch fa-spin" style={{ marginRight: '0.4rem' }}></i>
                                            Signing In...
                                        </>
                                    ) : (
                                        'Sign In with Mobile'
                                    )}
                                </button>
                            </form>

                            {/* Demo Login */}
                            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                                <button
                                    type="button"
                                    className="text-btn"
                                    onClick={handleDemoLogin}
                                    style={{ fontSize: '0.78rem', color: roleConfig.demoColor, background: 'none', border: 'none', cursor: 'pointer' }}
                                >
                                    <i className="fa-solid fa-bolt" style={{ marginRight: '0.35rem' }}></i> 1-Click Quick Demo Login
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ======================================================== */}
                    {/* TAB 2: CREATE ACCOUNT (REGISTRATION WITH GOOGLE LINKING) */}
                    {/* ======================================================== */}
                    {mode === 'signup' && (
                        <div>
                            <div style={{
                                background: roleConfig.inputBg,
                                border: `1px solid ${roleConfig.inputBorder}`,
                                borderRadius: '0.6rem',
                                padding: '0.65rem 0.85rem',
                                marginBottom: '0.9rem',
                                fontSize: '0.78rem',
                                color: 'var(--text-muted)',
                                lineHeight: 1.45
                            }}>
                                <span style={{ color: roleConfig.badgeColor, fontWeight: 700 }}>
                                    <i className="fa-solid fa-shield-halved" style={{ marginRight: '0.35rem' }}></i>
                                    Mandatory Verification:
                                </span>{' '}
                                Enter your mobile number and password, then click <strong>Continue with Google</strong> to link your Google account and complete registration.
                            </div>

                            <form onSubmit={handleRegisterAndLinkGoogle} style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                                {renderInputGroup('fa-solid fa-user', {
                                    type: 'text',
                                    placeholder: 'Full Name / Enterprise Name',
                                    value: name,
                                    onChange: e => setName(e.target.value),
                                    required: true
                                })}

                                {renderInputGroup('fa-solid fa-phone', {
                                    type: 'tel',
                                    placeholder: '10-digit Mobile Number (e.g. 9876543210)',
                                    maxLength: 10,
                                    value: phone,
                                    onChange: e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)),
                                    required: true
                                })}

                                {renderInputGroup('fa-solid fa-lock', {
                                    type: showPassword ? 'text' : 'password',
                                    placeholder: 'Create Password (min. 6 chars)',
                                    value: password,
                                    onChange: e => setPassword(e.target.value),
                                    required: true,
                                    style: { paddingRight: '2rem' }
                                }, (
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: roleConfig.iconColor,
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            padding: '0.2rem'
                                        }}
                                    >
                                        <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                    </button>
                                ))}

                                {renderInputGroup('fa-solid fa-lock-open', {
                                    type: showConfirmPassword ? 'text' : 'password',
                                    placeholder: 'Confirm Password',
                                    value: confirmPassword,
                                    onChange: e => setConfirmPassword(e.target.value),
                                    required: true,
                                    style: { paddingRight: '2rem' }
                                }, (
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: roleConfig.iconColor,
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            padding: '0.2rem'
                                        }}
                                    >
                                        <i className={`fa-solid ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                    </button>
                                ))}

                                {role.id === 'transporters' && (
                                    <>
                                        {renderInputGroup('fa-solid fa-truck', {
                                            type: 'text',
                                            placeholder: 'Vehicle Registration (e.g. TS 09 EA 4421)',
                                            value: vehicleNumber,
                                            onChange: e => setVehicleNumber(e.target.value),
                                            required: true
                                        })}
                                        {renderInputGroup('fa-solid fa-weight-hanging', {
                                            type: 'number',
                                            placeholder: 'Truck Capacity in Tons (e.g. 15)',
                                            value: capacity,
                                            onChange: e => setCapacity(e.target.value),
                                            required: true
                                        })}
                                    </>
                                )}

                                {/* Mandatory Google Linking Action Button */}
                                <button
                                    type="submit"
                                    disabled={googleLoading || loading}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: '#ffffff',
                                        color: '#1f2937',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '0.75rem',
                                        padding: '0.75rem 1rem',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
                                        marginTop: '0.5rem',
                                        transition: 'all 0.2s',
                                        opacity: googleLoading ? 0.75 : 1
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontWeight: 700, fontSize: '0.92rem' }}>
                                        <svg width="18" height="18" viewBox="0 0 18 18">
                                            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z" />
                                            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
                                            <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" />
                                            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" />
                                        </svg>
                                        {googleLoading ? 'Verifying & Linking...' : 'Continue with Google'}
                                    </div>
                                    <span style={{ fontSize: '0.68rem', color: '#6b7280', marginTop: '0.15rem' }}>
                                        Links your Google account & completes registration
                                    </span>
                                </button>
                            </form>
                        </div>
                    )}

                    {/* ======================================================== */}
                    {/* TAB 3: FORGOT PASSWORD / PASSWORD RECOVERY */}
                    {/* ======================================================== */}
                    {mode === 'forgot_password' && (
                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.45, marginBottom: '1rem' }}>
                                Enter your registered 10-digit mobile number and set a new password to restore access to your account.
                            </p>

                            <form onSubmit={handlePasswordRecovery} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {renderInputGroup('fa-solid fa-phone', {
                                    type: 'tel',
                                    placeholder: 'Registered 10-digit Mobile Number',
                                    maxLength: 10,
                                    value: phone,
                                    onChange: e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)),
                                    required: true
                                })}

                                {renderInputGroup('fa-solid fa-key', {
                                    type: showPassword ? 'text' : 'password',
                                    placeholder: 'New Password (min. 6 chars)',
                                    value: password,
                                    onChange: e => setPassword(e.target.value),
                                    required: true,
                                    style: { paddingRight: '2rem' }
                                }, (
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: roleConfig.iconColor,
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            padding: '0.2rem'
                                        }}
                                    >
                                        <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                    </button>
                                ))}

                                {renderInputGroup('fa-solid fa-lock', {
                                    type: showConfirmPassword ? 'text' : 'password',
                                    placeholder: 'Confirm New Password',
                                    value: confirmPassword,
                                    onChange: e => setConfirmPassword(e.target.value),
                                    required: true,
                                    style: { paddingRight: '2rem' }
                                }, (
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: roleConfig.iconColor,
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            padding: '0.2rem'
                                        }}
                                    >
                                        <i className={`fa-solid ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                    </button>
                                ))}

                                <button
                                    type="submit"
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '0.75rem',
                                        marginTop: '0.5rem',
                                        background: roleConfig.btnBg,
                                        color: roleConfig.btnColor,
                                        fontWeight: 700,
                                        fontSize: '0.92rem',
                                        borderRadius: '0.75rem',
                                        border: 'none',
                                        boxShadow: roleConfig.btnGlow,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    disabled={loading}
                                >
                                    {loading ? 'Updating Password...' : 'Reset Password & Sign In'}
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
