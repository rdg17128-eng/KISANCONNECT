import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getCurrentCoordinates, getRoadDrivingRoute, formatDistance } from '../services/locationService';
import QrCodeModal from './QrCodeModal';

// Fix default Leaflet icon paths
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
    iconRetinaUrl,
    iconUrl,
    shadowUrl,
});

// Custom Driver Truck DivIcon
const createTruckIcon = (vehicleNumber = 'TS TRUCK') => {
    return L.divIcon({
        className: 'custom-truck-marker',
        html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; transform: translate(-50%, -50%);">
                <div style="
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    color: #fff;
                    width: 38px;
                    height: 38px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 18px;
                    box-shadow: 0 0 0 5px rgba(16, 185, 129, 0.3), 0 4px 12px rgba(0,0,0,0.5);
                    border: 2px solid #ffffff;
                ">
                    🚚
                </div>
                <div style="
                    background: #0f172a;
                    color: #34d399;
                    font-size: 9px;
                    font-weight: 800;
                    padding: 2px 5px;
                    border-radius: 4px;
                    border: 1px solid rgba(52, 211, 153, 0.4);
                    white-space: nowrap;
                    margin-top: 3px;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.6);
                ">
                    ${vehicleNumber} (You)
                </div>
            </div>
        `,
        iconSize: [38, 52],
        iconAnchor: [19, 26],
        popupAnchor: [0, -28]
    });
};

// Custom Farm / Field DivIcon
const createFieldIcon = (farmerName = 'Farm Plot') => {
    return L.divIcon({
        className: 'custom-farm-marker',
        html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; transform: translate(-50%, -50%);">
                <div style="
                    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                    color: #fff;
                    width: 38px;
                    height: 38px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 18px;
                    box-shadow: 0 0 0 5px rgba(245, 158, 11, 0.3), 0 4px 12px rgba(0,0,0,0.5);
                    border: 2px solid #ffffff;
                ">
                    🌾
                </div>
                <div style="
                    background: #0f172a;
                    color: #fbbf24;
                    font-size: 9px;
                    font-weight: 800;
                    padding: 2px 5px;
                    border-radius: 4px;
                    border: 1px solid rgba(251, 191, 36, 0.4);
                    white-space: nowrap;
                    margin-top: 3px;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.6);
                ">
                    ${farmerName} (Field)
                </div>
            </div>
        `,
        iconSize: [38, 52],
        iconAnchor: [19, 26],
        popupAnchor: [0, -28]
    });
};

