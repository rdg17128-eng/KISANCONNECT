import React from 'react';
import KisanLogo from './KisanLogo';

const ROLE_COLORS = {
    farmers: '#10b981',
    buyers: '#f59e0b',
    transporters: '#3b82f6'
};

const ROLE_ICONS = {
    farmers: 'fa-tractor',
    buyers: 'fa-industry',
    transporters: 'fa-truck-moving'
};

export default function AuthMismatchModal({ error, onClose, onSwitchPortal }) {
    if (!error) return null;

    const registeredColor = error.registeredRole ? (ROLE_COLORS[error.registeredRole] || '#10b981') : '#f59e0b';
    const registeredIcon = error.registeredRole ? (ROLE_ICONS[error.registeredRole] || 'fa-user-check') : 'fa-user-plus';
    const intendedColor = error.intendedRole ? (ROLE_COLORS[error.intendedRole] || '#f59e0b') : '#f59e0b';

    return (
        <div className="modal-overlay" style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(2, 6, 8, 0.9)',
            backdropFilter: 'blur(10px)',
            padding: '1rem',
            animation: 'fadeIn 0.25s ease-out'
        }}>
            <div style={{
                maxWidth: '480px',
                width: '100%',
                background: '#0d131a',
                borderRadius: '1.5rem',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                boxShadow: '0 30px 80px rgba(0, 0, 0, 0.95), 0 0 40px rgba(245, 158, 11, 0.18)',
                padding: '2rem 1.75rem',
                textAlign: 'center',
                position: 'relative',
                animation: 'growIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                {/* Warning Icon Badge */}
                <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '1.5px solid rgba(245, 158, 11, 0.45)',
                    color: '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.75rem',
                    margin: '0 auto 1.25rem auto',
                    boxShadow: '0 0 25px rgba(245, 158, 11, 0.25)'
                }}>
                    <i className="fa-solid fa-triangle-exclamation"></i>
                </div>

                {/* Title */}
                <h2 style={{
                    fontSize: '1.35rem',
                    fontWeight: 800,
                    color: '#ffffff',
                    marginBottom: '0.4rem',
                    letterSpacing: '-0.01em'
                }}>
                    {error.registeredRole ? 'Account Registered in Another Portal' : 'Account Not Registered'}
                </h2>

                {/* Email Tag */}
                {error.email && (
                    <div style={{
                        display: 'inline-block',
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '2rem',
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                        marginBottom: '1.25rem',
                        fontWeight: 600
                    }}>
                        <i className="fa-brands fa-google" style={{ marginRight: '0.4rem', color: '#4285F4' }}></i>
                        {error.email}
                    </div>
                )}

                {/* Detailed Description */}
                <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '0.85rem',
                    padding: '1rem 1.15rem',
                    fontSize: '0.86rem',
                    color: 'var(--text-muted)',
                    lineHeight: 1.55,
                    marginBottom: '1.5rem',
                    textAlign: 'left'
                }}>
                    {error.registeredRole ? (
                        <>
                            This Google account is registered in the{' '}
                            <span style={{ color: registeredColor, fontWeight: 800 }}>
                                <i className={`fa-solid ${registeredIcon}`} style={{ marginRight: '0.3rem' }}></i>
                                {error.registeredPortalName}
                            </span>
                            . It is <strong style={{ color: '#f87171' }}>not registered</strong> in the{' '}
                            <span style={{ color: intendedColor, fontWeight: 700 }}>
                                {error.intendedPortalName}
                            </span>
                            .
                            <div style={{ marginTop: '0.6rem', fontSize: '0.82rem', color: '#e2e8f0' }}>
                                Please sign in through the <strong>{error.registeredPortalName}</strong> to access your account.
                            </div>
                        </>
                    ) : (
                        <>
                            This Google account is <strong style={{ color: '#f87171' }}>not yet registered</strong> in the{' '}
                            <span style={{ color: intendedColor, fontWeight: 700 }}>
                                {error.intendedPortalName}
                            </span>
                            .
                            <div style={{ marginTop: '0.6rem', fontSize: '0.82rem', color: '#e2e8f0' }}>
                                Please click <strong>Create Account</strong> to complete mobile number registration with Google account linking.
                            </div>
                        </>
                    )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {error.registeredRole && onSwitchPortal && (
                        <button
                            type="button"
                            onClick={() => onSwitchPortal(error.registeredRole)}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                padding: '0.8rem 1.25rem',
                                background: `linear-gradient(135deg, ${registeredColor}, ${registeredColor}cc)`,
                                color: error.registeredRole === 'transporters' ? '#ffffff' : '#000000',
                                border: 'none',
                                borderRadius: '0.75rem',
                                fontWeight: 800,
                                fontSize: '0.92rem',
                                cursor: 'pointer',
                                boxShadow: `0 6px 20px ${registeredColor}40`,
                                transition: 'all 0.2s'
                            }}
                        >
                            <i className={`fa-solid ${registeredIcon}`}></i>
                            Open {error.registeredPortalName} →
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#ffffff',
                            borderRadius: '0.75rem',
                            fontWeight: 600,
                            fontSize: '0.86rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'; }}
                    >
                        Use a Different Account / Dismiss
                    </button>
                </div>
            </div>
        </div>
    );
}
