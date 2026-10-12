import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { LocateControl, MapClickHandler, MapViewport } from '@/components/map/map-controls';

const mockMap = { setView: jest.fn(), locate: jest.fn(), stopLocate: jest.fn(), on: jest.fn(), off: jest.fn() };
const mockLayer = { addTo: jest.fn(), remove: jest.fn() };
const mockEvents = jest.fn();
jest.mock('react-leaflet', () => ({ useMap: () => mockMap, useMapEvents: (events: any) => mockEvents(events) }));
jest.mock('leaflet', () => ({ __esModule: true, default: {
    layerGroup: () => mockLayer, circle: jest.fn(), circleMarker: jest.fn(), DomEvent: { disableClickPropagation: jest.fn() },
} }));
jest.mock('@/contexts/language-context', () => ({ useLanguage: () => ({ lang: 'ru' }) }));
beforeEach(() => { jest.clearAllMocks(); mockLayer.addTo.mockReturnValue(mockLayer); });

test('changing the selected region moves an already mounted map without resetting unchanged views', () => {
    const view = render(<MapViewport center={{ lat: 41, lng: 69 }} zoom={10} />);
    expect(mockMap.setView).toHaveBeenLastCalledWith([41, 69], 10);
    view.rerender(<MapViewport center={{ lat: 40, lng: 72 }} zoom={12} />);
    expect(mockMap.setView).toHaveBeenLastCalledWith([40, 72], 12);
    view.rerender(<MapViewport center={{ lat: 40, lng: 72 }} zoom={12} />);
    expect(mockMap.setView).toHaveBeenCalledTimes(2);
});

test('map clicks use the current callback after a form changes', () => {
    const first = jest.fn(), second = jest.fn();
    const view = render(<MapClickHandler onMapClick={first} />);
    mockEvents.mock.calls.at(-1)[0].click({ latlng: { lat: 41, lng: 69 } });
    expect(first).toHaveBeenCalledWith(41, 69);
    view.rerender(<MapClickHandler onMapClick={second} />);
    mockEvents.mock.calls.at(-1)[0].click({ latlng: { lat: 40, lng: 72 } });
    expect(second).toHaveBeenCalledWith(40, 72);
});

test('geolocation starts only after a click and failure is visible and retryable', () => {
    const view = render(<LocateControl />);
    expect(mockMap.locate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Моё местоположение' }));
    expect(mockMap.locate).toHaveBeenCalledTimes(1);
    const failed = mockMap.on.mock.calls.find(([event]) => event === 'locationerror')![1];
    act(() => failed());
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось определить');
    expect(screen.getByRole('button', { name: 'Моё местоположение' })).toBeEnabled();
    view.unmount(); expect(mockMap.stopLocate).toHaveBeenCalled();
});
