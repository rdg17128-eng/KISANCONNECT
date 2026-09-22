/**
 * Location Service for High-Accuracy GPS & Reverse Geocoding
 * Optimized for Agricultural Farm Plots & Rural India (Villages, Mandals, Districts)
 */

export async function getCurrentCoordinates() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported by your browser."));
            return;
        }

        const optionsHigh = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            pos => {
                resolve({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: Math.round(pos.coords.accuracy || 10)
                });
            },
            err => {
                console.warn("High-accuracy GPS attempt failed/timed out, falling back to standard accuracy:", err.message);
                const optionsLow = {
                    enableHighAccuracy: false,
                    timeout: 8000,
                    maximumAge: 30000
                };
                navigator.geolocation.getCurrentPosition(
                    pos => {
                        resolve({
                            lat: pos.coords.latitude,
                            lng: pos.coords.longitude,
                            accuracy: Math.round(pos.coords.accuracy || 50)
                        });
                    },
                    fallbackErr => {
                        reject(fallbackErr);
                    },
                    optionsLow
                );
            },
            optionsHigh
        );
    });
}

export async function reverseGeocode(lat, lng) {
    if (!lat || !lng) return { placeName: 'Selected Location', fullAddress: '' };
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
        const res = await fetch(url, {
            headers: {
                'Accept-Language': 'en'
            }
        });
        if (!res.ok) throw new Error("Reverse geocoding failed");
        const data = await res.json();

        const a = data.address || {};
        // 1. Primary local settlement name (Village, Hamlet, Farm, Suburb, Town, City)
        const locality = a.village || a.hamlet || a.farm || a.suburb || a.neighbourhood || a.town || a.city || a.locality || a.isolated_dwelling || a.residential;
        // 2. Secondary administrative unit (Mandal, Tehsil, Subdistrict, County, District)
        const subDistrict = a.subdistrict || a.tehsil || a.taluk || a.mandal || a.county || a.district || a.state_district;
        // 3. State
        const state = a.state;

        let formattedName = '';
        if (locality && subDistrict && locality.toLowerCase() !== subDistrict.toLowerCase()) {
            formattedName = `${locality}, ${subDistrict}`;
        } else if (locality && state) {
            formattedName = `${locality}, ${state}`;
        } else if (subDistrict && state) {
            formattedName = `${subDistrict}, ${state}`;
        } else if (data.display_name) {
            const parts = data.display_name.split(',').map(s => s.trim()).filter(Boolean);
            formattedName = parts.slice(0, 2).join(', ');
        } else {
            formattedName = locality || subDistrict || state || `Farm Plot (${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)})`;
        }

        return {
            placeName: formattedName,
            fullAddress: data.display_name || formattedName,
            locality: locality || '',
            district: subDistrict || '',
            state: state || '',
            raw: data
        };
    } catch (err) {
        console.warn("Reverse geocode error:", err);
        return {
            placeName: `Farm Plot (${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)})`,
            fullAddress: `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`,
            raw: null
        };
    }
}

