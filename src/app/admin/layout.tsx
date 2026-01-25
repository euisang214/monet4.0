
import Link from 'next/link';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen bg-gray-100">
            {/* Sidebar */}
            <aside className="w-64 bg-white shadow-md flex-shrink-0">
                <div className="p-6 border-b">
                    <h1 className="text-xl font-bold text-gray-800">Admin Portal</h1>
                </div>
                <nav className="p-4 space-y-2">
                    <Link href="/admin/disputes" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">
                        Disputes
                    </Link>
                    <Link href="/admin/bookings" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">
                        Bookings
                    </Link>
                    <Link href="/admin/users" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">
                        Users
                    </Link>
                    <div className="pt-4 border-t mt-4">
                        <Link href="/admin/feedback" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">
                            Feedback Loop
                        </Link>
                        <Link href="/admin/payments" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">
                            Payments
                        </Link>
                    </div>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-8">
                {children}
            </main>
        </div>
    );
}
