import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { AttendanceEvidenceCard } from '@/components/admin/AttendanceEvidenceCard';

describe('AttendanceEvidenceCard', () => {
    it('renders attendance summary and event timeline', () => {
        const html = renderToStaticMarkup(
            <AttendanceEvidenceCard
                candidateJoinedAt={new Date('2026-02-20T15:05:00Z')}
                professionalJoinedAt={new Date('2026-02-20T15:06:00Z')}
                attendanceOutcome="both_joined"
                events={[
                    {
                        id: 'evt_1',
                        eventType: 'meeting.participant_joined',
                        eventTs: new Date('2026-02-20T15:05:00Z'),
                        mappedRole: 'candidate',
                        mappingMethod: 'strict_email',
                        participantEmail: 'cand@example.com',
                        participantName: 'Candidate',
                        processingStatus: 'processed',
                        processingError: null,
                    },
                ]}
                latestNoShowAudit={{
                    createdAt: new Date('2026-02-20T15:25:00Z'),
                    metadata: { recommendation: 'both_joined', applied: 'both_joined' },
                }}
            />
        );

        expect(html).toContain('Attendance Evidence');
        expect(html).toContain('both_joined');
        expect(html).toContain('meeting.participant_joined');
        expect(html).toContain('cand@example.com');
        expect(html).toContain('strict_email');
    });

    it('renders empty states when no evidence exists', () => {
        const html = renderToStaticMarkup(
            <AttendanceEvidenceCard
                candidateJoinedAt={null}
                professionalJoinedAt={null}
                attendanceOutcome={null}
                events={[]}
                latestNoShowAudit={null}
            />
        );

        expect(html).toContain('No attendance events captured.');
        expect(html).toContain('No no-show decision audit logged yet.');
        expect(html).toContain('Pending');
    });
});
