import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WeekRangeNavigator, WeeklySlotGrid } from '@/components/bookings/calendar/WeeklySlotGrid';
import {
    VISIBLE_END_ROW_EXCLUSIVE,
    VISIBLE_ROW_COUNT,
    VISIBLE_START_ROW,
    getDayHeaderLabel,
    getSlotLabel,
    getWeekRangeLabel,
    slotDateForCell,
} from '@/components/bookings/calendar/slot-utils';

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
    it('renders week range, wires handlers, and exposes accessible icon controls', () => {
        const onPrev = vi.fn();
        const onNext = vi.fn();
        const weekStart = new Date(2026, 0, 5);

        const tree = WeekRangeNavigator({
            weekStart,
            canGoPrev: false,
            canGoNext: true,
            onPrev,
            onNext,
            calendarTimezone: 'UTC',
        });

        const buttons = collectElementsByType(tree, 'button');
        expect(buttons).toHaveLength(2);
        expect(buttons[0].props.disabled).toBe(true);
        expect(buttons[1].props.disabled).toBe(false);
        expect(buttons[0].props['aria-label']).toBe('Previous week');
        expect(buttons[1].props['aria-label']).toBe('Next week');
        expect(buttons[0].props.className).toContain('calendar-week-nav-button');
        expect(buttons[1].props.className).toContain('calendar-week-nav-button');

        const arrowSpans = collectElementsByType(tree, 'span').filter(
            (span) => typeof span.props.className === 'string' && span.props.className.includes('calendar-week-nav-arrow')
        );
        expect(arrowSpans).toHaveLength(2);
        expect(arrowSpans[0].props.children).toBe('‹');
        expect(arrowSpans[1].props.children).toBe('›');

        const prevClick = buttons[0].props.onClick as (() => void) | undefined;
        const nextClick = buttons[1].props.onClick as (() => void) | undefined;
        prevClick?.();
        nextClick?.();

        expect(onPrev).toHaveBeenCalledTimes(1);
        expect(onNext).toHaveBeenCalledTimes(1);

        const spans = collectElementsByType(tree, 'span').filter(
            (span) => typeof span.props.className === 'string' && span.props.className.includes('calendar-week-range-label')
        );
        expect(spans).toHaveLength(1);
        expect(spans[0].props.className).toContain('min-w-[170px]');

        const html = renderToStaticMarkup(tree);
        expect(html).toContain(getWeekRangeLabel(weekStart, 'UTC'));
    });

    it('supports custom range label width class override', () => {
        const tree = WeekRangeNavigator({
            weekStart: new Date(2026, 0, 5),
            canGoPrev: true,
            canGoNext: true,
            onPrev: () => {},
            onNext: () => {},
            rangeLabelMinWidthClassName: 'min-w-[220px]',
            calendarTimezone: 'UTC',
        });

        const spans = collectElementsByType(tree, 'span').filter(
            (span) => typeof span.props.className === 'string' && span.props.className.includes('calendar-week-range-label')
        );
        expect(spans).toHaveLength(1);
        expect(spans[0].props.className).toContain('min-w-[220px]');
        expect(spans[0].props.className).not.toContain('min-w-[170px]');
    });
});

describe('WeeklySlotGrid', () => {
    it('invokes renderCell for business-hour rows and timezone-aligned slots', () => {
        const weekStart = new Date(2026, 0, 5);
        const calls: Array<{ slotStart: Date; dayOffset: number; row: number }> = [];
        const scrollRef: React.RefObject<HTMLDivElement | null> = { current: null };

        const tree = WeeklySlotGrid({
            weekStart,
            scrollRef,
            viewportHeight: 420,
            calendarTimezone: 'UTC',
            renderCell: ({ slotStart, dayOffset, row }) => {
                calls.push({ slotStart, dayOffset, row });
                return <td className="p-0" data-cell={`${dayOffset}-${row}`} />;
            },
        });

        expect(calls).toHaveLength(7 * VISIBLE_ROW_COUNT);
        expect(calls[0]).toMatchObject({ dayOffset: 0, row: VISIBLE_START_ROW });
        expect(calls[0].slotStart.toISOString()).toBe(
            slotDateForCell(weekStart, 0, VISIBLE_START_ROW, 'UTC').toISOString()
        );

        const last = calls[calls.length - 1];
        expect(last).toMatchObject({ dayOffset: 6, row: VISIBLE_END_ROW_EXCLUSIVE - 1 });
        expect(last.slotStart.toISOString()).toBe(
            slotDateForCell(weekStart, 6, VISIBLE_END_ROW_EXCLUSIVE - 1, 'UTC').toISOString()
        );

        const containers = collectElementsByType(tree, 'div').filter(
            (element) =>
                typeof element.props.className === 'string' && element.props.className.includes('calendar-slot-grid-shell')
        );
        expect(containers).toHaveLength(1);
        expect(containers[0].props.ref).toBe(scrollRef);
        expect(containers[0].props.style).toEqual({ height: '420px' });

        const rows = collectElementsByType(tree, 'tr');
        expect(rows).toHaveLength(VISIBLE_ROW_COUNT + 1);
        expect(rows[1].props['data-slot-row']).toBe(VISIBLE_START_ROW);
    });

    it('applies custom table class and hides off-hours labels', () => {
        const weekStart = new Date(2026, 0, 5);

        const tree = WeeklySlotGrid({
            weekStart,
            scrollRef: { current: null },
            viewportHeight: 360,
            tableClassName: 'custom-table',
            calendarTimezone: 'UTC',
            renderCell: () => <td className="p-0" />,
        });

        const html = renderToStaticMarkup(tree);
        expect(html).toContain('custom-table');
        expect(html).toContain(getDayHeaderLabel(weekStart, 0, 'UTC'));
        expect(html).toContain(getDayHeaderLabel(weekStart, 6, 'UTC'));
        expect(html).toContain(getSlotLabel(VISIBLE_START_ROW, 'UTC', weekStart));
        expect(html).not.toContain(getSlotLabel(0, 'UTC', weekStart));

        const cols = collectElementsByType(tree, 'col');
        expect(cols).toHaveLength(8);
    });

    it('renders the secondary professional timezone axis only when configured and different', () => {
        const weekStart = new Date(2026, 0, 5);

        const withSecondaryAxis = WeeklySlotGrid({
            weekStart,
            scrollRef: { current: null },
            viewportHeight: 360,
            calendarTimezone: 'UTC',
            professionalTimezone: 'America/New_York',
            showProfessionalTimezoneAxis: true,
            renderCell: () => <td className="p-0" />,
        });

        const withSecondaryAxisHtml = renderToStaticMarkup(withSecondaryAxis);
        expect(withSecondaryAxisHtml).toContain('America/New_York');
        expect(withSecondaryAxisHtml).toContain(getSlotLabel(VISIBLE_START_ROW, 'America/New_York', weekStart));
        expect(collectElementsByType(withSecondaryAxis, 'col')).toHaveLength(9);

        const withoutSecondaryAxis = WeeklySlotGrid({
            weekStart,
            scrollRef: { current: null },
            viewportHeight: 360,
            calendarTimezone: 'UTC',
            professionalTimezone: 'UTC',
            showProfessionalTimezoneAxis: true,
            renderCell: () => <td className="p-0" />,
        });

        const withoutSecondaryAxisHtml = renderToStaticMarkup(withoutSecondaryAxis);
        expect(withoutSecondaryAxisHtml).not.toContain('America/New_York');
        expect(collectElementsByType(withoutSecondaryAxis, 'col')).toHaveLength(8);
    });
});
