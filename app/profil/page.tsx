"use client";

import { useState, useEffect } from "react";
import { User, Lock, Shield, Check, Key, Mail, Building, Phone, Save, AlertCircle, Sparkles } from "lucide-react";
import { useAuthStore } from "@/lib/store/authStore";

const ROLE_DESCRIPTIONS: Record<string, { desc: string; color: string; badge: string }> = {
  Administrateur: {
    desc: "Accès complet au système : Gestion d'équipe, paramètres généraux, facturation, trésorerie et configuration.",
    color: "from-indigo-500/20 to-purple-500/20 text-indigo-300 border-indigo-500/30",
    badge: "Accès Global Admin",
  },
  Comptable: {
    desc: "Accès financier et comptable : Gestion des factures, dépenses, avoirs, banque et export des rapports.",
    color: "from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-500/30",
    badge: "Accès Financier",
  },
  Commercial: {
    desc: "Accès commercial et ventes : Devis, gestion des clients, point de vente (POS) et messagerie WhatsApp.",
    color: "from-amber-500/20 to-orange-500/20 text-amber-300 border-amber-500/30",
    badge: "Accès Ventes & POS",
  },
  "Ressources Humaines": {
    desc: "Accès RH & Gestion du personnel : Fiches d'employés, bulletins de paie et suivi du personnel.",
    color: "from-pink-500/20 to-rose-500/20 text-pink-300 border-pink-500/30",
    badge: "Accès RH & Paie",
  },
  Caissier: {
    desc: "Accès caisse et scanner POS : Encaissement des ventes au comptoir et scanner d'articles.",
    color: "from-cyan-500/20 to-blue-500/20 text-cyan-300 border-cyan-500/30",
    badge: "Accès Caisse POS",
  },
  Lecteur: {
    desc: "Accès consultation seule : Visualisation des registres et rapports sans droit de modification.",
    color: "from-slate-800 to-slate-900 text-slate-300 border-slate-700",
    badge: "Consultation Seule",
  },
};

export default function ProfilePage() {
  const { user, login } = useAuthStore();

  const [nom, setNom] = useState(user?.nom || "Utilisateur Tadbir");
  const [email, setEmail] = useState(user?.email || "utilisateur@entreprise.ma");
  const [phone, setPhone] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [profileSuccessMsg, setProfileSuccessMsg] = useState("");
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState("");
  const [passwordErrorMsg, setPasswordErrorMsg] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      if (user.nom && user.nom !== nom) setNom(user.nom);
      if (user.email && user.email !== email) setEmail(user.email);
    }
  }, [user?.nom, user?.email, nom, email]);

  const activeRole = user?.role || "Administrateur";
  const roleInfo = ROLE_DESCRIPTIONS[activeRole] || ROLE_DESCRIPTIONS["Lecteur"];

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileSuccessMsg("");

    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_profile",
          oldEmail: user?.email,
          nom,
          email,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de la mise à jour");

      if (user && data.user) {
        // Update local session
        login({
          ...user,
          ...data.user
        });
      }
      setProfileSuccessMsg("Profil mis à jour avec succès !");
      setTimeout(() => setProfileSuccessMsg(""), 3500);
    } catch (err: any) {
      alert(err.message || "Erreur de mise à jour");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErrorMsg("");
    setPasswordSuccessMsg("");

    if (!currentPassword) {
      setPasswordErrorMsg("Veuillez saisir votre mot de passe actuel.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordErrorMsg("Le nouveau mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordErrorMsg("Les nouveaux mots de passe ne correspondent pas.");
      return;
    }

    setIsChangingPassword(true);

    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_password",
          email: user?.email,
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de la mise à jour du mot de passe");

      setPasswordSuccessMsg("Votre mot de passe a été modifié avec succès !");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccessMsg(""), 3500);
    } catch (err: any) {
      setPasswordErrorMsg(err.message || "Erreur de mise à jour");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-8 pb-12 text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <User size={28} className="text-indigo-400" />
            <span>Mon Profil & Sécurité</span>
          </h1>
          <p className="text-[13.5px] text-slate-400 mt-1">
            Gérez vos informations personnelles, votre mot de passe et vos permissions d'accès.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-2 rounded-xl bg-gradient-to-r ${roleInfo.color} px-4 py-2 text-xs font-bold border shadow-lg`}>
            <Shield size={15} />
            <span>{activeRole}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Personal Information & Password Change */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Card 1: Personal Details */}
          <div className="bento-card space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <User size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Informations Personnelles</h2>
                  <p className="text-[12px] text-slate-400">Modifiez votre nom et vos coordonnées professionnelles</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">Nom complet *</label>
                  <div className="relative">
                    <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      required
                      type="text"
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-3.5 py-2.5 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">Email professionnel *</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-3.5 py-2.5 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">Téléphone</label>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-3.5 py-2.5 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">Entreprise</label>
                  <div className="relative">
                    <Building size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      disabled
                      type="text"
                      value={user?.company || "Tadbir AI Enterprise"}
                      className="w-full rounded-xl border border-slate-850 bg-slate-900/60 pl-10 pr-3.5 py-2.5 text-[13px] text-slate-400 cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {profileSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                  <Check size={16} />
                  <span>{profileSuccessMsg}</span>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-slate-800/80">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95 transition-all disabled:opacity-50"
                >
                  <Save size={16} />
                  <span>{isSavingProfile ? "Enregistrement..." : "Enregistrer les modifications"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Card 2: Password Change */}
          <div className="bento-card space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Key size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Changer de Mot de Passe</h2>
                  <p className="text-[12px] text-slate-400">Assurez la sécurité de votre compte en mettant à jour votre mot de passe</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block mb-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">Mot de passe actuel *</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    required
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-3.5 py-2.5 text-[13px] text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">Nouveau mot de passe *</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      required
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-3.5 py-2.5 text-[13px] text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">Confirmer le mot de passe *</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      required
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-3.5 py-2.5 text-[13px] text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {passwordErrorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{passwordErrorMsg}</span>
                </div>
              )}

              {passwordSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                  <Check size={16} />
                  <span>{passwordSuccessMsg}</span>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-slate-800/80">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-amber-600/30 hover:bg-amber-500 active:scale-95 transition-all disabled:opacity-50"
                >
                  <Key size={16} />
                  <span>{isChangingPassword ? "Mise à jour..." : "Mettre à jour le mot de passe"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Active Role & System Permissions Overview */}
        <div className="space-y-6">
          <div className="bento-card space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Shield size={18} className="text-indigo-400" />
              <h2 className="text-sm font-bold text-white">Rôle & Permissions Système</h2>
            </div>

            <div className="rounded-xl bg-slate-950 p-4 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{activeRole}</span>
                <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 uppercase tracking-wider">
                  {roleInfo.badge}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{roleInfo.desc}</p>
            </div>

            <div className="space-y-2 pt-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Droits d'Accès de votre compte :</p>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-400" />
                  <span>Authentification sécurisée & OTP</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-400" />
                  <span>Consultation des données autorisées</span>
                </li>
                {["Administrateur", "Comptable", "Commercial", "Ressources Humaines", "Caissier"].includes(activeRole) && (
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-400" />
                    <span>Création & édition des documents de vente/achats</span>
                  </li>
                )}
                {activeRole === "Administrateur" && (
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-400" />
                    <span>Gestion d'équipe, invitations & attribution des rôles</span>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
