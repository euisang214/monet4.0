import React from 'react';
import { addDays, format } from 'date-fns';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WeekRangeNavigator, WeeklySlotGrid } from '@/components/bookings/calendar/WeeklySlotGrid';
import { SLOTS_PER_DAY, getSlotLabel, slotDateForCell } from '@/components/bookings/calendar/slot-utils';

function collectElementsByType(node: React.ReactNode, type: string): React.ReactElement[] {
    const found: React.ReactElement[] = [];

    function visit(value: React.ReactNode): void {
        if (Array.isArray(value)) {
            value.forEach(visit);
            return;
        }

        if (!React.isValidElement(value)) return;

        const element = value as React.ReactElement<{ children?: React.ReactNode }>;
        if (typeof element.type === 'string' && element.type === type) {
            found.push(element);
        }

        visit(element.props.children);
    }

    visit(node);
    return found;
}

describe('WeekRangeNavigator', () => {
    it('renders week range, wires handlers, and respects disabled states', () => {
        const onPrev = vi.fn();
        const onNext = vi.fn();
        const weekStart = new Date(2026, 0, 5);

        const tree = WeekRangeNavigator({
            weekStart,
            canGoPrev: false,
            canGoNext: true,
            onPrev,
            onNext,
        });

        const buttons = collectElementsByType(tree, 'button');
        expect(buttons).toHaveLength(2);
        expect(buttons[0].props.disabled).toBe(true);
        expect(buttons[1].props.disabled).toBe(false);

        const prevClick = buttons[0].props.onClick as (() => void) | undefined;
        const nextClick = buttons[1].props.onClick as (() => void) | undefined;
        prevClick?.();
        nextClick?.();

        expect(onPrev).toHaveBeenCalledTimes(1);
        expect(onNext).toHaveBeenCalledTimes(1);

        const spans = collectElementsByType(tree, 'span');
        expect(spans).toHaveLength(1);
        expect(spans[0].props.className).toContain('min-w-[170px]');

        const html = renderToStaticMarkup(tree);
        expect(html).toContain(`${format(weekStart, 'MMM d')} - ${format(addDays(weekStart, 6), 'MMM d')}`);
    });

    it('supports custom range label width class override', () => {
        const tree = WeekRangeNavigator({
            weekStart: new Date(2026, 0, 5),
            canGoPrev: true,
            canGoNext: true,
            onPrev: () => {},
            onNext: () => {},
            rangeLabelMinWidthClassName: 'min-w-[220px]',
        });

        const spans = collectElementsByType(tree, 'span');
        expect(spans).toHaveLength(1);
        expect(spans[0].props.className).toContain('min-w-[220px]');
        expect(spans[0].props.className).not.toContain('min-w-[170px]');
    });
});

describe('WeeklySlotGrid', () => {
    it('invokes renderCell for each slot cell with computed coordinates', () => {
        const weekStart = new Date(2026, 0, 5);
        const calls: Array<{ slotStart: Date; dayOffset: number; row: number }> = [];
        const scrollRef: React.RefObject<HTMLDivElement | null> = { current: null };

        const tree = WeeklySlotGrid({
            weekStart,
            scrollRef,
            viewportHeight: 420,
            renderCell: ({ slotStart, dayOffset, row }) => {
                calls.push({ slotStart, dayOffset, row });
                return <td className="p-0" data-cell={`${dayOffset}-${row}`} />;
            },
        });

        expect(calls).toHaveLength(7 * SLOTS_PER_DAY);
        expect(calls[0]).toMatchObject({ dayOffset: 0, row: 0 });
        expect(calls[0].slotStart.toISOString()).toBe(slotDateForCell(weekStart, 0, 0).toISOString());

        const last = calls[calls.length - 1];
        expect(last).toMatchObject({ dayOffset: 6, row: SLOTS_PER_DAY - 1 });
        expect(last.slotStart.toISOString()).toBe(slotDateForCell(weekStart, 6, SLOTS_PER_DAY - 1).toISOString());

        const containers = collectElementsByType(tree, 'div');
        expect(containers).toHaveLength(1);
        expect(containers[0].props.className).toContain('overflow-y-auto');
        expect(containers[0].props.ref).toBe(scrollRef);
        expect(containers[0].props.style).toEqual({ height: '420px' });

        const tables = collectElementsByType(tree, 'table');
        expect(tables).toHaveLength(1);
        expect(tables[0].props.className).toBe('w-full border-collapse table-fixed');

        const rows = collectElementsByType(tree, 'tr');
        expect(rows).toHaveLength(SLOTS_PER_DAY + 1);
        expect(rows[1].props['data-slot-row']).toBe(0);
    });

    it('applies custom table class and renders day/time labels', () => {
        const weekStart = new Date(2026, 0, 5);

        const tree = WeeklySlotGrid({
            weekStart,
            scrollRef: { current: null },
            viewportHeight: 360,
            tableClassName: 'custom-table',
            renderCell: () => <td className="p-0" />,
        });

        const html = renderToStaticMarkup(tree);
        expect(html).toContain('custom-table');
        expect(html).toContain(format(weekStart, 'EEE MMM d'));
        expect(html).toContain(format(addDays(weekStart, 6), 'EEE MMM d'));
        expect(html).toContain(getSlotLabel(0));
    });
});
