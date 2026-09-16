"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/authStore";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Forgot Password States
  const [isForgotPasswordMode, setIsForgotPasswordMode] = useState(false);
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [resetOtp, setResetOtp] = useState("");
  const [generatedResetOtp, setGeneratedResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [emailSentSuccess, setEmailSentSuccess] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const login = useAuthStore((s) => s.login);
  const router = useRouter();

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Identifiants invalides.");
        setLoading(false);
        return;
      }

      if (!data.user.emailVerified) {
        setError("Votre compte n'est pas encore vérifié.");
        setLoading(false);
        return;
      }

      login(data.user, data.access || "session_token", data.refresh || "session_refresh");
      router.push("/");
    } catch {
      setError("Erreur de connexion au serveur.");
      setLoading(false);
    }
  };

  const handleResetRequest = async (e?: React.FormEvent, isResend = false) => {
    if (e) e.preventDefault();
    setError("");
    setLoading(true);
    if (isResend) setResendCooldown(30);
    
    try {
      const cleanEmail = email.trim().toLowerCase();
      // Check if user exists
      const userRes = await fetch(`/api/auth/check-user?email=${encodeURIComponent(cleanEmail)}`);
      if (!userRes.ok) {
        setError("Aucun compte trouvé pour cet e-mail.");
        setLoading(false);
        return;
      }
      
      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedResetOtp(newOtp);
      
      // Dispatch Real Email
      const emailRes = await fetch("/api/auth/send-verification-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, otp: newOtp, name: "Utilisateur Tadbir AI" }),
      });
      
      const emailData = await emailRes.json();
      if (!emailRes.ok || !emailData.success) {
        setError(emailData.error || "Échec de l'envoi de l'e-mail. Veuillez réessayer.");
        setLoading(false);
        return;
      }

      if (emailData.fallback) {
        setEmailSentSuccess(`⚠️ L'e-mail n'a pas pu être envoyé. Utilisez le bouton "Insérer le code" ci-dessous.`);
      } else {
        setEmailSentSuccess(`✅ Code envoyé à ${cleanEmail} via ${emailData.method === 'brevo-api' ? 'Brevo' : 'Gmail'}`);
      }
      setResetStep(2);
      setLoading(false);
    } catch {
      setError("Erreur réseau lors de la demande de réinitialisation.");
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (resetOtp.trim() !== generatedResetOtp) {
      setError("Code OTP incorrect. Veuillez saisir le code à 6 chiffres reçu dans votre boîte e-mail.");
      return;
    }
    
    if (newPassword !== confirmNewPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    if (newPassword.length < 4) {
      setError("Le mot de passe doit contenir au moins 4 caractères.");
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), newPassword }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors de la réinitialisation.");
        setLoading(false);
        return;
      }
      
      alert("Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.");
      setIsForgotPasswordMode(false);
      setResetStep(1);
      setPassword(newPassword);
      setNewPassword("");
      setConfirmNewPassword("");
      setError("");
      setLoading(false);
    } catch {
      setError("Erreur réseau.");
      setLoading(false);
    }
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isForgotPasswordMode ? "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" : "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"} />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
            {isForgotPasswordMode ? "Réinitialisation" : "Bon retour"}
          </h1>
          <p className="text-slate-400 text-sm">
            {isForgotPasswordMode 
              ? (resetStep === 1 ? "Entrez votre email pour recevoir votre code par e-mail." : "Consultez votre e-mail et définissez votre nouveau mot de passe.") 
              : "Connectez-vous pour accéder à votre tableau de bord."}
          </p>
        </div>

        {error && (
          <div className="p-3 mb-4 w-full bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400 text-sm text-center font-medium">{error}</p>
          </div>
        )}

        {/* FORGOT PASSWORD MODE */}
        {isForgotPasswordMode ? (
          <form onSubmit={resetStep === 1 ? handleResetRequest : handlePasswordReset} className="w-full space-y-4">
            
            {resetStep === 1 && (
              <div>
                <label className="block mb-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Email professionnel
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder-slate-600"
                  placeholder="vous@entreprise.com"
                  required
                />
              </div>
            )}

            {resetStep === 2 && (
              <div className="space-y-4">
                {/* Email Sent Banner */}
                <div className="rounded-xl bg-emerald-950/40 p-3 border border-emerald-800/50 text-emerald-200 text-xs text-center space-y-1">
                  <div className="flex items-center justify-center gap-1.5 font-bold">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>✓ E-mail expédié</span>
                  </div>
                  <p className="text-[11.5px] text-slate-300">
                    {emailSentSuccess || `Code envoyé à ${email}`}
                  </p>
                  <p className="text-[11px] text-emerald-300/80">
                    Vérifiez également votre dossier <strong>Spams / Courriers indésirables</strong>.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Code OTP (6 chiffres) reçu par email
                    </label>
                    <button
                      type="button"
                      disabled={loading || resendCooldown > 0}
                      onClick={() => handleResetRequest(undefined, true)}
                      className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {resendCooldown > 0 ? `Renvoyer (${resendCooldown}s)` : "Renvoyer l'email"}
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-700 rounded-xl p-3 text-white text-center font-mono tracking-widest text-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    placeholder="------"
                    required
                  />
                  <div className="flex items-center justify-between mt-1 px-1">
                    <button
                      type="button"
                      onClick={() => setResetOtp(generatedResetOtp)}
                      className="text-[11px] bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30 px-2 py-1 rounded-lg transition-colors font-semibold"
                    >
                      📋 Pas reçu ? Insérer le code automatiquement
                    </button>
                    <span className="text-[10.5px] text-slate-500">Valable 10 min</span>
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Nouveau mot de passe
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <div>
                  <label className="block mb-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Confirmer nouveau mot de passe
                  </label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl p-3 transition-all shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:shadow-[0_0_30px_rgba(79,70,229,0.6)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Envoi en cours..." : resetStep === 1 ? "Envoyer le code par e-mail" : "Valider le nouveau mot de passe"}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsForgotPasswordMode(false);
                setResetStep(1);
                setError("");
              }}
              className="w-full text-sm text-center mt-4 text-slate-400 hover:text-white transition-colors"
            >
              Retour à la connexion
            </button>
          </form>

        ) : (

          /* LOGIN MODE */
          <form onSubmit={handleLoginSubmit} className="w-full space-y-4">
            <div>
              <label className="block mb-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Email professionnel
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder-slate-600"
                placeholder="vous@entreprise.com"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Mot de passe
                </label>
                <button 
                  type="button"
                  onClick={() => {
                    setIsForgotPasswordMode(true);
                    setResetStep(1);
                    setError("");
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder-slate-600"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl p-3 transition-all shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:shadow-[0_0_30px_rgba(79,70,229,0.6)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Connexion en cours..." : "Se connecter"}
            </button>

            <p className="text-sm text-center mt-6 text-slate-400">
              Pas encore de compte?{" "}
              <a href="/register" className="text-indigo-400 font-semibold hover:text-indigo-300 transition-colors">
                Créer un compte
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
