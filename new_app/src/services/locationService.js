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
