import { redirect } from 'next/navigation';
import { appRoutes } from '@/lib/shared/routes';

export default function CandidateDashboardPage() {
    redirect(appRoutes.candidate.chats);
}
