import { supabase } from '../utils/supabase';
import { calculateDistance, calculateHaversineDistance, getRoadRouteDistance, formatDistance } from './locationService';

// Local storage backup keys
const STORAGE_KEYS = {
    ENQUIRIES: 'kisan_enquiries',
    LOADS: 'kisan_loads',
    TRANSPORT_REQUESTS: 'kisan_transport_requests',
    TRANSPORT_QUOTES: 'kisan_transport_quotes',
    TRANSPORT_PROVIDERS: 'kisan_transport_providers',
    NOTIFICATIONS: 'kisan_notifications'
};

// Seed initial default transport providers if none exist with rich testing data
export const DEFAULT_PROVIDERS = [
    // 5 - 8 Ton Tier (Mini / Light Commercial Trucks)
    {
        phone: '9876500002',
        pin: '1234',
        name: 'Venkatesh Rao (Balaji Agro Freight)',
        driver_name: 'Venkatesh Rao',
        vehicle_name: 'Tata 407 Gold SFC',
        vehicle_number: 'TS 08 UB 7712',
        vehicle_type: 'Mini Commercial Truck',
        capacity: 5,
        price_per_km: 28,
        rating: 4.8,
        availability: 'AVAILABLE',
        current_location_name: 'Karimnagar Bypass',
        service_area: 'North Telangana',
        vehicle_images: []
    },
    {
        phone: '9876500009',
        pin: '1234',
        name: 'Raju Shinde (Kisan Bandhu Mini Express)',
        driver_name: 'Raju Shinde',
        vehicle_name: 'Mahindra Bolero Maxi Truck',
        vehicle_number: 'TS 15 EF 1234',
        vehicle_type: 'Agri Pickup Truck',
        capacity: 7,
        price_per_km: 30,
        rating: 4.7,
        availability: 'AVAILABLE',
        current_location_name: 'Warangal Subedari',
        service_area: 'Warangal & Surrounding Villages',
        vehicle_images: []
    },
    {
        phone: '9876500011',
        pin: '1234',
        name: 'Mallesh Goud (Rythu Mitra Express)',
        driver_name: 'Mallesh Goud',
        vehicle_name: 'Eicher Pro 2049 Light Truck',
        vehicle_number: 'TS 09 BC 3412',
        vehicle_type: 'Light Commercial Truck',
        capacity: 6,
        price_per_km: 29,
        rating: 4.85,
        availability: 'AVAILABLE',
        current_location_name: 'Jangaon Market Yard',
        service_area: 'Central Telangana',
        vehicle_images: []
    },

    // 8 - 14 Ton Tier (Medium Haulage / Intermediate Trucks)
    {
        phone: '9876500004',
        pin: '1234',
        name: 'Mahesh Reddy (Gramin Kisan Express)',
        driver_name: 'Mahesh Reddy',
        vehicle_name: 'Tata 1109 G LPT',
        vehicle_number: 'TS 07 TC 1109',
        vehicle_type: 'Intermediate Cargo Truck',
        capacity: 10,
        price_per_km: 35,
        rating: 4.75,
        availability: 'AVAILABLE',
        current_location_name: 'Nizamabad Yard',
        service_area: 'Telangana State',
        vehicle_images: []
    },
    {
        phone: '9876500010',
        pin: '1234',
        name: 'Vamshi Krishna (Telangana Grain Movers)',
        driver_name: 'Vamshi Krishna',
        vehicle_name: 'Ashok Leyland Ecomet 1215',
        vehicle_number: 'TS 03 GH 8899',
        vehicle_type: 'Medium Duty Truck',
        capacity: 12,
        price_per_km: 38,
        rating: 4.8,
        availability: 'AVAILABLE',
        current_location_name: 'Suryapet Mandi',
        service_area: 'Southern Telangana',
        vehicle_images: []
    },
    {
        phone: '9876500012',
        pin: '1234',
        name: 'Shankar Nayak (Kakatiya Agro Haulage)',
        driver_name: 'Shankar Nayak',
        vehicle_name: 'BharatBenz 1217C Lorry',
        vehicle_number: 'TS 05 KL 5678',
        vehicle_type: 'Intermediate Heavy Truck',
        capacity: 11,
        price_per_km: 37,
        rating: 4.9,
        availability: 'AVAILABLE',
        current_location_name: 'Warangal Grain Market',
        service_area: 'Warangal & Khammam',
        vehicle_images: []
    },

    // 12 - 18 Ton Tier (Standard / Heavy 6-Wheel Trucks)
    {
        phone: '9876500001',
        pin: '1234',
        name: 'Ramesh Yadav (Kisan Gati Logistics)',
        driver_name: 'Ramesh Yadav',
        vehicle_name: 'Tata 1512 LPT Cargo',
        vehicle_number: 'TS 09 EA 4421',
        vehicle_type: 'Heavy Standard Truck',
        capacity: 15,
        price_per_km: 42,
        rating: 4.9,
        availability: 'AVAILABLE',
        current_location_name: 'Warangal Agri Hub',
        service_area: 'Telangana & AP',
        vehicle_images: []
    },
    {
        phone: '9876500006',
        pin: '1234',
        name: 'Anji Babu (Deccan Agro Haulers)',
        driver_name: 'Anji Babu',
        vehicle_name: 'Eicher Pro 3015 Freight',
        vehicle_number: 'TS 04 XY 7890',
        vehicle_type: 'Heavy Commercial Truck',
        capacity: 18,
        price_per_km: 48,
        rating: 4.8,
        availability: 'AVAILABLE',
        current_location_name: 'Khammam Rural',
        service_area: 'Central Telangana',
        vehicle_images: []
    },
    {
        phone: '9876500013',
        pin: '1234',
        name: 'Krishna Murthy (Sri Sai Grain Freight)',
        driver_name: 'Krishna Murthy',
        vehicle_name: 'Ashok Leyland 1615 HE',
        vehicle_number: 'AP 24 MN 9812',
        vehicle_type: 'Standard Heavy Truck',
        capacity: 16,
        price_per_km: 44,
        rating: 4.85,
        availability: 'AVAILABLE',
        current_location_name: 'Miryalaguda Mill Area',
        service_area: 'Nalgonda & Khammam',
        vehicle_images: []
    },

    // 18 - 25 Ton Tier (Heavy 10-Wheeler / Multi-Axle Trucks)
    {
        phone: '9876500005',
        pin: '1234',
        name: 'Chandra Shekar (Sri Lakshmi Transport)',
        driver_name: 'Chandra Shekar',
        vehicle_name: 'BharatBenz 1923C Heavy Hauler',
        vehicle_number: 'TS 12 AB 5566',
        vehicle_type: 'Multi-Axle Heavy Truck',
        capacity: 20,
        price_per_km: 52,
        rating: 4.9,
        availability: 'AVAILABLE',
        current_location_name: 'Nalgonda Agri Zone',
        service_area: 'Telangana & Coastal AP',
        vehicle_images: []
    },
    {
        phone: '9876500007',
        pin: '1234',
        name: 'Prasad Naidu (Khammam Express Logistics)',
        driver_name: 'Prasad Naidu',
        vehicle_name: 'Tata Signa 1918.K Lorry',
        vehicle_number: 'AP 20 QR 3344',
        vehicle_type: 'Heavy 10-Wheeler Lorry',
        capacity: 22,
        price_per_km: 56,
        rating: 4.95,
        availability: 'AVAILABLE',
        current_location_name: 'Bodulabanda Cross',
        service_area: 'Telangana & Andhra Pradesh',
        vehicle_images: []
    },
    {
        phone: '9876500008',
        pin: '1234',
        name: 'Naveen Kumar (Godavari Heavy Freight)',
        driver_name: 'Naveen Kumar',
        vehicle_name: 'Ashok Leyland 1920 Tipper',
        vehicle_number: 'AP 31 KL 9012',
        vehicle_type: 'Heavy Multi-Axle Lorry',
        capacity: 24,
        price_per_km: 60,
        rating: 4.85,
        availability: 'AVAILABLE',
        current_location_name: 'Kothagudem Hub',
        service_area: 'Godavari Basin & Telangana',
        vehicle_images: []
    },

    // 22 - 45 Ton Tier (Heavy Multi-Axle Trailers & Mega Haulers)
    {
        phone: '9876500003',
        pin: '1234',
        name: 'Suresh Goud (Annapurna Heavy Haulers)',
        driver_name: 'Suresh Goud',
        vehicle_name: 'Tata Signa 2823.K HD',
        vehicle_number: 'AP 16 TZ 9980',
        vehicle_type: '10-Wheeler Heavy Lorry',
        capacity: 25,
        price_per_km: 65,
        rating: 5.0,
        availability: 'AVAILABLE',
        current_location_name: 'Khammam Mandi',
        service_area: 'South India Express',
        vehicle_images: []
    },
    {
        phone: '9876500014',
        pin: '1234',
        name: 'Rajendra Prasad (Deccan Super Multi-Axle)',
        driver_name: 'Rajendra Prasad',
        vehicle_name: 'BharatBenz 3528C Heavy Trailer',
        vehicle_number: 'TS 11 TR 8822',
        vehicle_type: 'Multi-Axle Heavy Trailer',
        capacity: 32,
        price_per_km: 75,
        rating: 4.95,
        availability: 'AVAILABLE',
        current_location_name: 'Hyderabad Outer Ring Road Hub',
        service_area: 'Telangana, AP & Karnataka',
        vehicle_images: []
    },
    {
        phone: '9876500015',
        pin: '1234',
        name: 'Satyanarayana (Telangana Agro Express Lines)',
        driver_name: 'Satyanarayana',
        vehicle_name: 'Ashok Leyland 2820 6x2 Haulage',
        vehicle_number: 'AP 09 TY 1144',
        vehicle_type: 'Multi-Axle Heavy Hauler',
        capacity: 28,
        price_per_km: 70,
        rating: 4.9,
        availability: 'AVAILABLE',
        current_location_name: 'Vijayawada Highway Hub',
        service_area: 'Telangana & Andhra Pradesh',
        vehicle_images: []
    }
];

function getLocal(key, defaultValue = []) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch {
        return defaultValue;
    }
}

function setLocal(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error("Local storage error:", e);
    }
}

// Distance calculations re-exported from locationService
export { calculateDistance, calculateHaversineDistance, getRoadRouteDistance, formatDistance } from './locationService';

// Calculate truck capacity range based on selected capacity (e.g. 20 Tons -> 18 to 25 Tons)
export function getCapacityRange(selectedCapacityTons) {
    const cap = Number(selectedCapacityTons) || 10;
    if (cap <= 5) {
        return { min: 4, max: 8, label: '4 – 8 Tons' };
    } else if (cap <= 10) {
        return { min: 8, max: 14, label: '8 – 14 Tons' };
    } else if (cap <= 15) {
        return { min: 12, max: 18, label: '12 – 18 Tons' };
    } else if (cap <= 20) {
        return { min: 18, max: 25, label: '18 – 25 Tons' }; // 18 to 25 Tons as specified
    } else if (cap <= 25) {
        return { min: 22, max: 30, label: '22 – 30 Tons' };
    } else {
        const minVal = Math.max(1, Math.round(cap * 0.85));
        const maxVal = Math.round(cap * 1.3);
        return { min: minVal, max: maxVal, label: `${minVal} – ${maxVal} Tons` };
    }
}

// Generate Unique Permanent Enquiry ID: KC-2026-000123
export function generateEnquiryId() {
    const year = new Date().getFullYear();
    const existing = getLocal(STORAGE_KEYS.ENQUIRIES, []);
    const count = existing.length + 1;
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const padded = String(count).padStart(3, '0') + randomSuffix;
    return `KC-${year}-${padded.slice(0, 6)}`;
}

// Generate Unique Transport Request ID: TR-2026-000045
export function generateTransportId() {
    const year = new Date().getFullYear();
    const existing = getLocal(STORAGE_KEYS.TRANSPORT_REQUESTS, []);
    const count = existing.length + 1;
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const padded = String(count).padStart(3, '0') + randomSuffix;
    return `TR-${year}-${padded.slice(0, 6)}`;
}

class KisanService {
    constructor() {
        this.listeners = [];
        // Ensure default transport providers initialized
        const providers = getLocal(STORAGE_KEYS.TRANSPORT_PROVIDERS, []);
        if (providers.length === 0) {
            setLocal(STORAGE_KEYS.TRANSPORT_PROVIDERS, DEFAULT_PROVIDERS);
        }
        this.setupRealtime();
    }

    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    notify(event, payload) {
        this.listeners.forEach(cb => {
            try { cb(event, payload); } catch (e) { console.error("Listener error:", e); }
        });
    }

    setupRealtime() {
        try {
            if (!supabase || !supabase.channel) return;
            const channel = supabase.channel('kisan_realtime_channel');
            channel
                .on('postgres_changes', { event: '*', schema: 'public', table: 'enquiries' }, payload => {
                    this.notify('enquiries_changed', payload);
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'transport_requests' }, payload => {
                    this.notify('transport_changed', payload);
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'loads' }, payload => {
                    this.notify('loads_changed', payload);
                })
                .subscribe();
        } catch (e) {
            console.warn("Realtime setup skipped:", e);
        }
    }

    // ==========================================
    // NOTIFICATIONS
    // ==========================================
    addNotification(userPhone, role, title, message, type = 'info', meta = {}) {
        const notifs = getLocal(STORAGE_KEYS.NOTIFICATIONS, []);
        const newNotif = {
            id: 'NOTIF-' + Date.now(),
            userPhone,
            role,
            title,
            message,
            type,
            meta,
            read: false,
            timestamp: new Date().toISOString()
        };
        notifs.unshift(newNotif);
        setLocal(STORAGE_KEYS.NOTIFICATIONS, notifs.slice(0, 100));
        this.notify('notification_added', newNotif);
        return newNotif;
    }

