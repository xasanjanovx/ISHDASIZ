'use client';

/**
 * AI Job Card - Displays jobs returned by AI assistant
 * 
 * Different from regular JobCard:
 * - Shows match_score and reason_fit
 * - Uses simplified data format from AI
 * - Shows missing_skills and advice
 */

import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Building2, Phone, MessageCircle } from '@/components/ui/icons';

interface AIJobCardProps {
    job: {
        id: string;
        title: string;
        company: string;
        salary: string;
        location?: string;
        region?: string;
        district?: string;
        work_mode?: string;
        contact_telegram?: string;
        contact_phone?: string;
        is_popular?: boolean;
        match_score?: number;
        reason_fit?: string;
        missing_skills?: string[];
        advice?: string;
    };
}

export function AIJobCard({ job }: AIJobCardProps) {
    const { lang } = useLanguage();

    // Score color
    const scoreColor = job.match_score
        ? job.match_score >= 80 ? 'bg-emerald-500'
            : job.match_score >= 60 ? 'bg-yellow-500'
                : 'bg-slate-400'
        : 'bg-slate-300';

    return (
        <Card className="group relative hover:shadow-lg transition-all duration-200 overflow-hidden border-slate-200 hover:border-blue-300 bg-white">
            {/* Score indicator */}
            {job.match_score && (
                <div className={`absolute top-0 right-0 ${scoreColor} text-white text-xs font-bold px-2 py-1 rounded-bl-lg`}>
                    {job.match_score}%
                </div>
            )}

            <Link href={`/jobs/${job.id}`} className="block">
                <CardContent className="p-4">
                    {/* Header */}
                    <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 text-sm">
                                {job.title || 'Nomsiz vakansiya'}
                            </h3>
                            <p className="text-sm text-slate-600 line-clamp-1">
                                {job.company || 'Nomalum kompaniya'}
                            </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                            <div className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                                {job.salary || 'Kelishiladi'}
                            </div>
                        </div>
                    </div>

                    {/* Location & Work Mode */}
                    <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
                        {(job.location || job.region) && (
                            <div className="flex items-center gap-1 text-slate-500">
                                <MapPin className="w-3 h-3" />
                                <span>{job.location || job.region}</span>
                            </div>
                        )}
                        {job.work_mode && (
                            <Badge variant="secondary" className="text-xs py-0">
                                {job.work_mode}
                            </Badge>
                        )}
                    </div>

                    {/* AI Analysis */}
                    {job.reason_fit && (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 mb-2 text-xs text-blue-800">
                            <span className="font-medium">Mos keladi:</span> {job.reason_fit}
                        </div>
                    )}

                    {job.missing_skills && job.missing_skills.length > 0 && (
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-2 mb-2 text-xs text-amber-800">
                            <span className="font-medium">Yetishmaydi:</span> {job.missing_skills.join(', ')}
                        </div>
                    )}

                    {/* Contacts */}
                    <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                        {job.contact_telegram && (
                            <a
                                href={`https://t.me/${job.contact_telegram.replace('@', '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                            >
                                <MessageCircle className="w-3 h-3" />
                                Telegram
                            </a>
                        )}
                        {job.contact_phone && (
                            <a
                                href={`tel:${job.contact_phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-700"
                            >
                                <Phone className="w-3 h-3" />
                                {job.contact_phone}
                            </a>
                        )}
                        {!job.contact_telegram && !job.contact_phone && (
                            <span className="text-xs text-slate-400">
                                {lang === 'uz' ? 'Batafsil' : 'Подробнее'} →
                            </span>
                        )}
                    </div>
                </CardContent>
            </Link>
        </Card>
    );
}
