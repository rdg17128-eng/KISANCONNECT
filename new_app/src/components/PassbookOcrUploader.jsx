import React, { useState, useRef, useEffect } from 'react';
import kisanService from '../services/kisanService';

export default function PassbookOcrUploader({
    farmerPhone,
    initialDetails = {},
    onDetailsSaved,
    onOpenSandboxPayout,
    t = (k, def) => def || k
}) {
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scanStage, setScanStage] = useState('');
    const [scanError, setScanError] = useState('');
    const [scanSuccess, setScanSuccess] = useState(false);

    // Form fields
    const [accountHolder, setAccountHolder] = useState(initialDetails.accountHolder || '');
    const [bankName, setBankName] = useState(initialDetails.bankName || '');
    const [accountNumber, setAccountNumber] = useState(initialDetails.accountNumber || '');
    const [ifscCode, setIfscCode] = useState(initialDetails.ifscCode || '');
    const [branchName, setBranchName] = useState(initialDetails.branchName || '');
    const [upiId, setUpiId] = useState(initialDetails.upiId || (farmerPhone ? `${farmerPhone}@upi` : ''));

    // UI states
    const [showAccountNumber, setShowAccountNumber] = useState(false);
    const [ocrExtracted, setOcrExtracted] = useState(initialDetails.ocrExtracted || false);
    const [detailsConfirmed, setDetailsConfirmed] = useState(initialDetails.detailsConfirmed || false);
    const [ocrConfidence, setOcrConfidence] = useState(initialDetails.ocrConfidence || null);
    const [rawExtractedLines, setRawExtractedLines] = useState([]);
    const [showRawDetails, setShowRawDetails] = useState(false);
    const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});

    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    // Cleanup preview URL on unmount
    useEffect(() => {
        return () => {
            if (imagePreview) URL.revokeObjectURL(imagePreview);
        };
    }, [imagePreview]);

    // Update if initialDetails changes
    useEffect(() => {
        if (initialDetails && initialDetails.accountNumber) {
            setAccountHolder(initialDetails.accountHolder || '');
            setBankName(initialDetails.bankName || '');
            setAccountNumber(initialDetails.accountNumber || '');
            setIfscCode(initialDetails.ifscCode || '');
            setBranchName(initialDetails.branchName || '');
            setUpiId(initialDetails.upiId || (farmerPhone ? `${farmerPhone}@upi` : ''));
            setOcrExtracted(!!initialDetails.ocrExtracted);
            setDetailsConfirmed(!!initialDetails.detailsConfirmed);
        }
    }, [initialDetails, farmerPhone]);

    const handleFileSelect = (file) => {
        if (!file) return;

        // Check format
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type.toLowerCase())) {
            setScanError('Please upload a valid image (JPG, JPEG, or PNG).');
            return;
        }

        // Max 15MB
        if (file.size > 15 * 1024 * 1024) {
            setScanError('Image file is too large. Please upload an image under 15MB.');
            return;
        }

        setScanError('');
        setScanSuccess(false);
        setImageFile(file);

        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setImagePreview(URL.createObjectURL(file));

        // Start scanning automatically
        processOcr(file);
    };

    const processOcr = async (file) => {
        setIsScanning(true);
        setScanError('');
        setScanSuccess(false);
        setSaveSuccessMsg('');
        setScanStage('Reading passbook image...');

        try {
            await new Promise(r => setTimeout(r, 400));
            setScanStage('Running PaddleOCR text detection...');
            
            const result = await kisanService.extractPassbookDetails(file);

            setScanStage('Extracting Bank Name, Account Number & IFSC...');
            await new Promise(r => setTimeout(r, 300));

            if (result && result.success && result.data) {
                const d = result.data;
                const holder = d.account_holder_name || d.accountHolder;
                const bName = d.bank_name || d.bankName;
                const accNo = d.account_number || d.accountNumber;
                const ifsc = d.ifsc_code || d.ifscCode;
                const branch = d.branch_name || d.branchName;

                if (holder) setAccountHolder(holder);
                if (bName) setBankName(bName);
                if (accNo) setAccountNumber(accNo);
                if (ifsc) setIfscCode(ifsc);
                if (branch) setBranchName(branch);

                setOcrExtracted(true);
                setOcrConfidence(d.confidence || 0.95);
                setRawExtractedLines(d.raw_lines || []);
                setScanSuccess(true);
                setDetailsConfirmed(false); // Reset confirmed until farmer reviews & saves
            } else {
                throw new Error(result?.message || 'Could not detect required bank details.');
            }
        } catch (err) {
            console.error('Passbook OCR failed:', err);
            setScanError(
                err.message || 
                'Failed to extract bank details from passbook. Please make sure image is clear or fill in the details manually below.'
            );
        } finally {
            setIsScanning(false);
            setScanStage('');
        }
    };

    // Validation
    const validateForm = () => {
        const errors = {};
        const cleanAcc = accountNumber.replace(/\s+/g, '');
        const cleanIfsc = ifscCode.trim().toUpperCase();

        if (!accountHolder.trim()) {
            errors.accountHolder = 'Account Holder Name is required.';
        }

        if (!bankName.trim()) {
            errors.bankName = 'Bank Name is required.';
        }

        if (!cleanAcc || !/^\d{9,18}$/.test(cleanAcc)) {
            errors.accountNumber = 'Account Number must be 9 to 18 numeric digits.';
        }

        if (!cleanIfsc || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
            errors.ifscCode = 'IFSC Code must be 11 characters (e.g., SBIN0004521, 5th character must be 0).';
        }

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleConfirmAndSave = (e) => {
        e?.preventDefault();
        if (!validateForm()) {
            return;
        }

        const cleanAcc = accountNumber.replace(/\s+/g, '');
        const cleanIfsc = ifscCode.trim().toUpperCase();

        const bankData = {
            accountHolder: accountHolder.trim(),
            bankName: bankName.trim(),
            accountNumber: cleanAcc,
            ifscCode: cleanIfsc,
            branchName: branchName.trim() || 'Main Branch',
            upiId: upiId.trim() || (farmerPhone ? `${farmerPhone}@upi` : ''),
            ocrExtracted: true,
            detailsConfirmed: true,
            ownershipVerified: false, // Explicit: PaddleOCR extracts text, not bank ownership
            verifiedAt: new Date().toISOString(),
            ocrConfidence: ocrConfidence || 0.95
        };

        const saved = kisanService.saveFarmerBankDetails(farmerPhone, bankData);
        setDetailsConfirmed(true);
        setSaveSuccessMsg('Bank details confirmed and securely saved for mill DBT payouts! 🎉');

        if (onDetailsSaved) {
            onDetailsSaved(saved);
        }

        setTimeout(() => setSaveSuccessMsg(''), 4500);
    };

    const handleReset = () => {
        setImageFile(null);
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setImagePreview(null);
        setScanError('');
        setScanSuccess(false);
        setFieldErrors({});
    };

    // Mask helper
    const getMaskedAccount = (acc) => {
        if (!acc) return '••••••••••••';
        const str = String(acc).replace(/\s+/g, '');
        if (str.length <= 4) return str;
        const lastFour = str.slice(-4);
        const dots = '•'.repeat(Math.max(4, str.length - 4));
        return `${dots}${lastFour}`;
    };

    return (
        <div 
            className="bento-card" 
            style={{
                background: 'linear-gradient(145deg, rgba(16, 32, 22, 0.75), rgba(11, 20, 15, 0.85))',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '1.25rem',
                padding: '1.75rem',
                marginBottom: '1.75rem',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                        <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(245, 158, 11, 0.25))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--primary)',
                            fontSize: '1.2rem',
                            border: '1px solid rgba(16, 185, 129, 0.4)'
                        }}>
                            <i className="fa-solid fa-address-card"></i>
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                                Add Bank Account using Passbook
                            </h3>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                Instant AI-Powered OCR Detail Extraction & Verification
                            </span>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: 'var(--primary)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        padding: '0.25rem 0.65rem',
                        borderRadius: '2rem',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                    }}>
                        <i className="fa-solid fa-robot"></i> PaddleOCR AI
                    </span>
                    <span style={{
                        background: 'rgba(59, 130, 246, 0.15)',
                        color: '#60a5fa',
                        border: '1px solid rgba(59, 130, 246, 0.35)',
                        padding: '0.25rem 0.65rem',
                        borderRadius: '2rem',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                    }}>
                        <i className="fa-solid fa-shield-halved"></i> Ephemeral & Private
                    </span>
                </div>
            </div>

            {/* Instruction Banner */}
            <div style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: '0.75rem',
                padding: '0.75rem 1rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                fontSize: '0.82rem',
                color: '#fef3c7'
            }}>
                <i className="fa-solid fa-circle-info" style={{ color: 'var(--accent-gold)', fontSize: '1.1rem', flexShrink: 0 }}></i>
                <span>
                    <strong>Photo Guideline:</strong> Upload or capture the <strong>first page</strong> of your bank passbook. Ensure the Account Number, IFSC Code, Bank Name, and your Name are clearly visible without heavy glare.
                </span>
            </div>

            {/* Upload / Camera Box */}
            {!imagePreview ? (
                <div 
                    style={{
                        border: '2px dashed rgba(16, 185, 129, 0.4)',
                        borderRadius: '1rem',
                        padding: '2rem 1.5rem',
                        textAlign: 'center',
                        background: 'rgba(0, 0, 0, 0.25)',
                        cursor: 'pointer',
                        transition: 'all 0.25s ease',
                        marginBottom: '1.5rem'
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                            handleFileSelect(e.dataTransfer.files[0]);
                        }
                    }}
                >
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        accept="image/jpeg,image/png,image/jpg" 
                        style={{ display: 'none' }} 
                        onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                                handleFileSelect(e.target.files[0]);
                            }
                        }}
                    />
                    <input 
                        type="file" 
                        ref={cameraInputRef} 
                        accept="image/*" 
                        capture="environment" 
                        style={{ display: 'none' }} 
                        onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                                handleFileSelect(e.target.files[0]);
                            }
                        }}
                    />

                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1rem',
                        fontSize: '1.5rem'
                    }}>
                        <i className="fa-solid fa-cloud-arrow-up"></i>
                    </div>

                    <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '1rem', color: '#fff' }}>
                        Click to Upload Bank Passbook Image
                    </h4>
                    <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Drag and drop here, or select from file manager • Supports JPG, JPEG, PNG (Max 15MB)
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            className="primary-btn"
                            onClick={() => fileInputRef.current?.click()}
                            style={{ padding: '0.55rem 1.1rem', fontSize: '0.82rem' }}
                        >
                            <i className="fa-solid fa-file-image"></i> Choose File
                        </button>
                        <button
                            type="button"
                            className="action-btn"
                            onClick={() => cameraInputRef.current?.click()}
                            style={{ padding: '0.55rem 1.1rem', fontSize: '0.82rem', background: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.4)', color: 'var(--accent-gold)' }}
                        >
                            <i className="fa-solid fa-camera"></i> Camera Capture
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '1rem',
                    padding: '1.25rem',
                    marginBottom: '1.5rem'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <i className="fa-solid fa-image" style={{ color: 'var(--primary)' }}></i>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>
                                Selected Passbook: {imageFile?.name || 'passbook_image.jpg'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                type="button"
                                className="action-btn"
                                onClick={handleReset}
                                disabled={isScanning}
                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                            >
                                <i className="fa-solid fa-rotate-right"></i> Scan Another
                            </button>
                        </div>
                    </div>

                    <div style={{ position: 'relative', maxWidth: '420px', maxHeight: '220px', overflow: 'hidden', borderRadius: '0.75rem', margin: '0 auto', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                        <img 
                            src={imagePreview} 
                            alt="Passbook Preview" 
                            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000' }}
                        />

                        {/* Animated Scanner Laser Bar */}
                        {isScanning && (
                            <div style={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                top: 0,
                                height: '3px',
                                background: 'linear-gradient(90deg, transparent, #10b981, #34d399, transparent)',
                                boxShadow: '0 0 15px #10b981',
                                animation: 'scanAnimation 1.6s infinite ease-in-out'
                            }}></div>
                        )}
                    </div>

                    {/* Scanning Stage Text */}
                    {isScanning && (
                        <div style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--primary)' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
                                <i className="fa-solid fa-circle-notch fa-spin"></i>
                                <span>{scanStage || 'Processing with PaddleOCR...'}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Error Banner */}
            {scanError && (
                <div style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: '0.75rem',
                    padding: '0.75rem 1rem',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    fontSize: '0.82rem',
                    color: '#fca5a5'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <i className="fa-solid fa-triangle-exclamation" style={{ color: '#ef4444' }}></i>
                        <span>{scanError}</span>
                    </div>
                    <button 
                        type="button" 
                        onClick={() => setScanError('')} 
                        style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer' }}
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Success Extract Banner */}
            {scanSuccess && (
                <div style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    borderRadius: '0.75rem',
                    padding: '0.75rem 1rem',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    fontSize: '0.82rem',
                    color: '#6ee7b7'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <i className="fa-solid fa-circle-check" style={{ color: '#10b981' }}></i>
                        <span>
                            <strong>OCR Extraction Complete!</strong> Bank details extracted from passbook image. Please review and confirm below.
                        </span>
                    </div>
                    {rawExtractedLines.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowRawDetails(!showRawDetails)}
                            style={{
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: 'none',
                                color: '#fff',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '0.35rem',
                                fontSize: '0.72rem',
                                cursor: 'pointer'
                            }}
                        >
                            {showRawDetails ? 'Hide OCR Lines' : 'View OCR Lines'}
                        </button>
                    )}
                </div>
            )}

            {/* Raw OCR Text Diagnostic Drawer */}
            {showRawDetails && rawExtractedLines.length > 0 && (
                <div style={{
                    background: '#0a0f0d',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '0.5rem',
                    padding: '0.75rem',
                    marginBottom: '1.25rem',
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    color: 'var(--text-muted)',
                    maxHeight: '130px',
                    overflowY: 'auto'
                }}>
                    <div style={{ fontWeight: 700, color: 'var(--accent-gold)', marginBottom: '0.35rem' }}>
                        Detected Text Lines ({rawExtractedLines.length}):
                    </div>
                    {rawExtractedLines.map((line, idx) => (
                        <div key={idx} style={{ padding: '2px 0' }}>• {line}</div>
                    ))}
                </div>
            )}

            {/* Verification Status Badges Section */}
            <div style={{
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '0.85rem',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '1rem',
                marginBottom: '1.5rem'
            }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem', fontWeight: 700 }}>
                    Verification Pipeline Status
                </div>
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                    {/* Badge 1: OCR Extracted */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '0.5rem',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        background: ocrExtracted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${ocrExtracted ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                        color: ocrExtracted ? 'var(--primary)' : 'var(--text-muted)'
                    }}>
                        <i className={ocrExtracted ? "fa-solid fa-circle-check" : "fa-regular fa-circle"}></i>
                        <span>OCR Extracted {ocrExtracted ? '✓' : ''}</span>
                    </div>

                    {/* Badge 2: Farmer Confirmed */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '0.5rem',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        background: detailsConfirmed ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${detailsConfirmed ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                        color: detailsConfirmed ? 'var(--accent-gold)' : 'var(--text-muted)'
                    }}>
                        <i className={detailsConfirmed ? "fa-solid fa-user-check" : "fa-regular fa-circle"}></i>
                        <span>Bank Details Confirmed {detailsConfirmed ? '✓' : ''}</span>
                    </div>

                    {/* Badge 3: Ownership Verified (Distinct from OCR) */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '0.5rem',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: 'rgba(59, 130, 246, 0.08)',
                        border: '1px dashed rgba(59, 130, 246, 0.3)',
                        color: '#93c5fd'
                    }} title="PaddleOCR reads the passbook text. Official bank account ownership verification is scheduled via banking network penny-drop.">
                        <i className="fa-solid fa-lock"></i>
                        <span>Bank Ownership: Pending Verification</span>
                    </div>
                </div>
            </div>

            {/* Editable Confirmation Form */}
            <form onSubmit={handleConfirmAndSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
                    
                    {/* Account Holder Name */}
                    <div className="form-group-modern">
                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>
                                <i className="fa-solid fa-user" style={{ color: 'var(--primary)', marginRight: '0.4rem' }}></i>
                                Account Holder Name *
                            </span>
                            {ocrExtracted && <span style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>Auto-Extracted</span>}
                        </label>
                        <div className="input-with-icon">
                            <i className="fa-solid fa-id-card field-icon"></i>
                            <input 
                                type="text" 
                                value={accountHolder} 
                                onChange={e => {
                                    setAccountHolder(e.target.value);
                                    if (fieldErrors.accountHolder) setFieldErrors({ ...fieldErrors, accountHolder: null });
                                }}
                                placeholder="e.g. Ramesh Reddy"
                                required
                            />
                        </div>
                        {fieldErrors.accountHolder && (
                            <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '0.2rem', display: 'block' }}>
                                {fieldErrors.accountHolder}
                            </span>
                        )}
                    </div>

                    {/* Bank Name */}
                    <div className="form-group-modern">
                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>
                                <i className="fa-solid fa-building-columns" style={{ color: 'var(--accent-gold)', marginRight: '0.4rem' }}></i>
                                Bank Name *
                            </span>
                            {ocrExtracted && <span style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>Auto-Extracted</span>}
                        </label>
                        <div className="input-with-icon">
                            <i className="fa-solid fa-landmark field-icon"></i>
                            <input 
                                type="text" 
                                value={bankName} 
                                onChange={e => {
                                    setBankName(e.target.value);
                                    if (fieldErrors.bankName) setFieldErrors({ ...fieldErrors, bankName: null });
                                }}
                                placeholder="e.g. State Bank of India, HDFC, Union Bank"
                                required
                            />
                        </div>
                        {fieldErrors.bankName && (
                            <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '0.2rem', display: 'block' }}>
                                {fieldErrors.bankName}
                            </span>
                        )}
                    </div>

                    {/* Account Number with Mask / Eye Toggle */}
                    <div className="form-group-modern">
                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>
                                <i className="fa-solid fa-hashtag" style={{ color: 'var(--primary)', marginRight: '0.4rem' }}></i>
                                Account Number *
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {showAccountNumber ? 'Plain View' : 'Masked (Privacy Guard)'}
                            </span>
                        </label>
                        <div className="input-with-icon" style={{ position: 'relative' }}>
                            <i className="fa-solid fa-credit-card field-icon"></i>
                            <input 
                                type={showAccountNumber ? "text" : "password"} 
                                value={accountNumber} 
                                onChange={e => {
                                    setAccountNumber(e.target.value.replace(/\D/g, ''));
                                    if (fieldErrors.accountNumber) setFieldErrors({ ...fieldErrors, accountNumber: null });
                                }}
                                placeholder="Enter 9-18 digit account number"
                                maxLength="20"
                                required
                                style={{
                                    letterSpacing: showAccountNumber ? '0.05em' : '0.15em',
                                    fontFamily: 'monospace',
                                    paddingRight: '3rem'
                                }}
                            />
                            <button 
                                type="button" 
                                onClick={() => setShowAccountNumber(!showAccountNumber)}
                                style={{
                                    position: 'absolute',
                                    right: '0.75rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    fontSize: '1rem',
                                    padding: '0.25rem'
                                }}
                                title={showAccountNumber ? "Mask account number" : "Show plain account number"}
                            >
                                <i className={`fa-solid ${showAccountNumber ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            </button>
                        </div>
                        {fieldErrors.accountNumber ? (
                            <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '0.2rem', display: 'block' }}>
                                {fieldErrors.accountNumber}
                            </span>
                        ) : (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                                Preview: <strong style={{ fontFamily: 'monospace', color: '#fff' }}>{getMaskedAccount(accountNumber)}</strong>
                            </span>
                        )}
                    </div>

                    {/* IFSC Code */}
                    <div className="form-group-modern">
                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>
                                <i className="fa-solid fa-barcode" style={{ color: 'var(--accent-gold)', marginRight: '0.4rem' }}></i>
                                IFSC Code *
                            </span>
                            {ocrExtracted && <span style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>Auto-Extracted</span>}
                        </label>
                        <div className="input-with-icon">
                            <i className="fa-solid fa-code field-icon"></i>
                            <input 
                                type="text" 
                                value={ifscCode} 
                                onChange={e => {
                                    setIfscCode(e.target.value.toUpperCase());
                                    if (fieldErrors.ifscCode) setFieldErrors({ ...fieldErrors, ifscCode: null });
                                }}
                                placeholder="e.g. SBIN0004521"
                                maxLength="11"
                                required
                                style={{ textTransform: 'uppercase', fontFamily: 'monospace' }}
                            />
                        </div>
                        {fieldErrors.ifscCode && (
                            <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '0.2rem', display: 'block' }}>
                                {fieldErrors.ifscCode}
                            </span>
                        )}
                    </div>

                    {/* Branch Name */}
                    <div className="form-group-modern">
                        <label>
                            <i className="fa-solid fa-location-dot" style={{ color: 'var(--primary-light)', marginRight: '0.4rem' }}></i>
                            Branch Name / Location
                        </label>
                        <div className="input-with-icon">
                            <i className="fa-solid fa-map-pin field-icon"></i>
                            <input 
                                type="text" 
                                value={branchName} 
                                onChange={e => setBranchName(e.target.value)} 
                                placeholder="e.g. Suryapet Main Branch, Telangana"
                            />
                        </div>
                    </div>

                    {/* UPI ID */}
                    <div className="form-group-modern">
                        <label>
                            <i className="fa-brands fa-google-pay" style={{ color: 'var(--primary-light)', marginRight: '0.4rem' }}></i>
                            UPI ID / VPA (Optional)
                        </label>
                        <div className="input-with-icon">
                            <i className="fa-solid fa-qrcode field-icon"></i>
                            <input 
                                type="text" 
                                value={upiId} 
                                onChange={e => setUpiId(e.target.value)} 
                                placeholder="e.g. 9182017128@ybl or farmer@upi"
                            />
                        </div>
                    </div>

                </div>

                {/* Save Success Banner */}
                {saveSuccessMsg && (
                    <div style={{
                        background: 'rgba(16, 185, 129, 0.2)',
                        border: '1px solid var(--primary)',
                        borderRadius: '0.75rem',
                        padding: '0.85rem 1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        color: '#6ee7b7',
                        fontSize: '0.88rem',
                        fontWeight: 600
                    }}>
                        <i className="fa-solid fa-circle-check" style={{ color: 'var(--primary)', fontSize: '1.2rem' }}></i>
                        <span>{saveSuccessMsg}</span>
                    </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem' }}>
                    <div>
                        {onOpenSandboxPayout && (
                            <button
                                type="button"
                                className="action-btn"
                                onClick={() => onOpenSandboxPayout({
                                    accountHolder,
                                    bankName,
                                    accountNumber,
                                    ifscCode,
                                    upiId
                                })}
                                style={{
                                    background: 'rgba(245, 158, 11, 0.15)',
                                    borderColor: 'rgba(245, 158, 11, 0.4)',
                                    color: 'var(--accent-gold)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    fontSize: '0.85rem',
                                    padding: '0.65rem 1.1rem'
                                }}
                            >
                                <i className="fa-solid fa-vial-circle-check"></i>
                                <span>Test Demo / Sandbox Payout</span>
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {imagePreview && (
                            <button
                                type="button"
                                className="action-btn"
                                onClick={handleReset}
                                style={{ padding: '0.65rem 1.1rem', fontSize: '0.85rem' }}
                            >
                                <i className="fa-solid fa-arrow-rotate-left"></i> Re-upload / Scan Again
                            </button>
                        )}

                        <button
                            type="submit"
                            className="primary-btn"
                            style={{
                                padding: '0.65rem 1.4rem',
                                fontSize: '0.88rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                minWidth: '200px',
                                justifyContent: 'center'
                            }}
                        >
                            <i className="fa-solid fa-check-double"></i>
                            <span>Confirm Bank Details</span>
                        </button>
                    </div>
                </div>
            </form>

            <style>{`
                @keyframes scanAnimation {
                    0% { top: 0%; opacity: 0.8; }
                    50% { top: 96%; opacity: 1; }
                    100% { top: 0%; opacity: 0.8; }
                }
            `}</style>
        </div>
    );
}
