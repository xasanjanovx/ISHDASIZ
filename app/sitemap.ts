import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const baseUrl = 'https://www.ishdasiz.uz';

// Create a separate client for sitemap generation to avoid lazy init issues
function getSupabaseClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        return null;
    }

    return createClient(supabaseUrl, supabaseAnonKey);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const supabase = getSupabaseClient();

    // Static pages
    const staticPages: MetadataRoute.Sitemap = [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1,
        },
        {
            url: `${baseUrl}/jobs`,
            lastModified: new Date(),
            changeFrequency: 'hourly',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/resumes`,
            lastModified: new Date(),
            changeFrequency: 'hourly',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/map`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/auth/login`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.5,
        },
        {
            url: `${baseUrl}/auth/register`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.5,
        },
    ];

    // If no supabase client, return only static pages
    if (!supabase) {
        return staticPages;
    }

    // Fetch active jobs
    const { data: jobs } = await supabase
        .from('jobs')
        .select('id, updated_at')
        .eq('status', 'active')
        .order('updated_at', { ascending: false });

    const jobPages: MetadataRoute.Sitemap = (jobs || []).map((job) => ({
        url: `${baseUrl}/jobs/${job.id}`,
        lastModified: new Date(job.updated_at),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
    }));

    // Fetch active resumes
    const { data: resumes } = await supabase
        .from('resumes')
        .select('id, updated_at')
        .eq('status', 'active')
        .order('updated_at', { ascending: false });

    const resumePages: MetadataRoute.Sitemap = (resumes || []).map((resume) => ({
        url: `${baseUrl}/resumes/${resume.id}`,
        lastModified: new Date(resume.updated_at),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
    }));

    return [...staticPages, ...jobPages, ...resumePages];
}