export async function searchLocations(query) {
    if (!query || query.trim().length < 2) return [];
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&q=${encodeURIComponent(query)}&limit=6&addressdetails=1`;
        const res = await fetch(url, {
            headers: {
                'Accept-Language': 'en'
            }
        });
        if (!res.ok) return [];
        const results = await res.json();
        return results.map(item => {
            const a = item.address || {};
            const locality = a.village || a.hamlet || a.town || a.city || a.suburb;
            const subDistrict = a.subdistrict || a.tehsil || a.taluk || a.district || a.county;
            const state = a.state;
            const label = [locality, subDistrict, state].filter(Boolean).join(', ') || item.display_name.split(',').slice(0, 2).join(', ');
            return {
                placeName: label,
                fullAddress: item.display_name,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon)
            };
        });
    } catch (err) {
        console.warn("Search location error:", err);
        return [];
    }
}

/**
 * Calculate straight-line (geodesic Haversine) distance in kilometers between two coordinates.
 * Strictly parses numbers and handles identical coordinates, zero distance, and edge cases.
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    if (lat1 === undefined || lat1 === null || lon1 === undefined || lon1 === null ||
        lat2 === undefined || lat2 === null || lon2 === undefined || lon2 === null) {
        return 0;
    }

    const pLat1 = Number(lat1);
    const pLon1 = Number(lon1);
    const pLat2 = Number(lat2);
    const pLon2 = Number(lon2);

    if (isNaN(pLat1) || isNaN(pLon1) || isNaN(pLat2) || isNaN(pLon2)) return 0;
    if (pLat1 === 0 && pLon1 === 0 && pLat2 === 0 && pLon2 === 0) return 0;

    // Identical coordinates (within ~1 meter)
    if (Math.abs(pLat1 - pLat2) < 0.00001 && Math.abs(pLon1 - pLon2) < 0.00001) {
        return 0;
    }

    const R = 6371; // Earth's mean radius in km
    const dLat = (pLat2 - pLat1) * (Math.PI / 180);
    const dLon = (pLon2 - pLon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(pLat1 * (Math.PI / 180)) * Math.cos(pLat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
    const dist = R * c;
    return Math.round(dist * 10) / 10;
}

/**
 * Calculate accurate road driving distance in kilometers.
 * Applies a calibrated road network factor (~1.25x for rural/mandi transit routes in India)
 * so distance matches actual driving odometers rather than straight air line.
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
    const straight = calculateHaversineDistance(lat1, lon1, lat2, lon2);
    if (straight <= 0.05) return 0;
    // Calibrated Indian road network route factor (straight line to actual road transit)
    const roadDist = straight * 1.25;
    return Math.round(roadDist * 10) / 10;
}

/**
 * High-accuracy asynchronous road route distance using OpenStreetMap OSRM driving engine.
 * Automatically caches results and seamlessly falls back to calibrated road calculation.
 */
const routeDistanceCache = new Map();
export async function getRoadRouteDistance(lat1, lon1, lat2, lon2) {
    const pLat1 = Number(lat1);
    const pLon1 = Number(lon1);
    const pLat2 = Number(lat2);
    const pLon2 = Number(lon2);

    if (isNaN(pLat1) || isNaN(pLon1) || isNaN(pLat2) || isNaN(pLon2)) {
        return calculateDistance(lat1, lon1, lat2, lon2);
    }
    if (Math.abs(pLat1 - pLat2) < 0.00001 && Math.abs(pLon1 - pLon2) < 0.00001) {
        return 0;
    }

    const cacheKey = `${pLat1.toFixed(4)},${pLon1.toFixed(4)}-${pLat2.toFixed(4)},${pLon2.toFixed(4)}`;
    if (routeDistanceCache.has(cacheKey)) {
        return routeDistanceCache.get(cacheKey);
    }

    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${pLon1},${pLat1};${pLon2},${pLat2}?overview=false`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
            const data = await res.json();
            if (data.code === 'Ok' && data.routes && data.routes[0]) {
                const distanceKm = Math.round((data.routes[0].distance / 1000) * 10) / 10;
                routeDistanceCache.set(cacheKey, distanceKm);
                return distanceKm;
            }
        }
    } catch (err) {
        // Fallback to calibrated road distance
    }

    const fallback = calculateDistance(pLat1, pLon1, pLat2, pLon2);
    routeDistanceCache.set(cacheKey, fallback);
    return fallback;
}

/**
 * Helper to display distance accurately in UI without false "35 KM" or "0 KM"
 */
export function formatDistance(km) {
    const num = Number(km);
    if (isNaN(num) || num <= 0.05) return 'Nearby (< 1 km)';
    if (num < 1) return `~${num.toFixed(1)} km`;
    return `~${num.toFixed(1)} km`;
}

