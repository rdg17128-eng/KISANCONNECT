import React from 'react';

export default function KisanLogo({ 
    size = 'md', 
    showText = true, 
    variant = 'auto', // 'auto' | 'emerald' | 'mill' | 'white' | 'gold'
    className = '', 
    style = {} 
}) {
    // Sizes tuned for exact fit without clipping or overflow
    const iconSizes = {
        sm: { width: 24, height: 24, fontSize: '1.05rem', gap: '0.45rem' },
        md: { width: 32, height: 32, fontSize: '1.25rem', gap: '0.6rem' },
        sidebar: { width: 32, height: 32, fontSize: '1.25rem', gap: '0.6rem' },
        lg: { width: 44, height: 44, fontSize: '1.65rem', gap: '0.75rem' },
        xl: { width: 58, height: 58, fontSize: '2.2rem', gap: '0.9rem' }
    };

    const current = iconSizes[size] || iconSizes.md;

    return (
        <div 
            className={`kisan-logo-container notranslate ${className}`}
            translate="no"
            style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: current.gap,
                userSelect: 'none',
                maxWidth: '100%',
                ...style 
            }}
        >
            <div 
                className="kisan-logo-icon-wrap notranslate"
                translate="no"
                style={{
                    width: `${current.width}px`,
                    height: `${current.height}px`,
                    minWidth: `${current.width}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    filter: variant === 'mill' 
                        ? 'drop-shadow(0 2px 8px rgba(255, 138, 0, 0.45))' 
                        : 'drop-shadow(0 0 10px rgba(16, 185, 129, 0.45))',
                    transition: 'transform 0.3s ease, filter 0.3s ease'
                }}
            >
                <img 
                    src="/kisanconnect-logo.svg" 
                    alt="KisanConnect Logo" 
                    className="notranslate"
                    translate="no"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
            </div>

            {showText && (
                <span 
                    className="kisan-logo-text notranslate"
                    translate="no"
                    style={{ 
                        fontSize: current.fontSize, 
                        fontWeight: 800, 
                        letterSpacing: '-0.02em',
                        display: 'inline-flex',
                        alignItems: 'center',
                        lineHeight: 1,
                        whiteSpace: 'nowrap'
                    }}
                >
                    <span 
                        className="logo-kisan notranslate" 
                        translate="no"
                        style={{
                            color: variant === 'mill' ? '#FFFFFF' : '#10B981',
                            textShadow: variant === 'mill' ? '0 1px 4px rgba(0,0,0,0.3)' : 'none'
                        }}
                    >
                        Kisan
                    </span>
                    <span 
                        className="logo-connect notranslate" 
                        translate="no"
                        style={{
                            color: variant === 'mill' ? '#FFB74D' : '#F1F5F9',
                            marginLeft: '2px',
                            textShadow: variant === 'mill' ? '0 1px 4px rgba(0,0,0,0.3)' : 'none'
                        }}
                    >
                        Connect
                    </span>
                </span>
            )}
        </div>
    );
}
