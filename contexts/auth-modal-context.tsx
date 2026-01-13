'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export type UserRole = 'seeker' | 'employer' | null;
export type AuthStep = 'role' | 'auth' | 'sms' | 'password_create' | 'password_login' | 'role_select_login' | 'success';

interface ProfileFlags {
    has_job_seeker_profile: boolean;
    has_employer_profile: boolean;
}

interface AuthModalContextType {
    isOpen: boolean;
    openModal: () => void;
    closeModal: () => void;
    userRole: UserRole;
    setUserRole: (role: UserRole) => void;
    step: AuthStep;
    setStep: (step: AuthStep) => void;
    phoneNumber: string;
    setPhoneNumber: (phone: string) => void;
    isNewUser: boolean;
    setIsNewUser: (isNew: boolean) => void;
    isPasswordReset: boolean;
    setIsPasswordReset: (reset: boolean) => void;
    profileFlags: ProfileFlags;
    setProfileFlags: (flags: ProfileFlags) => void;
    pendingUserId: string | null;
    setPendingUserId: (id: string | null) => void;
    reset: () => void;
}

const AuthModalContext = createContext<AuthModalContextType | undefined>(undefined);

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [userRole, setUserRole] = useState<UserRole>(null);
    const [step, setStep] = useState<AuthStep>('role');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isNewUser, setIsNewUser] = useState(false);
    const [isPasswordReset, setIsPasswordReset] = useState(false);
    const [profileFlags, setProfileFlags] = useState<ProfileFlags>({
        has_job_seeker_profile: false,
        has_employer_profile: false,
    });
    const [pendingUserId, setPendingUserId] = useState<string | null>(null);

    const openModal = useCallback(() => {
        setIsOpen(true);
    }, []);

    const closeModal = useCallback(() => {
        setIsOpen(false);
        // Reset after animation
        setTimeout(() => {
            setStep('role');
            setUserRole(null);
            setPhoneNumber('');
            setIsNewUser(false);
            setIsPasswordReset(false);
            setProfileFlags({ has_job_seeker_profile: false, has_employer_profile: false });
            setPendingUserId(null);
        }, 300);
    }, []);

    const reset = useCallback(() => {
        setStep('role');
        setUserRole(null);
        setPhoneNumber('');
        setIsNewUser(false);
        setIsPasswordReset(false);
        setProfileFlags({ has_job_seeker_profile: false, has_employer_profile: false });
        setPendingUserId(null);
    }, []);

    return (
        <AuthModalContext.Provider
            value={{
                isOpen,
                openModal,
                closeModal,
                userRole,
                setUserRole,
                step,
                setStep,
                phoneNumber,
                setPhoneNumber,
                isNewUser,
                setIsNewUser,
                isPasswordReset,
                setIsPasswordReset,
                profileFlags,
                setProfileFlags,
                pendingUserId,
                setPendingUserId,
                reset,
            }}
        >
            {children}
        </AuthModalContext.Provider>
    );
}

export function useAuthModal() {
    const context = useContext(AuthModalContext);
    if (!context) {
        throw new Error('useAuthModal must be used within AuthModalProvider');
    }
    return context;
}
