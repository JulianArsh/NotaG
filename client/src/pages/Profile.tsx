import { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import Navbar from "../components/layout/Navbar";
import PieceCard from "../components/piece/PieceCard";
import { getSavedPieces } from "../services/pieces.service";
import { useAuth } from "../context/AuthContext";
import type { Piece, UserRole } from "../types";

export default function Profile() {
  const { user: clerkUser } = useUser();
  const { dbUser, role, changeRole, syncNow } = useAuth();
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleUpdating, setRoleUpdating] = useState(false);
  const [roleMessage, setRoleMessage] = useState<string | null>(null);

  useEffect(() => {
    getSavedPieces()
      .then((data) => setPieces(Array.isArray(data) ? data : []))
      .catch(() => setPieces([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleRoleChange(newRole: UserRole) {
    setRoleUpdating(true);
    setRoleMessage(null);
    try {
      await changeRole(newRole);
      setRoleMessage(`Role successfully updated to "${newRole}".`);
    } catch (err: any) {
      setRoleMessage(`Failed to update role: ${err?.message || "Unknown error"}`);
    } finally {
      setRoleUpdating(false);
    }
  }

  return (
    <div className="min-h-screen bg-brown">
      <Navbar />
      <main className="px-8 pb-16 max-w-[1100px] mx-auto">
        {/* User Identity and Role Overview Card */}
        <div className="bg-cream/10 backdrop-blur rounded-[16px] p-6 mt-6 mb-8 border border-white/10 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-display font-medium text-2xl text-white">
                  {dbUser?.name || clerkUser?.fullName || clerkUser?.firstName || "Music Explorer"}
                </h1>
                <span
                  className={`text-xs font-display font-semibold uppercase tracking-wider px-3 py-1 rounded-full border ${
                    role === "admin"
                      ? "bg-purple-900/60 text-purple-200 border-purple-400"
                      : role === "analyst"
                      ? "bg-tan/30 text-amber-200 border-tan"
                      : "bg-white/10 text-gray-200 border-white/20"
                  }`}
                >
                  {role}
                </span>
              </div>
              <p className="font-body text-sm text-white/70 mt-1">
                {dbUser?.email || clerkUser?.primaryEmailAddress?.emailAddress || "No email on file"}
              </p>
              <p className="font-mono text-xs text-white/40 mt-1">
                Clerk ID: {clerkUser?.id || dbUser?.id}
              </p>
            </div>

            {/* Quick Sync Button */}
            <button
              onClick={() => syncNow()}
              className="text-xs font-display border border-white/20 bg-white/5 hover:bg-white/10 rounded-pill px-4 py-2 text-white/80 transition"
            >
              🔄 Re-sync with Neon DB
            </button>
          </div>

          {/* Database Role Selector */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <h2 className="font-display font-semibold text-sm text-white/90 mb-2">
              Database Role & Permissions
            </h2>
            <p className="font-body text-xs text-white/60 mb-4">
              Roles are managed in our Neon PostgreSQL database via Prisma. Analysts and Administrators
              have permissions to author synchronization anchors, preview and commit timestamp analyses,
              and manage scores.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              {(["listener", "analyst", "admin"] as UserRole[]).map((r) => (
                <button
                  key={r}
                  disabled={roleUpdating || role === r}
                  onClick={() => handleRoleChange(r)}
                  className={`px-4 py-2 rounded-pill font-display text-xs font-semibold capitalize transition ${
                    role === r
                      ? "bg-tan text-white shadow-md cursor-default"
                      : "bg-white/10 text-white/80 hover:bg-white/20"
                  } ${roleUpdating ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {r === role ? `✓ ${r} (Current)` : `Switch to ${r}`}
                </button>
              ))}
            </div>

            {roleMessage && (
              <p className="font-body text-xs mt-3 text-amber-200">{roleMessage}</p>
            )}
          </div>
        </div>

        {/* Saved Pieces Section */}
        <h2 className="font-display font-medium text-xl text-white mb-6">
          Your Saved Pieces ({pieces.length})
        </h2>

        {loading && <p className="text-white font-body">Loading…</p>}
        {!loading && pieces.length === 0 && (
          <p className="text-white font-body">
            Nothing saved yet — hit Save on a piece to see it here.
          </p>
        )}

        <div className="flex flex-col gap-6">
          {pieces.map((piece) => (
            <PieceCard key={piece.id || piece._id} piece={piece} />
          ))}
        </div>
      </main>
    </div>
  );
}
