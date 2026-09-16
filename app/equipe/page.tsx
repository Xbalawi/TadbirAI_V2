"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, UserX, UserPlus, X, Shield, Search, MoreHorizontal, Check, HelpCircle, Loader2 } from "lucide-react";
import { matchesSearch } from "@/lib/search";
import { useTranslation } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store/authStore";

const ROLE_PERMISSIONS: Record<string, string> = {
  Administrateur: "Accès complet: Création, validation, suppression et gestion des paramètres & utilisateurs.",
  Comptable: "Accès financier: Factures, dépenses, avoirs, rapprochement bancaire et export des rapports.",
  Commercial: "Accès vente: Création de devis, gestion des clients et suivi des commandes.",
  Lecteur: "Accès consultation seule: Visualisation des factures et rapports sans modification.",
};

export default function EquipePage() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [list, setList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const user = useAuthStore((s) => s.user);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
    setMounted(true);
  }, [hydrate]);

  const isMasterAdmin = 
    user?.role === "Administrateur" || 
    user?.role === "Admin" ||
    (typeof window !== "undefined" && (
      ["Administrateur", "Admin"].includes(JSON.parse(localStorage.getItem("user") || "{}").role)
    ));

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<any | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  const [memberToEdit, setMemberToEdit] = useState<any | null>(null);
  const [editNom, setEditNom] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Comptable");
  const [search, setSearch] = useState("");
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchEquipe = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      const res = await fetch(`/api/equipe?t=${Date.now()}`, {
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setList(data);
        setFetchError(null);
      } else {
        setList([]);
        setFetchError(JSON.stringify(data));
      }
    } catch (err: any) {
      console.error(err);
      setList([]);
      setFetchError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEquipe();
    const handleUpdate = () => fetchEquipe();
    window.addEventListener("dataUpdated", handleUpdate);
    return () => window.removeEventListener("dataUpdated", handleUpdate);
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom || !email) return;
    setInviteError(null);
    setIsSubmitting(true);

    const newMember = {
      nom,
      email,
      role,
      statut: "Invité" as const,
    };

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      const res = await fetch('/api/equipe', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-email': user?.email || "",
          'x-user-role': user?.role || "",
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(newMember)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.detail || `Erreur ${res.status}: Impossible d'ajouter le membre.`);
      }

      if (data.email_error) {
        setInviteError(`L'utilisateur a été ajouté au tableau, mais l'e-mail a échoué: ${data.email_error}`);
      } else {
        setIsModalOpen(false);
        setNom("");
        setEmail("");
        setInviteError(null);
      }

      await fetchEquipe();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "equipe" } }));
      }
    } catch (err: any) {
      setInviteError(err.message || "Erreur réseau lors de l'ajout du membre.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    setList((prev) =>
      (Array.isArray(prev) ? prev : []).map((m) => (m?.id === memberId ? { ...m, role: newRole } : m))
    );
    try {
      await fetch('/api/equipe', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-email': user?.email || "",
          'x-user-role': user?.role || ""
        },
        body: JSON.stringify({ id: memberId, role: newRole }),
      });
      await fetchEquipe();
      window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "equipe" } }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editNom || !editEmail || !memberToEdit) return;
    setIsEditSubmitting(true);
    setEditError(null);
    try {
      await fetch('/api/equipe', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: memberToEdit.id, nom: editNom, email: editEmail }),
      });
      await fetchEquipe();
      setMemberToEdit(null);
      window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "equipe" } }));
    } catch (err: any) {
      setEditError(err.message || "Erreur lors de la modification");
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleStatusToggle = async (memberId: string) => {
    const target = safeList.find((m) => m?.id === memberId);
    if (!target) return;
    const newStatut = target.statut === "Actif" ? "Suspendu" : "Actif";
    setList((prev) =>
      (Array.isArray(prev) ? prev : []).map((m) =>
        m?.id === memberId ? { ...m, statut: newStatut } : m
      )
    );
    try {
      await fetch('/api/equipe', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-email': user?.email || "",
          'x-user-role': user?.role || ""
        },
        body: JSON.stringify({ id: memberId, statut: newStatut }),
      });
      await fetchEquipe();
      window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "equipe" } }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSingle = async (memberId: string) => {
    setList((prev) => (Array.isArray(prev) ? prev : []).filter((item) => item?.id !== memberId));
    try {
      await fetch(`/api/equipe?id=${memberId}`, { 
        method: 'DELETE',
        headers: { 'x-user-email': user?.email || "", 'x-user-role': user?.role || "", ...(typeof window !== 'undefined' && localStorage.getItem('access_token') ? { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') } : {}) }
      });
      await fetchEquipe();
      window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "equipe" } }));
    } catch (err) {
      console.error(err);
      await fetchEquipe();
    }
  };

  const safeList = Array.isArray(list) ? list : [];
  const filtered = safeList.filter((m) => matchesSearch(m, search));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const confirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const idsToDelete = [...selectedIds];
    setList((prev) => (Array.isArray(prev) ? prev : []).filter((m) => !idsToDelete.includes(m?.id)));
    setSelectedIds([]);
    try {
      await fetch('/api/equipe', {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-email': user?.email || "",
          'x-user-role': user?.role || ""
        },
        body: JSON.stringify({ ids: idsToDelete }),
      });
      await fetchEquipe();
      window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "equipe" } }));
    } catch (err) {
      console.error(err);
      await fetchEquipe();
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filtered.map(m => m.id).filter(Boolean));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">{t("team.title", "Équipe & Rôles")}</h1>
          <p className="text-[13px] text-slate-400">{t("team.subtitle", "Gérez l'accès des collaborateurs et définissez leurs permissions")}</p>
        </div>
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {selectedIds.length > 0 && isMasterAdmin && (
            <button
              onClick={() => setShowBulkDeleteModal(true)}
              className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 active:scale-95 transition-all animate-in fade-in"
            >
              Supprimer la sélection ({selectedIds.length})
            </button>
          )}
          {isMasterAdmin && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95 transition-all"
            >
              <Plus size={16} /> {t("team.invite", "Inviter un membre")}
            </button>
          )}
        </div>
      </div>

      {fetchError && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-300 text-[13px] font-mono mb-4 rounded-xl">
          Debug Error: {fetchError}
        </div>
      )}
      {/* Role permission summary table */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {Object.entries(ROLE_PERMISSIONS).map(([r, desc]) => {
          const count = safeList.filter((m) => m?.role === r).length;
          return (
            <div key={r} className="bento-card space-y-1.5 p-4 rounded-xl border border-slate-800 bg-slate-900/50">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-white">{r}</span>
                <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-mono font-bold text-indigo-400 border border-indigo-500/20">
                  {count}
                </span>
              </div>
              <p className="text-[11.5px] text-slate-400 leading-snug">{desc}</p>
            </div>
          );
        })}
      </div>

      <div className="bento-card !p-5 rounded-xl border border-slate-800 bg-slate-900/50">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4 mb-4">
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un membre..."
              className="w-72 rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-3.5 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <span className="text-[12.5px] font-semibold text-slate-400">
            {safeList.length} membre{safeList.length > 1 ? "s" : ""} au total
          </span>
        </div>

        <div className="overflow-x-auto pb-36 min-h-[350px]">
          <table className="w-full text-[13.5px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filtered.length && filtered.length > 0}
                    onChange={handleSelectAll}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3">Nom</th>
                <th className="py-3 px-3">E-mail</th>
                <th className="py-3 px-3">Rôle (Modifiable)</th>
                <th className="py-3 px-3">Statut</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((m, idx) => (
                <tr key={m?.id || idx} className="group hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(m?.id)}
                      onChange={() => m?.id && handleToggleSelect(m.id)}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-[12px] font-extrabold text-indigo-300 border border-indigo-500/30">
                        {m?.nom ? m.nom.charAt(0).toUpperCase() : "?"}
                      </span>
                      <span className="font-bold text-white">{m?.nom || "Sans nom"}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-slate-300 font-mono text-[12.5px]">{m?.email || "-"}</td>
                  <td className="py-3.5 px-3">
                    <select
                      value={m?.role || "Lecteur"}
                      disabled={!isMasterAdmin}
                      onChange={(e) => handleRoleChange(m.id, e.target.value)}
                      className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-[12.5px] font-semibold text-indigo-300 focus:border-indigo-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="Administrateur">Administrateur</option>
                      <option value="Comptable">Comptable</option>
                      <option value="Commercial">Commercial</option>
                      <option value="Lecteur">Lecteur</option>
                    </select>
                  </td>
                  <td className="py-3.5 px-3">
                    <span
                      className={`rounded-xl px-2.5 py-1 text-[11px] font-bold ${
                        m?.statut === "Actif"
                          ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                          : m?.statut === "Invité"
                          ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}
                    >
                      {m?.statut || "Actif"}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-right relative">
                    {isMasterAdmin && (
                      <button
                        onClick={() => setActionMenuOpen(actionMenuOpen === m?.id ? null : m?.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    )}
                    {isMasterAdmin && actionMenuOpen === m?.id && (
                      <div className={`absolute right-2 top-10 z-50 w-52 rounded-xl bg-slate-900 shadow-2xl border border-slate-800 p-2 text-left animate-in fade-in zoom-in-95 space-y-1`}>
                        <button
                          onClick={() => {
                            setMemberToEdit(m);
                            setEditNom(m.nom || "");
                            setEditEmail(m.email || "");
                            setActionMenuOpen(null);
                          }}
                          className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-2 text-[12.5px] text-amber-300 hover:bg-slate-800 font-medium"
                        >
                          <HelpCircle size={14} className="text-amber-400" /> Modifier infos
                        </button>
                        <button
                          onClick={() => {
                            if (m?.id) handleStatusToggle(m.id);
                            setActionMenuOpen(null);
                          }}
                          className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-2 text-[12.5px] text-slate-200 hover:bg-slate-800 font-medium border-t border-slate-800 pt-1.5"
                        >
                          <Shield size={14} className="text-indigo-400" />
                          {m?.statut === "Actif" ? "Suspendre l'accès" : "Activer le compte"}
                        </button>
                        <button
                          onClick={() => {
                            setMemberToDelete(m);
                            setActionMenuOpen(null);
                          }}
                          className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-2 text-[12.5px] text-red-400 hover:bg-red-500/10 font-medium border-t border-slate-800 pt-1.5"
                        >
                          <UserX size={14} className="text-red-400" /> Retirer de l'équipe
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Member Modal */}
      {mounted && isModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-md max-h-[90vh] flex flex-col overflow-y-auto my-auto rounded-2xl bg-slate-900 p-6 shadow-2xl border border-slate-800 space-y-5 text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="text-base font-bold text-white">Inviter un membre d'équipe</h2>
              <button onClick={() => setIsModalOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-all">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleInvite} className="space-y-4">
              {inviteError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-red-400 text-[12.5px] font-medium">{inviteError}</p>
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">Nom complet *</label>
                <input
                  required
                  type="text"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Youssef El Amrani"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">E-mail professionnel *</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="youssef@entreprise.ma"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">Rôle attribué</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="Administrateur">Administrateur</option>
                  <option value="Comptable">Comptable</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Lecteur">Lecteur</option>
                </select>
                <p className="mt-1.5 text-[11.5px] text-slate-400 leading-snug">{ROLE_PERMISSIONS[role] || ""}</p>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-[13px] font-bold text-white transition-all hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/30 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                >
                  {isSubmitting ? (
                    <><Loader2 size={16} className="animate-spin" /> Envoi...</>
                  ) : (
                    "Envoyer l'invitation"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Member Modal */}
      {mounted && memberToEdit && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-md max-h-[90vh] flex flex-col overflow-y-auto my-auto rounded-2xl bg-slate-900 p-6 shadow-2xl border border-slate-800 space-y-5 text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="text-base font-bold text-white">Modifier les infos</h2>
              <button onClick={() => setMemberToEdit(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-all">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEdit} className="space-y-4">
              {editError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-red-400 text-[12.5px] font-medium">{editError}</p>
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">Nom complet *</label>
                <input
                  required
                  type="text"
                  value={editNom}
                  onChange={(e) => setEditNom(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">E-mail professionnel *</label>
                <input
                  required
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isEditSubmitting}
                  className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-[13px] font-bold text-white transition-all hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/30 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                >
                  {isEditSubmitting ? (
                    <><Loader2 size={16} className="animate-spin" /> Enregistrement...</>
                  ) : (
                    "Enregistrer les modifications"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Single Member Deletion Confirmation Pop-Up Modal */}
      {mounted && memberToDelete && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 p-6 shadow-2xl border border-slate-800 space-y-5 text-white animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20 text-red-400 border border-red-500/30">
                  <UserX size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Confirmer la suppression</h3>
                  <p className="text-[12px] text-slate-400">Action irréversible</p>
                </div>
              </div>
              <button onClick={() => setMemberToDelete(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-all">
                <X size={18} />
              </button>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-1 text-[13px]">
              <p className="font-bold text-white">{memberToDelete.nom || "Membre"}</p>
              <p className="text-slate-400 font-mono text-[12px]">{memberToDelete.email || "-"}</p>
              <p className="text-[11.5px] font-semibold text-indigo-400 pt-1">Rôle : {memberToDelete.role || "Lecteur"}</p>
            </div>

            <p className="text-[13px] text-slate-300 leading-relaxed">
              Êtes-vous sûr de vouloir retirer ce membre de l'équipe ? Tous ses droits d'accès, son rôle et ses permissions seront définitivement supprimés.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setMemberToDelete(null)}
                className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-slate-300 hover:bg-slate-800 transition-all"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (memberToDelete?.id) {
                    await handleDeleteSingle(memberToDelete.id);
                  }
                  setMemberToDelete(null);
                }}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-red-600/30 hover:bg-red-500 active:scale-95 transition-all"
              >
                Supprimer le membre
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Bulk Deletion Confirmation Pop-Up Modal */}
      {mounted && showBulkDeleteModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 p-6 shadow-2xl border border-slate-800 space-y-5 text-white animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20 text-red-400 border border-red-500/30">
                  <UserX size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Suppression groupée ({selectedIds.length})</h3>
                  <p className="text-[12px] text-slate-400">Action irréversible sur la sélection</p>
                </div>
              </div>
              <button onClick={() => setShowBulkDeleteModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-all">
                <X size={18} />
              </button>
            </div>

            <p className="text-[13px] text-slate-300 leading-relaxed">
              Êtes-vous sûr de vouloir retirer les <span className="font-bold text-white">{selectedIds.length} membres</span> sélectionnés de l'équipe ? Leurs comptes, rôles et permissions associés seront révoqués et supprimés de la base de données.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-slate-300 hover:bg-slate-800 transition-all"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={async () => {
                  await confirmBulkDelete();
                  setShowBulkDeleteModal(false);
                }}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-red-600/30 hover:bg-red-500 active:scale-95 transition-all"
              >
                Supprimer les {selectedIds.length} membres
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

