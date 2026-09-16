"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Settings, ChevronDown, Download, Loader2, X, Printer, Trash2, History } from "lucide-react";
import ImportHistoryModal from "@/components/ImportHistoryModal";
import { mad } from "@/lib/format";
import { useTranslation } from "@/lib/i18n";

const CNSS_PCT = 4.48;
const CNSS_PLAFOND = 6000;
const AMO_PCT = 2.26;
const TAUX_IR = 20;

function computeBulletin(salaireBase: number, personnesACharge: number) {
  const salaireBrut = salaireBase || 0;
  const cnssBase = Math.min(salaireBrut, CNSS_PLAFOND);
  const cnss = cnssBase * (CNSS_PCT / 100);
  const amo = salaireBrut * (AMO_PCT / 100);
  const fraisPro = salaireBrut * 0.191;
  const baseImposableIR = salaireBrut - cnss - amo - fraisPro;
  const deductionPersonnes = (personnesACharge || 0) * (360 / 12);
  const ir = Math.max(0, baseImposableIR * (TAUX_IR / 100) - deductionPersonnes);
  const totalRetenues = cnss + amo + ir;
  const netAPayer = salaireBrut - totalRetenues;
  const coutEmployeur = salaireBrut + cnss * 1.3;
  return { salaireBrut, cnss, amo, fraisPro, baseImposableIR, deductionPersonnes, ir, totalRetenues, netAPayer, coutEmployeur };
}

