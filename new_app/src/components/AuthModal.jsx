import React, { useState } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from '../context/AuthContext';
import KisanLogo from './KisanLogo';

const ROLE_CONFIG = {
    farmers: {
        bg: '/farmer-portal-bg.jpg',
        badgeColor: '#10b981',
        badgeBg: 'rgba(16, 185, 129, 0.2)',
        badgeBorder: 'rgba(16, 185, 129, 0.45)',
        icon: 'fa-tractor',
        badgeText: 'FARMER PORTAL',
        subtitle: 'Direct Mandi Access & Crop Verification'
    },
    buyers: {
        bg: '/mill-portal-bg.jpg',
        badgeColor: '#f59e0b',
        badgeBg: 'rgba(245, 158, 11, 0.2)',
        badgeBorder: 'rgba(245, 158, 11, 0.45)',
        icon: 'fa-industry',
        badgeText: 'MILL PORTAL',
        subtitle: 'Grain Intake & Procurement Management'
    },
    transporters: {
        bg: '/transport-portal-bg.jpg',
        badgeColor: '#3b82f6',
        badgeBg: 'rgba(59, 130, 246, 0.2)',
        badgeBorder: 'rgba(59, 130, 246, 0.45)',
        icon: 'fa-truck-moving',
        badgeText: 'TRANSPORT PORTAL',
        subtitle: 'Fleet Logistics & Freight Haulage'
    }
};

export default function AuthModal({ role, onClose, onLoginSuccess }) {
    const { signInWithGoogle, loginWithPhone } = useAuth();
    const [step, setStep] = useState('action'); // 'action' | 'form'
    const [action, setAction] = useState('login'); // 'login' | 'signup'
    const [phone, setPhone] = useState('');
    const [pin, setPin] = useState('');
    const [name, setName] = useState('');
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [capacity, setCapacity] = useState('15');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    const roleConfig = ROLE_CONFIG[role.id] || {
        bg: '/farmer-portal-bg.jpg',
        badgeColor: '#10b981',
        badgeBg: 'rgba(16, 185, 129, 0.2)',
        badgeBorder: 'rgba(16, 185, 129, 0.45)',
        icon: 'fa-tractor',
        badgeText: role.title || 'PORTAL',
        subtitle: 'Secure access to your agricultural ecosystem portal'
    };

    const tableName = role.id === 'transporters' ? 'transport_providers' : role.id;

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
                        created_at: new Date().toISOString()
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

    return (
        <div className="auth-modal" style={{ display: 'flex' }}>
            <div className="auth-portal-card" style={{
                maxWidth: '450px',
                width: '100%',
                background: '#0a1610',
                borderRadius: '1.5rem',
                border: '1px solid rgba(16, 185, 129, 0.28)',
                overflow: 'hidden',
                boxShadow: '0 30px 80px rgba(0, 0, 0, 0.95), 0 0 40px rgba(0, 0, 0, 0.6)',
                position: 'relative',
                animation: 'growIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                {/* Hero Header with Realistic Background Image */}
                <div style={{
                    position: 'relative',
                    height: '160px',
                    width: '100%',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    padding: '1.25rem 1.5rem'
                }}>
                    {/* Background Realistic Image */}
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
                    {/* Subtle bottom fade to merge with body */}
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(180deg, rgba(0, 0, 0, 0.3) 0%, transparent 45%, rgba(10, 22, 16, 0.95) 100%)'
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
                            background: 'rgba(0, 0, 0, 0.55)',
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
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.55)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)'; }}
                    >
                        <i className="fa-solid fa-xmark"></i>
                    </button>

                    {/* Role Header Info on Hero */}
                    <div style={{ position: 'relative', zIndex: 5, display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div style={{
                            width: '46px',
                            height: '46px',
                            borderRadius: '12px',
                            background: roleConfig.badgeBg,
                            border: `1.5px solid ${roleConfig.badgeBorder}`,
                            color: roleConfig.badgeColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.35rem',
                            boxShadow: `0 4px 16px rgba(0,0,0,0.5), 0 0 15px ${roleConfig.badgeBorder}`,
                            backdropFilter: 'blur(10px)'
                        }}>
                            <i className={`fa-solid ${roleConfig.icon}`}></i>
                        </div>
                        <div>
                            <span style={{
                                display: 'inline-block',
                                fontSize: '0.68rem',
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
                                fontSize: '1.35rem',
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
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.84rem', lineHeight: 1.4 }}>
                        {roleConfig.subtitle}
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
                            padding: '0.75rem 1rem',
                            fontWeight: 600,
                            fontSize: '0.92rem',
                            cursor: 'pointer',
                            boxShadow: '0 3px 10px rgba(0,0,0,0.25)',
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
                        margin: '1.1rem 0',
                        color: 'var(--text-muted)',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                    }}>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                        <span>or use credentials</span>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                    </div>

                    {step === 'action' ? (
                        <div id="action-step">
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                                <button className="primary-btn" style={{ flex: 1, justifyContent: 'center', padding: '0.75rem' }} onClick={() => handleActionChoice('login')}>
                                    Phone Login
                                </button>
                                <button className="primary-btn" style={{ flex: 1, justifyContent: 'center', background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)', boxShadow: 'none', padding: '0.75rem' }} onClick={() => handleActionChoice('signup')}>
                                    New Account
                                </button>
                            </div>
                            <div style={{ marginTop: '1.1rem', textAlign: 'center' }}>
                                <button className="text-btn" onClick={handleDemoLogin} style={{ fontSize: '0.8rem', color: 'var(--accent-gold)' }}>
                                    <i className="fa-solid fa-bolt" style={{ marginRight: '0.35rem' }}></i> Quick 1-Click Demo Login
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div id="auth-form-step">
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
                            <button className="text-btn" style={{ width: '100%', marginTop: '0.6rem', textAlign: 'center', display: 'block', fontSize: '0.8rem' }} onClick={() => setStep('action')} disabled={loading}>
                                ← Back
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
