import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabase';
import { useLanguage } from '../context/LanguageContext';
import LanguageSelector from './LanguageSelector';
import PassbookOcrUploader from './PassbookOcrUploader';
import SandboxPayoutModal from './SandboxPayoutModal';
import indiaStatesDistricts from '../data/india_all_states_all_districts.json';

export default function FarmerProfileView({ 
    user = {}, 
    crops = [], 
    enquiries = [], 
    onProfileUpdated = () => {},
    onLogout = () => {} 
}) {
    // Current active sub-tab inside profile
    const [subTab, setSubTab] = useState('general'); // 'general' | 'payout' | 'security' | 'preferences'

    // Form fields
    const [name, setName] = useState(user.name || '');
    const [altPhone, setAltPhone] = useState(user.altPhone || '');
    const [email, setEmail] = useState(user.email || '');
    const [village, setVillage] = useState('');
    
    // State & District selection from India database
    const allStates = useMemo(() => Object.keys(indiaStatesDistricts).sort(), []);
    const [selectedState, setSelectedState] = useState('Telangana');
    const [selectedDistrict, setSelectedDistrict] = useState('Warangal');
    const [farmingType, setFarmingType] = useState('Natural / Organic Farming');

    // Available districts for the currently selected state
    const availableDistricts = useMemo(() => {
        return selectedState && indiaStatesDistricts[selectedState] ? indiaStatesDistricts[selectedState] : [];
    }, [selectedState]);

    const handleStateChange = (newState) => {
        setSelectedState(newState);
        const dists = indiaStatesDistricts[newState] || [];
        if (dists.length > 0) {
            if (!dists.includes(selectedDistrict)) {
                setSelectedDistrict(dists[0]);
            }
        } else {
            setSelectedDistrict('');
        }
    };

    // Bank & Payout fields
    const [bankName, setBankName] = useState('State Bank of India');
    const [accountHolder, setAccountHolder] = useState(user.name || '');
    const [accountNumber, setAccountNumber] = useState('');
    const [ifscCode, setIfscCode] = useState('SBIN0012345');
    const [branchName, setBranchName] = useState('');
    const [upiId, setUpiId] = useState('');
    const [ocrExtracted, setOcrExtracted] = useState(false);
    const [detailsConfirmed, setDetailsConfirmed] = useState(false);
    const [showSandboxModal, setShowSandboxModal] = useState(false);
    const [sandboxTargetDetails, setSandboxTargetDetails] = useState(null);

    // Security PIN fields
    const [pin, setPin] = useState(user.pin || '');
    const [confirmPin, setConfirmPin] = useState('');
    const [showPin, setShowPin] = useState(false);

    // Global Language & Translation
    const { language: globalLang, setLanguage: setGlobalLang, t } = useLanguage();

    // Preferences & Alerts
    const [priceAlerts, setPriceAlerts] = useState(true);
    const [orderSms, setOrderSms] = useState(true);
    const [weatherAdvisories, setWeatherAdvisories] = useState(true);
    const [language, setLanguage] = useState(globalLang || 'en');

    // UX states
    const [isSaving, setIsSaving] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    // Load persisted local profile details if available
    useEffect(() => {
        const storageKey = `kisan_farmer_ext_${user.phone || 'default'}`;
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.village) setVillage(parsed.village);
                
                // Parse state and district
                if (parsed.state && indiaStatesDistricts[parsed.state]) {
                    setSelectedState(parsed.state);
                    if (parsed.district) setSelectedDistrict(parsed.district);
                } else if (parsed.district) {
                    // Try to parse compound string or lookup state
                    let fState = null;
                    let fDist = null;
                    if (parsed.district.includes(',')) {
                        const parts = parsed.district.split(',').map(s => s.trim());
                        if (parts[1] && indiaStatesDistricts[parts[1]]) {
                            fState = parts[1];
                            fDist = parts[0];
                        }
                    }
                    if (!fState) {
                        for (const [stName, dList] of Object.entries(indiaStatesDistricts)) {
                            const found = dList.find(d => d.toLowerCase() === parsed.district.toLowerCase());
                            if (found) {
                                fState = stName;
                                fDist = found;
                                break;
                            }
                        }
                    }
                    if (fState) setSelectedState(fState);
                    if (fDist) setSelectedDistrict(fDist);
                }

                if (parsed.farmingType) setFarmingType(parsed.farmingType);
                if (parsed.bankName) setBankName(parsed.bankName);
                if (parsed.accountHolder) setAccountHolder(parsed.accountHolder);
                if (parsed.accountNumber) setAccountNumber(parsed.accountNumber);
                if (parsed.ifscCode) setIfscCode(parsed.ifscCode);
                if (parsed.branchName) setBranchName(parsed.branchName);
                if (parsed.upiId) setUpiId(parsed.upiId);
                if (typeof parsed.ocrExtracted === 'boolean') setOcrExtracted(parsed.ocrExtracted);
                if (typeof parsed.detailsConfirmed === 'boolean') setDetailsConfirmed(parsed.detailsConfirmed);
                if (parsed.language) setLanguage(parsed.language);
                if (typeof parsed.priceAlerts === 'boolean') setPriceAlerts(parsed.priceAlerts);
                if (typeof parsed.orderSms === 'boolean') setOrderSms(parsed.orderSms);
                if (typeof parsed.weatherAdvisories === 'boolean') setWeatherAdvisories(parsed.weatherAdvisories);
            } else {
                // Default fallback values
                setUpiId(user.phone ? `${user.phone}@upi` : 'farmer@upi');
                setAccountNumber('XXXX-XXXX-4819');
            }
        } catch (e) {
            console.warn('Error reading saved extended profile:', e);
        }
    }, [user.phone]);

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3500);
    };

    // Calculate dynamic stats
    const totalAcres = crops.reduce((acc, c) => acc + (Number(c.acres) || 0), 0);
    const farmerId = `KISAN-FARM-${(user.phone || '9182').slice(-4)}`;

    // Save General & Farm Profile
    const handleSaveGeneral = async (e) => {
        e?.preventDefault();
        setIsSaving(true);
        try {
            // Update Supabase
            if (user.phone) {
                try {
                    await supabase
                        .from('farmers')
                        .update({ name, altPhone })
                        .eq('phone', user.phone);
                } catch (dbErr) {
                    console.warn('Supabase profile update notice:', dbErr);
                }
            }

            // Save extended details to localStorage
            const storageKey = `kisan_farmer_ext_${user.phone || 'default'}`;
            const combinedDistrict = selectedDistrict && selectedState ? `${selectedDistrict}, ${selectedState}` : selectedDistrict || selectedState;
            const currentExt = {
                village,
                state: selectedState,
                district: selectedDistrict,
                districtFull: combinedDistrict,
                farmingType,
                bankName,
                accountHolder,
                accountNumber,
                ifscCode,
                upiId,
                language,
                priceAlerts,
                orderSms,
                weatherAdvisories
            };
            localStorage.setItem(storageKey, JSON.stringify(currentExt));

            if (onProfileUpdated) {
                onProfileUpdated({ 
                    name, 
                    altPhone, 
                    state: selectedState, 
                    district: selectedDistrict,
                    districtFull: combinedDistrict 
                });
            }
            showToast('Personal & Farm Location updated! 🌿');
        } catch (err) {
            console.error('Error saving profile:', err);
            showToast('Failed to save profile. Please retry.');
        } finally {
            setIsSaving(false);
        }
    };

    // Save Payout Details
    const handleSavePayout = (e) => {
        e?.preventDefault();
        setIsSaving(true);
        try {
            const storageKey = `kisan_farmer_ext_${user.phone || 'default'}`;
            const existing = JSON.parse(localStorage.getItem(storageKey) || '{}');
            const updated = {
                ...existing,
                bankName,
                accountHolder,
                accountNumber,
                ifscCode,
                upiId
            };
            localStorage.setItem(storageKey, JSON.stringify(updated));
            showToast('Direct Payout details updated! 💳');
        } catch (err) {
            console.error('Error saving payout details:', err);
            showToast('Could not save bank info.');
        } finally {
            setIsSaving(false);
        }
    };

    // Save Security PIN
    const handleUpdatePin = async (e) => {
        e?.preventDefault();
        if (!pin || pin.length < 4 || pin.length > 6 || isNaN(pin)) {
            return showToast('PIN must be 4 to 6 numeric digits.');
        }
        if (confirmPin && pin !== confirmPin) {
            return showToast('PIN confirmation does not match.');
        }

        setIsSaving(true);
        try {
            if (user.phone) {
                const { error } = await supabase
                    .from('farmers')
                    .update({ pin })
                    .eq('phone', user.phone);
                if (error) throw error;
            }
            setConfirmPin('');
            showToast('Security PIN successfully updated! 🔒');
        } catch (err) {
            console.error('Error updating PIN:', err);
            showToast('Failed to update PIN.');
        } finally {
            setIsSaving(false);
        }
    };

    // Save Preferences
    const handleSavePreferences = (newLangCode) => {
        const langCode = newLangCode || language;
        if (newLangCode) {
            setLanguage(newLangCode);
            setGlobalLang(newLangCode);
        }
        const storageKey = `kisan_farmer_ext_${user.phone || 'default'}`;
        const existing = JSON.parse(localStorage.getItem(storageKey) || '{}');
        const updated = {
            ...existing,
            priceAlerts,
            orderSms,
            weatherAdvisories,
            language: langCode
        };
        localStorage.setItem(storageKey, JSON.stringify(updated));
        showToast('Preferences & Regional Language updated! 🌐');
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '900px', margin: '0 auto' }}>
            
            {/* Custom Floating Toast */}
            {toastMessage && (
                <div className="custom-toast">
                    <i className="fa-solid fa-circle-check" style={{ color: 'var(--primary-light)', fontSize: '1.2rem' }}></i>
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* ======================================================== */}
            {/* 1. HERO IDENTITY CARD                                   */}
            {/* ======================================================== */}
            <div className="profile-hero-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                        
                        {/* Avatar */}
                        <div className="profile-avatar-wrapper">
                            <div className="profile-avatar-inner">
                                {user.avatar ? (
                                    <img 
                                        src={user.avatar} 
                                        alt="Avatar" 
                                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                                    />
                                ) : (
                                    <span>{(name || user.phone || 'F')[0]?.toUpperCase()}</span>
                                )}
                            </div>
                            <div className="profile-verified-badge" title="Verified Farmer">
                                <i className="fa-solid fa-check"></i>
                            </div>
                        </div>

                        {/* Title & IDs */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <h2 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>
                                    {name || 'Kisan Farmer'}
                                </h2>
                                <span className="badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.65rem' }}>
                                    <i className="fa-solid fa-shield-halved"></i>
                                    Verified Farmer
                                </span>
                            </div>

                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.35rem 0 0.65rem 0' }}>
                                Cultivator & Landholder • <span style={{ color: 'var(--primary-light)', fontFamily: 'monospace', fontWeight: 600 }}>{farmerId}</span>
                            </p>

                            {/* Tags */}
                            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
                                <span style={{ background: 'rgba(255, 255, 255, 0.06)', padding: '0.2rem 0.6rem', borderRadius: '0.5rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                    <i className="fa-solid fa-phone" style={{ marginRight: '0.35rem', color: 'var(--primary)' }}></i>
                                    +91 {user.phone || 'Not linked'}
                                </span>
                                <span style={{ background: 'rgba(255, 255, 255, 0.06)', padding: '0.2rem 0.6rem', borderRadius: '0.5rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                    <i className="fa-solid fa-location-dot" style={{ marginRight: '0.35rem', color: 'var(--accent-gold)' }}></i>
                                    {selectedDistrict && selectedState ? `${selectedDistrict}, ${selectedState}` : selectedState || selectedDistrict || 'Warangal, Telangana'}
                                </span>
                                <span style={{ background: 'rgba(255, 255, 255, 0.06)', padding: '0.2rem 0.6rem', borderRadius: '0.5rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                    <i className="fa-solid fa-seedling" style={{ marginRight: '0.35rem', color: 'var(--primary-light)' }}></i>
                                    Kisan Direct Network
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right Quick Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', minWidth: '150px' }}>
                        <button 
                            className="secondary-btn" 
                            onClick={onLogout}
                            style={{ padding: '0.6rem 1.1rem', fontSize: '0.85rem', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                        >
                            <i className="fa-solid fa-arrow-right-from-bracket"></i>
                            Logout
                        </button>
                    </div>
                </div>

                {/* ======================================================== */}
                {/* 2. STATS RIBBON                                         */}
                {/* ======================================================== */}
                <div className="profile-stats-grid">
                    <div className="profile-stat-box">
                        <div className="profile-stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--primary)' }}>
                            <i className="fa-solid fa-wheat-awn"></i>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Cultivated Land
                            </div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                {totalAcres > 0 ? `${totalAcres} Acres` : '0 Acres'}
                            </div>
                        </div>
                    </div>

                    <div className="profile-stat-box">
                        <div className="profile-stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--primary)' }}>
                            <i className="fa-solid fa-layer-group"></i>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {t('Total Land Holding')}
                            </div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                {totalAcres > 0 ? `${totalAcres} ${t('acres', 'Acres')}` : `0 ${t('acres', 'Acres')}`}
                            </div>
                        </div>
                    </div>

                    <div className="profile-stat-box">
                        <div className="profile-stat-icon" style={{ background: 'rgba(197, 155, 78, 0.15)', color: 'var(--accent-gold)' }}>
                            <i className="fa-solid fa-boxes-stacked"></i>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {t('Registered Crops')}
                            </div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                {crops.length} {t('active', 'Listed')}
                            </div>
                        </div>
                    </div>

                    <div className="profile-stat-box">
                        <div className="profile-stat-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
                            <i className="fa-solid fa-handshake"></i>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {t('Mill Enquiries')}
                            </div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                {enquiries.length} {t('active', 'Active')}
                            </div>
                        </div>
                    </div>

                    <div className="profile-stat-box">
                        <div className="profile-stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--primary-light)' }}>
                            <i className="fa-solid fa-certificate"></i>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {t('KYC Status')}
                            </div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary-light)' }}>
                                100% {t('completed', 'Verified')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ======================================================== */}
            {/* 3. NAVIGATION PILLS                                      */}
            {/* ======================================================== */}
            <div className="profile-nav-pills">
                <button 
                    className={`profile-nav-pill ${subTab === 'general' ? 'active' : ''}`}
                    onClick={() => setSubTab('general')}
                >
                    <i className="fa-solid fa-user"></i>
                    {t('Farm & Personal Info')}
                </button>
                <button 
                    className={`profile-nav-pill ${subTab === 'payout' ? 'active' : ''}`}
                    onClick={() => setSubTab('payout')}
                >
                    <i className="fa-solid fa-building-columns"></i>
                    {t('Direct Payout & Bank')}
                </button>
                <button 
                    className={`profile-nav-pill ${subTab === 'security' ? 'active' : ''}`}
                    onClick={() => setSubTab('security')}
                >
                    <i className="fa-solid fa-shield-halved"></i>
                    {t('Security & PIN')}
                </button>
                <button 
                    className={`profile-nav-pill ${subTab === 'preferences' ? 'active' : ''}`}
                    onClick={() => setSubTab('preferences')}
                >
                    <i className="fa-solid fa-bell"></i>
                    {t('Alerts & Language')}
                </button>
            </div>

            {/* ======================================================== */}
            {/* 4. TAB CONTENTS                                          */}
            {/* ======================================================== */}
            
            {/* TAB: GENERAL & FARM DETAILS */}
            {subTab === 'general' && (
                <div className="bento-card" style={{ padding: '2rem' }}>
                    <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{t('Personal & Agricultural Details')}</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                            Update your farmer identity and location details displayed to verified mill buyers.
                        </p>
                    </div>

                    <form onSubmit={handleSaveGeneral} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                            
                            <div className="form-group-modern">
                                <label>
                                    <i className="fa-solid fa-user" style={{ color: 'var(--primary)' }}></i>
                                    {t('Full Name')}
                                </label>
                                <div className="input-with-icon">
                                    <i className="fa-solid fa-user field-icon"></i>
                                    <input 
                                        type="text" 
                                        value={name} 
                                        onChange={e => setName(e.target.value)} 
                                        placeholder="e.g. K. Ram Dheeraj Goud"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group-modern">
                                <label>
                                    <i className="fa-solid fa-phone" style={{ color: 'var(--primary)' }}></i>
                                    {t('Primary Phone (Registered)')}
                                </label>
                                <div className="input-with-icon">
                                    <i className="fa-solid fa-lock field-icon"></i>
                                    <input 
                                        type="text" 
                                        value={user.phone || ''} 
                                        disabled 
                                        title="Primary phone cannot be modified directly"
                                    />
                                </div>
                            </div>

                            <div className="form-group-modern">
                                <label>
                                    <i className="fa-brands fa-whatsapp" style={{ color: '#25D366' }}></i>
                                    {t('WhatsApp / Alternate Phone')}
                                </label>
                                <div className="input-with-icon">
                                    <i className="fa-solid fa-phone field-icon"></i>
                                    <input 
                                        type="tel" 
                                        value={altPhone} 
                                        onChange={e => setAltPhone(e.target.value)} 
                                        placeholder="10-digit mobile number"
                                    />
                                </div>
                            </div>

                            <div className="form-group-modern">
                                <label>
                                    <i className="fa-solid fa-envelope" style={{ color: 'var(--accent-gold)' }}></i>
                                    Email Address (Optional)
                                </label>
                                <div className="input-with-icon">
                                    <i className="fa-solid fa-envelope field-icon"></i>
                                    <input 
                                        type="email" 
                                        value={email} 
                                        onChange={e => setEmail(e.target.value)} 
                                        placeholder="farmer@example.com"
                                    />
                                </div>
                            </div>

                            <div className="form-group-modern">
                                <label>
                                    <i className="fa-solid fa-location-dot" style={{ color: 'var(--primary)' }}></i>
                                    Village / Mandal
                                </label>
                                <div className="input-with-icon">
                                    <i className="fa-solid fa-map-pin field-icon"></i>
                                    <input 
                                        type="text" 
                                        value={village} 
                                        onChange={e => setVillage(e.target.value)} 
                                        placeholder="e.g. Geesugonda Village"
                                    />
                                </div>
                            </div>

                            <div className="form-group-modern">
                                <label>
                                    <i className="fa-solid fa-map-location-dot" style={{ color: 'var(--accent-gold)' }}></i>
                                    State / Union Territory
                                </label>
                                <div className="input-with-icon">
                                    <i className="fa-solid fa-earth-asia field-icon"></i>
                                    <select 
                                        value={selectedState} 
                                        onChange={e => handleStateChange(e.target.value)}
                                        required
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <option value="" disabled>-- Select State --</option>
                                        {allStates.map(st => (
                                            <option key={st} value={st} style={{ background: '#0a1a12', color: '#fff' }}>
                                                {st}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-group-modern">
                                <label>
                                    <i className="fa-solid fa-building-flag" style={{ color: 'var(--primary)' }}></i>
                                    District {selectedState ? `(${selectedState})` : ''}
                                </label>
                                <div className="input-with-icon">
                                    <i className="fa-solid fa-map-pin field-icon"></i>
                                    <select 
                                        value={selectedDistrict} 
                                        onChange={e => setSelectedDistrict(e.target.value)}
                                        disabled={!selectedState || availableDistricts.length === 0}
                                        required
                                        style={{ cursor: selectedState ? 'pointer' : 'not-allowed' }}
                                    >
                                        <option value="" disabled>-- Select District --</option>
                                        {availableDistricts.map(dist => (
                                            <option key={dist} value={dist} style={{ background: '#0a1a12', color: '#fff' }}>
                                                {dist}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-group-modern" style={{ gridColumn: '1 / -1' }}>
                                <label>
                                    <i className="fa-solid fa-leaf" style={{ color: 'var(--primary-light)' }}></i>
                                    Primary Cultivation Type
                                </label>
                                <div className="input-with-icon">
                                    <i className="fa-solid fa-tractor field-icon"></i>
                                    <select 
                                        value={farmingType} 
                                        onChange={e => setFarmingType(e.target.value)}
                                    >
                                        <option value="Natural / Organic Farming">Natural / Organic Farming</option>
                                        <option value="Conventional Commercial Crops">Conventional Commercial Crops</option>
                                        <option value="Horticulture & Fruits">Horticulture & Fruits</option>
                                        <option value="Agroforestry & Mixed Farming">Agroforestry & Mixed Farming</option>
                                    </select>
                                </div>
                            </div>

                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                            <button 
                                type="submit" 
                                className="primary-btn" 
                                disabled={isSaving}
                                style={{ minWidth: '180px', justifyContent: 'center' }}
                            >
                                <i className="fa-solid fa-floppy-disk"></i>
                                {isSaving ? t('save', 'Saving...') : t('Save Profile Changes')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* TAB: DIRECT PAYOUT & BANKING (AI PASSBOOK OCR INTEGRATED) */}
            {subTab === 'payout' && (
                <div>
                    <PassbookOcrUploader
                        farmerPhone={user.phone}
                        initialDetails={{
                            accountHolder,
                            bankName,
                            accountNumber,
                            ifscCode,
                            branchName,
                            upiId,
                            ocrExtracted,
                            detailsConfirmed
                        }}
                        onDetailsSaved={(updated) => {
                            if (updated) {
                                setAccountHolder(updated.accountHolder);
                                setBankName(updated.bankName);
                                setAccountNumber(updated.accountNumber);
                                setIfscCode(updated.ifscCode);
                                setBranchName(updated.branchName || '');
                                setUpiId(updated.upiId);
                                setOcrExtracted(!!updated.ocrExtracted);
                                setDetailsConfirmed(!!updated.detailsConfirmed);
                                showToast('Bank details updated & confirmed! 💳');
                            }
                        }}
                        onOpenSandboxPayout={(details) => {
                            setSandboxTargetDetails(details);
                            setShowSandboxModal(true);
                        }}
                        t={t}
                    />
                </div>
            )}

            {/* TAB: SECURITY & PIN */}
            {subTab === 'security' && (
                <div className="bento-card" style={{ padding: '2rem' }}>
                    <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Account Security & Login PIN</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                            Manage your 4 to 6 digit security PIN used for rapid login and verifying crop handovers.
                        </p>
                    </div>

                    <form onSubmit={handleUpdatePin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                            
                            <div className="form-group-modern">
                                <label>
                                    <i className="fa-solid fa-key" style={{ color: 'var(--primary)' }}></i>
                                    New Security PIN (4-6 Digits)
                                </label>
                                <div className="input-with-icon" style={{ position: 'relative' }}>
                                    <i className="fa-solid fa-lock field-icon"></i>
                                    <input 
                                        type={showPin ? 'text' : 'password'} 
                                        value={pin} 
                                        onChange={e => setPin(e.target.value.replace(/\D/g, ''))} 
                                        maxLength="6"
                                        placeholder="••••"
                                        required
                                        style={{ paddingRight: '2.75rem' }}
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => setShowPin(!showPin)}
                                        style={{ position: 'absolute', right: '0.75rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem' }}
                                        title={showPin ? 'Hide PIN' : 'Show PIN'}
                                    >
                                        <i className={`fa-solid ${showPin ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                    </button>
                                </div>
                            </div>

                            <div className="form-group-modern">
                                <label>
                                    <i className="fa-solid fa-circle-check" style={{ color: 'var(--accent-gold)' }}></i>
                                    Confirm New PIN
                                </label>
                                <div className="input-with-icon">
                                    <i className="fa-solid fa-shield field-icon"></i>
                                    <input 
                                        type={showPin ? 'text' : 'password'} 
                                        value={confirmPin} 
                                        onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))} 
                                        maxLength="6"
                                        placeholder="••••"
                                    />
                                </div>
                            </div>

                        </div>

                        <div style={{ background: 'rgba(197, 155, 78, 0.08)', border: '1px solid rgba(197, 155, 78, 0.25)', borderRadius: '0.75rem', padding: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <i className="fa-solid fa-shield-halved" style={{ color: 'var(--accent-gold)', fontSize: '1.4rem' }}></i>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                                <strong>Safety Tip:</strong> Your Kisan PIN protects your load handovers and mill payout settlements. Do not share your PIN with unverified buyers.
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                            <button 
                                type="submit" 
                                className="primary-btn" 
                                disabled={isSaving}
                                style={{ minWidth: '180px', justifyContent: 'center' }}
                            >
                                <i className="fa-solid fa-lock"></i>
                                {isSaving ? 'Updating...' : 'Update Security PIN'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* TAB: PREFERENCES & ALERTS */}
            {subTab === 'preferences' && (
                <div className="bento-card" style={{ padding: '2rem' }}>
                    <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Farm Notifications & Regional Language</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                            Configure market price alerts, dispatch SMS, and localized dashboard dialect.
                        </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        
                        <div className="toggle-switch-card">
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                                    <i className="fa-solid fa-chart-line" style={{ marginRight: '0.5rem', color: 'var(--primary)' }}></i>
                                    Daily Mandi Price Alerts
                                </div>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                    Receive automated alerts when mill purchase rates increase for your crops.
                                </div>
                            </div>
                            <input 
                                type="checkbox" 
                                checked={priceAlerts} 
                                onChange={e => { setPriceAlerts(e.target.checked); handleSavePreferences(); }}
                                style={{ width: '20px', height: '20px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                            />
                        </div>

                        <div className="toggle-switch-card">
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                                    <i className="fa-solid fa-truck-fast" style={{ marginRight: '0.5rem', color: 'var(--accent-gold)' }}></i>
                                    Load Dispatch & Arrival SMS
                                </div>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                    Receive real-time SMS updates when a truck driver accepts or arrives at your farm.
                                </div>
                            </div>
                            <input 
                                type="checkbox" 
                                checked={orderSms} 
                                onChange={e => { setOrderSms(e.target.checked); handleSavePreferences(); }}
                                style={{ width: '20px', height: '20px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                            />
                        </div>

                        <div className="toggle-switch-card">
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                                    <i className="fa-solid fa-cloud-sun-rain" style={{ marginRight: '0.5rem', color: 'var(--primary-light)' }}></i>
                                    Extreme Weather Advisories
                                </div>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                    Get warnings before heavy rainfall or unseasonal storms hit your crop coordinates.
                                </div>
                            </div>
                            <input 
                                type="checkbox" 
                                checked={weatherAdvisories} 
                                onChange={e => { setWeatherAdvisories(e.target.checked); handleSavePreferences(); }}
                                style={{ width: '20px', height: '20px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                            />
                        </div>

                        {/* Regional Language Preference Section */}
                        <div style={{ marginTop: '1rem', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '1rem', padding: '1.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <div>
                                    <h4 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <i className="fa-solid fa-language" style={{ color: 'var(--primary)', fontSize: '1.2rem' }}></i>
                                        Regional Language Preference / భాష / भाषा
                                    </h4>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.25rem 0 0 0' }}>
                                        Select your preferred language for dashboard navigation, crop details, and payments.
                                    </p>
                                </div>
                                <span className="status-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--primary)', padding: '0.2rem 0.6rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 700 }}>
                                    Active: {globalLang === 'te' ? 'తెలుగు (Telugu)' : globalLang === 'hi' ? 'हिन्दी (Hindi)' : globalLang === 'kn' ? 'ಕನ್ನಡ (Kannada)' : 'English'}
                                </span>
                            </div>

                            {/* Interactive Language Cards */}
                            <LanguageSelector variant="cards" />
                        </div>

                    </div>
                </div>
            )}

            {/* Sandbox Payout Testing Modal */}
            <SandboxPayoutModal
                isOpen={showSandboxModal}
                onClose={() => setShowSandboxModal(false)}
                farmerPhone={user.phone}
                bankDetails={sandboxTargetDetails || {
                    accountHolder,
                    bankName,
                    accountNumber,
                    ifscCode,
                    upiId
                }}
            />

        </div>
    );
}
