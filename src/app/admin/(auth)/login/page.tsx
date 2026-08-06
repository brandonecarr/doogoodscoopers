"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, Mail, Loader2, AlertCircle } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        router.push("/admin");
        router.refresh();
      } else {
        setError(data.error || "Invalid email or password");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="dgs-admin min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "radial-gradient(760px 380px at 50% -8%, rgba(124,92,252,.35), transparent 70%), #0C0C12",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="dgs-card p-8" style={{ borderRadius: 28 }}>
          {/* Brand */}
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-2.5 mb-5">
              <span
                className="w-[38px] h-[38px] rounded-[12px] flex items-center justify-center"
                style={{ background: "linear-gradient(150deg,#8B6BFF,#6D3EF0)" }}
              >
                <span className="w-[15px] h-[15px] rounded-full border-[2.5px] border-white" />
              </span>
              <span className="text-[17px] font-extrabold tracking-[-0.02em] text-ink">
                DooGood<span className="text-iris-link">Scoopers</span>
              </span>
            </span>
            <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">Admin Dashboard</h1>
            <p className="text-muted2 text-[13px] mt-1">Sign in to manage leads</p>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 rounded-[14px] p-3 mb-6 flex items-center gap-2 text-red-700 text-sm"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </motion.div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[13px] font-semibold text-bodytext mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@doogoodscoopers.com"
                  className="w-full pl-10 pr-4 py-3 rounded-[14px] border border-hair focus:border-iris focus:ring-2 focus:ring-iris-soft outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-bodytext mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-4 py-3 rounded-[14px] border border-hair focus:border-iris focus:ring-2 focus:ring-iris-soft outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 text-white font-bold rounded-[14px] shadow-lg hover:brightness-105 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(150deg,#8B6BFF,#6D3EF0)" }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-white/50 text-sm mt-6">
          DooGoodScoopers Admin Portal
        </p>
      </motion.div>
    </div>
  );
}
