import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';

const AuthContext = createContext(null);

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
    const isProcessingRef = React.useRef(false);

    // Process authenticated Supabase user
    const processSupabaseUser = async (sbUser) => {
        if (!sbUser) {
            setUser(null);
            setRole(null);
            setNeedsRoleSelection(false);
            setGoogleUser(null);
            setLoading(false);
            return;
        }

        // Prevent duplicate concurrent executions from getSession and onAuthStateChange
        if (isProcessingRef.current) {
            return;
        }
        isProcessingRef.current = true;

        try {
            // 1. Check if user clicked a specific portal before OAuth (from URL or localStorage)
            let urlRole = null;
            if (typeof window !== 'undefined') {
                if (window.location.pathname.startsWith('/login/')) {
                    urlRole = window.location.pathname.split('/login/')[1]?.split(/[?#/]/)[0];
                }
                const params = new URLSearchParams(window.location.search);
                if (params.get('role')) urlRole = params.get('role');
            }
            let intendedRole = urlRole;
            try {
                if (!intendedRole) {
                    intendedRole = localStorage.getItem('kisan_intended_role');
                }
                if (intendedRole) {
                    localStorage.removeItem('kisan_intended_role');
                }
            } catch (e) {
                console.warn(e);
            }

            // 2. Derive user role from intended role or user_metadata
            let userRole = intendedRole || sbUser.user_metadata?.role || null;

            // FAST-PATH: If role is already known from portal selection or metadata,
            // resolve user immediately so navigation doesn't wait 3 seconds for DB queries!
            if (userRole) {
                const immediateUser = {
                    id: sbUser.id,
                    email: sbUser.email,
                    name: sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0] || 'Kisan Member',
                    phone: sbUser.phone || sbUser.user_metadata?.phone || '',
                    role: userRole,
                    avatar: sbUser.user_metadata?.avatar_url || null,
                };

                setUser(immediateUser);
                setRole(userRole);
                setNeedsRoleSelection(false);
                setGoogleUser(null);
                setLoading(false);

                try {
                    localStorage.setItem('kisan_active_user', JSON.stringify(immediateUser));
                    localStorage.setItem('kisan_active_role', userRole);
                } catch (e) {
                    console.warn('Could not persist initial user session:', e);
                }

                // Asynchronously sync user metadata and database profile in the background
                (async () => {
                    try {
                        if (intendedRole && sbUser.user_metadata?.role !== intendedRole) {
                            supabase.auth.updateUser({ data: { role: intendedRole } }).catch(() => {});
                        }

                        const targetTable = userRole === 'transporters' ? 'transport_providers' : userRole;
                        if (sbUser.email) {
                            const { data: profileData } = await supabase.from(targetTable).select('*').eq('email', sbUser.email).maybeSingle();
                            if (profileData) {
                                setUser(prev => ({ ...prev, ...profileData }));
                                try {
                                    localStorage.setItem('kisan_active_user', JSON.stringify({ ...immediateUser, ...profileData }));
                                } catch {}
                            } else {
                                const newProfile = {
                                    email: sbUser.email,
                                    phone: immediateUser.phone || '9' + Math.floor(100000000 + Math.random() * 900000000),
                                    pin: '1234',
                                    name: immediateUser.name,
                                    role: userRole,
                                    created_at: new Date().toISOString()
                                };
                                await supabase.from(targetTable).upsert(newProfile);
                            }
                        }
                    } catch (bgErr) {
                        console.warn("Background profile sync notice:", bgErr);
                    }
                })();

                return;
            }

            // 3. If no role was pre-selected, query all tables in PARALLEL (single network round-trip)
            if (sbUser.email) {
                try {
                    const [farmerRes, buyerRes, transRes] = await Promise.all([
                        supabase.from('farmers').select('*').eq('email', sbUser.email).maybeSingle(),
                        supabase.from('buyers').select('*').eq('email', sbUser.email).maybeSingle(),
                        supabase.from('transport_providers').select('*').eq('email', sbUser.email).maybeSingle()
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

                    if (matchedRole) {
                        const finalUser = {
                            id: sbUser.id,
                            email: sbUser.email,
                            name: sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0] || 'Kisan Member',
                            phone: sbUser.phone || sbUser.user_metadata?.phone || '',
                            role: matchedRole,
                            avatar: sbUser.user_metadata?.avatar_url || null,
                            ...matchedProfile
                        };

                        setUser(finalUser);
                        setRole(matchedRole);
                        setNeedsRoleSelection(false);
                        setGoogleUser(null);
                        setLoading(false);

                        try {
                            localStorage.setItem('kisan_active_user', JSON.stringify(finalUser));
                            localStorage.setItem('kisan_active_role', matchedRole);
                        } catch (e) {
                            console.warn(e);
                        }
                        return;
                    }
                } catch (lookupErr) {
                    console.warn("Parallel profile lookup error:", lookupErr);
                }
            }

            // 4. Only if absolutely no role could be inferred, prompt role picker modal
            setGoogleUser(sbUser);
            setNeedsRoleSelection(true);
            setLoading(false);
        } finally {
            isProcessingRef.current = false;
        }
    };

    useEffect(() => {
        let isMounted = true;

        // Safety fallback: ensure loading is cleared after 6 seconds max
        const safetyTimer = setTimeout(() => {
            if (isMounted) setLoading(false);
        }, 6000);

        // Clear OAuth error if present in URL
        if (typeof window !== 'undefined') {
            const hash = window.location.hash || '';
            const search = window.location.search || '';
            if (hash.includes('error=') || search.includes('error=')) {
                try {
                    localStorage.removeItem('kisan_intended_role');
                } catch {}
                setLoading(false);
            }
        }

        // Initialize Supabase Auth Session (Source of Truth)
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

    // Trigger Supabase Google OAuth
    // Stores the selected portal role so that returning users go straight to that portal
    const signInWithGoogle = useCallback(async (intendedRole = null) => {
        try {
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
                throw new Error("Google sign-in failed. Please try again.");
            }
        } catch (err) {
            console.error("Google sign-in error:", err);
            throw new Error("Google sign-in failed. Please try again.");
        }
    }, []);

    // Assign Role to New Google User (if needed)
    const assignRoleToGoogleUser = useCallback(async (selectedRole, extraData = {}) => {
        const activeUser = googleUser || session?.user;
        if (!activeUser) {
            return;
        }

        try {
            // 1. Update Supabase Auth user metadata
            await supabase.auth.updateUser({
                data: {
                    role: selectedRole,
                    ...extraData
                }
            });

            // 2. Upsert profile into the respective role table in Supabase
            const tableName = selectedRole === 'transporters' ? 'transport_providers' : selectedRole;
            const phone = extraData.phone || activeUser.phone || '9' + Math.floor(100000000 + Math.random() * 900000000);
            const name = extraData.name || activeUser.user_metadata?.full_name || activeUser.email?.split('@')[0] || 'Kisan User';

            const roleProfile = {
                email: activeUser.email,
                phone: phone,
                pin: '1234',
                name: name,
                role: selectedRole,
                created_at: new Date().toISOString(),
                ...extraData
            };

            try {
                await supabase.from(tableName).upsert(roleProfile);
            } catch (tableErr) {
                console.warn(`Supabase upsert to ${tableName} notice:`, tableErr);
            }

            const completeUser = {
                id: activeUser.id,
                email: activeUser.email,
                ...roleProfile
            };

            setUser(completeUser);
            setRole(selectedRole);
            setNeedsRoleSelection(false);
            setGoogleUser(null);
            return completeUser;
        } catch (err) {
            console.error("Role assignment error:", err);
            throw new Error("Failed to assign role. Please try again.");
        }
    }, [googleUser, session]);

    // Phone / PIN Login
    const loginWithPhone = useCallback((userData, userRole) => {
        setUser(userData);
        setRole(userRole);
        try {
            localStorage.setItem('kisan_active_user', JSON.stringify(userData));
            localStorage.setItem('kisan_active_role', userRole);
        } catch (e) {
            console.warn('Could not persist phone user session:', e);
        }
    }, []);

    // Explicit Logout
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
        try {
            localStorage.removeItem('kisan_active_user');
            localStorage.removeItem('kisan_active_role');
            localStorage.removeItem('kisan_active_tab');
            localStorage.removeItem('agri_active_tab');
            localStorage.removeItem('kisan_intended_role');
        } catch (e) {
            console.warn('Could not clear user storage:', e);
        }
    }, []);

    return (
        <AuthContext.Provider value={{
            session,
            user,
            role,
            loading,
            needsRoleSelection,
            googleUser,
            signInWithGoogle,
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
