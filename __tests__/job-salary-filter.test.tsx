import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { JobSalaryFilter } from '@/components/jobs/job-salary-filter';
import type { JobSalaryRange } from '@/lib/search-ranges';
const changed = jest.fn();
jest.mock('@/contexts/language-context', () => ({ useLanguage: () => ({ lang: 'ru', t: { filters: { salary: 'Зарплата' } } }) }));
function Harness({ initial = [0, undefined] }: { initial?: JobSalaryRange }) {
 const [value, setValue] = useState<JobSalaryRange>(initial);
 return <><JobSalaryFilter value={value} onChange={range => { changed(range); setValue(range); }} /><button onClick={() => setValue([0, undefined])}>Очистить</button></>;
}
beforeEach(() => changed.mockClear());
test('five million with pasted separators applies as a minimum with no hidden maximum', () => {
 render(<Harness />); fireEvent.change(screen.getByLabelText('Зарплата от'), { target: { value: '5 000 000' } });
 expect(changed).toHaveBeenLastCalledWith([5000000, undefined]); expect(screen.getByLabelText('Зарплата до')).toHaveValue('');
});
test('inverted or malformed edits stay visible with an error and never reset the applied search', () => {
 render(<Harness initial={[0, 1000000]} />);
 fireEvent.change(screen.getByLabelText('Зарплата от'), { target: { value: '5000000' } });
 expect(screen.getByRole('alert')).toHaveTextContent('ещё не применено'); expect(changed).not.toHaveBeenCalled();
 expect(screen.getByLabelText('Зарплата от')).toHaveValue('5000000');
 fireEvent.change(screen.getByLabelText('Зарплата до'), { target: { value: '10000000' } });
 expect(changed).toHaveBeenLastCalledWith([5000000, 10000000]); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Зарплата от'), { target: { value: '-5' } }); expect(changed).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByText('Очистить')); expect(screen.queryByRole('alert')).not.toBeInTheDocument(); expect(screen.getByLabelText('Зарплата от')).toHaveValue('');
});
test('twenty million remains visible, larger amounts and clearing the upper bound work', () => {
 render(<Harness initial={[5000000, 20000000]} />); expect(screen.getByLabelText('Зарплата до')).toHaveValue('20000000');
 fireEvent.change(screen.getByLabelText('Зарплата до'), { target: { value: '40000000' } });
 fireEvent.change(screen.getByLabelText('Зарплата от'), { target: { value: '25000000' } });
 expect(changed).toHaveBeenLastCalledWith([25000000, 40000000]);
 fireEvent.change(screen.getByLabelText('Зарплата до'), { target: { value: '' } });
 expect(changed).toHaveBeenLastCalledWith([25000000, undefined]);
});
