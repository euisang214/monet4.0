export type TimeRangeInput = {
    start: Date | string;
    end: Date | string;
};

export type DateTimeRange = {
    start: Date;
    end: Date;
};

function toDate(value: Date | string) {
    return value instanceof Date ? new Date(value) : new Date(value);
}

function isValidRange(range: DateTimeRange) {
    return Number.isFinite(range.start.getTime())
        && Number.isFinite(range.end.getTime())
        && range.end > range.start;
}

export function normalizeTimeRange(range: TimeRangeInput): DateTimeRange {
    return {
        start: toDate(range.start),
        end: toDate(range.end),
    };
}

export function normalizeAndSortTimeRanges(ranges: readonly TimeRangeInput[]): DateTimeRange[] {
    return ranges
        .map(normalizeTimeRange)
        .filter(isValidRange)
        .sort((left, right) => left.start.getTime() - right.start.getTime());
}

export function timeRangesOverlap(left: TimeRangeInput, right: TimeRangeInput) {
    const normalizedLeft = normalizeTimeRange(left);
    const normalizedRight = normalizeTimeRange(right);
    return normalizedLeft.start < normalizedRight.end && normalizedLeft.end > normalizedRight.start;
}

export function doesTimeRangeOverlap(
    start: Date,
    end: Date,
    range: TimeRangeInput,
) {
    return timeRangesOverlap({ start, end }, range);
}

export function mergeTimeRanges(ranges: readonly TimeRangeInput[]): DateTimeRange[] {
    const sorted = normalizeAndSortTimeRanges(ranges);
    if (sorted.length === 0) {
        return [];
    }

    const merged: DateTimeRange[] = [{ ...sorted[0] }];
    for (let index = 1; index < sorted.length; index += 1) {
        const current = sorted[index];
        const previous = merged[merged.length - 1];

        if (current.start.getTime() <= previous.end.getTime()) {
            previous.end = new Date(Math.max(previous.end.getTime(), current.end.getTime()));
            continue;
        }

        merged.push({ ...current });
    }

    return merged;
}

export function subtractTimeRangeFromRanges(
    currentRanges: readonly TimeRangeInput[],
    subtraction: TimeRangeInput,
) {
    const normalizedSubtraction = normalizeTimeRange(subtraction);
    if (!isValidRange(normalizedSubtraction)) {
        return normalizeAndSortTimeRanges(currentRanges);
    }

    const result: DateTimeRange[] = [];

    for (const current of normalizeAndSortTimeRanges(currentRanges)) {
        if (!timeRangesOverlap(current, normalizedSubtraction)) {
            result.push(current);
            continue;
        }

        if (current.start < normalizedSubtraction.start) {
            result.push({
                start: current.start,
                end: normalizedSubtraction.start,
            });
        }

        if (normalizedSubtraction.end < current.end) {
            result.push({
                start: normalizedSubtraction.end,
                end: current.end,
            });
        }
    }

    return result;
}

export function splitTimeRangesByWindow(
    ranges: readonly TimeRangeInput[],
    editableStart: Date,
    editableEnd: Date,
): { editableRanges: DateTimeRange[]; preservedRanges: DateTimeRange[] } {
    const editableRanges: DateTimeRange[] = [];
    const preservedRanges: DateTimeRange[] = [];

    for (const range of normalizeAndSortTimeRanges(ranges)) {
        if (range.end <= editableStart) {
            continue;
        }

        if (range.start < editableEnd && range.end > editableStart) {
            editableRanges.push({
                start: new Date(Math.max(range.start.getTime(), editableStart.getTime())),
                end: new Date(Math.min(range.end.getTime(), editableEnd.getTime())),
            });
        }

        if (range.end > editableEnd) {
            preservedRanges.push({
                start: new Date(Math.max(range.start.getTime(), editableEnd.getTime())),
                end: range.end,
            });
        }
    }

    return {
        editableRanges: mergeTimeRanges(editableRanges),
        preservedRanges: mergeTimeRanges(preservedRanges),
    };
}

export function serializeTimeRanges(ranges: readonly TimeRangeInput[]) {
    return mergeTimeRanges(ranges).map((range) => ({
        start: range.start.toISOString(),
        end: range.end.toISOString(),
    }));
}

export function areSerializedTimeRangesEqual(
    left: readonly TimeRangeInput[],
    right: readonly TimeRangeInput[],
) {
    const serialize = (ranges: readonly TimeRangeInput[]) => serializeTimeRanges(ranges)
        .map((range) => `${range.start}|${range.end}`)
        .join(",");

    return serialize(left) === serialize(right);
}

export function countTimeRangeSteps(
    ranges: readonly TimeRangeInput[],
    stepMinutes: number,
) {
    const stepMs = stepMinutes * 60 * 1000;

    return mergeTimeRanges(ranges).reduce((total, range) => (
        total + Math.max(0, Math.round((range.end.getTime() - range.start.getTime()) / stepMs))
    ), 0);
}
