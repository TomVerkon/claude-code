"use client";

import { useSession, signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function UserNav() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  if (!session?.user) return null;

  async function handleLogout() {
    setLoggingOut(true);
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-gray-700">{session.user.name}</span>
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50"
      >
        {loggingOut ? "..." : "Logout"}
      </button>
    </div>
  );
}
