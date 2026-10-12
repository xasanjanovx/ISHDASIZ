import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Calendar } from '@/components/ui/calendar';

test('upgraded calendar selects a day and supports month navigation', () => {
    const selected = jest.fn();
    render(<Calendar mode="single" defaultMonth={new Date(2026, 9, 1)} onSelect={selected} />);
    fireEvent.click(screen.getByRole('button', { name: /October 6th, 2026/ }));
    expect(selected.mock.calls[0][0]).toEqual(new Date(2026, 9, 6));
    fireEvent.click(screen.getByRole('button', { name: 'Go to the Next Month' }));
    expect(screen.getByText('November 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Go to the Previous Month' }));
    expect(screen.getByText('October 2026')).toBeInTheDocument();
});

test('upgraded calendar preserves disabled day restrictions', () => {
    const selected = jest.fn();
    render(<Calendar mode="single" defaultMonth={new Date(2026, 9, 1)} disabled={new Date(2026, 9, 6)} onSelect={selected} />);
    const day = screen.getByRole('button', { name: /October 6th, 2026/ });
    expect(day).toBeDisabled();
    fireEvent.click(day);
    expect(selected).not.toHaveBeenCalled();
});
