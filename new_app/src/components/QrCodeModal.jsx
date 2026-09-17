const DEFAULT_CROP_IMAGES = {
    'maize': 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=600&q=80',
    'corn': 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=600&q=80',
    'paddy': 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
    'paddy (rice)': 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
    'rice': 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
    'sunflower': 'https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&fit=crop&w=600&q=80',
    'cotton': 'https://images.unsplash.com/photo-1606041008023-472dfb5e530f?auto=format&fit=crop&w=600&q=80',
    'wheat': 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80',
    'chilli': 'https://images.unsplash.com/photo-1588252303782-cb80119abd6d?auto=format&fit=crop&w=600&q=80',
    'red gram': 'https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?auto=format&fit=crop&w=600&q=80',
    'soybean': 'https://images.unsplash.com/photo-1599420186946-7b6fb4e297f0?auto=format&fit=crop&w=600&q=80'
};

const resolveCropImage = (cropName, customImage, cropId) => {
    if (customImage && typeof customImage === 'string' && customImage.trim().length > 5) {
        return customImage;
    }
    try {
        const localCropImages = JSON.parse(localStorage.getItem('kisan_farmer_crop_images') || '{}');
        if (cropId && localCropImages[cropId]) return localCropImages[cropId];
        if (cropName) {
            const key = Object.keys(localCropImages).find(k => k.toLowerCase().includes(cropName.toLowerCase()));
            if (key && localCropImages[key]) return localCropImages[key];
        }
    } catch {
        // ignore
    }
    if (cropName) {
        const lower = cropName.toLowerCase();
        for (const [k, url] of Object.entries(DEFAULT_CROP_IMAGES)) {
            if (lower.includes(k) || k.includes(lower)) {
                return url;
            }
        }
    }
    return DEFAULT_CROP_IMAGES['paddy'];
};

