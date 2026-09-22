import React, { useState, useRef, useEffect, useMemo } from 'react';
import MapModal from './MapModal';
import { getCurrentCoordinates, reverseGeocode, searchLocations } from '../services/locationService';
import { compressImageFile } from '../utils/imageUtils';

const CROP_CATEGORIES_DATA = [
    {
        category: '🌾 Cereals / Grains',
        crops: [
            'Paddy (Rice)',
            'Wheat',
            'Maize',
            'Sorghum (Jowar)',
            'Pearl Millet (Bajra)',
            'Finger Millet (Ragi)',
            'Barley',
            'Oats'
        ]
    },
    {
        category: '🫘 Pulses',
        crops: [
            'Red Gram (Tur/Arhar)',
            'Green Gram (Moong)',
            'Black Gram (Urad)',
            'Bengal Gram (Chana)',
            'Lentil (Masoor)',
            'Peas',
            'Horse Gram',
            'Cowpea'
        ]
    },
    {
        category: '🌻 Oilseeds',
        crops: [
            'Groundnut',
            'Sunflower',
            'Soybean',
            'Mustard',
            'Sesame',
            'Safflower',
            'Castor',
            'Linseed',
            'Coconut/Copra'
        ]
    },
    {
        category: '🍬 Sugar & Industrial Crops',
        crops: [
            'Sugarcane',
            'Cotton',
            'Jute',
            'Tobacco'
        ]
    },
    {
        category: '🌶️ Spices & Processing Crops',
        crops: [
            'Red Chilli',
            'Turmeric',
            'Coriander',
            'Cumin',
            'Black Pepper',
            'Ginger',
            'Garlic',
            'Cardamom',
            'Clove'
        ]
    }
];

