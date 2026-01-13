import { supabase } from './supabase';
import { Region, District } from '@/types/database';

export async function getRegions(): Promise<Region[]> {
    const { data, error } = await supabase
        .from('regions')
        .select('*')
        .order('name_uz', { ascending: true });

    if (error) {
        console.error('Error fetching regions:', error);
        return [];
    }
    return data || [];
}

export async function getDistricts(regionId: number): Promise<District[]> {
    const { data, error } = await supabase
        .from('districts')
        .select('*')
        .eq('region_id', regionId)
        .order('name_uz', { ascending: true });

    if (error) {
        console.error('Error fetching districts:', error);
        return [];
    }
    return data || [];
}

export async function getAllDistricts(): Promise<District[]> {
    const { data, error } = await supabase
        .from('districts')
        .select('*')
        .order('name_uz', { ascending: true });

    if (error) {
        console.error('Error fetching districts:', error);
        return [];
    }
    return data || [];
}

export async function getDistrictById(districtId: string | number): Promise<District | null> {
    const { data, error } = await supabase
        .from('districts')
        .select('*')
        .eq('id', districtId)
        .maybeSingle();

    if (error) {
        console.error('Error fetching district:', error);
        return null;
    }
    return data;
}
