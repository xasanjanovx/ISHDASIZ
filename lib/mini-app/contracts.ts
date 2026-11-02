import { z } from 'zod';
import { AccountError } from '@/lib/auth/account';
const text = (max = 2000) => z.string().trim().max(max).optional().default('');
const amount = z.union([z.string().regex(/^[0-9 ]*$/).max(14), z.number().int().min(0).max(2147483647)]).optional().default('');
export const miniFormSchema = z.object({
  position: text(160), company: text(255), name: text(255), birthdate: text(10), gender: text(30),
  region: text(100), district: text(100), city: text(100), regionId: z.number().int().positive().nullable().optional(), districtId: z.number().int().positive().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(), address: text(1000), landmark: text(300),
  coordinates: z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]).nullable().optional(),
  coordinateAccuracyM: z.number().finite().nonnegative().nullable().optional(), locationConfirmedAt: text(50).nullable().transform(v=>v||''),
  employment: text(40), workMode: text(40), days: text(40), hours: text(100), experience: text(40), education: text(60),
  special: text(200), languages: text(300), benefits: text(1000), benefitDetails: text(2000), description: text(10000), duties: text(5000), requirements: text(5000),
  about: text(10000), skills: text(2000), workplace: text(255), worktitle: text(255), workstart: text(7), workend: text(7), workCurrent: z.boolean().optional(),
  school: text(255), specialty: text(255), schoolstart: text(4), schoolend: text(4), schoolCurrent: z.boolean().optional(),
  salaryMin: amount, salaryMax: amount, salaryPeriod: z.enum(['month','shift','hour','service']).default('month'), salaryCurrency: z.literal('UZS').default('UZS'),
  salaryNegotiable: z.boolean().default(false), shiftHours: z.union([text(5),z.number().finite()]).optional(), salaryScope: text(255),
  ageMin: amount, ageMax: amount, hr: text(255), phone: text(30), telegram: text(40),
});
export type MiniForm = z.infer<typeof miniFormSchema>;
export const miniRecordSchema=z.object({id:z.string().uuid(),kind:z.enum(['vacancy','resume']),form:miniFormSchema});
export const miniNumber=(v:unknown)=>v===''||v==null?null:Number(String(v).replace(/ /g,''));
const options:Record<string,Record<string,string>>={
 employment:{'To‘liq kun':'full_time','Yarim kun':'part_time','Shartnoma':'contract','Amaliyot':'internship'},
 workMode:{'Ish joyida':'onsite','Masofaviy':'remote','Gibrid':'hybrid'},
 experience:{'Tajribasiz':'no_experience','1 yil':'1_year','1–3 yil':'1_3_years','3–5 yil':'3_5_years','5+ yil':'5_plus'},
 education:{'Ahamiyatsiz':'any','O‘rta':'secondary','O‘rta maxsus':'vocational','Tugallanmagan oliy':'secondary','Oliy':'higher','Magistr':'master'},
 gender:{'Ahamiyatsiz':'any','Ayol':'female','Erkak':'male'},
};
export const miniOption=(key:string,value:string)=>options[key]?.[value]||value;
export function miniValidate(kind:'vacancy'|'resume',f:MiniForm){
 const required=kind==='vacancy'?['position','company','region','district','hr','phone','description','employment','workMode','days']:['position','name','birthdate','gender','region','district','phone','about','experience','education','employment','workMode'];
 for(const key of required)if(!String(f[key as keyof MiniForm]||'').trim())throw new AccountError(400,`${key}: maydonni to‘ldiring`);
 if(f.position.length<3||kind==='vacancy'&&(f.company.length<3||f.hr.length<3||f.description.length<3)||kind==='resume'&&(f.name.match(/\p{L}/gu)||[]).length<3)throw new AccountError(400,'Ism, lavozim va matnlarni to‘liq kiriting');
 if(!f.regionId||!f.districtId)throw new AccountError(400,'Tuman yoki shaharni qidiruv ro‘yxatidan tanlang');
 if(kind==='vacancy'&&f.workMode!=='Masofaviy'&&(!f.coordinates||!f.locationConfirmedAt))throw new AccountError(400,'Ish joyini xaritada tasdiqlang');
 if(kind==='vacancy'&&f.days!=='Moslashuvchan'&&!f.hours)throw new AccountError(400,'Ish vaqtini kiriting');
 if(kind==='resume'&&(!f.skills||!f.languages))throw new AccountError(400,'Ko‘nikma va tillarni kiriting');
 if(f.salaryPeriod==='shift'&&(!Number.isFinite(Number(f.shiftHours))||Number(f.shiftHours)<1||Number(f.shiftHours)>24))throw new AccountError(400,'Smena davomiyligini kiriting');
 if(f.salaryPeriod==='service'&&!f.salaryScope)throw new AccountError(400,'Bir xizmat hajmini kiriting');
 if(!f.salaryNegotiable){const a=miniNumber(f.salaryMin),b=miniNumber(f.salaryMax);if(!(a&&a>0)&&!(b&&b>0)||a&&b&&a>b)throw new AccountError(400,'To‘lov oralig‘ini tekshiring');}
}
export function miniNative(kind:'vacancy'|'resume',f:MiniForm){
 const employment_type=miniOption('employment',f.employment),education_level=miniOption('education',f.education),gender=miniOption('gender',f.gender);
 const salaryMin=f.salaryNegotiable?null:miniNumber(f.salaryMin),salaryMax=f.salaryNegotiable?null:miniNumber(f.salaryMax);
 const skills=f.skills.split(',').map(s=>s.trim()).filter(Boolean),names=f.languages.split(',').map(s=>s.trim()).filter(Boolean);
 const periodLabel={month:'oyiga',shift:'smenaga',hour:'soatiga',service:'xizmat uchun'}[f.salaryPeriod];
 if(kind==='vacancy')return {title_uz:f.position,title_ru:f.position,company_name:f.company,description_uz:[f.description,f.duties,`Ish tartibi: ${[f.days,f.hours].filter(Boolean).join(' · ')}`,`To‘lov: ${f.salaryNegotiable?'kelishiladi':periodLabel}${f.salaryPeriod==='shift'?` (${f.shiftHours} soat)`:f.salaryPeriod==='service'?` — ${f.salaryScope}`:''}`,f.special?`${f.special} uchun ham mos`:''].filter(Boolean).join('\n\n'),description_ru:'',requirements_uz:f.requirements,requirements_ru:'',
  benefits:[f.benefits,f.benefitDetails].filter(Boolean).join('\n'),category_id:f.categoryId,region_id:f.regionId,district_id:f.districtId,
  salary_min:salaryMin,salary_max:salaryMax,employment_type,work_mode:miniOption('workMode',f.workMode),payment_type:f.salaryNegotiable?1:f.salaryPeriod==='service'?2:3,
  experience:miniOption('experience',f.experience),education_level,gender,age_min:miniNumber(f.ageMin),age_max:miniNumber(f.ageMax),
  is_for_students:f.special.includes('Talabalar'),is_for_disabled:/Nogironligi/.test(f.special),is_for_women:false,skills,languages:names.map(language=>({language,level:'unspecified'})),
  latitude:f.coordinates?.[0]??null,longitude:f.coordinates?.[1]??null,address:[f.address,f.landmark].filter(Boolean).join('; '),contact_phone:f.phone,contact_telegram:f.telegram};
 const langKeys:Record<string,string>={'O‘zbek':'uzbek','Rus':'russian','Ingliz':'english'};
 const year=(v:string)=>/^\d{4}$/.test(v)?`${v}-01`:v;
 return {title:f.position,full_name:f.name,birth_date:f.birthdate,phone:f.phone,about:f.about,category_id:f.categoryId,region_id:f.regionId,district_id:f.districtId,
  experience:({'1–3 yil':'3_years','3–5 yil':'5_years','5+ yil':'10_years','1 yil':'1_year'} as Record<string,string>)[f.experience]||'no_experience',education_level,gender,employment_type,
  experience_details:f.experience==='Tajribasiz'?[]:[{company:f.workplace,position:f.worktitle,start_date:year(f.workstart),end_date:f.workCurrent?'current':year(f.workend),is_current:!!f.workCurrent,description:''}],
  education:['higher','master'].includes(education_level)?[{institution:f.school,field:f.specialty,degree:education_level,start_year:f.schoolstart,end_year:f.schoolCurrent?'current':f.schoolend}]:[],
  languages:names.filter(n=>langKeys[n]).map(n=>({name:langKeys[n],level:'unspecified'})),skills,expected_salary_min:salaryMin,expected_salary_max:salaryMax,status:'active',is_public:true};
}
