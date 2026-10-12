'use client';
import {AdminGate,AdminLayout,useAdminApi} from './admin-gate';
import {VacancyEditor} from '@/components/profile/vacancy-editor';
import {VacancyList} from '@/components/profile/own-vacancies';
export function AdminVacanciesPage(){return <AdminGate><AdminLayout><List/></AdminLayout></AdminGate>;}
function List(){const api=useAdminApi();return <VacancyList api={api} basePath="/api/admin/jobs" listPath="/admin/jobs" admin/>;}
export function AdminVacancyEditorPage({id}:{id?:string}){return <AdminGate><AdminLayout><Editor key={id||'new'} id={id}/></AdminLayout></AdminGate>;}
function Editor({id}:{id?:string}){const api=useAdminApi();return <VacancyEditor id={id} api={api} basePath="/api/admin/jobs" listPath="/admin/jobs" admin/>;}
