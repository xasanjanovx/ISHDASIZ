import {AdminVacancyEditorPage} from '@/components/admin/admin-vacancies';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <AdminVacancyEditorPage id={id}/>;}
