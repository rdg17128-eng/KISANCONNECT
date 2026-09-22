import React, { useState, useRef, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabase';
import MapModal from './MapModal';
import { searchLocations } from '../services/locationService';

const MILL_TYPE_CATEGORIES = [
    {
        category: '🌾 Cereals & Grains Mills',
        options: [
            { value: 'Rice Mill', label: 'Rice Mill (Paddy)' },
            { value: 'Flour / Wheat Mill', label: 'Flour / Wheat Mill' },
            { value: 'Maize / Corn Processing Mill', label: 'Maize / Corn Processing Mill' },
            { value: 'Millet & Sorghum Mill (Jowar, Bajra, Ragi)', label: 'Millet & Sorghum Mill (Jowar, Bajra, Ragi)' },
            { value: 'Barley & Oats Mill', label: 'Barley & Oats Mill' },
            { value: 'Grain & Cereal Processing Plant', label: 'Grain & Cereal Processing Plant' }
        ]
    },
    {
        category: '🫘 Pulses & Dal Mills',
        options: [
            { value: 'Dal / Pulse Mill', label: 'Dal / Pulse Mill (Tur/Arhar, Moong, Urad)' },
            { value: 'Bengal Gram & Besan Mill', label: 'Bengal Gram & Besan Mill (Chana)' },
            { value: 'Lentil & Masoor Processing Mill', label: 'Lentil & Masoor Processing Mill' },
            { value: 'Legumes & Peas Processing Plant', label: 'Legumes & Peas Processing Plant' }
        ]
    },
    {
        category: '🌻 Oil Extraction Mills',
        options: [
            { value: 'Oil Mill & Expeller', label: 'Oil Mill & Expeller (Groundnut, Sunflower, Mustard, Sesame)' },
            { value: 'Soybean Solvent Extraction Plant', label: 'Soybean Solvent Extraction Plant' },
            { value: 'Castor & Safflower Oil Mill', label: 'Castor & Safflower Oil Mill' },
            { value: 'Copra & Coconut Processing Mill', label: 'Copra & Coconut Processing Mill' }
        ]
    },
    {
        category: '🍬 Sugar, Cotton & Industrial Processing',
        options: [
            { value: 'Sugar Factory / Sugarcane Crushing Mill', label: 'Sugar Factory / Sugarcane Crushing Mill' },
            { value: 'Cotton Ginning & Pressing Mill', label: 'Cotton Ginning & Pressing Mill' },
            { value: 'Jute Processing Mill', label: 'Jute Processing Mill' },
            { value: 'Tobacco Processing Plant', label: 'Tobacco Processing Plant' }
        ]
    },
    {
        category: '🌶️ Spices & Agro Processing',
        options: [
            { value: 'Chilli & Spice Processing Mill', label: 'Chilli & Spice Processing Mill (Turmeric, Coriander, Cumin)' },
            { value: 'Ginger & Garlic Processing Unit', label: 'Ginger & Garlic Processing Unit' },
            { value: 'Plantation Spices Processing (Pepper, Cardamom, Clove)', label: 'Plantation Spices Processing (Pepper, Cardamom, Clove)' },
            { value: 'Multi-Crop Agro Processing Mill', label: 'Multi-Crop Agro Processing Mill' }
        ]
    }
];

export default function AddMillModal({ user, onClose, onMillAdded }) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Form Details
    const [millName, setMillName] = useState('');
    const [millType, setMillType] = useState('Rice Mill');
    const [capacity, setCapacity] = useState('');
    const [requirements, setRequirements] = useState('');
    const [selectedCrops, setSelectedCrops] = useState([]);
    const [location, setLocation] = useState({ name: '', lat: null, lng: null });
    const [hasColdStorage, setHasColdStorage] = useState(false);

    const [isMapOpen, setIsMapOpen] = useState(false);
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

    const filteredCategories = useMemo(() => {
        if (!searchQuery.trim()) return MILL_TYPE_CATEGORIES;
        const q = searchQuery.toLowerCase().trim();
        return MILL_TYPE_CATEGORIES.map(cat => ({
            ...cat,
            options: cat.options.filter(opt => 
                opt.label.toLowerCase().includes(q) || 
                opt.value.toLowerCase().includes(q) ||
                cat.category.toLowerCase().includes(q)
            )
        })).filter(cat => cat.options.length > 0);
    }, [searchQuery]);

    const cropCategories = [
        {
            name: 'Cereals / Grains',
            icon: 'fa-wheat-awn',
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
            name: 'Pulses',
            icon: 'fa-seedling',
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
            name: 'Oilseeds',
            icon: 'fa-sun',
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
            name: 'Sugar & Industrial Crops',
            icon: 'fa-cubes-stacked',
            crops: [
                'Sugarcane',
                'Cotton',
                'Jute',
                'Tobacco'
            ]
        },
        {
            name: 'Spices & Processing Crops',
            icon: 'fa-pepper-hot',
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

    const handleToggleCrop = (crop) => {
        if (selectedCrops.includes(crop)) {
            setSelectedCrops(selectedCrops.filter(c => c !== crop));
        } else {
            setSelectedCrops([...selectedCrops, crop]);
        }
    };

    const handleLocationConfirm = (name, lat, lng) => {
        setLocation({ name, lat, lng });
        setIsMapOpen(false);
    };

    const handleSubmit = async () => {
        if (!millName || selectedCrops.length === 0) {
            alert('Please enter a mill name and select at least one crop.');
            return;
        }

        setLoading(true);

        let finalLat = location.lat;
        let finalLng = location.lng;
        let finalLocName = location.name?.trim() || 'Khammam Agro Processing Gate';

        // If user entered or selected a location text without picking on map, geocode it
        if ((!finalLat || !finalLng) && location.name && location.name.trim().length >= 3) {
            try {
                const results = await searchLocations(location.name.trim());
                if (results && results.length > 0) {
                    finalLat = results[0].lat;
                    finalLng = results[0].lng;
                    finalLocName = results[0].placeName || finalLocName;
                }
            } catch (e) {
                console.warn("Geocoding failed for mill location:", e);
            }
        }

        finalLat = finalLat || 17.1033;
        finalLng = finalLng || 80.0536;

        setLoading(true);
        try {
            const initialPrices = {};
            selectedCrops.forEach(c => {
                initialPrices[c] = c.includes('Rice') || c.includes('Paddy') ? 2650 : 2400;
            });

            const millData = {
                owner_phone: user.phone,
                mill_name: millName,
                mill_type: millType,
                capacity: capacity ? parseFloat(capacity) : 50,
                requirements: requirements || 'Clean grain intake, moisture under 14%',
                selectedCrops: selectedCrops,
                location_name: finalLocName,
                latitude: finalLat,
                longitude: finalLng,
                has_cold_storage: hasColdStorage,
                prices: initialPrices,
                status: 'verified',
                created_at: new Date().toISOString()
            };

            try {
                const { error } = await supabase
                    .from('mills')
                    .insert(millData);
                if (error) console.warn("Supabase mill insert notice:", error);
            } catch (err) {
                console.warn("Supabase mill insert:", err);
            }

            // Sync to local mills storage
            const localMills = JSON.parse(localStorage.getItem('kisan_mills') || '[]');
            localMills.unshift({ id: 'mill-' + Date.now(), ...millData });
            localStorage.setItem('kisan_mills', JSON.stringify(localMills));

            alert('Mill registered successfully and verified for trading!');
            onMillAdded();
            onClose();
        } catch (error) {
            console.error("Error adding mill:", error);
            alert('Failed to register mill.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-modal" style={{ display: 'flex', zIndex: 1100 }}>
            <div className="auth-content" style={{ maxWidth: '500px' }}>
                <span className="close-btn" onClick={onClose}><i className="fa-solid fa-xmark"></i></span>

                <h2 style={{ marginBottom: '0.5rem', color: 'var(--text-main)' }}>Register Your Mill 🏭</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Step {step} of 2 - {step === 1 ? 'Mill Details' : 'Buying Requirements'}</p>

                {step === 1 ? (
                    <div className="step-content">
                        <div className="input-field" style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Mill Name *</label>
                            <div className="input-group">
                                <i className="fa-solid fa-industry"></i>
                                <input type="text" placeholder="e.g. Sri Krishna Rice Mill" value={millName} onChange={e => setMillName(e.target.value)} />
                            </div>
                        </div>

                        <div className="input-field" style={{ marginBottom: '1rem', position: 'relative' }} ref={dropdownRef}>
                            <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Mill Type *</label>
                            
                            {/* Custom Trigger */}
                            <div 
                                className="input-group" 
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                style={{ 
                                    cursor: 'pointer', 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    borderColor: isDropdownOpen ? 'var(--primary)' : undefined,
                                    background: 'var(--bg-dark)',
                                    padding: '0.65rem 0.9rem'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', overflow: 'hidden' }}>
                                    <i className="fa-solid fa-gears" style={{ color: 'var(--primary)', flexShrink: 0 }}></i>
                                    <span style={{ color: '#fff', fontSize: '0.92rem', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                        {millType}
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
                                            placeholder="Search mill type..." 
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
                                        {filteredCategories.length === 0 ? (
                                            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                                No mill types matching "{searchQuery}"
                                            </div>
                                        ) : (
                                            filteredCategories.map(cat => (
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
                                                    {cat.options.map(opt => {
                                                        const isSelected = millType === opt.value;
                                                        return (
                                                            <div
                                                                key={opt.value}
                                                                onClick={() => {
                                                                    setMillType(opt.value);
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
                                                                <span>{opt.label}</span>
                                                                {isSelected && <i className="fa-solid fa-check" style={{ color: 'var(--primary)', fontSize: '0.8rem' }}></i>}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="input-field" style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Location *</label>
                            <button onClick={() => setIsMapOpen(true)} className="input-group" style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: 'var(--bg-dark)' }}>
                                <i className="fa-solid fa-location-dot" style={{ color: location.lat ? 'var(--primary)' : 'var(--text-muted)' }}></i>
                                <span style={{ color: location.lat ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                    {location.name || 'Select Location on Map'}
                                </span>
                            </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--bg-dark)', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Cold Storage Facility</span>
                            <div
                                onClick={() => setHasColdStorage(!hasColdStorage)}
                                style={{ width: '40px', height: '20px', background: hasColdStorage ? 'var(--primary)' : '#333', borderRadius: '10px', position: 'relative', cursor: 'pointer', transition: '0.3s' }}
                            >
                                <div style={{ width: '14px', height: '14px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '3px', left: hasColdStorage ? '23px' : '3px', transition: '0.3s' }}></div>
                            </div>
                        </div>

                        <button className="primary-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setStep(2)}>Next Step</button>
                    </div>
                ) : (
                    <div className="step-content">
                        <div className="input-field" style={{ marginBottom: '1.25rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.8rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Link your mill to specific crops: *</label>

                            <div style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                                {cropCategories.map(category => (
                                    <div key={category.name} style={{ marginBottom: '1.25rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            <i className={`fa-solid ${category.icon}`}></i>
                                            {category.name}
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            {category.crops.map(crop => (
                                                <button
                                                    key={crop}
                                                    onClick={() => handleToggleCrop(crop)}
                                                    style={{
                                                        padding: '0.4rem 0.8rem',
                                                        borderRadius: '2rem',
                                                        fontSize: '0.8rem',
                                                        border: '1px solid var(--border-color)',
                                                        background: selectedCrops.includes(crop) ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                                                        color: selectedCrops.includes(crop) ? '#000' : 'var(--text-muted)',
                                                        transition: '0.3s',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    {crop}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontStyle: 'italic' }}>
                                    Your mill listings will be visible to farmers growing these specific crops.
                                </div>
                            </div>
                        </div>

                        <div className="input-field" style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Daily Capacity (Tons)</label>
                            <div className="input-group">
                                <i className="fa-solid fa-scale-balanced"></i>
                                <input type="number" placeholder="e.g. 50" value={capacity} onChange={e => setCapacity(e.target.value)} />
                            </div>
                        </div>

                        <div className="input-field" style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Mill Requirements / QC Policy</label>
                            <textarea
                                placeholder="e.g. Moisture content < 12%, No dust..."
                                style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1rem', color: 'var(--text-main)', outline: 'none', minHeight: '80px', fontFamily: 'inherit' }}
                                value={requirements}
                                onChange={e => setRequirements(e.target.value)}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="primary-btn" style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }} onClick={() => setStep(1)}>Back</button>
                            <button className="primary-btn" style={{ flex: 2, justifyContent: 'center' }} onClick={handleSubmit} disabled={loading}>
                                {loading ? 'Registering...' : 'Complete Registration'}
                            </button>
                        </div>
                    </div>
                )}

                {isMapOpen && (
                    <MapModal
                        onClose={() => setIsMapOpen(false)}
                        onConfirm={handleLocationConfirm}
                    />
                )}
            </div>
        </div>
    );
}