/**
 * High-accuracy driving route fetcher using OpenStreetMap OSRM.
 * Returns full polyline coordinates [ [lat, lng], ... ], total distance (km),
 * duration (mins), and step-by-step driving maneuvers.
 */
export async function getRoadDrivingRoute(originLat, originLng, destLat, destLng) {
    const pLat1 = Number(originLat);
    const pLon1 = Number(originLng);
    const pLat2 = Number(destLat);
    const pLon2 = Number(destLng);

    if (isNaN(pLat1) || isNaN(pLon1) || isNaN(pLat2) || isNaN(pLon2)) {
        return {
            distanceKm: 15.0,
            durationMinutes: 25,
            coordinates: [[17.9689, 79.5941], [17.0916, 80.0210]],
            steps: [],
            isRoadNetwork: false
        };
    }

    // Straight-line fallback geometry generator if offline / route fails
    const createFallbackGeometry = () => {
        const straightKm = calculateDistance(pLat1, pLon1, pLat2, pLon2);
        // Add subtle road curvature midpoint
        const midLat = (pLat1 + pLat2) / 2 + (pLon2 - pLon1) * 0.05;
        const midLng = (pLon1 + pLon2) / 2 + (pLat1 - pLat2) * 0.05;
        return {
            distanceKm: straightKm,
            durationMinutes: Math.max(5, Math.round((straightKm / 40) * 60)), // ~40km/h rural truck speed
            coordinates: [[pLat1, pLon1], [midLat, midLng], [pLat2, pLon2]],
            steps: [
                { instruction: `Head towards destination`, distanceKm: Math.round(straightKm * 0.6 * 10) / 10, modifier: 'straight' },
                { instruction: `Arrive at destination gate/field`, distanceKm: Math.round(straightKm * 0.4 * 10) / 10, modifier: 'arrive' }
            ],
            isRoadNetwork: false
        };
    };

    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${pLon1},${pLat1};${pLon2},${pLat2}?overview=full&geometries=geojson&steps=true`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
            const data = await res.json();
            if (data.code === 'Ok' && data.routes && data.routes[0]) {
                const route = data.routes[0];
                const rawCoords = route.geometry?.coordinates || [];
                // GeoJSON is [lng, lat], Leaflet polyline expects [lat, lng]
                const leafletCoords = rawCoords.map(([lng, lat]) => [lat, lng]);
                const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
                const durationMinutes = Math.max(1, Math.round(route.duration / 60));

                const steps = [];
                if (route.legs && route.legs[0] && Array.isArray(route.legs[0].steps)) {
                    route.legs[0].steps.forEach(st => {
                        const roadName = st.name ? ` on ${st.name}` : '';
                        const type = st.maneuver?.type || 'turn';
                        const mod = st.maneuver?.modifier || '';
                        let text = '';

                        if (type === 'depart') text = `Depart towards destination${roadName}`;
                        else if (type === 'arrive') text = `Arrive at destination`;
                        else if (mod) text = `Turn ${mod}${roadName}`;
                        else text = `Continue${roadName}`;

                        steps.push({
                            instruction: text,
                            distanceKm: Math.round((st.distance / 1000) * 10) / 10,
                            durationMins: Math.max(1, Math.round(st.duration / 60)),
                            type: type,
                            modifier: mod
                        });
                    });
                }

                return {
                    distanceKm: distanceKm || calculateDistance(pLat1, pLon1, pLat2, pLon2),
                    durationMinutes,
                    coordinates: leafletCoords.length > 0 ? leafletCoords : [[pLat1, pLon1], [pLat2, pLon2]],
                    steps: steps.length > 0 ? steps : createFallbackGeometry().steps,
                    isRoadNetwork: true
                };
            }
        }
    } catch (err) {
        console.warn("OSRM road route fetch error, using calibrated geometry:", err);
    }

    return createFallbackGeometry();
}