export default function AddCropModal({ onClose, onSaveCrop }) {
    const [crop, setCrop] = useState('');
    const [customCrop, setCustomCrop] = useState('');
    const [locationInput, setLocationInput] = useState('');
    const [coords, setCoords] = useState(null);
    const [acres, setAcres] = useState('');
    const [cropImage, setCropImage] = useState('');
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [isLocatingGps, setIsLocatingGps] = useState(false);
    const [accuracyText, setAccuracyText] = useState('');
    const [loading, setLoading] = useState(false);

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredCropCategories = useMemo(() => {
        if (!searchQuery.trim()) return CROP_CATEGORIES_DATA;
        const q = searchQuery.toLowerCase().trim();
        return CROP_CATEGORIES_DATA.map(cat => ({
            ...cat,
            crops: cat.crops.filter(c => 
                c.toLowerCase().includes(q) || 
                cat.category.toLowerCase().includes(q)
            )
        })).filter(cat => cat.crops.length > 0);
    }, [searchQuery]);

    const handleConfirmLocation = (placeName, lat, lng) => {
        setLocationInput(placeName);
        setCoords({ lat, lng });
        setAccuracyText('Selected on Map');
        setIsMapOpen(false);
    };

    const handleUseCurrentLocation = async () => {
        setIsLocatingGps(true);
        setAccuracyText('');
        try {
            const gps = await getCurrentCoordinates();
            const res = await reverseGeocode(gps.lat, gps.lng);
            setLocationInput(res.placeName);
            setCoords({ lat: gps.lat, lng: gps.lng });
            setAccuracyText(`±${gps.accuracy}m GPS accuracy`);
        } catch (err) {
            console.error("GPS location error:", err);
            alert("Unable to access high-accuracy GPS. Please ensure location access is allowed in your browser settings, or click 'Pick on Map' to select your location.");
        } finally {
            setIsLocatingGps(false);
        }
    };

    const handleImageUpload = async (file) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            return alert('Please select a valid image file (JPG, PNG, WEBP).');
        }
        try {
            const compressed = await compressImageFile(file, 1000, 1000, 0.78);
            setCropImage(compressed);
        } catch (err) {
            console.error("Image compression error:", err);
            const reader = new FileReader();
            reader.onload = (e) => setCropImage(e.target.result);
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        const finalCrop = crop === 'Other' ? customCrop : crop;
        if (!finalCrop) return alert("Please select or enter a crop.");
        if (!acres || isNaN(acres) || acres <= 0) return alert("Please enter valid acres.");

        setLoading(true);
        let finalCoords = coords;
        let finalLocation = locationInput?.trim() || 'Khammam Farm Plot';

        // If user typed a location but didn't pick on map or GPS, resolve real coordinates
        if (!finalCoords && locationInput && locationInput.trim().length >= 3) {
            try {
                const results = await searchLocations(locationInput.trim());
                if (results && results.length > 0) {
                    finalCoords = { lat: results[0].lat, lng: results[0].lng };
                    finalLocation = results[0].placeName || finalLocation;
                }
            } catch (err) {
                console.warn("Geocoding failed for typed crop location:", err);
            }
        }

        if (!finalCoords) {
            finalCoords = { lat: 17.0916, lng: 80.0210 };
        }

        await onSaveCrop({
            cropName: finalCrop,
            locationName: finalLocation,
            latitude: finalCoords.lat,
            longitude: finalCoords.lng,
            acres: parseFloat(acres),
            cropImage: cropImage || ''
        });
        setLoading(false);
        onClose();
    };

    return (
        <>
            <div className="auth-modal" style={{ display: 'flex' }}>
                <div className="auth-content" style={{ maxWidth: '480px', width: '92%' }}>
                    <span className="close-btn" onClick={onClose}><i className="fa-solid fa-xmark"></i></span>
                    <div className="logo modal-logo" style={{ marginBottom: '1.25rem', justifyContent: 'center' }}>
                        <i className="fa-solid fa-seedling"></i>
                        <span>Add Crop</span>
                    </div>

                    <h2 style={{ marginBottom: '0.35rem', textAlign: 'center', fontSize: '1.35rem' }}>New Crop Entry</h2>
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                        Select your crop and pinpoint your exact farm plot
                    </p>

                    {/* Crop Selection Custom Dropdown */}
                    <div style={{ marginBottom: '1rem', position: 'relative' }} ref={dropdownRef}>
                        <div 
                            className="input-group" 
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            style={{ 
                                cursor: 'pointer', 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center',
                                borderColor: isDropdownOpen ? 'var(--primary)' : 'var(--primary)',
                                background: 'rgba(255, 255, 255, 0.04)',
                                padding: '0.65rem 0.9rem',
                                borderRadius: '0.6rem'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', overflow: 'hidden' }}>
                                <i className="fa-solid fa-wheat-awn" style={{ color: 'var(--primary)', flexShrink: 0 }}></i>
                                <span style={{ color: crop ? '#fff' : 'var(--text-muted)', fontSize: '0.92rem', fontWeight: crop ? 600 : 400, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                    {crop ? (crop === 'Other' ? 'Other (Custom Crop)' : crop) : 'Select a Crop'}
                                </span>
                            </div>
                            <i className="fa-solid fa-chevron-down" style={{ 
                                color: 'var(--text-muted)', 
                                fontSize: '0.8rem',
                                transition: 'transform 0.2s ease',
                                transform: isDropdownOpen ? 'rotate(180deg)' : 'none' 
                            }}></i>
                        </div>

                        {/* Custom Luxury Dark Dropdown Menu */}
                        {isDropdownOpen && (
                            <div 
                                style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 6px)',
                                    left: 0,
                                    right: 0,
                                    zIndex: 1200,
                                    background: '#091c13',
                                    border: '1px solid rgba(16, 185, 129, 0.45)',
                                    borderRadius: '12px',
                                    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.85)',
                                    backdropFilter: 'blur(16px)',
                                    overflow: 'hidden'
                                }}
                            >
                                {/* Search Filter Header */}
                                <div style={{ padding: '0.55rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}></i>
                                    <input 
                                        type="text" 
                                        placeholder="Search crop name..." 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        autoFocus
                                        style={{
                                            width: '100%',
                                            background: 'transparent',
                                            border: 'none',
                                            outline: 'none',
                                            color: '#fff',
                                            fontSize: '0.85rem'
                                        }}
                                    />
                                    {searchQuery && (
                                        <i 
                                            className="fa-solid fa-xmark" 
                                            onClick={(e) => { e.stopPropagation(); setSearchQuery(''); }}
                                            style={{ color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
                                        ></i>
                                    )}
                                </div>

                                {/* Scrollable Grouped Items */}
                                <div style={{ maxHeight: '230px', overflowY: 'auto', padding: '0.35rem 0' }}>
                                    {filteredCropCategories.length === 0 ? (
                                        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                            No crops matching "{searchQuery}"
                                        </div>
                                    ) : (
                                        filteredCropCategories.map(cat => (
                                            <div key={cat.category} style={{ marginBottom: '0.35rem' }}>
                                                <div style={{ 
                                                    padding: '0.35rem 0.85rem', 
                                                    fontSize: '0.72rem', 
                                                    fontWeight: 800, 
                                                    color: 'var(--accent-gold)', 
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.04em',
                                                    background: 'rgba(255, 255, 255, 0.04)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.4rem'
                                                }}>
                                                    {cat.category}
                                                </div>
                                                {cat.crops.map(cName => {
                                                    const isSelected = crop === cName;
                                                    return (
                                                        <div
                                                            key={cName}
                                                            onClick={() => {
                                                                setCrop(cName);
                                                                setIsDropdownOpen(false);
                                                                setSearchQuery('');
                                                            }}
                                                            style={{
                                                                padding: '0.55rem 0.85rem',
                                                                fontSize: '0.85rem',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center',
                                                                color: isSelected ? 'var(--primary)' : '#e2e8f0',
                                                                background: isSelected ? 'rgba(16, 185, 129, 0.18)' : 'transparent',
                                                                fontWeight: isSelected ? 700 : 500,
                                                                transition: 'background 0.15s'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                if (!isSelected) e.currentTarget.style.background = 'transparent';
                                                            }}
                                                        >
                                                            <span>{cName}</span>
                                                            {isSelected && <i className="fa-solid fa-check" style={{ color: 'var(--primary)', fontSize: '0.8rem' }}></i>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ))
                                    )}

                                    {/* Other custom option */}
                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '0.35rem', paddingTop: '0.35rem' }}>
                                        <div
                                            onClick={() => {
                                                setCrop('Other');
                                                setIsDropdownOpen(false);
                                                setSearchQuery('');
                                            }}
                                            style={{
                                                padding: '0.55rem 0.85rem',
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                color: crop === 'Other' ? 'var(--primary)' : '#94a3b8',
                                                background: crop === 'Other' ? 'rgba(16, 185, 129, 0.18)' : 'transparent',
                                                fontWeight: crop === 'Other' ? 700 : 500
                                            }}
                                        >
                                            <span><i className="fa-solid fa-pen-to-square" style={{ marginRight: '0.5rem' }}></i> Other (Type custom name)</span>
                                            {crop === 'Other' && <i className="fa-solid fa-check" style={{ color: 'var(--primary)' }}></i>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {crop === 'Other' && (
                        <div className="input-group" style={{ marginBottom: '1rem' }}>
                            <i className="fa-solid fa-pen"></i>
                            <input type="text" placeholder="Enter custom crop name" value={customCrop} onChange={e => setCustomCrop(e.target.value)} />
                        </div>
                    )}

                    {/* Location Section */}
                    <div style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                            <label style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
                                Crop Plot Location
                            </label>
                        </div>

                        {/* Location Action Buttons: Instant Current GPS vs Interactive Map */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <button
                                type="button"
                                className="primary-btn"
                                onClick={handleUseCurrentLocation}
                                disabled={isLocatingGps}
                                style={{
                                    padding: '0.55rem 0.75rem',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.45rem',
                                    background: coords && accuracyText.includes('GPS') ? 'rgba(16, 185, 129, 0.25)' : undefined,
                                    border: coords && accuracyText.includes('GPS') ? '1px solid var(--primary)' : undefined
                                }}
                            >
                                <i className={`fa-solid ${isLocatingGps ? 'fa-spinner fa-spin' : 'fa-location-crosshairs'}`}></i>
                                <span>{isLocatingGps ? 'Locating GPS...' : 'Use Current Location'}</span>
                            </button>

                            <button
                                type="button"
                                className="action-btn"
                                onClick={() => setIsMapOpen(true)}
                                style={{
                                    padding: '0.55rem 0.75rem',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.45rem',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid var(--border-color)'
                                }}
                            >
                                <i className="fa-solid fa-map-location-dot" style={{ color: 'var(--accent-gold)' }}></i>
                                <span>Pick on Map</span>
                            </button>
                        </div>

                        {/* Location Text Input (Display + Editable for custom wording) */}
                        <div className="input-group" style={{ marginBottom: coords ? '0.35rem' : '0' }}>
                            <i className="fa-solid fa-location-dot" style={{ color: coords ? 'var(--primary)' : 'var(--text-muted)' }}></i>
                            <input 
                                type="text" 
                                placeholder="Click 'Use Current Location' or pick on map" 
                                value={locationInput} 
                                onChange={(e) => setLocationInput(e.target.value)} 
                                style={{ background: 'transparent', width: '100%', fontSize: '0.9rem', color: '#fff' }} 
                            />
                        </div>

                        {/* GPS Accuracy & Coordinates Pill */}
                        {coords && (
                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between', 
                                fontSize: '0.72rem', 
                                color: 'var(--text-muted)',
                                padding: '0.2rem 0.4rem',
                                background: 'rgba(0,0,0,0.25)',
                                borderRadius: '0.4rem',
                                border: '1px solid rgba(255,255,255,0.05)'
                            }}>
                                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                                    <i className="fa-solid fa-circle-check" style={{ marginRight: '0.3rem' }}></i>
                                    {accuracyText || 'Accurate GPS Point'}
                                </span>
                                <span style={{ fontFamily: 'monospace', color: 'var(--accent-gold)' }}>
                                    {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Crop Image Upload Section */}
                    <div style={{ marginBottom: '1.1rem', background: 'rgba(255, 255, 255, 0.03)', border: '1px dashed var(--border-color)', borderRadius: '0.75rem', padding: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <label style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <i className="fa-solid fa-camera" style={{ color: 'var(--primary)' }}></i>
                                Crop / Farmland Photo (Optional)
                            </label>
                            {cropImage && (
                                <button 
                                    type="button" 
                                    onClick={() => setCropImage('')}
                                    style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                >
                                    <i className="fa-solid fa-trash"></i> Remove
                                </button>
                            )}
                        </div>

                        {cropImage ? (
                            <div style={{ position: 'relative', width: '100%', height: '130px', borderRadius: '0.6rem', overflow: 'hidden', border: '1.5px solid var(--primary)', background: '#000' }}>
                                <img 
                                    src={cropImage} 
                                    alt="Crop Preview" 
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} 
                                />
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, transparent 50%, rgba(0,0,0,0.7) 100%)', pointerEvents: 'none' }} />
                                
                                <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', color: 'var(--primary)', fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '0.4rem', border: '1px solid rgba(16,185,129,0.3)' }}>
                                    <i className="fa-solid fa-circle-check"></i> Photo Attached
                                </div>

                                <label style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.25)', color: 'var(--accent-gold)', padding: '0.22rem 0.55rem', borderRadius: '1rem', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <i className="fa-solid fa-camera"></i> Change
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        capture="environment"
                                        style={{ display: 'none' }} 
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) {
                                                handleImageUpload(e.target.files[0]);
                                            }
                                        }}
                                    />
                                </label>
                            </div>
                        ) : (
                            <label 
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.35rem',
                                    padding: '1rem',
                                    background: 'rgba(255, 255, 255, 0.04)',
                                    borderRadius: '0.6rem',
                                    cursor: 'pointer',
                                    border: '1px dashed rgba(255, 255, 255, 0.12)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <i className="fa-solid fa-cloud-arrow-up" style={{ color: 'var(--primary)', fontSize: '1.25rem' }}></i>
                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>Choose or Take Crop Photo</span>
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>PNG, JPG or Camera Capture</span>
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    capture="environment" 
                                    style={{ display: 'none' }} 
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            handleImageUpload(e.target.files[0]);
                                        }
                                    }}
                                />
                            </label>
                        )}
                    </div>

                    {/* Acreage Input */}
                    <div className="input-group" style={{ marginBottom: '1.25rem' }}>
                        <i className="fa-solid fa-layer-group"></i>
                        <input 
                            type="number" 
                            placeholder="Number of Acres (e.g. 5.5)" 
                            min="0.1" 
                            step="any" 
                            value={acres} 
                            onChange={e => setAcres(e.target.value)} 
                        />
                    </div>

                    <button 
                        className="primary-btn" 
                        style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontWeight: 800, fontSize: '0.95rem' }} 
                        onClick={handleSave} 
                        disabled={loading || isLocatingGps}
                    >
                        {loading ? 'Saving Crop Entry...' : 'Save Crop'}
                    </button>
                </div>
            </div>

            {isMapOpen && (
                <MapModal 
                    initialCoords={coords}
                    onClose={() => setIsMapOpen(false)} 
                    onConfirm={handleConfirmLocation} 
                />
            )}
        </>
    );
}
