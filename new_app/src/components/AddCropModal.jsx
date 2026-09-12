import React, { useState } from 'react';
import MapModal from './MapModal';
import { getCurrentCoordinates, reverseGeocode } from '../services/locationService';

export default function AddCropModal({ onClose, onSaveCrop }) {
    const [crop, setCrop] = useState('');
    const [customCrop, setCustomCrop] = useState('');
    const [locationInput, setLocationInput] = useState('');
    const [coords, setCoords] = useState(null);
    const [acres, setAcres] = useState('');
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [isLocatingGps, setIsLocatingGps] = useState(false);
    const [accuracyText, setAccuracyText] = useState('');
    const [loading, setLoading] = useState(false);

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

    const handleSave = async () => {
        const finalCrop = crop === 'Other' ? customCrop : crop;
        if (!finalCrop) return alert("Please select or enter a crop.");
        const finalCoords = coords || { lat: 17.0916, lng: 80.0210 };
        const finalLocation = locationInput || 'Khammam Farm Plot';
        if (!acres || isNaN(acres) || acres <= 0) return alert("Please enter valid acres.");

        setLoading(true);
        await onSaveCrop({
            cropName: finalCrop,
            locationName: finalLocation,
            latitude: finalCoords.lat,
            longitude: finalCoords.lng,
            acres: parseFloat(acres)
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

                    {/* Crop Selection Dropdown */}
                    <div className="input-group" style={{ marginBottom: '1rem', borderColor: 'var(--primary)' }}>
                        <select 
                            style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', padding: '0', fontFamily: 'inherit', fontSize: '0.95rem', color: 'inherit', cursor: 'pointer' }} 
                            value={crop} 
                            onChange={(e) => setCrop(e.target.value)}
                        >
                            <option value="" disabled style={{ color: '#000', background: '#fff' }}>Select a Crop</option>
                            <optgroup label="🌾 Cereals / Grains" style={{ color: '#000', background: '#fff' }}>
                                <option value="Paddy (Rice)" style={{ color: '#000', background: '#fff' }}>Paddy (Rice)</option>
                                <option value="Maize" style={{ color: '#000', background: '#fff' }}>Maize</option>
                                <option value="Wheat" style={{ color: '#000', background: '#fff' }}>Wheat</option>
                            </optgroup>
                            <optgroup label="🌱 Pulses" style={{ color: '#000', background: '#fff' }}>
                                <option value="Red Gram" style={{ color: '#000', background: '#fff' }}>Red Gram</option>
                                <option value="Green Gram" style={{ color: '#000', background: '#fff' }}>Green Gram</option>
                            </optgroup>
                            <optgroup label="🌻 Oilseeds" style={{ color: '#000', background: '#fff' }}>
                                <option value="Groundnut" style={{ color: '#000', background: '#fff' }}>Groundnut</option>
                                <option value="Sunflower" style={{ color: '#000', background: '#fff' }}>Sunflower</option>
                            </optgroup>
                            <optgroup label="🧵 Commercial" style={{ color: '#000', background: '#fff' }}>
                                <option value="Cotton" style={{ color: '#000', background: '#fff' }}>Cotton</option>
                            </optgroup>
                            <option value="Other" style={{ color: '#000', background: '#fff' }}>Other (Type custom name)</option>
                        </select>
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
