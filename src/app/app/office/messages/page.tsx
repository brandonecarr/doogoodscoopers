import { MessageSquare, Construction } from "lucide-react";

export default function MessagesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <p className="text-gray-600">Customer communication and notifications</p>
      </div>

      <div className="bg-white rounded-lg shadow p-12 text-center">
        <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="w-8 h-8 text-teal-600" />
        </div>
        <div className="flex items-center justify-center gap-2 text-gray-500 mb-2">
          <Construction className="w-5 h-5" />
          <span className="font-medium">Coming Soon</span>
        </div>
        <p className="text-gray-500 max-w-md mx-auto">
          Messaging is being built. You&apos;ll be able to send SMS/email notifications,
          view conversation threads, and manage communication templates here.
        </p>
      </div>
    </div>
  );
}