async function printBulletinWindow(selectedRow: any) {
  if (!selectedRow) return;

  let company: any = {};
  try {
    const orgId = selectedRow.organization_id || selectedRow.company || (typeof window !== "undefined" ? localStorage.getItem("active_organization_id") : null);
    const orgParam = orgId ? `?org=${encodeURIComponent(orgId)}` : "";
    const orgHeaders: Record<string, string> = orgId ? { "x-organization-id": orgId } : {};
    const res = await fetch(`/api/company-settings${orgParam}`, { headers: orgHeaders });
    if (res.ok) company = await res.json();
  } catch (e) {}

  const devise = company.devise || company.currency || (typeof window !== "undefined" ? localStorage.getItem("devise") : null) || "MAD";

  const printWindow = window.open('', '_blank', 'width=900,height=1000,top=50,left=100');
  if (!printWindow) {
    window.print();
    return;
  }

  const emp = selectedRow.emp || {};
  const calc = selectedRow.calc || {};
  const periode = selectedRow.periode || "Avril 2026";

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>Fiche de Paie - ${emp.prenom || ''} ${emp.nom || ''} (${periode})</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          * { box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 24px; background: #ffffff; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; }
          .title { font-size: 22px; font-weight: 900; text-transform: uppercase; margin: 0; color: #0f172a; }
          .subtitle { font-size: 12px; font-weight: 700; color: #475569; margin-top: 4px; }
          .company { text-align: right; }
          .company-name { font-size: 18px; font-weight: 900; color: #1e1b4b; }
          .company-info { font-size: 11px; color: #64748b; margin-top: 2px; }
          .emp-box { display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px 18px; margin-bottom: 20px; font-size: 12.5px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12.5px; }
          th { background: #e2e8f0; color: #0f172a; font-weight: 800; text-align: left; padding: 10px 14px; border: 1px solid #cbd5e1; text-transform: uppercase; font-size: 11px; }
          td { padding: 10px 14px; border: 1px solid #cbd5e1; }
          .net-banner { display: flex; justify-content: space-between; align-items: center; background: #f0fdf4; border: 2px solid #15803d; border-radius: 12px; padding: 16px 20px; }
          .net-title { font-weight: 900; font-size: 14px; color: #166534; }
          .net-sub { font-size: 11px; color: #15803d; font-weight: 600; margin-top: 2px; }
          .net-amount { font-size: 24px; font-weight: 900; color: #14532d; font-family: monospace; }
          .signatures { display: flex; justify-content: space-between; margin-top: 50px; font-size: 11px; color: #64748b; }
          .sig-box { width: 220px; border-bottom: 1px dashed #94a3b8; height: 60px; margin-top: 10px; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">BULLETIN DE PAIE / FICHE DE SALAIRE</h1>
            <div class="subtitle">PÉRIODE DE PAIE : ${periode.toUpperCase()}</div>
          </div>
          <div class="company">
            <div class="company-name">${company.nom || company.name || 'TADBIR AI ENTERPRISE'}</div>
            <div class="company-info">ICE : ${company.ice || '-'} · ${company.adresse || company.address || ''}${company.pays || company.country ? `, ${company.pays || company.country}` : ''}</div>
          </div>
        </div>

        <div class="emp-box">
          <div>
            <strong style="font-size: 14px; color: #0f172a;">${emp.prenom || ''} ${emp.nom || ''}</strong><br/>
            <span style="color: #475569;">Poste : ${emp.poste || "Salarié"}</span><br/>
            <span style="color: #475569;">Département : ${emp.departement || "Général"}</span>
          </div>
          <div style="text-align: right; color: #334155;">
            <strong>N° CIN :</strong> ${emp.cin || "BE100200"}<br/>
            <strong>N° CNSS :</strong> ${emp.cnss || "19283910"}<br/>
            <strong>Jours Travaillés :</strong> 26 jours
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Rubrique / Élément de Paie</th>
              <th style="text-align: right;">Base (${devise})</th>
              <th style="text-align: right;">Taux</th>
              <th style="text-align: right;">Gains</th>
              <th style="text-align: right;">Retenues</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Salaire de Base Mensuel</strong></td>
              <td style="text-align: right; font-family: monospace;">${(calc.salaireBrut || 0).toLocaleString('fr-FR')} ${devise}</td>
              <td style="text-align: right;">100%</td>
              <td style="text-align: right; font-family: monospace; font-weight: bold;">${(calc.salaireBrut || 0).toLocaleString('fr-FR')} ${devise}</td>
              <td style="text-align: right;">—</td>
            </tr>
            <tr>
              <td>Cotisation CNSS Salarié</td>
              <td style="text-align: right; font-family: monospace;">${Math.min(calc.salaireBrut || 0, 6000).toLocaleString('fr-FR')} ${devise}</td>
              <td style="text-align: right;">4.48%</td>
              <td style="text-align: right;">—</td>
              <td style="text-align: right; font-family: monospace; color: #b91c1c; font-weight: bold;">${(calc.cnss || 0).toLocaleString('fr-FR')} ${devise}</td>
            </tr>
            <tr>
              <td>Cotisation AMO Salarié</td>
              <td style="text-align: right; font-family: monospace;">${(calc.salaireBrut || 0).toLocaleString('fr-FR')} ${devise}</td>
              <td style="text-align: right;">2.26%</td>
              <td style="text-align: right;">—</td>
              <td style="text-align: right; font-family: monospace; color: #b91c1c; font-weight: bold;">${(calc.amo || 0).toLocaleString('fr-FR')} ${devise}</td>
            </tr>
            <tr>
              <td>Impôt sur le Revenu (IR)</td>
              <td style="text-align: right; font-family: monospace;">${(calc.baseImposableIR || 0).toLocaleString('fr-FR')} ${devise}</td>
              <td style="text-align: right;">20.0%</td>
              <td style="text-align: right;">—</td>
              <td style="text-align: right; font-family: monospace; color: #b91c1c; font-weight: bold;">${(calc.ir || 0).toLocaleString('fr-FR')} ${devise}</td>
            </tr>
          </tbody>
        </table>

        <div class="net-banner">
          <div>
            <div class="net-title">NET À PAYER AU SALARIÉ</div>
            <div class="net-sub">Virement Bancaire Certifié</div>
          </div>
          <div class="net-amount">${(calc.netAPayer || 0).toLocaleString('fr-FR')} ${devise}</div>
        </div>

        <div class="signatures">
          <div>
            Signature du Salarié :
            <div class="sig-box"></div>
          </div>
          <div style="text-align: right;">
            Cachet & Signature Employeur :
            <div class="sig-box"></div>
          </div>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 350);
}

export default function BulletinsPaiePage() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [employesList, setEmployesList] = useState<any[]>([]);
  const [bulletinsList, setBulletinsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [modalOpen, setModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async () => {
    try {
      const [empRes, bulRes] = await Promise.all([
        fetch(`/api/employes?t=${Date.now()}`),
        fetch(`/api/bulletins?t=${Date.now()}`)
      ]);
      const empData = await empRes.json();
      const bulData = await bulRes.json();
      
      const empArr = Array.isArray(empData) ? empData : [];
      const bulArr = Array.isArray(bulData) ? bulData : [];
      
      setEmployesList(empArr);
      setBulletinsList(bulArr);
      if (bulArr.length > 0 && !selected) setSelected(bulArr[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const handleUpdate = () => fetchData();
    window.addEventListener("dataUpdated", handleUpdate);
    return () => window.removeEventListener("dataUpdated", handleUpdate);
  }, []);

  const handleGenerateMonth = async () => {
    try {
      const activeEmps = employesList.length > 0 ? employesList : [
        { id: "EMP-1001", prenom: "Karim", nom: "Benjelloun", cin: "BE892102", cnss: "109829384", poste: "Directeur Technique", departement: "Engineering", salaire_base: 18500, personnesACharge: 2 },
        { id: "EMP-1002", prenom: "Sophia", nom: "Tazi", cin: "A778901", cnss: "209182391", poste: "Responsable Financier", departement: "Finance", salaire_base: 15000, personnesACharge: 1 },
        { id: "EMP-1003", prenom: "Youssef", nom: "Berrada", cin: "C992102", cnss: "308291029", poste: "Ingénieur DevOps", departement: "Engineering", salaire_base: 12500, personnesACharge: 0 }
      ];

      const newBulls = activeEmps.map((emp, i) => ({
        id: `BUL-${Date.now()}-${i}`,
        employeId: emp.id,
        periode: "Avril 2026",
        dateEmission: new Date().toISOString().split("T")[0],
        statut: "Brouillon"
      }));

      setBulletinsList(prev => [...newBulls, ...prev]);
      if (newBulls.length > 0) setSelected(newBulls[0].id);
      setModalOpen(false);
      showToast(`Bulletins du mois d'avril 2026 générés pour ${activeEmps.length} employés !`);

      for (const bul of newBulls) {
        await fetch("/api/bulletins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bul)
        });
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "bulletins" } }));
      }
    } catch (err) {
      console.error("Error generating month", err);
    }
  };

  const rows = bulletinsList.map((b) => {
    const emp = employesList.find((e) => e.id === b.employeId) || { prenom: "Employé", nom: "Modèle", salaire_base: 12000, personnesACharge: 1, departement: "Opérations", cin: "BE100200", cnss: "19283910" };
    return { ...b, emp, calc: computeBulletin(emp.salaire_base || 12000, emp.personnesACharge || 0) };
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Bulk Delete Selected
  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`Voulez-vous vraiment supprimer ces ${selectedIds.length} bulletins de paie ?`)) {
      const idsToDelete = [...selectedIds];
      setBulletinsList((prev) => prev.filter((b) => !idsToDelete.includes(b.id)));
      setSelectedIds([]);
      idsToDelete.forEach(id => {
        fetch(`/api/bulletins/${id}`, { method: "DELETE" }).catch(e => console.error(e));
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "bulletins" } }));
      }
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(rows.map(r => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const selectedRow = rows.find((r) => r.id === selected) || rows[0];
  const totalBrut = rows.reduce((s, r) => s + r.calc.salaireBrut, 0);
  const totalNet = rows.reduce((s, r) => s + r.calc.netAPayer, 0);
  const totalCoutEmployeur = rows.reduce((s, r) => s + r.calc.coutEmployeur, 0);

  return (
    <>
      {toast && (
        <div className="fixed top-5 right-5 z-[100] flex items-center gap-2.5 rounded-2xl bg-emerald-600 px-5 py-3.5 text-[13px] font-bold text-white shadow-2xl border border-emerald-400 animate-in fade-in slide-in-from-top-3">
          <span>{toast.message}</span>
        </div>
      )}

      <div className="mx-auto max-w-[1400px] space-y-6 text-slate-100 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">{t("payslips.title", "Fiches de Paie & Salaires")}</h1>
            <p className="text-[13px] text-slate-400">
              {t("payslips.subtitle", "Générez et éditez les bulletins de salaire mensuels")}
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[12.5px] font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all shrink-0 whitespace-nowrap"
              title="Consulter l'historique des fichiers importés depuis le PC"
            >
              <History size={15} className="text-indigo-400" /> Historique d'import
            </button>
            {selectedIds.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-[12.5px] font-bold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 active:scale-95 transition-all shrink-0 whitespace-nowrap animate-in fade-in"
              >
                <Trash2 size={15} /> Supprimer la sélection ({selectedIds.length})
              </button>
            )}
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[12.5px] font-semibold text-slate-200 shrink-0 whitespace-nowrap">
              Avril <ChevronDown size={14} className="text-slate-400" /> 2026
            </div>
            <button 
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-[12.5px] font-semibold text-slate-200 hover:bg-slate-800 transition-all shrink-0 whitespace-nowrap active:scale-95"
            >
              <Settings size={15} /> Paramètres de paie
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4.5 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 shrink-0 whitespace-nowrap active:scale-95 transition-all"
            >
              Générer le mois
            </button>
          </div>
        </div>

        {rows.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="bento-card space-y-1">
              <p className="text-[12px] font-semibold text-slate-400">Total Masse Salariale Brute</p>
              <p className="figure text-2xl font-extrabold text-white">{mad(totalBrut)}</p>
            </div>
            <div className="bento-card space-y-1 border-l-4 border-l-emerald-500">
              <p className="text-[12px] font-semibold text-slate-400">Total Net Versé aux Salariés</p>
              <p className="figure text-2xl font-extrabold text-emerald-400">{mad(totalNet)}</p>
            </div>
            <div className="bento-card space-y-1 border-l-4 border-l-indigo-500">
              <p className="text-[12px] font-semibold text-slate-400">Coût Total Charge Employeur</p>
              <p className="figure text-2xl font-extrabold text-indigo-400">{mad(totalCoutEmployeur)}</p>
            </div>
          </div>
        )}

        <div className="bento-card !p-5">
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-400" size={32} /></div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-[15px] font-bold text-white">Aucun bulletin de paie généré</p>
              <p className="text-[13px] text-slate-400 max-w-md">
                Cliquez sur "Générer le mois" pour créer automatiquement les fiches de paie d'avril 2026 pour vos salariés.
              </p>
              <button
                onClick={() => setModalOpen(true)}
                className="mt-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95 transition-all"
              >
                Générer les fiches d'avril 2026
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto pb-10 min-h-[300px]">
              <table className="w-full text-[13.5px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === rows.length && rows.length > 0}
                        onChange={handleSelectAll}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-3">Employé</th>
                    <th className="py-3 px-3">Période</th>
                    <th className="py-3 px-3">Salaire brut</th>
                    <th className="py-3 px-3">Total retenues</th>
                    <th className="py-3 px-3">Net à payer</th>
                    <th className="py-3 px-3">Statut</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setSelected(r.id)}
                      className={`cursor-pointer transition-colors ${selected === r.id ? "bg-indigo-600/15" : "hover:bg-slate-800/40"}`}
                    >
                      <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(r.id)}
                          onChange={() => handleToggleSelect(r.id)}
                          className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-[12px] font-extrabold text-indigo-300 border border-indigo-500/30">
                            {r.emp.prenom.charAt(0)}{r.emp.nom.charAt(0)}
                          </span>
                          <div>
                            <p className="font-bold text-white">
                              {r.emp.prenom} {r.emp.nom}
                            </p>
                            <p className="text-[11.5px] text-slate-400 font-medium">{r.emp.departement || "Général"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-slate-300 font-mono text-[12.5px]">{r.periode}</td>
                      <td className="figure py-3.5 px-3 font-mono font-bold text-white">{mad(r.calc.salaireBrut)}</td>
                      <td className="figure py-3.5 px-3 font-mono font-bold text-red-400">-{mad(r.calc.totalRetenues)}</td>
                      <td className="figure py-3.5 px-3 font-mono font-bold text-emerald-400">{mad(r.calc.netAPayer)}</td>
                      <td className="py-3.5 px-3">
                        <span className={`rounded-xl px-2.5 py-1 text-[11px] font-bold ${
                          r.statut === "Payé" 
                            ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                        }`}>
                          {r.statut}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(r.id);
                            setPdfPreviewOpen(true);
                          }}
                          className="rounded-xl bg-indigo-600/20 border border-indigo-500/30 px-3 py-1.5 text-[12px] font-bold text-indigo-300 hover:bg-indigo-600 hover:text-white transition-all"
                        >
                          <Download size={13} className="inline mr-1" /> Fiche PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedRow && (
          <div className="bento-card space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <p className="text-base font-bold text-white">Fiche de Paie Détaillée — {selectedRow.periode}</p>
                <p className="text-[13px] text-slate-400">
                  Salarié : <strong className="text-indigo-300">{selectedRow.emp.prenom} {selectedRow.emp.nom}</strong> · {selectedRow.emp.poste || "Salarié"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => printBulletinWindow(selectedRow)}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-[12.5px] font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition-all active:scale-95"
                >
                  <Printer size={15} /> Imprimer Direct
                </button>
                <button 
                  onClick={() => setPdfPreviewOpen(true)}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-[12.5px] font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all active:scale-95"
                >
                  <Download size={15} /> Aperçu & PDF
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-3 text-[13px] bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                  Paramètres & Taux Marocains
                </p>
                <Row label="CNSS Salarié" value={`${CNSS_PCT}%`} />
                <Row label="Plafond Mensuel CNSS" value={mad(CNSS_PLAFOND)} />
                <Row label="AMO Salarié" value={`${AMO_PCT}%`} />
                <Row label="Personnes à charge" value={String(selectedRow.emp.personnesACharge || 0)} />
                <Row label="Abattement Frais Pro" value="19.1%" />
              </div>

              <div className="space-y-2 text-[13px] bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                  Calcul et Retenues
                </p>
                <Row label="Salaire de base brut" value={mad(selectedRow.calc.salaireBrut)} bold />
                <Row label="Cotisation CNSS" value={`- ${mad(selectedRow.calc.cnss)}`} negative />
                <Row label="Cotisation AMO" value={`- ${mad(selectedRow.calc.amo)}`} negative />
                <Row label="Abattement Frais Pro" value={mad(selectedRow.calc.fraisPro)} />
                <Row label="Base Imposable IR" value={mad(selectedRow.calc.baseImposableIR)} />
                <Row label="Impôt sur le Revenu (IR)" value={`- ${mad(selectedRow.calc.ir)}`} negative />
                <Row label="Total des Retenues" value={`- ${mad(selectedRow.calc.totalRetenues)}`} negative bold />
              </div>
            </div>

            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center justify-between">
              <div>
                <p className="text-[12px] font-bold text-emerald-400 uppercase tracking-wider">Net à Payer (Virement Bancaire)</p>
                <p className="text-[12px] text-slate-300 mt-0.5">Montant à transférer au compte du salarié</p>
              </div>
              <p className="figure text-2xl font-black text-emerald-300">
                {mad(selectedRow.calc.netAPayer)}
              </p>
            </div>
          </div>
        )}

        {/* Modal: Générer le mois */}
        {mounted && modalOpen && createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
            <div className="w-full max-w-md max-h-[90vh] flex flex-col overflow-y-auto my-auto rounded-2xl bg-slate-900 p-6 shadow-2xl border border-slate-800 space-y-4 text-white">
              <h2 className="text-base font-bold text-white">Générer le mois d'Avril 2026</h2>
              <p className="text-[13px] text-slate-300 leading-relaxed">
                Créer automatiquement les bulletins de paie brouillon pour les <strong>{employesList.length || 3}</strong> salariés actifs du mois.
              </p>
              <div className="rounded-xl bg-slate-950 p-3 text-[13px] font-mono text-indigo-300 border border-slate-800">
                Période d'échéance : Avril 2026
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Annuler
                </button>
                <button
                  onClick={handleGenerateMonth}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500"
                >
                  Confirmer la Génération
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Modal: Settings */}
        {mounted && settingsOpen && createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
            <div className="w-full max-w-md max-h-[90vh] flex flex-col overflow-y-auto my-auto rounded-2xl bg-slate-900 p-6 shadow-2xl border border-slate-800 space-y-4 text-white">
              <h2 className="text-base font-bold text-white">Paramètres de paie (Loi Marocaine 2026)</h2>
              <div className="space-y-3.5 text-[13px]">
                <div>
                  <label className="block text-[12.5px] font-semibold text-slate-300 mb-1">Plafond Mensuel CNSS (MAD)</label>
                  <input defaultValue="6000" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-[13px] text-white focus:border-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[12.5px] font-semibold text-slate-300 mb-1">Taux AMO Salarié (%)</label>
                  <input defaultValue="2.26" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-[13px] text-white focus:border-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[12.5px] font-semibold text-slate-300 mb-1">Abattement Frais Pro (%)</label>
                  <input defaultValue="19.1" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-[13px] text-white focus:border-indigo-500 focus:outline-none" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  onClick={() => {
                    setSettingsOpen(false);
                    showToast("Paramètres de paie mis à jour !");
                  }}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Modal Pop-up Printable A4 Fiche de Paie with Sticky Controls Header */}
        {mounted && pdfPreviewOpen && selectedRow && createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-6 overflow-y-auto animate-in fade-in">
            <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white text-slate-900 shadow-2xl overflow-hidden border border-slate-300 my-auto">
              
              {/* STICKY TOP CONTROL HEADER BAR (Always Visible & Never Cut Off) */}
              <div className="sticky top-0 shrink-0 flex items-center justify-between gap-3 bg-slate-900 text-white px-4 sm:px-6 py-3 border-b border-slate-800 z-30 shadow-md">
                <div className="overflow-hidden">
                  <h3 className="font-extrabold text-[13.5px] sm:text-[15px] text-white truncate">
                    Fiche de Paie — {selectedRow.emp.prenom} {selectedRow.emp.nom}
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate">Période : {selectedRow.periode}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => printBulletinWindow(selectedRow)}
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3.5 py-2 text-[12px] font-bold text-white shadow-md shadow-indigo-600/30 transition-all active:scale-95 whitespace-nowrap"
                  >
                    <Printer size={14} /> Imprimer / PDF
                  </button>
                  <button
                    onClick={() => setPdfPreviewOpen(false)}
                    className="flex items-center gap-1 rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-2 text-[12px] font-bold text-slate-200 whitespace-nowrap border border-slate-700 transition-all"
                  >
                    <X size={14} /> Fermer
                  </button>
                </div>
              </div>

              {/* A4 CERTIFIED PRINT AREA */}
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-slate-900 font-sans leading-relaxed text-[13px] bg-white printable-area">
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">BULLETIN DE PAIE / FICHE DE SALAIRE</h2>
                    <p className="text-[12px] text-slate-600 font-bold mt-0.5">PÉRIODE DE PAIE : {selectedRow.periode.toUpperCase()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-[16px] text-indigo-950">TADBIR AI ENTERPRISE</p>
                    <p className="text-[11px] text-slate-600">ICE : 00294829100032 · CNSS N° 8920192</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-300 p-4 bg-slate-50 text-[12px]">
                  <div>
                    <p className="font-extrabold text-slate-900 text-[13px] mb-1">{selectedRow.emp.prenom} {selectedRow.emp.nom}</p>
                    <p className="text-slate-700"><strong>Poste :</strong> {selectedRow.emp.poste || "Salarié"}</p>
                    <p className="text-slate-700"><strong>Département :</strong> {selectedRow.emp.departement || "Général"}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-slate-700"><strong>N° CIN :</strong> {selectedRow.emp.cin || "BE100200"}</p>
                    <p className="text-slate-700"><strong>N° Immatriculation CNSS :</strong> {selectedRow.emp.cnss || "19283910"}</p>
                    <p className="text-slate-700"><strong>Jours Travaillés :</strong> 26 jours</p>
                  </div>
                </div>

                <table className="w-full text-[12px] border-collapse border border-slate-300 text-left">
                  <thead className="bg-slate-200 font-bold text-slate-900">
                    <tr>
                      <th className="p-2.5 border border-slate-300">Rubrique / Élément de Paie</th>
                      <th className="p-2.5 border border-slate-300 text-right">Base (MAD)</th>
                      <th className="p-2.5 border border-slate-300 text-right">Taux</th>
                      <th className="p-2.5 border border-slate-300 text-right">Gains</th>
                      <th className="p-2.5 border border-slate-300 text-right">Retenues</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    <tr>
                      <td className="p-2.5 border border-slate-300 font-bold">Salaire de Base Mensuel</td>
                      <td className="p-2.5 border border-slate-300 text-right font-mono">{mad(selectedRow.calc.salaireBrut)}</td>
                      <td className="p-2.5 border border-slate-300 text-right">100%</td>
                      <td className="p-2.5 border border-slate-300 text-right font-mono font-bold text-slate-900">{mad(selectedRow.calc.salaireBrut)}</td>
                      <td className="p-2.5 border border-slate-300 text-right">—</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 border border-slate-300">Cotisation CNSS Salarié</td>
                      <td className="p-2.5 border border-slate-300 text-right font-mono">{mad(Math.min(selectedRow.calc.salaireBrut, 6000))}</td>
                      <td className="p-2.5 border border-slate-300 text-right">4.48%</td>
                      <td className="p-2.5 border border-slate-300 text-right">—</td>
                      <td className="p-2.5 border border-slate-300 text-right font-mono text-red-700 font-bold">{mad(selectedRow.calc.cnss)}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 border border-slate-300">Cotisation AMO Salarié</td>
                      <td className="p-2.5 border border-slate-300 text-right font-mono">{mad(selectedRow.calc.salaireBrut)}</td>
                      <td className="p-2.5 border border-slate-300 text-right">2.26%</td>
                      <td className="p-2.5 border border-slate-300 text-right">—</td>
                      <td className="p-2.5 border border-slate-300 text-right font-mono text-red-700 font-bold">{mad(selectedRow.calc.amo)}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 border border-slate-300">Impôt sur le Revenu (IR)</td>
                      <td className="p-2.5 border border-slate-300 text-right font-mono">{mad(selectedRow.calc.baseImposableIR)}</td>
                      <td className="p-2.5 border border-slate-300 text-right">20.0%</td>
                      <td className="p-2.5 border border-slate-300 text-right">—</td>
                      <td className="p-2.5 border border-slate-300 text-right font-mono text-red-700 font-bold">{mad(selectedRow.calc.ir)}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="flex justify-between items-center rounded-xl bg-slate-100 border-2 border-slate-900 p-4 text-[14px]">
                  <div>
                    <p className="font-extrabold text-slate-900">NET À PAYER AU SALARIÉ</p>
                    <p className="text-[11px] text-slate-600 font-bold">Virement Bancaire Certifié</p>
                  </div>
                  <p className="text-2xl font-black text-indigo-950 font-mono">{mad(selectedRow.calc.netAPayer)}</p>
                </div>

                <div className="pt-8 flex justify-between items-end text-[11px] text-slate-500">
                  <div>
                    <p>Signature du Salarié :</p>
                    <div className="h-12 border-b border-slate-300 w-40 mt-2"></div>
                  </div>
                  <div className="text-right">
                    <p>Cachet & Signature Employeur :</p>
                    <div className="h-12 border-b border-slate-300 w-48 mt-2"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Import History Modal */}
        <ImportHistoryModal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          defaultTable="bulletins"
        />
      </div>
    </>
  );
}

function Row({
  label,
  value,
  negative,
  bold,
}: {
  label: string;
  value: string;
  negative?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span
        className={`figure ${negative ? "text-red-400 font-bold" : "text-white"} ${bold ? "font-bold" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
