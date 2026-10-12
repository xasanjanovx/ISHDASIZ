import {VacancyEditorPage} from '@/components/profile/vacancy-editor';
export default async function Page({params}:{params:Promise<{id:string}>}){return <VacancyEditorPage id={(await params).id}/>;}