export default function QrCodeModal({ enquiry, onClose }) {
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [copied, setCopied] = useState(false);

    const enquiryCode = enquiry?.enquiry_code || enquiry?.id || 'KC-2026-000000';
    const cropImg = resolveCropImage(enquiry?.crop_name, enquiry?.crop_image, enquiry?.crop_id);

    useEffect(() => {
        if (!enquiryCode) return;
        // The QR code contains ONLY the secure identifier
        QRCode.toDataURL(enquiryCode, {
            width: 320,
            margin: 2,
            color: {
                dark: '#022c22', // Deep forest emerald
                light: '#ffffff'  // Clean white
            },
            errorCorrectionLevel: 'H'
        })
            .then(url => setQrDataUrl(url))
            .catch(err => console.error("QR Code generation error:", err));
    }, [enquiryCode]);

    const handleDownload = () => {
        if (!qrDataUrl) return;
        const link = document.createElement('a');
        link.href = qrDataUrl;
        link.download = `KisanConnect-QR-${enquiryCode}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleShare = async () => {
        if (navigator.share) {
            try {
                // If possible, create file from dataUrl for sharing
                const res = await fetch(qrDataUrl);
                const blob = await res.blob();
                const file = new File([blob], `KisanConnect-QR-${enquiryCode}.png`, { type: 'image/png' });

                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: `Crop Verification QR - ${enquiryCode}`,
                        text: `KisanConnect Verification QR for Enquiry ${enquiryCode} (${enquiry?.crop_name} - ${enquiry?.quantity || enquiry?.acres} Tons).`,
                        files: [file]
                    });
                    return;
                }

                await navigator.share({
                    title: `Crop Verification QR - ${enquiryCode}`,
                    text: `KisanConnect Verification QR Code: ${enquiryCode} for ${enquiry?.crop_name} to ${enquiry?.mill_name || 'Mill'}.`,
                    url: window.location.href
                });
            } catch (err) {
                if (err.name !== 'AbortError') {
                    fallbackCopy();
                }
            }
        } else {
            fallbackCopy();
        }
    };

    const fallbackCopy = () => {
        navigator.clipboard.writeText(`KisanConnect Crop Verification ID: ${enquiryCode} | Crop: ${enquiry?.crop_name} | Quantity: ${enquiry?.quantity || enquiry?.acres} Tons | Mill: ${enquiry?.mill_name}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 9999, animation: 'fadeIn 0.25s ease-out' }}>
            <div 
                className="modal-content bento-card" 
                style={{ 
                    maxWidth: '480px', 
                    width: '92%', 
                    padding: '1.75rem 1.5rem',
                    textAlign: 'center',
                    background: 'var(--card-bg)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(16, 185, 129, 0.15)',
                    maxHeight: '92vh',
                    overflowY: 'auto'
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <KisanLogo size="sm" />
                    <button className="action-btn text-btn" onClick={onClose} style={{ padding: '0.4rem' }}>
                        <i className="fa-solid fa-xmark" style={{ fontSize: '1.2rem' }}></i>
                    </button>
                </div>

                {/* Crop Identity Banner with Image */}
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.85rem', 
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(0, 0, 0, 0.45) 100%)', 
                    border: '1px solid rgba(16, 185, 129, 0.35)', 
                    borderRadius: '0.9rem', 
                    padding: '0.75rem 0.9rem', 
                    marginBottom: '1.1rem',
                    textAlign: 'left'
                }}>
                    <img 
                        src={cropImg} 
                        alt={enquiry?.crop_name} 
                        style={{ width: '56px', height: '56px', borderRadius: '0.65rem', objectFit: 'cover', border: '1.5px solid rgba(255,255,255,0.25)', flexShrink: 0 }} 
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Verified Crop Load
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 800, fontFamily: 'monospace' }}>
                                {enquiryCode}
                            </span>
                        </div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: '0.1rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {enquiry?.crop_name}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Load: <strong style={{ color: '#fff' }}>{enquiry?.quantity || (enquiry?.acres ? `${enquiry.acres * 2} Tons` : '10 Tons')}</strong> ({enquiry?.acres || 5} Ac) → <strong style={{ color: 'var(--primary)' }}>{enquiry?.mill_name || 'Mill Gate'}</strong>
                        </div>
                    </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.2rem 0' }}>Gate Delivery QR Pass</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
                        Present this QR at mill gate for instant weighbridge check-in
                    </p>
                </div>

                {/* QR Code Container with High-Contrast Frame */}
                <div 
                    style={{
                        background: '#ffffff',
                        padding: '1rem',
                        borderRadius: '1.15rem',
                        display: 'inline-block',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.35)',
                        border: '3px solid var(--primary)',
                        marginBottom: '1rem',
                        position: 'relative'
                    }}
                >
                    {qrDataUrl ? (
                        <img 
                            src={qrDataUrl} 
                            alt={`QR for ${enquiryCode}`} 
                            style={{ width: '190px', height: '190px', display: 'block' }}
                        />
                    ) : (
                        <div style={{ width: '190px', height: '190px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                            <i className="fa-solid fa-spinner fa-spin fa-2x"></i>
                        </div>
                    )}
                    <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', fontWeight: 800, color: '#064e3b', letterSpacing: '0.5px' }}>
                        SCAN TO VERIFY LOAD • {enquiry?.crop_name?.toUpperCase()}
                    </div>
                </div>

                {/* Enquiry Details Badge */}
                <div 
                    style={{ 
                        background: 'rgba(255, 255, 255, 0.04)', 
                        borderRadius: '0.85rem', 
                        padding: '0.85rem 1rem', 
                        marginBottom: '1.25rem',
                        textAlign: 'left',
                        fontSize: '0.82rem',
                        border: '1px solid rgba(255, 255, 255, 0.06)'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Verified Crop:</span>
                        <strong style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <i className="fa-solid fa-seedling"></i> {enquiry?.crop_name}
                        </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Quantity & Acreage:</span>
                        <strong style={{ color: 'var(--text-main)' }}>{enquiry?.quantity || (enquiry?.acres ? `${enquiry.acres * 2} Tons` : '10 Tons')} ({enquiry?.acres || 5} Acres)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Assigned Mill:</span>
                        <strong style={{ color: 'var(--text-main)' }}>{enquiry?.mill_name || 'Authorized Mill'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Transport:</span>
                        <span style={{ color: enquiry?.transport_required ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                            {enquiry?.transport_required ? '✓ KisanConnect Logistics' : 'Self Arranged'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Gate Status:</span>
                        <span className="status-badge" style={{ padding: '0.15rem 0.55rem', fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--primary)' }}>
                            {enquiry?.load_status || enquiry?.status || 'ACCEPTED'}
                        </span>
                    </div>
                </div>

                {/* Actions: Download & Share */}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button 
                        className="action-btn"
                        onClick={handleShare}
                        style={{ 
                            flex: 1, 
                            justifyContent: 'center', 
                            padding: '0.85rem',
                            background: 'rgba(255, 255, 255, 0.08)',
                            color: 'var(--text-main)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            borderRadius: '0.75rem',
                            fontWeight: 600
                        }}
                    >
                        <i className="fa-solid fa-share-nodes"></i>
                        {copied ? 'Copied Details!' : 'Share QR'}
                    </button>

                    <button 
                        className="primary-btn"
                        onClick={handleDownload}
                        style={{ 
                            flex: 1, 
                            justifyContent: 'center', 
                            padding: '0.85rem',
                            borderRadius: '0.75rem',
                            fontWeight: 600
                        }}
                    >
                        <i className="fa-solid fa-download"></i>
                        Download QR
                    </button>
                </div>
            </div>
        </div>
    );
}
