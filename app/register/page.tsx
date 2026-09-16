"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchAPI } from "@/lib/api";
import { useAuthStore } from "@/lib/store/authStore";

export default function RegisterPage() {
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const router = useRouter();

  const [role, setRole] = useState("Administrateur");
  const [showVerificationStep, setShowVerificationStep] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("892019");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSentStatus, setEmailSentStatus] = useState<string | null>(null);
  const [emailErrorDetails, setEmailErrorDetails] = useState<string | null>(null);
  const [isRealSmtp, setIsRealSmtp] = useState<boolean | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copiedOtp, setCopiedOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [authTokens, setAuthTokens] = useState<{ access?: string; refresh?: string }>({});

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get("email");
      if (emailParam) setEmail(emailParam);
    }
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const sendRealVerificationEmail = async (userEmail: string, otpCode: string, userName: string) => {
    setSendingEmail(true);
    setResendCooldown(30);
    setEmailSentStatus("Envoi rapide de l'e-mail de vérification...");
    setEmailErrorDetails(null);
    setIsRealSmtp(null);
    setPreviewUrl(null);

    try {
      const res = await fetch("/api/auth/send-verification-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, otp: otpCode, name: userName }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsRealSmtp(!!data.isRealSmtp);
        if (data.isRealSmtp) {
          setEmailSentStatus(`E-mail expédié avec succès à ${userEmail}`);
        } else if (data.notice) {
          setEmailSentStatus(data.notice);
        } else {
          setEmailSentStatus(`Email de vérification prêt pour ${userEmail}`);
        }
        if (data.previewUrl) setPreviewUrl(data.previewUrl);
      } else {
        setEmailErrorDetails(data.details || data.error || "Échec de l'envoi de l'email.");
        setEmailSentStatus(`Erreur lors de l'envoi à ${userEmail}`);
      }
    } catch (err: any) {
      setEmailErrorDetails(err.message || "Impossible de contacter le serveur d'envoi.");
      setEmailSentStatus("Erreur réseau lors de l'envoi de l'email.");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleAutofillOtp = () => {
    setOtpInput(generatedOtp);
    setCopiedOtp(true);
    setTimeout(() => setCopiedOtp(false), 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    setLoading(true);

    try {
      // 1. Verify email uniqueness and role assignment with backend API
      const regCheck = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, nom }),
      });
      const regData = await regCheck.json();

      if (!regCheck.ok || regData.error) {
        setError(regData.error || "Erreur lors de la validation de l'adresse e-mail");
        setLoading(false);
        return;
      }

      const assignedRole = regData.user?.role || "Lecteur";
      setRole(assignedRole);
      if (regData.access) {
        setAuthTokens({ access: regData.access, refresh: regData.refresh });
      }

      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(newOtp);

      // Send actual email dispatch
      await sendRealVerificationEmail(email, newOtp, nom);

      setShowVerificationStep(true);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'inscription");
      setLoading(false);
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpInput.trim() !== generatedOtp) {
      setError("Code OTP incorrect. Veuillez vérifier votre e-mail et réessayer.");
      return;
    }

    const newUser = {
      id: `USR-${Date.now()}`,
      email,
      nom,
      role: role,
      company: "Tadbir AI Enterprise",
      emailVerified: true,
    };

    login(newUser, authTokens.access || "session_token", authTokens.refresh || "session_refresh");
    router.push("/");
  };

  return (
    <div 
      className="flex items-center justify-center min-h-screen relative"
      style={{
        backgroundImage: "url('/auth-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm z-0"></div>
      
      <div className="relative z-10 w-full max-w-md p-8 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 shadow-2xl flex flex-col items-center">
        
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400 mb-4 shadow-[0_0_15px_rgba(99,102,241,0.5)]">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Bienvenue sur Tadbir AI</h1>
          <p className="text-slate-400 text-sm">Créez votre compte pour gérer vos factures intelligemment.</p>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">Nom complet</label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder-slate-600"
              placeholder="John Doe"
              required
            />
          </div>

          <div>
            <label className="block mb-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">Email professionnel</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder-slate-600"
              placeholder="vous@entreprise.com"
              required
            />
          </div>

          <div>
            <label className="block mb-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder-slate-600"
              placeholder="••••••••"
              required
            />
          </div>

          <div>
            <label className="block mb-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">Rôle attribué par l'entreprise</label>
            <div className="w-full bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-slate-300 flex items-center justify-between text-xs">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
                <span>Attribution automatique par l'Administrateur</span>
              </span>
              <span className="font-bold text-indigo-400 uppercase tracking-wider bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                Secured RBAC
              </span>
            </div>
            <p className="mt-1.5 text-[11.5px] text-indigo-300/80 font-medium">
              ℹ️ L'inscription nécessite qu'un Administrateur vous ait au préalable invité et attribué un rôle dans l'onglet Équipe.
            </p>
          </div>

          <div>
            <label className="block mb-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">Confirmer mot de passe</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder-slate-600"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-red-400 text-sm text-center font-medium">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl p-3 transition-all shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:shadow-[0_0_30px_rgba(79,70,229,0.6)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Création du compte..." : "Continuer vers la vérification d'email"}
          </button>

          <p className="text-sm text-center mt-6 text-slate-400">
            Déjà un compte ?{" "}
            <a href="/login" className="text-indigo-400 font-semibold hover:text-indigo-300 transition-colors">
              Connectez-vous
            </a>
          </p>
        </form>
      </div>

      {/* OTP Email Verification Step */}
      {showVerificationStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 p-7 shadow-2xl border border-slate-700/60 text-white space-y-4">
            <div className="text-center space-y-2">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 mb-1 border border-emerald-500/30">
                ✉️
              </div>
              <h2 className="text-xl font-bold text-white">Vérification de l'adresse e-mail</h2>
            </div>

            <div className="rounded-xl bg-slate-950 p-4 border border-slate-800 space-y-3.5 text-center">
              <div>
                <p className={`text-[12px] font-bold uppercase tracking-wider ${emailErrorDetails ? "text-red-400" : "text-emerald-400"}`}>
                  {sendingEmail 
                    ? "⏳ Envoi de l'email en cours..." 
                    : emailErrorDetails 
                    ? "⚠️ Échec de l'envoi de l'email" 
                    : "✓ E-mail de vérification expédié"}
                </p>
                <p className="text-[12.5px] text-slate-300 mt-1">
                  {emailSentStatus || `Code envoyé à ${email}`}
                </p>
              </div>

              {emailErrorDetails && (
                <div className="p-2.5 rounded-lg bg-red-950/50 border border-red-800/60 text-[11px] text-red-300 text-left space-y-1">
                  <p className="font-semibold text-red-200">Détail :</p>
                  <p className="font-mono text-[10.5px] opacity-90 break-words">{emailErrorDetails}</p>
                </div>
              )}

              {!emailErrorDetails && (
                <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-[11.5px] text-emerald-200 text-left flex items-start gap-2">
                  <span className="text-base">📌</span>
                  <div>
                    <span className="font-semibold">Vérifiez vos Spams !</span> Si l'e-mail n'apparaît pas dans votre boîte de réception principale d'ici 1 minute, consultez le dossier <strong>Courriers Indésirables / Spams</strong> ou <strong>Promotions</strong>.
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleVerifyOtp} className="space-y-4 pt-1">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[12.5px] font-semibold text-slate-300">Code de vérification OTP (6 chiffres) *</label>
                  <button
                    type="button"
                    disabled={sendingEmail || resendCooldown > 0}
                    onClick={() => sendRealVerificationEmail(email, generatedOtp, nom)}
                    className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingEmail 
                      ? "Envoi..." 
                      : resendCooldown > 0 
                      ? `Renvoyer (${resendCooldown}s)` 
                      : "Renvoyer l'email"}
                  </button>
                </div>
                <input
                  required
                  type="text"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  placeholder="------"
                  className="w-full text-center tracking-widest text-lg font-mono rounded-xl border border-slate-700 bg-slate-950 py-2.5 px-4 text-white focus:border-emerald-500 focus:outline-none"
                />
                <div className="mt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleAutofillOtp}
                    className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-950/50 hover:bg-emerald-900/60 px-2.5 py-1 rounded-lg border border-emerald-800/50 transition-colors"
                  >
                    ⚡ {copiedOtp ? "Code inséré avec succès !" : "Insérer le code automatiquement"}
                  </button>
                  <span className="text-[10.5px] text-slate-400 font-mono">
                    Secours: {generatedOtp}
                  </span>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center text-xs text-red-400 font-medium">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVerificationStep(false)}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-900 py-2.5 text-[13px] font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Retour
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition-all active:scale-95"
                >
                  Valider l'Email
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
