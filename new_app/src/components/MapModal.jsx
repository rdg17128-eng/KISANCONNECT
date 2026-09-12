import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getCurrentCoordinates, reverseGeocode, searchLocations } from '../services/locationService';

// Fix Leaflet marker icons in React Vite
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
    iconRetinaUrl,
    iconUrl,
    shadowUrl,
});

// Map Click Listener
function MapClickHandler({ onLocationSelect }) {
    useMapEvents({
        click(e) {
            onLocationSelect(e.latlng.lat, e.latlng.lng);
        }
    });
    return null;
}

// Controller to programmatic move map
function MapFlyController({ targetPosition }) {
    const map = useMap();
    useEffect(() => {
        if (targetPosition) {
            map.flyTo([targetPosition.lat, targetPosition.lng], 15, { duration: 1.2 });
        }
    }, [targetPosition, map]);
    return null;
}

export default function MapModal({ onClose, onConfirm, initialCoords = null }) {
    const defaultCenter = initialCoords ? [initialCoords.lat, initialCoords.lng] : [17.3850, 78.4867];
    const [position, setPosition] = useState(initialCoords || null);
    const [placeName, setPlaceName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [isResolvingAddress, setIsResolvingAddress] = useState(false);
    const [accuracyMeters, setAccuracyMeters] = useState(null);
    const [flyTarget, setFlyTarget] = useState(initialCoords || null);

    // Initial load: resolve address if initialCoords provided, or attempt auto-GPS
    useEffect(() => {
        if (initialCoords) {
            resolveLocation(initialCoords.lat, initialCoords.lng);
        } else {
            // Auto detect GPS on open for immediate relevance
            handleGetLiveLocation(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const resolveLocation = async (lat, lng) => {
        setIsResolvingAddress(true);
        try {
            const res = await reverseGeocode(lat, lng);
            setPlaceName(res.placeName);
        } catch (e) {
            setPlaceName(`Farm Plot (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        } finally {
            setIsResolvingAddress(false);
        }
    };

    const handleLocationSelect = async (lat, lng, label = null) => {
        const newPos = { lat, lng };
        setPosition(newPos);
        setFlyTarget(newPos);
        if (label) {
            setPlaceName(label);
        } else {
            await resolveLocation(lat, lng);
        }
    };

    const handleGetLiveLocation = async (manual = true) => {
        setIsLocating(true);
        try {
            const coords = await getCurrentCoordinates();
            setPosition({ lat: coords.lat, lng: coords.lng });
            setFlyTarget({ lat: coords.lat, lng: coords.lng });
            setAccuracyMeters(coords.accuracy);
            await resolveLocation(coords.lat, coords.lng);
        } catch (err) {
            if (manual) {
                alert("Could not access high-accuracy GPS. Please ensure location permissions are enabled or click directly on the map.");
            }
        } finally {
            setIsLocating(false);
        }
    };

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            const results = await searchLocations(searchQuery);
            setSearchResults(results);
            if (results.length > 0) {
                const first = results[0];
                handleLocationSelect(first.lat, first.lng, first.placeName);
            } else {
                alert(`No locations found for "${searchQuery}". Please try another search or click on the map.`);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsSearching(false);
        }
    };

    const handleConfirm = () => {
        if (!position) return;
        const finalName = placeName || `Farm Plot (${position.lat.toFixed(4)}, ${position.lng.toFixed(4)})`;
        onConfirm(finalName, position.lat, position.lng);
    };

    return (
        <div className="auth-modal" style={{ display: 'flex', zIndex: 9999 }}>
            <div className="auth-content" style={{ maxWidth: '680px', width: '94%', padding: '1.5rem', background: '#0d1712', border: '1px solid rgba(16, 185, 129, 0.35)', borderRadius: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
                    <div>
                        <h3 style={{ margin: 0, color: '#f0fdf4', fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <i className="fa-solid fa-map-location-dot" style={{ color: 'var(--primary)' }}></i>
                            Select Exact Plot Location
                        </h3>
                        <p style={{ color: 'var(--text-muted)', margin: '0.2rem 0 0 0', fontSize: '0.8rem' }}>
                            Click on the map, use live GPS, or search for your village/mandal
                        </p>
                    </div>
                    <span className="close-btn" onClick={onClose} style={{ position: 'static', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <i className="fa-solid fa-xmark"></i>
                    </span>
                </div>

                {/* Action Row: Live GPS button & Search Bar */}
                <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                    <button 
                        type="button"
                        className="primary-btn" 
                        onClick={() => handleGetLiveLocation(true)}
                        disabled={isLocating}
                        style={{ 
                            padding: '0.55rem 0.95rem', 
                            fontSize: '0.82rem', 
                            fontWeight: 700, 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.45rem',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <i className={`fa-solid ${isLocating ? 'fa-spinner fa-spin' : 'fa-crosshairs'}`}></i>
                        {isLocating ? 'Locating GPS...' : 'My Live Location'}
                    </button>

                    <form onSubmit={handleSearch} style={{ flex: 1, display: 'flex', gap: '0.4rem', minWidth: '220px' }}>
                        <div className="input-group" style={{ flex: 1, padding: '0.4rem 0.75rem', background: 'rgba(0,0,0,0.35)' }}>
                            <i className="fa-solid fa-magnifying-glass" style={{ fontSize: '0.85rem' }}></i>
                            <input 
                                type="text" 
                                placeholder="Search village, mandal, or town..." 
                                value={searchQuery} 
                                onChange={(e) => setSearchQuery(e.target.value)} 
                                style={{ background: 'transparent', width: '100%', fontSize: '0.85rem', color: '#fff' }} 
                            />
                        </div>
                        <button 
                            type="submit" 
                            className="action-btn" 
                            disabled={isSearching || !searchQuery.trim()}
                            style={{ padding: '0.55rem 0.9rem', fontSize: '0.82rem' }}
                        >
                            {isSearching ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Search'}
                        </button>
                    </form>
                </div>

                {/* Map Display */}
                <div style={{ width: '100%', height: '340px', borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid rgba(16, 185, 129, 0.25)', position: 'relative' }}>
                    <MapContainer center={defaultCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                        <TileLayer 
                            attribution='&copy; OpenStreetMap contributors' 
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                        />
                        <MapClickHandler onLocationSelect={handleLocationSelect} />
                        {flyTarget && <MapFlyController targetPosition={flyTarget} />}
                        {position && (
                            <Marker position={[position.lat, position.lng]}>
                                <Popup>
                                    <div style={{ fontSize: '0.82rem', color: '#000' }}>
                                        <strong>{placeName || 'Selected Location'}</strong>
                                        <div style={{ fontSize: '0.72rem', color: '#666', marginTop: '0.2rem' }}>
                                            {position.lat.toFixed(4)}, {position.lng.toFixed(4)}
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        )}
                    </MapContainer>

                    {/* Live Pin Instruction Overlay */}
                    <div style={{
                        position: 'absolute',
                        top: '10px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(0,0,0,0.75)',
                        color: '#fff',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        backdropFilter: 'blur(4px)',
                        pointerEvents: 'none',
                        zIndex: 1000,
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <i className="fa-solid fa-hand-pointer" style={{ marginRight: '5px', color: 'var(--primary)' }}></i>
                        Click anywhere on the map to pinpoint your exact plot
                    </div>
                </div>

                {/* Selected Location Confirmation Bar */}
                <div style={{ 
                    background: position ? 'rgba(16, 185, 129, 0.08)' : 'rgba(0,0,0,0.3)', 
                    border: position ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255,255,255,0.06)', 
                    borderRadius: '0.75rem', 
                    padding: '0.75rem 1rem', 
                    marginTop: '0.75rem', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    flexWrap: 'wrap', 
                    gap: '0.5rem' 
                }}>
                    <div style={{ flex: 1, minWidth: '220px' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                            Selected Plot Location:
                        </div>
                        <div style={{ fontWeight: 800, color: position ? 'var(--primary)' : 'var(--text-muted)', fontSize: '0.92rem', marginTop: '0.15rem' }}>
                            {isResolvingAddress ? (
                                <span><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '0.3rem' }}></i> Resolving village & mandal...</span>
                            ) : placeName || (position ? `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}` : 'No location selected yet')}
                        </div>
                        {position && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--accent-gold)', marginTop: '0.15rem', fontFamily: 'monospace' }}>
                                GPS: {position.lat.toFixed(5)}, {position.lng.toFixed(5)} {accuracyMeters ? `(±${accuracyMeters}m accuracy)` : ''}
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                        <button type="button" className="text-btn" onClick={onClose} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                            Cancel
                        </button>
                        <button 
                            type="button" 
                            className="primary-btn" 
                            onClick={handleConfirm} 
                            disabled={!position || isResolvingAddress}
                            style={{ padding: '0.55rem 1.25rem', fontSize: '0.85rem', fontWeight: 800 }}
                        >
                            <i className="fa-solid fa-check" style={{ marginRight: '0.3rem' }}></i>
                            Confirm Location
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
