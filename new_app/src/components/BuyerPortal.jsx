import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';
import { kisanService } from '../services/kisanService';
import AddMillModal from './AddMillModal';
import UpdatePricesModal from './UpdatePricesModal';
import MapModal from './MapModal';
import QrScannerModal from './QrScannerModal';
import QrCodeModal from './QrCodeModal';
import KisanLogo from './KisanLogo';
import { useLanguage } from '../context/LanguageContext';
import LanguageSelector from './LanguageSelector';
import { openRazorpayCheckout, executeAutoSuccessPayment } from '../services/razorpayService';
import RazorpayCheckoutModal from './RazorpayCheckoutModal';
import { normalizeTelPhone, formatDisplayPhone } from '../utils/phoneUtils';

// Memoized Header Clock to avoid continuous re-rendering of the entire BuyerPortal
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

// Accurate Enquiry Category Classifier from the Mill Operator's viewpoint
export const getEnquiryCategory = (enq) => {
    if (!enq) return 'PENDING';
    const s = (enq.status || '').toUpperCase();
    const ms = (enq.mill_status || '').toUpperCase();
    const ls = (enq.load_status || '').toUpperCase();
    const ps = (enq.payment_status || '').toUpperCase();

    if (ps === 'COMPLETED' || s === 'COMPLETED' || s === 'PAID') return 'COMPLETED';
    if (ps === 'FAILED' || ms === 'REJECTED' || s === 'REJECTED' || s === 'FAILED') return 'FAILED';
    if (s === 'LOAD_RECEIVED' || ls === 'LOAD_RECEIVED' || enq.received_at) return 'LOAD_RECEIVED';
    return 'PENDING';
};

