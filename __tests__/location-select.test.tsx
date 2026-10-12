import React from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {LocationSelect} from '@/components/ui/location-select';
const mockRequests:any[]=[];
jest.mock('@/contexts/language-context',()=>({useLanguage:()=>({lang:'ru'})}));
jest.mock('@/lib/supabase',()=>({supabase:{from:(table:string)=>{
 let resolve:any;const promise=new Promise(r=>{resolve=r;});const record:any={table,resolve};mockRequests.push(record);const chain:any={};
 for(const method of ['select','order'])chain[method]=()=>chain;
 chain.eq=(_key:string,value:any)=>{record.region=value;return chain;};chain.abortSignal=(signal:AbortSignal)=>{record.signal=signal;return chain;};chain.then=promise.then.bind(promise);return chain;
}}}));
// Use native selects to exercise reference loading and races independently of Radix.
jest.mock('@/components/ui/select',()=>{
 const R=require('react');const Trigger=()=>null,Content=({children}:any)=>children;
 return {SelectTrigger:Trigger,SelectContent:Content,SelectValue:()=>null,SelectItem:({value,children}:any)=><option value={value}>{children}</option>,Select:({children,value,disabled,onValueChange}:any)=>{
  const parts=R.Children.toArray(children);const trigger=parts.find((child:any)=>child.type===Trigger);const content=parts.find((child:any)=>child.type===Content);
  return <select id={trigger.props.id} aria-label={trigger.props['aria-label']} value={value} disabled={disabled} onChange={event=>onValueChange(event.target.value)}><option value=""/>{content.props.children}</select>;
 }};
});
const regions:any=[{id:1,name_ru:'Первый',name_uz:'Birinchi'},{id:2,name_ru:'Второй',name_uz:'Ikkinchi'}];
const props={selectedRegion:1,selectedDistrict:null,onRegionChange:jest.fn(),onDistrictChange:jest.fn(),regions};
beforeEach(()=>mockRequests.splice(0));afterEach(cleanup);
test('a late district response cannot replace the selected region or show old options while new data loads',async()=>{
 const view=render(<LocationSelect {...props}/>);const first=mockRequests[0];view.rerender(<LocationSelect {...props} selectedRegion={2}/>);expect(first.signal.aborted).toBe(true);expect(screen.getByLabelText('Район / Город')).toBeDisabled();
 await act(async()=>mockRequests[1].resolve({data:[{id:20,name_ru:'Новый район',region_id:2}],error:null}));expect(screen.getByRole('option',{name:'Новый район'})).toBeInTheDocument();
 await act(async()=>first.resolve({data:[{id:10,name_ru:'Старый район',region_id:1}],error:null}));expect(screen.queryByRole('option',{name:'Старый район'})).not.toBeInTheDocument();
});
test('district loading failures are visible and retry cannot submit the surrounding profile form',async()=>{
 const submit=jest.fn((event:any)=>event.preventDefault());render(<form onSubmit={submit}><LocationSelect {...props}/></form>);
 await act(async()=>mockRequests[0].resolve({error:{code:'08006'},data:null}));expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить районы.');
 fireEvent.click(screen.getByRole('button',{name:'Повторить районы'}));expect(submit).not.toHaveBeenCalled();await act(async()=>mockRequests[1].resolve({data:[{id:10,name_ru:'Район',region_id:1}],error:null}));expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(screen.getByLabelText('Район / Город')).not.toBeDisabled();
});
test('region errors offer retry and newly supplied region references appear immediately',async()=>{
 const view=render(<LocationSelect {...props} regions={undefined} selectedRegion={null}/>);await act(async()=>mockRequests[0].resolve({error:{code:'08006'},data:null}));fireEvent.click(screen.getByRole('button',{name:'Повторить регионы'}));expect(mockRequests).toHaveLength(2);
 view.rerender(<LocationSelect {...props} regions={regions} selectedRegion={null}/>);expect(screen.getByRole('option',{name:'Второй'})).toBeInTheDocument();expect(mockRequests[1].signal.aborted).toBe(true);expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
test('all regions disables district selection and never requests districts',()=>{
 render(<LocationSelect {...props} selectedRegion="all" showAllOption/>);expect(mockRequests).toHaveLength(0);expect(screen.getByLabelText('Район / Город')).toBeDisabled();
});
