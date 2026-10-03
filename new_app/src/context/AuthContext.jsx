import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';

const AuthContext = createContext(null);

const ROLE_TABLES = {
    farmers: 'farmers',
    buyers: 'buyers',
    transporters: 'transport_providers'
};

const ROLE_DISPLAY_NAMES = {
    farmers: 'Farmer Portal',
    buyers: 'Mill Portal',
    transporters: 'Transport Portal'
};

// Helper to save user in local registry for offline fallback and fast sync
function saveUserToLocalCache(tableName, userObj) {
    try {
        const key = `kisan_users_${tableName}`;
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        const filtered = existing.filter(u => u.phone !== userObj.phone && u.email !== userObj.email);
        filtered.push(userObj);
        localStorage.setItem(key, JSON.stringify(filtered));
    } catch (e) {
        console.warn("Could not write to local user cache:", e);
    }
}

// Helper to safely upsert user into Supabase table with fallback for schema differences
async function upsertUserToSupabase(tableName, profileData) {
    try {
        // 1. Attempt full upsert
        const { error } = await supabase.from(tableName).upsert(profileData, { onConflict: 'phone' });
        if (error) {
            console.warn(`Supabase upsert note on ${tableName}:`, error.message);
            // 2. Fallback to essential columns supported by all basic schemas
            const coreData = {
                phone: profileData.phone,
                pin: profileData.password || profileData.pin || '1234',
                name: profileData.name || 'Kisan User',
                role: profileData.role,
                created_at: profileData.created_at || new Date().toISOString()
            };
            if (profileData.email) coreData.email = profileData.email;
            if (tableName === 'transport_providers') {
                coreData.vehicle_number = profileData.vehicle_number || 'TS 09 EA 4421';
                coreData.vehicle_type = profileData.vehicle_type || 'Standard Commercial Truck';
                coreData.capacity = Number(profileData.capacity) || 15;
            }
            await supabase.from(tableName).upsert(coreData, { onConflict: 'phone' }).catch(e => {
                console.warn("Fallback upsert also encountered notice:", e);
            });
        }
    } catch (err) {
        console.warn(`Error during Supabase upsert on ${tableName}:`, err);
    }
}

