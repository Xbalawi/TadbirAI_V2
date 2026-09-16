"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Settings, Plus, MoreHorizontal, Users, Loader2, Eye, Pencil, FileText, Trash2, CheckCircle2, X, History } from "lucide-react";
import { mad } from "@/lib/format";
import AddEmployeeModal from "@/components/AddEmployeeModal";
import ConfirmModal from "@/components/ConfirmModal";
import ImportHistoryModal from "@/components/ImportHistoryModal";
import { matchesSearch } from "@/lib/search";
import { useTranslation } from "@/lib/i18n";

export default function EmployesPage() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [employesList, setEmployesList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  
  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<any | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch(`/api/employes?t=${Date.now()}`);
      const data = await res.json();
      setEmployesList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
    const handleUpdate = () => fetchEmployees();
    window.addEventListener("dataUpdated", handleUpdate);
    return () => window.removeEventListener("dataUpdated", handleUpdate);
  }, []);

  // 0ms Optimistic UI Delete
  const handleDeleteEmployee = (id: string, name: string) => {
    setConfirmConfig({
      isOpen: true,
      title: `Supprimer l'employé : ${name}`,
      message: "Voulez-vous vraiment supprimer cet employé ? Cette action est irréversible.",
      onConfirm: () => {
        // 1. INSTANT UI removal (0ms delay)
        setEmployesList((prev) => prev.filter((e) => e.id !== id));
        showToast(`Employé ${name} supprimé avec succès !`);

        // 2. Asynchronous API sync in background
        fetch(`/api/employes/${id}`, { method: "DELETE" }).then(() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "employes" } }));
          }
        }).catch((err) => console.error("Error deleting employee:", err));
      }
    });
    setActionMenuOpen(null);
  };

  // 0ms Optimistic UI Clear All
  const handleClearEmployees = () => {
    setConfirmConfig({
      isOpen: true,
      title: "Vider la liste des employés",
      message: "Voulez-vous vraiment vider toute la liste des employés ? Cette action est irréversible.",
      onConfirm: () => {
        // 1. INSTANT UI clear (0ms delay)
        setEmployesList([]);
        showToast("Tous les employés ont été vidés avec succès !");

        // 2. Asynchronous API sync in background
        fetch("/api/employes/clear", { method: "DELETE" }).then(() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "employes" } }));
          }
        }).catch((err) => console.error("Error clearing employees:", err));
      }
    });
  };

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Bulk Delete Selected
  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setConfirmConfig({
      isOpen: true,
      title: `Supprimer les ${selectedIds.length} employés sélectionnés`,
      message: `Voulez-vous vraiment supprimer ces ${selectedIds.length} employés ? Cette action est irréversible.`,
      onConfirm: () => {
        const idsToDelete = [...selectedIds];
        setEmployesList((prev) => prev.filter((e) => !idsToDelete.includes(e.id)));
        setSelectedIds([]);
        showToast(`${idsToDelete.length} employés supprimés avec succès !`);

        idsToDelete.forEach(id => {
          fetch(`/api/employes/${id}`, { method: "DELETE" }).catch(err => console.error(err));
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "employes" } }));
        }
      }
    });
  };

  const filteredEmployees = employesList.filter((e) => matchesSearch(e, searchTerm));

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredEmployees.map(emp => emp.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 text-slate-100">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl px-4 py-3 text-[13px] font-bold text-white shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-5 ${
          toast.type === "success" ? "bg-emerald-600 shadow-emerald-950/50" : "bg-red-600 shadow-red-950/50"
        }`}>
          <CheckCircle2 size={18} />
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 rounded-lg p-1 hover:bg-white/20">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-[22px] font-bold text-white tracking-tight">{t("employees.title", "Gestion du Personnel")}</h1>
          <p className="text-[12.5px] text-slate-400">
            {t("employees.subtitle", "Gérez votre équipe et leurs informations salariales en temps réel")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-[12.5px] font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
            title="Consulter l'historique des fichiers importés depuis le PC"
          >
            <History size={15} className="text-indigo-400" /> Historique
          </button>
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-[12.5px] font-bold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 active:scale-95 transition-all animate-in fade-in"
            >
              <Trash2 size={15} /> Supprimer la sélection ({selectedIds.length})
            </button>
          )}
          {employesList.length > 0 && (
            <button
              onClick={handleClearEmployees}
              className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-[12.5px] font-bold text-red-400 hover:bg-red-500/20 transition-all active:scale-95"
            >
              <Trash2 size={15} /> Vider les employés
            </button>
          )}
          <button
            onClick={() => {
              setSelectedEmployee(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-[12.5px] font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all active:scale-95"
          >
            <Plus size={16} /> {t("employees.new", "Ajouter un Employé")}
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bento-card !p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t("common.search", "Rechercher par nom, poste, CIN...")}
            className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />
          <span className="text-[12px] text-slate-400 font-mono">{filteredEmployees.length} employé(s)</span>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-400" size={32} /></div>
        ) : filteredEmployees.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <Users size={28} className="text-slate-600" />
            <p className="text-[14px] font-bold text-white">Aucun employé trouvé</p>
            <p className="text-[12px] text-slate-400 max-w-xs">
              Ajoutez votre premier employé pour commencer à gérer vos équipes et créer des bulletins de paie.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto min-h-[380px] pb-24">
            <table className="w-full text-[13px] text-left">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="pb-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={filteredEmployees.length > 0 && selectedIds.length === filteredEmployees.length}
                      onChange={handleSelectAll}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                    />
                  </th>
                  <th className="pb-3">{t("common.name", "Nom")} & CIN</th>
                  <th className="pb-3">{t("employees.job", "Poste")}</th>
                  <th className="pb-3">Département</th>
                  <th className="pb-3">{t("employees.salary", "Salaire de base")}</th>
                  <th className="pb-3">{t("common.status", "Statut")}</th>
                  <th className="pb-3 text-right">{t("common.actions", "Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredEmployees.map((e, idx) => {
                  const isNearBottom = idx >= filteredEmployees.length - 2 && filteredEmployees.length > 2;
                  return (
                    <tr key={e.id} className={`hover:bg-slate-900/40 transition-colors ${selectedIds.includes(e.id) ? "bg-indigo-950/20" : ""}`}>
                      <td className="py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(e.id)}
                          onChange={() => handleToggleSelect(e.id)}
                          className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 font-semibold text-white">
                        {e.prenom} {e.nom}
                        <div className="text-[11px] font-normal text-slate-400 font-mono mt-0.5">{e.cin || "CIN non renseigné"}</div>
                      </td>
                      <td className="py-3.5 text-slate-300 font-medium">{e.poste || "-"}</td>
                      <td className="py-3.5 text-slate-400">{e.departement || "-"}</td>
                      <td className="figure py-3.5 font-mono font-bold text-emerald-400">{mad(e.salaire_base || 0)}/mois</td>
                      <td className="py-3.5">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide ${
                            e.statut === "Actif"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}
                        >
                          {e.statut || "Actif"}
                        </span>
                      </td>
                      <td className="py-3.5 text-right relative">
                        <button 
                          onClick={() => setActionMenuOpen(actionMenuOpen === e.id ? null : e.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
                        >
                          <MoreHorizontal size={18} />
                        </button>

                        {/* Dropdown Menu - Smart Directional Positioning */}
                        {actionMenuOpen === e.id && (
                          <div className="absolute right-2 top-10 z-50 w-52 rounded-xl bg-slate-900 shadow-2xl border border-slate-800 p-2 text-left animate-in fade-in zoom-in-95 space-y-1">
                          <button
                            onClick={() => {
                              setViewingEmployee(e);
                              setActionMenuOpen(null);
                            }}
                            className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] text-slate-200 hover:bg-slate-800 font-medium"
                          >
                            <Eye size={14} className="text-indigo-400" /> Voir les détails
                          </button>
                          
                          <button
                            onClick={() => {
                              setSelectedEmployee(e);
                              setIsModalOpen(true);
                              setActionMenuOpen(null);
                            }}
                            className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] text-amber-300 hover:bg-slate-800 font-semibold"
                          >
                            <Pencil size={14} className="text-amber-400" /> Modifier l'employé
                          </button>

                          <Link
                            href="/bulletins-de-paie"
                            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-emerald-300 hover:bg-slate-800 font-medium"
                          >
                            <FileText size={14} className="text-emerald-400" /> Bulletin de Paie
                          </Link>

                          <button
                            onClick={() => handleDeleteEmployee(e.id, `${e.prenom} ${e.nom}`)}
                            className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] text-red-400 hover:bg-red-500/10 font-medium border-t border-slate-800 pt-1.5"
                          >
                            <Trash2 size={14} className="text-red-400" /> Supprimer
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Employee Modal */}
      <AddEmployeeModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedEmployee(null);
        }}
        initialData={selectedEmployee}
        onSuccess={() => {
          showToast(selectedEmployee ? "Employé modifié avec succès !" : "Nouvel employé créé avec succès !");
          fetchEmployees();
        }}
      />

      {/* View Details Modal */}
      {mounted && viewingEmployee && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md max-h-[90vh] flex flex-col overflow-y-auto my-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Détails de l'employé</h3>
              <button onClick={() => setViewingEmployee(null)} className="rounded-lg p-1 text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            
            <div className="space-y-3 text-[13px]">
              <div>
                <span className="text-[11px] font-bold uppercase text-slate-500 block">Nom complet</span>
                <span className="font-bold text-white text-base">{viewingEmployee.prenom} {viewingEmployee.nom}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-500 block">CIN</span>
                  <span className="font-mono text-slate-200">{viewingEmployee.cin || "-"}</span>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-500 block">Statut</span>
                  <span className="font-bold text-emerald-400">{viewingEmployee.statut || "Actif"}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-500 block">Poste</span>
                  <span className="text-slate-200">{viewingEmployee.poste || "-"}</span>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-500 block">Département</span>
                  <span className="text-slate-200">{viewingEmployee.departement || "-"}</span>
                </div>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase text-slate-500 block">Salaire de base mensuel</span>
                <span className="font-mono font-bold text-emerald-400 text-lg">{mad(viewingEmployee.salaire_base || 0)}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setViewingEmployee(null)}
                className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-[12.5px] font-bold text-slate-300 hover:text-white"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Import History Modal */}
      <ImportHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        defaultTable="employes"
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onClose={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
      />
    </div>
  );
}
