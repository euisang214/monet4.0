import { vi } from 'vitest';

export const mockCreateZoomMeeting = vi.fn();
export const mockDeleteZoomMeeting = vi.fn();

// We mock the entire module when importing `@/lib/integrations/zoom`
export const mockZoom = {
    createZoomMeeting: mockCreateZoomMeeting,
    deleteZoomMeeting: mockDeleteZoomMeeting,
};
