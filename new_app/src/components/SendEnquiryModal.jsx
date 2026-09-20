import React, { useState, useEffect } from 'react';
import { kisanService, calculateDistance, getCapacityRange, DEFAULT_PROVIDERS } from '../services/kisanService';

export default function SendEnquiryModal({ onClose, mill, crop, user, onEnquiryCreated }) {
    const [step, setStep] = useState('form'); // 'form' | 'summary' | 'success'
    
    // Crop & Quantity inputs
    const [acres, setAcres] = useState(crop?.acres || '5');
    const [quantityTons, setQuantityTons] = useState(crop?.quantity || String(Number(crop?.acres || 5) * 2));
    const defaultPrice = (mill?.prices && crop?.cropName && mill.prices[crop.cropName])
        ? String(mill.prices[crop.cropName])
        : '2450';
    const [expectedPrice, setExpectedPrice] = useState(defaultPrice);
    const [withTransport, setWithTransport] = useState(false);

    // Helper to determine initial capacity tier based on crop load
    const getInitialCapacityTier = (qty) => {
        const n = Number(qty) || 10;
        if (n <= 6) return '5';
        if (n <= 12) return '10';
        if (n <= 17) return '15';
        if (n <= 22) return '20';
        if (n <= 27) return '25';
        return '30';
    };

    // Transport Logistics Configuration
    const [vehicleCapacity, setVehicleCapacity] = useState(() => getInitialCapacityTier(crop?.quantity || 10));
    const [pickupAddress, setPickupAddress] = useState(crop?.locationName || 'Bodulabanda Farm Plot');
    const [deliveryAddress, setDeliveryAddress] = useState(mill?.locationName || mill?.millName || 'Nela Kondapalli Processing Gate');
    const [transportInstructions, setTransportInstructions] = useState('');

    // Available Transport Providers (initialized with default providers for instant responsiveness)
    const [availableTransporters, setAvailableTransporters] = useState(() => (Array.isArray(DEFAULT_PROVIDERS) ? DEFAULT_PROVIDERS : []));
    const [loadingTransporters, setLoadingTransporters] = useState(false);
    const [selectedTransporter, setSelectedTransporter] = useState(() => (Array.isArray(DEFAULT_PROVIDERS) && DEFAULT_PROVIDERS.length > 0 ? DEFAULT_PROVIDERS[0] : null));
    const [vehicleLightboxImage, setVehicleLightboxImage] = useState(null);

    // Transport Dates & Details
    const todayStr = new Date().toISOString().split('T')[0];
    const defaultDateStr = () => {
        const d = new Date();
        d.setDate(d.getDate() + 2);
        return d.toISOString().split('T')[0];
    };
    const [transportDate, setTransportDate] = useState(defaultDateStr());
    const [farmerMessage, setFarmerMessage] = useState('I am ready to supply the crop on the selected date.');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [createdEnquiry, setCreatedEnquiry] = useState(null);

    // Formatted mill distance with accurate coordinate resolution
    const calcDist = (crop?.latitude && mill?.latitude)
        ? calculateDistance(crop.latitude, crop.longitude, mill.latitude, mill.longitude)
        : null;
    const rawDist = (mill?.distance !== undefined && mill?.distance !== null && !isNaN(Number(mill.distance)))
        ? Number(mill.distance)
        : (calcDist !== null ? calcDist : calculateDistance(crop?.latitude || 17.0916, crop?.longitude || 80.0210, mill?.latitude || 17.1033, mill?.longitude || 80.0536));
    const distanceKm = Math.round(rawDist * 10) / 10;

    // Load available transport providers on mount or when load capacity selection changes
    useEffect(() => {
        let isMounted = true;
        const fetchTransporters = async () => {
            setLoadingTransporters(true);
            try {
                const range = vehicleCapacity === 'ALL' ? null : getCapacityRange(vehicleCapacity);
                let list = await kisanService.getAvailableTransporters({
                    farmerLat: crop?.latitude || 17.0916,
                    farmerLng: crop?.longitude || 80.0210,
                    requiredCapacityTons: Number(quantityTons) || 10,
                    minCapacityTons: range ? range.min : undefined,
                    maxCapacityTons: range ? range.max : undefined
                });
                
                if (!list || list.length === 0) {
                    // Fallback to all transporters without capacity restriction
                    list = await kisanService.getAvailableTransporters({
                        farmerLat: crop?.latitude || 17.0916,
                        farmerLng: crop?.longitude || 80.0210,
                        requiredCapacityTons: Number(quantityTons) || 10
                    });
                }

                if (isMounted) {
                    const finalList = (list && list.length > 0) ? list : DEFAULT_PROVIDERS;
                    setAvailableTransporters(finalList);

                    // Intelligently select best transporter
                    if (finalList.length > 0) {
                        const match = finalList.find(t => t.phone === selectedTransporter?.phone && (t.is_within_range ?? true))
                            || finalList.find(t => (t.is_within_range ?? true) && t.is_capacity_sufficient)
                            || finalList.find(t => t.is_within_range)
                            || finalList.find(t => t.is_capacity_sufficient)
                            || finalList[0];
                        setSelectedTransporter(match);
                    }
                }
            } catch (err) {
                console.error("Error loading transporters:", err);
                if (isMounted) {
                    setAvailableTransporters(DEFAULT_PROVIDERS);
                }
            } finally {
                if (isMounted) {
                    setLoadingTransporters(false);
                }
            }
        };

        fetchTransporters();

        const unsubscribe = kisanService.subscribe((event) => {
            if (event === 'provider_updated' || event === 'transport_changed') {
                fetchTransporters();
            }
        });

        return () => { 
            isMounted = false; 
            unsubscribe();
        };
    }, [quantityTons, vehicleCapacity, crop?.latitude, crop?.longitude]);

    // Handle Transporter selection
    const handleSelectTransporter = (transporter) => {
        if (!transporter.is_capacity_sufficient) {
            const proceed = window.confirm(`⚠️ Truck capacity (${transporter.capacity} Tons) is slightly less than your entered load (${quantityTons} Tons). Are you sure you want to select this driver?`);
            if (!proceed) return;
        }
        setSelectedTransporter(transporter);
    };

    // Review Summary Transition
    const handleProceedToSummary = (e) => {
        e.preventDefault();

        if (!acres || isNaN(acres) || Number(acres) <= 0) {
            return alert("Please enter a valid acreage.");
        }
        if (!quantityTons || isNaN(quantityTons) || Number(quantityTons) <= 0) {
            return alert("Please enter a valid crop quantity in tons.");
        }

        if (withTransport) {
            if (!selectedTransporter) {
                return alert("Please select an available transport driver from the suggested list.");
            }
            if (!transportDate || transportDate < todayStr) {
                return alert("Please select a valid future pickup/load equipment date.");
            }
        }

        setStep('summary');
    };

    // Final Send Enquiry Submission
    const handleFinalSubmit = async () => {
        setIsSubmitting(true);
        try {
            const transportDistance = distanceKm;
            const transportRate = selectedTransporter?.price_per_km || 45;
            const transportCost = withTransport && selectedTransporter 
                ? Math.round(transportDistance * transportRate)
                : 0;

            const enquiryPayload = {
                mill_id: mill.id,
                mill_name: mill.millName,
                buyer_phone: mill.ownerPhone || mill.phone,
                buyer_name: mill.ownerName || mill.millName,
                farmer_phone: user.phone,
                farmer_name: user.name || `Farmer (${user.phone})`,
                crop_id: crop?.id || null,
                crop_name: crop?.cropName || 'Paddy (Rice)',
                crop_image: crop?.cropImage || '',
                crop_added_at: crop?.addedAt || null,
                acres: Number(acres),
                quantity: Number(quantityTons),
                expected_price: Number(expectedPrice),
                offered_price: Number(expectedPrice),
                total_price: Number(expectedPrice) * Number(quantityTons) * 10,
                
                // Transport details
                transport_required: withTransport,
                transport_provider_id: withTransport ? selectedTransporter?.phone : null,
                driver_name: withTransport ? (selectedTransporter?.driver_name || selectedTransporter?.name) : null,
                driver_phone: withTransport ? selectedTransporter?.phone : null,
                vehicle_name: withTransport ? (selectedTransporter?.vehicle_name || selectedTransporter?.vehicle_type || 'Standard Truck') : null,
                vehicle_number: withTransport ? selectedTransporter?.vehicle_number : null,
                vehicle_type: withTransport ? (selectedTransporter?.vehicle_type || 'Standard Truck') : null,
                vehicle_capacity: withTransport ? `${selectedTransporter?.capacity || vehicleCapacity} Ton` : null,
                vehicle_images: withTransport ? (selectedTransporter?.vehicle_images || []) : [],
                transport_date: withTransport ? transportDate : null,
                transport_distance: withTransport ? transportDistance : 0,
                transport_rate_per_km: withTransport ? transportRate : 0,
                estimated_transport_cost: transportCost,
                farmer_message: farmerMessage,
                transport_instructions: transportInstructions,
                pickup_location: pickupAddress || crop?.locationName || 'Farmer Farm Plot',
                delivery_location: deliveryAddress || mill?.locationName || mill?.millName || 'Mill Processing Gate',
                farmer_lat: crop?.latitude || 17.0916,
                farmer_lng: crop?.longitude || 80.0210,
                farmer_location_name: pickupAddress || crop?.locationName || 'Farm Plot',
                mill_lat: mill?.latitude || 17.1033,
                mill_lng: mill?.longitude || 80.0536,
                mill_location_name: deliveryAddress || mill?.locationName || mill?.millName || '',
                distance: distanceKm
            };

            const created = await kisanService.createEnquiry(enquiryPayload);
            setCreatedEnquiry(created);
            setStep('success');
            if (onEnquiryCreated) {
                onEnquiryCreated(created);
            }
        } catch (error) {
            console.error("Error creating enquiry:", error);
            alert("Failed to submit enquiry. Please verify details and try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const activeRange = vehicleCapacity === 'ALL' ? null : getCapacityRange(vehicleCapacity);

    return (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <div 
                className="modal-content" 
                style={{ 
                    maxWidth: '600px', 
                    width: '95%', 
                    maxHeight: '90vh', 
                    overflowY: 'auto',
                    background: '#0d1712',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    borderRadius: '1.25rem',
                    boxShadow: '0 25px 70px rgba(0, 0, 0, 0.95)',
                    padding: '1.5rem',
                    color: '#f0fdf4'
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <i className="fa-solid fa-paper-plane" style={{ color: 'var(--primary)', fontSize: '1.2rem' }}></i>
                        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                            {step === 'summary' ? 'Enquiry Confirmation Summary' : step === 'success' ? 'Enquiry Dispatched' : `Send Enquiry to ${mill.millName}`}
                        </h3>
                    </div>
                    <button className="action-btn text-btn" onClick={onClose} style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                        <i className="fa-solid fa-xmark" style={{ fontSize: '1.25rem' }}></i>
                    </button>
                </div>

                {/* ======================================================== */}
                {/* VIEW 1: SUCCESS STATE */}
                {/* ======================================================== */}
                {step === 'success' && createdEnquiry && (
                    <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                        <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '2rem' }}>
                            <i className="fa-solid fa-circle-check"></i>
                        </div>

                        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: 'var(--primary)' }}>
                            Enquiry Sent Successfully!
                        </h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                            Your enquiry has been dispatched to <strong>{mill.millName}</strong>.{withTransport ? ` Once the mill accepts, your transport request will automatically be dispatched to driver ${selectedTransporter?.driver_name || selectedTransporter?.name}.` : ''}
                        </p>

                        <div style={{ background: 'rgba(0, 0, 0, 0.35)', borderRadius: '0.75rem', padding: '1.25rem', textAlign: 'left', marginBottom: '1.5rem', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Permanent Enquiry ID:</span>
                                <strong style={{ color: 'var(--accent-gold)', fontFamily: 'monospace', fontSize: '1.15rem' }}>
                                    {createdEnquiry.enquiry_code}
                                </strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Crop / Quantity:</span>
                                <strong>{createdEnquiry.crop_name} ({createdEnquiry.quantity} Tons)</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Transport Required:</span>
                                <span style={{ color: withTransport ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 700 }}>
                                    {withTransport ? `Yes (🚛 ${selectedTransporter?.driver_name || selectedTransporter?.name})` : 'No (Self Arranged)'}
                                </span>
                            </div>
                            {withTransport && (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Pickup / Equipment Date:</span>
                                        <strong style={{ color: 'var(--primary)' }}>{transportDate}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Transport Rate:</span>
                                        <strong style={{ color: '#fff' }}>₹{selectedTransporter?.price_per_km}/KM</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Estimated Haulage Cost:</span>
                                        <strong style={{ color: 'var(--accent-gold)' }}>₹{createdEnquiry.estimated_transport_cost?.toLocaleString()}</strong>
                                    </div>
                                </>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Status:</span>
                                <span className="status-badge" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#fbbf24', padding: '0.25rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, borderRadius: '0.4rem' }}>
                                    {withTransport ? '⏳ AWAITING MILL ACCEPTANCE (Driver Dispatches Upon Approval)' : '⏳ AWAITING MILL DECISION'}
                                </span>
                            </div>
                        </div>

                        <button className="primary-btn" onClick={onClose} style={{ width: '100%', justifyContent: 'center', padding: '0.85rem', fontWeight: 700 }}>
                            View in My Enquiries
                        </button>
                    </div>
                )}

                {/* ======================================================== */}
                {/* VIEW 2: CONFIRMATION SUMMARY */}
                {/* ======================================================== */}
                {step === 'summary' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                            <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--primary)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <i className="fa-solid fa-wheat-awn"></i> Crop & Mill Information
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', fontSize: '0.85rem' }}>
                                <div><span style={{ color: 'var(--text-muted)' }}>Crop:</span> <strong>{crop?.cropName || 'Paddy (Rice)'}</strong></div>
                                <div><span style={{ color: 'var(--text-muted)' }}>Quantity:</span> <strong>{quantityTons} Tons ({acres} Acres)</strong></div>
                                <div><span style={{ color: 'var(--text-muted)' }}>Farm Location:</span> <strong>{pickupAddress}</strong></div>
                                <div><span style={{ color: 'var(--text-muted)' }}>Target Mill:</span> <strong>{mill.millName}</strong></div>
                                <div><span style={{ color: 'var(--text-muted)' }}>Mill Distance:</span> <strong style={{ color: 'var(--primary)' }}>~{distanceKm} KM</strong></div>
                                <div><span style={{ color: 'var(--text-muted)' }}>Expected Price:</span> <strong>₹{expectedPrice}/Quintal</strong></div>
                            </div>
                        </div>

                        {/* Transport Summary */}
                        <div style={{ background: withTransport ? 'rgba(16, 185, 129, 0.06)' : 'rgba(0, 0, 0, 0.3)', padding: '1rem', borderRadius: '0.75rem', border: withTransport ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(255, 255, 255, 0.08)' }}>
                            <h4 style={{ margin: '0 0 0.75rem 0', color: withTransport ? 'var(--primary)' : 'var(--text-muted)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <i className="fa-solid fa-truck"></i> Transport & Logistics: <strong>{withTransport ? 'YES (Logistics Requested)' : 'NO (Self Arranged)'}</strong>
                            </h4>

                            {withTransport && selectedTransporter && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', fontSize: '0.85rem' }}>
                                    <div><span style={{ color: 'var(--text-muted)' }}>Truck Model:</span> <strong style={{ color: 'var(--primary)' }}>{selectedTransporter.vehicle_name || selectedTransporter.vehicle_type || 'Standard Truck'}</strong></div>
                                    <div><span style={{ color: 'var(--text-muted)' }}>Truck Number:</span> <strong style={{ fontFamily: 'monospace' }}>{selectedTransporter.vehicle_number}</strong></div>
                                    <div><span style={{ color: 'var(--text-muted)' }}>Driver Name:</span> <strong>{selectedTransporter.driver_name || selectedTransporter.name}</strong></div>
                                    <div><span style={{ color: 'var(--text-muted)' }}>Vehicle Capacity:</span> <strong>{selectedTransporter.capacity} Tons Load</strong></div>
                                    <div><span style={{ color: 'var(--text-muted)' }}>Pickup/Equipment Date:</span> <strong style={{ color: 'var(--primary)' }}>{new Date(transportDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div>
                                    <div><span style={{ color: 'var(--text-muted)' }}>Driver Rating:</span> <strong>⭐ {selectedTransporter.rating || 4.8}</strong></div>
                                    <div><span style={{ color: 'var(--text-muted)' }}>Pickup Address:</span> <strong>{pickupAddress}</strong></div>
                                    <div><span style={{ color: 'var(--text-muted)' }}>Delivery Address:</span> <strong>{deliveryAddress}</strong></div>
                                    <div><span style={{ color: 'var(--text-muted)' }}>Transport Rate:</span> <strong>₹{selectedTransporter.price_per_km} / KM</strong></div>
                                    <div><span style={{ color: 'var(--text-muted)' }}>Est. Haulage Cost:</span> <strong style={{ color: 'var(--accent-gold)' }}>₹{selectedTransporter.estimated_cost?.toLocaleString()}</strong></div>
                                    
                                    {/* Selected Vehicle Verified Photos (Rendered ONLY if Transporter uploaded real photos) */}
                                    {selectedTransporter.vehicle_images && selectedTransporter.vehicle_images.filter(img => typeof img === 'string' && img.trim().length > 0).length > 0 ? (
                                        <div style={{ gridColumn: 'span 2', background: 'rgba(0,0,0,0.4)', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span><i className="fa-solid fa-camera"></i> Transporter Uploaded Photos ({selectedTransporter.vehicle_name || 'Vehicle'})</span>
                                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Click photo to expand</span>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                                {selectedTransporter.vehicle_images.filter(img => typeof img === 'string' && img.trim().length > 0).slice(0, 2).map((imgUrl, i) => (
                                                    <div 
                                                        key={i}
                                                        onClick={(e) => {
                                                             e.stopPropagation();
                                                             setVehicleLightboxImage({
                                                                 url: imgUrl,
                                                                 title: `${selectedTransporter.vehicle_name || 'Truck'} (${selectedTransporter.vehicle_number}) - Photo ${i + 1}`
                                                             });
                                                        }}
                                                        style={{ height: '75px', borderRadius: '0.4rem', overflow: 'hidden', position: 'relative', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)' }}
                                                    >
                                                        <img src={imgUrl} alt={`Truck Angle ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        <span style={{ position: 'absolute', bottom: '2px', left: '4px', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: '0.2rem', fontWeight: 600 }}>
                                                            Photo {i + 1}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ gridColumn: 'span 2', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.02)', padding: '0.4rem 0.6rem', borderRadius: '0.4rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <i className="fa-solid fa-truck" style={{ color: 'var(--primary)' }}></i>
                                            <span>Registered Driver • No custom vehicle photos uploaded</span>
                                        </div>
                                    )}

                                    {transportInstructions && (
                                        <div style={{ gridColumn: 'span 2', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            <span>Transport Instructions:</span> <em style={{ color: '#fff' }}>"{transportInstructions}"</em>
                                        </div>
                                    )}

                                    <div style={{ gridColumn: 'span 2', background: 'rgba(0,0,0,0.3)', padding: '0.6rem 0.8rem', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
                                        <span style={{ fontWeight: 600 }}>Estimated Transport Cost:</span>
                                        <strong style={{ fontSize: '1.1rem', color: 'var(--accent-gold)' }}>₹{selectedTransporter.estimated_cost?.toLocaleString()}</strong>
                                    </div>

                                    <div style={{ gridColumn: 'span 2', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '0.55rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.78rem', color: '#a7f3d0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <i className="fa-solid fa-circle-info" style={{ color: 'var(--primary)' }}></i>
                                        <span><strong>Order Flow:</strong> Enquiry is dispatched to <strong>{mill.millName}</strong> first. Once the mill accepts, the load assignment will automatically be sent to driver <strong>{selectedTransporter.driver_name || selectedTransporter.name}</strong> for pickup confirmation.</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {farmerMessage && (
                            <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.75rem 1rem', borderRadius: '0.5rem', fontSize: '0.85rem' }}>
                                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Message to Mill:</span>
                                <em>"{farmerMessage}"</em>
                            </div>
                        )}

                        {/* Summary Actions */}
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                            <button type="button" className="text-btn" onClick={() => setStep('form')} style={{ flex: 1, padding: '0.85rem', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem', color: 'var(--text-main)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <i className="fa-solid fa-arrow-left"></i> Edit Details
                            </button>
                            <button type="button" className="primary-btn" onClick={handleFinalSubmit} disabled={isSubmitting} style={{ flex: 1.5, justifyContent: 'center', padding: '0.85rem', fontWeight: 800 }}>
                                {isSubmitting ? (
                                    <>
                                        <i className="fa-solid fa-spinner fa-spin"></i>
                                        <span>Dispatching Enquiry...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-paper-plane"></i>
                                        <span>Send Enquiry</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* ======================================================== */}
                {/* VIEW 3: FORM INPUT */}
                {/* ======================================================== */}
                {step === 'form' && (
                    <form onSubmit={handleProceedToSummary} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                        {/* Target Mill Header Box */}
                        <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '0.75rem 1rem', borderRadius: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                            <div>
                                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase' }}>Target Mill</span>
                                <strong style={{ fontSize: '0.95rem' }}>{mill.millName}</strong>
                            </div>
                            <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.9rem' }}>~{distanceKm} km away</span>
                        </div>

                        {/* Crop and Acreage */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Crop Type</label>
                                <div className="input-group">
                                    <i className="fa-solid fa-seedling"></i>
                                    <input type="text" value={crop?.cropName || 'Paddy (Rice)'} disabled style={{ background: 'transparent' }} />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Acreage (Acres)</label>
                                <div className="input-group">
                                    <i className="fa-solid fa-chart-area"></i>
                                    <input
                                        type="number"
                                        value={acres}
                                        onChange={(e) => {
                                            setAcres(e.target.value);
                                            const newQty = String(Number(e.target.value || 0) * 2);
                                            setQuantityTons(newQty);
                                            setVehicleCapacity(getInitialCapacityTier(newQty));
                                        }}
                                        min="0.1"
                                        step="0.1"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Quantity and Expected Price */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Crop Quantity (Tons)</label>
                                <div className="input-group">
                                    <i className="fa-solid fa-weight-hanging"></i>
                                    <input
                                        type="number"
                                        value={quantityTons}
                                        onChange={(e) => {
                                            const newQty = e.target.value;
                                            setQuantityTons(newQty);
                                            setVehicleCapacity(getInitialCapacityTier(newQty));
                                        }}
                                        min="0.5"
                                        step="0.5"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Expected Price (₹/Quintal)</label>
                                <div className="input-group">
                                    <i className="fa-solid fa-indian-rupee-sign"></i>
                                    <input
                                        type="number"
                                        value={expectedPrice}
                                        onChange={(e) => setExpectedPrice(e.target.value)}
                                        min="100"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Transport Required Option */}
                        <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                            <label style={{ display: 'block', marginBottom: '0.6rem', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                                Transport Required?
                            </label>
                            
                            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem' }}>
                                    <input
                                        type="radio"
                                        name="transport_opt"
                                        checked={!withTransport}
                                        onChange={() => setWithTransport(false)}
                                    />
                                    <span>No (I will arrange transport)</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem' }}>
                                    <input
                                        type="radio"
                                        name="transport_opt"
                                        checked={withTransport}
                                        onChange={() => setWithTransport(true)}
                                    />
                                    <span style={{ color: 'var(--primary)', fontWeight: 700 }}>Yes (Request Logistics)</span>
                                </label>
                            </div>

                            {/* ======================================================== */}
                            {/* SECTION: AVAILABLE TRANSPORT LOGISTICS (WHEN YES) */}
                            {/* ======================================================== */}
                            {withTransport && (
                                <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px dashed rgba(255, 255, 255, 0.12)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    
                                    {/* Load Selection / Capacity Filter */}
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                            <label style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                <i className="fa-solid fa-truck-ramp-box" style={{ color: 'var(--primary)' }}></i>
                                                Select Required Truck Load / Capacity
                                            </label>
                                            <span style={{ fontSize: '0.72rem', color: 'var(--accent-gold)', fontWeight: 600 }}>
                                                Crop Load: {quantityTons} Tons
                                            </span>
                                        </div>

                                        <div className="input-group" style={{ marginBottom: '0.5rem' }}>
                                            <i className="fa-solid fa-truck-moving"></i>
                                            <select
                                                value={vehicleCapacity}
                                                onChange={(e) => setVehicleCapacity(e.target.value)}
                                                style={{ width: '100%', background: 'transparent', border: 'none', color: 'inherit', outline: 'none', cursor: 'pointer', fontWeight: 600 }}
                                            >
                                                <option value="5" style={{ color: '#000', background: '#fff' }}>5 Ton Load (Range: 4 - 8 Tons) • Mini / Pickup Trucks</option>
                                                <option value="10" style={{ color: '#000', background: '#fff' }}>10 Ton Load (Range: 8 - 14 Tons) • Medium Duty Cargo Trucks</option>
                                                <option value="15" style={{ color: '#000', background: '#fff' }}>15 Ton Load (Range: 12 - 18 Tons) • Heavy Standard Trucks</option>
                                                <option value="20" style={{ color: '#000', background: '#fff' }}>20 Ton Load (Range: 18 - 25 Tons) • 10-Wheeler Multi-Axle Trucks</option>
                                                <option value="25" style={{ color: '#000', background: '#fff' }}>25 Ton Load (Range: 22 - 30 Tons) • Heavy Tipper & Lorries</option>
                                                <option value="30" style={{ color: '#000', background: '#fff' }}>30+ Ton Load (Range: 28 - 45 Tons) • Heavy Multi-Axle Trailers</option>
                                                <option value="ALL" style={{ color: '#000', background: '#fff' }}>All Capacities • Show Full Fleet</option>
                                            </select>
                                        </div>

                                        {/* Quick Load Capacity Buttons */}
                                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                                            {[
                                                { id: '5', label: '5T' },
                                                { id: '10', label: '10T' },
                                                { id: '15', label: '15T' },
                                                { id: '20', label: '20T' },
                                                { id: '25', label: '25T' },
                                                { id: '30', label: '30T+' },
                                                { id: 'ALL', label: 'All' }
                                            ].map(btn => (
                                                <button
                                                    key={btn.id}
                                                    type="button"
                                                    onClick={() => setVehicleCapacity(btn.id)}
                                                    style={{
                                                        padding: '0.25rem 0.6rem',
                                                        fontSize: '0.72rem',
                                                        fontWeight: 700,
                                                        borderRadius: '0.35rem',
                                                        border: vehicleCapacity === btn.id ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
                                                        background: vehicleCapacity === btn.id ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.03)',
                                                        color: vehicleCapacity === btn.id ? 'var(--primary)' : 'var(--text-muted)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                >
                                                    {btn.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Preferred Pickup Date (Equipment Loading Date) */}
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>
                                            <i className="fa-solid fa-calendar-day" style={{ color: 'var(--primary)', marginRight: '0.35rem' }}></i>
                                            Preferred Pickup / Load Equipment Date
                                        </label>
                                        <div className="input-group">
                                            <i className="fa-solid fa-calendar-check"></i>
                                            <input
                                                type="date"
                                                value={transportDate}
                                                min={todayStr}
                                                onChange={(e) => setTransportDate(e.target.value)}
                                                style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', cursor: 'pointer' }}
                                                required
                                            />
                                        </div>
                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                                            Specify when farm harvest is ready for truck & equipment loading.
                                        </span>
                                    </div>

                                    {/* Addresses: Farm Pickup & Mill Unloading */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>
                                                Pickup Farm Coordinates / Address
                                            </label>
                                            <div className="input-group">
                                                <i className="fa-solid fa-location-dot"></i>
                                                <input
                                                    type="text"
                                                    value={pickupAddress}
                                                    onChange={(e) => setPickupAddress(e.target.value)}
                                                    placeholder="Farm location"
                                                    required
                                                    style={{ background: 'transparent' }}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>
                                                Mill Delivery Gate / Unloading Address
                                            </label>
                                            <div className="input-group">
                                                <i className="fa-solid fa-warehouse"></i>
                                                <input
                                                    type="text"
                                                    value={deliveryAddress}
                                                    onChange={(e) => setDeliveryAddress(e.target.value)}
                                                    placeholder="Mill Gate"
                                                    required
                                                    style={{ background: 'transparent' }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Additional Instructions */}
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>
                                            Additional Transport Instructions
                                        </label>
                                        <div className="input-group">
                                            <i className="fa-solid fa-clipboard-list"></i>
                                            <input
                                                type="text"
                                                value={transportInstructions}
                                                onChange={(e) => setTransportInstructions(e.target.value)}
                                                placeholder="e.g. Tarpaulin cover required, narrow access road"
                                                style={{ background: 'transparent' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Drivers & Trucks Matching Section with Vehicle Images and Names */}
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                <i className="fa-solid fa-truck-fast"></i> Available Trucks for Selected Load
                                            </span>
                                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                                {activeRange ? (
                                                    <span>Range: <strong style={{ color: 'var(--accent-gold)' }}>{activeRange.label}</strong></span>
                                                ) : (
                                                    <span>Load: <strong>{quantityTons} Tons</strong></span>
                                                )}
                                            </span>
                                        </div>

                                        {loadingTransporters ? (
                                            <div style={{ textAlign: 'center', padding: '1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                <i className="fa-solid fa-spinner fa-spin"></i> Finding matching trucks for load {vehicleCapacity === 'ALL' ? 'fleet' : `${vehicleCapacity} Tons`}...
                                            </div>
                                        ) : availableTransporters.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.25)', borderRadius: '0.5rem', border: '1px dashed rgba(255,255,255,0.1)' }}>
                                                <p style={{ margin: '0 0 0.6rem 0' }}>No transport vehicles found matching this filter.</p>
                                                <button 
                                                    type="button" 
                                                    onClick={() => setVehicleCapacity('ALL')}
                                                    style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem', background: 'var(--primary)', color: '#000', fontWeight: 700, borderRadius: '0.35rem', border: 'none', cursor: 'pointer' }}
                                                >
                                                    <i className="fa-solid fa-truck" style={{ marginRight: '0.35rem' }}></i> Show All Fleet Trucks
                                                </button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '280px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                                                {availableTransporters.map((transporter) => {
                                                    const isSelected = selectedTransporter?.phone === transporter.phone;
                                                    const isSufficient = transporter.is_capacity_sufficient;
                                                    const inRange = transporter.is_within_range;
                                                    const validImgs = transporter.vehicle_images && Array.isArray(transporter.vehicle_images)
                                                        ? transporter.vehicle_images.filter(img => typeof img === 'string' && img.trim().length > 0)
                                                        : [];
                                                    const hasPhoto = validImgs.length > 0;
                                                    const mainImage = hasPhoto ? validImgs[0] : null;

                                                    return (
                                                        <div
                                                            key={transporter.phone}
                                                            onClick={() => handleSelectTransporter(transporter)}
                                                            style={{
                                                                background: isSelected 
                                                                    ? 'rgba(16, 185, 129, 0.16)' 
                                                                    : !inRange 
                                                                    ? 'rgba(255, 255, 255, 0.02)' 
                                                                    : 'rgba(255, 255, 255, 0.04)',
                                                                border: isSelected 
                                                                    ? '2px solid var(--primary)' 
                                                                    : inRange 
                                                                    ? '1px solid rgba(16, 185, 129, 0.3)' 
                                                                    : '1px solid rgba(255, 255, 255, 0.06)',
                                                                borderRadius: '0.75rem',
                                                                padding: '0.75rem 0.85rem',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s ease',
                                                                position: 'relative'
                                                            }}
                                                        >
                                                            {/* Main Truck Row: Image + Details */}
                                                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                                                                
                                                                {/* Truck Photo Thumbnail (if uploaded by driver) or Clean Vehicle Icon */}
                                                                {hasPhoto ? (
                                                                    <div 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setVehicleLightboxImage({
                                                                                url: mainImage,
                                                                                title: `${transporter.vehicle_name || 'Truck'} (${transporter.vehicle_number})`
                                                                            });
                                                                        }}
                                                                        style={{ 
                                                                            width: '78px', 
                                                                            height: '64px', 
                                                                            borderRadius: '0.45rem', 
                                                                            overflow: 'hidden', 
                                                                            flexShrink: 0, 
                                                                            position: 'relative',
                                                                            border: '1px solid rgba(255,255,255,0.15)',
                                                                            background: '#000',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                        title="Click to zoom truck photo"
                                                                    >
                                                                        <img 
                                                                            src={mainImage} 
                                                                            alt={transporter.vehicle_name || 'Truck'} 
                                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                                                        />
                                                                        <span style={{ 
                                                                            position: 'absolute', 
                                                                            bottom: '1px', 
                                                                            right: '1px', 
                                                                            background: 'rgba(0,0,0,0.75)', 
                                                                            color: '#fff', 
                                                                            fontSize: '0.58rem', 
                                                                            padding: '0.05rem 0.25rem', 
                                                                            borderRadius: '0.2rem' 
                                                                        }}>
                                                                            🔍
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <div 
                                                                        style={{ 
                                                                            width: '78px', 
                                                                            height: '64px', 
                                                                            borderRadius: '0.45rem', 
                                                                            background: 'rgba(255, 255, 255, 0.03)',
                                                                            border: '1px solid rgba(255, 255, 255, 0.08)',
                                                                            display: 'flex',
                                                                            flexDirection: 'column',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            flexShrink: 0
                                                                        }}
                                                                    >
                                                                        <i className="fa-solid fa-truck" style={{ color: 'var(--primary)', fontSize: '1.25rem', opacity: 0.8, marginBottom: '0.2rem' }}></i>
                                                                        <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>No Photo</span>
                                                                    </div>
                                                                )}

                                                                {/* Truck Info */}
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.4rem', marginBottom: '0.2rem' }}>
                                                                        <div style={{ minWidth: 0 }}>
                                                                            <strong style={{ fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                                <i className="fa-solid fa-truck" style={{ color: 'var(--primary)', fontSize: '0.85rem' }}></i>
                                                                                <span>{transporter.vehicle_name || 'Standard Cargo Truck'}</span>
                                                                            </strong>
                                                                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                                                                <span>Driver: <strong style={{ color: 'var(--text-main)' }}>{transporter.driver_name || transporter.name}</strong></span>
                                                                                <span>•</span>
                                                                                <span style={{ fontFamily: 'monospace', color: '#fff' }}>{transporter.vehicle_number}</span>
                                                                                <span>•</span>
                                                                                <span style={{ color: 'var(--accent-gold)' }}>⭐ {transporter.rating || 4.8}</span>
                                                                            </div>
                                                                        </div>

                                                                        {/* Capacity Badge */}
                                                                        <span style={{
                                                                            fontSize: '0.72rem',
                                                                            padding: '0.2rem 0.5rem',
                                                                            borderRadius: '0.35rem',
                                                                            fontWeight: 700,
                                                                            background: inRange ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.15)',
                                                                            color: inRange ? 'var(--primary)' : '#fbbf24',
                                                                            border: inRange ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(245, 158, 11, 0.3)',
                                                                            flexShrink: 0
                                                                        }}>
                                                                            {transporter.capacity} Ton Load {isSufficient ? '✅' : '⚠️'}
                                                                        </span>
                                                                    </div>

                                                                    {/* Rate & Cost Row */}
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                                                        <div>Rate: <strong style={{ color: '#fff' }}>₹{transporter.price_per_km}/KM</strong></div>
                                                                        <div>Dist: <strong style={{ color: '#fff' }}>~{transporter.distance} KM</strong></div>
                                                                        <div>Est: <strong style={{ color: 'var(--accent-gold)', fontSize: '0.85rem' }}>₹{transporter.estimated_cost?.toLocaleString()}</strong></div>
                                                                        {isSelected && (
                                                                            <span style={{ fontSize: '0.65rem', background: 'var(--primary)', color: '#000', padding: '0.1rem 0.45rem', borderRadius: '1rem', fontWeight: 800 }}>
                                                                                ✓ SELECTED
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Additional Angle Photos Preview Strip (if available) */}
                                                            {transporter.vehicle_images && transporter.vehicle_images.length > 1 && (
                                                                <div style={{ marginTop: '0.45rem', paddingTop: '0.4rem', borderTop: '1px dashed rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                    <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>
                                                                        <i className="fa-solid fa-camera" style={{ color: 'var(--primary)', marginRight: '0.25rem' }}></i>
                                                                        View Angles:
                                                                    </span>
                                                                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                                                                        {transporter.vehicle_images.slice(0, 2).map((imgUrl, idx) => (
                                                                            <button
                                                                                key={idx}
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setVehicleLightboxImage({
                                                                                        url: imgUrl,
                                                                                        title: `${transporter.vehicle_name || 'Truck'} (${transporter.vehicle_number}) - ${idx === 0 ? 'Front & Plate' : 'Cargo Bed'}`
                                                                                    });
                                                                                }}
                                                                                style={{
                                                                                    background: 'rgba(255,255,255,0.06)',
                                                                                    border: '1px solid rgba(255,255,255,0.12)',
                                                                                    color: '#fff',
                                                                                    fontSize: '0.65rem',
                                                                                    padding: '0.15rem 0.4rem',
                                                                                    borderRadius: '0.25rem',
                                                                                    cursor: 'pointer'
                                                                                }}
                                                                            >
                                                                                {idx === 0 ? 'Front View 🔍' : 'Cargo Bed 🔍'}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Additional Farmer Message */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Message to Mill (Optional)</label>
                            <div className="input-group" style={{ alignItems: 'flex-start' }}>
                                <i className="fa-solid fa-message" style={{ marginTop: '0.8rem' }}></i>
                                <textarea
                                    placeholder="Enter any quality specifications, moisture level, or negotiable terms..."
                                    value={farmerMessage}
                                    onChange={(e) => setFarmerMessage(e.target.value)}
                                    rows="2"
                                    style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', resize: 'vertical' }}
                                ></textarea>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                            <button type="button" className="text-btn" onClick={onClose} style={{ flex: 1, padding: '0.85rem', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem', color: 'var(--text-main)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                Cancel
                            </button>
                            <button type="submit" className="primary-btn" style={{ flex: 1.5, justifyContent: 'center', padding: '0.85rem', fontWeight: 800 }}>
                                <span>Review Summary</span>
                                <i className="fa-solid fa-arrow-right"></i>
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* LIGHTBOX FOR VEHICLE PHOTOS */}
            {vehicleLightboxImage && (
                <div 
                    className="modal-overlay" 
                    style={{ zIndex: 10001, background: 'rgba(0, 0, 0, 0.88)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
                    onClick={() => setVehicleLightboxImage(null)}
                >
                    <div 
                        className="bento-card" 
                        style={{ maxWidth: '650px', width: '100%', padding: '1.25rem', position: 'relative', border: '1px solid rgba(255,255,255,0.2)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h4 style={{ margin: 0, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <i className="fa-solid fa-truck" style={{ color: 'var(--primary)' }}></i>
                                {vehicleLightboxImage.title}
                            </h4>
                            <button 
                                className="action-btn text-btn" 
                                onClick={() => setVehicleLightboxImage(null)}
                                style={{ width: '28px', height: '28px', padding: 0 }}
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <div style={{ maxHeight: '65vh', borderRadius: '0.5rem', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                            <img 
                                src={vehicleLightboxImage.url} 
                                alt="Vehicle Full View" 
                                style={{ width: '100%', height: 'auto', maxHeight: '65vh', objectFit: 'contain' }} 
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
