import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import KisanLogo from './KisanLogo';

export default function RolePickerModal() {
    const { googleUser, assignRoleToGoogleUser, logout } = useAuth();
    const [selectedRole, setSelectedRole] = useState(null);
    const [phone, setPhone] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const roles = [
        {
            id: 'farmers',
            route: '/farmer/dashboard',
            icon: 'fa-tractor',
            title: 'Farmer',
            subtitle: 'Empower Your Yield',
            desc: 'List crops, request mill purchase, generate verification QR, and arrange transport.',
            bgImage: '/farmer-portal-bg.jpg',
            badgeColor: '#10b981'
        },
        {
            id: 'buyers',
            route: '/buyer/dashboard',
            icon: 'fa-industry',
            title: 'Mill',
            subtitle: 'Direct Grain Intake',
            desc: 'Review farmer enquiries, scan gate QR codes, verify crop loads, and set mill prices.',
            bgImage: '/mill-portal-bg.jpg',
            badgeColor: '#f59e0b'
        },
        {
            id: 'transporters',
            route: '/transport/dashboard',
            icon: 'fa-truck-moving',
            title: 'Transport Provider',
            subtitle: 'Smart Agro-Logistics',
            desc: 'Match vehicle capacity with farmer haulage requests, quote bids, and haul produce.',
            bgImage: '/transport-portal-bg.jpg',
            badgeColor: '#3b82f6'
        }
    ];

    const handleConfirm = async () => {
        if (!selectedRole) {
            setError('Please select an account type.');
            return;
        }

        setError('');
        setSubmitting(true);
        try {
            await assignRoleToGoogleUser(selectedRole.id, {
                phone: phone || undefined
            });
            navigate(selectedRole.route);
        } catch (err) {
            console.error("Failed to set role:", err);
            setError(err.message || 'Failed to complete profile. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="auth-modal-overlay" style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(3, 10, 6, 0.85)',
            backdropFilter: 'blur(8px)',
            padding: '1rem'
        }}>
            <div className="auth-modal-card" style={{
                background: 'rgba(8, 22, 14, 0.95)',
                border: '1px solid var(--border-highlight)',
                borderRadius: '1.25rem',
                maxWidth: '640px',
                width: '100%',
                padding: '1.75rem',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(245, 158, 11, 0.15)',
                animation: 'growIn 0.3s ease-out'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
                        <KisanLogo size="md" />
                    </div>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 0.35rem 0' }}>
                        Welcome to <span className="notranslate" translate="no">KisanConnect</span>!
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', margin: 0 }}>
                        {googleUser?.email ? `Signed in as ${googleUser.email}. ` : ''}Please select your primary role to configure your portal workspace:
                    </p>
                </div>

                {error && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#f87171',
                        padding: '0.6rem 0.85rem',
                        borderRadius: '0.5rem',
                        fontSize: '0.8rem',
                        marginBottom: '1rem'
                    }}>
                        {error}
                    </div>
                )}

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '0.85rem',
                    marginBottom: '1.25rem'
                }}>
                    {roles.map(r => {
                        const isSelected = selectedRole?.id === r.id;
                        return (
                            <div
                                key={r.id}
                                onClick={() => setSelectedRole(r)}
                                style={{
                                    position: 'relative',
                                    border: isSelected ? `2px solid ${r.badgeColor}` : '1px solid rgba(255, 255, 255, 0.12)',
                                    borderRadius: '0.85rem',
                                    padding: '1rem 0.75rem',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.25s ease',
                                    transform: isSelected ? 'translateY(-3px)' : 'none',
                                    overflow: 'hidden',
                                    boxShadow: isSelected ? `0 8px 24px rgba(0,0,0,0.6), 0 0 15px ${r.badgeColor}40` : '0 4px 12px rgba(0,0,0,0.4)'
                                }}
                            >
                                {/* Background Image */}
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    backgroundImage: `url(${r.bgImage})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    filter: 'brightness(0.7) contrast(1.05)',
                                    zIndex: 1
                                }} />
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: isSelected
                                        ? 'linear-gradient(180deg, rgba(3, 10, 6, 0.6) 0%, rgba(3, 10, 6, 0.88) 100%)'
                                        : 'linear-gradient(180deg, rgba(3, 10, 6, 0.75) 0%, rgba(3, 10, 6, 0.92) 100%)',
                                    zIndex: 2
                                }} />

                                <div style={{ position: 'relative', zIndex: 3 }}>
                                    <div style={{
                                        width: '38px',
                                        height: '38px',
                                        borderRadius: '10px',
                                        background: isSelected ? r.badgeColor : 'rgba(0, 0, 0, 0.65)',
                                        border: `1px solid ${r.badgeColor}`,
                                        color: isSelected ? '#000' : r.badgeColor,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.1rem',
                                        margin: '0 auto 0.6rem auto',
                                        backdropFilter: 'blur(6px)'
                                    }}>
                                        <i className={`fa-solid ${r.icon}`}></i>
                                    </div>
                                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#fff', marginBottom: '0.2rem', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                                        {r.title}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.3 }}>
                                        {r.subtitle}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                        Mobile Phone Number (Optional for SMS / Gate QR verification)
                    </label>
                    <input
                        type="tel"
                        placeholder="10-digit mobile number"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        style={{
                            width: '100%',
                            padding: '0.65rem 0.85rem',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '0.5rem',
                            color: '#fff',
                            fontSize: '0.88rem'
                        }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button
                        className="action-btn"
                        onClick={logout}
                        disabled={submitting}
                        style={{ padding: '0.65rem 1.15rem', fontSize: '0.85rem' }}
                    >
                        Sign Out
                    </button>
                    <button
                        className="primary-btn"
                        onClick={handleConfirm}
                        disabled={submitting || !selectedRole}
                        style={{ padding: '0.65rem 1.4rem', fontSize: '0.88rem' }}
                    >
                        {submitting ? 'Setting up...' : 'Confirm & Open Portal →'}
                    </button>
                </div>
            </div>
        </div>
    );
}