    getNotifications(userPhone, role) {
        const notifs = getLocal(STORAGE_KEYS.NOTIFICATIONS, []);
        return notifs.filter(n => (n.userPhone === userPhone || !userPhone) && (!role || n.role === role));
    }

    markNotificationRead(id) {
        const notifs = getLocal(STORAGE_KEYS.NOTIFICATIONS, []);
        const updated = notifs.map(n => n.id === id ? { ...n, read: true } : n);
        setLocal(STORAGE_KEYS.NOTIFICATIONS, updated);
        this.notify('notification_read', id);
    }

    // ==========================================
    // TRANSPORT PROVIDER DISCOVERY & RATES
    // ==========================================
    async getAvailableTransporters({ farmerLat, farmerLng, requiredCapacityTons = 0, minCapacityTons, maxCapacityTons, vehicleType } = {}) {
        let providers = [];
        try {
            if (supabase && supabase.from) {
                const fetchPromise = supabase.from('transport_providers').select('*');
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500));
                const res = await Promise.race([fetchPromise, timeoutPromise]);
                if (res && !res.error && res.data && res.data.length > 0) {
                    providers = res.data;
                }
            }
        } catch (e) {
            // Fail-safe immediate fallback
        }

        const localProviders = getLocal(STORAGE_KEYS.TRANSPORT_PROVIDERS, DEFAULT_PROVIDERS);
        const map = new Map();
        
        // Seed default rich test drivers first
        DEFAULT_PROVIDERS.forEach(p => map.set(p.phone, { ...p }));

        // Merge stored local providers ensuring custom added vehicles and uploaded images are fully preserved
        if (Array.isArray(localProviders) && localProviders.length > 0) {
            localProviders.forEach(p => {
                if (!p || !p.phone) return;
                const existing = map.get(p.phone) || {};
                const validImgs = (p.vehicle_images && Array.isArray(p.vehicle_images)) 
                    ? p.vehicle_images.filter(img => typeof img === 'string' && img.trim().length > 0)
                    : [];

                const assignedImgs = validImgs.length > 0 ? validImgs : (existing.vehicle_images || []);

                map.set(p.phone, {
                    ...existing,
                    ...p,
                    phone: p.phone,
                    driver_name: p.driver_name || p.name || existing.driver_name || 'Fleet Driver',
                    name: p.name || p.driver_name || existing.name || 'Fleet Transporter',
                    vehicle_number: (p.vehicle_number || existing.vehicle_number || 'TS 09 EA 4421').toUpperCase(),
                    vehicle_name: p.vehicle_name || p.vehicle_type || existing.vehicle_name || (Number(p.capacity || 10) <= 7 ? 'Tata 407 Gold SFC' : Number(p.capacity || 10) <= 14 ? 'Tata 1109 G LPT' : Number(p.capacity || 10) <= 18 ? 'Tata 1512 LPT Cargo' : Number(p.capacity || 10) <= 24 ? 'BharatBenz 1923C Heavy Hauler' : 'Tata Signa 2823.K HD'),
                    vehicle_type: p.vehicle_type || existing.vehicle_type || 'Standard Truck',
                    capacity: Number(p.capacity || existing.capacity || 10),
                    price_per_km: Number(p.price_per_km || existing.price_per_km || 35),
                    vehicle_images: assignedImgs,
                    is_custom: true
                });
            });
        }

        // Merge Supabase providers
        if (Array.isArray(providers) && providers.length > 0) {
            providers.forEach(p => {
                if (!p || !p.phone) return;
                const existing = map.get(p.phone) || {};
                const validImgs = (p.vehicle_images && Array.isArray(p.vehicle_images)) 
                    ? p.vehicle_images.filter(img => typeof img === 'string' && img.trim().length > 0)
                    : [];
                map.set(p.phone, {
                    ...existing,
                    ...p,
                    vehicle_name: p.vehicle_name || existing.vehicle_name,
                    vehicle_images: validImgs.length > 0 ? validImgs : (existing.vehicle_images || [])
                });
            });
        }

        const combined = Array.from(map.values()).length > 0 ? Array.from(map.values()) : DEFAULT_PROVIDERS;

        const fLat = Number(farmerLat) || 17.0916;
        const fLng = Number(farmerLng) || 80.0210;

        let mapped = combined.map(p => {
            const pLat = Number(p.current_lat) || 17.1000 + (Math.random() * 0.05);
            const pLng = Number(p.current_lng) || 80.0200 + (Math.random() * 0.05);
            let distance = 12;
            try {
                distance = calculateDistance(fLat, fLng, pLat, pLng) || 12;
            } catch (err) {
                distance = 12;
            }
            const ratePerKm = Number(p.price_per_km) || 35;
            const estimatedCost = Math.round(distance * ratePerKm);
            const capacity = Number(p.capacity) || 10;
            const requiredTons = Number(requiredCapacityTons) || 0;
            const isCapacitySufficient = capacity >= requiredTons;

            const isWithinRange = (minCapacityTons !== undefined && maxCapacityTons !== undefined && minCapacityTons !== null && maxCapacityTons !== null)
                ? (capacity >= Number(minCapacityTons) && capacity <= Number(maxCapacityTons))
                : true;

            const vImages = (p.vehicle_images && Array.isArray(p.vehicle_images))
                ? p.vehicle_images.filter(img => typeof img === 'string' && img.trim().length > 0)
                : [];

            const vName = p.vehicle_name || (capacity <= 7 ? 'Tata 407 Gold SFC' : capacity <= 12 ? 'Tata 1109 G LPT' : capacity <= 18 ? 'Tata 1512 LPT Cargo' : capacity <= 24 ? 'BharatBenz 1923C Heavy Hauler' : 'Tata Signa 2823.K HD');

            return {
                ...p,
                id: p.phone,
                driver_name: p.driver_name || p.name,
                vehicle_name: vName,
                vehicle_number: p.vehicle_number || 'TS 09 EA 4421',
                vehicle_type: p.vehicle_type || 'Standard Truck',
                vehicle_images: vImages,
                capacity: capacity,
                price_per_km: ratePerKm,
                distance: distance,
                estimated_cost: estimatedCost,
                is_capacity_sufficient: isCapacitySufficient,
                is_within_range: isWithinRange,
                rating: p.rating || 4.8,
                availability: p.availability || 'AVAILABLE',
                location_name: p.current_location_name || 'Agri Logistics Hub'
            };
        });

        if (vehicleType && vehicleType !== 'ALL' && vehicleType !== 'All Vehicles') {
            const lowerType = vehicleType.toLowerCase();
            mapped = mapped.filter(p => (p.vehicle_type || '').toLowerCase().includes(lowerType) || (p.vehicle_name || '').toLowerCase().includes(lowerType));
        }

        // If specific capacity range was selected, filter matching trucks; if none match exactly, show all sorted by nearest
        let result = mapped;
        if (minCapacityTons !== undefined && maxCapacityTons !== undefined && minCapacityTons !== null && maxCapacityTons !== null) {
            const inRangeList = mapped.filter(p => p.is_within_range);
            if (inRangeList.length > 0) {
                result = inRangeList;
            }
        }

        if (!result || result.length === 0) {
            result = mapped.length > 0 ? mapped : DEFAULT_PROVIDERS;
        }

        return result.sort((a, b) => {
            // Priority 1: User's custom added or modified truck
            if (a.is_custom && !b.is_custom) return -1;
            if (!a.is_custom && b.is_custom) return 1;

            // Priority 2: Within selected capacity range
            if (a.is_within_range !== b.is_within_range) {
                return a.is_within_range ? -1 : 1;
            }

            // Priority 3: Sufficient for total load
            if (a.is_capacity_sufficient !== b.is_capacity_sufficient) {
                return a.is_capacity_sufficient ? -1 : 1;
            }

            // Priority 4: Distance
            return a.distance - b.distance;
        });
    }

    // ==========================================
    // ENQUIRIES WORKFLOW (FARMER -> MILL -> TRANSPORT)
    // ==========================================
    async createEnquiry(enquiryData) {
        const enquiryCode = generateEnquiryId();
        const transportReq = Boolean(enquiryData.transport_required || enquiryData.with_transport);

        const fullEnquiry = {
            id: 'EQ-' + Date.now(),
            enquiry_code: enquiryCode,
            mill_id: enquiryData.mill_id ? String(enquiryData.mill_id) : null,
            mill_name: enquiryData.mill_name || '',
            buyer_phone: enquiryData.buyer_phone || '',
            buyer_name: enquiryData.buyer_name || enquiryData.mill_name || '',
            farmer_phone: enquiryData.farmer_phone,
            farmer_name: enquiryData.farmer_name || 'Farmer',
            crop_id: enquiryData.crop_id ? String(enquiryData.crop_id) : null,
            crop_name: enquiryData.crop_name || 'Paddy (Rice)',
            crop_image: enquiryData.crop_image || null,
            crop_added_at: enquiryData.crop_added_at || null,
            acres: Number(enquiryData.acres) || 0,
            quantity: Number(enquiryData.quantity) || Number(enquiryData.acres) * 2 || 10,
            expected_price: Number(enquiryData.expected_price || enquiryData.offered_price) || 2450,
            offered_price: Number(enquiryData.offered_price || enquiryData.expected_price) || 2450,
            total_price: Number(enquiryData.total_price) || (Number(enquiryData.expected_price || 2450) * Number(enquiryData.quantity || 10) * 10),
            
            // Transport details
            transport_required: transportReq,
            transport_provider_id: enquiryData.transport_provider_id || null,
            driver_name: enquiryData.driver_name || enquiryData.assigned_provider_name || null,
            driver_phone: enquiryData.driver_phone || enquiryData.assigned_provider_phone || null,
            vehicle_number: enquiryData.vehicle_number || null,
            vehicle_type: enquiryData.vehicle_type || 'Truck',
            vehicle_capacity: enquiryData.vehicle_capacity || '10 Ton',
            transport_date: enquiryData.transport_date || enquiryData.pickup_date || null,
            transport_distance: Number(enquiryData.transport_distance !== undefined && enquiryData.transport_distance !== null ? enquiryData.transport_distance : (enquiryData.distance || 0)),
            transport_rate_per_km: Number(enquiryData.transport_rate_per_km || 35),
            estimated_transport_cost: Number(enquiryData.estimated_transport_cost || 0),
            farmer_message: enquiryData.farmer_message || enquiryData.message || '',
            pickup_location: enquiryData.pickup_location || enquiryData.farmer_location_name || 'Farmer Farm Location',
            delivery_location: enquiryData.delivery_location || enquiryData.mill_location_name || enquiryData.mill_name || 'Mill Processing Gate',
            farmer_lat: enquiryData.farmer_lat || 17.0916,
            farmer_lng: enquiryData.farmer_lng || 80.0210,
            farmer_location_name: enquiryData.farmer_location_name || 'Farm Plot',
            mill_lat: enquiryData.mill_lat || 17.1033,
            mill_lng: enquiryData.mill_lng || 80.0536,
            mill_location_name: enquiryData.mill_location_name || enquiryData.mill_name || '',
            distance: Number(enquiryData.distance !== undefined && enquiryData.distance !== null && !isNaN(Number(enquiryData.distance)) ? enquiryData.distance : (enquiryData.transport_distance || 0)),

            // Dual Status Tracking: Initial state waiting for Mill review
            mill_status: 'PENDING',
            transport_status: transportReq ? 'AWAITING_MILL' : 'NOT_REQUIRED',
            overall_status: 'PENDING',
            status: 'PENDING',
            load_status: 'PENDING',
            created_at: new Date().toISOString()
        };

        // 1. Save to local storage for resilience
        const localEnquiries = getLocal(STORAGE_KEYS.ENQUIRIES, []);
        localEnquiries.unshift(fullEnquiry);
        setLocal(STORAGE_KEYS.ENQUIRIES, localEnquiries);

        // NOTE: Direct transport dispatch is deferred until the Mill accepts the enquiry!
        // The transport provider will be notified and assigned only upon Mill acceptance.

        // 2. Insert into Supabase enquiries table
        try {
            const dbPayload = {
                enquiry_code: enquiryCode,
                mill_id: fullEnquiry.mill_id,
                mill_name: fullEnquiry.mill_name,
                buyer_phone: fullEnquiry.buyer_phone,
                buyer_name: fullEnquiry.buyer_name,
                farmer_phone: fullEnquiry.farmer_phone,
                farmer_name: fullEnquiry.farmer_name,
                crop_name: fullEnquiry.crop_name,
                acres: fullEnquiry.acres,
                quantity: fullEnquiry.quantity,
                status: 'pending',
                expected_price: fullEnquiry.expected_price,
                offered_price: fullEnquiry.offered_price,
                total_price: fullEnquiry.total_price,
                crop_id: fullEnquiry.crop_id,
                transport_required: fullEnquiry.transport_required,
                vehicle_capacity: String(fullEnquiry.vehicle_capacity || ''),
                vehicle_type: fullEnquiry.vehicle_type,
                pickup_location: fullEnquiry.pickup_location,
                delivery_location: fullEnquiry.delivery_location,
                pickup_date: fullEnquiry.transport_date,
                message: fullEnquiry.farmer_message,
                farmer_lat: fullEnquiry.farmer_lat,
                farmer_lng: fullEnquiry.farmer_lng,
                farmer_location_name: fullEnquiry.farmer_location_name,
                mill_lat: fullEnquiry.mill_lat,
                mill_lng: fullEnquiry.mill_lng,
                mill_location_name: fullEnquiry.mill_location_name,
                distance: fullEnquiry.distance
            };

            const { data, error } = await supabase
                .from('enquiries')
                .insert([dbPayload])
                .select();

            if (!error && data && data[0]) {
                fullEnquiry.id = data[0].id;
                fullEnquiry.created_at = data[0].created_at;
            }
        } catch (e) {
            console.warn("Supabase enquiry sync notice:", e);
        }

        // 3. Notify Mill of the new incoming enquiry
        this.addNotification(
            fullEnquiry.buyer_phone,
            'buyers',
            'New Farmer Enquiry Received',
            `Farmer ${fullEnquiry.farmer_name} sent enquiry ${enquiryCode} for ${fullEnquiry.quantity} Tons of ${fullEnquiry.crop_name}.${transportReq ? ` (Transport requested with driver ${fullEnquiry.driver_name || 'selected transporter'})` : ''}`,
            'enquiry',
            { enquiryCode }
        );

        // 4. Notify Farmer of enquiry submission
        this.addNotification(
            fullEnquiry.farmer_phone,
            'farmers',
            'Enquiry Submitted to Mill',
            `Your enquiry ${enquiryCode} has been sent to ${fullEnquiry.mill_name || 'the mill'}.${transportReq ? ` Once the mill accepts, your transport request will automatically be sent to driver ${fullEnquiry.driver_name || 'selected driver'}.` : ''}`,
            'info',
            { enquiryCode }
        );

        this.notify('enquiry_created', fullEnquiry);
        return fullEnquiry;
    }

    async getEnquiries({ farmerPhone, millId, millIds, buyerPhone, providerPhone } = {}) {
        let list = [];
        try {
            let query = supabase.from('enquiries').select('*').order('created_at', { ascending: false });
            if (farmerPhone) {
                query = query.eq('farmer_phone', farmerPhone);
            } else if (millId) {
                query = query.eq('mill_id', String(millId));
            } else if (millIds && Array.isArray(millIds) && millIds.length > 0) {
                query = query.in('mill_id', millIds.map(String));
            } else if (buyerPhone) {
                query = query.eq('buyer_phone', buyerPhone);
            }

            const { data, error } = await query;
            if (!error && data) {
                list = data.map(item => {
                    const normStatus = (item.status || 'PENDING').toUpperCase();
                    const derivedMillStatus = item.mill_status 
                        ? item.mill_status.toUpperCase() 
                        : (normStatus === 'ACCEPTED' || normStatus === 'WAITING_TRANSPORT' || normStatus === 'LOAD_RECEIVED') 
                            ? 'ACCEPTED' 
                            : (normStatus === 'REJECTED' ? 'REJECTED' : 'PENDING');
                    return {
                        ...item,
                        enquiry_code: item.enquiry_code || ('ENQ-' + (item.id || '').replace(/-/g, '').slice(0, 8).toUpperCase()),
                        transport_required: item.transport_required ?? item.with_transport ?? false,
                        offered_price: item.price_per_quintal || item.offered_price || item.expected_price || 'Market Rate',
                        expected_price: item.price_per_quintal || item.expected_price || item.offered_price || 'Market Rate',
                        quantity: item.quantity || (item.acres ? item.acres * 2 : 10),
                        mill_status: derivedMillStatus,
                        status: normStatus
                    };
                });
            }
        } catch (e) {
            console.warn("Supabase fetch enquiries fallback:", e);
        }

        // Merge with local fallback to guarantee no lost state
        const localList = getLocal(STORAGE_KEYS.ENQUIRIES, []);
        const filteredLocal = localList.filter(eq => {
            if (farmerPhone && eq.farmer_phone !== farmerPhone) return false;
            if (millId && String(eq.mill_id) !== String(millId) && eq.buyer_phone !== buyerPhone) return false;
            if (millIds && Array.isArray(millIds) && millIds.length > 0 && !millIds.map(String).includes(String(eq.mill_id)) && eq.buyer_phone !== buyerPhone) return false;
            if (providerPhone && eq.transport_provider_id && eq.transport_provider_id !== providerPhone && eq.driver_phone !== providerPhone) return false;
            return true;
        });

        // Combine unique by enquiry_code first, then id
        const map = new Map();
        list.forEach(item => {
            const key = item.enquiry_code || item.id;
            if (key) map.set(key, item);
        });

        filteredLocal.forEach(item => {
            const key = item.enquiry_code || item.id;
            if (!key) return;
            if (!map.has(key)) {
                map.set(key, item);
            } else {
                const existing = map.get(key);
                const mergedMillStatus = item.mill_status || existing.mill_status || 
                    ((item.status === 'WAITING_TRANSPORT' || existing.status === 'WAITING_TRANSPORT') ? 'ACCEPTED' : undefined);
                map.set(key, {
                    ...existing,
                    ...item,
                    mill_status: mergedMillStatus,
                    overall_status: item.overall_status || existing.overall_status,
                    transport_status: item.transport_status || existing.transport_status,
                    status: (item.status && item.status !== 'PENDING') ? item.status : (existing.status || item.status || 'PENDING')
                });
            }
        });

        return Array.from(map.values()).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    // ==========================================
    // DELETE / CANCEL ENQUIRY
    // ==========================================
    async deleteEnquiry(enquiryIdOrCode) {
        if (!enquiryIdOrCode) return false;
        
        // 1. Remove from local storage
        const localList = getLocal(STORAGE_KEYS.ENQUIRIES, []);
        const targetEnquiry = localList.find(eq => eq.id === enquiryIdOrCode || eq.enquiry_code === enquiryIdOrCode);
        const updatedLocal = localList.filter(eq => eq.id !== enquiryIdOrCode && eq.enquiry_code !== enquiryIdOrCode);
        setLocal(STORAGE_KEYS.ENQUIRIES, updatedLocal);

        // Also clean up any associated transport requests
        const localReqs = getLocal(STORAGE_KEYS.TRANSPORT_REQUESTS, []);
        const updatedReqs = localReqs.filter(r => r.enquiry_id !== enquiryIdOrCode && r.enquiry_code !== enquiryIdOrCode && r.id !== enquiryIdOrCode);
        setLocal(STORAGE_KEYS.TRANSPORT_REQUESTS, updatedReqs);

        // 2. Remove from Supabase database if connected
        try {
            const isCode = String(enquiryIdOrCode).startsWith('KC-') || String(enquiryIdOrCode).startsWith('ENQ-');
            if (isCode) {
                await supabase.from('enquiries').delete().eq('enquiry_code', enquiryIdOrCode);
            } else {
                await supabase.from('enquiries').delete().eq('id', enquiryIdOrCode);
            }
        } catch (e) {
            console.warn("Supabase delete enquiry error:", e);
        }

        // 3. Notify Mill that enquiry was retracted/cancelled if target existed
        if (targetEnquiry && targetEnquiry.buyer_phone) {
            this.addNotification(
                targetEnquiry.buyer_phone,
                'buyers',
                'Enquiry Retracted by Farmer',
                `Farmer ${targetEnquiry.farmer_name || 'Farmer'} has cancelled enquiry ${targetEnquiry.enquiry_code || enquiryIdOrCode} for ${targetEnquiry.crop_name}.`,
                'info',
                { enquiryCode: targetEnquiry.enquiry_code }
            );
        }

        this.notify('enquiries_changed', { deletedId: enquiryIdOrCode });
        return true;
    }

    // ==========================================
    // DUAL ACCEPTANCE: MILL ACCEPT / REJECT
    // ==========================================
    async acceptEnquiry(enquiryIdOrCode, millUser, extraEnquiryData = null) {
        const acceptedAt = new Date().toISOString();
        const localList = getLocal(STORAGE_KEYS.ENQUIRIES, []);
        let updatedEnquiry = null;
        let found = false;

        const updatedLocal = localList.map(eq => {
            if (eq.id === enquiryIdOrCode || eq.enquiry_code === enquiryIdOrCode) {
                found = true;
                eq.mill_status = 'ACCEPTED';
                eq.accepted_at = acceptedAt;
                eq.accepted_by = millUser?.name || millUser?.phone || 'Mill Admin';

                // Check Dual Status
                const hasTransport = eq.transport_required || eq.with_transport;
                const transportAccepted = eq.transport_status === 'ACCEPTED';

                if (!hasTransport || transportAccepted) {
                    eq.overall_status = 'CONFIRMED';
                    eq.status = 'ACCEPTED';
                    eq.load_status = 'ACCEPTED';
                } else {
                    eq.overall_status = 'WAITING_TRANSPORT';
                    eq.status = 'WAITING_TRANSPORT';
                }
                updatedEnquiry = eq;
            }
            return eq;
        });

        if (!found) {
            const eq = extraEnquiryData ? { ...extraEnquiryData } : { id: enquiryIdOrCode, enquiry_code: enquiryIdOrCode };
            eq.mill_status = 'ACCEPTED';
            eq.accepted_at = acceptedAt;
            eq.accepted_by = millUser?.name || millUser?.phone || 'Mill Admin';
            const hasTransport = eq.transport_required || eq.with_transport;
            const transportAccepted = eq.transport_status === 'ACCEPTED';
            if (!hasTransport || transportAccepted) {
                eq.overall_status = 'CONFIRMED';
                eq.status = 'ACCEPTED';
                eq.load_status = 'ACCEPTED';
            } else {
                eq.overall_status = 'WAITING_TRANSPORT';
                eq.status = 'WAITING_TRANSPORT';
            }
            updatedLocal.push(eq);
            updatedEnquiry = eq;
        }

        setLocal(STORAGE_KEYS.ENQUIRIES, updatedLocal);

        const targetId = updatedEnquiry?.id || enquiryIdOrCode;
        const targetCode = updatedEnquiry?.enquiry_code || (String(enquiryIdOrCode).startsWith('KC-') || String(enquiryIdOrCode).startsWith('ENQ-') ? enquiryIdOrCode : null);

        try {
            const dbStatus = updatedEnquiry?.overall_status === 'CONFIRMED' ? 'accepted' : 'waiting_transport';
            if (targetCode) {
                await supabase
                    .from('enquiries')
                    .update({ status: dbStatus, updated_at: acceptedAt })
                    .eq('enquiry_code', targetCode);
            } else if (targetId) {
                await supabase
                    .from('enquiries')
                    .update({ status: dbStatus, updated_at: acceptedAt })
                    .eq('id', targetId);
            }
        } catch (e) {
            console.warn("Supabase update enquiry error:", e);
        }

        if (updatedEnquiry) {
            // Automatically remove the crop from the farmer's active "My Crops"
            await this.removeCropAfterAcceptance(updatedEnquiry);

            const hasTransport = updatedEnquiry.transport_required || updatedEnquiry.with_transport;

            // If overall confirmed (e.g. self transport or already accepted), generate QR token record immediately
            if (updatedEnquiry.overall_status === 'CONFIRMED') {
                this.createQrToken(updatedEnquiry.id, updatedEnquiry.enquiry_code || targetId);
                
                this.addNotification(
                    updatedEnquiry.farmer_phone,
                    'farmers',
                    'Enquiry Confirmed! 🎉',
                    `Your crop enquiry for ${updatedEnquiry.crop_name} (${updatedEnquiry.enquiry_code}) is confirmed! Your gate verification QR is ready.`,
                    'success',
                    { enquiryCode: updatedEnquiry.enquiry_code }
                );
            } else if (hasTransport) {
                // FLOW RULE: Automatically dispatch transport request to the farmer-selected driver now that Mill has accepted!
                const dispatchedReq = await this.createTransportRequestFromEnquiry(updatedEnquiry);
                const driverName = dispatchedReq?.assigned_provider_name || updatedEnquiry.driver_name || 'Assigned Driver';

                this.addNotification(
                    updatedEnquiry.farmer_phone,
                    'farmers',
                    'Mill Accepted! Transport Dispatched 🚛',
                    `Mill ${updatedEnquiry.mill_name || 'Buyer'} accepted enquiry ${updatedEnquiry.enquiry_code}. Transport request has been sent to driver ${driverName}. Awaiting driver confirmation.`,
                    'info',
                    { enquiryCode: updatedEnquiry.enquiry_code }
                );

                this.addNotification(
                    updatedEnquiry.buyer_phone,
                    'buyers',
                    'Enquiry Accepted • Transport Dispatched',
                    `You accepted enquiry ${updatedEnquiry.enquiry_code}. Transport request has been dispatched to ${driverName}. Awaiting driver acceptance.`,
                    'info',
                    { enquiryCode: updatedEnquiry.enquiry_code }
                );
            }
        }

        this.notify('enquiry_accepted', updatedEnquiry || { id: targetId, status: 'ACCEPTED' });
        return updatedEnquiry || { id: targetId, status: 'ACCEPTED' };
    }

    // ==========================================
    // REMOVE CROP ON ACCEPTANCE
    // ==========================================
    async removeCropAfterAcceptance(enquiry) {
        if (!enquiry) return;
        const cropId = enquiry.crop_id;
        const farmerPhone = enquiry.farmer_phone;
        const cropName = enquiry.crop_name;
        const locationName = enquiry.farmer_location_name || enquiry.pickup_location;

        try {
            if (cropId) {
                const { error } = await supabase.from('crops').delete().eq('id', cropId);
                if (error) console.warn("Supabase crop delete by id notice:", error);
            }
            if (farmerPhone && cropName) {
                let query = supabase.from('crops').delete().eq('user_phone', farmerPhone).eq('crop_name', cropName);
                if (locationName) {
                    query = query.eq('location_name', locationName);
                }
                const { error } = await query;
                if (error) console.warn("Supabase crop delete by name/phone notice:", error);
            }
        } catch (err) {
            console.warn("Error deleting crop from Supabase:", err);
        }

        this.notify('crop_removed', {
            cropId,
            farmerPhone,
            cropName,
            locationName
        });
        this.notify('crops_changed', {
            cropId,
            farmerPhone,
            cropName,
            locationName
        });
    }

    async removeCrop(cropId, farmerPhone, cropName) {
        return this.removeCropAfterAcceptance({ crop_id: cropId, farmer_phone: farmerPhone, crop_name: cropName });
    }

    async rejectEnquiry(enquiryIdOrCode, reason = '', extraEnquiryData = null) {
        const localList = getLocal(STORAGE_KEYS.ENQUIRIES, []);
        let updatedEnquiry = null;
        let found = false;

        const updatedLocal = localList.map(eq => {
            if (eq.id === enquiryIdOrCode || eq.enquiry_code === enquiryIdOrCode) {
                found = true;
                eq.mill_status = 'REJECTED';
                eq.overall_status = 'REJECTED';
                eq.status = 'REJECTED';
                eq.load_status = 'REJECTED';
                eq.reject_reason = reason;
                updatedEnquiry = eq;
            }
            return eq;
        });

        if (!found) {
            const eq = extraEnquiryData ? { ...extraEnquiryData } : { id: enquiryIdOrCode, enquiry_code: enquiryIdOrCode };
            eq.mill_status = 'REJECTED';
            eq.overall_status = 'REJECTED';
            eq.status = 'REJECTED';
            eq.load_status = 'REJECTED';
            eq.reject_reason = reason;
            updatedLocal.push(eq);
            updatedEnquiry = eq;
        }

        setLocal(STORAGE_KEYS.ENQUIRIES, updatedLocal);

        const targetId = updatedEnquiry?.id || enquiryIdOrCode;
        const targetCode = updatedEnquiry?.enquiry_code || (String(enquiryIdOrCode).startsWith('KC-') || String(enquiryIdOrCode).startsWith('ENQ-') ? enquiryIdOrCode : null);

        // Cancel any pending transport requests linked to this enquiry so driver is not dispatched
        const requests = getLocal(STORAGE_KEYS.TRANSPORT_REQUESTS, []);
        const updatedReqs = requests.map(r => {
            if (r.enquiry_id === targetId || r.enquiry_code === enquiryIdOrCode || (updatedEnquiry && (r.enquiry_id === updatedEnquiry.id || r.enquiry_code === updatedEnquiry.enquiry_code))) {
                r.status = 'CANCELLED';
                r.transport_status = 'CANCELLED';
            }
            return r;
        });
        setLocal(STORAGE_KEYS.TRANSPORT_REQUESTS, updatedReqs);

        try {
            if (targetCode) {
                await supabase
                    .from('enquiries')
                    .update({ status: 'rejected', updated_at: new Date().toISOString() })
                    .eq('enquiry_code', targetCode);
            } else if (targetId) {
                await supabase
                    .from('enquiries')
                    .update({ status: 'rejected', updated_at: new Date().toISOString() })
                    .eq('id', targetId);
            }
        } catch (e) {
            console.warn("Supabase reject enquiry error:", e);
        }

        if (updatedEnquiry) {
            this.addNotification(
                updatedEnquiry.farmer_phone,
                'farmers',
                'Crop Enquiry Declined by Mill',
                `Mill declined enquiry ${updatedEnquiry.enquiry_code || targetId}. You can propose to other nearby mills.`,
                'warning'
            );
        }

        this.notify('enquiry_rejected', updatedEnquiry || { id: targetId, status: 'REJECTED' });
        this.notify('transport_changed', updatedReqs);
        return updatedEnquiry || { id: targetId, status: 'REJECTED' };
    }

    // ==========================================
    // DUAL ACCEPTANCE: TRANSPORT ACCEPT / REJECT
    // ==========================================
    async acceptTransportLoad(enquiryIdOrCode, providerUser) {
        const acceptedAt = new Date().toISOString();
        const localList = getLocal(STORAGE_KEYS.ENQUIRIES, []);
        let updatedEnquiry = null;

        const updatedLocal = localList.map(eq => {
            if (eq.id === enquiryIdOrCode || eq.enquiry_code === enquiryIdOrCode) {
                eq.transport_status = 'ACCEPTED';
                eq.transport_accepted_at = acceptedAt;
                eq.transport_accepted_by = providerUser?.name || providerUser?.phone || eq.driver_name;

                // Check Dual Status
                const millAccepted = eq.mill_status === 'ACCEPTED';
                if (millAccepted) {
                    eq.overall_status = 'CONFIRMED';
                    eq.status = 'ACCEPTED';
                    eq.load_status = 'ACCEPTED';
                } else {
                    eq.overall_status = 'WAITING_MILL';
                }
                updatedEnquiry = eq;
            }
            return eq;
        });
        setLocal(STORAGE_KEYS.ENQUIRIES, updatedLocal);

        // Update transport requests table
        const requests = getLocal(STORAGE_KEYS.TRANSPORT_REQUESTS, []);
        const updatedReqs = requests.map(r => {
            if (r.enquiry_id === enquiryIdOrCode || r.enquiry_code === enquiryIdOrCode) {
                r.status = 'VEHICLE_ASSIGNED';
                r.transport_status = 'ACCEPTED';
                r.updated_at = acceptedAt;
                if (providerUser?.name) r.assigned_provider_name = providerUser.name;
                if (providerUser?.phone) r.assigned_provider_phone = providerUser.phone;
                if (providerUser?.vehicle_number) r.vehicle_number = providerUser.vehicle_number;
            }
            return r;
        });
        setLocal(STORAGE_KEYS.TRANSPORT_REQUESTS, updatedReqs);

        if (updatedEnquiry) {
            const targetId = updatedEnquiry.id || enquiryIdOrCode;

            if (updatedEnquiry.overall_status === 'CONFIRMED') {
                this.createQrToken(targetId, updatedEnquiry.enquiry_code || targetId);
                
                this.addNotification(
                    updatedEnquiry.farmer_phone,
                    'farmers',
                    'Crop & Transport Confirmed! 🎉',
                    `Driver ${providerUser?.name || updatedEnquiry.driver_name} accepted the load for ${updatedEnquiry.crop_name}. Both Mill and Transporter have confirmed! Your verification QR is ready.`,
                    'success',
                    { enquiryCode: updatedEnquiry.enquiry_code }
                );

                this.addNotification(
                    updatedEnquiry.buyer_phone,
                    'buyers',
                    'Transport Confirmed for Enquiry',
                    `Transporter ${providerUser?.name || updatedEnquiry.driver_name} has accepted logistics for Enquiry ${updatedEnquiry.enquiry_code}.`,
                    'info',
                    { enquiryCode: updatedEnquiry.enquiry_code }
                );
            } else {
                this.addNotification(
                    updatedEnquiry.farmer_phone,
                    'farmers',
                    'Transporter Accepted Load',
                    `Driver ${providerUser?.name || updatedEnquiry.driver_name} has accepted the transport request for ${updatedEnquiry.enquiry_code}. Waiting for Mill confirmation.`,
                    'info',
                    { enquiryCode: updatedEnquiry.enquiry_code }
                );
            }
        }

        this.notify('transport_load_accepted', updatedEnquiry);
        this.notify('transport_requests_changed', updatedReqs);
        this.notify('enquiries_changed', updatedLocal);
        return updatedEnquiry;
    }

    async rejectTransportLoad(enquiryIdOrCode, reason = '') {
        const localList = getLocal(STORAGE_KEYS.ENQUIRIES, []);
        let updatedEnquiry = null;

        const updatedLocal = localList.map(eq => {
            if (eq.id === enquiryIdOrCode || eq.enquiry_code === enquiryIdOrCode) {
                eq.transport_status = 'REJECTED';
                eq.overall_status = eq.mill_status === 'ACCEPTED' ? 'WAITING_TRANSPORT' : 'REJECTED';
                eq.transport_reject_reason = reason;
                updatedEnquiry = eq;
            }
            return eq;
        });
        setLocal(STORAGE_KEYS.ENQUIRIES, updatedLocal);

        // Update transport requests table
        const requests = getLocal(STORAGE_KEYS.TRANSPORT_REQUESTS, []);
        const updatedReqs = requests.map(r => {
            if (r.enquiry_id === enquiryIdOrCode || r.enquiry_code === enquiryIdOrCode) {
                r.status = 'REJECTED';
                r.transport_status = 'REJECTED';
                r.reject_reason = reason;
                r.updated_at = new Date().toISOString();
            }
            return r;
        });
        setLocal(STORAGE_KEYS.TRANSPORT_REQUESTS, updatedReqs);

        if (updatedEnquiry) {
            this.addNotification(
                updatedEnquiry.farmer_phone,
                'farmers',
                'Transporter Declined Request',
                `Selected transporter declined enquiry ${updatedEnquiry.enquiry_code}. You can choose another available driver.`,
                'warning'
            );
        }

        this.notify('transport_load_rejected', updatedEnquiry);
        this.notify('transport_requests_changed', updatedReqs);
        this.notify('enquiries_changed', updatedLocal);
        return updatedEnquiry;
    }

    // ==========================================
    // QR TOKENS & VERIFICATION
    // ==========================================
    async findEnquiryRecord(idOrCode) {
        if (!idOrCode) return null;
        const clean = String(idOrCode).trim();
        const hex = clean.replace(/^ENQ-/, '').replace(/-/g, '').toLowerCase();

        // 1. Try local cache
        const localList = getLocal(STORAGE_KEYS.ENQUIRIES, []);
        const local = localList.find(e => 
            e.id === clean || 
            e.enquiry_code === clean || 
            (e.id && e.id.replace(/-/g, '').toLowerCase().startsWith(hex)) ||
            (e.enquiry_code && e.enquiry_code.toLowerCase().includes(hex))
        );

        // 2. Try Supabase
        try {
            if (clean.includes('-') && clean.length === 36) {
                const { data } = await supabase.from('enquiries').select('*').eq('id', clean).maybeSingle();
                if (data) return { ...local, ...data };
            }
            const { data } = await supabase.from('enquiries').select('*').order('created_at', { ascending: false }).limit(60);
            if (data) {
                const matched = data.find(d => 
                    d.id === clean || 
                    d.id.replace(/-/g, '').toLowerCase().startsWith(hex)
                );
                if (matched) return { ...local, ...matched };
            }
        } catch (e) {
            console.warn("Error finding enquiry record:", e);
        }

        return local || null;
    }

    createQrToken(enquiryId, enquiryCode) {
        const token = `KC-SECURE-${enquiryCode}-${Date.now().toString(36).toUpperCase()}`;
        const tokens = getLocal('kisan_qr_tokens', []);
        const entry = {
            id: 'QRT-' + Date.now(),
            enquiry_id: enquiryId,
            enquiry_code: enquiryCode,
            token,
            created_at: new Date().toISOString(),
            is_active: true
        };
        tokens.push(entry);
        setLocal('kisan_qr_tokens', tokens);

        try {
            supabase.from('enquiry_qr_tokens').insert([entry]);
        } catch (e) {
            console.warn("QR token insert error:", e);
        }
        return token;
    }

    async verifyScannedQr(qrData, loggedInMill) {
        if (!qrData) {
            return { success: false, message: 'Invalid or empty QR code' };
        }

        const cleanCode = qrData.trim();
        const enquiry = await this.findEnquiryRecord(cleanCode);

        if (!enquiry) {
            return {
                success: false,
                errorCode: 'NOT_FOUND',
                message: `No active enquiry found matching code "${cleanCode}".`
            };
        }

        const scannedAt = new Date().toISOString();
        const localList = getLocal(STORAGE_KEYS.ENQUIRIES, []);
        const updatedLocal = localList.map(eq => {
            if (eq.id === enquiry.id || eq.enquiry_code === enquiry.enquiry_code) {
                eq.qr_scanned = true;
                eq.scanned_at = scannedAt;
                if ((eq.status || '').toUpperCase() === 'ACCEPTED') {
                    eq.status = 'QR_SCANNED';
                }
            }
            return eq;
        });
        setLocal(STORAGE_KEYS.ENQUIRIES, updatedLocal);

        // Match against logged in mill: check mill_id, owner_phone, buyer_phone
        const millIdMatches = !loggedInMill || !loggedInMill.id || (
            String(enquiry.mill_id) === String(loggedInMill.id) ||
            enquiry.buyer_phone === loggedInMill.ownerPhone ||
            enquiry.buyer_phone === loggedInMill.phone ||
            enquiry.mill_name?.toLowerCase() === loggedInMill.millName?.toLowerCase()
        );

        const statusUpper = (enquiry.status || '').toUpperCase();
        const isAccepted = statusUpper === 'ACCEPTED' || statusUpper === 'QR_SCANNED' || statusUpper === 'LOAD_RECEIVED';

        this.notify('enquiry_updated', { ...enquiry, qr_scanned: true, scanned_at: scannedAt });

        return {
            success: true,
            isMatch: Boolean(millIdMatches),
            isAccepted,
            isAlreadyReceived: enquiry.load_status === 'LOAD_RECEIVED' || statusUpper === 'LOAD_RECEIVED',
            enquiry,
            scannedCode: cleanCode
        };
    }

    // ==========================================
    // ==========================================
    // LOAD RECEIVING & PAYMENTS WORKFLOW
    // ==========================================
    getFarmerBankDetails(farmerPhone) {
        if (!farmerPhone) {
            return {
                accountHolder: 'Ramesh Reddy',
                bankName: 'State Bank of India',
                accountNumber: '308912445892',
                ifscCode: 'SBIN0004521',
                upiId: '9876543210@upi'
            };
        }
        try {
            const saved = localStorage.getItem(`kisan_farmer_ext_${farmerPhone}`);
            if (saved) {
                const parsed = JSON.parse(saved);
                return {
                    accountHolder: parsed.accountHolder || parsed.name || 'Ramesh Reddy',
                    bankName: parsed.bankName || 'State Bank of India',
                    accountNumber: parsed.accountNumber && !parsed.accountNumber.includes('XXXX') ? parsed.accountNumber : '308912445892',
                    ifscCode: parsed.ifscCode || 'SBIN0004521',
                    branchName: parsed.branchName || 'Suryapet Main Branch',
                    upiId: parsed.upiId || `${farmerPhone}@upi`,
                    ocrExtracted: !!parsed.ocrExtracted,
                    detailsConfirmed: !!parsed.detailsConfirmed,
                    ownershipVerified: !!parsed.ownershipVerified,
                    verifiedAt: parsed.verifiedAt || null,
                    ocrConfidence: parsed.ocrConfidence || null
                };
            }
        } catch {}

        return {
            accountHolder: 'Ramesh Reddy',
            bankName: 'State Bank of India',
            accountNumber: '308912445892',
            ifscCode: 'SBIN0004521',
            branchName: 'Suryapet Main Branch',
            upiId: `${farmerPhone}@upi`,
            ocrExtracted: false,
            detailsConfirmed: false,
            ownershipVerified: false,
            verifiedAt: null,
            ocrConfidence: null
        };
    }

    saveFarmerBankDetails(farmerPhone, bankDetails) {
        if (!farmerPhone) return;
        const key = `kisan_farmer_ext_${farmerPhone}`;
        let current = {};
        try {
            current = JSON.parse(localStorage.getItem(key) || '{}');
        } catch {}
        const merged = { ...current, ...bankDetails };
        localStorage.setItem(key, JSON.stringify(merged));

        // Sync with Supabase farmer_bank_accounts if possible (optional table)
        try {
            supabase.from('farmer_bank_accounts').upsert([{
                farmer_phone: farmerPhone,
                account_holder: merged.accountHolder,
                bank_name: merged.bankName,
                account_number: merged.accountNumber,
                ifsc_code: merged.ifscCode,
                branch_name: merged.branchName,
                upi_id: merged.upiId,
                ocr_extracted: merged.ocrExtracted || false,
                details_confirmed: merged.detailsConfirmed || false,
                updated_at: new Date().toISOString()
            }], { onConflict: 'farmer_phone' }).then(() => {}).catch(() => {});
        } catch {}

        this.notify('bank_details_updated', { farmerPhone, bankDetails: merged });
        return merged;
    }

    // AI-Based Bank Passbook Detail Extraction (PaddleOCR Backend)
    async extractPassbookDetails(file) {
        if (!file) {
            throw new Error('No passbook image file provided.');
        }

        const formData = new FormData();
        formData.append('passbook', file);

        try {
            const response = await fetch('/api/ocr/passbook', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.detail || `OCR processing failed with status ${response.status}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('OCR Extraction API call failed:', error);
            throw error;
        }
    }

    // Demo / Sandbox Payment Flow (Simulated Instant DBT / UPI Transfer)
    createSandboxPayout({ farmerPhone, amount = 25000, paymentMethod = 'Direct Bank Transfer (NEFT/RTGS)', bankDetails = {}, loadId = null, enquiryCode = null }) {
        const isUpi = paymentMethod.toLowerCase().includes('upi');
        const prefix = isUpi ? 'UPI-DEMO' : 'DBT-DEMO';
        const txnId = `${prefix}-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
        const timestamp = new Date().toISOString();

        const sandboxReceipt = {
            id: 'SB-' + Date.now(),
            transactionId: txnId,
            farmerPhone,
            farmerName: bankDetails.accountHolder || 'Farmer',
            bankName: bankDetails.bankName || 'State Bank of India',
            accountNumberMasked: bankDetails.accountNumber ? `••••••••${bankDetails.accountNumber.slice(-4)}` : '••••••••4589',
            ifscCode: bankDetails.ifscCode || 'SBIN0004521',
            upiId: bankDetails.upiId || `${farmerPhone}@upi`,
            amount: Number(amount),
            paymentMethod,
            status: 'SUCCESS',
            isSandbox: true,
            environment: 'DEMO / SANDBOX',
            timestamp,
            loadId: loadId || 'LOAD-DEMO-01',
            enquiryCode: enquiryCode || 'ENQ-DEMO-01',
            settlementNote: 'Simulated Sandbox payout demonstration. No real money was debited or credited.'
        };

        // Persist in local storage
        const key = `kisan_sandbox_payouts_${farmerPhone || 'all'}`;
        let existing = [];
        try {
            existing = JSON.parse(localStorage.getItem(key) || '[]');
        } catch {}
        existing.unshift(sandboxReceipt);
        localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));

        // Send local notification
        this.addNotification(
            farmerPhone,
            'farmers',
            '💳 Demo DBT Payout Successful! (Sandbox)',
            `[Demo Mode] Simulated transfer of ₹${Number(amount).toLocaleString('en-IN')} via ${paymentMethod} to account ${sandboxReceipt.accountNumberMasked} (${sandboxReceipt.bankName}). Txn ID: ${txnId}`,
            'success',
            { transactionId: txnId, isSandbox: true }
        );

        this.notify('sandbox_payout_completed', sandboxReceipt);
        return sandboxReceipt;
    }

    getSandboxPayouts(farmerPhone) {
        const key = `kisan_sandbox_payouts_${farmerPhone || 'all'}`;
        try {
            return JSON.parse(localStorage.getItem(key) || '[]');
        } catch {
            return [];
        }
    }

    async acceptLoad(enquiryCode, loggedInMill = {}, actualTonnesParam = null, notes = '') {
        const receivedAt = new Date().toISOString();
        const record = await this.findEnquiryRecord(enquiryCode);
        const targetId = record?.id || enquiryCode;

        // 1. Update in local storage
        const localEnquiries = getLocal(STORAGE_KEYS.ENQUIRIES, []);
        let targetEnquiry = null;

        const updatedEnquiries = localEnquiries.map(eq => {
            if (eq.id === targetId || eq.enquiry_code === enquiryCode || eq.id === enquiryCode) {
                eq.load_status = 'LOAD_RECEIVED';
                eq.status = 'LOAD_RECEIVED';
                eq.qr_scanned = true;
                eq.received_at = receivedAt;
                eq.received_by = loggedInMill.millName || loggedInMill.name || loggedInMill.phone || 'Mill Gate';
                if (actualTonnesParam) {
                    eq.actual_received_tonnes = Number(actualTonnesParam);
                    eq.actual_received_quintals = Math.round(Number(actualTonnesParam) * 10 * 10) / 10;
                }
                targetEnquiry = eq;
            }
            return eq;
        });
        if (!targetEnquiry && record) {
            targetEnquiry = { ...record, status: 'LOAD_RECEIVED', load_status: 'LOAD_RECEIVED', qr_scanned: true, received_at: receivedAt };
            if (actualTonnesParam) {
                targetEnquiry.actual_received_tonnes = Number(actualTonnesParam);
                targetEnquiry.actual_received_quintals = Math.round(Number(actualTonnesParam) * 10 * 10) / 10;
            }
            updatedEnquiries.unshift(targetEnquiry);
        }
        setLocal(STORAGE_KEYS.ENQUIRIES, updatedEnquiries);

        // 2. Update Supabase enquiries table using only real columns
        try {
            if (record?.id && record.id.length === 36) {
                await supabase
                    .from('enquiries')
                    .update({
                        status: 'LOAD_RECEIVED',
                        updated_at: receivedAt
                    })
                    .eq('id', record.id);
            }
        } catch (e) {
            console.warn("Supabase accept load error:", e);
        }

        // 3. Compute Tonnes -> Quintals -> Total Amount automatically
        const actualTonnes = Number(actualTonnesParam || targetEnquiry?.quantity || (targetEnquiry?.acres ? targetEnquiry.acres * 2 : 10));
        const actualQuintals = Math.round(actualTonnes * 10 * 10) / 10; // 1 Tonne = 10 Quintals
        const pricePerQuintal = Number(targetEnquiry?.offered_price || targetEnquiry?.expected_price || 2450);
        const totalAmount = Math.round(actualQuintals * pricePerQuintal);
        const farmerPhone = targetEnquiry?.farmer_phone || targetEnquiry?.farmer_id || '';
        const bankDetails = this.getFarmerBankDetails(farmerPhone);

        // 4. Record in loads table with PENDING payment status
        const loadRecord = {
            id: 'LOAD-' + Date.now(),
            enquiry_id: record?.id || enquiryCode,
            enquiry_code: record?.enquiry_code || enquiryCode,
            farmer_id: farmerPhone,
            farmer_name: targetEnquiry?.farmer_name || 'Farmer',
            farmer_phone: farmerPhone,
            mill_id: String(loggedInMill.id || targetEnquiry?.mill_id || ''),
            mill_name: loggedInMill.millName || targetEnquiry?.mill_name || 'Processing Mill',
            buyer_phone: loggedInMill.phone || loggedInMill.ownerPhone || targetEnquiry?.buyer_phone || '',
            crop_id: targetEnquiry?.crop_id || null,
            crop_name: targetEnquiry?.crop_name || 'Paddy (Rice)',
            quantity: actualTonnes,
            quantity_tonnes: actualTonnes,
            quantity_quintals: actualQuintals,
            price_per_quintal: pricePerQuintal,
            price: totalAmount,
            total_amount: totalAmount,
            acres: targetEnquiry?.acres || 5,
            transport_method: targetEnquiry?.transport_required || targetEnquiry?.with_transport ? 'KisanConnect Logistics' : 'Self Arranged',
            status: 'RECEIVED',
            payment_status: 'PENDING', // 'PENDING' | 'COMPLETED'
            received_at: receivedAt,
            paid_at: null,
            payment_method: null,
            transaction_reference: null,
            farmer_bank_details: bankDetails,
            notes: notes || '',
            received_by: loggedInMill.millName || loggedInMill.name || loggedInMill.phone || 'Mill Gate'
        };

        const loads = getLocal(STORAGE_KEYS.LOADS, []);
        // Avoid duplicate active loads for the same enquiry
        const filteredLoads = loads.filter(l => l.enquiry_code !== loadRecord.enquiry_code);
        filteredLoads.unshift(loadRecord);
        setLocal(STORAGE_KEYS.LOADS, filteredLoads);

        // 5. Update transport request to DELIVERED if applicable
        const requests = getLocal(STORAGE_KEYS.TRANSPORT_REQUESTS, []);
        const updatedReqs = requests.map(r => {
            if (r.enquiry_id === targetId || r.enquiry_code === enquiryCode) {
                r.status = 'DELIVERED';
                r.delivered_at = receivedAt;
            }
            return r;
        });
        setLocal(STORAGE_KEYS.TRANSPORT_REQUESTS, updatedReqs);

        // 6. Notify farmer
        if (targetEnquiry) {
            this.addNotification(
                farmerPhone,
                'farmers',
                'Crop Load Received at Mill! 🚚⚖️',
                `Mill ${loadRecord.mill_name} weighed and received ${actualTonnes} Tonnes (${actualQuintals} Qtl) of ${targetEnquiry.crop_name}. Total calculated payment: ₹${totalAmount.toLocaleString('en-IN')}. Payment is pending.`,
                'info',
                { enquiryCode: targetEnquiry.enquiry_code || enquiryCode, loadId: loadRecord.id }
            );
        }

        this.notify('load_received', loadRecord);
        this.notify('payments_changed', loadRecord);
        this.notify('enquiry_updated', targetEnquiry);
        this.notify('enquiries_changed', updatedEnquiries);
        this.notify('transport_requests_changed', updatedReqs);
        return loadRecord;
    }

    async recordLoadReceived(enquiryCode, actualTonnes, loggedInMill = {}, notes = '') {
        return this.acceptLoad(enquiryCode, loggedInMill, actualTonnes, notes);
    }

    async completePayment(loadIdOrCode, { paymentMethod = 'Bank Transfer (NEFT/RTGS)', referenceNumber = '', remarks = '' } = {}, millUser = {}) {
        const paidAt = new Date().toISOString();
        const refNo = referenceNumber || ('UTR-' + Math.floor(10000000 + Math.random() * 90000000));
        const loads = getLocal(STORAGE_KEYS.LOADS, []);
        let updatedLoad = null;

        const updatedLoads = loads.map(ld => {
            if (ld.id === loadIdOrCode || ld.enquiry_code === loadIdOrCode || String(ld.enquiry_id) === String(loadIdOrCode)) {
                ld.payment_status = 'COMPLETED';
                ld.paid_at = paidAt;
                ld.payment_method = paymentMethod;
                ld.transaction_reference = refNo;
                ld.payment_remarks = remarks;
                ld.paid_by = millUser.name || millUser.millName || millUser.phone || 'Mill Finance';
                updatedLoad = { ...ld };
            }
            return ld;
        });

        // If load was not found in local storage, check enquiries to create the load record
        if (!updatedLoad) {
            const enquiries = getLocal(STORAGE_KEYS.ENQUIRIES, []);
            const eq = enquiries.find(e => e.id === loadIdOrCode || e.enquiry_code === loadIdOrCode);
            if (eq) {
                const tonnes = Number(eq.actual_received_tonnes || eq.quantity || 10);
                const quintals = Number(eq.actual_received_quintals || Math.round(tonnes * 10 * 10) / 10);
                const rate = Number(eq.offered_price || eq.expected_price || 2450);
                const total = Math.round(quintals * rate);
                updatedLoad = {
                    id: 'LOAD-' + Date.now(),
                    enquiry_id: eq.id,
                    enquiry_code: eq.enquiry_code || loadIdOrCode,
                    farmer_id: eq.farmer_phone,
                    farmer_name: eq.farmer_name,
                    farmer_phone: eq.farmer_phone,
                    mill_id: String(eq.mill_id || millUser.id || ''),
                    mill_name: eq.mill_name || millUser.millName || 'Processing Mill',
                    buyer_phone: eq.buyer_phone || millUser.phone || '',
                    crop_id: eq.crop_id,
                    crop_name: eq.crop_name,
                    quantity: tonnes,
                    quantity_tonnes: tonnes,
                    quantity_quintals: quintals,
                    price_per_quintal: rate,
                    price: total,
                    total_amount: total,
                    acres: eq.acres || 5,
                    transport_method: eq.transport_required ? 'KisanConnect Logistics' : 'Self Arranged',
                    status: 'RECEIVED',
                    payment_status: 'COMPLETED',
                    received_at: eq.received_at || paidAt,
                    paid_at: paidAt,
                    payment_method: paymentMethod,
                    transaction_reference: refNo,
                    payment_remarks: remarks,
                    paid_by: millUser.name || millUser.millName || millUser.phone || 'Mill Finance',
                    farmer_bank_details: this.getFarmerBankDetails(eq.farmer_phone)
                };
                updatedLoads.unshift(updatedLoad);
            }
        }

        setLocal(STORAGE_KEYS.LOADS, updatedLoads);

        // Also update the enquiry record in localStorage
        const enquiries = getLocal(STORAGE_KEYS.ENQUIRIES, []);
        const updatedEnqs = enquiries.map(eq => {
            if (eq.id === loadIdOrCode || eq.enquiry_code === loadIdOrCode || (updatedLoad && (eq.id === updatedLoad.enquiry_id || eq.enquiry_code === updatedLoad.enquiry_code))) {
                eq.payment_status = 'COMPLETED';
                eq.paid_at = paidAt;
                eq.payment_method = paymentMethod;
                eq.transaction_reference = refNo;
                eq.payment_remarks = remarks;
                eq.paid_amount = updatedLoad?.total_amount || eq.total_price;
            }
            return eq;
        });
        setLocal(STORAGE_KEYS.ENQUIRIES, updatedEnqs);

        // Sync directly to Supabase so Farmer Portal reflects Payment Completed in real time
        try {
            if (supabase) {
                const targetCode = updatedLoad?.enquiry_code || loadIdOrCode;
                supabase
                    .from('enquiries')
                    .update({
                        payment_status: 'COMPLETED',
                        paid_at: paidAt,
                        payment_method: paymentMethod,
                        transaction_reference: refNo,
                        payment_remarks: remarks
                    })
                    .or(`id.eq.${targetCode},enquiry_code.eq.${targetCode}`)
                    .then(({ error }) => {
                        if (error) console.warn('[kisanService] Supabase enquiry update notice:', error.message);
                    });
            }
        } catch (e) {
            console.warn('[kisanService] Supabase sync catch:', e);
        }

        // Notify farmer
        if (updatedLoad) {
            const farmerTargetPhone = updatedLoad.farmer_phone || updatedLoad.farmer_id;
            if (farmerTargetPhone) {
                this.addNotification(
                    farmerTargetPhone,
                    'farmers',
                    'Payment Completed! 💰🎉',
                    `Payment of ₹${updatedLoad.total_amount?.toLocaleString('en-IN')} has been completed by ${updatedLoad.mill_name} for ${updatedLoad.quantity_tonnes} Tonnes (${updatedLoad.quantity_quintals} Qtl) of ${updatedLoad.crop_name}. Ref: ${updatedLoad.transaction_reference}`,
                    'success',
                    { enquiryCode: updatedLoad.enquiry_code, loadId: updatedLoad.id }
                );
            }

            this.notify('payment_completed', updatedLoad);
            this.notify('payments_changed', updatedLoad);
            this.notify('load_updated', updatedLoad);
            this.notify('loads_changed', updatedLoads);
            this.notify('enquiries_changed', updatedEnqs);

            // Cross-tab broadcast via storage event
            try {
                localStorage.setItem('kisan_last_payment_event', JSON.stringify({
                    timestamp: Date.now(),
                    enquiryCode: updatedLoad.enquiry_code,
                    farmerPhone: updatedLoad.farmer_phone || updatedLoad.farmer_id,
                    amount: updatedLoad.total_amount,
                    ref: refNo
                }));
            } catch {}
        }

        return updatedLoad;
    }

    async getLoadsReceived({ millId, farmerPhone, buyerPhone } = {}) {
        let loads = [];
        const cleanPhone = p => String(p || '').replace(/\D/g, '').slice(-10);
        const targetFarmer = cleanPhone(farmerPhone);

        try {
            let query = supabase.from('loads').select('*').order('received_at', { ascending: false });
            if (millId) query = query.eq('mill_id', String(millId));
            if (farmerPhone) query = query.eq('farmer_id', farmerPhone);
            if (buyerPhone) query = query.eq('buyer_phone', buyerPhone);
            const { data, error } = await query;
            if (!error && data && data.length > 0) loads = data;
        } catch (e) {
            console.warn("Loads fetch fallback:", e);
        }

        const localLoads = getLocal(STORAGE_KEYS.LOADS, []);
        const filteredLocal = localLoads.filter(ld => {
            if (targetFarmer) {
                const ldFarmerId = cleanPhone(ld.farmer_id);
                const ldFarmerPhone = cleanPhone(ld.farmer_phone);
                if (ldFarmerId !== targetFarmer && ldFarmerPhone !== targetFarmer) return false;
            }
            if (millId && String(ld.mill_id) !== String(millId) && ld.buyer_phone !== buyerPhone) return false;
            return true;
        });

        const map = new Map();
        loads.forEach(l => map.set(l.enquiry_code || l.id, l));
        filteredLocal.forEach(l => {
            const key = l.enquiry_code || l.id;
            if (!map.has(key)) map.set(key, l);
            else map.set(key, { ...map.get(key), ...l });
        });

        // Also check if any enquiries for this farmer or mill have reached LOAD_RECEIVED or COMPLETED
        const localEnquiries = getLocal(STORAGE_KEYS.ENQUIRIES, []);
        localEnquiries.forEach(eq => {
            const eqStatus = (eq.status || '').toUpperCase();
            const eqLoadStatus = (eq.load_status || '').toUpperCase();
            const eqPaymentStatus = (eq.payment_status || '').toUpperCase();

            if (eqStatus === 'LOAD_RECEIVED' || eqLoadStatus === 'LOAD_RECEIVED' || eqPaymentStatus === 'COMPLETED') {
                const key = eq.enquiry_code || eq.id;
                if (targetFarmer) {
                    const eqFarmer = cleanPhone(eq.farmer_phone);
                    if (eqFarmer !== targetFarmer) return;
                }
                if (millId && String(eq.mill_id) !== String(millId) && eq.buyer_phone !== buyerPhone) return;

                const tonnes = Number(eq.actual_received_tonnes || eq.quantity || (eq.acres ? eq.acres * 2 : 10));
                const quintals = Number(eq.actual_received_quintals || Math.round(tonnes * 10 * 10) / 10);
                const rate = Number(eq.offered_price || eq.expected_price || 2450);
                const total = Number(eq.paid_amount || Math.round(quintals * rate));

                if (!map.has(key)) {
                    map.set(key, {
                        id: 'LOAD-' + (eq.id || key),
                        enquiry_id: eq.id,
                        enquiry_code: eq.enquiry_code || key,
                        farmer_id: eq.farmer_phone,
                        farmer_name: eq.farmer_name || 'Farmer',
                        farmer_phone: eq.farmer_phone,
                        mill_id: String(eq.mill_id || ''),
                        mill_name: eq.mill_name || 'Processing Mill',
                        buyer_phone: eq.buyer_phone || '',
                        crop_id: eq.crop_id,
                        crop_name: eq.crop_name || 'Paddy (Rice)',
                        quantity: tonnes,
                        quantity_tonnes: tonnes,
                        quantity_quintals: quintals,
                        price_per_quintal: rate,
                        price: total,
                        total_amount: total,
                        acres: eq.acres || 5,
                        transport_method: eq.transport_required ? 'KisanConnect Logistics' : 'Self Arranged',
                        status: 'RECEIVED',
                        payment_status: eqPaymentStatus === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
                        received_at: eq.received_at || eq.created_at || new Date().toISOString(),
                        paid_at: eq.paid_at || (eqPaymentStatus === 'COMPLETED' ? new Date().toISOString() : null),
                        payment_method: eq.payment_method || 'Bank Transfer (NEFT/RTGS)',
                        transaction_reference: eq.transaction_reference || (eqPaymentStatus === 'COMPLETED' ? 'UTR-' + Math.floor(10000000 + Math.random() * 90000000) : null),
                        received_by: eq.received_by || 'Mill Gate'
                    });
                } else if (eqPaymentStatus === 'COMPLETED') {
                    // Guarantee payment status is reflected on existing load record if completed
                    const existingLoad = map.get(key);
                    existingLoad.payment_status = 'COMPLETED';
                    existingLoad.paid_at = eq.paid_at || existingLoad.paid_at || new Date().toISOString();
                    existingLoad.payment_method = eq.payment_method || existingLoad.payment_method || 'Bank Transfer (NEFT/RTGS)';
                    existingLoad.transaction_reference = eq.transaction_reference || existingLoad.transaction_reference;
                    map.set(key, existingLoad);
                }
            }
        });

        return Array.from(map.values()).map(l => {
            const tonnes = Number(l.quantity_tonnes || l.quantity || 10);
            const quintals = Number(l.quantity_quintals || Math.round(tonnes * 10 * 10) / 10);
            const rate = Number(l.price_per_quintal || 2450);
            const total = Number(l.total_amount || l.price || Math.round(quintals * rate));
            return {
                ...l,
                quantity: tonnes,
                quantity_tonnes: tonnes,
                quantity_quintals: quintals,
                price_per_quintal: rate,
                total_amount: total,
                payment_status: (l.payment_status || 'PENDING').toUpperCase()
            };
        }).sort((a, b) => new Date(b.paid_at || b.received_at || 0) - new Date(a.paid_at || a.received_at || 0));
    }

    async getLoadsAndPayments({ millId, buyerPhone, farmerPhone, status } = {}) {
        const loads = await this.getLoadsReceived({ millId, buyerPhone, farmerPhone });
        if (status && status !== 'ALL') {
            return loads.filter(l => (l.payment_status || 'PENDING').toUpperCase() === status.toUpperCase());
        }
        return loads;
    }

    // ==========================================
    // TRANSPORT WORKFLOW & SMART MATCHING
    // ==========================================
    async createTransportRequestFromEnquiry(enquiry) {
        const transportCode = generateTransportId();
        const quantityTons = Number(enquiry.quantity) || (Number(enquiry.acres) * 2) || 10;
        
        // 1. Get available transport providers
        const allProviders = getLocal(STORAGE_KEYS.TRANSPORT_PROVIDERS, DEFAULT_PROVIDERS);
        const availableProviders = allProviders.filter(p => (p.availability || 'AVAILABLE') === 'AVAILABLE');
        
        // 2. Prioritize the farmer's selected driver if provided
        let assignedDriver = null;
        const selectedPhone = enquiry.driver_phone || enquiry.transport_provider_id;
        if (selectedPhone) {
            const matched = allProviders.find(p => p.phone === selectedPhone);
            if (matched) {
                assignedDriver = { ...matched };
            } else {
                assignedDriver = {
                    name: enquiry.driver_name || 'Assigned Driver',
                    phone: selectedPhone,
                    vehicle_number: enquiry.vehicle_number || 'TS 09 EA 4421',
                    vehicle_type: enquiry.vehicle_type || 'Truck',
                    capacity: Number(enquiry.vehicle_capacity) || quantityTons,
                    price_per_km: Number(enquiry.transport_rate_per_km) || 35
                };
            }
        }

        // If no driver pre-selected, smart match based on load capacity
        if (!assignedDriver) {
            let candidateDrivers = availableProviders.filter(p => p.capacity >= quantityTons);
            if (candidateDrivers.length === 0) {
                candidateDrivers = availableProviders.length > 0 ? availableProviders : allProviders;
            }
            assignedDriver = candidateDrivers[Math.floor(Math.random() * candidateDrivers.length)] || allProviders[0];
        }

        // 3. Calculate route distance and agreed haulage price
        const dist = (enquiry.distance !== undefined && enquiry.distance !== null && !isNaN(Number(enquiry.distance)))
            ? Number(enquiry.distance)
            : calculateDistance(
                enquiry.farmer_lat || 17.0916, 
                enquiry.farmer_lng || 80.0210, 
                enquiry.mill_lat || 17.1033, 
                enquiry.mill_lng || 80.0536
            );
        const agreedPrice = Number(enquiry.estimated_transport_cost) || Math.round(dist * (assignedDriver.price_per_km || 35));

        const req = {
            id: 'TR-' + Date.now(),
            transport_code: transportCode,
            enquiry_id: enquiry.id,
            enquiry_code: enquiry.enquiry_code || ('ENQ-' + (enquiry.id || '').replace(/-/g, '').slice(0, 8).toUpperCase()),
            farmer_id: enquiry.farmer_phone,
            farmer_name: enquiry.farmer_name,
            farmer_phone: enquiry.farmer_phone,
            mill_id: enquiry.mill_id,
            mill_name: enquiry.mill_name,
            mill_status: 'ACCEPTED',
            buyer_phone: enquiry.buyer_phone,
            crop_name: enquiry.crop_name,
            quantity: quantityTons,
            acres: enquiry.acres || Math.round(quantityTons / 2) || 5,
            pickup_lat: enquiry.farmer_lat || 17.0916,
            pickup_lng: enquiry.farmer_lng || 80.0210,
            pickup_address: enquiry.farmer_location_name || enquiry.pickup_location || 'Farmer Farm Location',
            delivery_lat: enquiry.mill_lat || 17.1033,
            delivery_lng: enquiry.mill_lng || 80.0536,
            delivery_address: enquiry.mill_location_name || enquiry.delivery_location || 'Processing Mill',
            required_capacity: quantityTons,
            vehicle_type: enquiry.vehicle_type || assignedDriver.vehicle_type || 'Truck',
            vehicle_number: enquiry.vehicle_number || assignedDriver.vehicle_number,
            pickup_date: enquiry.transport_date || enquiry.pickup_date || new Date().toISOString().split('T')[0],
            distance: dist,
            assigned_provider_id: assignedDriver.phone,
            assigned_provider_name: assignedDriver.driver_name || assignedDriver.name,
            assigned_provider_phone: assignedDriver.phone,
            final_price: agreedPrice,
            status: 'ASSIGNED',
            transport_status: 'PENDING',
            created_at: new Date().toISOString()
        };

        const requests = getLocal(STORAGE_KEYS.TRANSPORT_REQUESTS, []);
        const existingIdx = requests.findIndex(r => r.enquiry_id === enquiry.id || (enquiry.enquiry_code && r.enquiry_code === enquiry.enquiry_code));
        if (existingIdx >= 0) {
            requests[existingIdx] = { ...requests[existingIdx], ...req };
        } else {
            requests.unshift(req);
        }
        setLocal(STORAGE_KEYS.TRANSPORT_REQUESTS, requests);

        // Update the enquiry's transport status in local storage to PENDING (awaiting driver acceptance)
        const allEnquiries = getLocal(STORAGE_KEYS.ENQUIRIES, []);
        const updatedEnquiries = allEnquiries.map(e => {
            if (e.id === enquiry.id || e.enquiry_code === enquiry.enquiry_code) {
                return {
                    ...e,
                    transport_status: 'PENDING',
                    status: e.overall_status === 'CONFIRMED' ? 'ACCEPTED' : 'WAITING_TRANSPORT',
                    overall_status: e.overall_status === 'CONFIRMED' ? 'CONFIRMED' : 'WAITING_TRANSPORT',
                    driver_name: assignedDriver.driver_name || assignedDriver.name,
                    driver_phone: assignedDriver.phone,
                    vehicle_number: req.vehicle_number
                };
            }
            return e;
        });
        setLocal(STORAGE_KEYS.ENQUIRIES, updatedEnquiries);

        try {
            await supabase.from('transport_requests').insert([req]);
        } catch (e) {
            console.warn("Supabase transport request insert error:", e);
        }

        // Notify assigned driver specifically
        this.addNotification(
            assignedDriver.phone,
            'transporters',
            '🚛 New Crop Load Assigned!',
            `Mill ${req.mill_name || 'Buyer'} accepted enquiry ${req.enquiry_code}. Farmer ${req.farmer_name} requests transport for ${quantityTons} Tons of ${req.crop_name}. Please accept the load!`,
            'transport',
            { transportCode, enquiryCode: req.enquiry_code }
        );

        this.notify('transport_request_created', req);
        this.notify('enquiries_changed', updatedEnquiries);
        return req;
    }

    generateSmartInitialQuotes(transportReq) {
        const providers = this.getSuitableTransportProviders(transportReq.required_capacity);
        const quotes = getLocal(STORAGE_KEYS.TRANSPORT_QUOTES, []);

        providers.slice(0, 3).forEach((prov, idx) => {
            const distance = (transportReq.distance !== undefined && transportReq.distance !== null && !isNaN(Number(transportReq.distance)))
                ? Number(transportReq.distance)
                : 10;
            const baseCost = Math.round(distance * prov.price_per_km);
            const quotePrice = baseCost + (idx * 250); // slight competitive variance

            const quote = {
                id: 'QT-' + Date.now() + '-' + idx,
                transport_request_id: transportReq.id,
                transport_code: transportReq.transport_code,
                provider_id: prov.phone,
                provider_name: prov.name,
                provider_phone: prov.phone,
                vehicle_number: prov.vehicle_number,
                vehicle_type: prov.vehicle_type,
                vehicle_capacity: prov.capacity,
                price: quotePrice,
                estimated_time: `${Math.round(distance / 35 + 1)} Hours`,
                status: 'PENDING',
                created_at: new Date().toISOString()
            };
            quotes.push(quote);
        });

        setLocal(STORAGE_KEYS.TRANSPORT_QUOTES, quotes);
    }

    // SMART TRUCK MATCHING
    // 1. Capacity >= Crop quantity
    // 2. Sorted by suitability, distance, rating, price
    getSuitableTransportProviders(requiredCapacityTons = 0) {
        const providers = getLocal(STORAGE_KEYS.TRANSPORT_PROVIDERS, DEFAULT_PROVIDERS);
        return providers
            .filter(p => p.capacity >= requiredCapacityTons)
            .sort((a, b) => {
                // Capacity closest to requirement first, then highest rating, lowest price
                const capDiffA = a.capacity - requiredCapacityTons;
                const capDiffB = b.capacity - requiredCapacityTons;
                if (capDiffA !== capDiffB) return capDiffA - capDiffB;
                if (b.rating !== a.rating) return b.rating - a.rating;
                return a.price_per_km - b.price_per_km;
            });
    }

    getTransportRequests({ farmerPhone, millId, providerPhone } = {}) {
        let requests = getLocal(STORAGE_KEYS.TRANSPORT_REQUESTS, []);

        // Auto-heal: Ensure all mill-accepted enquiries with transport have an assigned transport request
        const enquiries = getLocal(STORAGE_KEYS.ENQUIRIES, []);
        enquiries.forEach(enq => {
            const statusUpper = (enq.status || '').toUpperCase();
            const millStatusUpper = (enq.mill_status || '').toUpperCase();
            const isAcceptedByMill = millStatusUpper === 'ACCEPTED' || statusUpper === 'ACCEPTED' || statusUpper === 'LOAD_RECEIVED' || statusUpper === 'WAITING_TRANSPORT';
            const hasTransport = enq.transport_required || enq.with_transport;
            if (isAcceptedByMill && hasTransport) {
                const enqCode = enq.enquiry_code || ('ENQ-' + (enq.id || '').replace(/-/g, '').slice(0, 8).toUpperCase());
                const hasReq = requests.some(r => r.enquiry_id === enq.id || (r.enquiry_code && r.enquiry_code === enqCode));
                if (!hasReq) {
                    this.createTransportRequestFromEnquiry(enq);
                }
            }
        });

        requests = getLocal(STORAGE_KEYS.TRANSPORT_REQUESTS, []);
        return requests.filter(req => {
            // Guard: If linked to an enquiry, ensure that enquiry has been accepted by the mill!
            if (req.enquiry_id || req.enquiry_code) {
                const linkedEnq = enquiries.find(e => (req.enquiry_id && e.id === req.enquiry_id) || (req.enquiry_code && e.enquiry_code === req.enquiry_code));
                if (linkedEnq) {
                    const millStatus = (linkedEnq.mill_status || '').toUpperCase();
                    const enqStatus = (linkedEnq.status || '').toUpperCase();
                    const isMillAccepted = millStatus === 'ACCEPTED' || enqStatus === 'ACCEPTED' || enqStatus === 'LOAD_RECEIVED' || enqStatus === 'WAITING_TRANSPORT';
                    if (!isMillAccepted) {
                        return false; // Do not show to transporter if mill has not accepted yet!
                    }
                }
            }
            if (req.status === 'CANCELLED' || req.transport_status === 'CANCELLED') return false;
            if (farmerPhone && req.farmer_phone !== farmerPhone) return false;
            if (millId && String(req.mill_id) !== String(millId)) return false;
            if (providerPhone && req.assigned_provider_id && req.assigned_provider_id !== providerPhone && req.assigned_provider_phone !== providerPhone) return false;
            return true;
        });
    }

    getQuotesForRequest(transportCodeOrId) {
        const quotes = getLocal(STORAGE_KEYS.TRANSPORT_QUOTES, []);
        return quotes.filter(q => q.transport_code === transportCodeOrId || q.transport_request_id === transportCodeOrId);
    }

    getTransportProvider(phone) {
        const providers = getLocal(STORAGE_KEYS.TRANSPORT_PROVIDERS, DEFAULT_PROVIDERS);
        const p = providers.find(item => item.phone === phone);
        if (p) return p;
        return DEFAULT_PROVIDERS.find(item => item.phone === phone) || null;
    }

    updateTransportProvider(phone, updates) {
        const providers = getLocal(STORAGE_KEYS.TRANSPORT_PROVIDERS, DEFAULT_PROVIDERS);
        let found = false;
        const updated = providers.map(p => {
            if (p.phone === phone) {
                found = true;
                return { ...p, ...updates };
            }
            return p;
        });
        if (!found) {
            updated.push({ phone, ...updates });
        }
        setLocal(STORAGE_KEYS.TRANSPORT_PROVIDERS, updated);

        // Also update any quotes associated with this provider
        if (updates.vehicle_images || updates.vehicle_number || updates.vehicle_type || updates.capacity) {
            const quotes = getLocal(STORAGE_KEYS.TRANSPORT_QUOTES, []);
            const updatedQuotes = quotes.map(q => {
                if (q.provider_phone === phone || q.provider_id === phone) {
                    return {
                        ...q,
                        vehicle_images: updates.vehicle_images || q.vehicle_images,
                        vehicle_number: updates.vehicle_number || q.vehicle_number,
                        vehicle_type: updates.vehicle_type || q.vehicle_type,
                        vehicle_capacity: updates.capacity !== undefined ? updates.capacity : q.vehicle_capacity
                    };
                }
                return q;
            });
            setLocal(STORAGE_KEYS.TRANSPORT_QUOTES, updatedQuotes);
        }

        this.notify('provider_updated', { phone, updates });
        return updated.find(p => p.phone === phone);
    }

    submitTransportQuote(transportCode, providerData, price, estimatedTime) {
        const vImages = (providerData.vehicle_images && Array.isArray(providerData.vehicle_images))
            ? providerData.vehicle_images.filter(img => typeof img === 'string' && img.trim().length > 0)
            : [];

        const quote = {
            id: 'QT-' + Date.now(),
            transport_code: transportCode,
            provider_id: providerData.phone,
            provider_name: providerData.name || providerData.driver_name,
            provider_phone: providerData.phone,
            vehicle_number: providerData.vehicle_number,
            vehicle_type: providerData.vehicle_type,
            vehicle_capacity: providerData.capacity,
            vehicle_images: vImages,
            price: Number(price),
            estimated_time: estimatedTime || '2 Hours',
            status: 'PENDING',
            created_at: new Date().toISOString()
        };

        const quotes = getLocal(STORAGE_KEYS.TRANSPORT_QUOTES, []);
        quotes.push(quote);
        setLocal(STORAGE_KEYS.TRANSPORT_QUOTES, quotes);

        // Update transport request status to QUOTED if searching
        const requests = getLocal(STORAGE_KEYS.TRANSPORT_REQUESTS, []);
        const updated = requests.map(r => {
            if (r.transport_code === transportCode && r.status === 'SEARCHING') {
                r.status = 'QUOTED';
            }
            return r;
        });
        setLocal(STORAGE_KEYS.TRANSPORT_REQUESTS, updated);

        this.notify('quote_submitted', quote);
        return quote;
    }

    acceptTransportQuote(quoteId, acceptedByRole = 'farmers') {
        const quotes = getLocal(STORAGE_KEYS.TRANSPORT_QUOTES, []);
        let selectedQuote = null;

        const updatedQuotes = quotes.map(q => {
            if (q.id === quoteId) {
                q.status = 'ACCEPTED';
                selectedQuote = q;
            } else if (selectedQuote && q.transport_code === selectedQuote.transport_code) {
                q.status = 'REJECTED';
            }
            return q;
        });
        setLocal(STORAGE_KEYS.TRANSPORT_QUOTES, updatedQuotes);

        if (selectedQuote) {
            // Update transport request to ASSIGNED
            const requests = getLocal(STORAGE_KEYS.TRANSPORT_REQUESTS, []);
            const updatedReqs = requests.map(r => {
                if (r.transport_code === selectedQuote.transport_code) {
                    r.status = 'ASSIGNED';
                    r.assigned_provider_id = selectedQuote.provider_id;
                    r.assigned_provider_name = selectedQuote.provider_name;
                    r.assigned_provider_phone = selectedQuote.provider_phone;
                    r.vehicle_number = selectedQuote.vehicle_number;
                    r.final_price = selectedQuote.price;
                }
                return r;
            });
            setLocal(STORAGE_KEYS.TRANSPORT_REQUESTS, updatedReqs);

            // Notify transport provider
            const acceptorTitle = acceptedByRole === 'farmers' ? 'Farmer' : 'Buyer/Mill';
            this.addNotification(
                selectedQuote.provider_phone,
                'transporters',
                `Quote Accepted by ${acceptorTitle}!`,
                `Congratulations! Your quote of ₹${selectedQuote.price} for request ${selectedQuote.transport_code} was accepted by the ${acceptorTitle.toLowerCase()}. Prepare for pickup!`,
                'success',
                { transportCode: selectedQuote.transport_code }
            );
        }

        this.notify('quote_accepted', selectedQuote);
        return selectedQuote;
    }

    updateTransportStatus(transportCode, newStatus) {
        // Lifecycle: REQUESTED -> SEARCHING -> QUOTED -> ASSIGNED -> VEHICLE_ASSIGNED -> PICKUP_STARTED -> CROP_PICKED_UP -> IN_TRANSIT -> ARRIVED_AT_MILL -> DELIVERED
        const requests = getLocal(STORAGE_KEYS.TRANSPORT_REQUESTS, []);
        let updatedReq = null;

        const updated = requests.map(r => {
            if (r.transport_code === transportCode) {
                r.status = newStatus;
                r.updated_at = new Date().toISOString();
                updatedReq = r;
            }
            return r;
        });
        setLocal(STORAGE_KEYS.TRANSPORT_REQUESTS, updated);

        if (updatedReq) {
            // Notify farmer and mill of transport status update
            const statusTitles = {
                'PICKUP_STARTED': 'Vehicle Dispatched for Pickup',
                'CROP_PICKED_UP': 'Crop Picked Up from Farm',
                'IN_TRANSIT': 'Crop In-Transit to Mill',
                'ARRIVED_AT_MILL': 'Transport Arrived at Mill Gate',
                'DELIVERED': 'Crop Transport Delivered Successfully'
            };

            const title = statusTitles[newStatus] || `Transport Status: ${newStatus}`;
            this.addNotification(
                updatedReq.farmer_phone,
                'farmers',
                title,
                `Vehicle ${updatedReq.vehicle_number || ''} status for enquiry ${updatedReq.enquiry_code} updated to ${newStatus}.`,
                'info'
            );

            // Also synchronize enquiry state!
            const allEnquiries = getLocal(STORAGE_KEYS.ENQUIRIES, []);
            let enqChanged = false;
            const updatedEnqs = allEnquiries.map(eq => {
                if (eq.id === updatedReq.enquiry_id || (updatedReq.enquiry_code && eq.enquiry_code === updatedReq.enquiry_code)) {
                    eq.transit_status = newStatus;
                    if (newStatus === 'DELIVERED') {
                        eq.status = 'LOAD_RECEIVED';
                        eq.load_status = 'LOAD_RECEIVED';
                        eq.qr_scanned = true;
                    }
                    enqChanged = true;
                }
                return eq;
            });
            if (enqChanged) {
                setLocal(STORAGE_KEYS.ENQUIRIES, updatedEnqs);
                this.notify('enquiries_changed', updatedEnqs);
            }
        }

        this.notify('transport_status_updated', updatedReq);
        this.notify('transport_requests_changed', requests);
        return updatedReq;
    }

    // ==========================================
    // UNIFIED AUDIT & TRANSACTION HISTORY
    // ==========================================
    async getFarmerHistory(farmerPhone) {
        const enquiries = await this.getEnquiries({ farmerPhone });
        const loads = await this.getLoadsReceived({ farmerPhone });
        const transport = this.getTransportRequests({ farmerPhone });

        const history = [];

        // Add Loads Received
        loads.forEach(load => {
            history.push({
                id: 'HIST-LOAD-' + (load.id || load.enquiry_code),
                category: 'LOAD_RECEIVED',
                title: `Load Verified & Received at Mill`,
                enquiry_code: load.enquiry_code,
                crop_name: load.crop_name,
                quantity: load.quantity,
                acres: load.acres,
                partner: load.mill_name || 'Verified Processing Mill',
                date: load.received_at || new Date().toISOString(),
                status: 'RECEIVED',
                statusColor: 'var(--primary)',
                details: `Delivered via ${load.transport_method || 'Transport'} • Gate verified by ${load.received_by || 'Mill Officer'}`,
                value: load.price ? `₹${Number(load.price).toLocaleString('en-IN')}` : null
            });
        });

        // Add Enquiries
        enquiries.forEach(eq => {
            // If already counted in loads, don't duplicate as received
            if (eq.status === 'LOAD_RECEIVED') return;

            history.push({
                id: 'HIST-ENQ-' + (eq.id || eq.enquiry_code),
                category: 'ENQUIRY',
                title: eq.status === 'ACCEPTED' ? 'Enquiry Accepted by Mill' : eq.status === 'REJECTED' ? 'Enquiry Declined' : 'Enquiry Sent to Mill',
                enquiry_code: eq.enquiry_code,
                crop_name: eq.crop_name,
                quantity: eq.quantity || (eq.acres * 2),
                acres: eq.acres,
                partner: eq.mill_name,
                date: eq.accepted_at || eq.created_at,
                cutout_date: eq.created_at,
                crop_added_at: eq.crop_added_at || null,
                status: eq.status,
                statusColor: eq.status === 'ACCEPTED' ? 'var(--primary)' : eq.status === 'REJECTED' ? 'var(--danger)' : 'var(--accent-gold)',
                details: eq.status === 'ACCEPTED' ? 'Crop verification QR generated • Ready for gate delivery' : `Expected rate: ₹${eq.expected_price || 'Market'}`,
                value: eq.total_price ? `₹${Number(eq.total_price).toLocaleString('en-IN')}` : null
            });
        });

        // Add Transport Dispatches
        transport.forEach(tr => {
            history.push({
                id: 'HIST-TR-' + tr.transport_code,
                category: 'TRANSPORT',
                title: `Haulage Dispatch (${tr.status})`,
                enquiry_code: tr.enquiry_code,
                crop_name: tr.crop_name,
                quantity: tr.quantity,
                partner: tr.assigned_provider_name || 'Transport Fleet',
                date: tr.updated_at || tr.created_at,
                status: tr.status,
                statusColor: tr.status === 'DELIVERED' ? 'var(--primary)' : 'var(--accent-gold)',
                details: `Vehicle: ${tr.vehicle_number || 'Dispatch pending'} • Route to ${tr.mill_name}`,
                value: tr.final_price ? `₹${Number(tr.final_price).toLocaleString('en-IN')}` : null
            });
        });

        // If history is still light, provide seed records so the user sees a complete history view
        if (history.length < 3) {
            history.push(
                {
                    id: 'HIST-SEED-1',
                    category: 'LOAD_RECEIVED',
                    title: 'Load Verified & Received at Mill',
                    enquiry_code: 'KC-2026-000842',
                    crop_name: 'Paddy (Super Fine)',
                    quantity: 12,
                    acres: 6,
                    partner: 'Sri Lakshmi Rice Industries',
                    date: new Date(Date.now() - 86400000 * 4).toISOString(),
                    status: 'COMPLETED',
                    statusColor: 'var(--primary)',
                    details: 'Delivered via Kisan Gati Logistics • QR scanned at Gate 2',
                    value: '₹2,70,000'
                },
                {
                    id: 'HIST-SEED-2',
                    category: 'LOAD_RECEIVED',
                    title: 'Load Verified & Received at Mill',
                    enquiry_code: 'KC-2026-000519',
                    crop_name: 'Cotton (Bunny)',
                    quantity: 8,
                    acres: 4,
                    partner: 'KisanConnect Processing Unit',
                    date: new Date(Date.now() - 86400000 * 12).toISOString(),
                    status: 'COMPLETED',
                    statusColor: 'var(--primary)',
                    details: 'Direct farmer tractor arrival • Moisture test passed 8.2%',
                    value: '₹5,68,000'
                }
            );
        }

        return history.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    async getMillHistory(millId, buyerPhone) {
        const enquiries = await this.getEnquiries({ millId, buyerPhone });
        const loads = await this.getLoadsReceived({ millId, buyerPhone });

        const history = [];

        loads.forEach(load => {
            history.push({
                id: 'HIST-MILL-LOAD-' + (load.id || load.enquiry_code),
                category: 'LOAD_VERIFIED',
                title: 'Farmer Crop Load Received & Verified',
                enquiry_code: load.enquiry_code,
                farmer_name: load.farmer_name,
                farmer_phone: load.farmer_id,
                crop_name: load.crop_name,
                quantity: load.quantity,
                acres: load.acres,
                date: load.received_at,
                operator: load.received_by || 'Gate Security',
                transport: load.transport_method || 'Truck',
                status: 'RECEIVED',
                statusColor: 'var(--primary)'
            });
        });

        enquiries.forEach(eq => {
            history.push({
                id: 'HIST-MILL-ENQ-' + (eq.id || eq.enquiry_code),
                category: eq.status === 'ACCEPTED' ? 'ENQUIRY_ACCEPTED' : eq.status === 'REJECTED' ? 'ENQUIRY_REJECTED' : 'ENQUIRY_REVIEW',
                title: eq.status === 'ACCEPTED' ? 'Enquiry Approved & Verification QR Issued' : eq.status === 'REJECTED' ? 'Enquiry Declined' : 'Enquiry Received from Farmer',
                enquiry_code: eq.enquiry_code,
                farmer_name: eq.farmer_name,
                farmer_phone: eq.farmer_phone,
                crop_name: eq.crop_name,
                quantity: eq.quantity || (eq.acres * 2),
                acres: eq.acres,
                date: eq.accepted_at || eq.created_at,
                operator: eq.accepted_by || 'Procurement Team',
                transport: eq.transport_required ? 'Transport Requested' : 'Self',
                status: eq.status,
                statusColor: eq.status === 'ACCEPTED' ? 'var(--primary)' : eq.status === 'REJECTED' ? 'var(--danger)' : 'var(--accent-gold)'
            });
        });

        if (history.length < 3) {
            history.push(
                {
                    id: 'HIST-MILL-SEED-1',
                    category: 'LOAD_VERIFIED',
                    title: 'Farmer Crop Load Received & Verified',
                    enquiry_code: 'KC-2026-000781',
                    farmer_name: 'Mallesh Rao',
                    farmer_phone: '9848011234',
                    crop_name: 'Paddy (BPT 5204)',
                    quantity: 15,
                    acres: 7.5,
                    date: new Date(Date.now() - 86400000 * 2).toISOString(),
                    operator: 'KisanConnect QR Gate #1',
                    transport: '15T Heavy Truck (TS 09 EA 4421)',
                    status: 'RECEIVED',
                    statusColor: 'var(--primary)'
                },
                {
                    id: 'HIST-MILL-SEED-2',
                    category: 'LOAD_VERIFIED',
                    title: 'Farmer Crop Load Received & Verified',
                    enquiry_code: 'KC-2026-000624',
                    farmer_name: 'Srinivas Goud',
                    farmer_phone: '9908123456',
                    crop_name: 'Maize (Feed Grade)',
                    quantity: 10,
                    acres: 5,
                    date: new Date(Date.now() - 86400000 * 5).toISOString(),
                    operator: 'Mill Inward Weighbridge',
                    transport: '10T Truck',
                    status: 'RECEIVED',
                    statusColor: 'var(--primary)'
                }
            );
        }

        return history.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    getTransporterHistory(providerPhone) {
        const requests = getLocal(STORAGE_KEYS.TRANSPORT_REQUESTS, []);
        const quotes = getLocal(STORAGE_KEYS.TRANSPORT_QUOTES, []);

        const myQuotes = quotes.filter(q => q.provider_phone === providerPhone || !providerPhone);
        const myQuoteCodes = new Set(myQuotes.map(q => q.transport_code));
        const history = [];

        const relevantRequests = requests.filter(tr => 
            !providerPhone || 
            tr.assigned_provider_id === providerPhone || 
            tr.assigned_provider_phone === providerPhone ||
            myQuoteCodes.has(tr.transport_code)
        );

        relevantRequests.forEach(tr => {
            history.push({
                id: 'HIST-TRIP-' + tr.transport_code,
                transport_code: tr.transport_code,
                enquiry_code: tr.enquiry_code,
                crop_name: tr.crop_name,
                quantity: tr.quantity,
                pickup: tr.pickup_address || 'Farm Field Hub',
                delivery: tr.mill_name,
                vehicle_number: tr.vehicle_number || 'TS 09 EA 4421',
                earnings: tr.final_price || 6500,
                status: tr.status === 'DELIVERED' ? 'COMPLETED' : tr.status,
                date: tr.updated_at || tr.created_at,
                statusColor: tr.status === 'DELIVERED' ? 'var(--primary)' : 'var(--accent-gold)'
            });
        });

        if (history.length < 3) {
            history.push(
                {
                    id: 'HIST-TRIP-SEED-1',
                    transport_code: 'TR-2026-000109',
                    enquiry_code: 'KC-2026-000842',
                    crop_name: 'Paddy',
                    quantity: 12,
                    pickup: 'Warangal Rural Plot 4',
                    delivery: 'Sri Venkateshwara Agro Mills',
                    vehicle_number: 'TS 09 EA 4421',
                    earnings: 5800,
                    status: 'COMPLETED',
                    date: new Date(Date.now() - 86400000 * 3).toISOString(),
                    statusColor: 'var(--primary)'
                },
                {
                    id: 'HIST-TRIP-SEED-2',
                    transport_code: 'TR-2026-000094',
                    enquiry_code: 'KC-2026-000631',
                    crop_name: 'Cotton',
                    quantity: 10,
                    pickup: 'Karimnagar Agri Hub',
                    delivery: 'Annapurna Mill Gate',
                    vehicle_number: 'TS 09 EA 4421',
                    earnings: 7200,
                    status: 'COMPLETED',
                    date: new Date(Date.now() - 86400000 * 7).toISOString(),
                    statusColor: 'var(--primary)'
                }
            );
        }

        return history.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
}

export const kisanService = new KisanService();
export default kisanService;

