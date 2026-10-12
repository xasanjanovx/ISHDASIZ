'use client';
import type {ReactNode} from 'react';
import {ProfileLayout} from './profile-layout';
export function VacancyLayout({admin,children}:{admin:boolean;children:ReactNode}){return admin?<>{children}</>:<ProfileLayout userType="employer">{children}</ProfileLayout>;}