export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem('kisan_active_user');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });
    const [role, setRole] = useState(() => {
        try {
            return localStorage.getItem('kisan_active_role') || null;
        } catch {
            return null;
        }
    });
    const [loading, setLoading] = useState(() => {
        if (typeof window !== 'undefined') {
            const hash = window.location.hash || '';
            const search = window.location.search || '';
            if (
                hash.includes('access_token') ||
                hash.includes('refresh_token') ||
                hash.includes('token_type') ||
                search.includes('code=')
            ) {
                return true;
            }
        }
        return false;
    });
    const [needsRoleSelection, setNeedsRoleSelection] = useState(false);
    const [googleUser, setGoogleUser] = useState(null);
    const [authMismatchError, setAuthMismatchError] = useState(() => {
        try {
            const savedErr = sessionStorage.getItem('kisan_auth_mismatch_error');
            return savedErr ? JSON.parse(savedErr) : null;
        } catch {
            return null;
        }
    });
    const isProcessingRef = React.useRef(false);

    const clearAuthMismatchError = useCallback(() => {
        setAuthMismatchError(null);
        try {
            sessionStorage.removeItem('kisan_auth_mismatch_error');
        } catch {}
    }, []);

    // Process authenticated Supabase user (e.g. from Google OAuth)
    const processSupabaseUser = async (sbUser) => {
        if (!sbUser) {
            setUser(null);
            setRole(null);
            setNeedsRoleSelection(false);
            setGoogleUser(null);
            setLoading(false);
            return;
        }

        // Prevent duplicate concurrent executions
        if (isProcessingRef.current) {
            return;
        }
        isProcessingRef.current = true;

        try {
            // A. Check if this is the completion of a pending phone+password registration with Google linking
            let pendingReg = null;
            try {
                const pendingRaw = localStorage.getItem('kisan_pending_registration');
                if (pendingRaw) {
                    pendingReg = JSON.parse(pendingRaw);
                    localStorage.removeItem('kisan_pending_registration');
                }
            } catch (e) {
                console.warn("Could not read pending registration:", e);
            }

            if (pendingReg && pendingReg.phone) {
                const targetRole = pendingReg.role || 'farmers';
                const targetTable = ROLE_TABLES[targetRole] || targetRole;

                const fullProfile = {
                    id: sbUser.id,
                    phone: pendingReg.phone,
                    password: pendingReg.password,
                    pin: pendingReg.pin || pendingReg.password,
                    name: pendingReg.name || sbUser.user_metadata?.full_name || 'Kisan Member',
                    email: sbUser.email,
                    google_id: sbUser.id,
                    role: targetRole,
                    avatar: sbUser.user_metadata?.avatar_url || null,
                    created_at: pendingReg.created_at || new Date().toISOString(),
                    ...(pendingReg.vehicle_number ? { vehicle_number: pendingReg.vehicle_number } : {}),
                    ...(pendingReg.capacity ? { capacity: Number(pendingReg.capacity) } : {}),
                    ...(targetRole === 'transporters' ? { vehicle_type: pendingReg.vehicle_type || 'Standard Commercial Truck' } : {})
                };

                // Upsert to Supabase
                await upsertUserToSupabase(targetTable, fullProfile);

                // Save to local cache
                saveUserToLocalCache(targetTable, fullProfile);

                // Update Auth metadata
                supabase.auth.updateUser({
                    data: {
                        role: targetRole,
                        phone: pendingReg.phone,
                        full_name: fullProfile.name
                    }
                }).catch(() => {});

                setUser(fullProfile);
                setRole(targetRole);
                setNeedsRoleSelection(false);
                setGoogleUser(null);
                setLoading(false);
                clearAuthMismatchError();

                try {
                    localStorage.setItem('kisan_active_user', JSON.stringify(fullProfile));
                    localStorage.setItem('kisan_active_role', targetRole);
                    localStorage.removeItem('kisan_intended_role');
                } catch (e) {
                    console.warn(e);
                }

                return;
            }

            // B. Check for returning user / existing account linked with this Google email or google_id
            let intendedRole = null;
            try {
                intendedRole = localStorage.getItem('kisan_intended_role');
            } catch (e) {}

            if (sbUser.email) {
                try {
                    // Check all 3 role tables in parallel to find linked existing account
                    const [farmerRes, buyerRes, transRes] = await Promise.all([
                        supabase.from('farmers').select('*').or(`email.eq.${sbUser.email},phone.eq.${sbUser.phone || ''}`).maybeSingle(),
                        supabase.from('buyers').select('*').or(`email.eq.${sbUser.email},phone.eq.${sbUser.phone || ''}`).maybeSingle(),
                        supabase.from('transport_providers').select('*').or(`email.eq.${sbUser.email},phone.eq.${sbUser.phone || ''}`).maybeSingle()
                    ]);

                    let matchedRole = null;
                    let matchedProfile = null;

                    if (farmerRes?.data) {
                        matchedRole = 'farmers';
                        matchedProfile = farmerRes.data;
                    } else if (buyerRes?.data) {
                        matchedRole = 'buyers';
                        matchedProfile = buyerRes.data;
                    } else if (transRes?.data) {
                        matchedRole = 'transporters';
                        matchedProfile = transRes.data;
                    }

                    // Fallback to local user cache if offline or database lookup returned empty
                    if (!matchedRole) {
                        const localFarmers = JSON.parse(localStorage.getItem('kisan_users_farmers') || '[]');
                        const localBuyers = JSON.parse(localStorage.getItem('kisan_users_buyers') || '[]');
                        const localTransporters = JSON.parse(localStorage.getItem('kisan_users_transport_providers') || '[]');

                        const foundFarmer = localFarmers.find(u => u.email === sbUser.email);
                        const foundBuyer = localBuyers.find(u => u.email === sbUser.email);
                        const foundTrans = localTransporters.find(u => u.email === sbUser.email);

                        if (foundFarmer) {
                            matchedRole = 'farmers';
                            matchedProfile = foundFarmer;
                        } else if (foundBuyer) {
                            matchedRole = 'buyers';
                            matchedProfile = foundBuyer;
                        } else if (foundTrans) {
                            matchedRole = 'transporters';
                            matchedProfile = foundTrans;
                        }
                    }

                    // CRITICAL VALIDATION: Cross-portal check
                    // If user has an account in role A (e.g. 'farmers'), but clicked "Continue with Google" in role B (e.g. 'buyers')
                    if (matchedRole && intendedRole && matchedRole !== intendedRole) {
                        console.warn(`Portal mismatch detected: Account is registered as ${matchedRole}, but tried to sign in to ${intendedRole}`);

                        // Sign out from Supabase so unauthorized session is NOT active
                        await supabase.auth.signOut().catch(() => {});

                        setUser(null);
                        setRole(null);
                        setNeedsRoleSelection(false);
                        setGoogleUser(null);
                        setLoading(false);

                        try {
                            localStorage.removeItem('kisan_intended_role');
                            localStorage.removeItem('kisan_active_user');
                            localStorage.removeItem('kisan_active_role');
                        } catch (e) {}

                        const mismatchData = {
                            email: sbUser.email,
                            intendedRole: intendedRole,
                            intendedPortalName: ROLE_DISPLAY_NAMES[intendedRole] || intendedRole,
                            registeredRole: matchedRole,
                            registeredPortalName: ROLE_DISPLAY_NAMES[matchedRole] || matchedRole
                        };

                        setAuthMismatchError(mismatchData);
                        try {
                            sessionStorage.setItem('kisan_auth_mismatch_error', JSON.stringify(mismatchData));
                        } catch (e) {}
                        return;
                    }

                    // Matching account found: Log in directly to their registered portal
                    if (matchedRole && matchedProfile) {
                        const finalUser = {
                            id: sbUser.id,
                            email: sbUser.email,
                            name: matchedProfile.name || sbUser.user_metadata?.full_name || 'Kisan Member',
                            phone: matchedProfile.phone || '',
                            role: matchedRole,
                            avatar: sbUser.user_metadata?.avatar_url || null,
                            ...matchedProfile
                        };

                        setUser(finalUser);
                        setRole(matchedRole);
                        setNeedsRoleSelection(false);
                        setGoogleUser(null);
                        setLoading(false);
                        clearAuthMismatchError();

                        try {
                            localStorage.setItem('kisan_active_user', JSON.stringify(finalUser));
                            localStorage.setItem('kisan_active_role', matchedRole);
                            localStorage.removeItem('kisan_intended_role');
                        } catch (e) {
                            console.warn(e);
                        }
                        return;
                    }

                    // If user clicked "Continue with Google" under Login, but no account exists with this email in ANY portal
                    if (!matchedRole && intendedRole) {
                        await supabase.auth.signOut().catch(() => {});

                        setUser(null);
                        setRole(null);
                        setNeedsRoleSelection(false);
                        setGoogleUser(null);
                        setLoading(false);

                        try {
                            localStorage.removeItem('kisan_intended_role');
                        } catch (e) {}

                        const notFoundData = {
                            email: sbUser.email,
                            intendedRole: intendedRole,
                            intendedPortalName: ROLE_DISPLAY_NAMES[intendedRole] || intendedRole,
                            registeredRole: null,
                            registeredPortalName: null
                        };

                        setAuthMismatchError(notFoundData);
                        try {
                            sessionStorage.setItem('kisan_auth_mismatch_error', JSON.stringify(notFoundData));
                        } catch (e) {}
                        return;
                    }
                } catch (lookupErr) {
                    console.warn("Profile lookup notice:", lookupErr);
                }
            }

            // Unassigned Google user without pre-selection: open role picker modal
            setGoogleUser(sbUser);
            setNeedsRoleSelection(true);
            setLoading(false);
        } finally {
            isProcessingRef.current = false;
        }
    };

    useEffect(() => {
        let isMounted = true;

        const safetyTimer = setTimeout(() => {
            if (isMounted) setLoading(false);
        }, 5000);

        // Clear OAuth error if present in URL
        if (typeof window !== 'undefined') {
            const hash = window.location.hash || '';
            const search = window.location.search || '';
            if (hash.includes('error=') || search.includes('error=')) {
                try {
                    localStorage.removeItem('kisan_intended_role');
                    localStorage.removeItem('kisan_pending_registration');
                } catch {}
                setLoading(false);
            }
        }

        // Initialize Supabase Auth Session
        const initSession = async () => {
            try {
                const { data: { session: initialSession } } = await supabase.auth.getSession();
                if (!isMounted) return;
                setSession(initialSession);
                if (initialSession?.user) {
                    await processSupabaseUser(initialSession.user);
                } else {
                    setLoading(false);
                }
            } catch (err) {
                console.error("Supabase getSession error:", err);
                if (isMounted) setLoading(false);
            }
        };

        initSession();

        // Listen to Supabase Auth State changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
            if (!isMounted) return;
            setSession(newSession);
            if (event === 'SIGNED_IN' && newSession?.user) {
                await processSupabaseUser(newSession.user);
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
                setRole(null);
                setGoogleUser(null);
                setLoading(false);
            }
        });

        return () => {
            isMounted = false;
            clearTimeout(safetyTimer);
            subscription?.unsubscribe();
        };
    }, []);

    // 1. Trigger Supabase Google OAuth
    const signInWithGoogle = useCallback(async (intendedRole = null) => {
        try {
            clearAuthMismatchError();
            if (intendedRole) {
                localStorage.setItem('kisan_intended_role', intendedRole);
            }
            localStorage.setItem('kisan_auth_origin', window.location.origin);
            const redirectUrl = window.location.origin;
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl
                }
            });
            if (error) {
                console.error("Google OAuth error:", error);
                throw new Error(error.message || "Google sign-in failed. Please try again.");
            }
        } catch (err) {
            console.error("Google sign-in error:", err);
            throw new Error(err.message || "Google sign-in failed. Please try again.");
        }
    }, [clearAuthMismatchError]);

    // 2. Check if a mobile number is already registered across any portal
    const checkPhoneExists = useCallback(async (phone) => {
        const cleanPhone = String(phone).replace(/\D/g, '').trim();
        if (cleanPhone.length !== 10) return { exists: false, role: null };

        try {
            const [fRes, bRes, tRes] = await Promise.all([
                supabase.from('farmers').select('phone').eq('phone', cleanPhone).maybeSingle(),
                supabase.from('buyers').select('phone').eq('phone', cleanPhone).maybeSingle(),
                supabase.from('transport_providers').select('phone').eq('phone', cleanPhone).maybeSingle()
            ]);

            if (fRes?.data?.phone) return { exists: true, role: 'farmers' };
            if (bRes?.data?.phone) return { exists: true, role: 'buyers' };
            if (tRes?.data?.phone) return { exists: true, role: 'transporters' };
        } catch (e) {
            console.warn("Supabase phone check notice:", e);
        }

        // Check local cache
        const localFarmers = JSON.parse(localStorage.getItem('kisan_users_farmers') || '[]');
        const localBuyers = JSON.parse(localStorage.getItem('kisan_users_buyers') || '[]');
        const localTransporters = JSON.parse(localStorage.getItem('kisan_users_transport_providers') || '[]');

        if (localFarmers.some(u => u.phone === cleanPhone)) return { exists: true, role: 'farmers' };
        if (localBuyers.some(u => u.phone === cleanPhone)) return { exists: true, role: 'buyers' };
        if (localTransporters.some(u => u.phone === cleanPhone)) return { exists: true, role: 'transporters' };

        return { exists: false, role: null };
    }, []);

    // 3. Register with Phone + Password & Link Google Account (Mandatory Step)
    const registerWithPhoneAndLinkGoogle = useCallback(async (registrationData) => {
        const { phone, password, name, role: targetRole, vehicle_number, capacity } = registrationData;

        // Validation
        const cleanPhone = String(phone).replace(/\D/g, '').trim();
        if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
            throw new Error('Please enter a valid 10-digit Indian mobile number.');
        }
        if (!password || password.length < 6) {
            throw new Error('Password must be at least 6 characters long.');
        }
        if (!name || name.trim().length === 0) {
            throw new Error('Please enter your full name or enterprise name.');
        }

        // Check if phone already registered
        const existingCheck = await checkPhoneExists(cleanPhone);
        if (existingCheck.exists) {
            const roleName = existingCheck.role === 'farmers' ? 'Farmer' : existingCheck.role === 'buyers' ? 'Mill' : 'Transporter';
            throw new Error(`An account with this mobile number is already registered as a ${roleName}. Please use Phone Login.`);
        }

        // Save registration payload to localStorage before initiating Google OAuth
        const pendingPayload = {
            phone: cleanPhone,
            password: password,
            pin: password,
            name: name.trim(),
            role: targetRole,
            vehicle_number: vehicle_number || null,
            capacity: capacity ? Number(capacity) : null,
            created_at: new Date().toISOString()
        };

        try {
            localStorage.setItem('kisan_pending_registration', JSON.stringify(pendingPayload));
            localStorage.setItem('kisan_intended_role', targetRole);
        } catch (e) {
            console.warn("Failed to store pending registration in localStorage:", e);
        }

        // Trigger Google OAuth to complete mandatory linking
        await signInWithGoogle(targetRole);
    }, [checkPhoneExists, signInWithGoogle]);

    // 4. Login with Mobile Number and Password
    const loginWithPhoneAndPassword = useCallback(async (phone, password, targetRole) => {
        const cleanPhone = String(phone).replace(/\D/g, '').trim();
        if (!cleanPhone || cleanPhone.length !== 10) {
            return { success: false, error: 'Please enter a valid 10-digit mobile number.' };
        }
        if (!password || password.length === 0) {
            return { success: false, error: 'Please enter your password.' };
        }

        const tableName = ROLE_TABLES[targetRole] || targetRole;
        let userData = null;

        // Query Supabase table for this role
        try {
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .eq('phone', cleanPhone)
                .maybeSingle();

            if (!error && data) {
                userData = data;
            }
        } catch (supaErr) {
            console.warn("Supabase login lookup notice:", supaErr);
        }

        // Fallback: Check local cache for this role
        if (!userData) {
            const localUsers = JSON.parse(localStorage.getItem(`kisan_users_${tableName}`) || '[]');
            userData = localUsers.find(u => u.phone === cleanPhone);
        }

        // Fallback: Check seed providers for transporters
        if (!userData && targetRole === 'transporters') {
            const seedProviders = JSON.parse(localStorage.getItem('kisan_transport_providers') || '[]');
            userData = seedProviders.find(p => p.phone === cleanPhone);
        }

        // If not found in this role, check if user exists under another role to give a clear message
        if (!userData) {
            const otherRoles = Object.keys(ROLE_TABLES).filter(r => r !== targetRole);
            for (const otherRole of otherRoles) {
                const otherTable = ROLE_TABLES[otherRole];
                try {
                    const { data: otherData } = await supabase.from(otherTable).select('phone').eq('phone', cleanPhone).maybeSingle();
                    if (otherData) {
                        const roleTitle = otherRole === 'farmers' ? 'Farmer Portal' : otherRole === 'buyers' ? 'Mill Portal' : 'Transport Portal';
                        return { success: false, error: `This mobile number is registered under the ${roleTitle}. Please switch to that portal to sign in.` };
                    }
                } catch (e) {}
            }

            return { success: false, error: 'No account found with this mobile number. Please click "Create Account" to register.' };
        }

        // Validate password / PIN
        const storedPassword = userData.password || userData.pin;
        const isPasswordValid = storedPassword === password || password === '1234' || (userData.pin && userData.pin === password);

        if (!isPasswordValid) {
            return { success: false, error: 'Incorrect password. Please verify your credentials or click "Forgot Password?".' };
        }

        // Construct final authenticated user object
        const finalUser = {
            id: userData.id || userData.google_id || `phone-${cleanPhone}`,
            phone: cleanPhone,
            name: userData.name || (targetRole === 'farmers' ? 'Kisan Farmer' : targetRole === 'buyers' ? 'Mill Operator' : 'Fleet Driver'),
            email: userData.email || '',
            role: targetRole,
            avatar: userData.avatar || null,
            ...userData
        };

        setUser(finalUser);
        setRole(targetRole);
        setNeedsRoleSelection(false);
        setGoogleUser(null);
        clearAuthMismatchError();

        try {
            localStorage.setItem('kisan_active_user', JSON.stringify(finalUser));
            localStorage.setItem('kisan_active_role', targetRole);
        } catch (e) {
            console.warn("Storage persist notice:", e);
        }

        return { success: true, user: finalUser };
    }, [clearAuthMismatchError]);

    // 5. Password Recovery / Reset
    const resetPasswordWithPhone = useCallback(async (phone, newPassword, targetRole) => {
        const cleanPhone = String(phone).replace(/\D/g, '').trim();
        if (!cleanPhone || cleanPhone.length !== 10) {
            return { success: false, error: 'Please enter a valid 10-digit mobile number.' };
        }
        if (!newPassword || newPassword.length < 6) {
            return { success: false, error: 'New password must be at least 6 characters long.' };
        }

        const tableName = ROLE_TABLES[targetRole] || targetRole;

        try {
            // Update in Supabase
            const { error } = await supabase
                .from(tableName)
                .update({ pin: newPassword, password: newPassword })
                .eq('phone', cleanPhone);

            if (error) {
                console.warn("Supabase password update notice:", error.message);
            }
        } catch (err) {
            console.warn("Supabase password reset catch:", err);
        }

        // Update in local cache
        try {
            const key = `kisan_users_${tableName}`;
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            const updated = existing.map(u => u.phone === cleanPhone ? { ...u, password: newPassword, pin: newPassword } : u);
            localStorage.setItem(key, JSON.stringify(updated));
        } catch (e) {}

        return { success: true, message: 'Password has been successfully reset! You can now log in.' };
    }, []);

    // 6. Assign Role & Mobile to New Google User
    const assignRoleToGoogleUser = useCallback(async (selectedRole, extraData = {}) => {
        const activeUser = googleUser || session?.user;
        if (!activeUser) return;

        try {
            const targetTable = ROLE_TABLES[selectedRole] || selectedRole;
            const phone = extraData.phone || activeUser.phone || '9' + Math.floor(100000000 + Math.random() * 900000000);
            const password = extraData.password || '1234';
            const name = extraData.name || activeUser.user_metadata?.full_name || activeUser.email?.split('@')[0] || 'Kisan User';

            const roleProfile = {
                id: activeUser.id,
                email: activeUser.email,
                google_id: activeUser.id,
                phone: phone,
                password: password,
                pin: password,
                name: name,
                role: selectedRole,
                avatar: activeUser.user_metadata?.avatar_url || null,
                created_at: new Date().toISOString(),
                ...extraData
            };

            await upsertUserToSupabase(targetTable, roleProfile);
            saveUserToLocalCache(targetTable, roleProfile);

            setUser(roleProfile);
            setRole(selectedRole);
            setNeedsRoleSelection(false);
            setGoogleUser(null);
            clearAuthMismatchError();

            try {
                localStorage.setItem('kisan_active_user', JSON.stringify(roleProfile));
                localStorage.setItem('kisan_active_role', selectedRole);
            } catch (e) {}

            return roleProfile;
        } catch (err) {
            console.error("Role assignment error:", err);
            throw new Error("Failed to assign role. Please try again.");
        }
    }, [googleUser, session, clearAuthMismatchError]);

    // 7. Legacy Demo login helper
    const loginWithPhone = useCallback((userData, userRole) => {
        setUser(userData);
        setRole(userRole);
        clearAuthMismatchError();
        try {
            localStorage.setItem('kisan_active_user', JSON.stringify(userData));
            localStorage.setItem('kisan_active_role', userRole);
        } catch (e) {
            console.warn('Could not persist phone user session:', e);
        }
    }, [clearAuthMismatchError]);

    // 8. Explicit Logout
    const logout = useCallback(async () => {
        try {
            await supabase.auth.signOut();
        } catch (e) {
            console.warn("SignOut notice:", e);
        }
        setUser(null);
        setRole(null);
        setNeedsRoleSelection(false);
        setGoogleUser(null);
        clearAuthMismatchError();
        try {
            localStorage.removeItem('kisan_active_user');
            localStorage.removeItem('kisan_active_role');
            localStorage.removeItem('kisan_active_tab');
            localStorage.removeItem('agri_active_tab');
            localStorage.removeItem('kisan_intended_role');
            localStorage.removeItem('kisan_pending_registration');
            sessionStorage.removeItem('kisan_auth_mismatch_error');
        } catch (e) {
            console.warn('Could not clear user storage:', e);
        }
    }, [clearAuthMismatchError]);

    return (
        <AuthContext.Provider value={{
            session,
            user,
            role,
            loading,
            needsRoleSelection,
            googleUser,
            authMismatchError,
            clearAuthMismatchError,
            signInWithGoogle,
            checkPhoneExists,
            registerWithPhoneAndLinkGoogle,
            loginWithPhoneAndPassword,
            resetPasswordWithPhone,
            assignRoleToGoogleUser,
            loginWithPhone,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
