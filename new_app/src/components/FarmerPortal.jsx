import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../utils/supabase';
import { kisanService } from '../services/kisanService';
import { fetchWeatherByCoords, fetchWeatherByCity, getWeatherIcon } from '../services/weather';
import { calculateDistance, formatDistance } from '../services/locationService';
import AddCropModal from './AddCropModal';
import SendEnquiryModal from './SendEnquiryModal';
import QrCodeModal from './QrCodeModal';
import KisanLogo from './KisanLogo';
import FarmerProfileView from './FarmerProfileView';
import LanguageSelector from './LanguageSelector';
import PassbookOcrUploader from './PassbookOcrUploader';
import SandboxPayoutModal from './SandboxPayoutModal';
import RazorpayCheckoutModal from './RazorpayCheckoutModal';
import { compressImageFile } from '../utils/imageUtils';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

// Memoized Header Clock to avoid re-rendering the entire FarmerPortal every 1 second
const HeaderClock = React.memo(function HeaderClock() {
    const [time, setTime] = useState(() => new Date());
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);
    return (
        <div className="header-datetime">
            <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                {time.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </div>
            <div>{time.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</div>
        </div>
    );
});

export default function FarmerPortal({ user: propUser, onLogout }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user: authUser, logout: authLogout } = useAuth();
    const { t, language } = useLanguage();
    const user = propUser || authUser || {};
    const handleLogout = onLogout || authLogout;

    // Derive active tab from URL path
    const pathToTab = {
        '': 'dashboard',
        'dashboard': 'dashboard',
        'crops': 'crops',
        'mills': 'crops',
        'crops-mills': 'crops',
        'enquiries': 'enquiries',
        'qr': 'qrcodes',
        'qrcodes': 'qrcodes',
        'payments': 'payments',
        'load-status': 'loadstatus',
        'loadstatus': 'loadstatus',
        'transport': 'transport',
        'history': 'history',
        'market': 'market',
        'profile': 'profile'
    };
    const currentSubPath = location.pathname.replace(/^\/farmer\/?/, '').split('/')[0];
    const activeTab = pathToTab[currentSubPath] || 'dashboard';

    const setActiveTab = (tab) => {
        const tabToPath = {
            'dashboard': '/farmer/dashboard',
            'crops': '/farmer/crops',
            'mills': '/farmer/crops',
            'enquiries': '/farmer/enquiries',
            'qrcodes': '/farmer/qr',
            'payments': '/farmer/payments',
            'loadstatus': '/farmer/load-status',
            'transport': '/farmer/transport',
            'history': '/farmer/history',
            'market': '/farmer/market',
            'profile': '/farmer/profile'
        };
        navigate(tabToPath[tab] || `/farmer/${tab}`);
        setIsSidebarOpen(false);
    };

    // CRITICAL BACK BUTTON FIX: Stays inside Farmer Portal workspace
    const handleBack = () => {
        if (window.history.state && window.history.state.idx > 0) {
            navigate(-1);
        } else {
            navigate('/farmer/dashboard');
        }
    };

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isAddCropOpen, setIsAddCropOpen] = useState(false);

    // Profile States
    const [profileName, setProfileName] = useState(user.name || '');
    const [profileAltPhone, setProfileAltPhone] = useState(user.altPhone || '');

    // Data States
    const [crops, setCrops] = useState([]);
    const [weather, setWeather] = useState(null);
    const [loadingCrops, setLoadingCrops] = useState(true);
    const [selectedWeatherLocation, setSelectedWeatherLocation] = useState(null);

    // Nearby Mills States
    const [nearbyMills, setNearbyMills] = useState([]);
    const [isSearchingMills, setIsSearchingMills] = useState(false);
    const [selectedCropForSearch, setSelectedCropForSearch] = useState(null);
    const [selectedMillForEnquiry, setSelectedMillForEnquiry] = useState(null);

    // All Verified Mills & Price Comparison
    const [allVerifiedMills, setAllVerifiedMills] = useState([]);
    const [selectedRateCrop, setSelectedRateCrop] = useState('ALL');
    const [marketRateMode, setMarketRateMode] = useState('MILL_RATES'); // 'MILL_RATES' or 'APMC'

    // Enquiry, QR, Transport & History States
    const [enquiries, setEnquiries] = useState([]);
    const [transportRequests, setTransportRequests] = useState([]);
    const [selectedEnquiryForQr, setSelectedEnquiryForQr] = useState(null);
    const [loadingEnquiries, setLoadingEnquiries] = useState(false);
    const [historyList, setHistoryList] = useState([]);
    const [historyFilter, setHistoryFilter] = useState('ALL');
    const [cropLightboxImage, setCropLightboxImage] = useState(null);

    // Payments & Settlements States
    const [loadsAndPayments, setLoadsAndPayments] = useState([]);
    const [loadingPayments, setLoadingPayments] = useState(false);
    const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState(null);
    const [paymentCategoryFilter, setPaymentCategoryFilter] = useState('ALL'); // 'ALL' | 'COMPLETED' | 'PENDING'
    const [farmerBankDetails, setFarmerBankDetails] = useState({
        accountHolder: user.name || 'Ramesh Reddy',
        bankName: 'State Bank of India',
        accountNumber: '308912445892',
        ifscCode: 'SBIN0004521',
        branchName: 'Suryapet Main Branch',
        upiId: `${user.phone || '9876543210'}@upi`,
        ocrExtracted: false,
        detailsConfirmed: false,
        ownershipVerified: false
    });
    const [isEditBankModalOpen, setIsEditBankModalOpen] = useState(false);
    const [editBankHolder, setEditBankHolder] = useState('');
    const [editBankName, setEditBankName] = useState('');
    const [editBankAccount, setEditBankAccount] = useState('');
    const [editBankIfsc, setEditBankIfsc] = useState('');
    const [editBankUpi, setEditBankUpi] = useState('');
    const [isSavingBank, setIsSavingBank] = useState(false);

    // AI Passbook OCR & Sandbox Testing States
    const [showPassbookScanner, setShowPassbookScanner] = useState(false);
    const [showSandboxPayoutModal, setShowSandboxPayoutModal] = useState(false);
    const [showRazorpayModal, setShowRazorpayModal] = useState(false);
    const [showAccountDigits, setShowAccountDigits] = useState(false);

    // Watch for location changes and update weather
    useEffect(() => {
        if (selectedWeatherLocation && selectedWeatherLocation.latitude && selectedWeatherLocation.longitude) {
            fetchWeatherByCoords(selectedWeatherLocation.latitude, selectedWeatherLocation.longitude).then(wData => {
                if (wData) {
                    wData.name = selectedWeatherLocation.locationName;
                    setWeather(wData);
                }
            });
        } else if (crops.length === 0) {
            fetchWeatherByCity('Hyderabad').then(wData => {
                if (wData) setWeather(wData);
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedWeatherLocation]);



    const fetchCrops = async () => {
        setLoadingCrops(true);
        try {
            const { data: fetchedCrops, error } = await supabase
                .from('crops')
                .select('*')
                .eq('user_phone', user.phone)
                .eq('user_role', user.role);

            if (error) throw error;

            if (fetchedCrops && fetchedCrops.length > 0) {
                const localCropImages = JSON.parse(localStorage.getItem('kisan_farmer_crop_images') || '{}');
                const mappedCrops = fetchedCrops.map(c => ({
                    id: c.id,
                    cropName: c.crop_name,
                    locationName: c.location_name,
                    latitude: c.latitude,
                    longitude: c.longitude,
                    acres: c.acres,
                    cropImage: c.crop_image || localCropImages[c.id] || localCropImages[`${c.crop_name}_${c.location_name}`] || '',
                    addedAt: c.added_at
                }));
                setCrops(mappedCrops);
                setSelectedCropForSearch(prev => {
                    const valid = prev && mappedCrops.some(mc => mc.id === prev.id);
                    const target = valid ? prev : mappedCrops[0];
                    if (target) handleSearchMills(target);
                    return target;
                });

                // Set initial weather location to latest crop
                const lastCrop = mappedCrops[mappedCrops.length - 1];
                setSelectedWeatherLocation(lastCrop);
            } else {
                setCrops([]);
                setSelectedCropForSearch(null);
                setSelectedWeatherLocation(null);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingCrops(false);
        }
    };

    const fetchEnquiriesData = async () => {
        setLoadingEnquiries(true);
        try {
            const list = await kisanService.getEnquiries({ farmerPhone: user.phone });
            setEnquiries(list);
            const reqs = kisanService.getTransportRequests({ farmerPhone: user.phone });
            setTransportRequests(reqs);
            const hist = await kisanService.getFarmerHistory(user.phone);
            setHistoryList(hist);
        } catch (e) {
            console.error("Error fetching farmer enquiries & history:", e);
        } finally {
            setLoadingEnquiries(false);
        }
    };

    const fetchAllVerifiedMills = async () => {
        try {
            const { data, error } = await supabase
                .from('mills')
                .select('*')
                .eq('status', 'verified');
            if (!error && data) {
                const mapped = data.map(m => ({
                    id: m.id,
                    ownerPhone: m.owner_phone,
                    millName: m.mill_name,
                    millType: m.mill_type,
                    capacity: m.capacity,
                    requirements: m.requirements,
                    selectedCrops: m.selectedCrops || [],
                    locationName: m.location_name,
                    latitude: m.latitude,
                    longitude: m.longitude,
                    hasColdStorage: m.has_cold_storage,
                    prices: m.prices || {},
                    status: m.status
                }));
                setAllVerifiedMills(mapped);
            }
        } catch (err) {
            console.error("Error fetching verified mills:", err);
        }
    };

    const fetchPaymentsData = async () => {
        setLoadingPayments(true);
        try {
            const list = await kisanService.getLoadsReceived({ farmerPhone: user.phone });
            setLoadsAndPayments(list);
            const bank = kisanService.getFarmerBankDetails(user.phone);
            setFarmerBankDetails(bank);
        } catch (err) {
            console.error("Error fetching farmer payments:", err);
        } finally {
            setLoadingPayments(false);
        }
    };

    const handleOpenEditBankModal = () => {
        setEditBankHolder(farmerBankDetails.accountHolder || profileName || user.name || '');
        setEditBankName(farmerBankDetails.bankName || 'State Bank of India');
        setEditBankAccount(farmerBankDetails.accountNumber || '');
        setEditBankIfsc(farmerBankDetails.ifscCode || '');
        setEditBankUpi(farmerBankDetails.upiId || `${user.phone}@upi`);
        setIsEditBankModalOpen(true);
    };

    const handleSaveBankDetails = (e) => {
        e.preventDefault();
        setIsSavingBank(true);
        try {
            const updated = kisanService.saveFarmerBankDetails(user.phone, {
                accountHolder: editBankHolder,
                bankName: editBankName,
                accountNumber: editBankAccount,
                ifscCode: editBankIfsc,
                upiId: editBankUpi
            });
            setFarmerBankDetails(updated);
            setIsEditBankModalOpen(false);
        } catch (err) {
            console.error("Error saving bank details:", err);
            alert("Failed to save bank details.");
        } finally {
            setIsSavingBank(false);
        }
    };

    useEffect(() => {
        fetchCrops();
        fetchEnquiriesData();
        fetchAllVerifiedMills();
        fetchPaymentsData();

        const handleStorageChange = (e) => {
            if (e.key === 'kisan_loads' || e.key === 'kisan_enquiries' || e.key === 'kisan_last_payment_event') {
                fetchPaymentsData();
                fetchEnquiriesData();
            }
        };
        window.addEventListener('storage', handleStorageChange);

        const unsub = kisanService.subscribe((event, payload) => {
            fetchCrops();
            fetchEnquiriesData();
            fetchAllVerifiedMills();
            fetchPaymentsData();

            if (event === 'crop_removed' || event === 'crops_changed') {
                if (payload?.cropId) {
                    setCrops(prev => prev.filter(c => c.id !== payload.cropId));
                    setSelectedCropForSearch(prev => (prev?.id === payload.cropId ? null : prev));
                } else if (payload?.cropName) {
                    setCrops(prev => prev.filter(c => c.cropName !== payload.cropName || (payload.locationName && c.locationName !== payload.locationName)));
                    setSelectedCropForSearch(prev => (prev?.cropName === payload.cropName ? null : prev));
                }
            }
        });

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            unsub();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSaveCrop = async (cropData) => {
        try {
            const dataToSave = {
                user_phone: user.phone,
                user_role: user.role,
                crop_name: cropData.cropName,
                location_name: cropData.locationName,
                latitude: cropData.latitude,
                longitude: cropData.longitude,
                acres: cropData.acres,
                added_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('crops')
                .insert(dataToSave)
                .select()
                .single();

            if (error) throw error;

            if (cropData.cropImage) {
                try {
                    const compressed = await compressImageFile(cropData.cropImage, 1000, 1000, 0.78);
                    const localCropImages = JSON.parse(localStorage.getItem('kisan_farmer_crop_images') || '{}');
                    localCropImages[data.id] = compressed;
                    localCropImages[`${data.crop_name}_${data.location_name}`] = compressed;
                    localStorage.setItem('kisan_farmer_crop_images', JSON.stringify(localCropImages));
                } catch (storageErr) {
                    console.warn("LocalStorage quota warning on save crop:", storageErr);
                }
            }

            const mappedNewCrop = {
                id: data.id,
                cropName: data.crop_name,
                locationName: data.location_name,
                latitude: data.latitude,
                longitude: data.longitude,
                acres: data.acres,
                cropImage: cropData.cropImage || '',
                addedAt: data.added_at
            };

            setCrops(prev => [...prev, mappedNewCrop]);
            setSelectedWeatherLocation(mappedNewCrop);
            setSelectedCropForSearch(mappedNewCrop);
            handleSearchMills(mappedNewCrop);
            alert(`Successfully saved crop: ${cropData.cropName} at ${cropData.locationName}`);
        } catch (error) {
            console.error(error);
            alert('Failed to save crop');
        }
    };

    const handleUpdateCropImage = async (cropId, imageDataUrlOrFile) => {
        try {
            let processedImage = '';
            if (imageDataUrlOrFile) {
                processedImage = await compressImageFile(imageDataUrlOrFile, 1000, 1000, 0.78);
            }

            // 1. Immediately update React state for instant UI responsiveness
            setCrops(prev => prev.map(c => c.id === cropId ? { ...c, cropImage: processedImage } : c));
            if (selectedCropForSearch?.id === cropId) {
                setSelectedCropForSearch(prev => ({ ...prev, cropImage: processedImage }));
            }

            // Update lightbox if open
            if (cropLightboxImage && cropLightboxImage.cropId === cropId) {
                if (processedImage) {
                    setCropLightboxImage(prev => ({ ...prev, url: processedImage }));
                } else {
                    setCropLightboxImage(null);
                }
            }

            // 2. Safely persist in LocalStorage with quota protection
            try {
                const localCropImages = JSON.parse(localStorage.getItem('kisan_farmer_crop_images') || '{}');
                const targetCrop = crops.find(c => c.id === cropId);
                if (processedImage) {
                    localCropImages[cropId] = processedImage;
                    if (targetCrop) {
                        localCropImages[`${targetCrop.cropName}_${targetCrop.locationName}`] = processedImage;
                    }
                } else {
                    delete localCropImages[cropId];
                    if (targetCrop) {
                        delete localCropImages[`${targetCrop.cropName}_${targetCrop.locationName}`];
                    }
                }
                localStorage.setItem('kisan_farmer_crop_images', JSON.stringify(localCropImages));
            } catch (storageErr) {
                console.warn("LocalStorage quota reached, pruning old keys:", storageErr);
                try {
                    const fallbackObj = {};
                    if (processedImage) fallbackObj[cropId] = processedImage;
                    localStorage.setItem('kisan_farmer_crop_images', JSON.stringify(fallbackObj));
                } catch (cleanErr) {
                    // Safe fallback
                }
            }

            // 3. Update Supabase if connected
            try {
                if (supabase) {
                    await supabase.from('crops').update({ crop_image: processedImage || null }).eq('id', cropId);
                }
            } catch (supaErr) {
                console.warn("Supabase photo update warning:", supaErr);
            }
        } catch (err) {
            console.error("Error updating crop photo:", err);
        }
    };

    const handleDeleteCrop = async (id) => {
        if (!window.confirm("Are you sure you want to delete this crop?")) return;
        try {
            const { error } = await supabase
                .from('crops')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setCrops(prev => prev.filter(c => c.id !== id));
        } catch (error) {
            console.error(error);
            alert("Error deleting crop");
        }
    };

    const handleSearchMills = async (crop) => {
        setSelectedCropForSearch(crop);
        setIsSearchingMills(true);
        try {
            const { data: allMills, error } = await supabase
                .from('mills')
                .select('*')
                .eq('status', 'verified')
                .contains('selectedCrops', [crop.cropName]);

            if (error) throw error;

            const mappedMills = (allMills || []).map(m => ({
                id: m.id,
                ownerPhone: m.owner_phone,
                millName: m.mill_name,
                millType: m.mill_type,
                capacity: m.capacity,
                requirements: m.requirements,
                selectedCrops: m.selectedCrops,
                locationName: m.location_name,
                latitude: m.latitude,
                longitude: m.longitude,
                hasColdStorage: m.has_cold_storage,
                prices: m.prices,
                status: m.status,
                addedAt: m.created_at
            }));

            const withDistance = mappedMills.map(mill => {
                const dist = (crop?.latitude && mill?.latitude)
                    ? calculateDistance(crop.latitude, crop.longitude, mill.latitude, mill.longitude)
                    : 0;
                return {
                    ...mill,
                    distance: dist
                };
            }).sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));

            setNearbyMills(withDistance);
        } catch (error) {
            console.error("Error searching mills:", error);
        } finally {
            setIsSearchingMills(false);
        }
    };

    const handleAcceptTransportQuote = (quoteId) => {
        kisanService.acceptTransportQuote(quoteId, 'farmers');
        alert("Transport quote accepted! The hauler has been assigned to your load.");
        fetchEnquiriesData();
    };

    // Filter accepted enquiries with QR codes available (Must be fully confirmed)
    const acceptedEnquiries = useMemo(() => {
        return enquiries.filter(e => {
            const s = (e.status || '').toUpperCase();
            const os = (e.overall_status || '').toUpperCase();
            const ms = (e.mill_status || '').toUpperCase();
            const ts = (e.transport_status || '').toUpperCase();
            if (s === 'LOAD_RECEIVED' || e.load_status === 'LOAD_RECEIVED') return true;
            if (os === 'CONFIRMED') return true;
            const hasTransport = Boolean(e.transport_required || e.with_transport);
            if (!hasTransport && (s === 'ACCEPTED' || ms === 'ACCEPTED')) return true;
            if (hasTransport && (s === 'ACCEPTED' || ms === 'ACCEPTED') && ts === 'ACCEPTED') return true;
            return false;
        });
    }, [enquiries]);

    // Calculate mill rates suitable for farmer crops, sorted with highest price first
    const farmerCropNames = useMemo(() => {
        return Array.from(new Set(crops.map(c => c.cropName).filter(Boolean)));
    }, [crops]);

    const millOffersByCrop = useMemo(() => {
        const targetCropsForRates = (farmerCropNames.length > 0)
            ? (selectedRateCrop === 'ALL' ? farmerCropNames : [selectedRateCrop])
            : (selectedRateCrop === 'ALL' ? ['Paddy (Rice)', 'Maize', 'Cotton', 'Red Gram'] : [selectedRateCrop]);

        return targetCropsForRates.map(cropName => {
            const farmerCropObj = crops.find(c => c.cropName === cropName);
            const referenceCrop = farmerCropObj || selectedCropForSearch || crops[0];
            const suitableMills = allVerifiedMills.filter(m => 
                Array.isArray(m.selectedCrops) && m.selectedCrops.includes(cropName)
            );

            const offers = suitableMills.map(mill => {
                const rawPrice = mill.prices?.[cropName];
                const price = Number(rawPrice) || (
                    cropName === 'Paddy (Rice)' ? 2450 :
                    cropName === 'Cotton' ? 7100 :
                    cropName === 'Maize' ? 2100 :
                    cropName === 'Red Gram' ? 6800 : 2500
                );
                const dist = (referenceCrop?.latitude && mill.latitude)
                    ? calculateDistance(referenceCrop.latitude, referenceCrop.longitude, mill.latitude, mill.longitude)
                    : 0;

                return {
                    mill,
                    cropName,
                    price,
                    isCustomRate: Boolean(rawPrice),
                    distance: dist,
                    farmerCrop: referenceCrop || { cropName }
                };
            });

            // Sort HIGHEST PRICE FIRST!
            offers.sort((a, b) => b.price - a.price);

            return {
                cropName,
                farmerCrop: referenceCrop,
                highestPrice: offers[0]?.price || 0,
                offers
            };
        }).filter(group => group.offers.length > 0);
    }, [farmerCropNames, selectedRateCrop, crops, allVerifiedMills]);

    const cropCountText = crops.length > 1 ? `${crops.length} Lots` : crops.length === 1 ? crops[0].cropName : '0 Lots';
    const cropLocationText = crops.length > 1 ? `${crops[crops.length - 1].cropName} & more` : crops.length === 1 ? crops[0].locationName : 'Add crops to track';
    const locationStatusClass = crops.length > 0 ? 'trend up' : 'trend neutral';

    return (
        <div className="app-container" style={{ display: 'flex' }}>
            {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>}

            {/* Sidebar */}
            <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
                <div className="logo" style={{ marginBottom: '2rem' }}>
                    <KisanLogo size="md" />
                </div>

                <nav className="nav-menu">
                    <a className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}>
                        <i className="fa-solid fa-house"></i>
                        <span>{t('dashboard')}</span>
                    </a>
                    <a className={`nav-item ${activeTab === 'crops' || activeTab === 'mills' ? 'active' : ''}`} onClick={() => { setActiveTab('crops'); setIsSidebarOpen(false); }}>
                        <i className="fa-solid fa-seedling"></i>
                        <span>{t('cropsAndMills', 'My Crops & Nearby Mills')}</span>
                        {crops.length > 0 && (
                            <span className="nav-badge" style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.1)', color: '#fff', padding: '0.1rem 0.5rem', borderRadius: '1rem', fontSize: '0.75rem' }}>
                                {crops.length}
                            </span>
                        )}
                    </a>
                    <a className={`nav-item ${activeTab === 'enquiries' ? 'active' : ''}`} onClick={() => { setActiveTab('enquiries'); setIsSidebarOpen(false); }}>
                        <i className="fa-solid fa-paper-plane"></i>
                        <span>{t('enquiries')}</span>
                        {enquiries.length > 0 && (
                            <span className="nav-badge" style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.1)', color: '#fff', padding: '0.1rem 0.5rem', borderRadius: '1rem', fontSize: '0.75rem' }}>
                                {enquiries.length}
                            </span>
                        )}
                    </a>
                    <a className={`nav-item ${activeTab === 'qrcodes' ? 'active' : ''}`} onClick={() => { setActiveTab('qrcodes'); setIsSidebarOpen(false); }}>
                        <i className="fa-solid fa-qrcode" style={{ color: 'var(--primary)' }}></i>
                        <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{t('qrcodes')}</span>
                        {acceptedEnquiries.length > 0 && (
                            <span className="nav-badge" style={{ marginLeft: 'auto', background: 'var(--primary)', color: '#000', padding: '0.1rem 0.5rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 800 }}>
                                {acceptedEnquiries.length}
                            </span>
                        )}
                    </a>
                    <a className={`nav-item ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => { setActiveTab('payments'); setIsSidebarOpen(false); }}>
                        <i className="fa-solid fa-wallet"></i>
                        <span>{t('payments')}</span>
                        {loadsAndPayments.filter(p => (p.payment_status || 'PENDING').toUpperCase() === 'COMPLETED').length > 0 && (
                            <span className="nav-badge" style={{ marginLeft: 'auto', background: 'var(--primary)', color: '#000', padding: '0.1rem 0.5rem', borderRadius: '1rem', fontSize: '0.72rem', fontWeight: 800 }}>
                                {loadsAndPayments.filter(p => (p.payment_status || 'PENDING').toUpperCase() === 'COMPLETED').length} Paid
                            </span>
                        )}
                    </a>
                    <a className={`nav-item ${activeTab === 'loadstatus' ? 'active' : ''}`} onClick={() => { setActiveTab('loadstatus'); setIsSidebarOpen(false); }}>
                        <i className="fa-solid fa-timeline"></i>
                        <span>{t('loadstatus')}</span>
                    </a>
                    <a className={`nav-item ${activeTab === 'transport' ? 'active' : ''}`} onClick={() => { setActiveTab('transport'); setIsSidebarOpen(false); }}>
                        <i className="fa-solid fa-truck-fast"></i>
                        <span>{t('transport')}</span>
                    </a>
                    <a className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => { setActiveTab('history'); setIsSidebarOpen(false); }}>
                        <i className="fa-solid fa-clock-rotate-left"></i>
                        <span>{t('history')}</span>
                    </a>
                    <a className={`nav-item ${activeTab === 'market' ? 'active' : ''}`} onClick={() => { setActiveTab('market'); setIsSidebarOpen(false); }}>
                        <i className="fa-solid fa-chart-line"></i>
                        <span>{t('market')}</span>
                    </a>
                    <a className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => { setActiveTab('profile'); setIsSidebarOpen(false); }}>
                        <i className="fa-solid fa-user-gear"></i>
                        <span>{t('profile')}</span>
                    </a>
                </nav>

                <div className="sidebar-bottom">
                    <a className="nav-item logout" onClick={handleLogout}>
                        <i className="fa-solid fa-arrow-right-from-bracket"></i>
                        <span>{t('logout')}</span>
                    </a>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                {/* Header */}
                <header className="top-header">
                    <div className="header-left">
                        <button className="menu-toggle" onClick={() => setIsSidebarOpen(true)}>
                            <i className="fa-solid fa-bars"></i>
                        </button>
                        <button className="action-btn back-btn" onClick={handleBack} title="Back to Previous Page">
                            <i className="fa-solid fa-arrow-left"></i>
                        </button>
                        <div className="search-bar">
                            <i className="fa-solid fa-search"></i>
                            <input type="text" placeholder="Search crops, prices, enquiries..." />
                        </div>
                    </div>

                    <div className="header-actions" style={{ alignItems: 'center', gap: '0.85rem' }}>
                        {/* Language Selector in Header */}
                        <LanguageSelector />

                        {acceptedEnquiries.length > 0 && (
                            <button 
                                className="primary-btn" 
                                onClick={() => setActiveTab('qrcodes')}
                                style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', borderRadius: '0.75rem' }}
                            >
                                <i className="fa-solid fa-qrcode"></i>
                                {t('viewQr')} ({acceptedEnquiries.length})
                            </button>
                        )}

                        <HeaderClock />

                        <div className="user-profile" onClick={() => setActiveTab('profile')} style={{ cursor: 'pointer' }} title="View Farmer Profile">
                            <div className="profile-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', color: 'var(--primary)', fontSize: '1.5rem', width: '42px', height: '42px', borderRadius: '50%' }}>
                                <i className="fa-solid fa-user"></i>
                            </div>
                            <div className="user-info">
                                <h4>{profileName || user.phone}</h4>
                                <p>Verified Farmer</p>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="dashboard-content" style={{ padding: '2rem 1.5rem' }}>

                    {/* ======================================================== */}
                    {/* TAB: DASHBOARD */}
                    {/* ======================================================== */}
                    {activeTab === 'dashboard' && (
                        <div className="dashboard view-section" style={{ display: 'block' }}>
                            <div className="welcome-section">
                                <div>
                                    <h1>{t('goodDay')}, {profileName || 'Kisan'}! 🌾</h1>
                                    <p>{t('welcomeSub')}</p>
                                </div>
                                <button className="primary-btn" onClick={() => setIsAddCropOpen(true)}>
                                    <i className="fa-solid fa-plus"></i> {t('addNewCrop')}
                                </button>
                            </div>

                            <div className="stats-grid">
                                <div className="stat-card">
                                    <div className="stat-icon crops"><i className="fa-solid fa-wheat-awn"></i></div>
                                    <div className="stat-details">
                                        <h3>{t('activeCrops')}</h3>
                                        <h2>{cropCountText}</h2>
                                        <span className={locationStatusClass}>{cropLocationText}</span>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon orders"><i className="fa-solid fa-paper-plane"></i></div>
                                    <div className="stat-details">
                                        <h3>{t('sentEnquiries')}</h3>
                                        <h2>{enquiries.length}</h2>
                                        <span className="trend neutral">{enquiries.filter(e => e.status === 'ACCEPTED').length} Accepted</span>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon revenue"><i className="fa-solid fa-qrcode"></i></div>
                                    <div className="stat-details">
                                        <h3>{t('verificationQrs')}</h3>
                                        <h2>{acceptedEnquiries.length} Ready</h2>
                                        <span className="trend up">{t('readyForDelivery')}</span>
                                    </div>
                                </div>
                                <div className="stat-card" onClick={() => setActiveTab('payments')} style={{ cursor: 'pointer' }}>
                                    <div className="stat-icon revenue" style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--primary)' }}><i className="fa-solid fa-wallet"></i></div>
                                    <div className="stat-details">
                                        <h3>{t('directPayments')}</h3>
                                        <h2>₹{loadsAndPayments.filter(p => (p.payment_status || 'PENDING').toUpperCase() === 'COMPLETED').reduce((sum, p) => sum + (Number(p.total_amount || p.price) || 0), 0).toLocaleString('en-IN')}</h2>
                                        <span className="trend up">
                                            {loadsAndPayments.filter(p => (p.payment_status || 'PENDING').toUpperCase() === 'COMPLETED').length} {t('settlementsReceived')}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Active QR Quick Access Card */}
                            {acceptedEnquiries.length > 0 && (
                                <div className="bento-card" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(245, 158, 11, 0.1) 100%)', border: '1px solid var(--primary)', marginBottom: '2rem', padding: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                                        <div>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                                                GATE DELIVERY READY
                                            </span>
                                            <h3 style={{ margin: '0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <i className="fa-solid fa-qrcode" style={{ color: 'var(--primary)' }}></i>
                                                Enquiry {acceptedEnquiries[0].enquiry_code} Accepted!
                                            </h3>
                                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                {acceptedEnquiries[0].mill_name} accepted your {acceptedEnquiries[0].crop_name} load. Present your QR at the mill gate.
                                            </p>
                                        </div>
                                        <button className="primary-btn" onClick={() => setSelectedEnquiryForQr(acceptedEnquiries[0])} style={{ padding: '0.75rem 1.25rem' }}>
                                            <i className="fa-solid fa-qrcode"></i> Show Verification QR
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Weather & Live Prices Grid */}
                            <div className="bento-grid">
                                <div className="bento-card weather-card">
                                    <div className="card-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
                                        <h3 style={{ marginBottom: '-0.5rem' }}>Farm Weather</h3>
                                        <div className="location-selector" style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.5rem 1rem', borderRadius: '0.5rem' }}>
                                            <i className="fa-solid fa-location-dot" style={{ color: 'var(--primary)' }}></i>
                                            <select
                                                value={selectedWeatherLocation?.id || ''}
                                                onChange={(e) => setSelectedWeatherLocation(crops.find(c => c.id === e.target.value))}
                                                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'inherit', color: 'var(--text)', flex: 1, cursor: 'pointer', fontSize: '0.95rem' }}
                                            >
                                                {crops.length === 0 ? (
                                                    <option value="" disabled style={{ color: '#000', background: '#fff' }}>Hyderabad (Default)</option>
                                                ) : (
                                                    crops.map(c => (
                                                        <option key={c.id} value={c.id} style={{ color: '#000', background: '#fff' }}>{c.cropName} - {c.locationName}</option>
                                                    ))
                                                )}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="current-weather">
                                        <i className={`fa-solid ${getWeatherIcon(weather?.weather[0]?.id || 800)}`} style={{ fontSize: '3rem', color: '#ffb300' }}></i>
                                        <div className="temp">
                                            <h2>{weather ? `${Math.round(weather.main.temp)}°C` : '--'}</h2>
                                            <p>{weather?.weather[0]?.main || '--'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bento-card market-prices" style={{ display: 'flex', flexDirection: 'column' }}>
                                    {/* Card Header with Mode Toggle and View All */}
                                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Live Mill Buying Rates 💰</h3>
                                                <span className="status-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--primary)', fontSize: '0.7rem', padding: '0.15rem 0.5rem', fontWeight: 800 }}>
                                                    HIGHEST PRICES
                                                </span>
                                            </div>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0.2rem 0 0 0' }}>
                                                {farmerCropNames.length > 0 ? 'Mills matched to your crops, ranked by highest offer' : 'Verified mill prices ranked by highest rate'}
                                            </p>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.06)', borderRadius: '0.5rem', padding: '0.15rem' }}>
                                                <button 
                                                    onClick={() => setMarketRateMode('MILL_RATES')}
                                                    style={{ 
                                                        background: marketRateMode === 'MILL_RATES' ? 'var(--primary)' : 'transparent', 
                                                        color: marketRateMode === 'MILL_RATES' ? '#000' : 'var(--text-muted)',
                                                        border: 'none', 
                                                        padding: '0.3rem 0.65rem', 
                                                        borderRadius: '0.4rem', 
                                                        fontSize: '0.75rem', 
                                                        fontWeight: 700, 
                                                        cursor: 'pointer' 
                                                    }}
                                                >
                                                    <i className="fa-solid fa-industry"></i> Mill Rates
                                                </button>
                                                <button 
                                                    onClick={() => setMarketRateMode('APMC')}
                                                    style={{ 
                                                        background: marketRateMode === 'APMC' ? 'var(--primary)' : 'transparent', 
                                                        color: marketRateMode === 'APMC' ? '#000' : 'var(--text-muted)',
                                                        border: 'none', 
                                                        padding: '0.3rem 0.65rem', 
                                                        borderRadius: '0.4rem', 
                                                        fontSize: '0.75rem', 
                                                        fontWeight: 700, 
                                                        cursor: 'pointer' 
                                                    }}
                                                >
                                                    <i className="fa-solid fa-chart-line"></i> APMC
                                                </button>
                                            </div>
                                            <button className="text-btn" onClick={() => setActiveTab('market')} style={{ fontSize: '0.8rem', padding: '0.3rem' }}>
                                                View All
                                            </button>
                                        </div>
                                    </div>

                                    {/* Filter by Farmer's Crops (if farmer has multiple crops) */}
                                    {marketRateMode === 'MILL_RATES' && farmerCropNames.length > 1 && (
                                        <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.4rem', marginBottom: '0.5rem' }}>
                                            <button
                                                onClick={() => setSelectedRateCrop('ALL')}
                                                style={{
                                                    padding: '0.25rem 0.65rem',
                                                    fontSize: '0.75rem',
                                                    borderRadius: '1rem',
                                                    background: selectedRateCrop === 'ALL' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                                                    color: selectedRateCrop === 'ALL' ? 'var(--primary)' : 'var(--text-muted)',
                                                    border: selectedRateCrop === 'ALL' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                                    cursor: 'pointer',
                                                    whiteSpace: 'nowrap',
                                                    fontWeight: 700
                                                }}
                                            >
                                                All My Crops ({farmerCropNames.length})
                                            </button>
                                            {farmerCropNames.map(cName => (
                                                <button
                                                    key={cName}
                                                    onClick={() => setSelectedRateCrop(cName)}
                                                    style={{
                                                        padding: '0.25rem 0.65rem',
                                                        fontSize: '0.75rem',
                                                        borderRadius: '1rem',
                                                        background: selectedRateCrop === cName ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                                                        color: selectedRateCrop === cName ? 'var(--primary)' : 'var(--text-muted)',
                                                        border: selectedRateCrop === cName ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                                        cursor: 'pointer',
                                                        whiteSpace: 'nowrap',
                                                        fontWeight: 700
                                                    }}
                                                >
                                                    {cName}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Content: Best Mill Offers */}
                                    {marketRateMode === 'MILL_RATES' ? (
                                        <div className="prices-list" style={{ marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '380px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                                            {millOffersByCrop.length === 0 ? (
                                                <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                    <i className="fa-solid fa-industry fa-2x" style={{ opacity: 0.3, marginBottom: '0.5rem' }}></i>
                                                    <div>No mills currently buying this crop.</div>
                                                    <button className="action-btn" onClick={() => setSelectedRateCrop('ALL')} style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
                                                        Show All Mills
                                                    </button>
                                                </div>
                                            ) : (
                                                millOffersByCrop.map(group => (
                                                    <div key={group.cropName} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '0.75rem', padding: '0.85rem' }}>
                                                        {/* Crop Title with Highest Rate Highlight */}
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem', marginBottom: '0.65rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                <span style={{ fontSize: '1.05rem' }}>🌾</span>
                                                                <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{group.cropName}</strong>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Top Offer:</span>
                                                                <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.95rem' }}>
                                                                    ₹{group.highestPrice.toLocaleString('en-IN')}/Qtl
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Mills list sorted by price descending */}
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                            {group.offers.map((offer, idx) => {
                                                                const isTop = idx === 0;
                                                                return (
                                                                    <div 
                                                                        key={offer.mill.id}
                                                                        style={{ 
                                                                            display: 'flex', 
                                                                            justifyContent: 'space-between', 
                                                                            alignItems: 'center', 
                                                                            padding: '0.6rem 0.75rem', 
                                                                            borderRadius: '0.5rem', 
                                                                            background: isTop ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255,255,255,0.03)',
                                                                            border: isTop ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(255,255,255,0.04)',
                                                                            boxShadow: isTop ? '0 0 12px rgba(16, 185, 129, 0.1)' : 'none'
                                                                        }}
                                                                    >
                                                                        <div style={{ flex: 1, minWidth: 0, marginRight: '0.5rem' }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                                                                <strong style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>
                                                                                    {offer.mill.millName}
                                                                                </strong>
                                                                                {isTop && (
                                                                                    <span style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000', fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '0.3rem', fontWeight: 800, letterSpacing: '0.3px' }}>
                                                                                        👑 HIGHEST PRICE
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                                                                <i className="fa-solid fa-location-dot"></i> {offer.mill.locationName || 'Nearby Mill'} • ~{offer.distance.toFixed(1)} km
                                                                            </div>
                                                                        </div>

                                                                        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                                            <div>
                                                                                <div style={{ fontWeight: 800, fontSize: '1rem', color: isTop ? 'var(--primary)' : 'var(--accent-gold)' }}>
                                                                                    ₹{offer.price.toLocaleString('en-IN')}
                                                                                </div>
                                                                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>per quintal</div>
                                                                            </div>

                                                                            <button
                                                                                className="primary-btn"
                                                                                onClick={() => {
                                                                                    setSelectedMillForEnquiry({ ...offer.mill, distance: offer.distance });
                                                                                    setSelectedCropForSearch(offer.farmerCrop);
                                                                                }}
                                                                                style={{ 
                                                                                    padding: '0.4rem 0.75rem', 
                                                                                    fontSize: '0.75rem', 
                                                                                    fontWeight: 700,
                                                                                    background: isTop ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                                                                                    color: isTop ? '#000' : 'var(--text-main)',
                                                                                    border: isTop ? 'none' : '1px solid rgba(255,255,255,0.1)'
                                                                                }}
                                                                            >
                                                                                Send Enquiry
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    ) : (
                                        /* APMC Mandi Benchmark Rates View */
                                        <div className="prices-list" style={{ marginTop: '0.5rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.8rem 0', borderBottom: '1px solid var(--border-color)' }}>
                                                <div>
                                                    <div style={{ fontWeight: 600 }}>Paddy (Rice)</div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Khammam APMC</div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>₹2,250</div>
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>+2.5%</span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.8rem 0', borderBottom: '1px solid var(--border-color)' }}>
                                                <div>
                                                    <div style={{ fontWeight: 600 }}>Maize</div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Nizamabad Mandi</div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>₹1,960</div>
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>-1.2%</span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.8rem 0', borderBottom: '1px solid var(--border-color)' }}>
                                                <div>
                                                    <div style={{ fontWeight: 600 }}>Cotton</div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Adoni APMC</div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>₹7,100</div>
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>+0.8%</span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.8rem 0' }}>
                                                <div>
                                                    <div style={{ fontWeight: 600 }}>Red Gram</div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Tandur Mandi</div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>₹7,000</div>
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>+1.5%</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ======================================================== */}
                    {/* TAB: MY CROPS & NEARBY MILLS (USER-FRIENDLY MASTER-DETAIL) */}
                    {/* ======================================================== */}
                    {(activeTab === 'crops' || activeTab === 'mills') && (() => {
                        const totalFarmlandAcres = crops.reduce((acc, c) => acc + (parseFloat(c.acres) || 0), 0);
                        const uniqueCrops = Array.from(new Set(crops.map(c => c.cropName))).filter(Boolean);

                        return (
                            <div className="dashboard view-section" style={{ display: 'block' }}>
                                {/* Top Header & Compact Metrics */}
                                <div className="welcome-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                            <h1 style={{ margin: 0, fontSize: '1.7rem', fontWeight: 800 }}>My Crops & Nearby Mills</h1>
                                            <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--primary)', padding: '0.2rem 0.65rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 700 }}>
                                                Direct Mill Gate
                                            </span>
                                        </div>
                                        <p style={{ margin: '0.35rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                                            Select any farmland to find verified processing mills offering the highest purchase rates.
                                        </p>
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                        {crops.length > 0 && (
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', background: 'rgba(255,255,255,0.04)', padding: '0.4rem 0.85rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.82rem' }}>
                                                <span style={{ color: 'var(--text-muted)' }}>Farmland:</span>
                                                <strong style={{ color: 'var(--text-main)' }}>{totalFarmlandAcres.toFixed(1)} Ac ({crops.length} Lots)</strong>
                                                <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
                                                <span style={{ color: 'var(--text-muted)' }}>Est. Yield:</span>
                                                <strong style={{ color: 'var(--primary)' }}>~{(totalFarmlandAcres * 20).toFixed(0)} Qtl</strong>
                                            </div>
                                        )}
                                        <button 
                                            className="action-btn" 
                                            onClick={fetchCrops} 
                                            title="Refresh Crops & Mills" 
                                            style={{ padding: '0.5rem 0.85rem', fontSize: '0.82rem' }}
                                        >
                                            <i className={`fa-solid fa-arrows-rotate ${loadingCrops ? 'fa-spin' : ''}`}></i>
                                        </button>
                                        <button 
                                            className="primary-btn" 
                                            onClick={() => setIsAddCropOpen(true)} 
                                            style={{ padding: '0.5rem 1.1rem', fontSize: '0.82rem' }}
                                        >
                                            <i className="fa-solid fa-plus"></i> Add Farmland
                                        </button>
                                    </div>
                                </div>

                                {/* TOP SECTION: Horizontal My Farmlands */}
                                <div className="bento-card" style={{ padding: '1.35rem', marginBottom: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <i className="fa-solid fa-seedling" style={{ color: 'var(--primary)' }}></i>
                                                <span>My Farmlands ({crops.length})</span>
                                            </h3>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                Click any farmland below to view and match verified buyer mills below
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button 
                                                className="action-btn" 
                                                onClick={fetchCrops} 
                                                title="Refresh Farmlands" 
                                                style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
                                            >
                                                <i className={`fa-solid fa-arrows-rotate ${loadingCrops ? 'fa-spin' : ''}`}></i>
                                            </button>
                                            <button 
                                                className="primary-btn" 
                                                onClick={() => setIsAddCropOpen(true)} 
                                                style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
                                            >
                                                <i className="fa-solid fa-plus"></i> Add Farmland
                                            </button>
                                        </div>
                                    </div>

                                    {loadingCrops ? (
                                        <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                            <i className="fa-solid fa-spinner fa-spin" style={{ color: 'var(--primary)', marginRight: '0.5rem' }}></i>
                                            Loading farmlands...
                                        </div>
                                    ) : crops.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '0.85rem', border: '1px dashed rgba(255,255,255,0.1)' }}>
                                            <i className="fa-solid fa-seedling fa-2x" style={{ color: 'var(--primary)', marginBottom: '0.75rem', opacity: 0.8 }}></i>
                                            <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '1.1rem' }}>No Farmlands Added Yet</h4>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 1.25rem 0' }}>
                                                Register your farmland crops with acreage and photos to automatically discover verified buyer mills.
                                            </p>
                                            <button className="primary-btn" onClick={() => setIsAddCropOpen(true)} style={{ fontSize: '0.85rem', padding: '0.55rem 1.25rem' }}>
                                                <i className="fa-solid fa-plus"></i> Add First Crop
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="crops-horizontal-container">
                                            {crops.map(c => {
                                                const isSelected = selectedCropForSearch?.id === c.id;
                                                const estYield = (parseFloat(c.acres) || 0) * 20;
                                                return (
                                                    <div 
                                                        key={c.id} 
                                                        className={`farmland-card-horizontal ${isSelected ? 'active' : ''}`}
                                                        onClick={() => {
                                                            handleSearchMills(c);
                                                            const millsEl = document.getElementById('matching-mills-section');
                                                            if (millsEl) {
                                                                millsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                                            }
                                                        }}
                                                    >
                                                        {/* Large Farmland Image Banner */}
                                                        {c.cropImage ? (
                                                            <div style={{ position: 'relative', width: '100%', height: '155px', overflow: 'hidden', background: '#0a1a12' }}>
                                                                <img 
                                                                    src={c.cropImage} 
                                                                    alt={c.cropName} 
                                                                    style={{ 
                                                                        width: '100%', 
                                                                        height: '100%', 
                                                                        objectFit: 'cover', 
                                                                        cursor: 'pointer',
                                                                        display: 'block'
                                                                    }} 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setCropLightboxImage({ url: c.cropImage, title: `${c.cropName} (${c.locationName}) - Farmland Plot Photo`, cropId: c.id });
                                                                    }}
                                                                    title="Click to view full photo"
                                                                />
                                                                <div style={{ position: 'absolute', inset: '0', background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 45%, rgba(0,0,0,0.7) 100%)', pointerEvents: 'none' }} />

                                                                {/* Acreage Floating Pill */}
                                                                <div style={{ 
                                                                    position: 'absolute', 
                                                                    top: '8px', 
                                                                    left: '8px', 
                                                                    background: 'rgba(0, 0, 0, 0.78)', 
                                                                    backdropFilter: 'blur(6px)',
                                                                    border: '1px solid rgba(255,255,255,0.2)',
                                                                    color: '#fff', 
                                                                    fontSize: '0.74rem', 
                                                                    fontWeight: 700, 
                                                                    padding: '0.22rem 0.6rem', 
                                                                    borderRadius: '1rem',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.3rem',
                                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                                                                }}>
                                                                    <i className="fa-solid fa-layer-group" style={{ color: 'var(--primary)', fontSize: '0.7rem' }}></i>
                                                                    <span>{c.acres} Acres</span>
                                                                </div>

                                                                {/* Re-upload / Change & Remove Photo Controls */}
                                                                <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', alignItems: 'center', gap: '0.35rem', zIndex: 2 }}>
                                                                    <label 
                                                                        onClick={(e) => e.stopPropagation()} 
                                                                        style={{ 
                                                                            background: 'rgba(0,0,0,0.78)', 
                                                                            backdropFilter: 'blur(6px)',
                                                                            border: '1px solid rgba(255,255,255,0.25)',
                                                                            color: 'var(--accent-gold)', 
                                                                            padding: '0.22rem 0.55rem', 
                                                                            borderRadius: '1rem', 
                                                                            display: 'flex', 
                                                                            alignItems: 'center', 
                                                                            gap: '0.3rem', 
                                                                            cursor: 'pointer', 
                                                                            fontSize: '0.7rem',
                                                                            fontWeight: 600,
                                                                            boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                                                                        }}
                                                                        title="Re-upload / replace crop photo"
                                                                    >
                                                                        <i className="fa-solid fa-arrows-rotate"></i>
                                                                        <span>Re-upload</span>
                                                                        <input 
                                                                            type="file" 
                                                                            accept="image/*" 
                                                                            capture="environment" 
                                                                            style={{ display: 'none' }} 
                                                                            onChange={(e) => {
                                                                                if (e.target.files && e.target.files[0]) {
                                                                                    const file = e.target.files[0];
                                                                                    e.target.value = '';
                                                                                    handleUpdateCropImage(c.id, file);
                                                                                }
                                                                            }}
                                                                        />
                                                                    </label>

                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (window.confirm("Remove this crop photo? You can re-upload a new photo anytime.")) {
                                                                                handleUpdateCropImage(c.id, '');
                                                                            }
                                                                        }}
                                                                        style={{
                                                                            background: 'rgba(0,0,0,0.78)',
                                                                            backdropFilter: 'blur(6px)',
                                                                            border: '1px solid rgba(239, 68, 68, 0.45)',
                                                                            color: '#ff6b6b',
                                                                            width: '26px',
                                                                            height: '26px',
                                                                            borderRadius: '50%',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            cursor: 'pointer',
                                                                            fontSize: '0.7rem',
                                                                            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                                                                            padding: 0
                                                                        }}
                                                                        title="Remove wrong photo"
                                                                    >
                                                                        <i className="fa-solid fa-trash-can"></i>
                                                                    </button>
                                                                </div>

                                                                {/* Tap to Enlarge Indicator */}
                                                                <div 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setCropLightboxImage({ url: c.cropImage, title: `${c.cropName} (${c.locationName}) - Farmland Plot Photo`, cropId: c.id });
                                                                    }}
                                                                    style={{
                                                                        position: 'absolute',
                                                                        bottom: '8px',
                                                                        right: '8px',
                                                                        background: 'rgba(0,0,0,0.68)',
                                                                        backdropFilter: 'blur(4px)',
                                                                        color: '#fff',
                                                                        borderRadius: '0.4rem',
                                                                        padding: '0.18rem 0.45rem',
                                                                        fontSize: '0.68rem',
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.25rem',
                                                                        border: '1px solid rgba(255,255,255,0.15)'
                                                                    }}
                                                                >
                                                                    <i className="fa-solid fa-magnifying-glass-plus"></i> View Full
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            /* Empty Photo Dropzone Banner */
                                                            <label 
                                                                onClick={(e) => e.stopPropagation()} 
                                                                style={{ 
                                                                    width: '100%', 
                                                                    height: '110px', 
                                                                    display: 'flex', 
                                                                    flexDirection: 'column', 
                                                                    alignItems: 'center', 
                                                                    justifyContent: 'center', 
                                                                    cursor: 'pointer', 
                                                                    background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(16,185,129,0.06) 100%)',
                                                                    borderBottom: '1px dashed rgba(255,255,255,0.12)',
                                                                    color: 'var(--text-muted)',
                                                                    gap: '0.35rem'
                                                                }}
                                                                title="Upload or take crop photo"
                                                            >
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 600 }}>
                                                                    <i className="fa-solid fa-camera"></i>
                                                                    <span>+ Add Crop Photo</span>
                                                                </div>
                                                                <span style={{ fontSize: '0.68rem', opacity: 0.7 }}>Tap to upload plot photo</span>
                                                                <input 
                                                                    type="file" 
                                                                    accept="image/*" 
                                                                    capture="environment" 
                                                                    style={{ display: 'none' }} 
                                                                    onChange={(e) => {
                                                                        if (e.target.files && e.target.files[0]) {
                                                                            const file = e.target.files[0];
                                                                            e.target.value = '';
                                                                            handleUpdateCropImage(c.id, file);
                                                                        }
                                                                    }}
                                                                />
                                                            </label>
                                                        )}

                                                        {/* Farmland Information & Actions Body */}
                                                        <div style={{ padding: '0.9rem 1rem', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                                                            <div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                                                        <i className="fa-solid fa-seedling" style={{ color: isSelected ? 'var(--primary)' : 'var(--accent-gold)', fontSize: '1rem' }}></i>
                                                                        <strong style={{ fontSize: '1.1rem', color: isSelected ? 'var(--primary)' : 'var(--text-main)', letterSpacing: '0.2px' }}>
                                                                            {c.cropName}
                                                                        </strong>
                                                                    </div>
                                                                    {!c.cropImage && (
                                                                        <span style={{ 
                                                                            background: isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.07)', 
                                                                            color: isSelected ? '#000' : 'var(--text-main)', 
                                                                            fontSize: '0.74rem', 
                                                                            fontWeight: 700, 
                                                                            padding: '0.15rem 0.55rem', 
                                                                            borderRadius: '1rem',
                                                                            flexShrink: 0
                                                                        }}>
                                                                            {c.acres} Acres
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
                                                                    <i className="fa-solid fa-location-dot" style={{ color: 'var(--primary)', fontSize: '0.78rem' }}></i>
                                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.locationName}</span>
                                                                    <span style={{ opacity: 0.35 }}>•</span>
                                                                    <span style={{ flexShrink: 0, fontWeight: 600, color: 'var(--text-main)' }}>~{estYield.toFixed(0)} Qtl</span>
                                                                </div>
                                                            </div>

                                                            {/* Footer Status & Delete */}
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.78rem' }}>
                                                                <span style={{ 
                                                                    color: isSelected ? 'var(--primary)' : 'var(--text-muted)', 
                                                                    fontWeight: isSelected ? 700 : 500, 
                                                                    display: 'inline-flex', 
                                                                    alignItems: 'center', 
                                                                    gap: '0.35rem' 
                                                                }}>
                                                                    {isSelected ? (
                                                                        <><i className="fa-solid fa-circle-check" style={{ color: 'var(--primary)' }}></i> <span style={{ color: 'var(--primary)' }}>Showing Mills Below ↓</span></>
                                                                    ) : (
                                                                        <><i className="fa-solid fa-arrow-down"></i> Click to View Mills</>
                                                                    )}
                                                                </span>
                                                                <button 
                                                                    className="action-btn text-btn" 
                                                                    onClick={(e) => { e.stopPropagation(); handleDeleteCrop(c.id); }}
                                                                    title="Delete Farmland"
                                                                    style={{ color: 'var(--danger)', padding: '0.2rem 0.4rem', fontSize: '0.82rem', borderRadius: '0.4rem' }}
                                                                >
                                                                    <i className="fa-solid fa-trash"></i>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* BOTTOM SECTION: Nearby Verified Processing Mills */}
                                <div id="matching-mills-section" className="bento-card" style={{ padding: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <i className="fa-solid fa-industry" style={{ color: 'var(--primary)' }}></i>
                                                <span>
                                                    Verified Mills {selectedCropForSearch ? `Buying "${selectedCropForSearch.cropName}"` : 'Nearby'}
                                                </span>
                                            </h3>
                                            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                Ranked by proximity to {selectedCropForSearch?.locationName ? <strong>{selectedCropForSearch.locationName}</strong> : 'your farmlands'} {selectedCropForSearch?.acres ? `(${selectedCropForSearch.acres} Acres, ~${((parseFloat(selectedCropForSearch.acres) || 0) * 20).toFixed(0)} Qtl est.)` : ''}.
                                            </p>
                                        </div>

                                        {/* Deduplicated Crop Filter Pills */}
                                        {uniqueCrops.length > 1 && (
                                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Filter Crop:</span>
                                                {uniqueCrops.map(cropName => {
                                                    const cropLots = crops.filter(c => c.cropName === cropName);
                                                    const isCurrent = selectedCropForSearch?.cropName === cropName;
                                                    return (
                                                        <button
                                                            key={cropName}
                                                            className={`crop-filter-chip ${isCurrent ? 'active' : ''}`}
                                                            onClick={() => {
                                                                const match = crops.find(c => c.cropName === cropName);
                                                                if (match) handleSearchMills(match);
                                                            }}
                                                        >
                                                            <span>🌾 {cropName}</span>
                                                            <span style={{ opacity: 0.7, fontSize: '0.7rem' }}>({cropLots.length})</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Mills List / Grid */}
                                    {isSearchingMills ? (
                                        <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                                            <i className="fa-solid fa-circle-notch fa-spin fa-2x" style={{ color: 'var(--primary)', marginBottom: '0.75rem' }}></i>
                                            <div style={{ fontSize: '0.95rem' }}>Searching verified mills near {selectedCropForSearch?.locationName || 'your farm'}...</div>
                                        </div>
                                    ) : crops.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                                            <i className="fa-solid fa-wheat-awn-circle-exclamation fa-2x" style={{ marginBottom: '0.75rem', opacity: 0.5 }}></i>
                                            <p style={{ margin: 0, fontSize: '0.9rem' }}>Please register a farmland crop above to see matching buyer mills.</p>
                                        </div>
                                    ) : nearbyMills.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '0.75rem' }}>
                                            <i className="fa-solid fa-industry fa-2x" style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }}></i>
                                            <h4 style={{ margin: '0 0 0.35rem 0' }}>No Mills Currently Buying {selectedCropForSearch?.cropName || 'This Crop'}</h4>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '420px', margin: '0 auto 1.25rem' }}>
                                                No mills currently listed for this crop near {selectedCropForSearch?.locationName}. Check live APMC Mandi rates or select another farmland above.
                                            </p>
                                            <button className="action-btn" onClick={() => setActiveTab('market')} style={{ fontSize: '0.82rem' }}>
                                                <i className="fa-solid fa-chart-line"></i> View APMC Rates
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1.25rem' }}>
                                            {nearbyMills.map(mill => {
                                                const cropRate = selectedCropForSearch?.cropName ? mill.prices?.[selectedCropForSearch.cropName] : null;
                                                return (
                                                    <div 
                                                        key={mill.id} 
                                                        style={{ 
                                                            background: 'rgba(255, 255, 255, 0.03)', 
                                                            border: '1px solid rgba(255, 255, 255, 0.08)', 
                                                            borderRadius: '0.85rem', 
                                                            padding: '1.15rem', 
                                                            display: 'flex', 
                                                            flexDirection: 'column',
                                                            transition: 'border-color 0.2s ease, transform 0.2s ease'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                                            <div>
                                                                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{mill.millName}</h4>
                                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                                                                    <i className="fa-solid fa-location-dot" style={{ color: 'var(--primary)', marginRight: '0.35rem', fontSize: '0.78rem' }}></i>
                                                                    {mill.locationName}
                                                                </div>
                                                            </div>
                                                            <span style={{ 
                                                                background: 'rgba(16, 185, 129, 0.15)', 
                                                                color: 'var(--primary)', 
                                                                fontWeight: 700, 
                                                                fontSize: '0.75rem', 
                                                                padding: '0.2rem 0.55rem', 
                                                                borderRadius: '1rem', 
                                                                whiteSpace: 'nowrap' 
                                                            }}>
                                                                ~{mill.distance.toFixed(1)} km
                                                            </span>
                                                        </div>

                                                        <div style={{ 
                                                            background: 'rgba(0, 0, 0, 0.25)', 
                                                            border: '1px solid rgba(255, 255, 255, 0.04)',
                                                            padding: '0.75rem 0.9rem', 
                                                            borderRadius: '0.6rem', 
                                                            marginBottom: '1rem', 
                                                            fontSize: '0.82rem', 
                                                            display: 'flex', 
                                                            flexDirection: 'column', 
                                                            gap: '0.35rem' 
                                                        }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                <span style={{ color: 'var(--text-muted)' }}>Milling Capacity:</span>
                                                                <strong>{mill.capacity || 50} TPD</strong>
                                                            </div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                <span style={{ color: 'var(--text-muted)' }}>Cold Storage:</span>
                                                                <strong style={{ color: mill.hasColdStorage ? 'var(--primary)' : 'var(--text-muted)' }}>
                                                                    {mill.hasColdStorage ? 'Available ✅' : 'None'}
                                                                </strong>
                                                            </div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem', paddingTop: '0.45rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Direct Mill Rate:</span>
                                                                <strong style={{ color: 'var(--primary)', fontSize: '1.05rem' }}>
                                                                    ₹{cropRate || 2450} <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ Qtl</span>
                                                                </strong>
                                                            </div>
                                                        </div>

                                                        <div style={{ marginTop: 'auto' }}>
                                                            <button 
                                                                className="primary-btn" 
                                                                onClick={() => setSelectedMillForEnquiry(mill)}
                                                                style={{ width: '100%', justifyContent: 'center', padding: '0.6rem', fontSize: '0.85rem' }}
                                                            >
                                                                <i className="fa-solid fa-paper-plane"></i>
                                                                Send Direct Enquiry
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {/* ======================================================== */}
                    {/* TAB: MY ENQUIRIES */}
                    {/* ======================================================== */}
                    {activeTab === 'enquiries' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.6rem' }}>My Sent Enquiries 📬</h2>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                                        Track mill review, acceptance, and generated verification QR codes
                                    </p>
                                </div>
                            </div>

                            {enquiries.length === 0 ? (
                                <div className="bento-card" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                                    <i className="fa-solid fa-inbox fa-3x" style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}></i>
                                    <h3>No Enquiries Sent Yet</h3>
                                    <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 1.5rem' }}>
                                        Search nearby mills and click "Send Enquiry" to propose a harvest sale.
                                    </p>
                                    <button className="primary-btn" onClick={() => setActiveTab('crops')}>
                                        Explore Crops & Nearby Mills
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
                                    {enquiries.map(enq => {
                                        const millAccepted = (enq.mill_status || enq.status || '').toUpperCase() === 'ACCEPTED' || (enq.status || '').toUpperCase() === 'LOAD_RECEIVED';
                                        const millPending = !millAccepted && (enq.mill_status || enq.status || '').toUpperCase() !== 'REJECTED';
                                        const millRejected = (enq.mill_status || enq.status || '').toUpperCase() === 'REJECTED';

                                        const hasTransport = Boolean(enq.transport_required || enq.with_transport);
                                        const transportAccepted = (enq.transport_status || '').toUpperCase() === 'ACCEPTED';
                                        const transportPending = hasTransport && !transportAccepted && (enq.transport_status || '').toUpperCase() !== 'REJECTED';
                                        const transportRejected = (enq.transport_status || '').toUpperCase() === 'REJECTED';

                                        const isOverallConfirmed = enq.overall_status === 'CONFIRMED' || (!hasTransport && millAccepted) || (hasTransport && millAccepted && transportAccepted) || (enq.status || '').toUpperCase() === 'LOAD_RECEIVED';

                                        return (
                                            <div key={enq.id} className="bento-card" style={{ border: isOverallConfirmed ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column' }}>
                                                {/* Header */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                                                    <div>
                                                        <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--accent-gold)', fontSize: '1rem' }}>
                                                            {enq.enquiry_code}
                                                        </span>
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                            {new Date(enq.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </div>
                                                    </div>

                                                    <span className="status-badge" style={{
                                                        background: isOverallConfirmed ? 'rgba(16, 185, 129, 0.2)' : millRejected || transportRejected ? 'rgba(239, 68, 68, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                                                        color: isOverallConfirmed ? 'var(--primary)' : millRejected || transportRejected ? '#ef4444' : '#fbbf24',
                                                        textTransform: 'uppercase',
                                                        padding: '0.25rem 0.65rem',
                                                        borderRadius: '0.5rem',
                                                        fontWeight: 700,
                                                        fontSize: '0.75rem'
                                                    }}>
                                                        {isOverallConfirmed ? '🟢 CONFIRMED' : millRejected || transportRejected ? '🔴 REJECTED' : '🟡 IN PROGRESS'}
                                                    </span>
                                                </div>

                                                {/* Body */}
                                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.85rem' }}>
                                                    <div><span style={{ color: 'var(--text-muted)' }}>Crop:</span> <strong style={{ color: 'var(--primary)' }}>{enq.crop_name}</strong></div>
                                                    <div><span style={{ color: 'var(--text-muted)' }}>Quantity:</span> <strong>{enq.quantity || (enq.acres * 2)} Tons ({enq.acres} Acres)</strong></div>
                                                    <div><span style={{ color: 'var(--text-muted)' }}>Target Mill:</span> <strong>{enq.mill_name}</strong> (~{Number(enq.distance || 35).toFixed(1)} km)</div>
                                                    <div><span style={{ color: 'var(--text-muted)' }}>Expected Price:</span> <strong style={{ color: 'var(--accent-gold)' }}>₹{enq.expected_price || 'Market'} / Quintal</strong></div>
                                                    
                                                    {/* Transport Logistics Box */}
                                                    <div style={{ background: hasTransport ? 'rgba(16, 185, 129, 0.05)' : 'rgba(0, 0, 0, 0.25)', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: hasTransport ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(255, 255, 255, 0.06)', marginTop: '0.3rem' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: hasTransport ? '0.35rem' : 0 }}>
                                                            <span style={{ fontWeight: 600, color: hasTransport ? 'var(--primary)' : 'var(--text-muted)', fontSize: '0.8rem' }}>
                                                                <i className="fa-solid fa-truck" style={{ marginRight: '0.3rem' }}></i>
                                                                {hasTransport ? 'Logistics Requested' : 'Self Arranged by Farmer'}
                                                            </span>
                                                            {hasTransport && (
                                                                <span style={{ fontSize: '0.72rem', color: transportAccepted ? 'var(--primary)' : millAccepted ? '#fbbf24' : 'var(--text-muted)', fontWeight: 700 }}>
                                                                    {transportAccepted ? 'Driver Confirmed ✅' : millAccepted ? 'Driver Pending ⏳' : 'Dispatches on Mill Accept 🔒'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {hasTransport && (
                                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem' }}>
                                                                <div>Driver: <strong style={{ color: '#fff' }}>{enq.driver_name || 'Assigned Driver'}</strong></div>
                                                                <div>Vehicle: <strong style={{ color: '#fff' }}>{enq.vehicle_number || enq.vehicle_type || 'Truck'}</strong></div>
                                                                <div>Date: <strong style={{ color: '#fff' }}>{enq.transport_date || enq.pickup_date || 'Flexible'}</strong></div>
                                                                <div>Est. Cost: <strong style={{ color: 'var(--accent-gold)' }}>₹{enq.estimated_transport_cost?.toLocaleString() || 'Calculated'}</strong></div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Status Dual Breakdown */}
                                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem', fontSize: '0.75rem' }}>
                                                        <div style={{ flex: 1, padding: '0.35rem 0.5rem', background: 'rgba(0,0,0,0.3)', borderRadius: '0.4rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                                                            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem' }}>Mill Decision</span>
                                                            <strong style={{ color: millAccepted ? 'var(--primary)' : millRejected ? '#ef4444' : '#fbbf24' }}>
                                                                {millAccepted ? '✅ Accepted' : millRejected ? '❌ Declined' : '⏳ Pending'}
                                                            </strong>
                                                        </div>
                                                        {hasTransport && (
                                                            <div style={{ flex: 1, padding: '0.35rem 0.5rem', background: 'rgba(0,0,0,0.3)', borderRadius: '0.4rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                                                                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem' }}>Driver Status</span>
                                                                <strong style={{ color: transportAccepted ? 'var(--primary)' : transportRejected ? '#ef4444' : millAccepted ? '#fbbf24' : 'var(--text-muted)' }}>
                                                                    {transportAccepted ? '✅ Accepted' : transportRejected ? '❌ Declined' : millAccepted ? '⏳ Pending Response' : '🔒 Awaiting Mill Review'}
                                                                </strong>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Footer Action */}
                                                <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                                                    {isOverallConfirmed ? (
                                                        <button 
                                                            className="primary-btn" 
                                                            onClick={() => setSelectedEnquiryForQr(enq)}
                                                            style={{ width: '100%', justifyContent: 'center', padding: '0.65rem', fontWeight: 800 }}
                                                        >
                                                            <i className="fa-solid fa-qrcode"></i>
                                                            View Verification QR
                                                        </button>
                                                    ) : millRejected || transportRejected ? (
                                                        <div style={{ textAlign: 'center', color: '#ef4444', fontSize: '0.82rem', fontWeight: 600, padding: '0.35rem 0' }}>
                                                            <i className="fa-solid fa-circle-xmark"></i> {millRejected ? 'Declined by Mill' : 'Declined by Driver'}
                                                        </div>
                                                    ) : (
                                                        <div style={{ textAlign: 'center', color: '#fbbf24', fontSize: '0.8rem', padding: '0.35rem 0', fontWeight: 600, background: 'rgba(234, 179, 8, 0.08)', borderRadius: '0.4rem' }}>
                                                            <i className="fa-solid fa-hourglass-half"></i> {millAccepted ? 'Mill Accepted • Waiting for Driver' : 'Awaiting Mill Review'}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ======================================================== */}
                    {/* TAB: MY QR CODES (CROP VERIFICATION QR) */}
                    {/* ======================================================== */}
                    {activeTab === 'qrcodes' && (
                        <div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <h2 style={{ margin: 0, fontSize: '1.6rem' }}>Crop Verification QR Codes 🛡️</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                                    Authorized digital manifests for gate scanning, load authenticity, and delivery verification
                                </p>
                            </div>

                            {acceptedEnquiries.length === 0 ? (
                                <div className="bento-card" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                                    <i className="fa-solid fa-qrcode fa-3x" style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}></i>
                                    <h3>No Active QR Codes</h3>
                                    <p style={{ color: 'var(--text-muted)', maxWidth: '450px', margin: '0.5rem auto 1.5rem' }}>
                                        Once a mill accepts your enquiry, your secure QR code is automatically generated and permanently saved here.
                                    </p>
                                    <button className="primary-btn" onClick={() => setActiveTab('enquiries')}>
                                        Check Enquiries Status
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                                    {acceptedEnquiries.map(enq => (
                                        <div key={enq.id} className="bento-card" style={{ textAlign: 'center', border: '1px solid rgba(16, 185, 129, 0.35)', padding: '1.75rem 1.5rem' }}>
                                            <div style={{ display: 'inline-block', padding: '0.3rem 0.8rem', borderRadius: '1rem', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                                                {enq.load_status === 'LOAD_RECEIVED' ? '✓ LOAD RECEIVED AT MILL' : 'READY FOR GATE SCAN'}
                                            </div>

                                            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.2rem' }}>{enq.crop_name}</h3>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 1rem 0' }}>
                                                {enq.quantity || (enq.acres * 2)} Tons to {enq.mill_name}
                                            </p>

                                            <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '1rem', display: 'inline-block', marginBottom: '1rem', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
                                                <div style={{ width: '160px', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#022c22', fontWeight: 700 }}>
                                                    <i className="fa-solid fa-qrcode fa-5x"></i>
                                                </div>
                                            </div>

                                            <div style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--accent-gold)', fontSize: '1.05rem', marginBottom: '1rem' }}>
                                                {enq.enquiry_code}
                                            </div>

                                            <button 
                                                className="primary-btn"
                                                onClick={() => setSelectedEnquiryForQr(enq)}
                                                style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
                                            >
                                                <i className="fa-solid fa-expand"></i>
                                                Open Full QR & Share
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ======================================================== */}
                    {/* TAB: LOAD STATUS LIFECYCLE */}
                    {/* ======================================================== */}
                    {activeTab === 'loadstatus' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.6rem' }}>Load Status & Traceability 📈</h2>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                                        Full end-to-end audit lifecycle from initial farmer enquiry to gate verification and mill receipt
                                    </p>
                                </div>
                                <button className="action-btn" onClick={fetchEnquiriesData} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem' }}>
                                    <i className={`fa-solid fa-rotate-right ${loadingEnquiries ? 'fa-spin' : ''}`}></i> Refresh Status
                                </button>
                            </div>

                            {enquiries.length === 0 ? (
                                <div className="bento-card" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                                    <p style={{ color: 'var(--text-muted)' }}>No loads initiated yet. Send an enquiry to a mill to start.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    {enquiries.map(enq => {
                                        const statusUpper = (enq.status || '').toUpperCase();
                                        const millStatusUpper = (enq.mill_status || '').toUpperCase();
                                        const transportStatusUpper = (enq.transport_status || '').toUpperCase();
                                        const overallUpper = (enq.overall_status || '').toUpperCase();
                                        const loadStatusUpper = (enq.load_status || '').toUpperCase();

                                        const hasTransport = Boolean(enq.transport_required || enq.with_transport);
                                        const tr = transportRequests.find(t => t.enquiry_id === enq.id || (enq.enquiry_code && t.enquiry_code === enq.enquiry_code));
                                        const trStatus = (tr?.status || '').toUpperCase();
                                        const trTransportStatus = (tr?.transport_status || '').toUpperCase();

                                        const matchingLoad = loadsAndPayments.find(l => l.enquiry_id === enq.id || (enq.enquiry_code && l.enquiry_code === enq.enquiry_code));
                                        const isPaid = (enq.payment_status || '').toUpperCase() === 'COMPLETED' || (matchingLoad?.payment_status || '').toUpperCase() === 'COMPLETED';
                                        const paidAmount = Number(matchingLoad?.total_amount || enq.paid_amount || matchingLoad?.price || (enq.quantity || 10) * 10 * (enq.offered_price || 2450));
                                        const paidDate = matchingLoad?.paid_at || enq.paid_at;
                                        const utrRef = matchingLoad?.transaction_reference || enq.transaction_reference || 'UTR Settled';
                                        const paymentMethod = matchingLoad?.payment_method || enq.payment_method || 'Bank Transfer';

                                        // 1. Mill acceptance checks
                                        const isMillAccepted = millStatusUpper === 'ACCEPTED' || 
                                                               ['WAITING_TRANSPORT', 'ACCEPTED', 'CONFIRMED', 'LOAD_RECEIVED', 'QR_SCANNED'].includes(statusUpper) ||
                                                               ['WAITING_TRANSPORT', 'CONFIRMED'].includes(overallUpper);
                                        const isMillRejected = millStatusUpper === 'REJECTED' || statusUpper === 'REJECTED';

                                        // 2. Transporter acceptance checks
                                        const isDriverAccepted = transportStatusUpper === 'ACCEPTED' || 
                                                                 trTransportStatus === 'ACCEPTED' ||
                                                                 ['VEHICLE_ASSIGNED', 'PICKUP_STARTED', 'CROP_PICKED_UP', 'IN_TRANSIT', 'ARRIVED_AT_MILL', 'DELIVERED'].includes(trStatus) ||
                                                                 overallUpper === 'CONFIRMED' ||
                                                                 statusUpper === 'LOAD_RECEIVED';
                                        const isDriverRejected = transportStatusUpper === 'REJECTED' || trStatus === 'REJECTED' || trTransportStatus === 'REJECTED';

                                        // 3. Movement & Gate Arrival
                                        const isPickedUp = Boolean(tr && ['CROP_PICKED_UP', 'IN_TRANSIT', 'ARRIVED_AT_MILL', 'DELIVERED'].includes(trStatus));
                                        const isInTransit = Boolean(tr && ['IN_TRANSIT', 'ARRIVED_AT_MILL', 'DELIVERED'].includes(trStatus));
                                        const isAtMillGate = Boolean(tr && ['ARRIVED_AT_MILL', 'DELIVERED'].includes(trStatus));
                                        const isQrScanned = Boolean(enq.qr_scanned || statusUpper === 'QR_SCANNED' || statusUpper === 'LOAD_RECEIVED' || isAtMillGate);

                                        // 4. Mill Receipt & Weighment
                                        const isReceived = Boolean(
                                            statusUpper === 'LOAD_RECEIVED' || 
                                            loadStatusUpper === 'LOAD_RECEIVED' || 
                                            trStatus === 'DELIVERED'
                                        );

                                        // 5. Overall Confirmed (QR is authorized)
                                        const isFullyConfirmed = isReceived || 
                                                                 overallUpper === 'CONFIRMED' || 
                                                                 statusUpper === 'LOAD_RECEIVED' ||
                                                                 (!hasTransport && isMillAccepted) || 
                                                                 (hasTransport && isMillAccepted && isDriverAccepted);

                                        // Dynamic Stepper stages
                                        const stages = hasTransport ? [
                                            { 
                                                label: 'Enquiry Sent', 
                                                sub: `Sent to ${enq.mill_name}`, 
                                                done: true, 
                                                time: enq.created_at 
                                            },
                                            { 
                                                label: 'Mill Accepted', 
                                                sub: isMillRejected ? 'Declined by Mill' : isMillAccepted ? 'Mill confirmed load' : 'Awaiting mill review', 
                                                done: isMillAccepted, 
                                                error: isMillRejected,
                                                time: enq.accepted_at 
                                            },
                                            { 
                                                label: 'Driver Confirmed', 
                                                sub: isDriverRejected ? 'Driver declined' : isDriverAccepted ? (tr?.assigned_provider_name || enq.driver_name || 'Driver confirmed') : isMillAccepted ? 'Dispatched to driver' : 'Dispatches on mill approval', 
                                                done: isDriverAccepted, 
                                                error: isDriverRejected,
                                                time: enq.transport_accepted_at || tr?.updated_at 
                                            },
                                            { 
                                                label: isQrScanned ? 'Arrived at Gate' : isInTransit ? 'In Transit to Mill' : isPickedUp ? 'Crop Picked Up' : 'Farm Pickup & Transit', 
                                                sub: isQrScanned ? 'At mill gate' : isInTransit ? 'En route to mill' : isPickedUp ? 'Crop loaded on truck' : isDriverAccepted ? 'Ready for pickup' : 'Pending logistics', 
                                                done: isPickedUp || isInTransit || isQrScanned || isReceived, 
                                                time: isQrScanned ? (enq.scanned_at || enq.received_at) : (tr?.updated_at) 
                                            },
                                            { 
                                                label: 'Load Received', 
                                                sub: isReceived ? 'Weighed & received' : 'Final weighment & receipt', 
                                                done: isReceived, 
                                                time: enq.received_at || tr?.delivered_at 
                                            },
                                            {
                                                label: 'Payment Settled',
                                                sub: isPaid ? `₹${paidAmount?.toLocaleString('en-IN')} credited` : isReceived ? 'Mill settlement pending' : 'Awaiting produce intake',
                                                done: isPaid,
                                                time: paidDate
                                            }
                                        ] : [
                                            { 
                                                label: 'Enquiry Sent', 
                                                sub: `Sent to ${enq.mill_name}`, 
                                                done: true, 
                                                time: enq.created_at 
                                            },
                                            { 
                                                label: 'Mill Accepted', 
                                                sub: isMillRejected ? 'Declined by Mill' : isMillAccepted ? 'Mill confirmed load' : 'Awaiting mill review', 
                                                done: isMillAccepted, 
                                                error: isMillRejected,
                                                time: enq.accepted_at 
                                            },
                                            { 
                                                label: 'QR Pass Issued', 
                                                sub: isMillAccepted ? 'Gate pass generated' : 'Issued on acceptance', 
                                                done: isMillAccepted, 
                                                time: enq.accepted_at 
                                            },
                                            { 
                                                label: 'QR Scanned at Gate', 
                                                sub: isQrScanned ? 'Entry verified at gate' : 'Show QR at mill gate', 
                                                done: isQrScanned || isReceived, 
                                                time: enq.scanned_at || enq.received_at 
                                            },
                                            { 
                                                label: 'Load Received', 
                                                sub: isReceived ? 'Weighed & received' : 'Final weighment & receipt', 
                                                done: isReceived, 
                                                time: enq.received_at 
                                            },
                                            {
                                                label: 'Payment Settled',
                                                sub: isPaid ? `₹${paidAmount?.toLocaleString('en-IN')} credited` : isReceived ? 'Mill settlement pending' : 'Awaiting produce intake',
                                                done: isPaid,
                                                time: paidDate
                                            }
                                        ];

                                        return (
                                            <div key={enq.id} className="bento-card" style={{ border: `1px solid ${isPaid ? 'rgba(16, 185, 129, 0.6)' : isReceived ? 'var(--primary)' : isFullyConfirmed ? 'rgba(16, 185, 129, 0.4)' : isMillAccepted ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255,255,255,0.1)'}` }}>
                                                {/* Header Row */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                    <div>
                                                        <span style={{ fontFamily: 'monospace', color: 'var(--accent-gold)', fontWeight: 800, fontSize: '1.1rem' }}>
                                                             {enq.enquiry_code}
                                                        </span>
                                                        <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.1rem' }}>
                                                            {enq.crop_name} • {enq.quantity || (enq.acres * 2)} Tons
                                                        </h3>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                            Destination Mill: <strong>{enq.mill_name}</strong> (~{Number(enq.distance || 35).toFixed(1)} km)
                                                        </div>
                                                    </div>

                                                    <div>
                                                        {isPaid ? (
                                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.9rem', borderRadius: '2rem', background: 'rgba(16, 185, 129, 0.25)', color: 'var(--primary)', fontWeight: 800, fontSize: '0.82rem', border: '1px solid rgba(16, 185, 129, 0.5)' }}>
                                                                <i className="fa-solid fa-circle-check"></i>
                                                                PAYMENT COMPLETED (₹{paidAmount?.toLocaleString('en-IN')})
                                                            </div>
                                                        ) : isReceived ? (
                                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.9rem', borderRadius: '2rem', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--primary)', fontWeight: 800, fontSize: '0.82rem', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                                                                <i className="fa-solid fa-circle-check"></i>
                                                                LOAD RECEIVED AT MILL
                                                            </div>
                                                        ) : isQrScanned ? (
                                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.9rem', borderRadius: '2rem', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', fontWeight: 700, fontSize: '0.82rem', border: '1px solid rgba(56, 189, 248, 0.4)' }}>
                                                                <i className="fa-solid fa-qrcode"></i>
                                                                QR SCANNED & VERIFIED AT GATE
                                                            </div>
                                                        ) : isInTransit ? (
                                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.9rem', borderRadius: '2rem', background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', fontWeight: 700, fontSize: '0.82rem', border: '1px solid rgba(168, 85, 247, 0.4)' }}>
                                                                <i className="fa-solid fa-truck-fast"></i>
                                                                HARVEST IN TRANSIT TO MILL
                                                            </div>
                                                        ) : isPickedUp ? (
                                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.9rem', borderRadius: '2rem', background: 'rgba(234, 179, 8, 0.2)', color: '#fbbf24', fontWeight: 700, fontSize: '0.82rem', border: '1px solid rgba(234, 179, 8, 0.4)' }}>
                                                                <i className="fa-solid fa-box-open"></i>
                                                                CROP PICKED UP & LOADED
                                                            </div>
                                                        ) : (isDriverAccepted && hasTransport) ? (
                                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.9rem', borderRadius: '2rem', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--primary)', fontWeight: 700, fontSize: '0.82rem', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                                                                <i className="fa-solid fa-truck-moving"></i>
                                                                LOGISTICS CONFIRMED • QR READY
                                                            </div>
                                                        ) : isDriverRejected ? (
                                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.9rem', borderRadius: '2rem', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontWeight: 700, fontSize: '0.82rem', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
                                                                <i className="fa-solid fa-triangle-exclamation"></i>
                                                                DRIVER DECLINED • REASSIGNMENT NEEDED
                                                            </div>
                                                        ) : (isMillAccepted && hasTransport) ? (
                                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.9rem', borderRadius: '2rem', background: 'rgba(245, 158, 11, 0.2)', color: 'var(--accent-gold)', fontWeight: 700, fontSize: '0.82rem', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                                                                <i className="fa-solid fa-truck-fast"></i>
                                                                MILL ACCEPTED • DISPATCHED TO DRIVER
                                                            </div>
                                                        ) : (isMillAccepted && !hasTransport) ? (
                                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.9rem', borderRadius: '2rem', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--primary)', fontWeight: 700, fontSize: '0.82rem', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                                                                <i className="fa-solid fa-qrcode"></i>
                                                                MILL ACCEPTED • QR PASS READY
                                                            </div>
                                                        ) : isMillRejected ? (
                                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.9rem', borderRadius: '2rem', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontWeight: 700, fontSize: '0.82rem', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
                                                                <i className="fa-solid fa-circle-xmark"></i>
                                                                DECLINED BY MILL
                                                            </div>
                                                        ) : (
                                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.9rem', borderRadius: '2rem', background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.82rem', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                                                                <i className="fa-solid fa-hourglass-half"></i>
                                                                AWAITING MILL ACCEPTANCE
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Stepper Progress View */}
                                                <div style={{ padding: '1rem 0', overflowX: 'auto' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', minWidth: '550px' }}>
                                                        {stages.map((stage, idx) => (
                                                            <React.Fragment key={stage.label}>
                                                                <div style={{ textAlign: 'center', flex: 1 }}>
                                                                    <div style={{
                                                                        width: '34px',
                                                                        height: '34px',
                                                                        borderRadius: '50%',
                                                                        margin: '0 auto 0.4rem',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        background: stage.error ? '#ef4444' : stage.done ? 'var(--primary)' : 'rgba(255, 255, 255, 0.1)',
                                                                        color: stage.error ? '#fff' : stage.done ? '#000' : 'var(--text-muted)',
                                                                        fontWeight: 800,
                                                                        boxShadow: stage.done ? '0 0 15px var(--primary-glow)' : 'none'
                                                                    }}>
                                                                        {stage.error ? <i className="fa-solid fa-xmark"></i> : stage.done ? <i className="fa-solid fa-check"></i> : idx + 1}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.75rem', fontWeight: stage.done ? 700 : 400, color: stage.error ? '#ef4444' : stage.done ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                                                        {stage.label}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                                                        {stage.sub}
                                                                    </div>
                                                                    {stage.time && (
                                                                        <div style={{ fontSize: '0.62rem', color: 'var(--accent-gold)', marginTop: '0.15rem' }}>
                                                                            {new Date(stage.time).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {idx < stages.length - 1 && (
                                                                    <div style={{ flex: 1, height: '3px', background: stages[idx + 1].done ? 'var(--primary)' : 'rgba(255, 255, 255, 0.1)', margin: '0 -10px 1.4rem' }}></div>
                                                                )}
                                                            </React.Fragment>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Celebratory Payment Credited Banner */}
                                                {isPaid && (
                                                    <div style={{ 
                                                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)', 
                                                        border: '1px solid rgba(16, 185, 129, 0.4)', 
                                                        borderRadius: '0.75rem', 
                                                        padding: '0.9rem 1.1rem', 
                                                        marginBottom: '0.5rem', 
                                                        display: 'flex', 
                                                        justifyContent: 'space-between', 
                                                        alignItems: 'center', 
                                                        flexWrap: 'wrap', 
                                                        gap: '0.75rem' 
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.25)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                                                                <i className="fa-solid fa-wallet"></i>
                                                            </div>
                                                            <div>
                                                                <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.95rem' }}>
                                                                    Payment Credited: ₹{paidAmount?.toLocaleString('en-IN')}
                                                                </div>
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                                    Transferred by <strong>{matchingLoad?.mill_name || enq.mill_name}</strong> via {paymentMethod} • Ref: <span style={{ fontFamily: 'monospace', color: 'var(--accent-gold)', fontWeight: 700 }}>{utrRef}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <button
                                                            className="primary-btn"
                                                            onClick={() => {
                                                                if (matchingLoad) {
                                                                    setSelectedPaymentForReceipt(matchingLoad);
                                                                } else {
                                                                    setActiveTab('payments');
                                                                }
                                                            }}
                                                            style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 800 }}
                                                        >
                                                            <i className="fa-solid fa-receipt"></i> View Payment Bill
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Transporter Details Strip */}
                                                {hasTransport ? (
                                                    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '0.5rem', padding: '0.75rem 1rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
                                                            <div style={{ fontSize: '0.85rem' }}>
                                                                <div style={{ fontWeight: 700, color: 'var(--accent-gold)' }}>
                                                                    <i className="fa-solid fa-truck-moving" style={{ marginRight: '0.35rem' }}></i>
                                                                    Transporter: {tr?.assigned_provider_name || enq.driver_name || 'Fleet Driver'}
                                                                </div>
                                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                                                                    Vehicle: <strong>{tr?.vehicle_number || enq.vehicle_number || 'TS 09 EA 4421'}</strong> ({enq.vehicle_type || 'Truck'}) • 
                                                                    Status: <strong style={{ color: isDriverAccepted ? 'var(--primary)' : isMillAccepted ? '#fbbf24' : 'var(--text-muted)' }}>
                                                                        {isDriverAccepted ? (tr?.status ? tr.status.replace(/_/g, ' ') : 'LOGISTICS CONFIRMED') : isMillAccepted ? 'DISPATCHED • AWAITING DRIVER' : 'DISPATCHES ON MILL APPROVAL'}
                                                                    </strong>
                                                                </div>
                                                            </div>
                                                            {(tr?.assigned_provider_phone || enq.driver_phone) && (
                                                                <a href={`tel:${tr?.assigned_provider_phone || enq.driver_phone}`} className="action-btn" style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', textDecoration: 'none', color: 'inherit' }}>
                                                                    <i className="fa-solid fa-phone"></i> Call Driver ({tr?.assigned_provider_phone || enq.driver_phone})
                                                                </a>
                                                            )}
                                                        </div>

                                                        {/* Assigned Vehicle 2 Photos */}
                                                        {((tr?.vehicle_images && tr.vehicle_images.length > 0) || (enq.vehicle_images && enq.vehicle_images.length > 0)) && (
                                                            <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: '0.45rem' }}>
                                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Vehicle Photos:</span>
                                                                {(tr?.vehicle_images || enq.vehicle_images).slice(0, 2).map((imgUrl, i) => (
                                                                    <div 
                                                                        key={i}
                                                                        onClick={() => setCropLightboxImage({ url: imgUrl, title: `Assigned Vehicle (${tr?.vehicle_number || enq.vehicle_number}) - ${i === 0 ? 'Front View' : 'Cargo Bed'}` })}
                                                                        style={{ height: '48px', width: '75px', borderRadius: '0.35rem', overflow: 'hidden', position: 'relative', cursor: 'pointer', background: '#000', border: '1px solid rgba(255,255,255,0.1)' }}
                                                                        title="Click to view truck photo"
                                                                    >
                                                                        <img src={imgUrl} alt="Truck Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                        <span style={{ position: 'absolute', bottom: '1px', left: '2px', background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: '0.58rem', padding: '0.02rem 0.2rem', borderRadius: '0.2rem' }}>
                                                                            {i === 0 ? 'Front' : 'Cargo'}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '0.5rem', padding: '0.6rem 1rem', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                        <i className="fa-solid fa-person-walking-luggage" style={{ marginRight: '0.4rem', color: 'var(--primary)' }}></i>
                                                        <strong>Self-Arranged Transport:</strong> Produce will be transported directly by farmer to {enq.mill_name}.
                                                    </div>
                                                )}

                                                {/* Action & Simulation Bar */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                                                    {/* Left: Instant Demo Simulator Buttons */}
                                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '0.72rem', color: 'var(--accent-gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                            <i className="fa-solid fa-bolt"></i> Demo Simulator:
                                                        </span>

                                                        {!isMillAccepted && !isMillRejected && (
                                                            <button
                                                                className="action-btn"
                                                                onClick={async () => {
                                                                    await kisanService.acceptEnquiry(enq.id || enq.enquiry_code, {
                                                                        name: enq.mill_name || 'KisanConnect Mill',
                                                                        millName: enq.mill_name || 'KisanConnect Mill',
                                                                        id: enq.mill_id || 'DEMO-MILL',
                                                                        phone: enq.buyer_phone || '9876500000'
                                                                    }, enq);
                                                                    fetchEnquiriesData();
                                                                }}
                                                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', color: 'var(--accent-gold)' }}
                                                                title="Simulate Mill approving this enquiry and dispatching transport"
                                                            >
                                                                <i className="fa-solid fa-industry"></i> 1. Mill Accepts
                                                            </button>
                                                        )}

                                                        {isMillAccepted && hasTransport && !isDriverAccepted && !isDriverRejected && (
                                                            <button
                                                                className="action-btn"
                                                                onClick={async () => {
                                                                    await kisanService.acceptTransportLoad(enq.enquiry_code || enq.id, {
                                                                        name: enq.driver_name || 'Fleet Driver',
                                                                        phone: enq.driver_phone || '9876500001',
                                                                        vehicle_number: enq.vehicle_number || 'TS 09 EA 4421'
                                                                    });
                                                                    fetchEnquiriesData();
                                                                }}
                                                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: 'var(--primary)' }}
                                                                title="Simulate Driver accepting this haulage load"
                                                            >
                                                                <i className="fa-solid fa-truck"></i> 2. Driver Accepts
                                                            </button>
                                                        )}

                                                        {isFullyConfirmed && hasTransport && !isPickedUp && (
                                                            <button
                                                                className="action-btn"
                                                                onClick={async () => {
                                                                    const reqs = kisanService.getTransportRequests();
                                                                    const matched = reqs.find(r => r.enquiry_id === enq.id || r.enquiry_code === enq.enquiry_code);
                                                                    if (matched) {
                                                                        kisanService.updateTransportStatus(matched.transport_code, 'IN_TRANSIT');
                                                                        fetchEnquiriesData();
                                                                    }
                                                                }}
                                                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.4)', color: '#c084fc' }}
                                                                title="Simulate Driver picking up produce and beginning transit"
                                                            >
                                                                <i className="fa-solid fa-route"></i> 3. Start Transit
                                                            </button>
                                                        )}

                                                        {isFullyConfirmed && !isReceived && (
                                                            <button
                                                                className="action-btn"
                                                                onClick={async () => {
                                                                    if (window.confirm(`Mark gate receipt of ${enq.crop_name} (${enq.quantity || (enq.acres * 2)} Tons) at ${enq.mill_name}?`)) {
                                                                        await kisanService.acceptLoad(enq.enquiry_code || enq.id, { millName: enq.mill_name, id: enq.mill_id });
                                                                        fetchEnquiriesData();
                                                                    }
                                                                }}
                                                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: 'var(--primary)' }}
                                                                title="Simulate Gate Arrival, Weighment & Intake"
                                                            >
                                                                <i className="fa-solid fa-clipboard-check"></i> {hasTransport ? '4. Gate Receipt' : '3. Gate Receipt'}
                                                            </button>
                                                        )}

                                                        {isReceived && (
                                                            <button
                                                                className="action-btn"
                                                                onClick={() => setActiveTab('payments')}
                                                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: 'var(--primary)' }}
                                                            >
                                                                <i className="fa-solid fa-wallet"></i> View Payment Record
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Right: View QR Code */}
                                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                        {isFullyConfirmed ? (
                                                            <button
                                                                className="primary-btn"
                                                                onClick={() => setSelectedEnquiryForQr(enq)}
                                                                style={{ padding: '0.5rem 1.1rem', fontSize: '0.85rem', fontWeight: 800 }}
                                                            >
                                                                <i className="fa-solid fa-qrcode"></i> View Gate QR Pass
                                                            </button>
                                                        ) : (
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                                <i className="fa-solid fa-lock"></i>
                                                                <span>QR unlocks once logistics & mill are confirmed</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ======================================================== */}
                    {/* TAB: TRANSPORT */}
                    {/* ======================================================== */}
                    {activeTab === 'transport' && (
                        <div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <h2 style={{ margin: 0, fontSize: '1.6rem' }}>Transport & Haulage Requests 🚛</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                                    Smart truck capacity matching, incoming transport quotes, and live vehicle tracking
                                </p>
                            </div>

                            {transportRequests.length === 0 ? (
                                <div className="bento-card" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                                    <i className="fa-solid fa-truck-moving fa-3x" style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}></i>
                                    <h3>No Transport Requests</h3>
                                    <p style={{ color: 'var(--text-muted)' }}>When sending an enquiry, select "Transport Required = YES" to automatically request haulage.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    {transportRequests.map(tr => {
                                        const quotes = kisanService.getQuotesForRequest(tr.transport_code);

                                        return (
                                            <div key={tr.id} className="bento-card" style={{ border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                                                    <div>
                                                        <span style={{ fontFamily: 'monospace', color: 'var(--accent-gold)', fontWeight: 800 }}>{tr.transport_code}</span>
                                                        <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Enquiry: {tr.enquiry_code}</span>
                                                    </div>
                                                    <span className="status-badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>{tr.status}</span>
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                                                    <div>Cargo: <strong>{tr.crop_name} ({tr.quantity} Tons)</strong></div>
                                                    <div>Required Truck: <strong>{tr.required_capacity} Ton ({tr.vehicle_type || 'Truck'})</strong></div>
                                                    <div>Delivery: <strong>{tr.mill_name}</strong></div>
                                                    <div>Pickup Date: <strong>{tr.pickup_date || 'Flexible'}</strong></div>
                                                </div>

                                                {/* Quotes Section */}
                                                <div>
                                                    <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem' }}>
                                                        Quotes from Suitable Transport Providers ({quotes.length})
                                                    </h4>
                                                    {quotes.length === 0 ? (
                                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Searching for nearby trucks matching your {tr.required_capacity} Ton capacity...</p>
                                                    ) : (
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                                                            {quotes.map(q => (
                                                                <div key={q.id} style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: '0.75rem', border: `1px solid ${q.status === 'ACCEPTED' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.08)'}` }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                                                        <strong>{q.provider_name}</strong>
                                                                        <strong style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>₹{q.price?.toLocaleString()}</strong>
                                                                    </div>
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.55rem' }}>
                                                                        Vehicle: {q.vehicle_number} ({q.vehicle_capacity}T) • Est: {q.estimated_time}
                                                                    </div>

                                                                    {/* 2 Vehicle Images Preview on Quote */}
                                                                    {q.vehicle_images && q.vehicle_images.length > 0 && (
                                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginBottom: '0.75rem' }}>
                                                                            {q.vehicle_images.slice(0, 2).map((imgUrl, i) => (
                                                                                <div 
                                                                                    key={i}
                                                                                    onClick={() => setCropLightboxImage({ url: imgUrl, title: `${q.vehicle_number} (${q.provider_name}) - ${i === 0 ? 'Front View' : 'Cargo Bed'}` })}
                                                                                    style={{ height: '52px', borderRadius: '0.35rem', overflow: 'hidden', position: 'relative', cursor: 'pointer', background: '#000', border: '1px solid rgba(255,255,255,0.1)' }}
                                                                                    title="Click to view truck photo"
                                                                                >
                                                                                    <img src={imgUrl} alt={`Truck Angle ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                                    <span style={{ position: 'absolute', bottom: '2px', left: '2px', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '0.6rem', padding: '0.05rem 0.25rem', borderRadius: '0.2rem' }}>
                                                                                        {i === 0 ? 'Front' : 'Cargo'}
                                                                                    </span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}

                                                                    {q.status === 'ACCEPTED' ? (
                                                                        <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.85rem' }}>
                                                                            ✓ Assigned Provider
                                                                        </span>
                                                                    ) : tr.status === 'ASSIGNED' ? (
                                                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Closed</span>
                                                                    ) : (
                                                                        <button 
                                                                            className="primary-btn" 
                                                                            onClick={() => handleAcceptTransportQuote(q.id)}
                                                                            style={{ width: '100%', justifyContent: 'center', padding: '0.5rem', fontSize: '0.8rem' }}
                                                                        >
                                                                            Accept Quote
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ======================================================== */}
                    {/* TAB: MARKET PRICES */}
                    {/* ======================================================== */}
                    {activeTab === 'market' && (
                        <div className="dashboard view-section" style={{ display: 'block' }}>
                            <div className="welcome-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div>
                                    <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Live Mill Rates & Market Benchmark 📈</h1>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                                        Real-time mill purchase prices compared against APMC Mandi benchmarks. Sell to the highest bidder.
                                    </p>
                                </div>
                                <button className="action-btn" onClick={fetchAllVerifiedMills} style={{ fontSize: '0.85rem', padding: '0.5rem 0.9rem' }}>
                                    <i className="fa-solid fa-rotate-right"></i> Refresh Mill Prices
                                </button>
                            </div>

                            {/* Section 1: Top Paying Mills Leaderboard */}
                            <div style={{ marginBottom: '2rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <h2 style={{ margin: 0, fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span>🏆 Mill Price Leaderboard (Highest Buying Offers)</span>
                                    </h2>
                                    {farmerCropNames.length > 0 && (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--primary)', background: 'rgba(16, 185, 129, 0.12)', padding: '0.3rem 0.75rem', borderRadius: '1rem', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                                            <i className="fa-solid fa-wheat-awn"></i> Matched to your {farmerCropNames.length} crop{farmerCropNames.length > 1 ? 's' : ''} ({farmerCropNames.join(', ')})
                                        </div>
                                    )}
                                </div>

                                {millOffersByCrop.length === 0 ? (
                                    <div className="bento-card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                                        <i className="fa-solid fa-industry fa-3x" style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}></i>
                                        <h3>No Active Mill Rates</h3>
                                        <p style={{ color: 'var(--text-muted)' }}>Verified mills haven't published rates for these crops yet.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '1.25rem' }}>
                                        {millOffersByCrop.flatMap(group => group.offers.map((offer, idx) => {
                                            const isHighest = idx === 0;
                                            return (
                                                <div 
                                                    key={`${offer.mill.id}-${offer.cropName}`} 
                                                    className="bento-card" 
                                                    style={{ 
                                                        border: isHighest ? '1px solid rgba(16, 185, 129, 0.45)' : '1px solid rgba(255, 255, 255, 0.08)',
                                                        boxShadow: isHighest ? '0 10px 25px rgba(16, 185, 129, 0.12)' : 'none',
                                                        display: 'flex',
                                                        flexDirection: 'column'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                                        <div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                <span style={{ fontSize: '0.85rem' }}>🌾</span>
                                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{offer.cropName}</span>
                                                            </div>
                                                            <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.15rem' }}>{offer.mill.millName}</h3>
                                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                                                <i className="fa-solid fa-location-dot"></i> {offer.mill.locationName || 'Location'} • ~{offer.distance.toFixed(1)} km
                                                            </div>
                                                        </div>

                                                        {isHighest ? (
                                                            <span style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000', fontSize: '0.7rem', padding: '0.2rem 0.55rem', borderRadius: '0.4rem', fontWeight: 800 }}>
                                                                👑 TOP PRICE
                                                            </span>
                                                        ) : (
                                                            <span style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', fontSize: '0.7rem', padding: '0.2rem 0.55rem', borderRadius: '0.4rem', fontWeight: 600 }}>
                                                                Rank #{idx + 1}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '0.5rem', padding: '0.75rem 1rem', margin: '0.5rem 0 1rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Mill Buying Offer</div>
                                                            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: isHighest ? 'var(--primary)' : 'var(--accent-gold)' }}>
                                                                ₹{offer.price.toLocaleString('en-IN')}
                                                            </div>
                                                        </div>
                                                        <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                            <div>Per Quintal</div>
                                                            <div style={{ color: 'var(--primary)', fontWeight: 600 }}>100 kg</div>
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                            Capacity: <strong>{offer.mill.capacity || '500+'} T</strong>
                                                        </div>
                                                        <button
                                                            className="primary-btn"
                                                            onClick={() => {
                                                                setSelectedMillForEnquiry({ ...offer.mill, distance: offer.distance });
                                                                setSelectedCropForSearch(offer.farmerCrop);
                                                            }}
                                                            style={{ 
                                                                padding: '0.45rem 0.85rem', 
                                                                fontSize: '0.8rem',
                                                                background: isHighest ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                                                                color: isHighest ? '#000' : 'var(--text-main)',
                                                                border: isHighest ? 'none' : '1px solid rgba(255,255,255,0.1)'
                                                            }}
                                                        >
                                                            <i className="fa-solid fa-paper-plane"></i> Send Enquiry
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        }))}
                                    </div>
                                )}
                            </div>

                            {/* Section 2: APMC Mandi Benchmark Rates Table */}
                            <div>
                                <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span>📊 APMC Mandi Benchmark Rates</span>
                                </h2>
                                <div className="bento-card">
                                    <div className="table-responsive">
                                        <table className="orders-table" style={{ width: '100%', textAlign: 'left' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                    <th style={{ padding: '1rem' }}>Commodity</th>
                                                    <th style={{ padding: '1rem' }}>Major Market</th>
                                                    <th style={{ padding: '1rem' }}>Benchmark Price (per Quintal)</th>
                                                    <th style={{ padding: '1rem' }}>Daily Trend</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                    <td style={{ padding: '1rem', fontWeight: 600 }}>Paddy (Rice)</td>
                                                    <td style={{ padding: '1rem' }}>Khammam / Warangal</td>
                                                    <td style={{ padding: '1rem', color: 'var(--primary)', fontWeight: 700 }}>₹2,250</td>
                                                    <td style={{ padding: '1rem' }}><span className="trend up">+2.5%</span></td>
                                                </tr>
                                                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                    <td style={{ padding: '1rem', fontWeight: 600 }}>Maize</td>
                                                    <td style={{ padding: '1rem' }}>Nizamabad</td>
                                                    <td style={{ padding: '1rem', color: 'var(--danger)', fontWeight: 700 }}>₹1,960</td>
                                                    <td style={{ padding: '1rem' }}><span className="trend down">-1.2%</span></td>
                                                </tr>
                                                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                    <td style={{ padding: '1rem', fontWeight: 600 }}>Cotton</td>
                                                    <td style={{ padding: '1rem' }}>Adoni</td>
                                                    <td style={{ padding: '1rem', color: 'var(--primary)', fontWeight: 700 }}>₹7,100</td>
                                                    <td style={{ padding: '1rem' }}><span className="trend up">+0.8%</span></td>
                                                </tr>
                                                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                    <td style={{ padding: '1rem', fontWeight: 600 }}>Red Gram</td>
                                                    <td style={{ padding: '1rem' }}>Tandur</td>
                                                    <td style={{ padding: '1rem', color: 'var(--primary)', fontWeight: 700 }}>₹7,000</td>
                                                    <td style={{ padding: '1rem' }}><span className="trend up">+1.5%</span></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ======================================================== */}
                    {/* TAB: HISTORY & LEDGER */}
                    {/* ======================================================== */}
                    {activeTab === 'history' && (
                        <div className="history-container">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Harvest & Transaction History 📜</h2>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                                        Complete chronological audit log of your enquiries, verified gate receipts, and transport trips
                                    </p>
                                </div>
                                <button className="action-btn" onClick={fetchEnquiriesData} style={{ fontSize: '0.85rem' }}>
                                    <i className="fa-solid fa-rotate-right"></i> Refresh Ledger
                                </button>
                            </div>

                            {/* Summary Metric Cards */}
                            <div className="history-summary-grid">
                                <div className="history-stat-card">
                                    <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                                        <i className="fa-solid fa-wheat-awn"></i>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lifetime Tonnage</div>
                                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                            {historyList.reduce((acc, h) => acc + (Number(h.quantity) || 0), 0)} Tons
                                        </div>
                                    </div>
                                </div>
                                <div className="history-stat-card">
                                    <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                                        <i className="fa-solid fa-truck-ramp-box"></i>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Verified Loads</div>
                                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                                            {historyList.filter(h => h.category === 'LOAD_RECEIVED').length} Delivered
                                        </div>
                                    </div>
                                </div>
                                <div className="history-stat-card">
                                    <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                                        <i className="fa-solid fa-receipt"></i>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Entries</div>
                                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                            {historyList.length} Logged
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Filter Chips */}
                            <div className="history-filters">
                                {[
                                    { label: 'All History', val: 'ALL' },
                                    { label: 'Loads Received', val: 'LOAD_RECEIVED' },
                                    { label: 'Enquiries', val: 'ENQUIRY' },
                                    { label: 'Transport', val: 'TRANSPORT' }
                                ].map(f => (
                                    <button
                                        key={f.val}
                                        className={`history-filter-btn ${historyFilter === f.val ? 'active' : ''}`}
                                        onClick={() => setHistoryFilter(f.val)}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>

                            {/* History List */}
                            {historyList.filter(h => historyFilter === 'ALL' || h.category === historyFilter).length === 0 ? (
                                <div className="bento-card" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                                    <i className="fa-solid fa-clock-rotate-left fa-3x" style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}></i>
                                    <h3>No Records Found</h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No ledger history found under the "{historyFilter}" filter.</p>
                                </div>
                            ) : (
                                <div className="history-feed">
                                    {historyList
                                        .filter(h => historyFilter === 'ALL' || h.category === historyFilter)
                                        .map(item => (
                                            <div key={item.id} className={`history-card ${item.category === 'LOAD_RECEIVED' ? '' : 'gold-border'}`}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '220px' }}>
                                                    <div style={{
                                                        width: '42px',
                                                        height: '42px',
                                                        borderRadius: '50%',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        background: item.category === 'LOAD_RECEIVED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                                        color: item.category === 'LOAD_RECEIVED' ? 'var(--primary)' : 'var(--accent-gold)'
                                                    }}>
                                                        <i className={`fa-solid ${item.category === 'LOAD_RECEIVED' ? 'fa-circle-check' : item.category === 'TRANSPORT' ? 'fa-truck-moving' : 'fa-file-lines'}`}></i>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--accent-gold)', fontSize: '0.95rem' }}>
                                                            {item.enquiry_code}
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                            {new Date(item.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ flex: 1, minWidth: '220px' }}>
                                                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '0.2rem' }}>
                                                        {item.title}
                                                    </div>
                                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                                        <strong style={{ color: 'var(--primary)' }}>{item.crop_name}</strong> • {item.quantity} Tons {item.acres ? `(${item.acres} Acres)` : ''} • Partner: <strong>{item.partner}</strong>
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontStyle: 'italic' }}>
                                                        {item.details}
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    {item.value && (
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Value</div>
                                                            <div style={{ fontWeight: 800, color: 'var(--accent-gold)', fontSize: '0.95rem' }}>{item.value}</div>
                                                        </div>
                                                    )}
                                                    <span className={item.category === 'LOAD_RECEIVED' ? 'badge-green' : 'badge-gold'}>
                                                        {item.status}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ======================================================== */}
                    {/* TAB: PAYMENTS & SETTLEMENTS */}
                    {/* ======================================================== */}
                    {activeTab === 'payments' && (() => {
                        const completedPayments = loadsAndPayments.filter(p => (p.payment_status || 'PENDING').toUpperCase() === 'COMPLETED');
                        const pendingPayments = loadsAndPayments.filter(p => (p.payment_status || 'PENDING').toUpperCase() === 'PENDING');

                        const totalPaidAmt = completedPayments.reduce((sum, p) => sum + (Number(p.total_amount || p.price) || 0), 0);
                        const totalPendingAmt = pendingPayments.reduce((sum, p) => sum + (Number(p.total_amount || p.price) || 0), 0);
                        const totalTonnes = loadsAndPayments.reduce((sum, p) => sum + (Number(p.quantity_tonnes || p.quantity) || 0), 0);
                        const totalQuintals = loadsAndPayments.reduce((sum, p) => sum + (Number(p.quantity_quintals) || (Number(p.quantity_tonnes || p.quantity) * 10) || 0), 0);

                        const displayedPayments = paymentCategoryFilter === 'COMPLETED'
                            ? completedPayments
                            : paymentCategoryFilter === 'PENDING'
                            ? pendingPayments
                            : loadsAndPayments;

                        return (
                            <div>
                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                                    <div>
                                        <h2 style={{ margin: 0, fontSize: '1.6rem' }}>Direct Mill Payments & Settlements 💰</h2>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                                            Transparent weighbridge quantities, quintal rate conversions, and direct bank payouts from mills
                                        </p>
                                    </div>
                                    <button className="primary-btn" onClick={handleOpenEditBankModal}>
                                        <i className="fa-solid fa-building-columns"></i>
                                        Update Bank Account
                                    </button>
                                </div>

                                {/* Financial Summary Cards */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
                                    <div className="bento-card" style={{ padding: '1.25rem', border: '1px solid rgba(16, 185, 129, 0.35)', background: 'rgba(16, 185, 129, 0.05)' }}>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--primary)', textTransform: 'uppercase', fontWeight: 700 }}>Total Payments Received</div>
                                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)', margin: '0.3rem 0' }}>
                                            ₹{totalPaidAmt.toLocaleString('en-IN')}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            {completedPayments.length} completed mill transfer{completedPayments.length !== 1 ? 's' : ''}
                                        </div>
                                    </div>

                                    <div className="bento-card" style={{ padding: '1.25rem', border: '1px solid rgba(234, 179, 8, 0.35)', background: 'rgba(234, 179, 8, 0.05)' }}>
                                        <div style={{ fontSize: '0.78rem', color: '#fbbf24', textTransform: 'uppercase', fontWeight: 700 }}>Pending Settlements</div>
                                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fbbf24', margin: '0.3rem 0' }}>
                                            ₹{totalPendingAmt.toLocaleString('en-IN')}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            {pendingPayments.length} load{pendingPayments.length !== 1 ? 's' : ''} awaiting mill payment
                                        </div>
                                    </div>

                                    <div className="bento-card" style={{ padding: '1.25rem' }}>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Weighed Produce</div>
                                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', margin: '0.3rem 0' }}>
                                            {totalTonnes.toFixed(1)} <span style={{ fontSize: '1rem', color: 'var(--accent-gold)' }}>Tons</span>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            {totalQuintals.toFixed(0)} Quintals delivered
                                        </div>
                                    </div>
                                </div>

                                {/* My Registered Bank Account Banner & AI Passbook OCR Section */}
                                <div style={{ marginBottom: '1.75rem' }}>
                                    {showPassbookScanner ? (
                                        <div style={{ position: 'relative' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                                                <button 
                                                    className="action-btn"
                                                    onClick={() => setShowPassbookScanner(false)}
                                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem' }}
                                                >
                                                    <i className="fa-solid fa-xmark"></i> Close Passbook Scanner
                                                </button>
                                            </div>
                                            <PassbookOcrUploader
                                                farmerPhone={user.phone}
                                                initialDetails={farmerBankDetails}
                                                onDetailsSaved={(updated) => {
                                                    setFarmerBankDetails(updated);
                                                    setShowPassbookScanner(false);
                                                }}
                                                onOpenSandboxPayout={() => setShowSandboxPayoutModal(true)}
                                            />
                                        </div>
                                    ) : (
                                        <div className="bento-card" style={{ background: 'rgba(0, 0, 0, 0.35)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '1.25rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem', flexWrap: 'wrap', gap: '0.6rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <i className="fa-solid fa-building-columns" style={{ color: 'var(--primary)', fontSize: '1.2rem' }}></i>
                                                    <h4 style={{ margin: 0, fontSize: '0.95rem' }}>My Registered Bank Account for Mill Direct Payouts</h4>
                                                </div>

                                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                    <button
                                                        className="action-btn"
                                                        onClick={() => setShowPassbookScanner(true)}
                                                        style={{
                                                            padding: '0.35rem 0.75rem',
                                                            fontSize: '0.76rem',
                                                            background: 'rgba(16, 185, 129, 0.15)',
                                                            color: 'var(--primary)',
                                                            borderColor: 'rgba(16, 185, 129, 0.35)',
                                                            fontWeight: 700
                                                        }}
                                                    >
                                                        <i className="fa-solid fa-camera"></i> Scan Passbook (AI OCR)
                                                    </button>
                                                    <button
                                                        className="action-btn"
                                                        onClick={() => setShowSandboxPayoutModal(true)}
                                                        style={{
                                                            padding: '0.35rem 0.75rem',
                                                            fontSize: '0.76rem',
                                                            background: 'rgba(245, 158, 11, 0.15)',
                                                            color: 'var(--accent-gold)',
                                                            borderColor: 'rgba(245, 158, 11, 0.35)',
                                                            fontWeight: 700
                                                        }}
                                                    >
                                                        <i className="fa-solid fa-vial-circle-check"></i> Test Demo Payout
                                                    </button>
                                                    <button
                                                        className="action-btn"
                                                        onClick={() => setShowRazorpayModal(true)}
                                                        style={{
                                                            padding: '0.35rem 0.75rem',
                                                            fontSize: '0.76rem',
                                                            background: 'rgba(2, 132, 199, 0.18)',
                                                            color: '#38bdf8',
                                                            borderColor: 'rgba(56, 189, 248, 0.4)',
                                                            fontWeight: 700
                                                        }}
                                                    >
                                                        <i className="fa-solid fa-shield-halved"></i> Test Razorpay Checkout
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Verification Pipeline Badges */}
                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
                                                <span style={{
                                                    background: farmerBankDetails.ocrExtracted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                                    color: farmerBankDetails.ocrExtracted ? 'var(--primary)' : 'var(--text-muted)',
                                                    border: `1px solid ${farmerBankDetails.ocrExtracted ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                                                    padding: '0.2rem 0.6rem',
                                                    borderRadius: '1rem',
                                                    fontSize: '0.72rem',
                                                    fontWeight: 700,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.3rem'
                                                }}>
                                                    <i className={farmerBankDetails.ocrExtracted ? "fa-solid fa-circle-check" : "fa-regular fa-circle"}></i>
                                                    OCR Extracted {farmerBankDetails.ocrExtracted ? '✓' : ''}
                                                </span>

                                                <span style={{
                                                    background: farmerBankDetails.detailsConfirmed ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                                    color: farmerBankDetails.detailsConfirmed ? 'var(--accent-gold)' : 'var(--text-muted)',
                                                    border: `1px solid ${farmerBankDetails.detailsConfirmed ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                                                    padding: '0.2rem 0.6rem',
                                                    borderRadius: '1rem',
                                                    fontSize: '0.72rem',
                                                    fontWeight: 700,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.3rem'
                                                }}>
                                                    <i className={farmerBankDetails.detailsConfirmed ? "fa-solid fa-user-check" : "fa-regular fa-circle"}></i>
                                                    Bank Details Confirmed {farmerBankDetails.detailsConfirmed ? '✓' : ''}
                                                </span>

                                                <span style={{
                                                    background: 'rgba(59, 130, 246, 0.08)',
                                                    color: '#93c5fd',
                                                    border: '1px dashed rgba(59, 130, 246, 0.3)',
                                                    padding: '0.2rem 0.6rem',
                                                    borderRadius: '1rem',
                                                    fontSize: '0.72rem',
                                                    fontWeight: 600,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.3rem'
                                                }} title="PaddleOCR reads the passbook text. Official bank account ownership verification is scheduled via banking network penny-drop.">
                                                    <i className="fa-solid fa-lock"></i> Bank Ownership: Pending Verification
                                                </span>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
                                                <div>
                                                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Account Holder</span>
                                                    <strong>{farmerBankDetails.accountHolder || profileName || 'Ramesh Reddy'}</strong>
                                                </div>
                                                <div>
                                                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Bank Name</span>
                                                    <strong>{farmerBankDetails.bankName || 'State Bank of India'}</strong>
                                                </div>
                                                <div>
                                                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>
                                                        Account Number
                                                        <button 
                                                            onClick={() => setShowAccountDigits(!showAccountDigits)}
                                                            style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', marginLeft: '0.4rem', fontSize: '0.75rem' }}
                                                            title={showAccountDigits ? "Hide Digits" : "Reveal Digits"}
                                                        >
                                                            <i className={`fa-solid ${showAccountDigits ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                                        </button>
                                                    </span>
                                                    <strong style={{ fontFamily: 'monospace', color: '#fff', letterSpacing: showAccountDigits ? '0.02em' : '0.12em' }}>
                                                        {showAccountDigits
                                                            ? (farmerBankDetails.accountNumber || '308912445892')
                                                            : (farmerBankDetails.accountNumber ? `••••••••${farmerBankDetails.accountNumber.slice(-4)}` : '••••••••4589')}
                                                    </strong>
                                                </div>
                                                <div>
                                                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>IFSC Code</span>
                                                    <strong style={{ fontFamily: 'monospace', color: '#fff' }}>{farmerBankDetails.ifscCode || 'SBIN0004521'}</strong>
                                                </div>
                                                <div>
                                                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>UPI ID</span>
                                                    <strong style={{ fontFamily: 'monospace', color: 'var(--accent-gold)' }}>{farmerBankDetails.upiId || `${user.phone}@upi`}</strong>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Category Filter Pills */}
                                <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                                    {[
                                        { id: 'ALL', label: 'All Transactions', count: loadsAndPayments.length },
                                        { id: 'COMPLETED', label: 'Payment Completed', count: completedPayments.length, badgeColor: 'var(--primary)' },
                                        { id: 'PENDING', label: 'Payment Pending', count: pendingPayments.length, badgeColor: '#fbbf24' }
                                    ].map(cat => (
                                        <button
                                            key={cat.id}
                                            className={`action-btn ${paymentCategoryFilter === cat.id ? 'primary-btn' : ''}`}
                                            onClick={() => setPaymentCategoryFilter(cat.id)}
                                            style={{
                                                padding: '0.6rem 1.1rem',
                                                fontSize: '0.85rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                background: paymentCategoryFilter === cat.id ? 'var(--primary)' : 'rgba(255, 255, 255, 0.04)',
                                                border: paymentCategoryFilter === cat.id ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                                color: paymentCategoryFilter === cat.id ? '#000' : 'var(--text-main)',
                                                fontWeight: paymentCategoryFilter === cat.id ? 800 : 500
                                            }}
                                        >
                                            <span>{cat.label}</span>
                                            <span style={{
                                                background: paymentCategoryFilter === cat.id ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.1)',
                                                color: paymentCategoryFilter === cat.id ? '#000' : cat.badgeColor || 'var(--text-muted)',
                                                padding: '0.1rem 0.45rem',
                                                borderRadius: '1rem',
                                                fontSize: '0.72rem',
                                                fontWeight: 800
                                            }}>
                                                {cat.count}
                                            </span>
                                        </button>
                                    ))}
                                </div>

                                {/* Payments List Table */}
                                {displayedPayments.length === 0 ? (
                                    <div className="bento-card" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                                        <i className="fa-solid fa-wallet fa-3x" style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}></i>
                                        <h3>No Transactions Found</h3>
                                        <p style={{ color: 'var(--text-muted)', maxWidth: '450px', margin: '0.5rem auto 1.5rem' }}>
                                            {paymentCategoryFilter === 'COMPLETED'
                                                ? 'No completed payments yet. When a mill verifies your crop and transfers funds, they will appear here.'
                                                : paymentCategoryFilter === 'PENDING'
                                                ? 'No pending payouts. All delivered produce has been settled!'
                                                : 'No payment records found. Send enquiries to mills and bring your harvest to mill gates to start receiving payments.'}
                                        </p>
                                        <button className="primary-btn" onClick={() => setActiveTab('crops')}>
                                            Explore Crops & Nearby Mills
                                        </button>
                                    </div>
                                ) : (
                                    <div className="bento-card" style={{ padding: 0, overflow: 'hidden' }}>
                                        <div className="table-responsive">
                                            <table className="orders-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                                                        <th style={{ padding: '1rem' }}>Enquiry Ref</th>
                                                        <th style={{ padding: '1rem' }}>Purchaser Mill</th>
                                                        <th style={{ padding: '1rem' }}>Crop & Quantity</th>
                                                        <th style={{ padding: '1rem' }}>Price / Quintal</th>
                                                        <th style={{ padding: '1rem' }}>Total Amount</th>
                                                        <th style={{ padding: '1rem' }}>Status</th>
                                                        <th style={{ padding: '1rem' }}>Payment Date</th>
                                                        <th style={{ padding: '1rem', textAlign: 'right' }}>Receipt</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {displayedPayments.map(item => {
                                                        const isCompleted = (item.payment_status || 'PENDING').toUpperCase() === 'COMPLETED';
                                                        const tonnes = Number(item.quantity_tonnes || item.quantity || 10);
                                                        const quintals = Number(item.quantity_quintals || Math.round(tonnes * 10 * 10) / 10);
                                                        const rate = Number(item.price_per_quintal || 2450);
                                                        const total = Number(item.total_amount || item.price || (quintals * rate));

                                                        return (
                                                            <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                                <td style={{ padding: '1rem' }}>
                                                                    <div style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--accent-gold)' }}>
                                                                        {item.enquiry_code}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                                        {new Date(item.received_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                                                    </div>
                                                                </td>

                                                                <td style={{ padding: '1rem' }}>
                                                                    <strong>{item.mill_name}</strong>
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                                        Intake Gate
                                                                    </div>
                                                                </td>

                                                                <td style={{ padding: '1rem' }}>
                                                                    <strong style={{ color: 'var(--primary)' }}>{item.crop_name}</strong>
                                                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                                                        {tonnes} Tonnes <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({quintals} Quintals)</span>
                                                                    </div>
                                                                </td>

                                                                <td style={{ padding: '1rem' }}>
                                                                    <strong style={{ color: 'var(--accent-gold)' }}>₹{rate.toLocaleString('en-IN')}</strong>
                                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>per Quintal</div>
                                                                </td>

                                                                <td style={{ padding: '1rem' }}>
                                                                    <strong style={{ fontSize: '1.1rem', color: isCompleted ? 'var(--primary)' : '#fbbf24' }}>
                                                                        ₹{total.toLocaleString('en-IN')}
                                                                    </strong>
                                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                                        {quintals} Qtl × ₹{rate}
                                                                    </div>
                                                                </td>

                                                                <td style={{ padding: '1rem' }}>
                                                                    {isCompleted ? (
                                                                        <div>
                                                                            <span className="status-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--primary)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, borderRadius: '0.4rem' }}>
                                                                                <i className="fa-solid fa-circle-check" style={{ marginRight: '0.3rem' }}></i>
                                                                                COMPLETED
                                                                            </span>
                                                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontFamily: 'monospace' }}>
                                                                                {item.transaction_reference}
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="status-badge" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#fbbf24', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, borderRadius: '0.4rem' }}>
                                                                            <i className="fa-solid fa-clock" style={{ marginRight: '0.3rem' }}></i>
                                                                            AWAITING MILL
                                                                        </span>
                                                                    )}
                                                                </td>

                                                                <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                                                                    {item.paid_at ? (
                                                                        <div>
                                                                            <strong>{new Date(item.paid_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
                                                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                                                {new Date(item.paid_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Pending Payout</span>
                                                                    )}
                                                                </td>

                                                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                                    <button
                                                                        className="action-btn"
                                                                        onClick={() => setSelectedPaymentForReceipt(item)}
                                                                        style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem' }}
                                                                    >
                                                                        <i className="fa-solid fa-receipt"></i>
                                                                        {isCompleted ? 'View Bill' : 'View Slip'}
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* ======================================================== */}
                    {/* TAB: PROFILE */}
                    {/* ======================================================== */}
                    {activeTab === 'profile' && (
                        <FarmerProfileView 
                            user={{ ...user, name: profileName || user.name, altPhone: profileAltPhone || user.altPhone }}
                            crops={crops}
                            enquiries={enquiries}
                            onProfileUpdated={(updated) => {
                                if (updated.name) setProfileName(updated.name);
                                if (updated.altPhone) setProfileAltPhone(updated.altPhone);
                            }}
                            onLogout={handleLogout}
                        />
                    )}

                </div>

                {/* Mobile Bottom Navigation */}
                <div className="mobile-nav-bar">
                    <button className={`mobile-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
                        <i className="fa-solid fa-house"></i>
                        <span>Home</span>
                    </button>
                    <button className={`mobile-nav-btn ${activeTab === 'crops' ? 'active' : ''}`} onClick={() => setActiveTab('crops')}>
                        <i className="fa-solid fa-wheat-awn"></i>
                        <span>Crops</span>
                    </button>
                    <button className={`mobile-nav-btn ${activeTab === 'qrcodes' ? 'active' : ''}`} onClick={() => setActiveTab('qrcodes')}>
                        <i className="fa-solid fa-qrcode"></i>
                        <span>QR</span>
                    </button>
                    <button className={`mobile-nav-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
                        <i className="fa-solid fa-clock-rotate-left"></i>
                        <span>History</span>
                    </button>
                    <button className="mobile-nav-btn" onClick={() => setIsSidebarOpen(true)}>
                        <i className="fa-solid fa-bars"></i>
                        <span>More</span>
                    </button>
                </div>
            </main>

            {/* MODALS */}
            {isAddCropOpen && <AddCropModal onClose={() => setIsAddCropOpen(false)} onSaveCrop={handleSaveCrop} />}
            
            {selectedMillForEnquiry && (
                <SendEnquiryModal
                    onClose={() => setSelectedMillForEnquiry(null)}
                    mill={selectedMillForEnquiry}
                    crop={selectedCropForSearch}
                    user={user}
                    onEnquiryCreated={() => {
                        fetchEnquiriesData();
                        setActiveTab('enquiries');
                    }}
                />
            )}

            {selectedEnquiryForQr && (
                <QrCodeModal
                    enquiry={selectedEnquiryForQr}
                    onClose={() => setSelectedEnquiryForQr(null)}
                />
            )}

            {/* ======================================================== */}
            {/* MODAL: VIEW FARMER PAYMENT RECEIPT */}
            {/* ======================================================== */}
            {selectedPaymentForReceipt && (
                <div className="modal-overlay" style={{ zIndex: 9999 }}>
                    <div className="modal-content" style={{ maxWidth: '520px', width: '92%', background: '#0d1712', border: '1px solid rgba(16, 185, 129, 0.35)', borderRadius: '1.25rem', padding: '1.75rem', color: '#f0fdf4' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <i className="fa-solid fa-receipt" style={{ color: 'var(--primary)', fontSize: '1.3rem' }}></i>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Produce Payment Receipt</h3>
                            </div>
                            <button className="action-btn text-btn" onClick={() => setSelectedPaymentForReceipt(null)} style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                <i className="fa-solid fa-xmark" style={{ fontSize: '1.25rem' }}></i>
                            </button>
                        </div>

                        <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '0.75rem', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
                            <div style={{ textAlign: 'center', borderBottom: '1px dashed rgba(255,255,255,0.15)', paddingBottom: '0.75rem', marginBottom: '0.5rem' }}>
                                <span className="status-badge" style={{
                                    background: (selectedPaymentForReceipt.payment_status || 'PENDING').toUpperCase() === 'COMPLETED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(234, 179, 8, 0.15)',
                                    color: (selectedPaymentForReceipt.payment_status || 'PENDING').toUpperCase() === 'COMPLETED' ? 'var(--primary)' : '#fbbf24',
                                    fontWeight: 800,
                                    padding: '0.35rem 0.8rem',
                                    borderRadius: '1rem',
                                    fontSize: '0.8rem'
                                }}>
                                    {(selectedPaymentForReceipt.payment_status || 'PENDING').toUpperCase() === 'COMPLETED' ? '✓ SETTLEMENT COMPLETED' : '⏳ PAYMENT PENDING AT MILL'}
                                </span>
                                <h3 style={{ margin: '0.6rem 0 0.2rem 0', color: 'var(--accent-gold)', fontSize: '1.6rem' }}>
                                    ₹{selectedPaymentForReceipt.total_amount?.toLocaleString('en-IN')}
                                </h3>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {selectedPaymentForReceipt.paid_at
                                        ? `Paid on ${new Date(selectedPaymentForReceipt.paid_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`
                                        : `Weighed on ${new Date(selectedPaymentForReceipt.received_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`}
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Enquiry Code:</span>
                                <strong style={{ fontFamily: 'monospace' }}>{selectedPaymentForReceipt.enquiry_code}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Purchaser Mill:</span>
                                <strong>{selectedPaymentForReceipt.mill_name}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Crop Delivered:</span>
                                <strong style={{ color: 'var(--primary)' }}>{selectedPaymentForReceipt.crop_name}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Received Weight:</span>
                                <strong>{selectedPaymentForReceipt.quantity_tonnes} Tonnes ({selectedPaymentForReceipt.quantity_quintals} Quintals)</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Agreed Rate:</span>
                                <strong>₹{selectedPaymentForReceipt.price_per_quintal} / Quintal</strong>
                            </div>
                            {selectedPaymentForReceipt.payment_method && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Payment Method:</span>
                                    <strong>{selectedPaymentForReceipt.payment_method}</strong>
                                </div>
                            )}
                            {selectedPaymentForReceipt.transaction_reference && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>UTR Reference:</span>
                                    <strong style={{ fontFamily: 'monospace', color: 'var(--accent-gold)' }}>{selectedPaymentForReceipt.transaction_reference}</strong>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                            <button className="action-btn" onClick={() => window.print()} style={{ flex: 1, justifyContent: 'center' }}>
                                <i className="fa-solid fa-print"></i> Print
                            </button>
                            <button className="primary-btn" onClick={() => setSelectedPaymentForReceipt(null)} style={{ flex: 1, justifyContent: 'center' }}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* MODAL: UPDATE FARMER BANK DETAILS */}
            {/* ======================================================== */}
            {isEditBankModalOpen && (
                <div className="modal-overlay" style={{ zIndex: 9999 }}>
                    <div className="modal-content" style={{ maxWidth: '520px', width: '92%', background: '#0d1712', border: '1px solid rgba(16, 185, 129, 0.35)', borderRadius: '1.25rem', padding: '1.5rem', color: '#f0fdf4' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <i className="fa-solid fa-building-columns" style={{ color: 'var(--primary)', fontSize: '1.3rem' }}></i>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Update Bank Account</h3>
                            </div>
                            <button className="action-btn text-btn" onClick={() => setIsEditBankModalOpen(false)} style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                <i className="fa-solid fa-xmark" style={{ fontSize: '1.25rem' }}></i>
                            </button>
                        </div>

                        <form onSubmit={handleSaveBankDetails} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>
                                    Account Holder Name *
                                </label>
                                <div className="input-group">
                                    <i className="fa-solid fa-user"></i>
                                    <input
                                        type="text"
                                        value={editBankHolder}
                                        onChange={(e) => setEditBankHolder(e.target.value)}
                                        required
                                        style={{ background: 'transparent', width: '100%' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>
                                    Bank Name *
                                </label>
                                <div className="input-group">
                                    <i className="fa-solid fa-building-columns"></i>
                                    <input
                                        type="text"
                                        value={editBankName}
                                        onChange={(e) => setEditBankName(e.target.value)}
                                        required
                                        style={{ background: 'transparent', width: '100%' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>
                                        Account Number *
                                    </label>
                                    <div className="input-group">
                                        <i className="fa-solid fa-credit-card"></i>
                                        <input
                                            type="text"
                                            value={editBankAccount}
                                            onChange={(e) => setEditBankAccount(e.target.value)}
                                            required
                                            style={{ background: 'transparent', width: '100%', fontFamily: 'monospace' }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>
                                        IFSC Code *
                                    </label>
                                    <div className="input-group">
                                        <i className="fa-solid fa-code"></i>
                                        <input
                                            type="text"
                                            value={editBankIfsc}
                                            onChange={(e) => setEditBankIfsc(e.target.value.toUpperCase())}
                                            required
                                            style={{ background: 'transparent', width: '100%', fontFamily: 'monospace' }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>
                                    UPI ID (For Instant Phone Transfers)
                                </label>
                                <div className="input-group">
                                    <i className="fa-solid fa-mobile-screen"></i>
                                    <input
                                        type="text"
                                        value={editBankUpi}
                                        onChange={(e) => setEditBankUpi(e.target.value)}
                                        placeholder="phone@upi"
                                        style={{ background: 'transparent', width: '100%', fontFamily: 'monospace' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button type="button" className="text-btn" onClick={() => setIsEditBankModalOpen(false)} style={{ flex: 1, justifyContent: 'center', padding: '0.8rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                                    Cancel
                                </button>
                                <button type="submit" className="primary-btn" disabled={isSavingBank} style={{ flex: 1.5, justifyContent: 'center', padding: '0.8rem', fontWeight: 800 }}>
                                    {isSavingBank ? 'Saving...' : 'Save Bank Details'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Sandbox / Demo Payout Modal */}
            <SandboxPayoutModal
                isOpen={showSandboxPayoutModal}
                onClose={() => setShowSandboxPayoutModal(false)}
                farmerPhone={user.phone}
                bankDetails={farmerBankDetails}
                onPaymentSuccess={() => {
                    fetchPaymentsData();
                }}
            />

            {/* Razorpay Standard Checkout Modal */}
            <RazorpayCheckoutModal
                isOpen={showRazorpayModal}
                onClose={() => setShowRazorpayModal(false)}
                defaultAmount={500}
                title="Razorpay Standard Web Checkout"
                description="Direct Farmer Payout / Settlement"
                recipientName={user?.name || 'Farmer'}
                recipientPhone={user?.phone || ''}
                onPaymentSuccess={() => {
                    fetchPaymentsData();
                }}
            />

            {/* LIGHTBOX MODAL FOR CROP & VEHICLE PHOTOS */}
            {cropLightboxImage && (
                <div 
                    className="modal-overlay" 
                    style={{ zIndex: 10001, background: 'rgba(0, 0, 0, 0.88)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
                    onClick={() => setCropLightboxImage(null)}
                >
                    <div 
                        className="bento-card" 
                        style={{ maxWidth: '650px', width: '100%', padding: '1.25rem', position: 'relative', border: '1px solid rgba(255,255,255,0.2)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h4 style={{ margin: 0, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <i className="fa-solid fa-image" style={{ color: 'var(--primary)' }}></i>
                                {cropLightboxImage.title || 'Photo Preview'}
                            </h4>
                            <button 
                                className="action-btn text-btn" 
                                onClick={() => setCropLightboxImage(null)}
                                style={{ width: '28px', height: '28px', padding: 0 }}
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <div style={{ maxHeight: '65vh', borderRadius: '0.5rem', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', marginBottom: cropLightboxImage.cropId ? '1rem' : '0' }}>
                            <img 
                                src={cropLightboxImage.url} 
                                alt="Full Photo View" 
                                style={{ width: '100%', height: 'auto', maxHeight: '65vh', objectFit: 'contain' }} 
                            />
                        </div>

                        {/* Re-upload / Replace & Remove Photo Toolbar inside Lightbox */}
                        {cropLightboxImage.cropId && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                                    <label 
                                        className="action-btn"
                                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', padding: '0.4rem 0.8rem', background: 'rgba(255,255,255,0.08)' }}
                                        title="Re-upload a new photo if this one is incorrect"
                                    >
                                        <i className="fa-solid fa-arrows-rotate" style={{ color: 'var(--accent-gold)' }}></i>
                                        <span>Re-upload New Photo</span>
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            capture="environment" 
                                            style={{ display: 'none' }} 
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    const file = e.target.files[0];
                                                    e.target.value = '';
                                                    handleUpdateCropImage(cropLightboxImage.cropId, file);
                                                }
                                            }}
                                        />
                                    </label>

                                    <button
                                        type="button"
                                        className="action-btn text-btn"
                                        style={{ color: '#ff6b6b', fontSize: '0.8rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                                        onClick={() => {
                                            if (window.confirm("Remove this photo? You can re-upload a new photo anytime.")) {
                                                handleUpdateCropImage(cropLightboxImage.cropId, '');
                                                setCropLightboxImage(null);
                                            }
                                        }}
                                        title="Remove wrong photo"
                                    >
                                        <i className="fa-solid fa-trash-can"></i>
                                        <span>Remove Photo</span>
                                    </button>
                                </div>

                                <button 
                                    className="primary-btn" 
                                    onClick={() => setCropLightboxImage(null)}
                                    style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}
                                >
                                    Done
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
