const discoveredTimezones = (() => {
    try {
        if (typeof Intl.supportedValuesOf === "function") {
            return Intl.supportedValuesOf("timeZone");
        }
    } catch {
        // Ignore runtime environments that do not expose supported timezone values.
    }

    return [] as string[];
})();

const collator = new Intl.Collator("en", { sensitivity: "base" });

const dedupedTimezones = Array.from(
    new Set(
        ["UTC", ...discoveredTimezones]
            .map((timezone) => timezone.trim())
            .filter(Boolean)
    )
);

const sortedTimezones = dedupedTimezones
    .filter((timezone) => timezone !== "UTC")
    .sort((a, b) => collator.compare(a, b));

export const SUPPORTED_TIMEZONES = ["UTC", ...sortedTimezones];

export function isSupportedTimezone(value: string): boolean {
    const timezone = value.trim();
    if (!timezone) return false;

    if (timezone === "UTC") {
        return true;
    }

    try {
        new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
        return true;
    } catch {
        return false;
    }
}

export function normalizeTimezone(value?: string | null): string {
    const timezone = value?.trim() ?? "";
    if (!timezone) return "UTC";

    return isSupportedTimezone(timezone) ? timezone : "UTC";
}