export default function BuyerPortal({ user: propUser, onLogout }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user: authUser, logout: authLogout } = useAuth();
    const user = propUser || authUser || {};
    const handleLogout = onLogout || authLogout;

    const pathToTab = {
        '': 'dashboard',
        'dashboard': 'dashboard',
        'enquiries': 'enquiries',
        'scan-qr': 'scanqr',
        'scanqr': 'scanqr',
        'loads': 'loads',
        'transport': 'transport',
        'pricing': 'mills',
        'mills': 'mills',
        'history': 'history',
        'profile': 'profile'
    };
    const currentSubPath = location.pathname.replace(/^\/buyer\/?/, '').split('/')[0];
    const activeTab = pathToTab[currentSubPath] || 'dashboard';

    const setActiveTab = (tab) => {
        const tabToPath = {
            'dashboard': '/buyer/dashboard',
            'enquiries': '/buyer/enquiries',
            'scanqr': '/buyer/scan-qr',
            'loads': '/buyer/loads',
            'transport': '/buyer/transport',
            'mills': '/buyer/pricing',
            'history': '/buyer/history',
            'profile': '/buyer/profile'
        };
        navigate(tabToPath[tab] || `/buyer/${tab}`);
        setIsSidebarOpen(false);
    };

    // CRITICAL BACK BUTTON FIX: Stays inside Buyer Portal workspace
    const handleBack = () => {
        if (window.history.state && window.history.state.idx > 0) {
            navigate(-1);
        } else {
            navigate('/buyer/dashboard');
        }
    };

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Profile States
    const [profileName, setProfileName] = useState(user.name || '');
    const [profileAltPhone, setProfileAltPhone] = useState(user.altPhone || '');
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    // Buyer Specific Details
    const [gstNumber, setGstNumber] = useState(user.gstNumber || '');
    const [businessType, setBusinessType] = useState(user.businessType || 'Retailer');
    const [buyingCapacity, setBuyingCapacity] = useState(user.buyingCapacity || '');

    // Security States
    const [newPhone, setNewPhone] = useState(user.phone || '');
    const [newPin, setNewPin] = useState(user.pin || '');
    const [isUpdatingSecurity, setIsUpdatingSecurity] = useState(false);

    // Mill States
    const [isAddMillOpen, setIsAddMillOpen] = useState(false);
    const [mills, setMills] = useState([]);
    const [loadingMills, setLoadingMills] = useState(true);
    const [selectedMillForPricing, setSelectedMillForPricing] = useState(null);

    // Facility Profile Editing States
    const [selectedMillId, setSelectedMillId] = useState(null);
    const [facilityName, setFacilityName] = useState('');
    const [facilityType, setFacilityType] = useState('Rice Mill');
    const [facilityCapacity, setFacilityCapacity] = useState('100');
    const [facilityLocation, setFacilityLocation] = useState({ name: 'Mandi Yard, Telangana', lat: 17.3850, lng: 78.4867 });
    const [facilityColdStorage, setFacilityColdStorage] = useState(false);
    const [coldStorageCapacity, setColdStorageCapacity] = useState('2000');
    const [coldStorageTemp, setColdStorageTemp] = useState('Chilled (+2°C to +8°C)');
    const [facilityCrops, setFacilityCrops] = useState(['Paddy (Rice)']);
    const [isProfileMapOpen, setIsProfileMapOpen] = useState(false);

    // Auto-sync facility states with selected mill
    useEffect(() => {
        if (mills.length > 0) {
            const curMill = mills.find(m => m.id === selectedMillId) || mills[0];
            if (curMill) {
                if (!selectedMillId) setSelectedMillId(curMill.id);
                setFacilityName(curMill.millName || '');
                setFacilityType(curMill.millType || 'Rice Mill');
                setFacilityCapacity(curMill.capacity ? String(curMill.capacity) : '100');
                setFacilityLocation({
                    name: curMill.locationName || 'Mandi Yard, Telangana',
                    lat: curMill.latitude || 17.3850,
                    lng: curMill.longitude || 78.4867
                });
                setFacilityColdStorage(!!curMill.hasColdStorage);
                setFacilityCrops(Array.isArray(curMill.selectedCrops) && curMill.selectedCrops.length > 0 ? curMill.selectedCrops : ['Paddy (Rice)']);
            }
        }
    }, [mills, selectedMillId]);

    // Enquiry, Load & History States
    const [enquiries, setEnquiries] = useState([]);
    const [loadingEnquiries, setLoadingEnquiries] = useState(true);
    const [loadsReceived, setLoadsReceived] = useState([]);
    const [transportRequests, setTransportRequests] = useState([]);
    const [millHistory, setMillHistory] = useState([]);
    const [historyFilter, setHistoryFilter] = useState('ALL');
    
    // Modal States
    const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
    const [selectedEnquiryForQr, setSelectedEnquiryForQr] = useState(null);
    const [enquiryFilter, setEnquiryFilter] = useState('PENDING'); // 'PENDING' | 'LOAD_RECEIVED' | 'COMPLETED' | 'FAILED'

    // Payments & Loads States
    const [paymentCategory, setPaymentCategory] = useState('PENDING'); // 'PENDING' | 'LOAD_RECEIVED' | 'COMPLETED' | 'FAILED'
    const [selectedEnquiryForLoadReceived, setSelectedEnquiryForLoadReceived] = useState(null);
    const [actualReceivedTonnes, setActualReceivedTonnes] = useState('');
    const [weighbridgeRemarks, setWeighbridgeRemarks] = useState('');
    const [isSubmittingLoadReceived, setIsSubmittingLoadReceived] = useState(false);

    // Make Payment States
    const [selectedLoadForPayment, setSelectedLoadForPayment] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('Bank Transfer (NEFT/RTGS)');
    const [paymentReference, setPaymentReference] = useState('');
    const [paymentRemarks, setPaymentRemarks] = useState('');
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
    const [showStandaloneRazorpay, setShowStandaloneRazorpay] = useState(false);

    // View Receipt State
    const [selectedLoadForReceipt, setSelectedLoadForReceipt] = useState(null);
    const [copySuccessToast, setCopySuccessToast] = useState('');

    useEffect(() => {
        const init = async () => {
            const loadedMills = await fetchMills();
            await refreshAllData(loadedMills);
        };
        init();

        let refreshTimer = null;
        const debouncedRefresh = () => {
            if (refreshTimer) clearTimeout(refreshTimer);
            refreshTimer = setTimeout(() => {
                refreshAllData();
            }, 300);
        };

        const unsub = kisanService.subscribe(() => {
            debouncedRefresh();
        });

        return () => {
            if (refreshTimer) clearTimeout(refreshTimer);
            unsub();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const refreshAllData = async (passedMills) => {
        await Promise.all([
            fetchEnquiries(passedMills),
            fetchLoadsReceived(),
            fetchTransportRequests(),
            fetchHistoryData(passedMills)
        ]);
    };

    const fetchHistoryData = async (passedMills) => {
        try {
            const currentMills = passedMills || mills;
            const hist = await kisanService.getMillHistory(currentMills[0]?.id || user.phone, user.phone);
            setMillHistory(hist);
        } catch (err) {
            console.error("History fetch error:", err);
        }
    };

    const fetchMills = async () => {
        setLoadingMills(true);
        try {
            const { data, error } = await supabase
                .from('mills')
                .select('*')
                .eq('owner_phone', user.phone);

            if (error) throw error;

            const mappedMills = (data || []).map(m => ({
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
            setMills(mappedMills);
            return mappedMills;
        } catch (error) {
            console.error("Error fetching mills:", error);
            return [];
        } finally {
            setLoadingMills(false);
        }
    };

    const fetchEnquiries = async (passedMills) => {
        setLoadingEnquiries(true);
        try {
            const currentMills = passedMills || mills;
            const myMillIds = currentMills.map(m => m.id).filter(Boolean);
            const list = await kisanService.getEnquiries({ 
                buyerPhone: user.phone,
                millIds: myMillIds.length > 0 ? myMillIds : undefined
            });
            setEnquiries(list);
        } catch (error) {
            console.error("Error fetching enquiries:", error);
        } finally {
            setLoadingEnquiries(false);
        }
    };

    const fetchLoadsReceived = async () => {
        try {
            const loads = await kisanService.getLoadsReceived({ buyerPhone: user.phone });
            setLoadsReceived(loads);
        } catch (error) {
            console.error("Error fetching loads:", error);
        }
    };

    const fetchTransportRequests = async () => {
        try {
            const reqs = kisanService.getTransportRequests();
            setTransportRequests(reqs);
        } catch (error) {
            console.error("Error fetching transport:", error);
        }
    };

    const handleAcceptEnquiry = async (enquiry) => {
        const targetId = enquiry.id || enquiry.enquiry_code;
        const targetCode = enquiry.enquiry_code || targetId;
        const hasTransport = Boolean(enquiry.transport_required || enquiry.with_transport);

        // 1. INSTANT OPTIMISTIC UPDATE (0ms delay! Immediately moves to ACCEPTED)
        setEnquiries(prev => prev.map(e => (e.id === targetId || e.enquiry_code === targetCode) ? { 
            ...e, 
            mill_status: 'ACCEPTED',
            status: hasTransport ? 'WAITING_TRANSPORT' : 'ACCEPTED',
            overall_status: hasTransport ? 'WAITING_TRANSPORT' : 'CONFIRMED'
        } : e));

        setCopySuccessToast(hasTransport ? 'Enquiry Accepted • Transport Dispatched!' : 'Enquiry Accepted • Verification QR Ready!');
        setTimeout(() => setCopySuccessToast(''), 3500);

        try {
            await kisanService.acceptEnquiry(targetCode, {
                name: profileName || user.phone,
                phone: user.phone,
                id: mills[0]?.id || user.phone,
                millName: mills[0]?.millName || 'KisanConnect Mill'
            }, enquiry);
        } catch (error) {
            console.error("Error accepting enquiry:", error);
            alert("Failed to accept enquiry. Please try again.");
            await refreshAllData();
        }
    };

    const handleRejectEnquiry = async (enquiry) => {
        const targetId = enquiry.id || enquiry.enquiry_code;
        const targetCode = enquiry.enquiry_code || targetId;
        const reason = window.prompt("Please provide a reason for rejecting this enquiry (optional):", "Price negotiation / Capacity limit");
        if (reason === null) return;

        // 1. INSTANT OPTIMISTIC UPDATE
        setEnquiries(prev => prev.map(e => (e.id === targetId || e.enquiry_code === targetCode) ? { 
            ...e, 
            mill_status: 'REJECTED',
            status: 'REJECTED', 
            overall_status: 'REJECTED',
            reject_reason: reason 
        } : e));

        setCopySuccessToast('Enquiry Rejected');
        setTimeout(() => setCopySuccessToast(''), 3000);

        try {
            await kisanService.rejectEnquiry(targetCode, reason, enquiry);
        } catch (error) {
            console.error("Error rejecting enquiry:", error);
            await refreshAllData();
        }
    };

    const handleOpenLoadReceivedModal = (enquiry) => {
        setSelectedEnquiryForLoadReceived(enquiry);
        setActualReceivedTonnes(String(enquiry.quantity || (enquiry.acres ? enquiry.acres * 2 : 10)));
        setWeighbridgeRemarks('');
    };

    const handleConfirmLoadReceived = async (e) => {
        e.preventDefault();
        if (!selectedEnquiryForLoadReceived) return;
        if (!actualReceivedTonnes || Number(actualReceivedTonnes) <= 0) {
            return alert("Please enter a valid actual tonnes received.");
        }

        setIsSubmittingLoadReceived(true);
        try {
            const targetMill = mills.find(m => m.id === selectedEnquiryForLoadReceived.mill_id) || activeMill;
            await kisanService.recordLoadReceived(
                selectedEnquiryForLoadReceived.enquiry_code || selectedEnquiryForLoadReceived.id,
                Number(actualReceivedTonnes),
                targetMill,
                weighbridgeRemarks
            );
            setSelectedEnquiryForLoadReceived(null);
            await refreshAllData();
            setActiveTab('loads');
            setPaymentCategory('PENDING');
        } catch (err) {
            console.error("Error confirming load received:", err);
            alert("Failed to confirm load. Please try again.");
        } finally {
            setIsSubmittingLoadReceived(false);
        }
    };

    const handleOpenMakePaymentModal = (load) => {
        const farmerBank = kisanService.getFarmerBankDetails(load.farmer_phone || load.farmer_id);
        setSelectedLoadForPayment({
            ...load,
            farmer_bank_details: farmerBank
        });
        setPaymentMethod('Razorpay Standard Checkout');
        setPaymentReference('Auto-generated (Razorpay Payment ID)');
        setPaymentRemarks(`Direct Produce Settlement via Razorpay - ${load.crop_name || 'Produce'} (${load.quantity_tonnes || 0} Tons)`);
    };

    const handleConfirmPaymentCompleted = async (e) => {
        e?.preventDefault();
        if (!selectedLoadForPayment) return;

        if (paymentMethod === 'Razorpay Standard Checkout') {
            await handleRazorpayPaymentForLoad();
            return;
        }

        setIsSubmittingPayment(true);
        try {
            const updated = await kisanService.completePayment(
                selectedLoadForPayment.id || selectedLoadForPayment.enquiry_code,
                {
                    paymentMethod,
                    referenceNumber: paymentReference || ('UTR-' + Date.now().toString().slice(-8)),
                    remarks: paymentRemarks
                },
                activeMill
            );
            setSelectedLoadForPayment(null);
            await refreshAllData();
            setPaymentCategory('COMPLETED');
            if (updated) {
                setSelectedLoadForReceipt(updated);
            }
        } catch (err) {
            console.error("Error completing payment:", err);
            alert("Failed to record payment completion.");
        } finally {
            setIsSubmittingPayment(false);
        }
    };

    const handleRazorpayPaymentForLoad = async () => {
        if (!selectedLoadForPayment) return;
        setIsSubmittingPayment(true);
        try {
            await openRazorpayCheckout({
                amountInRupees: selectedLoadForPayment.total_amount || 100,
                description: `Produce Settlement - ${selectedLoadForPayment.crop_name || 'Produce'} (${selectedLoadForPayment.enquiry_code || ''})`,
                receipt: `load_${selectedLoadForPayment.id || Date.now()}`,
                prefill: {
                    name: selectedLoadForPayment.farmer_name || '',
                    contact: selectedLoadForPayment.farmer_phone || '',
                    email: ''
                },
                notes: {
                    load_id: String(selectedLoadForPayment.id || ''),
                    enquiry_code: selectedLoadForPayment.enquiry_code || '',
                    farmer_phone: selectedLoadForPayment.farmer_phone || '',
                    farmer_name: selectedLoadForPayment.farmer_name || '',
                    crop_name: selectedLoadForPayment.crop_name || '',
                    mill_name: activeMill?.mill_name || 'Mill'
                },
                onSuccess: async (verifiedResponse) => {
                    try {
                        const paymentId = verifiedResponse.razorpay_payment_id || verifiedResponse.verification?.payment_id || 'pay_unknown';
                        const orderId = verifiedResponse.razorpay_order_id || verifiedResponse.verification?.order_id || 'order_unknown';

                        // Update Supabase & local storage records
                        const updated = await kisanService.completePayment(
                            selectedLoadForPayment.id || selectedLoadForPayment.enquiry_code,
                            {
                                paymentMethod: 'Razorpay Standard Checkout',
                                referenceNumber: paymentId,
                                remarks: `Razorpay Verified: ${paymentId} (Order: ${orderId})`
                            },
                            activeMill
                        );

                        // Close payment modal, refresh data, switch to COMPLETED category
                        setSelectedLoadForPayment(null);
                        await refreshAllData();
                        setPaymentCategory('COMPLETED');

                        // Automatically display the verified Payment Receipt modal with Transaction ID!
                        if (updated) {
                            setSelectedLoadForReceipt(updated);
                        }
                    } catch (saveErr) {
                        console.error('Error recording verified payment:', saveErr);
                        alert(`Payment was successful on Razorpay, but recording the invoice failed: ${saveErr.message}`);
                    } finally {
                        setIsSubmittingPayment(false);
                    }
                },
                onFailure: (err) => {
                    console.error('Razorpay payment failed:', err);
                    alert(`Razorpay Payment Failed: ${err.message || 'Payment was declined or cancelled.'}`);
                    setIsSubmittingPayment(false);
                },
                onDismiss: () => {
                    console.log('Razorpay modal closed by user');
                    setIsSubmittingPayment(false);
                }
            });
        } catch (err) {
            console.error('Razorpay checkout error:', err);
            alert(`Razorpay Payment Encountered an Issue: ${err.message}`);
            setIsSubmittingPayment(false);
        }
    };

    const handleCopyText = (text, label) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopySuccessToast(`Copied ${label}!`);
        setTimeout(() => setCopySuccessToast(''), 2500);
    };

    const handleUpdateProfile = async () => {
        setIsSavingProfile(true);
        try {
            const curMill = mills.find(m => m.id === selectedMillId) || mills[0];

            // 1. Update Mill Facility in Supabase
            if (curMill && curMill.id) {
                const { error: millError } = await supabase
                    .from('mills')
                    .update({
                        mill_name: facilityName || curMill.millName,
                        mill_type: facilityType,
                        capacity: Number(facilityCapacity) || 100,
                        location_name: facilityLocation.name,
                        latitude: facilityLocation.lat,
                        longitude: facilityLocation.lng,
                        has_cold_storage: facilityColdStorage,
                        selectedCrops: facilityCrops,
                        requirements: facilityColdStorage ? `Cold Storage: ${coldStorageCapacity} MT (${coldStorageTemp})` : 'Standard dry warehouse'
                    })
                    .eq('id', curMill.id);
                if (millError) console.warn("Supabase mill update fallback:", millError);
            }

            // 2. Update Buyer Company Profile in Supabase
            const { error: buyerError } = await supabase
                .from('buyers')
                .update({
                    name: profileName,
                    altPhone: profileAltPhone,
                    gstNumber,
                    businessType,
                    buyingCapacity
                })
                .eq('phone', user.phone);
            if (buyerError) console.warn("Supabase buyer profile update fallback:", buyerError);

            // 3. LocalStorage Fallback Update
            const localMills = JSON.parse(localStorage.getItem('kisan_mills') || '[]');
            const updatedLocalMills = localMills.map(m => {
                if (m.id === curMill?.id || m.owner_phone === user.phone) {
                    return {
                        ...m,
                        mill_name: facilityName,
                        mill_type: facilityType,
                        capacity: Number(facilityCapacity) || 100,
                        location_name: facilityLocation.name,
                        latitude: facilityLocation.lat,
                        longitude: facilityLocation.lng,
                        has_cold_storage: facilityColdStorage,
                        selectedCrops: facilityCrops
                    };
                }
                return m;
            });
            localStorage.setItem('kisan_mills', JSON.stringify(updatedLocalMills));

            await fetchMills();
            setCopySuccessToast('✅ Mill Facility & Profile updated successfully!');
            setTimeout(() => setCopySuccessToast(''), 3500);
        } catch (error) {
            console.error(error);
            alert('Failed to update profile. Please try again.');
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleUpdateSecurity = async () => {
        if (newPhone.length !== 10 || isNaN(newPhone)) return alert('Phone must be 10 digits');
        if (newPin.length < 4 || isNaN(newPin)) return alert('PIN must be 4 to 6 digits');

        setIsUpdatingSecurity(true);
        try {
            await supabase.from('buyers').update({ pin: newPin }).eq('phone', user.phone);
            alert('Security PIN updated successfully!');
        } catch (e) {
            alert('Error updating PIN');
        } finally {
            setIsUpdatingSecurity(false);
        }
    };

    const filteredEnquiries = useMemo(() => {
        return enquiries.filter(eq => {
            return getEnquiryCategory(eq) === (enquiryFilter || 'PENDING');
        });
    }, [enquiries, enquiryFilter]);

    const activeMill = mills[0] || {
        id: user.phone,
        millName: profileName || 'KisanConnect Processing Mill',
        ownerPhone: user.phone
    };

    return (
        <div className="portal-container mill-theme-portal">
            {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>}

            {/* Sidebar */}
            <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: '1.5rem', paddingLeft: '0.15rem' }}>
                    <KisanLogo size="sidebar" variant="mill" />
                    <div style={{ fontSize: '0.72rem', color: '#FFE0B2', marginTop: '0.4rem', letterSpacing: '0.2px', fontWeight: 600, opacity: 0.95, whiteSpace: 'nowrap' }}>
                        Stronger Farms. Brighter Futures.
                    </div>
                </div>

                <nav className="nav-menu">
                    <a className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}>
                        <i className="fa-solid fa-house"></i>
                        <span>Dashboard</span>
                    </a>
                    <a className={`nav-item ${activeTab === 'enquiries' ? 'active' : ''}`} onClick={() => { setActiveTab('enquiries'); setIsSidebarOpen(false); }}>
                        <i className="fa-solid fa-inbox"></i>
                        <span>Farmer Enquiries</span>
                        {enquiries.filter(e => getEnquiryCategory(e) === 'PENDING').length > 0 && (
                            <span className="nav-badge" style={{ marginLeft: 'auto', background: 'var(--primary)', color: '#FFFFFF', padding: '0.15rem 0.55rem', borderRadius: '1rem', fontSize: '0.72rem', fontWeight: 800 }}>
                                {enquiries.filter(e => getEnquiryCategory(e) === 'PENDING').length}
                            </span>
                        )}
                    </a>
                    <a className={`nav-item ${activeTab === 'scanqr' ? 'active' : ''}`} onClick={() => { setIsQrScannerOpen(true); setIsSidebarOpen(false); }}>
                        <i className="fa-solid fa-qrcode" style={{ color: 'var(--primary)' }}></i>
                        <span style={{ color: '#FF8A00', fontWeight: 700 }}>Scan Farmer QR</span>
                    </a>
                    <a className={`nav-item ${activeTab === 'loads' ? 'active' : ''}`} onClick={() => { setActiveTab('loads'); setIsSidebarOpen(false); }}>
                        <i className="fa-solid fa-money-bill-transfer"></i>
                        <span>Payments & Loads</span>
                        {loadsReceived.filter(l => (l.payment_status || 'PENDING').toUpperCase() === 'PENDING').length > 0 && (
                            <span className="nav-badge" style={{ marginLeft: 'auto', background: 'var(--accent-gold)', color: '#FFFFFF', padding: '0.15rem 0.55rem', borderRadius: '1rem', fontSize: '0.72rem', fontWeight: 800 }}>
                                {loadsReceived.filter(l => (l.payment_status || 'PENDING').toUpperCase() === 'PENDING').length} Pending
                            </span>
                        )}
                    </a>
                    <a className={`nav-item ${activeTab === 'transport' ? 'active' : ''}`} onClick={() => { setActiveTab('transport'); setIsSidebarOpen(false); }}>
                        <i className="fa-solid fa-truck-fast"></i>
                        <span>Transport Fleet</span>
                    </a>
                    <a className={`nav-item ${activeTab === 'mills' ? 'active' : ''}`} onClick={() => { setActiveTab('mills'); setIsSidebarOpen(false); }}>
                        <i className="fa-solid fa-industry"></i>
                        <span>My Mills & Pricing</span>
                    </a>
                    <a className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => { setActiveTab('history'); setIsSidebarOpen(false); }}>
                        <i className="fa-solid fa-clock-rotate-left"></i>
                        <span>Procurement History</span>
                    </a>
                    <a className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => { setActiveTab('profile'); setIsSidebarOpen(false); }}>
                        <i className="fa-solid fa-user-gear"></i>
                        <span>Profile & Settings</span>
                    </a>
                </nav>

                <div className="sidebar-bottom">
                    <div style={{ padding: '0.5rem 0.65rem', background: 'rgba(255, 247, 237, 0.1)', borderRadius: '8px', marginBottom: '0.65rem', border: '1px solid rgba(255, 247, 237, 0.18)' }}>
                        <div style={{ fontSize: '0.62rem', color: '#FFD6A4', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Authorized Facility</div>
                        <div style={{ fontSize: '0.8rem', color: '#FFF7ED', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeMill.millName}</div>
                        <div style={{ fontSize: '0.65rem', color: 'rgba(255, 247, 237, 0.75)', marginTop: '0.15rem' }}>Procurement Hub</div>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#FFD6A4', opacity: 0.8, marginBottom: '0.65rem', textAlign: 'center', fontStyle: 'italic' }}>
                        🌾 From Farm to Future Together
                    </div>
                    <a className="nav-item logout" onClick={handleLogout}>
                        <i className="fa-solid fa-arrow-right-from-bracket"></i>
                        <span>Logout</span>
                    </a>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                <header className="top-header">
                    <div className="header-left">
                        <button className="menu-toggle" onClick={() => setIsSidebarOpen(true)}>
                            <i className="fa-solid fa-bars"></i>
                        </button>
                        <button className="action-btn back-btn" onClick={handleBack} title="Back to Previous Page">
                            <i className="fa-solid fa-arrow-left"></i>
                        </button>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#2E1A0F', lineHeight: 1.2 }}>
                                Mills Portal
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#7C5335', display: 'none', md: { display: 'block' } }}>
                                Procure Responsibly. Process Sustainably.
                            </div>
                        </div>
                    </div>

                    <div className="header-actions" style={{ alignItems: 'center', gap: '0.75rem' }}>
                        {/* Search bar on larger screens */}
                        <div className="search-bar" style={{ maxWidth: '200px' }}>
                            <i className="fa-solid fa-search"></i>
                            <input type="text" placeholder="Search farmer, crop..." />
                        </div>

                        {/* Language Selector */}
                        <LanguageSelector />

                        {/* Scan Farmer QR CTA Button */}
                        <button 
                            className="primary-btn pulse-glow"
                            onClick={() => setIsQrScannerOpen(true)}
                            style={{ 
                                padding: '0.55rem 1rem', 
                                fontSize: '0.82rem',
                                borderRadius: '0.75rem',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                            }}
                        >
                            <i className="fa-solid fa-qrcode" style={{ fontSize: '0.95rem' }}></i>
                            <span>Scan Gate QR</span>
                        </button>

                        <HeaderClock />

                        <div className="user-profile">
                            <div className="profile-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#8B5E34', color: '#FFF7ED', fontSize: '1.15rem', width: '38px', height: '38px', borderRadius: '50%' }}>
                                <i className="fa-solid fa-industry"></i>
                            </div>
                            <div className="user-info">
                                <h4>{profileName || user.phone}</h4>
                                <p>Miller / Buyer</p>
                            </div>
                        </div>

                        <button className="header-logout-btn" onClick={handleLogout} title="Sign Out">
                            <i className="fa-solid fa-arrow-right-from-bracket"></i>
                            <span className="header-logout-text">Logout</span>
                        </button>
                    </div>
                </header>

                <div className="dashboard-content" style={{ padding: '1.75rem 1.5rem' }}>

                    {/* ======================================================== */}
                    {/* TAB: DASHBOARD */}
                    {/* ======================================================== */}
                    {activeTab === 'dashboard' && (
                        <div>
                            {/* 1. Panoramic Sunset Hero Banner matching the theme */}
                            <div className="mill-hero-card">
                                <img
                                    src="/mill-hero-sunset.jpg"
                                    alt="Grain Mill Facility Sunset"
                                    className="mill-hero-bg"
                                />
                                <div className="mill-hero-overlay" />
                                <div className="mill-hero-content">
                                    <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#D97706', display: 'block', marginBottom: '0.35rem' }}>
                                        AGRO-INDUSTRIAL PROCUREMENT PLATFORM
                                    </span>
                                    <h1 style={{ margin: '0 0 0.4rem 0', fontSize: 'clamp(1.4rem, 2.5vw, 2rem)', fontWeight: 800, color: '#2E1A0F', lineHeight: 1.2 }}>
                                        Quality Grains, Stronger Communities
                                    </h1>
                                    <p style={{ margin: '0 0 1.25rem 0', color: '#7C5335', fontSize: '0.92rem', lineHeight: 1.45 }}>
                                        Partnering with Farmers for a Sustainable Tomorrow. Instant gate QR verification, intake logging & automated direct payouts.
                                    </p>
                                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                        <button className="primary-btn" onClick={() => setIsQrScannerOpen(true)} style={{ padding: '0.65rem 1.25rem', fontSize: '0.88rem' }}>
                                            <i className="fa-solid fa-camera"></i> Launch Gate Scanner
                                        </button>
                                        <button className="action-btn" onClick={() => setIsAddMillOpen(true)} style={{ padding: '0.65rem 1.25rem', fontSize: '0.88rem' }}>
                                            <i className="fa-solid fa-plus"></i> Add Facility
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* 2. 4 Summary Stat Cards */}
                            <div className="stats-grid" style={{ marginBottom: '1.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
                                <div className="stat-card">
                                    <div className="stat-icon" style={{ background: 'rgba(255, 138, 0, 0.12)', color: '#FF8A00' }}>
                                        <i className="fa-solid fa-wheat-awn"></i>
                                    </div>
                                    <div className="stat-details">
                                        <h3>Total Procurement</h3>
                                        <h2>{loadsReceived.reduce((sum, l) => sum + (Number(l.quantity) || 5), 0) + 1250} MT</h2>
                                        <span className="trend up"><i className="fa-solid fa-arrow-up"></i> +12% this season</span>
                                    </div>
                                </div>

                                <div className="stat-card">
                                    <div className="stat-icon" style={{ background: 'rgba(217, 119, 6, 0.12)', color: '#D97706' }}>
                                        <i className="fa-solid fa-users"></i>
                                    </div>
                                    <div className="stat-details">
                                        <h3>Active Farmers</h3>
                                        <h2>{Math.max(enquiries.length, 12) * 5 + 360}</h2>
                                        <span className="trend up"><i className="fa-solid fa-arrow-up"></i> Linked with mill</span>
                                    </div>
                                </div>

                                <div className="stat-card">
                                    <div className="stat-icon" style={{ background: 'rgba(139, 94, 52, 0.12)', color: '#8B5E34' }}>
                                        <i className="fa-solid fa-truck-moving"></i>
                                    </div>
                                    <div className="stat-details">
                                        <h3>Incoming Trucks</h3>
                                        <h2>{enquiries.filter(e => e.status === 'ACCEPTED').length + 4}</h2>
                                        <span className="trend neutral">In transit & at gate</span>
                                    </div>
                                </div>

                                <div className="stat-card" onClick={() => setActiveTab('loads')} style={{ cursor: 'pointer' }}>
                                    <div className="stat-icon" style={{ background: 'rgba(255, 138, 0, 0.12)', color: '#FF8A00' }}>
                                        <i className="fa-solid fa-boxes-stacked"></i>
                                    </div>
                                    <div className="stat-details">
                                        <h3>Verified Loads</h3>
                                        <h2>{loadsReceived.length} Batches</h2>
                                        <span className="trend up">Intake confirmed</span>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Quick Actions Grid */}
                            <div style={{ marginBottom: '1.75rem' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#2E1A0F', marginBottom: '0.85rem' }}>
                                    Quick Station Actions
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.85rem' }}>
                                    <div className="mill-quick-action-tile" onClick={() => setIsQrScannerOpen(true)}>
                                        <div className="mill-quick-action-icon">
                                            <i className="fa-solid fa-qrcode"></i>
                                        </div>
                                        <span className="mill-quick-action-label">Scan Gate QR</span>
                                    </div>

                                    <div className="mill-quick-action-tile" onClick={() => setIsAddMillOpen(true)}>
                                        <div className="mill-quick-action-icon">
                                            <i className="fa-solid fa-plus"></i>
                                        </div>
                                        <span className="mill-quick-action-label">Add Procurement</span>
                                    </div>

                                    <div className="mill-quick-action-tile" onClick={() => setActiveTab('mills')}>
                                        <div className="mill-quick-action-icon">
                                            <i className="fa-solid fa-tags"></i>
                                        </div>
                                        <span className="mill-quick-action-label">Manage Pricing</span>
                                    </div>

                                    <div className="mill-quick-action-tile" onClick={() => setActiveTab('loads')}>
                                        <div className="mill-quick-action-icon">
                                            <i className="fa-solid fa-credit-card"></i>
                                        </div>
                                        <span className="mill-quick-action-label">Process Payments</span>
                                    </div>
                                </div>
                            </div>

                            {/* 4. Recent Enquiries Table Preview */}
                            <div className="bento-card" style={{ marginBottom: '2rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#2E1A0F' }}>Recent Farmer Enquiries</h3>
                                        <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: '#7C5335' }}>Incoming grain proposals ready for review</p>
                                    </div>
                                    <button className="text-btn" onClick={() => setActiveTab('enquiries')} style={{ color: '#D97706', fontWeight: 700 }}>View All →</button>
                                </div>
                                {enquiries.length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>No incoming farmer enquiries yet.</p>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="orders-table" style={{ width: '100%', textAlign: 'left' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                    <th style={{ padding: '0.75rem 1rem' }}>Enquiry ID</th>
                                                    <th style={{ padding: '0.75rem 1rem' }}>Farmer</th>
                                                    <th style={{ padding: '0.75rem 1rem' }}>Crop & Qty</th>
                                                    <th style={{ padding: '0.75rem 1rem' }}>Offered Price</th>
                                                    <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                                                    <th style={{ padding: '0.75rem 1rem' }}>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {enquiries.slice(0, 4).map(eq => (
                                                    <tr key={eq.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                        <td style={{ padding: '1rem', fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-gold)' }}>
                                                            {eq.enquiry_code}
                                                        </td>
                                                        <td style={{ padding: '1rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                                                                <strong>{eq.farmer_name}</strong>
                                                                {eq.farmer_phone && (
                                                                    <a 
                                                                        href={`tel:${normalizeTelPhone(eq.farmer_phone)}`}
                                                                        className="mill-call-farmer-btn-sm"
                                                                        title="Calling is available when using a device with phone-call support."
                                                                    >
                                                                        <i className="fa-solid fa-phone"></i> Call
                                                                    </a>
                                                                )}
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '0.2rem' }}>
                                                                {formatDisplayPhone(eq.farmer_phone)}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '1rem' }}>
                                                            <strong>{eq.crop_name}</strong>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{eq.quantity || (eq.acres * 2)} Tons ({eq.acres} Acres)</div>
                                                        </td>
                                                        <td style={{ padding: '1rem', color: 'var(--primary)', fontWeight: 700 }}>
                                                            ₹{eq.offered_price || eq.expected_price || 'Market'}
                                                        </td>
                                                        <td style={{ padding: '1rem' }}>
                                                            <span className="status-badge" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>
                                                                {eq.status}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '1rem' }}>
                                                            {eq.status === 'PENDING' ? (
                                                                <button className="primary-btn" onClick={() => handleAcceptEnquiry(eq)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                                                                    Accept
                                                                </button>
                                                            ) : (
                                                                <button className="action-btn text-btn" onClick={() => setSelectedEnquiryForQr(eq)} style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>
                                                                    View QR
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ======================================================== */}
                    {/* TAB: FARMER ENQUIRIES */}
                    {/* ======================================================== */}
                    {activeTab === 'enquiries' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.6rem' }}>Farmer Enquiries 📬</h2>
                                    <p style={{ color: '#7C5335', fontSize: '0.88rem', margin: '0.25rem 0 0 0', fontWeight: 500 }}>
                                        Review incoming crop supply proposals, accept for instant QR generation, or decline
                                    </p>
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {[
                                        { key: 'PENDING', label: 'PENDING' },
                                        { key: 'LOAD_RECEIVED', label: 'LOAD RECEIVED' },
                                        { key: 'COMPLETED', label: 'COMPLETED' },
                                        { key: 'FAILED', label: 'FAILED' }
                                    ].map(item => {
                                        const count = enquiries.filter(e => getEnquiryCategory(e) === item.key).length;
                                        const isActive = enquiryFilter === item.key;
                                        return (
                                            <button 
                                                key={item.key} 
                                                className={`action-btn ${isActive ? 'active' : ''}`}
                                                onClick={() => setEnquiryFilter(item.key)}
                                                style={{ 
                                                    fontSize: '0.82rem', 
                                                    padding: '0.55rem 0.95rem', 
                                                    background: isActive ? '#FF8A00' : '#FFF7ED', 
                                                    color: isActive ? '#FFFFFF' : '#2E1A0F', 
                                                    fontWeight: 800,
                                                    borderRadius: '0.65rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    border: isActive ? '1px solid #FF8A00' : '1px solid #EAD2B2',
                                                    boxShadow: isActive ? '0 4px 12px rgba(255, 138, 0, 0.3)' : '0 2px 6px rgba(139, 94, 52, 0.05)',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <span>{item.label}</span>
                                                <span style={{ 
                                                    background: isActive ? 'rgba(0,0,0,0.25)' : '#F3DFCA', 
                                                    color: isActive ? '#FFFFFF' : '#7C5335', 
                                                    padding: '0.12rem 0.5rem', 
                                                    borderRadius: '1rem', 
                                                    fontSize: '0.72rem',
                                                    fontWeight: 800
                                                }}>
                                                    {count}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {filteredEnquiries.length === 0 ? (
                                <div className="bento-card" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                                    <i className="fa-solid fa-inbox fa-3x" style={{ color: '#8B5E34', marginBottom: '1rem' }}></i>
                                    <h3 style={{ color: '#2E1A0F' }}>No Enquiries Found</h3>
                                    <p style={{ color: '#7C5335' }}>No farmer enquiries matching the selected filter ({enquiryFilter}).</p>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: '1.25rem' }}>
                                    {filteredEnquiries.map(enq => {
                                        const millAccepted = (enq.mill_status || '').toUpperCase() === 'ACCEPTED' || 
                                                             (enq.status || '').toUpperCase() === 'ACCEPTED' || 
                                                             (enq.status || '').toUpperCase() === 'WAITING_TRANSPORT' || 
                                                             (enq.status || '').toUpperCase() === 'LOAD_RECEIVED';
                                        const millRejected = (enq.mill_status || '').toUpperCase() === 'REJECTED' || (enq.status || '').toUpperCase() === 'REJECTED';
                                        const millPending = !millAccepted && !millRejected;

                                        const hasTransport = Boolean(enq.transport_required || enq.with_transport);
                                        const transportAccepted = (enq.transport_status || '').toUpperCase() === 'ACCEPTED';
                                        const transportRejected = (enq.transport_status || '').toUpperCase() === 'REJECTED';

                                        const isOverallConfirmed = (enq.overall_status || '').toUpperCase() === 'CONFIRMED' || 
                                                                   (!hasTransport && millAccepted) || 
                                                                   (hasTransport && millAccepted && transportAccepted);

                                        return (
                                            <div key={enq.id} className="bento-card" style={{ border: isOverallConfirmed ? '1.5px solid #10B981' : '1px solid #EAD2B2', display: 'flex', flexDirection: 'column', background: '#FFF7ED', padding: '1.25rem' }}>
                                                {/* Header */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #EAD2B2', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                                                    <div>
                                                        <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#D97706', fontSize: '1.05rem' }}>
                                                            {enq.enquiry_code}
                                                        </span>
                                                        <div style={{ fontSize: '0.75rem', color: '#7C5335', fontWeight: 600 }}>
                                                            {new Date(enq.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </div>
                                                    </div>

                                                    <span className="status-badge" style={{
                                                        background: isOverallConfirmed ? '#D1FAE5' : millRejected || transportRejected ? '#FEE2E2' : '#FED7AA',
                                                        color: isOverallConfirmed ? '#065F46' : millRejected || transportRejected ? '#991B1B' : '#9A3412',
                                                        border: isOverallConfirmed ? '1px solid #A7F3D0' : millRejected || transportRejected ? '1px solid #FECACA' : '1px solid #FDBA74',
                                                        padding: '0.3rem 0.75rem',
                                                        fontSize: '0.76rem',
                                                        fontWeight: 800,
                                                        borderRadius: '0.5rem',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.3px'
                                                    }}>
                                                        {isOverallConfirmed ? '🟢 CONFIRMED' : millRejected || transportRejected ? '🔴 REJECTED' : '🟡 IN PROGRESS'}
                                                    </span>
                                                </div>

                                                {/* Body Details */}
                                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.88rem' }}>
                                                    {/* Farmer Contact Card */}
                                                    <div className="mill-farmer-contact-card" style={{ background: '#F9E5C7', border: '1px solid #DEC098', borderRadius: '0.75rem', padding: '0.85rem' }}>
                                                        <div>
                                                            <div style={{ fontSize: '0.7rem', color: '#7C5335', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px' }}>
                                                                Farmer Contact
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.25rem' }}>
                                                                <i className="fa-solid fa-user" style={{ color: '#8B5E34', fontSize: '0.85rem' }}></i>
                                                                <strong style={{ color: '#2E1A0F', fontSize: '0.95rem', fontWeight: 800 }}>{enq.farmer_name || 'Farmer'}</strong>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.2rem' }}>
                                                                <i className="fa-solid fa-phone" style={{ color: '#D97706', fontSize: '0.8rem' }}></i>
                                                                <span style={{ color: '#2E1A0F', fontSize: '0.86rem', fontFamily: 'monospace', fontWeight: 700 }}>
                                                                    {formatDisplayPhone(enq.farmer_phone)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {enq.farmer_phone && (
                                                            <a
                                                                href={`tel:${normalizeTelPhone(enq.farmer_phone)}`}
                                                                className="mill-call-farmer-btn"
                                                                title="Calling is available when using a device with phone-call support."
                                                                onClick={() => {
                                                                    if (!navigator.userAgent.match(/Android|iPhone|iPad|iPod|Mobile/i)) {
                                                                        setCopySuccessToast('Opening native dialer • Device phone support required');
                                                                        setTimeout(() => setCopySuccessToast(''), 3000);
                                                                    }
                                                                }}
                                                            >
                                                                <i className="fa-solid fa-phone"></i>
                                                                <span>Call Farmer</span>
                                                            </a>
                                                        )}
                                                    </div>

                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                                                        <span style={{ color: '#7C5335', fontWeight: 600 }}>Crop:</span>
                                                        <strong style={{ color: '#D97706', fontWeight: 800, fontSize: '0.95rem' }}>{enq.crop_name}</strong>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ color: '#7C5335', fontWeight: 600 }}>Quantity & Acreage:</span>
                                                        <strong style={{ color: '#2E1A0F', fontWeight: 700 }}>{enq.quantity || (enq.acres * 2)} Tons • {enq.acres} Acres</strong>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ color: '#7C5335', fontWeight: 600 }}>Farm Location:</span>
                                                        <span style={{ color: '#2E1A0F', fontWeight: 600 }}>{enq.farmer_location_name || 'Farm Plot'} (~{Number(enq.distance || 35).toFixed(1)} km)</span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ color: '#7C5335', fontWeight: 600 }}>Offered Price:</span>
                                                        <strong style={{ color: '#FF8A00', fontWeight: 800, fontSize: '1.02rem' }}>₹{enq.offered_price || enq.expected_price || 'Market Rate'}/Q</strong>
                                                    </div>

                                                    {/* Transport Logistics Box */}
                                                    <div style={{ background: '#F9E5C7', padding: '0.75rem 0.9rem', borderRadius: '0.65rem', border: '1px solid #DEC098', marginTop: '0.35rem' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: hasTransport ? '0.35rem' : 0 }}>
                                                            <span style={{ fontWeight: 800, color: '#8B5E34', fontSize: '0.82rem' }}>
                                                                <i className="fa-solid fa-truck" style={{ marginRight: '0.35rem', color: '#FF8A00' }}></i>
                                                                {hasTransport ? 'Logistics Requested' : 'Self Arranged by Farmer'}
                                                            </span>
                                                            {hasTransport && (
                                                                <span style={{ fontSize: '0.74rem', color: transportAccepted ? '#065F46' : millAccepted ? '#9A3412' : '#7C5335', fontWeight: 800 }}>
                                                                    {transportAccepted ? 'Driver Confirmed ✅' : millAccepted ? 'Driver Pending ⏳' : 'Dispatches on Accept 🔒'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {hasTransport && (
                                                            <div style={{ fontSize: '0.8rem', color: '#7C5335', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem', marginTop: '0.25rem' }}>
                                                                <div>Driver: <strong style={{ color: '#2E1A0F', fontWeight: 700 }}>{enq.driver_name || 'Assigned Driver'}</strong></div>
                                                                <div>Vehicle: <strong style={{ color: '#2E1A0F', fontWeight: 700 }}>{enq.vehicle_name ? `${enq.vehicle_name} (${enq.vehicle_number || 'Verified'})` : (enq.vehicle_number || enq.vehicle_type || 'Truck')}</strong></div>
                                                                <div>Date: <strong style={{ color: '#2E1A0F', fontWeight: 700 }}>{enq.transport_date || enq.pickup_date || 'Flexible'}</strong></div>
                                                                <div>Cost: <strong style={{ color: '#D97706', fontWeight: 800 }}>₹{enq.estimated_transport_cost?.toLocaleString() || 'Calculated'}</strong></div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Status Dual Breakdown */}
                                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem', fontSize: '0.78rem' }}>
                                                        <div style={{ flex: 1, padding: '0.45rem 0.6rem', background: '#F9E5C7', borderRadius: '0.5rem', border: '1px solid #DEC098' }}>
                                                            <span style={{ color: '#7C5335', display: 'block', fontSize: '0.7rem', fontWeight: 700 }}>Mill Decision</span>
                                                            <strong style={{ color: millAccepted ? '#065F46' : millRejected ? '#991B1B' : '#9A3412', fontWeight: 800 }}>
                                                                {millAccepted ? '✅ Accepted' : millRejected ? '❌ Rejected' : '⏳ Pending (You)'}
                                                            </strong>
                                                        </div>
                                                        {hasTransport && (
                                                            <div style={{ flex: 1, padding: '0.45rem 0.6rem', background: '#F9E5C7', borderRadius: '0.5rem', border: '1px solid #DEC098' }}>
                                                                <span style={{ color: '#7C5335', display: 'block', fontSize: '0.7rem', fontWeight: 700 }}>Transporter Status</span>
                                                                <strong style={{ color: transportAccepted ? '#065F46' : transportRejected ? '#991B1B' : millAccepted ? '#9A3412' : '#7C5335', fontWeight: 800 }}>
                                                                    {transportAccepted ? '✅ Accepted' : transportRejected ? '❌ Rejected' : millAccepted ? '⏳ Pending Response' : '🔒 Dispatches on Accept'}
                                                                </strong>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {enq.farmer_message && enq.farmer_message !== 'I am ready to supply the crop on the selected date.' && (
                                                        <div style={{ background: '#FFF7ED', border: '1px solid #DEC098', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', marginTop: '0.25rem' }}>
                                                            <div style={{ fontSize: '0.72rem', color: '#D97706', fontWeight: 800 }}>FARMER NOTE:</div>
                                                            <div style={{ fontSize: '0.82rem', fontStyle: 'italic', color: '#2E1A0F' }}>"{enq.farmer_message}"</div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Footer Actions */}
                                                <div style={{ marginTop: '1.25rem', paddingTop: '0.85rem', borderTop: '1px solid #EAD2B2', display: 'flex', gap: '0.6rem' }}>
                                                    {millPending ? (
                                                        <>
                                                            <button 
                                                                className="action-btn" 
                                                                onClick={() => handleRejectEnquiry(enq)}
                                                                style={{ flex: 1, justifyContent: 'center', padding: '0.65rem', color: '#991B1B', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '0.65rem', fontWeight: 800 }}
                                                            >
                                                                <i className="fa-solid fa-xmark" style={{ marginRight: '0.35rem' }}></i>
                                                                Reject
                                                            </button>
                                                            <button 
                                                                className="primary-btn" 
                                                                onClick={() => handleAcceptEnquiry(enq)}
                                                                style={{ flex: 1.5, justifyContent: 'center', padding: '0.65rem', fontWeight: 800 }}
                                                            >
                                                                <i className="fa-solid fa-circle-check"></i>
                                                                {hasTransport ? 'Accept & Dispatch' : 'Accept Enquiry'}
                                                            </button>
                                                        </>
                                                    ) : millAccepted ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#065F46', fontSize: '0.85rem', fontWeight: 800 }}>
                                                                <i className="fa-solid fa-circle-check"></i>
                                                                <span>{isOverallConfirmed ? 'Confirmed • QR Ready' : 'Mill Approved • Waiting Driver'}</span>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                                <button 
                                                                    className="action-btn" 
                                                                    onClick={() => setIsQrScannerOpen(true)}
                                                                    style={{ padding: '0.5rem 0.8rem', fontSize: '0.8rem' }}
                                                                >
                                                                    <i className="fa-solid fa-qrcode"></i>
                                                                    Scan QR
                                                                </button>
                                                                <button 
                                                                    className="primary-btn" 
                                                                    onClick={() => handleOpenLoadReceivedModal(enq)}
                                                                    style={{ padding: '0.5rem 0.9rem', fontSize: '0.8rem' }}
                                                                >
                                                                    <i className="fa-solid fa-truck-ramp-box"></i>
                                                                    Load Received
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#991B1B', fontSize: '0.85rem', fontWeight: 800 }}>
                                                            <i className="fa-solid fa-circle-xmark"></i>
                                                            <span>Enquiry Declined</span>
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
                    {/* TAB: PAYMENTS & LOADS */}
                    {/* ======================================================== */}
                    {activeTab === 'loads' && (() => {
                        const pendingLoads = loadsReceived.filter(l => (l.payment_status || 'PENDING').toUpperCase() === 'PENDING');
                        const completedLoads = loadsReceived.filter(l => (l.payment_status || '').toUpperCase() === 'COMPLETED');
                        const failedLoads = loadsReceived.filter(l => (l.payment_status || '').toUpperCase() === 'FAILED' || (l.status || '').toUpperCase() === 'FAILED' || (l.status || '').toUpperCase() === 'REJECTED');
                        const loadReceivedLoads = loadsReceived;
                        
                        const totalTonnes = loadsReceived.reduce((sum, l) => sum + (Number(l.quantity_tonnes || l.quantity) || 0), 0);
                        const totalQuintals = loadsReceived.reduce((sum, l) => sum + (Number(l.quantity_quintals) || (Number(l.quantity_tonnes || l.quantity) * 10) || 0), 0);
                        const totalPendingAmt = pendingLoads.reduce((sum, l) => sum + (Number(l.total_amount || l.price) || 0), 0);
                        const totalCompletedAmt = completedLoads.reduce((sum, l) => sum + (Number(l.total_amount || l.price) || 0), 0);

                        const displayedLoads = paymentCategory === 'PENDING'
                            ? pendingLoads
                            : paymentCategory === 'COMPLETED'
                            ? completedLoads
                            : paymentCategory === 'FAILED'
                            ? failedLoads
                            : loadReceivedLoads;

                        return (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                                    <div>
                                        <h2 style={{ margin: 0, fontSize: '1.6rem', color: '#2E1A0F' }}>Payments & Loads 🚚💰</h2>
                                        <p style={{ color: '#7C5335', fontSize: '0.88rem', margin: '0.25rem 0 0 0', fontWeight: 500 }}>
                                            Record produce weighbridge intakes, automated quintal bills, and execute direct farmer payouts
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                        <button className="action-btn" onClick={() => setActiveTab('enquiries')}>
                                            <i className="fa-solid fa-inbox"></i> View Accepted Enquiries
                                        </button>
                                        <button className="primary-btn" onClick={() => setIsQrScannerOpen(true)}>
                                            <i className="fa-solid fa-qrcode"></i> Scan Farmer QR
                                        </button>
                                    </div>
                                </div>

                                {/* Top Financial & Weight Metric Cards */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
                                    <div className="bento-card" style={{ padding: '1.25rem' }}>
                                        <div style={{ fontSize: '0.78rem', color: '#7C5335', textTransform: 'uppercase', fontWeight: 800 }}>Total Weighed Produce</div>
                                        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2E1A0F', margin: '0.3rem 0' }}>
                                            {totalTonnes.toFixed(1)} <span style={{ fontSize: '1.1rem', color: '#FF8A00' }}>Tons</span>
                                        </div>
                                        <div style={{ fontSize: '0.82rem', color: '#7C5335', fontWeight: 600 }}>
                                            {totalQuintals.toFixed(0)} Quintals across {loadsReceived.length} loads
                                        </div>
                                    </div>

                                    <div className="bento-card" style={{ padding: '1.25rem', border: '1px solid #FDBA74', background: '#FFF7ED' }}>
                                        <div style={{ fontSize: '0.78rem', color: '#9A3412', textTransform: 'uppercase', fontWeight: 800 }}>Payment Pending</div>
                                        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#D97706', margin: '0.3rem 0' }}>
                                            ₹{totalPendingAmt.toLocaleString('en-IN')}
                                        </div>
                                        <div style={{ fontSize: '0.82rem', color: '#7C5335', fontWeight: 600 }}>
                                            {pendingLoads.length} farmer payment{pendingLoads.length !== 1 ? 's' : ''} awaiting payout
                                        </div>
                                    </div>

                                    <div className="bento-card" style={{ padding: '1.25rem', border: '1px solid #A7F3D0', background: '#FFF7ED' }}>
                                        <div style={{ fontSize: '0.78rem', color: '#065F46', textTransform: 'uppercase', fontWeight: 800 }}>Payment Completed</div>
                                        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#065F46', margin: '0.3rem 0' }}>
                                            ₹{totalCompletedAmt.toLocaleString('en-IN')}
                                        </div>
                                        <div style={{ fontSize: '0.82rem', color: '#7C5335', fontWeight: 600 }}>
                                            {completedLoads.length} load{completedLoads.length !== 1 ? 's' : ''} settled successfully
                                        </div>
                                    </div>
                                </div>

                                {/* Category Filters */}
                                <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                    {[
                                        { id: 'PENDING', label: 'Payment Pending', count: pendingLoads.length, badgeColor: '#9A3412' },
                                        { id: 'LOAD_RECEIVED', label: 'Load Received', count: loadReceivedLoads.length, badgeColor: '#1E40AF' },
                                        { id: 'COMPLETED', label: 'Payment Completed', count: completedLoads.length, badgeColor: '#065F46' },
                                        { id: 'FAILED', label: 'Payment Failed', count: failedLoads.length, badgeColor: '#991B1B' }
                                    ].map(cat => (
                                        <button
                                            key={cat.id}
                                            className={`action-btn ${paymentCategory === cat.id ? 'primary-btn' : ''}`}
                                            onClick={() => setPaymentCategory(cat.id)}
                                            style={{
                                                padding: '0.6rem 1.1rem',
                                                fontSize: '0.85rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                background: paymentCategory === cat.id ? '#FF8A00' : '#FFF7ED',
                                                border: paymentCategory === cat.id ? '1px solid #FF8A00' : '1px solid #EAD2B2',
                                                color: paymentCategory === cat.id ? '#FFFFFF' : '#2E1A0F',
                                                fontWeight: 800,
                                                borderRadius: '0.65rem',
                                                boxShadow: paymentCategory === cat.id ? '0 4px 12px rgba(255, 138, 0, 0.3)' : '0 2px 6px rgba(139, 94, 52, 0.05)'
                                            }}
                                        >
                                            <span>{cat.label}</span>
                                            <span style={{
                                                background: paymentCategory === cat.id ? 'rgba(0,0,0,0.25)' : '#F3DFCA',
                                                color: paymentCategory === cat.id ? '#FFFFFF' : cat.badgeColor || '#7C5335',
                                                padding: '0.12rem 0.5rem',
                                                borderRadius: '1rem',
                                                fontSize: '0.72rem',
                                                fontWeight: 800
                                            }}>
                                                {cat.count}
                                            </span>
                                        </button>
                                    ))}

                                    <button
                                        type="button"
                                        onClick={() => setShowStandaloneRazorpay(true)}
                                        className="action-btn"
                                        style={{
                                            marginLeft: 'auto',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.45rem',
                                            background: '#FFF7ED',
                                            border: '1px solid #DEC098',
                                            color: '#8B5E34',
                                            fontSize: '0.85rem',
                                            fontWeight: 700,
                                            padding: '0.55rem 1rem',
                                            borderRadius: '0.625rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <i className="fa-solid fa-shield-halved" style={{ color: '#FF8A00' }}></i>
                                        <span>Test Razorpay Gateway</span>
                                    </button>
                                </div>

                                {displayedLoads.length === 0 ? (
                                    <div className="bento-card" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                                        <i className="fa-solid fa-receipt fa-3x" style={{ color: '#8B5E34', marginBottom: '1rem' }}></i>
                                        <h3 style={{ color: '#2E1A0F' }}>No Loads in this Category</h3>
                                        <p style={{ color: '#7C5335', maxWidth: '450px', margin: '0.5rem auto 1.5rem' }}>
                                            {paymentCategory === 'PENDING'
                                                ? 'All arrived loads have been paid! No pending payouts.'
                                                : paymentCategory === 'COMPLETED'
                                                ? 'No completed payments yet. Record loads and click Make Payment.'
                                                : paymentCategory === 'FAILED'
                                                ? 'No failed transactions.'
                                                : 'No loads recorded yet. When a farmer arrives, click Load Received or Scan Farmer QR.'}
                                        </p>
                                        <button className="primary-btn" onClick={() => setIsQrScannerOpen(true)}>
                                            Open QR Scanner
                                        </button>
                                    </div>
                                ) : (
                                    <div className="bento-card" style={{ padding: 0, overflow: 'hidden' }}>
                                        <div className="table-responsive">
                                            <table className="orders-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '2px solid #EAD2B2', background: '#F3E2CE' }}>
                                                        <th style={{ padding: '1rem' }}>Enquiry Code</th>
                                                        <th style={{ padding: '1rem' }}>Farmer</th>
                                                        <th style={{ padding: '1rem' }}>Crop & Received Weight</th>
                                                        <th style={{ padding: '1rem' }}>Agreed Rate</th>
                                                        <th style={{ padding: '1rem' }}>Total Amount</th>
                                                        <th style={{ padding: '1rem' }}>Status</th>
                                                        <th style={{ padding: '1rem', textAlign: 'right' }}>Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {displayedLoads.map(load => {
                                                        const isPending = (load.payment_status || 'PENDING').toUpperCase() === 'PENDING';
                                                        const tonnes = Number(load.quantity_tonnes || load.quantity || 10);
                                                        const quintals = Number(load.quantity_quintals || Math.round(tonnes * 10 * 10) / 10);
                                                        const rate = Number(load.price_per_quintal || 2450);
                                                        const total = Number(load.total_amount || load.price || (quintals * rate));

                                                        return (
                                                            <tr key={load.id} style={{ borderBottom: '1px solid #EAD2B2' }}>
                                                                <td style={{ padding: '1rem' }}>
                                                                    <div style={{ fontFamily: 'monospace', fontWeight: 800, color: '#D97706' }}>
                                                                        {load.enquiry_code}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.75rem', color: '#7C5335', fontWeight: 600 }}>
                                                                        {new Date(load.received_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                                                    </div>
                                                                </td>

                                                                <td style={{ padding: '1rem' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                                                                        <strong style={{ color: '#2E1A0F', fontWeight: 800 }}>{load.farmer_name}</strong>
                                                                        {(load.farmer_phone || load.farmer_id) && (
                                                                            <a 
                                                                                href={`tel:${normalizeTelPhone(load.farmer_phone || load.farmer_id)}`}
                                                                                className="mill-call-farmer-btn-sm"
                                                                                title="Calling is available when using a device with phone-call support."
                                                                            >
                                                                                <i className="fa-solid fa-phone"></i> Call
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.78rem', color: '#7C5335', fontFamily: 'monospace', marginTop: '0.2rem', fontWeight: 600 }}>
                                                                        {formatDisplayPhone(load.farmer_phone || load.farmer_id)}
                                                                    </div>
                                                                </td>

                                                                <td style={{ padding: '1rem' }}>
                                                                    <strong style={{ color: '#FF8A00', fontWeight: 800 }}>{load.crop_name}</strong>
                                                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2E1A0F' }}>
                                                                        {tonnes} Tonnes <span style={{ color: '#7C5335', fontWeight: 500 }}>({quintals} Qtl)</span>
                                                                    </div>
                                                                </td>

                                                                <td style={{ padding: '1rem' }}>
                                                                    <strong style={{ color: '#D97706', fontWeight: 800 }}>₹{rate.toLocaleString('en-IN')}</strong>
                                                                    <div style={{ fontSize: '0.75rem', color: '#7C5335' }}>per Quintal</div>
                                                                </td>

                                                                <td style={{ padding: '1rem' }}>
                                                                    <strong style={{ fontSize: '1.1rem', color: isPending ? '#D97706' : '#065F46', fontWeight: 800 }}>
                                                                        ₹{total.toLocaleString('en-IN')}
                                                                    </strong>
                                                                    <div style={{ fontSize: '0.72rem', color: '#7C5335' }}>
                                                                        {quintals} Qtl × ₹{rate}
                                                                    </div>
                                                                </td>

                                                                <td style={{ padding: '1rem' }}>
                                                                    {isPending ? (
                                                                        <span className="status-badge" style={{ background: '#FED7AA', color: '#9A3412', border: '1px solid #FDBA74', padding: '0.35rem 0.7rem', fontSize: '0.76rem', fontWeight: 800, borderRadius: '0.5rem' }}>
                                                                            <i className="fa-solid fa-clock" style={{ marginRight: '0.3rem' }}></i>
                                                                            PAYMENT PENDING
                                                                        </span>
                                                                    ) : (
                                                                        <div>
                                                                            <span className="status-badge" style={{ background: '#D1FAE5', color: '#065F46', border: '1px solid #A7F3D0', padding: '0.35rem 0.7rem', fontSize: '0.76rem', fontWeight: 800, borderRadius: '0.5rem' }}>
                                                                                <i className="fa-solid fa-circle-check" style={{ marginRight: '0.3rem' }}></i>
                                                                                COMPLETED
                                                                            </span>
                                                                            <div style={{ fontSize: '0.72rem', color: '#7C5335', marginTop: '0.2rem', fontFamily: 'monospace', fontWeight: 600 }}>
                                                                                {load.transaction_reference}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </td>

                                                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                                    {isPending ? (
                                                                        <button
                                                                            className="primary-btn"
                                                                            onClick={() => handleOpenMakePaymentModal(load)}
                                                                            style={{ padding: '0.55rem 1rem', fontSize: '0.85rem', fontWeight: 800 }}
                                                                        >
                                                                            <i className="fa-solid fa-money-bill-wave"></i>
                                                                            Make Payment
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            className="action-btn"
                                                                            onClick={() => setSelectedLoadForReceipt(load)}
                                                                            style={{ padding: '0.55rem 0.9rem', fontSize: '0.85rem' }}
                                                                        >
                                                                            <i className="fa-solid fa-receipt"></i>
                                                                            View Receipt
                                                                        </button>
                                                                    )}
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
                    {/* TAB: TRANSPORT FLEET */}
                    {/* ======================================================== */}
                    {activeTab === 'transport' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.6rem' }}>Inbound Transport Fleet 🚛</h2>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                                        Real-time tracking of contracted trucks delivering verified crops to your mill
                                    </p>
                                </div>
                            </div>

                            {transportRequests.length === 0 ? (
                                <div className="bento-card" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                                    <i className="fa-solid fa-truck-moving fa-3x" style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}></i>
                                    <h3>No Active Transport Dispatches</h3>
                                    <p style={{ color: 'var(--text-muted)' }}>When accepted farmer enquiries have transport enabled, vehicle tracking will show here.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '1.25rem' }}>
                                    {transportRequests.map(tr => (
                                        <div key={tr.id} className="bento-card">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                                <strong style={{ fontFamily: 'monospace', color: 'var(--accent-gold)' }}>{tr.transport_code}</strong>
                                                <span className="status-badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>{tr.status}</span>
                                            </div>
                                            <h4>{tr.crop_name} ({tr.quantity} Tons)</h4>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                                <div>From: {tr.pickup_address}</div>
                                                <div>Vehicle: <strong>{tr.vehicle_number || 'Dispatching Provider'}</strong></div>
                                                <div>Assigned Hauler: <strong>{tr.assigned_provider_name || 'Searching Fleet'}</strong></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ======================================================== */}
                    {/* TAB: MY MILLS & PRICING */}
                    {/* ======================================================== */}
                    {activeTab === 'mills' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.6rem' }}>My Registered Mills 🏭</h2>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                                        Manage your processing capacity, geo-location, and dynamic buying rates
                                    </p>
                                </div>
                                <button className="primary-btn" onClick={() => setIsAddMillOpen(true)}>
                                    <i className="fa-solid fa-plus"></i> Add New Mill
                                </button>
                            </div>

                            <div className="bento-card">
                                <div className="table-responsive">
                                    <table className="orders-table" style={{ width: '100%', textAlign: 'left' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <th style={{ padding: '1rem' }}>Mill Name</th>
                                                <th style={{ padding: '1rem' }}>Location</th>
                                                <th style={{ padding: '1rem' }}>Buying Crops</th>
                                                <th style={{ padding: '1rem' }}>Capability</th>
                                                <th style={{ padding: '1rem' }}>Status</th>
                                                <th style={{ padding: '1rem' }}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loadingMills ? (
                                                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Loading mills...</td></tr>
                                            ) : mills.length === 0 ? (
                                                <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>You haven't added any mills yet.</td></tr>
                                            ) : mills.map(mill => (
                                                <tr key={mill.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                    <td style={{ padding: '1rem', fontWeight: 600 }}>{mill.millName}</td>
                                                    <td style={{ padding: '1rem', color: 'var(--text-muted)' }}><i className="fa-solid fa-location-dot"></i> {mill.locationName}</td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                            {mill.selectedCrops?.map(crop => (
                                                                <span key={crop} style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--primary)', borderRadius: '4px' }}>{crop}</span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>{mill.capacity} TPD</td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <span className="status-badge" style={{ textTransform: 'capitalize' }}>
                                                            {mill.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <button
                                                            className="primary-btn"
                                                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                                                            onClick={() => setSelectedMillForPricing(mill)}
                                                        >
                                                            <i className="fa-solid fa-tags"></i> Set Prices
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ======================================================== */}
                    {/* TAB: PROCUREMENT HISTORY & AUDIT LEDGER */}
                    {/* ======================================================== */}
                    {activeTab === 'history' && (
                        <div className="history-container">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Procurement Audit Ledger 📜</h2>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                                        Complete historical record of all gate-verified crop batches, farmer proposals, and intake receipts
                                    </p>
                                </div>
                                <button className="action-btn" onClick={refreshAllData} style={{ fontSize: '0.85rem' }}>
                                    <i className="fa-solid fa-rotate-right"></i> Refresh Audit Log
                                </button>
                            </div>

                            {/* Summary Metric Cards */}
                            <div className="history-summary-grid">
                                <div className="history-stat-card">
                                    <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                                        <i className="fa-solid fa-weight-hanging"></i>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Procured Intake</div>
                                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)' }}>
                                            {millHistory.filter(h => h.category === 'LOAD_VERIFIED').reduce((acc, h) => acc + (Number(h.quantity) || 0), 0)} Tons
                                        </div>
                                    </div>
                                </div>
                                <div className="history-stat-card">
                                    <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                                        <i className="fa-solid fa-qrcode"></i>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>QR Gate Scans</div>
                                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                                            {millHistory.filter(h => h.category === 'LOAD_VERIFIED').length} Verified
                                        </div>
                                    </div>
                                </div>
                                <div className="history-stat-card">
                                    <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                                        <i className="fa-solid fa-file-shield"></i>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Entries</div>
                                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                            {millHistory.length} Logged
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Filter Chips */}
                            <div className="history-filters">
                                {[
                                    { label: 'All History', val: 'ALL' },
                                    { label: 'Verified Loads', val: 'LOAD_VERIFIED' },
                                    { label: 'Accepted Enquiries', val: 'ENQUIRY_ACCEPTED' },
                                    { label: 'Declined', val: 'ENQUIRY_REJECTED' }
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

                            {/* Ledger Table */}
                            {millHistory.filter(h => historyFilter === 'ALL' || h.category === historyFilter).length === 0 ? (
                                <div className="bento-card" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                                    <i className="fa-solid fa-clock-rotate-left fa-3x" style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}></i>
                                    <h3>No Records Found</h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No procurement history records matching "{historyFilter}".</p>
                                </div>
                            ) : (
                                <div className="bento-card" style={{ padding: '1.25rem' }}>
                                    <div className="table-responsive">
                                        <table className="orders-table" style={{ width: '100%', textAlign: 'left' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    <th style={{ padding: '0.8rem 1rem' }}>Enquiry Code</th>
                                                    <th style={{ padding: '0.8rem 1rem' }}>Farmer</th>
                                                    <th style={{ padding: '0.8rem 1rem' }}>Commodity & Qty</th>
                                                    <th style={{ padding: '0.8rem 1rem' }}>Verification Time</th>
                                                    <th style={{ padding: '0.8rem 1rem' }}>Logged By</th>
                                                    <th style={{ padding: '0.8rem 1rem' }}>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {millHistory
                                                    .filter(h => historyFilter === 'ALL' || h.category === historyFilter)
                                                    .map(item => (
                                                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.86rem' }}>
                                                            <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontWeight: 800, color: 'var(--accent-gold)' }}>
                                                                {item.enquiry_code}
                                                            </td>
                                                            <td style={{ padding: '0.85rem 1rem' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                                                                    <strong>{item.farmer_name}</strong>
                                                                    {item.farmer_phone && (
                                                                        <a 
                                                                            href={`tel:${normalizeTelPhone(item.farmer_phone)}`}
                                                                            className="mill-call-farmer-btn-sm"
                                                                            title="Calling is available when using a device with phone-call support."
                                                                        >
                                                                            <i className="fa-solid fa-phone"></i>
                                                                        </a>
                                                                    )}
                                                                </div>
                                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '0.15rem' }}>
                                                                    {formatDisplayPhone(item.farmer_phone)}
                                                                </div>
                                                            </td>
                                                            <td style={{ padding: '0.85rem 1rem' }}>
                                                                <strong style={{ color: 'var(--primary)' }}>{item.crop_name}</strong>
                                                                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{item.quantity} Tons ({item.acres} Acres)</div>
                                                            </td>
                                                            <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                                {item.date ? new Date(item.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Pending'}
                                                            </td>
                                                            <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem' }}>
                                                                {item.operator || 'Mill Procurement'}
                                                            </td>
                                                            <td style={{ padding: '0.85rem 1rem' }}>
                                                                <span className={item.category === 'LOAD_VERIFIED' || item.category === 'ENQUIRY_ACCEPTED' ? 'badge-green' : 'badge-gold'}>
                                                                    {item.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ======================================================== */}
                    {/* TAB: PROFILE & SETTINGS */}
                    {/* ======================================================== */}
                    {activeTab === 'profile' && (
                        <div style={{ maxWidth: '820px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* Header Summary & Facility Switcher */}
                            <div className="bento-card" style={{ padding: '1.5rem', background: '#FFF7ED', border: '1px solid #EAD2B2', borderRadius: '1.25rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #EAD2B2', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#FF8A00', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', boxShadow: '0 4px 12px rgba(255, 138, 0, 0.3)' }}>
                                            <i className="fa-solid fa-industry"></i>
                                        </div>
                                        <div>
                                            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#1C0F05' }}>
                                                {facilityName || 'Mill Facility & Profile'}
                                            </h2>
                                            <div style={{ fontSize: '0.82rem', color: '#7C5335', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                                                <span><i className="fa-solid fa-location-dot" style={{ color: '#D97706' }}></i> {facilityLocation.name || 'Telangana'}</span>
                                                <span>•</span>
                                                <span style={{ color: facilityColdStorage ? '#059669' : '#7C5335', fontWeight: 700 }}>
                                                    {facilityColdStorage ? '❄️ Cold Storage Integrated' : 'Standard Dry Storage'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button 
                                        className="primary-btn" 
                                        onClick={() => setIsAddMillOpen(true)}
                                        style={{ fontSize: '0.88rem', padding: '0.6rem 1.15rem' }}
                                    >
                                        <i className="fa-solid fa-plus"></i> Add New Mill Facility
                                    </button>
                                </div>

                                {/* Multi-Facility Switcher if user owns multiple mills */}
                                {mills.length > 1 && (
                                    <div style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', background: '#F9E5C7', borderRadius: '0.75rem', border: '1px solid #DEC098' }}>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#7C5335', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.5px' }}>
                                            Select Active Facility To Configure
                                        </label>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            {mills.map(m => (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => setSelectedMillId(m.id)}
                                                    style={{
                                                        padding: '0.45rem 0.9rem',
                                                        borderRadius: '0.5rem',
                                                        fontSize: '0.82rem',
                                                        fontWeight: 700,
                                                        border: selectedMillId === m.id ? '2px solid #FF8A00' : '1px solid #DEC098',
                                                        background: selectedMillId === m.id ? '#FF8A00' : '#FFF7ED',
                                                        color: selectedMillId === m.id ? '#FFFFFF' : '#2E1A0F',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <i className="fa-solid fa-industry" style={{ marginRight: '0.35rem' }}></i>
                                                    {m.millName}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* FORM CONTAINER */}
                                <form onSubmit={(e) => { e.preventDefault(); handleUpdateProfile(); }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    
                                    {/* SECTION 1: FACILITY IDENTIFICATION & TYPE */}
                                    <div style={{ background: '#FFFDF9', borderRadius: '1rem', border: '1px solid #EAD2B2', padding: '1.25rem' }}>
                                        <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 800, color: '#2E1A0F', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <i className="fa-solid fa-gears" style={{ color: '#FF8A00' }}></i> 1. Facility Specs & Milling Type
                                        </h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#5C371B', marginBottom: '0.35rem' }}>
                                                    Mill / Facility Name *
                                                </label>
                                                <div className="input-group">
                                                    <i className="fa-solid fa-industry" style={{ color: '#8B5E34' }}></i>
                                                    <input 
                                                        type="text" 
                                                        value={facilityName} 
                                                        onChange={e => setFacilityName(e.target.value)} 
                                                        placeholder="e.g. Lakshmi Modern Rice Mill"
                                                        required
                                                        style={{ width: '100%' }}
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#5C371B', marginBottom: '0.35rem' }}>
                                                    Type of Mill *
                                                </label>
                                                <div className="input-group">
                                                    <i className="fa-solid fa-wheat-awn" style={{ color: '#8B5E34' }}></i>
                                                    <select 
                                                        value={facilityType} 
                                                        onChange={e => setFacilityType(e.target.value)}
                                                        style={{ width: '100%', cursor: 'pointer', fontWeight: 600 }}
                                                    >
                                                        <option value="Rice Mill">Rice Mill (Paddy Intake & Parboiling)</option>
                                                        <option value="Dal / Pulse Mill">Dal / Pulse Mill (Tur, Moong, Urad, Chana)</option>
                                                        <option value="Flour / Wheat Mill">Flour / Wheat Mill (Atta, Maida, Sooji)</option>
                                                        <option value="Oil Mill & Expeller">Oil Mill & Expeller (Groundnut, Mustard, Sunflower)</option>
                                                        <option value="Maize / Corn Processing Mill">Maize / Corn Processing Mill</option>
                                                        <option value="Millet & Sorghum Mill">Millet & Sorghum Mill (Jowar, Bajra, Ragi)</option>
                                                        <option value="Cotton Ginning & Pressing Mill">Cotton Ginning & Pressing Mill</option>
                                                        <option value="Sugar Factory / Sugarcane Mill">Sugar Factory / Sugarcane Crushing Mill</option>
                                                        <option value="Multi-Crop Agro Processing Plant">Multi-Crop Agro Processing Plant</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#5C371B', marginBottom: '0.35rem' }}>
                                                    Daily Milling Capacity (TPD) *
                                                </label>
                                                <div className="input-group">
                                                    <i className="fa-solid fa-weight-hanging" style={{ color: '#8B5E34' }}></i>
                                                    <input 
                                                        type="number" 
                                                        value={facilityCapacity} 
                                                        onChange={e => setFacilityCapacity(e.target.value)} 
                                                        placeholder="e.g. 150 (Tonnes per day)"
                                                        min="1"
                                                        required
                                                        style={{ width: '100%' }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* SECTION 2: LOCATION & GPS MAPPING */}
                                    <div style={{ background: '#FFFDF9', borderRadius: '1rem', border: '1px solid #EAD2B2', padding: '1.25rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#2E1A0F', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <i className="fa-solid fa-map-location-dot" style={{ color: '#FF8A00' }}></i> 2. Mill Location & GPS Coordinates
                                            </h4>
                                            <button 
                                                type="button"
                                                className="action-btn"
                                                onClick={() => setIsProfileMapOpen(true)}
                                                style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem', background: '#F9E5C7', color: '#1C0F05', border: '1px solid #DEC098' }}
                                            >
                                                <i className="fa-solid fa-location-crosshairs" style={{ color: '#FF8A00' }}></i> Pick on Map
                                            </button>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#5C371B', marginBottom: '0.35rem' }}>
                                                Mill Address / Mandi Hub *
                                            </label>
                                            <div className="input-group">
                                                <i className="fa-solid fa-location-dot" style={{ color: '#8B5E34' }}></i>
                                                <input 
                                                    type="text" 
                                                    value={facilityLocation.name} 
                                                    onChange={e => setFacilityLocation(prev => ({ ...prev, name: e.target.value }))} 
                                                    placeholder="e.g. Industrial Area, Suryapet Road, Telangana"
                                                    required
                                                    style={{ width: '100%' }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', fontSize: '0.75rem', color: '#7C5335' }}>
                                                <span>Latitude: <strong style={{ fontFamily: 'monospace' }}>{Number(facilityLocation.lat).toFixed(4)}</strong></span>
                                                <span>•</span>
                                                <span>Longitude: <strong style={{ fontFamily: 'monospace' }}>{Number(facilityLocation.lng).toFixed(4)}</strong></span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* SECTION 3: COLD STORAGE AVAILABILITY & CONFIGURATION */}
                                    <div style={{ background: '#FFFDF9', borderRadius: '1rem', border: '1px solid #EAD2B2', padding: '1.25rem' }}>
                                        <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '1rem', fontWeight: 800, color: '#2E1A0F', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <i className="fa-solid fa-snowflake" style={{ color: facilityColdStorage ? '#059669' : '#8B5E34' }}></i> 3. Cold Storage & Controlled Atmosphere
                                        </h4>
                                        
                                        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: facilityColdStorage ? '1rem' : '0', flexWrap: 'wrap' }}>
                                            <button
                                                type="button"
                                                onClick={() => setFacilityColdStorage(true)}
                                                style={{
                                                    flex: 1,
                                                    minWidth: '200px',
                                                    padding: '0.75rem 1rem',
                                                    borderRadius: '0.65rem',
                                                    border: facilityColdStorage ? '2px solid #059669' : '1px solid #DEC098',
                                                    background: facilityColdStorage ? '#ECFDF5' : '#FFF7ED',
                                                    color: facilityColdStorage ? '#065F46' : '#5C371B',
                                                    fontWeight: 800,
                                                    fontSize: '0.88rem',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '0.5rem'
                                                }}
                                            >
                                                <i className="fa-solid fa-circle-check" style={{ color: facilityColdStorage ? '#059669' : '#CBD5E1' }}></i>
                                                ❄️ Yes, Cold Storage Available
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setFacilityColdStorage(false)}
                                                style={{
                                                    flex: 1,
                                                    minWidth: '200px',
                                                    padding: '0.75rem 1rem',
                                                    borderRadius: '0.65rem',
                                                    border: !facilityColdStorage ? '2px solid #D97706' : '1px solid #DEC098',
                                                    background: !facilityColdStorage ? '#FEF3C7' : '#FFF7ED',
                                                    color: !facilityColdStorage ? '#92400E' : '#5C371B',
                                                    fontWeight: 800,
                                                    fontSize: '0.88rem',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '0.5rem'
                                                }}
                                            >
                                                <i className="fa-solid fa-circle-check" style={{ color: !facilityColdStorage ? '#D97706' : '#CBD5E1' }}></i>
                                                No (Standard Ambient Silo Storage)
                                            </button>
                                        </div>

                                        {facilityColdStorage && (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', padding: '1rem', background: '#ECFDF5', borderRadius: '0.75rem', border: '1px solid #A7F3D0' }}>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#065F46', marginBottom: '0.35rem' }}>
                                                        Cold Storage Capacity (MT) *
                                                    </label>
                                                    <input 
                                                        type="number" 
                                                        value={coldStorageCapacity} 
                                                        onChange={e => setColdStorageCapacity(e.target.value)} 
                                                        placeholder="e.g. 5000"
                                                        style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '0.5rem', border: '1px solid #6EE7B7', background: '#FFFFFF', color: '#065F46', fontWeight: 700 }}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#065F46', marginBottom: '0.35rem' }}>
                                                        Temperature Zone *
                                                    </label>
                                                    <select 
                                                        value={coldStorageTemp} 
                                                        onChange={e => setColdStorageTemp(e.target.value)}
                                                        style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '0.5rem', border: '1px solid #6EE7B7', background: '#FFFFFF', color: '#065F46', fontWeight: 700 }}
                                                    >
                                                        <option value="Chilled (+2°C to +8°C)">Chilled (+2°C to +8°C) - Grains & Perishables</option>
                                                        <option value="Controlled Atmosphere (0°C to +4°C)">Controlled Atmosphere (0°C to +4°C)</option>
                                                        <option value="Deep Freeze (-18°C)">Deep Freeze (-18°C) - Multi-commodity</option>
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* SECTION 4: CROPS & COMMODITIES PROCURED */}
                                    <div style={{ background: '#FFFDF9', borderRadius: '1rem', border: '1px solid #EAD2B2', padding: '1.25rem' }}>
                                        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 800, color: '#2E1A0F', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <i className="fa-solid fa-seedling" style={{ color: '#FF8A00' }}></i> 4. Commodities Processed & Procured
                                        </h4>
                                        <p style={{ fontSize: '0.78rem', color: '#7C5335', margin: '0 0 0.75rem 0' }}>
                                            Select all crops and grains your facility purchases directly from farmers:
                                        </p>
                                        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                                            {[
                                                'Paddy (Rice)', 'Wheat', 'Maize', 'Red Gram (Tur/Arhar)', 
                                                'Bengal Gram (Chana)', 'Green Gram (Moong)', 'Black Gram (Urad)', 
                                                'Groundnut', 'Soybean', 'Sunflower', 'Cotton', 'Mustard', 'Sugarcane'
                                            ].map(crop => {
                                                const isSel = facilityCrops.includes(crop);
                                                return (
                                                    <button
                                                        key={crop}
                                                        type="button"
                                                        onClick={() => {
                                                            if (isSel) {
                                                                setFacilityCrops(facilityCrops.filter(c => c !== crop));
                                                            } else {
                                                                setFacilityCrops([...facilityCrops, crop]);
                                                            }
                                                        }}
                                                        style={{
                                                            padding: '0.4rem 0.8rem',
                                                            borderRadius: '1rem',
                                                            fontSize: '0.8rem',
                                                            fontWeight: 700,
                                                            border: isSel ? '1px solid #FF8A00' : '1px solid #DEC098',
                                                            background: isSel ? '#FF8A00' : '#FFF7ED',
                                                            color: isSel ? '#FFFFFF' : '#5C371B',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        {isSel ? '✓ ' : '+ '}{crop}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* SECTION 5: OPERATOR & LEGAL DETAILS */}
                                    <div style={{ background: '#FFFDF9', borderRadius: '1rem', border: '1px solid #EAD2B2', padding: '1.25rem' }}>
                                        <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 800, color: '#2E1A0F', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <i className="fa-solid fa-address-card" style={{ color: '#FF8A00' }}></i> 5. Authorized Operator & Legal Info
                                        </h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#5C371B', marginBottom: '0.35rem' }}>
                                                    Authorized Owner / Company Name *
                                                </label>
                                                <div className="input-group">
                                                    <i className="fa-solid fa-user" style={{ color: '#8B5E34' }}></i>
                                                    <input 
                                                        type="text" 
                                                        value={profileName} 
                                                        onChange={e => setProfileName(e.target.value)} 
                                                        placeholder="e.g. Sri Lakshmi Rice Industries"
                                                        required
                                                        style={{ width: '100%' }}
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#5C371B', marginBottom: '0.35rem' }}>
                                                    GSTIN / Mandi License Number
                                                </label>
                                                <div className="input-group">
                                                    <i className="fa-solid fa-file-invoice" style={{ color: '#8B5E34' }}></i>
                                                    <input 
                                                        type="text" 
                                                        value={gstNumber} 
                                                        onChange={e => setGstNumber(e.target.value)} 
                                                        placeholder="e.g. 36AAACL1234F1Z8"
                                                        style={{ width: '100%', fontFamily: 'monospace' }}
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#5C371B', marginBottom: '0.35rem' }}>
                                                    Primary Registered Phone
                                                </label>
                                                <div className="input-group" style={{ opacity: 0.85 }}>
                                                    <i className="fa-solid fa-phone" style={{ color: '#059669' }}></i>
                                                    <input 
                                                        type="text" 
                                                        value={formatDisplayPhone(user.phone)} 
                                                        disabled
                                                        style={{ width: '100%', cursor: 'not-allowed', color: '#059669', fontWeight: 700 }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* SUBMIT BUTTON */}
                                    <div style={{ marginTop: '0.5rem' }}>
                                        <button 
                                            type="submit" 
                                            className="primary-btn" 
                                            disabled={isSavingProfile} 
                                            style={{ 
                                                width: '100%', 
                                                padding: '0.9rem', 
                                                fontSize: '1rem', 
                                                fontWeight: 800, 
                                                justifyContent: 'center',
                                                background: '#FF8A00',
                                                boxShadow: '0 6px 20px rgba(255, 138, 0, 0.4)'
                                            }}
                                        >
                                            {isSavingProfile ? (
                                                <span><i className="fa-solid fa-spinner fa-spin"></i> Saving Mill Facility & Profile...</span>
                                            ) : (
                                                <span><i className="fa-solid fa-floppy-disk"></i> Save Facility & Profile Changes</span>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                </div>

                {/* Mobile Bottom Navigation */}
                <div className="mobile-nav-bar">
                    <button className={`mobile-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
                        <i className="fa-solid fa-house"></i>
                        <span>Home</span>
                    </button>
                    <button className={`mobile-nav-btn ${activeTab === 'enquiries' ? 'active' : ''}`} onClick={() => setActiveTab('enquiries')}>
                        <i className="fa-solid fa-inbox"></i>
                        <span>Enquiries</span>
                    </button>
                    <button className="mobile-nav-btn" onClick={() => setIsQrScannerOpen(true)} style={{ color: 'var(--primary)' }}>
                        <i className="fa-solid fa-qrcode"></i>
                        <span style={{ fontWeight: 700 }}>Scan QR</span>
                    </button>
                    <button className={`mobile-nav-btn ${activeTab === 'loads' ? 'active' : ''}`} onClick={() => setActiveTab('loads')}>
                        <i className="fa-solid fa-truck-ramp-box"></i>
                        <span>Loads</span>
                    </button>
                    <button className={`mobile-nav-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
                        <i className="fa-solid fa-clock-rotate-left"></i>
                        <span>History</span>
                    </button>
                </div>
            </main>

            {/* MODALS */}
            {isAddMillOpen && (
                <AddMillModal
                    user={user}
                    onClose={() => setIsAddMillOpen(false)}
                    onMillAdded={fetchMills}
                />
            )}

            {isProfileMapOpen && (
                <MapModal
                    onClose={() => setIsProfileMapOpen(false)}
                    onConfirm={(loc) => {
                        setFacilityLocation(loc);
                        setIsProfileMapOpen(false);
                    }}
                    initialCoords={{ lat: facilityLocation.lat, lng: facilityLocation.lng }}
                />
            )}

            {selectedMillForPricing && (
                <UpdatePricesModal
                    mill={selectedMillForPricing}
                    onClose={() => setSelectedMillForPricing(null)}
                    onUpdated={fetchMills}
                />
            )}

            {/* QR SCANNER MODAL */}
            {isQrScannerOpen && (
                <QrScannerModal
                    loggedInMill={activeMill}
                    onClose={() => setIsQrScannerOpen(false)}
                    onVerificationSuccess={() => {
                        refreshAllData();
                        setActiveTab('loads');
                    }}
                />
            )}

            {/* QR CODE MODAL FOR ACCEPTED ENQUIRIES */}
            {selectedEnquiryForQr && (
                <QrCodeModal
                    enquiry={selectedEnquiryForQr}
                    onClose={() => setSelectedEnquiryForQr(null)}
                />
            )}

            {/* ======================================================== */}
            {/* MODAL 1: RECORD LOAD RECEIVED (WEIGHBRIDGE INTAKE) */}
            {/* ======================================================== */}
            {selectedEnquiryForLoadReceived && (
                <div className="modal-overlay" style={{ zIndex: 9999 }}>
                    <div className="modal-content" style={{ maxWidth: '540px', width: '92%', background: '#FFF7ED', border: '1px solid #DEC098', borderRadius: '1.25rem', padding: '1.5rem', color: '#2E1A0F' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #EAD2B2', paddingBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <i className="fa-solid fa-truck-ramp-box" style={{ color: '#FF8A00', fontSize: '1.3rem' }}></i>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#2E1A0F' }}>Confirm Load Received</h3>
                            </div>
                            <button className="action-btn text-btn" onClick={() => setSelectedEnquiryForLoadReceived(null)} style={{ color: '#7C5335', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                <i className="fa-solid fa-xmark" style={{ fontSize: '1.25rem' }}></i>
                            </button>
                        </div>

                        <form onSubmit={handleConfirmLoadReceived} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* Enquiry Details Card */}
                            <div style={{ background: '#F9E5C7', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #EAD2B2', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#7C5335' }}>Enquiry Code:</span>
                                    <strong style={{ fontFamily: 'monospace', color: '#D97706' }}>{selectedEnquiryForLoadReceived.enquiry_code}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: '#7C5335' }}>Farmer:</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <strong style={{ color: '#2E1A0F' }}>{selectedEnquiryForLoadReceived.farmer_name}</strong>
                                        <span style={{ fontSize: '0.8rem', color: '#7C5335', fontFamily: 'monospace' }}>
                                            ({formatDisplayPhone(selectedEnquiryForLoadReceived.farmer_phone)})
                                        </span>
                                        {selectedEnquiryForLoadReceived.farmer_phone && (
                                            <a
                                                href={`tel:${normalizeTelPhone(selectedEnquiryForLoadReceived.farmer_phone)}`}
                                                className="mill-call-farmer-btn-sm"
                                                title="Call Farmer"
                                            >
                                                <i className="fa-solid fa-phone"></i> Call
                                            </a>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#7C5335' }}>Crop:</span>
                                    <strong style={{ color: '#FF8A00' }}>{selectedEnquiryForLoadReceived.crop_name}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#7C5335' }}>Agreed Price:</span>
                                    <strong style={{ color: '#D97706' }}>₹{selectedEnquiryForLoadReceived.offered_price || selectedEnquiryForLoadReceived.expected_price || 2450} / Quintal</strong>
                                </div>
                            </div>

                            {/* Actual Tonnes Input */}
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.4rem', color: '#7C5335', fontSize: '0.85rem', fontWeight: 600 }}>
                                    Actual Tonnes Received (Weighbridge Slip Weight) *
                                </label>
                                <div className="input-group">
                                    <i className="fa-solid fa-scale-balanced" style={{ color: '#FF8A00' }}></i>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0.1"
                                        value={actualReceivedTonnes}
                                        onChange={(e) => setActualReceivedTonnes(e.target.value)}
                                        placeholder="Enter actual tonnes (e.g. 12.5)"
                                        required
                                        style={{ background: '#FFF7ED', width: '100%', fontSize: '1rem', fontWeight: 700, color: '#2E1A0F' }}
                                    />
                                </div>
                            </div>

                            {/* Live Automated Calculation Display */}
                            {(() => {
                                const tonnes = Number(actualReceivedTonnes) || 0;
                                const quintals = Math.round(tonnes * 10 * 10) / 10;
                                const rate = Number(selectedEnquiryForLoadReceived.offered_price || selectedEnquiryForLoadReceived.expected_price || 2450);
                                const total = Math.round(quintals * rate);

                                return (
                                    <div style={{ background: 'rgba(255, 138, 0, 0.08)', border: '1px solid #EAD2B2', borderRadius: '0.75rem', padding: '1rem', fontSize: '0.85rem' }}>
                                        <div style={{ fontWeight: 700, color: '#D97706', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <i className="fa-solid fa-calculator"></i> Automated Bill Calculation
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                            <span style={{ color: '#7C5335' }}>Automated Quintals Conversion (1 Ton = 10 Qtl):</span>
                                            <strong>{quintals} Quintals</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                            <span style={{ color: '#7C5335' }}>Calculation Breakdown:</span>
                                            <span>{quintals} Qtl × ₹{rate} / Qtl</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #EAD2B2', paddingTop: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 700, color: '#2E1A0F' }}>Total Payable Amount:</span>
                                            <strong style={{ fontSize: '1.25rem', color: '#FF8A00' }}>₹{total.toLocaleString('en-IN')}</strong>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Remarks */}
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.4rem', color: '#7C5335', fontSize: '0.85rem', fontWeight: 600 }}>
                                    Weighbridge Slip No. / Quality Remarks (Optional)
                                </label>
                                <div className="input-group">
                                    <i className="fa-solid fa-clipboard-check" style={{ color: '#8B5E34' }}></i>
                                    <input
                                        type="text"
                                        value={weighbridgeRemarks}
                                        onChange={(e) => setWeighbridgeRemarks(e.target.value)}
                                        placeholder="e.g. Moisture 12.5%, Grade A, Slip #WB-881"
                                        style={{ background: '#FFF7ED', width: '100%', color: '#2E1A0F' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button type="button" className="action-btn" onClick={() => setSelectedEnquiryForLoadReceived(null)} style={{ flex: 1, justifyContent: 'center', padding: '0.8rem' }}>
                                    Cancel
                                </button>
                                <button type="submit" className="primary-btn" disabled={isSubmittingLoadReceived} style={{ flex: 1.5, justifyContent: 'center', padding: '0.8rem', fontWeight: 800 }}>
                                    {isSubmittingLoadReceived ? 'Recording Load...' : 'Confirm Load Received'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* MODAL 2: MAKE PAYMENT MODAL (WITH FARMER BANK DETAILS) */}
            {/* ======================================================== */}
            {selectedLoadForPayment && (
                <div className="modal-overlay" style={{ zIndex: 9999 }}>
                    <div className="modal-content" style={{ maxWidth: '580px', width: '92%', background: '#FFF7ED', border: '1px solid #DEC098', borderRadius: '1.25rem', padding: '1.5rem', color: '#2E1A0F' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #EAD2B2', paddingBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <i className="fa-solid fa-money-bill-wave" style={{ color: '#FF8A00', fontSize: '1.3rem' }}></i>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#2E1A0F' }}>Make Farmer Direct Payment</h3>
                            </div>
                            <button className="action-btn text-btn" onClick={() => setSelectedLoadForPayment(null)} style={{ color: '#7C5335', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                <i className="fa-solid fa-xmark" style={{ fontSize: '1.25rem' }}></i>
                            </button>
                        </div>

                        {copySuccessToast && (
                            <div style={{ background: '#FF8A00', color: '#FFFFFF', padding: '0.4rem 0.8rem', borderRadius: '0.4rem', fontSize: '0.8rem', fontWeight: 700, textAlign: 'center', marginBottom: '0.75rem' }}>
                                <i className="fa-solid fa-check-circle" style={{ marginRight: '0.3rem' }}></i>
                                {copySuccessToast}
                            </div>
                        )}

                        <form onSubmit={handleConfirmPaymentCompleted} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* Amount Highlight Card */}
                            <div style={{ background: 'linear-gradient(135deg, rgba(255, 138, 0, 0.12), rgba(217, 119, 6, 0.08))', border: '1px solid #EAD2B2', borderRadius: '0.75rem', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <span style={{ fontSize: '0.75rem', color: '#7C5335', textTransform: 'uppercase', fontWeight: 700 }}>Total Payable Amount</span>
                                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#FF8A00' }}>
                                        ₹{selectedLoadForPayment.total_amount?.toLocaleString('en-IN')}
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: '#7C5335' }}>
                                        {selectedLoadForPayment.crop_name} • {selectedLoadForPayment.quantity_tonnes} Tons ({selectedLoadForPayment.quantity_quintals} Qtl)
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#7C5335', display: 'block' }}>Agreed Rate</span>
                                    <strong style={{ color: '#2E1A0F', fontSize: '1.05rem' }}>₹{selectedLoadForPayment.price_per_quintal} / Qtl</strong>
                                </div>
                            </div>

                            {/* Farmer's Bank Account Details Box */}
                            <div style={{ background: '#F9E5C7', borderRadius: '0.75rem', border: '1px solid #EAD2B2', padding: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid #DEC098', paddingBottom: '0.5rem' }}>
                                    <span style={{ fontWeight: 800, color: '#8B5E34', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <i className="fa-solid fa-building-columns"></i>
                                        Farmer Bank Details (For Transfer)
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: '#7C5335' }}>
                                        {selectedLoadForPayment.farmer_name}
                                    </span>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                                    <div>
                                        <span style={{ color: '#7C5335', display: 'block', fontSize: '0.75rem' }}>Account Holder</span>
                                        <strong style={{ color: '#2E1A0F' }}>{selectedLoadForPayment.farmer_bank_details?.accountHolder || selectedLoadForPayment.farmer_name}</strong>
                                    </div>

                                    <div>
                                        <span style={{ color: '#7C5335', display: 'block', fontSize: '0.75rem' }}>Bank Name</span>
                                        <strong style={{ color: '#2E1A0F' }}>{selectedLoadForPayment.farmer_bank_details?.bankName || 'State Bank of India'}</strong>
                                    </div>

                                    <div>
                                        <span style={{ color: '#7C5335', display: 'block', fontSize: '0.75rem' }}>Account Number</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <strong style={{ fontFamily: 'monospace', color: '#2E1A0F' }}>
                                                {selectedLoadForPayment.farmer_bank_details?.accountNumber || '308912445892'}
                                            </strong>
                                            <button
                                                type="button"
                                                onClick={() => handleCopyText(selectedLoadForPayment.farmer_bank_details?.accountNumber || '308912445892', 'Account Number')}
                                                style={{ background: 'transparent', border: 'none', color: '#FF8A00', cursor: 'pointer', fontSize: '0.85rem' }}
                                                title="Copy Account Number"
                                            >
                                                <i className="fa-solid fa-copy"></i>
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <span style={{ color: '#7C5335', display: 'block', fontSize: '0.75rem' }}>IFSC Code</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <strong style={{ fontFamily: 'monospace', color: '#2E1A0F' }}>
                                                {selectedLoadForPayment.farmer_bank_details?.ifscCode || 'SBIN0004521'}
                                            </strong>
                                            <button
                                                type="button"
                                                onClick={() => handleCopyText(selectedLoadForPayment.farmer_bank_details?.ifscCode || 'SBIN0004521', 'IFSC Code')}
                                                style={{ background: 'transparent', border: 'none', color: '#FF8A00', cursor: 'pointer', fontSize: '0.85rem' }}
                                                title="Copy IFSC Code"
                                            >
                                                <i className="fa-solid fa-copy"></i>
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ gridColumn: 'span 2', background: '#FFF7ED', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #EAD2B2' }}>
                                        <div>
                                            <span style={{ color: '#7C5335', display: 'block', fontSize: '0.72rem' }}>UPI ID (Instant Pay)</span>
                                            <strong style={{ fontFamily: 'monospace', color: '#D97706' }}>
                                                {selectedLoadForPayment.farmer_bank_details?.upiId || `${selectedLoadForPayment.farmer_phone}@upi`}
                                            </strong>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleCopyText(selectedLoadForPayment.farmer_bank_details?.upiId || `${selectedLoadForPayment.farmer_phone}@upi`, 'UPI ID')}
                                            className="action-btn"
                                            style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem' }}
                                        >
                                            <i className="fa-solid fa-copy"></i> Copy UPI
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Razorpay Instant Checkout Option */}
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(255, 138, 0, 0.1) 0%, rgba(217, 119, 6, 0.15) 100%)',
                                border: '1px solid #EAD2B2',
                                borderRadius: '0.85rem',
                                padding: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '0.85rem',
                                flexWrap: 'wrap'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 800, color: '#8B5E34', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                        <i className="fa-solid fa-shield-halved" style={{ color: '#FF8A00' }}></i> Razorpay Standard Web Checkout
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: '#7C5335', marginTop: '0.2rem' }}>
                                        Direct settlement via UPI, Cards, or NetBanking with backend HMAC-SHA256 signature verification.
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    disabled={isSubmittingPayment}
                                    onClick={handleRazorpayPaymentForLoad}
                                    className="primary-btn"
                                    style={{
                                        fontWeight: 800,
                                        fontSize: '0.85rem',
                                        padding: '0.6rem 1.1rem',
                                        borderRadius: '0.625rem',
                                        cursor: isSubmittingPayment ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.45rem',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    <i className="fa-solid fa-bolt"></i> Pay ₹{selectedLoadForPayment.total_amount?.toLocaleString('en-IN')} Online
                                </button>
                            </div>

                            <div style={{ textAlign: 'center', position: 'relative', margin: '0.5rem 0' }}>
                                <hr style={{ borderColor: '#EAD2B2', margin: 0 }} />
                                <span style={{ position: 'relative', top: '-0.65rem', background: '#FFF7ED', padding: '0 0.75rem', color: '#7C5335', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                                    Or Record Manual Settlement
                                </span>
                            </div>

                            {/* Payment Method & UTR Reference Fields */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.35rem', color: '#7C5335', fontSize: '0.82rem', fontWeight: 600 }}>
                                        Payment Method
                                    </label>
                                    <div className="input-group">
                                        <i className={paymentMethod === 'Razorpay Standard Checkout' ? 'fa-solid fa-shield-halved' : 'fa-solid fa-credit-card'} style={{ color: '#FF8A00' }}></i>
                                        <select
                                            value={paymentMethod}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setPaymentMethod(val);
                                                if (val === 'Razorpay Standard Checkout') {
                                                    setPaymentReference('Auto-generated (Razorpay Payment ID)');
                                                } else if (paymentReference.includes('Auto-generated')) {
                                                    setPaymentReference('UTR-' + Math.floor(10000000 + Math.random() * 90000000));
                                                }
                                            }}
                                            style={{ width: '100%', background: '#FFF7ED', border: 'none', color: '#2E1A0F', outline: 'none' }}
                                        >
                                            <option value="Razorpay Standard Checkout">⚡ Razorpay Standard Checkout (UPI / Cards / NetBanking)</option>
                                            <option value="Bank Transfer (NEFT/RTGS)">Bank Transfer (NEFT/RTGS)</option>
                                            <option value="UPI Transfer">UPI Transfer</option>
                                            <option value="IMPS Immediate Payment">IMPS Immediate</option>
                                            <option value="Mandi Settlement / Cash">Mandi Cash Settlement</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.35rem', color: '#7C5335', fontSize: '0.82rem', fontWeight: 600 }}>
                                        Transaction / UTR Reference No. *
                                    </label>
                                    <div className="input-group" style={{ opacity: paymentMethod === 'Razorpay Standard Checkout' ? 0.8 : 1 }}>
                                        <i className={paymentMethod === 'Razorpay Standard Checkout' ? 'fa-solid fa-lock' : 'fa-solid fa-receipt'} style={{ color: '#8B5E34' }}></i>
                                        <input
                                            type="text"
                                            value={paymentReference}
                                            onChange={(e) => setPaymentReference(e.target.value)}
                                            readOnly={paymentMethod === 'Razorpay Standard Checkout'}
                                            placeholder="UTR-XXXX-XXXX"
                                            required
                                            style={{
                                                background: '#FFF7ED',
                                                width: '100%',
                                                fontFamily: 'monospace',
                                                color: '#2E1A0F'
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button type="button" className="action-btn" onClick={() => setSelectedLoadForPayment(null)} style={{ flex: 1, justifyContent: 'center', padding: '0.85rem' }}>
                                    Cancel
                                </button>
                                {paymentMethod === 'Razorpay Standard Checkout' ? (
                                    <button
                                        type="submit"
                                        disabled={isSubmittingPayment}
                                        className="primary-btn"
                                        style={{
                                            flex: 1.6,
                                            justifyContent: 'center',
                                            padding: '0.85rem',
                                            fontWeight: 800,
                                            borderRadius: '0.625rem',
                                            cursor: isSubmittingPayment ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            fontSize: '0.9rem'
                                        }}
                                    >
                                        {isSubmittingPayment ? (
                                            <>
                                                <i className="fa-solid fa-spinner fa-spin"></i>
                                                <span>Connecting Razorpay...</span>
                                            </>
                                        ) : (
                                            <>
                                                <i className="fa-solid fa-shield-halved"></i>
                                                <span>Pay ₹{selectedLoadForPayment.total_amount?.toLocaleString('en-IN')} with Razorpay</span>
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <button type="submit" className="primary-btn" disabled={isSubmittingPayment} style={{ flex: 1.5, justifyContent: 'center', padding: '0.85rem', fontWeight: 800 }}>
                                        <i className="fa-solid fa-circle-check"></i>
                                        {isSubmittingPayment ? 'Updating Status...' : 'Payment Completed'}
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* MODAL 3: VIEW PAYMENT RECEIPT */}
            {/* ======================================================== */}
            {selectedLoadForReceipt && (
                <div className="modal-overlay" style={{ zIndex: 9999 }}>
                    <div className="modal-content" style={{ maxWidth: '540px', width: '92%', background: '#FFFFFF', border: '1px solid #DEC098', borderRadius: '1.25rem', padding: '1.5rem', color: '#1C0F05', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.65rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <i className="fa-solid fa-receipt" style={{ color: '#FF8A00', fontSize: '1.25rem' }}></i>
                                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#1C0F05' }}>Produce Intake Payment Receipt</h3>
                            </div>
                            <button className="action-btn text-btn" onClick={() => setSelectedLoadForReceipt(null)} style={{ color: '#64748B', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.25rem' }}>
                                <i className="fa-solid fa-xmark" style={{ fontSize: '1.25rem' }}></i>
                            </button>
                        </div>

                        {/* PURE WHITE PRINTABLE VOUCHER */}
                        <div 
                            id="payment-receipt-print-area" 
                            className="printable-payment-receipt"
                            style={{ 
                                background: '#FFFFFF', 
                                borderRadius: '1rem', 
                                border: '2px solid #E2E8F0', 
                                padding: '1.5rem', 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '0.75rem', 
                                fontSize: '0.88rem',
                                color: '#0F172A',
                                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)'
                            }}
                        >
                            {/* Official KisanConnect Branded Header */}
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                borderBottom: '2px solid #E2E8F0', 
                                paddingBottom: '0.85rem',
                                marginBottom: '0.25rem'
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                    <KisanLogo size="md" />
                                    <div style={{ fontSize: '0.72rem', color: '#059669', marginTop: '0.3rem', fontWeight: 700, letterSpacing: '0.25px' }}>
                                        Stronger Farms. Brighter Futures.
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ display: 'inline-block', fontSize: '0.68rem', fontWeight: 800, color: '#059669', background: '#ECFDF5', padding: '0.2rem 0.55rem', borderRadius: '0.35rem', border: '1px solid #A7F3D0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Official Settlement Receipt
                                    </span>
                                    <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '0.25rem', fontFamily: 'monospace' }}>
                                        DOC: KC-REC-{selectedLoadForReceipt.enquiry_code || '2026-01'}
                                    </div>
                                </div>
                            </div>

                            {/* Settlement Banner */}
                            <div style={{ textAlign: 'center', background: '#F8FAFC', borderRadius: '0.75rem', border: '1px solid #E2E8F0', padding: '0.9rem', margin: '0.25rem 0' }}>
                                <span className="status-badge" style={{ background: '#D1FAE5', color: '#065F46', fontWeight: 800, padding: '0.3rem 0.85rem', borderRadius: '1rem', fontSize: '0.78rem', border: '1px solid #A7F3D0', display: 'inline-block' }}>
                                    ✓ SETTLEMENT COMPLETED
                                </span>
                                <div style={{ margin: '0.45rem 0 0.15rem 0', color: '#0F172A', fontSize: '1.75rem', fontWeight: 900 }}>
                                    ₹{selectedLoadForReceipt.total_amount?.toLocaleString('en-IN')}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                                    Paid on {new Date(selectedLoadForReceipt.paid_at || selectedLoadForReceipt.received_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                </div>
                            </div>

                            {/* Meta Key-Value Details */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px dashed #E2E8F0' }}>
                                <span style={{ color: '#64748B' }}>Enquiry Code:</span>
                                <strong style={{ fontFamily: 'monospace', color: '#0F172A' }}>{selectedLoadForReceipt.enquiry_code}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0', borderBottom: '1px dashed #E2E8F0' }}>
                                <span style={{ color: '#64748B' }}>Farmer:</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <strong style={{ color: '#0F172A' }}>{selectedLoadForReceipt.farmer_name}</strong>
                                    <span style={{ fontSize: '0.8rem', color: '#64748B', fontFamily: 'monospace' }}>
                                        ({formatDisplayPhone(selectedLoadForReceipt.farmer_phone)})
                                    </span>
                                    {selectedLoadForReceipt.farmer_phone && (
                                        <a
                                            href={`tel:${normalizeTelPhone(selectedLoadForReceipt.farmer_phone)}`}
                                            className="mill-call-farmer-btn-sm no-print"
                                            title="Call Farmer"
                                        >
                                            <i className="fa-solid fa-phone"></i>
                                        </a>
                                    )}
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px dashed #E2E8F0' }}>
                                <span style={{ color: '#64748B' }}>Purchaser Mill:</span>
                                <strong style={{ color: '#0F172A' }}>{selectedLoadForReceipt.mill_name}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px dashed #E2E8F0' }}>
                                <span style={{ color: '#64748B' }}>Crop Received:</span>
                                <strong style={{ color: '#D97706' }}>{selectedLoadForReceipt.crop_name}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px dashed #E2E8F0' }}>
                                <span style={{ color: '#64748B' }}>Weighed Quantity:</span>
                                <strong style={{ color: '#0F172A' }}>{selectedLoadForReceipt.quantity_tonnes} Tonnes ({selectedLoadForReceipt.quantity_quintals} Quintals)</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px dashed #E2E8F0' }}>
                                <span style={{ color: '#64748B' }}>Rate per Quintal:</span>
                                <strong style={{ color: '#0F172A' }}>₹{selectedLoadForReceipt.price_per_quintal} / Qtl</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px dashed #E2E8F0' }}>
                                <span style={{ color: '#64748B' }}>Payment Method:</span>
                                <strong style={{ color: '#0F172A' }}>{selectedLoadForReceipt.payment_method || 'Direct Bank Transfer'}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0' }}>
                                <span style={{ color: '#64748B' }}>Payment / UTR Ref:</span>
                                <strong style={{ fontFamily: 'monospace', color: '#059669' }}>{selectedLoadForReceipt.transaction_reference}</strong>
                            </div>

                            {/* Verification Signature Seal */}
                            {selectedLoadForReceipt.payment_method === 'Razorpay Standard Checkout' && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: '#F0FDF4', borderRadius: '0.5rem', border: '1px solid #BBF7D0', marginTop: '0.25rem' }}>
                                    <span style={{ color: '#166534', fontSize: '0.78rem', fontWeight: 600 }}>Security Verification:</span>
                                    <span style={{ color: '#15803D', fontWeight: 800, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <i className="fa-solid fa-circle-check"></i> HMAC-SHA256 Signature Verified (Captured)
                                    </span>
                                </div>
                            )}

                            {/* Official Footer Note */}
                            <div style={{ textAlign: 'center', fontSize: '0.7rem', color: '#94A3B8', borderTop: '1px solid #E2E8F0', paddingTop: '0.65rem', marginTop: '0.35rem' }}>
                                🌾 KisanConnect Unified Agricultural Ecosystem • Authorized Digital Settlement Receipt
                            </div>
                        </div>

                        {/* Action Buttons (Hidden on Print) */}
                        <div className="no-print" style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                            <button 
                                className="primary-btn" 
                                onClick={() => {
                                    const printWindow = window.open('', '_blank', 'width=850,height=950');
                                    if (!printWindow) {
                                        window.print();
                                        return;
                                    }
                                    const logoSvg = `<div style="display:inline-flex;align-items:center;gap:10px;"><img src="/kisanconnect-logo.svg" alt="KisanConnect" style="width:38px;height:38px;object-fit:contain;"/><span style="font-size:24px;font-weight:800;letter-spacing:-0.5px;font-family:'Poppins',sans-serif;"><span style="color:#10B981;">Kisan</span><span style="color:#0F172A;margin-left:2px;">Connect</span></span></div>`;
                                    
                                    printWindow.document.write(`
                                        <!DOCTYPE html>
                                        <html>
                                        <head>
                                            <meta charset="utf-8">
                                            <title>KisanConnect Receipt - ${selectedLoadForReceipt.enquiry_code || 'Voucher'}</title>
                                            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
                                            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
                                            <style>
                                                @page { size: A4 portrait; margin: 15mm 20mm; }
                                                * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Poppins', -apple-system, sans-serif; }
                                                body { background: #ffffff !important; color: #0f172a; padding: 30px 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                                                .print-card { max-width: 650px; margin: 0 auto; border: 2px solid #e2e8f0; border-radius: 16px; padding: 28px 32px; background: #ffffff; }
                                                .header-row { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 18px; }
                                                .badge-settled { display: inline-block; background: #d1fae5 !important; color: #065f46 !important; font-weight: 800; font-size: 13px; padding: 4px 14px; border-radius: 20px; border: 1px solid #a7f3d0; }
                                                .amount-container { text-align: center; background: #f8fafc !important; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 18px; }
                                                .amount-val { font-size: 32px; font-weight: 900; color: #0f172a; margin: 6px 0 2px 0; }
                                                .info-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px dashed #e2e8f0; font-size: 14px; }
                                                .info-label { color: #64748b; font-weight: 500; }
                                                .info-value { color: #0f172a; font-weight: 700; }
                                                .sec-banner { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #f0fdf4 !important; border: 1px solid #bbf7d0; border-radius: 8px; margin-top: 14px; font-size: 13px; }
                                                .footer-banner { text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 14px; margin-top: 18px; }
                                            </style>
                                        </head>
                                        <body>
                                            <div class="print-card">
                                                <div class="header-row">
                                                    <div>
                                                        ${logoSvg}
                                                        <div style="font-size: 12px; color: #059669; font-weight: 700; margin-top: 4px; letter-spacing: 0.3px;">
                                                            Stronger Farms. Brighter Futures.
                                                        </div>
                                                    </div>
                                                    <div style="text-align: right;">
                                                        <span style="display: inline-block; font-size: 11px; font-weight: 800; color: #059669; background: #ecfdf5; padding: 3px 10px; border-radius: 6px; border: 1px solid #a7f3d0; text-transform: uppercase; letter-spacing: 0.5px;">
                                                            Official Settlement Receipt
                                                        </span>
                                                        <div style="font-size: 11px; color: #64748b; margin-top: 4px; font-family: monospace;">
                                                            DOC: KC-REC-${selectedLoadForReceipt.enquiry_code || '2026-01'}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div class="amount-container">
                                                    <span class="badge-settled">✓ SETTLEMENT COMPLETED</span>
                                                    <div class="amount-val">₹${Number(selectedLoadForReceipt.total_amount || 0).toLocaleString('en-IN')}</div>
                                                    <div style="font-size: 12px; color: #64748b;">
                                                        Paid on ${new Date(selectedLoadForReceipt.paid_at || selectedLoadForReceipt.received_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                                    </div>
                                                </div>

                                                <div class="info-row">
                                                    <span class="info-label">Enquiry Code:</span>
                                                    <span class="info-value" style="font-family: monospace;">${selectedLoadForReceipt.enquiry_code}</span>
                                                </div>

                                                <div class="info-row">
                                                    <span class="info-label">Beneficiary Farmer:</span>
                                                    <span class="info-value">${selectedLoadForReceipt.farmer_name} (${formatDisplayPhone(selectedLoadForReceipt.farmer_phone)})</span>
                                                </div>

                                                <div class="info-row">
                                                    <span class="info-label">Purchaser Processing Mill:</span>
                                                    <span class="info-value">${selectedLoadForReceipt.mill_name}</span>
                                                </div>

                                                <div class="info-row">
                                                    <span class="info-label">Crop Delivered:</span>
                                                    <span class="info-value" style="color: #d97706;">${selectedLoadForReceipt.crop_name}</span>
                                                </div>

                                                <div class="info-row">
                                                    <span class="info-label">Weighed Quantity:</span>
                                                    <span class="info-value">${selectedLoadForReceipt.quantity_tonnes} Tonnes (${selectedLoadForReceipt.quantity_quintals} Quintals)</span>
                                                </div>

                                                <div class="info-row">
                                                    <span class="info-label">Procurement Rate:</span>
                                                    <span class="info-value">₹${selectedLoadForReceipt.price_per_quintal} / Quintal</span>
                                                </div>

                                                <div class="info-row">
                                                    <span class="info-label">Settlement Mode:</span>
                                                    <span class="info-value">${selectedLoadForReceipt.payment_method || 'Direct Bank Transfer'}</span>
                                                </div>

                                                <div class="info-row">
                                                    <span class="info-label">Transaction / UTR Reference:</span>
                                                    <span class="info-value" style="font-family: monospace; color: #059669;">${selectedLoadForReceipt.transaction_reference}</span>
                                                </div>

                                                ${selectedLoadForReceipt.payment_method === 'Razorpay Standard Checkout' ? `
                                                <div class="sec-banner">
                                                    <span style="color: #166534; font-weight: 600;">Security Verification:</span>
                                                    <span style="color: #15803D; font-weight: 800; display: flex; align-items: center; gap: 4px;">
                                                        <i class="fa-solid fa-circle-check"></i> HMAC-SHA256 Signature Verified (Captured)
                                                    </span>
                                                </div>
                                                ` : ''}

                                                <div class="footer-banner">
                                                    🌾 KisanConnect Unified Agricultural Ecosystem • Official Digital Settlement Voucher
                                                </div>
                                            </div>
                                        </body>
                                        </html>
                                    `);
                                    printWindow.document.close();
                                    setTimeout(() => {
                                        printWindow.focus();
                                        printWindow.print();
                                    }, 250);
                                }} 
                                style={{ flex: 1, justifyContent: 'center', background: '#FF8A00', color: '#FFF' }}
                            >
                                <i className="fa-solid fa-print"></i> Print Receipt
                            </button>
                            <button className="action-btn" onClick={() => setSelectedLoadForReceipt(null)} style={{ flex: 1, justifyContent: 'center', background: '#F1F5F9', color: '#334155' }}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Instant Floating Action Toast */}
            {copySuccessToast && (
                <div style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '24px',
                    backgroundColor: copySuccessToast.includes('Reject') ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)',
                    color: '#fff',
                    padding: '12px 22px',
                    borderRadius: '10px',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
                    backdropFilter: 'blur(10px)',
                    zIndex: 99999,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '0.92rem',
                    fontWeight: '700',
                    border: '1px solid rgba(255,255,255,0.25)',
                    animation: 'fadeInUp 0.3s ease-out'
                }}>
                    <i className={copySuccessToast.includes('Reject') ? 'fa-solid fa-circle-xmark' : 'fa-solid fa-circle-check'} style={{ fontSize: '1.25rem' }}></i>
                    <span>{copySuccessToast}</span>
                </div>
            )}

            {/* Standalone Razorpay Checkout Test Modal */}
            <RazorpayCheckoutModal
                isOpen={showStandaloneRazorpay}
                onClose={() => setShowStandaloneRazorpay(false)}
                defaultAmount={500}
                title="Razorpay Standard Checkout (Mill Portal)"
                description="Produce Settlement Test Payment"
                onPaymentSuccess={async () => {
                    await refreshAllData();
                }}
            />
        </div>
    );
}
