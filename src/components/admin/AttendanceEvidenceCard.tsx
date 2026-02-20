import { format } from 'date-fns';

type AttendanceEventRow = {
    id: string;
    eventType: string;
    eventTs: Date;
    mappedRole: string;
    mappingMethod: string;
    participantEmail: string | null;
    participantName: string | null;
    processingStatus: string;
    processingError: string | null;
};

type NoShowAuditEntry = {
    createdAt: Date;
    metadata: unknown;
} | null;

export function AttendanceEvidenceCard({
    candidateJoinedAt,
    professionalJoinedAt,
    attendanceOutcome,
    events,
    latestNoShowAudit,
}: {
    candidateJoinedAt: Date | null;
    professionalJoinedAt: Date | null;
    attendanceOutcome: string | null;
    events: AttendanceEventRow[];
    latestNoShowAudit: NoShowAuditEntry;
}) {
    return (
        <div className="bg-white shadow rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">Attendance Evidence</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                    <span className="block text-gray-500">Candidate Joined At</span>
                    <span>{candidateJoinedAt ? format(candidateJoinedAt, 'PPpp') : 'Not recorded'}</span>
                </div>
                <div>
                    <span className="block text-gray-500">Professional Joined At</span>
                    <span>{professionalJoinedAt ? format(professionalJoinedAt, 'PPpp') : 'Not recorded'}</span>
                </div>
                <div>
                    <span className="block text-gray-500">Attendance Outcome</span>
                    <span>{attendanceOutcome || 'Pending'}</span>
                </div>
            </div>

            <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Latest No-Show Evaluation</h3>
                {latestNoShowAudit ? (
                    <pre className="text-xs bg-gray-50 border rounded p-3 overflow-x-auto">
                        {JSON.stringify({
                            evaluatedAt: latestNoShowAudit.createdAt.toISOString(),
                            metadata: latestNoShowAudit.metadata,
                        }, null, 2)}
                    </pre>
                ) : (
                    <p className="text-sm text-gray-500">No no-show decision audit logged yet.</p>
                )}
            </div>

            <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Recent Zoom Attendance Events</h3>
                {events.length === 0 ? (
                    <p className="text-sm text-gray-500">No attendance events captured.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-500 border-b">
                                    <th className="py-2 pr-4">Time</th>
                                    <th className="py-2 pr-4">Event</th>
                                    <th className="py-2 pr-4">Mapped Role</th>
                                    <th className="py-2 pr-4">Mapping</th>
                                    <th className="py-2 pr-4">Participant</th>
                                    <th className="py-2 pr-4">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {events.map((event) => (
                                    <tr key={event.id} className="border-b last:border-0 align-top">
                                        <td className="py-2 pr-4 whitespace-nowrap">{format(event.eventTs, 'PP p')}</td>
                                        <td className="py-2 pr-4">{event.eventType}</td>
                                        <td className="py-2 pr-4">{event.mappedRole}</td>
                                        <td className="py-2 pr-4">{event.mappingMethod}</td>
                                        <td className="py-2 pr-4">
                                            <div>{event.participantEmail || 'Unknown email'}</div>
                                            <div className="text-xs text-gray-500">{event.participantName || 'Unknown name'}</div>
                                        </td>
                                        <td className="py-2 pr-4">
                                            <div>{event.processingStatus}</div>
                                            {event.processingError ? (
                                                <div className="text-xs text-red-600">{event.processingError}</div>
                                            ) : null}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