// Custom Mill DivIcon
const createMillIcon = (millName = 'Target Mill') => {
    return L.divIcon({
        className: 'custom-mill-marker',
        html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; transform: translate(-50%, -50%);">
                <div style="
                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                    color: #fff;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 16px;
                    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3), 0 4px 12px rgba(0,0,0,0.5);
                    border: 2px solid #ffffff;
                ">
                    🏭
                </div>
                <div style="
                    background: #0f172a;
                    color: #60a5fa;
                    font-size: 9px;
                    font-weight: 800;
                    padding: 2px 5px;
                    border-radius: 4px;
                    border: 1px solid rgba(96, 165, 250, 0.4);
                    white-space: nowrap;
                    margin-top: 3px;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.6);
                ">
                    ${millName}
                </div>
            </div>
        `,
        iconSize: [36, 50],
        iconAnchor: [18, 25],
        popupAnchor: [0, -26]
    });
};

// Map controller to fit bounds, fly to coordinates, and invalidate size on mobile
function MapAutoBounds({ bounds, focusCoords, zoomLevel }) {
    const map = useMap();

    useEffect(() => {
        // Trigger tile recalculation for all screen sizes
        const timer = setTimeout(() => {
            map.invalidateSize();
        }, 150);

        if (focusCoords) {
            map.flyTo([focusCoords.lat, focusCoords.lng], zoomLevel || 14, { duration: 1.0 });
        } else if (bounds && bounds.length >= 2) {
            try {
                const leafletBounds = L.latLngBounds(bounds.map(b => [b.lat, b.lng]));
                map.fitBounds(leafletBounds, { padding: [30, 30], maxZoom: 15 });
            } catch (err) {
                console.warn("Could not fit bounds:", err);
            }
        }
        return () => clearTimeout(timer);
    }, [bounds, focusCoords, zoomLevel, map]);

    return null;
}

// Hub coordinate presets for fallback if GPS is denied or offline
const HUB_COORDINATES = {
    'Warangal Agri Hub': { lat: 17.9689, lng: 79.5941 },
    'Karimnagar Bypass': { lat: 18.4386, lng: 79.1288 },
    'Khammam Mandi': { lat: 17.2473, lng: 80.1514 },
    'Nizamabad Yard': { lat: 18.6725, lng: 78.0941 },
    'Hyderabad Hub': { lat: 17.3850, lng: 78.4867 }
};

export default function ActiveDeliveryNavigationMap({
    trip,
    providerInfo,
    onUpdateStatus
}) {
    // Determine default driver starting coordinates
    const defaultDriverCoords = HUB_COORDINATES[providerInfo?.location] || {
        lat: Number(trip.pickup_lat ? trip.pickup_lat - 0.08 : 17.9689),
        lng: Number(trip.pickup_lng ? trip.pickup_lng - 0.08 : 79.5941)
    };

    const [driverLocation, setDriverLocation] = useState({
        lat: defaultDriverCoords.lat,
        lng: defaultDriverCoords.lng,
        accuracy: 10,
        isLive: false,
        lastUpdated: null
    });

    const [isLocating, setIsLocating] = useState(false);
    const [gpsError, setGpsError] = useState('');
    const [mapTileLayer, setMapTileLayer] = useState('streets'); // 'streets' or 'satellite'
    const [routeData, setRouteData] = useState({
        distanceKm: Number(trip.distance) || 35.0,
        durationMinutes: 45,
        coordinates: [],
        steps: [],
        isRoadNetwork: false,
        loading: true
    });
    const [showTurnByTurn, setShowTurnByTurn] = useState(false);
    const [showGateQrPass, setShowGateQrPass] = useState(false);
    const [activeNavigationLeg, setActiveNavigationLeg] = useState(() => {
        const isPre = trip.status === 'ASSIGNED' || trip.status === 'PICKUP_STARTED';
        return isPre ? 'TO_FIELD' : 'TO_MILL';
    });
    const [focusTarget, setFocusTarget] = useState(null);

    // Target coordinates based on navigation leg
    const fieldLat = Number(trip.pickup_lat) || 17.0916;
    const fieldLng = Number(trip.pickup_lng) || 80.0210;
    const millLat = Number(trip.delivery_lat) || 17.1033;
    const millLng = Number(trip.delivery_lng) || 80.0536;

    const targetCoords = activeNavigationLeg === 'TO_FIELD'
        ? { lat: fieldLat, lng: fieldLng, label: `Farm: ${trip.pickup_address || trip.farmer_name}` }
        : { lat: millLat, lng: millLng, label: `Mill: ${trip.mill_name || trip.delivery_address}` };

    // Real-time GPS tracking using navigator.geolocation
    const watchIdRef = useRef(null);

    const refreshLiveGPS = async () => {
        setIsLocating(true);
        setGpsError('');
        try {
            const pos = await getCurrentCoordinates();
            setDriverLocation({
                lat: pos.lat,
                lng: pos.lng,
                accuracy: pos.accuracy,
                isLive: true,
                lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            });
        } catch (err) {
            console.warn("Could not retrieve live GPS:", err.message);
            setGpsError('Using Logistics Base GPS');
        } finally {
            setIsLocating(false);
        }
    };

    useEffect(() => {
        refreshLiveGPS();

        if (navigator.geolocation) {
            watchIdRef.current = navigator.geolocation.watchPosition(
                (pos) => {
                    setDriverLocation({
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        accuracy: Math.round(pos.coords.accuracy || 10),
                        isLive: true,
                        lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    });
                },
                (err) => {
                    console.log("GPS watch warning:", err.message);
                },
                { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
            );
        }

        return () => {
            if (watchIdRef.current !== null && navigator.geolocation) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, []);

    // Fetch road route whenever driver location or active leg changes
    useEffect(() => {
        let isCancelled = false;
        async function fetchRoute() {
            setRouteData(prev => ({ ...prev, loading: true }));
            const destLat = targetCoords.lat;
            const destLng = targetCoords.lng;

            const res = await getRoadDrivingRoute(driverLocation.lat, driverLocation.lng, destLat, destLng);
            if (!isCancelled) {
                setRouteData({
                    distanceKm: res.distanceKm,
                    durationMinutes: res.durationMinutes,
                    coordinates: res.coordinates,
                    steps: res.steps || [],
                    isRoadNetwork: res.isRoadNetwork,
                    loading: false
                });
            }
        }
        fetchRoute();

        return () => {
            isCancelled = true;
        };
    }, [driverLocation.lat, driverLocation.lng, activeNavigationLeg, fieldLat, fieldLng, millLat, millLng]);

    // Google Maps 1-Click Navigation URL
    const googleMapsNavUrl = `https://www.google.com/maps/dir/?api=1&origin=${driverLocation.lat},${driverLocation.lng}&destination=${targetCoords.lat},${targetCoords.lng}&travelmode=driving`;

    // Direct WhatsApp message URL with ETA
    const cleanFarmerPhone = (trip.farmer_phone || '').replace(/\D/g, '');
    const etaText = routeData.durationMinutes ? `~${routeData.durationMinutes} mins (${routeData.distanceKm} km away)` : 'shortly';
    const whatsappMsg = encodeURIComponent(
        `🌾 KisanConnect Live Transport Update 🚚\n\nHello ${trip.farmer_name || 'Farmer'}, I am en route to your field for ${trip.crop_name} (${trip.quantity} Tons).\n\n• Vehicle: ${providerInfo.vehicle_number} (${providerInfo.vehicle_name || 'Truck'})\n• Driver: ${providerInfo.driver_name || providerInfo.name}\n• Current ETA: ${etaText}\n• Live Status: ${trip.status.replace(/_/g, ' ')}\n\nSee you soon at the farm!`
    );
    const whatsappUrl = `https://wa.me/${cleanFarmerPhone}?text=${whatsappMsg}`;

    // Map bounding array
    const mapBounds = [
        { lat: driverLocation.lat, lng: driverLocation.lng },
        { lat: targetCoords.lat, lng: targetCoords.lng }
    ];

    return (
        <div style={{
            background: '#FFFFFF',
            border: '1px solid #CBD5E1',
            borderRadius: '0.85rem',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(11, 27, 45, 0.06)',
            width: '100%',
            boxSizing: 'border-box'
        }}>
            {/* Navigation Mode Options: 2 Prominent Interactive Cards */}
            <div style={{
                padding: '0.85rem clamp(0.75rem, 2vw, 1.25rem)',
                background: '#F8FAFD',
                borderBottom: '1px solid #D1DFEC'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    marginBottom: '0.75rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: driverLocation.isLive ? '#059669' : '#D97706',
                            boxShadow: driverLocation.isLive ? '0 0 8px rgba(5, 150, 105, 0.5)' : 'none'
                        }}></div>
                        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0B1B2D' }}>
                            Select Navigation Route Option:
                        </span>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>
                        {driverLocation.isLive ? `🟢 GPS Live (±${driverLocation.accuracy}m)` : `🟡 ${gpsError || 'Logistics Hub GPS'}`}
                    </div>
                </div>

                {/* 2 Big Action Selection Options */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: '0.75rem'
                }}>
                    {/* OPTION 1: My Location -> Field */}
                    <div
                        onClick={() => {
                            setActiveNavigationLeg('TO_FIELD');
                            setFocusTarget(null);
                        }}
                        style={{
                            background: activeNavigationLeg === 'TO_FIELD'
                                ? '#FFFBEB'
                                : '#FFFFFF',
                            border: activeNavigationLeg === 'TO_FIELD'
                                ? '2px solid #D97706'
                                : '1px solid #CBD5E1',
                            borderRadius: '0.75rem',
                            padding: '0.75rem 1rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            position: 'relative',
                            boxShadow: activeNavigationLeg === 'TO_FIELD'
                                ? '0 2px 10px rgba(217, 119, 6, 0.15)'
                                : 'none'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '1.3rem' }}>🚜</span>
                                <div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: activeNavigationLeg === 'TO_FIELD' ? '#B45309' : '#0B1B2D' }}>
                                        My Location ➔ Farmer's Field
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '2px' }}>
                                        Pickup: <strong style={{ color: '#0B1B2D' }}>{trip.farmer_name}</strong> ({trip.crop_name}, {trip.quantity}T)
                                    </div>
                                </div>
                            </div>
                            <span style={{
                                fontSize: '0.7rem',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '1rem',
                                fontWeight: 800,
                                background: activeNavigationLeg === 'TO_FIELD' ? '#D97706' : '#F1F6FA',
                                color: activeNavigationLeg === 'TO_FIELD' ? '#FFFFFF' : '#475569',
                                flexShrink: 0
                            }}>
                                {activeNavigationLeg === 'TO_FIELD' ? '✓ ACTIVE' : 'SELECT'}
                            </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.4rem', borderTop: '1px solid #E2EDF5', paddingTop: '0.35rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            📍 {trip.pickup_address}
                        </div>
                    </div>

                    {/* OPTION 2: My Location -> Mill */}
                    <div
                        onClick={() => {
                            setActiveNavigationLeg('TO_MILL');
                            setFocusTarget(null);
                        }}
                        style={{
                            background: activeNavigationLeg === 'TO_MILL'
                                ? '#F0F9FF'
                                : '#FFFFFF',
                            border: activeNavigationLeg === 'TO_MILL'
                                ? '2px solid #0284C7'
                                : '1px solid #CBD5E1',
                            borderRadius: '0.75rem',
                            padding: '0.75rem 1rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            position: 'relative',
                            boxShadow: activeNavigationLeg === 'TO_MILL'
                                ? '0 2px 10px rgba(2, 132, 199, 0.15)'
                                : 'none'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '1.3rem' }}>🏭</span>
                                <div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: activeNavigationLeg === 'TO_MILL' ? '#0369A1' : '#0B1B2D' }}>
                                        My Location ➔ Processing Mill Gate
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '2px' }}>
                                        Delivery: <strong style={{ color: '#0B1B2D' }}>{trip.mill_name || 'Mill Gate'}</strong>
                                    </div>
                                </div>
                            </div>
                            <span style={{
                                fontSize: '0.7rem',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '1rem',
                                fontWeight: 800,
                                background: activeNavigationLeg === 'TO_MILL' ? '#0284C7' : '#F1F6FA',
                                color: activeNavigationLeg === 'TO_MILL' ? '#FFFFFF' : '#475569',
                                flexShrink: 0
                            }}>
                                {activeNavigationLeg === 'TO_MILL' ? '✓ ACTIVE' : 'SELECT'}
                            </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.4rem', borderTop: '1px solid #E2EDF5', paddingTop: '0.35rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            🏢 {trip.delivery_address || 'Mill Gate'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Metrics Bar: ETA, Distance, Destination, Vehicle */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                background: '#F1F6FA',
                borderBottom: '1px solid #D1DFEC',
                padding: '0.6rem clamp(0.6rem, 2vw, 1.25rem)',
                gap: '0.75rem'
            }}>
                <div>
                    <div style={{ fontSize: '0.68rem', color: '#475569', textTransform: 'uppercase', fontWeight: 700 }}>⏱️ Est. Drive Time</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#D97706' }}>
                        {routeData.loading ? '...' : `~${routeData.durationMinutes}m`}
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '0.68rem', color: '#475569', textTransform: 'uppercase', fontWeight: 700 }}>🛣️ Road Distance</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0284C7' }}>
                        {routeData.loading ? '...' : formatDistance(routeData.distanceKm)}
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '0.68rem', color: '#475569', textTransform: 'uppercase', fontWeight: 700 }}>🎯 Active Target</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0B1B2D', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {activeNavigationLeg === 'TO_FIELD' ? `🌾 ${trip.pickup_address}` : `🏭 ${trip.mill_name || trip.delivery_address}`}
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '0.68rem', color: '#475569', textTransform: 'uppercase', fontWeight: 700 }}>🚛 My Vehicle</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#059669', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {providerInfo.vehicle_number}
                    </div>
                </div>
            </div>

            {/* Interactive Leaflet Navigation Map Container */}
            <div style={{ height: 'clamp(280px, 42vh, 440px)', width: '100%', position: 'relative', overflow: 'hidden' }}>
                <MapContainer
                    center={[driverLocation.lat, driverLocation.lng]}
                    zoom={12}
                    style={{ height: '100%', width: '100%' }}
                    scrollWheelZoom={false}
                >
                    <MapAutoBounds
                        bounds={mapBounds}
                        focusCoords={focusTarget}
                        zoomLevel={focusTarget ? 15 : undefined}
                    />

                    {mapTileLayer === 'streets' ? (
                        <TileLayer
                            attribution='&copy; OpenStreetMap'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                    ) : (
                        <TileLayer
                            attribution='Tiles &copy; Esri'
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        />
                    )}

                    {/* Driver Truck Marker */}
                    <Marker
                        position={[driverLocation.lat, driverLocation.lng]}
                        icon={createTruckIcon(providerInfo.vehicle_number)}
                    >
                        <Popup>
                            <div style={{ color: '#000', fontSize: '0.8rem', lineHeight: '1.4' }}>
                                <strong style={{ color: '#059669' }}>🚚 Driver Live Location</strong><br />
                                <strong>Driver:</strong> {providerInfo.driver_name || providerInfo.name}<br />
                                <strong>Vehicle:</strong> {providerInfo.vehicle_number} ({providerInfo.vehicle_type || 'Truck'})<br />
                                <small style={{ color: '#666' }}>GPS: ±{driverLocation.accuracy}m</small>
                            </div>
                        </Popup>
                    </Marker>

                    {/* Farm / Field Pickup Marker */}
                    <Marker
                        position={[fieldLat, fieldLng]}
                        icon={createFieldIcon(trip.farmer_name || 'Farmer')}
                    >
                        <Popup>
                            <div style={{ color: '#000', fontSize: '0.8rem', lineHeight: '1.4' }}>
                                <strong style={{ color: '#d97706' }}>🌾 Farm Field Harvest Pickup</strong><br />
                                <strong>Farmer:</strong> {trip.farmer_name}<br />
                                <strong>Contact:</strong> {trip.farmer_phone}<br />
                                <strong>Crop Load:</strong> {trip.crop_name} • {trip.quantity}T<br />
                                <strong>Location:</strong> {trip.pickup_address}
                            </div>
                        </Popup>
                    </Marker>

                    {/* Destination Mill Gate Marker */}
                    <Marker
                        position={[millLat, millLng]}
                        icon={createMillIcon(trip.mill_name || 'Mill Gate')}
                    >
                        <Popup>
                            <div style={{ color: '#000', fontSize: '0.8rem', lineHeight: '1.4' }}>
                                <strong style={{ color: '#2563eb' }}>🏭 Target Mill Delivery Gate</strong><br />
                                <strong>Mill:</strong> {trip.mill_name}<br />
                                <strong>Address:</strong> {trip.delivery_address}
                            </div>
                        </Popup>
                    </Marker>

                    {/* Route Road Polyline */}
                    {routeData.coordinates && routeData.coordinates.length > 0 && (
                        <>
                            <Polyline
                                positions={routeData.coordinates}
                                color="#000000"
                                weight={6}
                                opacity={0.6}
                            />
                            <Polyline
                                positions={routeData.coordinates}
                                color={activeNavigationLeg === 'TO_FIELD' ? '#10b981' : '#3b82f6'}
                                weight={4}
                                dashArray={routeData.isRoadNetwork ? null : '6, 6'}
                            />
                        </>
                    )}
                </MapContainer>

                {/* Floating Map Controls overlay */}
                <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                }}>
                    <button
                        type="button"
                        onClick={() => setMapTileLayer(mapTileLayer === 'streets' ? 'satellite' : 'streets')}
                        title="Toggle Satellite / Street Map"
                        style={{
                            background: '#FFFFFF',
                            color: '#0B1B2D',
                            border: '1px solid #CBD5E1',
                            borderRadius: '0.4rem',
                            padding: '0.35rem 0.55rem',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            boxShadow: '0 2px 8px rgba(11,27,45,0.15)'
                        }}
                    >
                        {mapTileLayer === 'streets' ? '🛰️ Satellite' : '🗺️ Streets'}
                    </button>

                    <button
                        type="button"
                        onClick={refreshLiveGPS}
                        disabled={isLocating}
                        title="Recalculate Live GPS Location"
                        style={{
                            background: '#FFFFFF',
                            color: '#059669',
                            border: '1px solid #A7F3D0',
                            borderRadius: '0.4rem',
                            padding: '0.35rem 0.55rem',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            boxShadow: '0 2px 8px rgba(11,27,45,0.15)'
                        }}
                    >
                        {isLocating ? '📡 Locating' : '📍 My GPS'}
                    </button>

                    <button
                        type="button"
                        onClick={() => setFocusTarget({ lat: fieldLat, lng: fieldLng })}
                        title="Center on Farm Field"
                        style={{
                            background: '#FFFFFF',
                            color: '#D97706',
                            border: '1px solid #FDE68A',
                            borderRadius: '0.4rem',
                            padding: '0.35rem 0.55rem',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            boxShadow: '0 2px 8px rgba(11,27,45,0.15)'
                        }}
                    >
                        🌾 Farm
                    </button>

                    <button
                        type="button"
                        onClick={() => setFocusTarget(null)}
                        title="Fit Full Route on Screen"
                        style={{
                            background: '#FFFFFF',
                            color: '#0284C7',
                            border: '1px solid #BAE6FD',
                            borderRadius: '0.4rem',
                            padding: '0.35rem 0.55rem',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            boxShadow: '0 2px 8px rgba(11,27,45,0.15)'
                        }}
                    >
                        🔍 Fit
                    </button>
                </div>

                {/* Bottom Route Summary Chip on Map */}
                <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    left: '8px',
                    right: '8px',
                    zIndex: 1000,
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.4rem',
                    boxShadow: '0 4px 14px rgba(11, 27, 45, 0.1)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0, flex: '1 1 auto' }}>
                        <span style={{ fontSize: '1rem', flexShrink: 0 }}>
                            {activeNavigationLeg === 'TO_FIELD' ? '🚜' : '🏭'}
                        </span>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0B1B2D', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {activeNavigationLeg === 'TO_FIELD' ? 'Navigating to Field' : 'Navigating to Mill'}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {targetCoords.label}
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowTurnByTurn(!showTurnByTurn)}
                        style={{
                            background: '#F1F6FA',
                            color: '#0B1B2D',
                            border: '1px solid #D1DFEC',
                            borderRadius: '0.35rem',
                            padding: '0.3rem 0.6rem',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            flexShrink: 0
                        }}
                    >
                        <span>🧭 Steps ({routeData.steps?.length || 0})</span>
                        <span>{showTurnByTurn ? '▲' : '▼'}</span>
                    </button>
                </div>
            </div>

            {/* Turn-by-Turn Maneuvers Drawer */}
            {showTurnByTurn && (
                <div style={{
                    background: '#F8FAFD',
                    borderBottom: '1px solid #D1DFEC',
                    padding: '0.75rem clamp(0.75rem, 2vw, 1.25rem)',
                    maxHeight: '180px',
                    overflowY: 'auto'
                }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#D97706', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span>🧭 Driving Steps</span>
                        <span style={{ fontSize: '0.7rem', color: '#475569' }}>({routeData.isRoadNetwork ? 'Road Route' : 'Corridor'})</span>
                    </div>

                    {routeData.steps && routeData.steps.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            {routeData.steps.map((st, i) => (
                                <div key={i} style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '0.5rem',
                                    background: '#FFFFFF',
                                    padding: '0.4rem 0.65rem',
                                    borderRadius: '0.35rem',
                                    border: '1px solid #E2EDF5'
                                }}>
                                    <span style={{ fontSize: '0.8rem', color: '#0284C7', marginTop: '1px' }}>
                                        {st.modifier?.includes('left') ? '⬅️' : st.modifier?.includes('right') ? '➡️' : st.type === 'arrive' ? '🏁' : '⬆️'}
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.75rem', color: '#0B1B2D', fontWeight: 600 }}>
                                            {st.instruction}
                                        </div>
                                        <div style={{ fontSize: '0.68rem', color: '#64748B' }}>
                                            {st.distanceKm ? `${st.distanceKm} km` : ''} {st.durationMins ? `• ~${st.durationMins}m` : ''}
                                        </div>
                                    </div>
                                    <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontFamily: 'monospace', fontWeight: 700 }}>#{i + 1}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ color: '#64748B', fontSize: '0.75rem' }}>
                            Follow highlighted route to {targetCoords.label}.
                        </div>
                    )}
                </div>
            )}

            {/* Direct Navigation & Communication Action Suite */}
            <div style={{ padding: 'clamp(0.75rem, 2vw, 1.25rem)', background: '#FFFFFF' }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '0.6rem',
                    marginBottom: '0.85rem'
                }}>
                    {/* 1-Click Launch Google Maps */}
                    <a
                        href={googleMapsNavUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="primary-btn"
                        style={{
                            background: activeNavigationLeg === 'TO_FIELD'
                                ? 'linear-gradient(135deg, #D97706 0%, #B45309 100%)'
                                : 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
                            color: '#FFFFFF',
                            padding: '0.8rem 1rem',
                            justifyContent: 'center',
                            fontSize: '0.88rem',
                            fontWeight: 800,
                            borderRadius: '0.6rem',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.25)',
                            width: '100%',
                            boxSizing: 'border-box'
                        }}
                    >
                        <i className="fa-solid fa-location-arrow"></i>
                        <span>Start Turn-by-Turn GPS to {activeNavigationLeg === 'TO_FIELD' ? "Farmer's Field" : "Mill Gate"}</span>
                    </a>

                    {/* WhatsApp Live ETA */}
                    {cleanFarmerPhone && (
                        <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="secondary-btn"
                            style={{
                                background: '#ECFDF5',
                                color: '#047857',
                                border: '1px solid #A7F3D0',
                                padding: '0.8rem 1rem',
                                justifyContent: 'center',
                                fontSize: '0.88rem',
                                fontWeight: 700,
                                borderRadius: '0.6rem',
                                textDecoration: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                width: '100%',
                                boxSizing: 'border-box'
                            }}
                        >
                            <i className="fa-brands fa-whatsapp fa-lg"></i>
                            <span>WhatsApp ETA to Farmer</span>
                        </a>
                    )}
                </div>

                {/* Farmer Contact & Stage Actions */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    background: '#F8FAFD',
                    padding: '0.75rem 0.95rem',
                    borderRadius: '0.65rem',
                    border: '1px solid #D1DFEC'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flex: '1 1 auto' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: '#FEF3C7',
                            border: '1px solid #FDE68A',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.1rem',
                            color: '#B45309',
                            flexShrink: 0
                        }}>
                            👨‍🌾
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0B1B2D', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {trip.farmer_name} <span style={{ color: '#64748B', fontWeight: 500 }}>({trip.pickup_address})</span>
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#475569', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
                                <span>📞 {trip.farmer_phone}</span>
                                <span>•</span>
                                <span>🌾 {trip.crop_name} ({trip.quantity}T)</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', width: 'auto' }}>
                        <a
                            href={`tel:${trip.farmer_phone}`}
                            className="action-btn"
                            style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem', textDecoration: 'none', background: '#FFFFFF', color: '#0B1B2D', border: '1px solid #CBD5E1', borderRadius: '0.5rem', fontWeight: 700 }}
                        >
                            <i className="fa-solid fa-phone" style={{ color: '#0284C7', marginRight: '0.3rem' }}></i> Call Farmer
                        </a>

                        {trip.status === 'ASSIGNED' && (
                            <button
                                className="primary-btn"
                                onClick={() => onUpdateStatus(trip.transport_code, 'PICKUP_STARTED')}
                                style={{ padding: '0.55rem 1.1rem', fontSize: '0.84rem', fontWeight: 800, background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)' }}
                            >
                                <i className="fa-solid fa-truck-fast"></i> 1. Start Journey to Farm
                            </button>
                        )}
                        {trip.status === 'PICKUP_STARTED' && (
                            <button
                                className="primary-btn"
                                onClick={() => {
                                    onUpdateStatus(trip.transport_code, 'CROP_PICKED_UP');
                                    setActiveNavigationLeg('TO_MILL');
                                }}
                                style={{ padding: '0.55rem 1.1rem', fontSize: '0.84rem', fontWeight: 800, background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}
                            >
                                <i className="fa-solid fa-box-open"></i> 2. Confirm Load Picked Up
                            </button>
                        )}
                        {trip.status === 'CROP_PICKED_UP' && (
                            <button
                                className="primary-btn"
                                onClick={() => {
                                    onUpdateStatus(trip.transport_code, 'IN_TRANSIT');
                                    setActiveNavigationLeg('TO_MILL');
                                }}
                                style={{ padding: '0.55rem 1.1rem', fontSize: '0.84rem', fontWeight: 800, background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)' }}
                            >
                                <i className="fa-solid fa-road"></i> 3. Start Journey to Mill
                            </button>
                        )}
                        {trip.status === 'IN_TRANSIT' && (
                            <button
                                className="primary-btn"
                                onClick={() => onUpdateStatus(trip.transport_code, 'ARRIVED_AT_MILL')}
                                style={{ padding: '0.55rem 1.1rem', fontSize: '0.84rem', fontWeight: 800, background: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)' }}
                            >
                                <i className="fa-solid fa-warehouse"></i> 4. Reached Mill Gate
                            </button>
                        )}
                        {trip.status === 'ARRIVED_AT_MILL' && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setShowGateQrPass(true)}
                                    style={{
                                        padding: '0.55rem 0.95rem',
                                        fontSize: '0.84rem',
                                        fontWeight: 800,
                                        background: '#F0FDF4',
                                        color: '#166534',
                                        border: '1.5px solid #86EFAC',
                                        borderRadius: '0.5rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.4rem'
                                    }}
                                >
                                    <i className="fa-solid fa-qrcode fa-lg"></i> Show Gate QR Pass
                                </button>
                                <button
                                    className="primary-btn"
                                    onClick={() => onUpdateStatus(trip.transport_code, 'DELIVERED')}
                                    style={{ padding: '0.55rem 1.1rem', fontSize: '0.84rem', fontWeight: 800, background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', color: '#FFFFFF' }}
                                >
                                    <i className="fa-solid fa-circle-check"></i> 5. Load Dropped & Gate QR Completed
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* DRIVER GATE QR PASS MODAL */}
            {showGateQrPass && (
                <QrCodeModal
                    enquiry={{
                        ...trip,
                        enquiry_code: trip.enquiry_code || trip.enquiry_id || trip.transport_code,
                        crop_name: trip.crop_name,
                        quantity: trip.quantity,
                        acres: trip.acres,
                        farmer_name: trip.farmer_name,
                        farmer_phone: trip.farmer_phone,
                        mill_name: trip.mill_name,
                        vehicle_number: providerInfo.vehicle_number,
                        driver_name: providerInfo.driver_name || providerInfo.name
                    }}
                    onClose={() => setShowGateQrPass(false)}
                />
            )}
        </div>
    );
}
