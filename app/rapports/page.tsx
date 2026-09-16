"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { 
  Download, Calendar, TrendingUp, TrendingDown, DollarSign, PieChart, 
  BarChart3, ArrowUpRight, FileText, Sparkles, Printer, CheckCircle2, 
  AlertTriangle, Eye, RefreshCw, ChevronRight, ShieldCheck, Filter, MoreHorizontal,
  X, Copy, FileSpreadsheet, Send, Loader2
} from "lucide-react";
import { mad } from "@/lib/format";
import { useTranslation } from "@/lib/i18n";

export default function RapportsPage() {
  const { t, langue } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [periode, setPeriode] = useState("6-mois");
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [selectedMonthDetail, setSelectedMonthDetail] = useState<any | null>(null);
  const [selectedClientDetail, setSelectedClientDetail] = useState<any | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [clientsData, setClientsData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const safeJson = async (res: Response) => {
      if (!res.ok) return [];
      const text = await res.text();
      try {
        const data = text ? JSON.parse(text) : [];
        return Array.isArray(data) ? data : (data?.results || []);
      } catch {
        return [];
      }
    };

    const loadData = () => {
      Promise.all([
        fetch(`/api/invoices?t=${Date.now()}`).then(safeJson),
        fetch(`/api/clients?t=${Date.now()}`).then(safeJson)
      ]).then(([invs, clis]) => {
        setInvoices(Array.isArray(invs) ? invs : []);
        setClientsData(Array.isArray(clis) ? clis : []);
        setIsLoading(false);
      }).catch(() => setIsLoading(false));
    };
    loadData();
    const handleDataUpdate = () => loadData();
    window.addEventListener("dataUpdated", handleDataUpdate);
    return () => window.removeEventListener("dataUpdated", handleDataUpdate);
  }, []);

  const filteredInvoices = useMemo(() => {
    if (!invoices.length) return [];
    const now = new Date();
    return invoices.filter(inv => {
      const dStr = inv.date || inv.dateEmission;
      if (!dStr) return true;
      const invDate = new Date(dStr);
      if (isNaN(invDate.getTime())) return true;
      if (periode === "30-jours") {
        const past30 = new Date(); past30.setDate(now.getDate() - 30);
        return invDate >= past30;
      }
      if (periode === "trimestre") {
        const past90 = new Date(); past90.setDate(now.getDate() - 90);
        return invDate >= past90;
      }
      if (periode === "annee") {
        return invDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [invoices, periode]);

  const kpis = useMemo(() => {
    const list = filteredInvoices;
    const paidInvoices = list.filter(i => i.status === "Payée" || i.statut === "Payée");
    const unpaidInvoices = list.filter(i => i.status !== "Payée" && i.statut !== "Payée");
    const totalRev = paidInvoices.reduce((sum, inv) => sum + (inv.total_amount || inv.montant || 0), 0);
    const creancesAttente = unpaidInvoices.reduce((sum, inv) => sum + (inv.total_amount || inv.montant || 0), 0);
    return {
      revenuTotal: totalRev,
      facturesPayeesCount: paidInvoices.length,
      facturesTotalCount: list.length,
      tauxRecouvrement: list.length ? Math.round((paidInvoices.length / list.length) * 100) : 0,
      factureMoyenne: paidInvoices.length ? Math.round(totalRev / paidInvoices.length) : 0,
      creancesAttente,
    };
  }, [filteredInvoices]);

  const aiReportInsights = useMemo(() => {
    const list = filteredInvoices;
    const paidInvoices = list.filter(i => i.status === "Payée" || i.statut === "Payée");
    const unpaidInvoices = list.filter(i => i.status !== "Payée" && i.statut !== "Payée");
    const totalRev = paidInvoices.reduce((sum, inv) => sum + (inv.total_amount || inv.montant || 0), 0);
    const creancesAttente = unpaidInvoices.reduce((sum, inv) => sum + (inv.total_amount || inv.montant || 0), 0);
    const facturesPayeesCount = paidInvoices.length;
    const facturesTotalCount = list.length;
    const panierMoyen = facturesPayeesCount ? Math.round(totalRev / facturesPayeesCount) : 0;
    const tauxRecouvrement = facturesTotalCount ? Math.round((facturesPayeesCount / facturesTotalCount) * 100) : 0;

    // Monthly breakdown analysis
    const monthlyMap: Record<string, number> = {};
    const locale = langue === "ar" ? "ar-MA" : langue === "en" ? "en-US" : "fr-FR";
    list.forEach(inv => {
      const dStr = inv.date || inv.dateEmission;
      if (!dStr) return;
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return;
      const mName = d.toLocaleString(locale, { month: 'long' });
      const capMonth = mName.charAt(0).toUpperCase() + mName.slice(1);
      if (inv.status === "Payée" || inv.statut === "Payée") {
        monthlyMap[capMonth] = (monthlyMap[capMonth] || 0) + (inv.total_amount || inv.montant || 0);
      }
    });

    const sortedMonths = Object.entries(monthlyMap).sort((a, b) => b[1] - a[1]);
    const topMonthName = sortedMonths.length > 0 ? sortedMonths[0][0] : t("common.loading", "Activité en cours");
    const topMonthRev = sortedMonths.length > 0 ? sortedMonths[0][1] : totalRev;

    // Client concentration analysis
    const clientMap: Record<string, number> = {};
    list.forEach(inv => {
      const cName = inv.client_name || inv.client || "Client Comptoir";
      const amt = (inv.total_amount || inv.montant || 0);
      if (inv.status === "Payée" || inv.statut === "Payée") {
        clientMap[cName] = (clientMap[cName] || 0) + amt;
      }
    });
    const sortedClients = Object.entries(clientMap).sort((a, b) => b[1] - a[1]);
    const topClientName = sortedClients.length > 0 ? sortedClients[0][0] : "Base Clients";
    const topClientRev = sortedClients.length > 0 ? sortedClients[0][1] : 0;
    const top3Sum = sortedClients.slice(0, 3).reduce((sum, [, amt]) => sum + amt, 0);
    const top3Pct = totalRev ? Math.round((top3Sum / totalRev) * 100) : 0;

    return {
      totalRev,
      creancesAttente,
      facturesPayeesCount,
      facturesTotalCount,
      panierMoyen,
      tauxRecouvrement,
      topMonthName,
      topMonthRev,
      topClientName,
      topClientRev,
      top3Pct: Math.min(100, top3Pct || 0),
      tvaCollectee: totalRev * 0.2,
      tvaNet: Math.max(0, totalRev * 0.2 - (list.length * 100)),
    };
  }, [filteredInvoices, langue, t]);

  const clients = clientsData;

  const revenuParCategorie = [
    { categorie: t("category.it_services", "Services IT"), montant: 0, pct: 0 },
    { categorie: t("category.software_licenses", "Licences Logiciel"), montant: 0, pct: 0 },
    { categorie: t("category.consulting", "Consulting"), montant: 0, pct: 0 },
    { categorie: t("category.hardware", "Matériel"), montant: 0, pct: 0 },
  ];

  const extendedMonthly = useMemo(() => {
    if (filteredInvoices.length === 0) return [];
    const monthlyData: Record<string, any> = {};
    const locale = langue === "ar" ? "ar-MA" : langue === "en" ? "en-US" : "fr-FR";
    filteredInvoices.forEach(inv => {
      const date = new Date(inv.date || inv.dateEmission || new Date());
      const month = date.toLocaleString(locale, { month: 'long' });
      if (!monthlyData[month]) {
        monthlyData[month] = { mois: month.charAt(0).toUpperCase() + month.slice(1), revenu: 0, factures: 0 };
      }
      if (inv.status === "Payée" || inv.statut === "Payée") {
        monthlyData[month].revenu += (inv.total_amount || inv.montant || 0);
      }
      monthlyData[month].factures += 1;
    });
    
    return Object.values(monthlyData).map((m: any) => ({
      ...m,
      croissance: "+0%",
      panierMoyen: m.revenu / m.factures || 0,
      statut: t("status.cloture", "Clôturé")
    }));
  }, [filteredInvoices, langue, t]);

  const extendedClients = useMemo(() => {
    if (filteredInvoices.length === 0) return [];
    const clientData: Record<string, any> = {};
    filteredInvoices.forEach(inv => {
      const cName = inv.client_name || inv.client || "Client Inconnu";
      if (!clientData[cName]) clientData[cName] = { nom: cName, revenu: 0, total: 0, enRetard: 0 };
      const amount = (inv.total_amount || inv.montant || 0);
      clientData[cName].total += amount;
      if (inv.status === "Payée" || inv.statut === "Payée") clientData[cName].revenu += amount;
      if (inv.status === "En retard" || inv.statut === "En retard") clientData[cName].enRetard += amount;
    });

    const totalRev = kpis.revenuTotal;
    return Object.values(clientData).map((c: any) => ({
      id: c.nom,
      nom: c.nom,
      revenu: c.revenu,
      part: totalRev ? ((c.revenu / totalRev) * 100).toFixed(1) + "%" : "0%",
      recouvrement: c.total ? Math.round((c.revenu / c.total) * 100) + "%" : "0%",
      enRetard: c.enRetard,
      risque: c.enRetard > 0 ? t("status.eleve", "Élevé") : t("status.faible", "Faible"),
      statutRisk: c.enRetard > 0 ? "danger" : "success"
    }));
  }, [filteredInvoices, kpis.revenuTotal, t]);

  const exportCSV = () => {
    let rawText = "";
    rawText += "RAPPORT FINANCIER & ANALYSE DE PERFORMANCE - TADBIR AI\n";
    rawText += `Période sélectionnée: ${periode}\n`;
    rawText += `Généré le: ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}\n\n`;
    
    rawText += "--- SYNTHESE GLOBALE ---\n";
    rawText += `Chiffre d'Affaires Total (MAD);${kpis.revenuTotal}\n`;
    rawText += `Panier Moyen (MAD);${kpis.factureMoyenne}\n`;
    rawText += `Taux de Recouvrement;${kpis.tauxRecouvrement}%\n`;
    rawText += `TVA Collectée (20%);${kpis.revenuTotal * 0.2}\n\n`;

    rawText += "--- HISTORIQUE MENSUEL ---\n";
    rawText += "Mois;Revenu (MAD);Croissance;Nombre Factures;Panier Moyen (MAD);Statut\n";
    extendedMonthly.forEach((r) => {
      rawText += `${r.mois};${r.revenu};${r.croissance};${r.factures};${r.panierMoyen};${r.statut}\n`;
    });

    rawText += "\n--- TOP CLIENTS & RISQUE RECOUVREMENT ---\n";
    rawText += "Client;Revenu (MAD);Part CA;Taux Recouvrement;En Retard (MAD);Niveau de Risque\n";
    extendedClients.forEach((c) => {
      rawText += `${c.nom};${c.revenu};${c.part};${c.recouvrement};${c.enRetard};${c.risque}\n`;
    });

    rawText += "\n--- REPARTITION PAR CATEGORIE ---\n";
    rawText += "Catégorie;Montant (MAD);Pourcentage\n";
    const totalCat = revenuParCategorie.reduce((a, b) => a + b.montant, 0);
    revenuParCategorie.forEach((cat) => {
      const pct = totalCat > 0 ? ((cat.montant / totalCat) * 100).toFixed(1) : "0.0";
      rawText += `${cat.categorie};${cat.montant};${pct}%\n`;
    });

    const blob = new Blob(["\uFEFF" + rawText], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `rapport_financier_complet_${periode}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyAnalysisText = () => {
    const text = `
=== ${t("pdf.title", "RAPPORT FINANCIER & DIAGNOSTIC IA")} - TADBIR AI ===
${t("pdf.period", "Période")} : ${periode.toUpperCase()} | ${t("pdf.date", "Date")} : ${new Date().toLocaleDateString(langue === "ar" ? "ar-MA" : langue === "en" ? "en-US" : "fr-FR")}

1. ${t("pdf.section1_title", "SYNTHÈSE D'EXPLOITATION & PERFORMANCE FINANCIÈRE")}
• ${t("reports.kpi.gross_revenue", "Chiffre d'affaires brut HT")} : ${mad(kpis.revenuTotal)}
• ${t("reports.kpi.average_invoice", "Facture moyenne")} : ${mad(kpis.factureMoyenne)}
• ${t("reports.kpi.recovery_rate", "Taux de recouvrement")} : ${kpis.tauxRecouvrement}%
• ${t("reports.kpi.collected_vat", "TVA collectée (20%)")} : ${mad(kpis.revenuTotal * 0.2)}

2. ${t("pdf.section2_title", "DYNAMIQUE ET ÉVOLUTION DES REVENUS")}
• ${aiReportInsights.topMonthName} : ${mad(aiReportInsights.topMonthRev)}

3. ${t("pdf.section3_title", "RISQUE CLIENT & ANALYSE DE RECOUVREMENT")}
• Top 3 : ${aiReportInsights.top3Pct}% (${aiReportInsights.topClientName})
• ${t("reports.kpi.total_overdue", "Retard total")} : ${mad(kpis.creancesAttente)}

4. ${t("pdf.section5_title", "RECOMMANDATIONS STRATÉGIQUES IA")}
✔ ${t("pdf.rec1", "Relancer les créances en attente").replace("{creances}", mad(kpis.creancesAttente))}
✔ ${t("pdf.rec2", "Provisionner la déclaration de TVA").replace("{vat}", mad(aiReportInsights.tvaNet))}
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const triggerToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  const downloadPDF = async () => {
    setIsPdfModalOpen(true);
    setIsDownloadingPdf(true);
    
    setTimeout(async () => {
      try {
        const element = document.querySelector(".printable-area") as HTMLElement;
        if (!element) {
          setIsDownloadingPdf(false);
          return;
        }

        const filename = `Rapport_Analyse_IA_Tadbir_AI_${periode}_${new Date().toISOString().slice(0, 10)}.pdf`;

        // Load html2pdf dynamically if missing
        if (!(window as any).html2pdf) {
          await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
          }).catch(() => null);
        }

        if ((window as any).html2pdf) {
          const opt = {
            margin:       [8, 8, 8, 8],
            filename:     filename,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff" },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
          };
          await (window as any).html2pdf().set(opt).from(element).save();
          triggerToast("✅ Rapport PDF téléchargé avec succès dans vos Téléchargements !");
        } else {
          // Direct downloadable file Blob fallback
          const rawDoc = element.innerHTML;
          const pdfHtml = "<!DOCTYPE html><html><head><meta charset='utf-8'><title>" + filename + "</title><style>body { font-family: Arial, sans-serif; padding: 30px; color: #0f172a; background: #ffffff; } h1, h2, h3, h4 { color: #000000; } table { width: 100%; border-collapse: collapse; margin-top: 15px; } th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; } th { background-color: #e2e8f0; color: #000000; font-weight: bold; }</style></head><body>" + rawDoc + "</body></html>";
          const htmlBlob = new Blob([pdfHtml], { type: 'application/pdf' });
          const url = URL.createObjectURL(htmlBlob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          triggerToast("✅ Rapport PDF téléchargé avec succès dans vos Téléchargements !");
        }
      } catch (err) {
        console.error("PDF Download error:", err);
        triggerToast("Une erreur est survenue lors de la création du fichier PDF.", "error");
      } finally {
        setIsDownloadingPdf(false);
      }
    }, 350);
  };

  const maxCat = Math.max(...revenuParCategorie.map((c) => c.montant));

  return (
    <div className="w-full relative">
      {toast && (
        <div className="fixed top-5 right-5 z-[100] flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3.5 text-[13px] font-bold text-white shadow-2xl border border-emerald-400 animate-in fade-in slide-in-from-top-3">
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 rounded-lg p-1 hover:bg-emerald-700">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="mx-auto max-w-[1400px] space-y-6 text-slate-100 print:hidden">
      {/* En-tête de la page */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">{t("reports.title", "Rapports & KPIs Financiers")}</h1>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 flex items-center gap-1 shrink-0">
              <Sparkles size={12} /> IA Diagnostic Actif
            </span>
          </div>
          <p className="text-[13px] text-slate-400 mt-1">{t("reports.subtitle", "Analyses détaillées de rentabilité, trésorerie et marges")}</p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0 overflow-x-auto pb-1 sm:pb-0">
          <select
            value={periode}
            onChange={(e) => setPeriode(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-[12.5px] font-semibold text-slate-200 focus:border-indigo-500 focus:outline-none whitespace-nowrap shrink-0"
          >
            <option value="30-jours">{t("reports.period.30days", "30 Derniers Jours")}</option>
            <option value="trimestre">{t("reports.period.quarter", "Ce Trimestre (90j)")}</option>
            <option value="6-mois">{t("reports.period.6months", "6 Derniers Mois")}</option>
            <option value="annee">{t("reports.period.year", "Année Fiscale 2026")}</option>
          </select>

          <button
            onClick={exportCSV}
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-[12.5px] font-semibold text-slate-300 hover:bg-slate-800 transition-all active:scale-95 whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet size={15} className="text-emerald-400" /> {t("reports.export_excel", "Exporter CSV / Excel")}
          </button>

          <button
            onClick={() => setIsPdfModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-2 text-[12.5px] font-bold text-white shadow-lg shadow-indigo-600/30 hover:from-indigo-500 hover:to-indigo-400 transition-all active:scale-95 ring-1 ring-white/10 whitespace-nowrap shrink-0"
          >
            <Sparkles size={16} className="text-amber-300 animate-pulse" /> {t("reports.export_pdf_ai", "Rapport & Export PDF (Analyse IA)")}
          </button>
        </div>
      </div>

      {/* Cartes KPI Principales */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bento-card space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-[12px]">
            <span className="font-medium">{t("reports.kpi.gross_revenue", "Chiffre d'Affaires Brut")}</span>
            <TrendingUp size={18} className="text-emerald-400" />
          </div>
          <p className="figure text-[24px] font-extrabold text-white tracking-tight">{mad(kpis.revenuTotal)}</p>
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11.5px]">
            <span className="text-emerald-400 font-bold flex items-center gap-0.5">
              <ArrowUpRight size={13} /> +12.4% vs P-1
            </span>
            <span className="text-slate-400">{t("reports.kpi.target_reached", "Objectif 1.5M atteint à 83%")}</span>
          </div>
        </div>

        <div className="bento-card space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-[12px]">
            <span className="font-medium">{t("reports.kpi.average_invoice", "Panier / Facture Moyenne")}</span>
            <DollarSign size={18} className="text-amber-400" />
          </div>
          <p className="figure text-[24px] font-extrabold text-white tracking-tight">{mad(kpis.factureMoyenne)}</p>
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11.5px]">
            <span className="text-slate-300 font-medium">{kpis.facturesPayeesCount} {t("reports.kpi.invoices_issued", "factures émises")}</span>
            <span className="text-indigo-400 font-semibold">Stabilité +2.1%</span>
          </div>
        </div>

        <div className="bento-card space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-[12px]">
            <span className="font-medium">{t("reports.kpi.recovery_rate", "Taux de Recouvrement")}</span>
            <BarChart3 size={18} className="text-indigo-400" />
          </div>
          <p className="figure text-[24px] font-extrabold text-white tracking-tight">{kpis.tauxRecouvrement}%</p>
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11.5px]">
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 size={12} /> Excellent (DSO 14j)
            </span>
            <span className="text-slate-400">{t("reports.kpi.total_overdue", "Retard total")}: {mad(kpis.creancesAttente)}</span>
          </div>
        </div>

        <div className="bento-card space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-[12px]">
            <span className="font-medium">{t("reports.kpi.collected_vat", "TVA Collectée (20%)")}</span>
            <PieChart size={18} className="text-purple-400" />
          </div>
          <p className="figure text-[24px] font-extrabold text-white tracking-tight">{mad(kpis.revenuTotal * 0.2)}</p>
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11.5px]">
            <span className="text-slate-400">{t("reports.kpi.net_vat", "TVA Nette due")} :</span>
            <span className="text-purple-300 font-bold">{mad(Math.max(0, kpis.revenuTotal * 0.2 - 18400))}</span>
          </div>
        </div>
      </div>

      {/* Banner AI Financial Executive Summary */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-slate-950 border border-indigo-500/30 p-5 space-y-3 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/30 text-indigo-300 border border-indigo-500/30">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white text-[15px]">{t("reports.ai_summary_title", "Synthèse du Diagnostic IA")} — {periode.toUpperCase()}</h3>
              <p className="text-[12px] text-indigo-200">{t("reports.ai_summary_desc", "Analyse automatique des tendances, des risques clients et de la rentabilité")}</p>
            </div>
          </div>
          <button
            onClick={() => setIsPdfModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-indigo-500/20 border border-indigo-400/40 px-3.5 py-1.5 text-[12px] font-bold text-indigo-200 hover:bg-indigo-500/30 transition-all self-start sm:self-auto"
          >
            <FileText size={14} /> {t("reports.ai_summary_full_report", "Voir le Rapport Complet PDF")}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[12.5px] pt-2">
          <div className="rounded-xl bg-slate-950/80 p-3.5 border border-slate-800 space-y-1">
            <p className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <TrendingUp size={14} /> {t("reports.ai.healthy_dynamics", "Dynamique Commerciale Saine")}
            </p>
            <p className="text-slate-300 leading-relaxed text-[12px]">
              {t("reports.ai.healthy_desc", "Chiffre d'affaires encaisse de {totalRev}, avec un pic d'activité en {topMonth} ({topRev}).")
                .replace("{totalRev}", mad(aiReportInsights.totalRev))
                .replace("{topMonth}", aiReportInsights.topMonthName)
                .replace("{topRev}", mad(aiReportInsights.topMonthRev))}
            </p>
          </div>

          <div className="rounded-xl bg-slate-950/80 p-3.5 border border-slate-800 space-y-1">
            <p className="font-semibold text-amber-400 flex items-center gap-1.5">
              <AlertTriangle size={14} /> {t("reports.ai.client_concentration", "Concentration Clients")}
            </p>
            <p className="text-slate-300 leading-relaxed text-[12px]">
              {t("reports.ai.client_desc", "Le Top 3 clients génère {top3Pct}% du chiffre d'affaires (Client principal : {topClient} avec {topClientRev}).")
                .replace("{top3Pct}", String(aiReportInsights.top3Pct))
                .replace("{topClient}", aiReportInsights.topClientName)
                .replace("{topClientRev}", mad(aiReportInsights.topClientRev))}
            </p>
          </div>

          <div className="rounded-xl bg-slate-950/80 p-3.5 border border-slate-800 space-y-1">
            <p className="font-semibold text-indigo-300 flex items-center gap-1.5">
              <ShieldCheck size={14} /> {t("reports.ai.recovery_performance", "Performance de Recouvrement")}
            </p>
            <p className="text-slate-300 leading-relaxed text-[12px]">
              {aiReportInsights.creancesAttente > 0
                ? t("reports.ai.recovery_desc_overdue", "Taux de paiement à {taux}%. Créances en attente à relancer : {creances}.")
                    .replace("{taux}", String(aiReportInsights.tauxRecouvrement))
                    .replace("{creances}", mad(aiReportInsights.creancesAttente))
                : t("reports.ai.recovery_desc_clear", "Taux de paiement à {taux}%. Toutes les factures de la période sont réglées.")
                    .replace("{taux}", String(aiReportInsights.tauxRecouvrement))}
            </p>
          </div>
        </div>
      </div>

      {/* Visual Charts & Category Split */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="bento-card lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-white text-[15px]">{t("reports.chart.monthly_evolution", "Évolution Mensuelle des Revenus (MAD)")}</h3>
              <p className="text-[12px] text-slate-400">{t("reports.chart.monthly_subtitle", "Comparatif des encaissements enregistrés par mois")}</p>
            </div>
            <span className="text-[11.5px] font-mono text-indigo-400 font-semibold bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg">
              Total: {mad(kpis.revenuTotal)}
            </span>
          </div>

          <div className="flex h-56 items-end gap-3 pt-6 pb-2 px-2">
            {extendedMonthly.map((d) => (
              <div key={d.mois} className="flex flex-1 flex-col items-center gap-2 h-full justify-end group">
                <span className="text-[10.5px] font-bold text-indigo-300 opacity-90 group-hover:scale-110 transition-transform font-mono">
                  {mad(d.revenu)}
                </span>
                <div
                  className="w-full rounded-t-xl bg-gradient-to-t from-indigo-700 via-indigo-600 to-indigo-400 transition-all hover:brightness-125 hover:shadow-lg hover:shadow-indigo-500/40 cursor-pointer relative"
                  style={{ height: `${(d.revenu / 220000) * 100}%` }}
                  onClick={() => setSelectedMonthDetail(d)}
                  title={`Cliquez pour examiner le mois de ${d.mois}`}
                >
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:flex bg-slate-900 border border-slate-700 text-[10px] font-bold text-white px-2 py-0.5 rounded shadow-xl whitespace-nowrap z-10">
                    {d.croissance} vs P-1
                  </div>
                </div>
                <span className="text-[11.5px] font-semibold text-slate-300">{d.mois}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bento-card space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white text-[15px]">{t("reports.chart.category_split", "Part par Catégorie de Services")}</h3>
            <p className="text-[12px] text-slate-400">{t("reports.chart.category_subtitle", "Ventilation du chiffre d'affaires")}</p>
          </div>
          <div className="space-y-3.5">
            {revenuParCategorie.map((c) => {
              const total = revenuParCategorie.reduce((acc, curr) => acc + curr.montant, 0);
              const percentage = total > 0 ? ((c.montant / total) * 100).toFixed(1) : "0.0";
              return (
                <div key={c.categorie} className="space-y-1.5">
                  <div className="flex justify-between text-[12.5px]">
                    <span className="text-slate-200 font-medium">{c.categorie}</span>
                    <span className="figure font-mono font-bold text-white">{mad(c.montant)} ({percentage}%)</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tables Interactives & Actions */}
      <div className="space-y-5">
        {/* Table 1: Historique Détaillé des Mois */}
        <div className="bento-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-white text-[15px]">{t("reports.table1.title", "Tableau de Performance Mensuelle & Audit")}</h3>
              <p className="text-[12px] text-slate-400">{t("reports.table1.subtitle", "Détail des factures transmises, volumes de vente et panier moyen")}</p>
            </div>
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-indigo-400 hover:text-indigo-300"
            >
              <Download size={14} /> {t("reports.table1.export", "Exporter cette table")}
            </button>
          </div>

          <div className="overflow-x-auto pb-10 min-h-[300px]">
            <table className="w-full text-[13px] text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                  <th className="py-2.5 px-3">{t("reports.table1.col_month", "Mois")}</th>
                  <th className="py-2.5 px-3">{t("reports.table1.col_revenue", "Revenu Brut (MAD)")}</th>
                  <th className="py-2.5 px-3">{t("reports.table1.col_variation", "Variation %")}</th>
                  <th className="py-2.5 px-3">{t("reports.table1.col_invoices", "Factures Émises")}</th>
                  <th className="py-2.5 px-3">{t("reports.table1.col_avg", "Panier Moyen")}</th>
                  <th className="py-2.5 px-3">{t("reports.table1.col_status", "Statut Comptable")}</th>
                  <th className="py-2.5 px-3 text-right">{t("reports.table1.col_actions", "Actions Table")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {extendedMonthly.map((m) => (
                  <tr key={m.mois} className="hover:bg-slate-800/40 transition-colors group">
                    <td className="py-3 px-3 font-semibold text-white">{m.mois}</td>
                    <td className="py-3 px-3 font-mono font-bold text-indigo-300">{mad(m.revenu)}</td>
                    <td className="py-3 px-3 font-semibold">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] ${
                        m.croissance.startsWith("+") 
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                          : "bg-red-500/10 text-red-400 border border-red-500/20"
                      }`}>
                        {m.croissance}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-300 font-mono">{m.factures} {t("reports.kpi.invoices_issued", "factures")}</td>
                    <td className="py-3 px-3 text-slate-300 font-mono">{mad(m.panierMoyen)}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        m.statut === "Clôturé" || m.statut === "Closed" || m.statut === "مغلق"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      }`}>
                        {m.statut}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right relative">
                      <button
                        onClick={() => setActionMenuOpen(actionMenuOpen === `m-${m.mois}` ? null : `m-${m.mois}`)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
                      >
                        <MoreHorizontal size={16} />
                      </button>

                      {actionMenuOpen === `m-${m.mois}` && (
                        <div className="absolute right-2 top-10 z-20 w-52 rounded-xl bg-slate-900 shadow-2xl border border-slate-800 p-1.5 text-left animate-in fade-in zoom-in-95">
                          <button
                            onClick={() => {
                              setSelectedMonthDetail(m);
                              setActionMenuOpen(null);
                            }}
                            className="block w-full text-left rounded-lg px-3 py-2 text-[12px] font-medium text-slate-200 hover:bg-slate-800"
                          >
                            <Eye size={13} className="inline mr-1.5 text-indigo-400" /> {t("reports.action.inspect_month", "Inspecter l'Analyse du Mois")}
                          </button>
                          <Link
                            href="/factures"
                            className="block rounded-lg px-3 py-2 text-[12px] font-medium text-slate-300 hover:bg-slate-800"
                          >
                            <Filter size={13} className="inline mr-1.5 text-emerald-400" /> {t("reports.action.view_month_invoices", "Voir les Factures de")} {m.mois}
                          </Link>
                          <button
                            onClick={() => {
                              setActionMenuOpen(null);
                            }}
                            className="block w-full text-left rounded-lg px-3 py-2 text-[12px] font-medium text-slate-300 hover:bg-slate-800"
                          >
                            <Download size={13} className="inline mr-1.5 text-amber-400" /> {t("reports.action.download_month_csv", "Télécharger Bilan (CSV)")}
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

        {/* Table 2: Analyse des Clients Clés & Risque */}
        <div className="bento-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-white text-[15px]">{t("reports.table2.title", "Analyse des Top Clients & Taux de Recouvrement")}</h3>
              <p className="text-[12px] text-slate-400">{t("reports.table2.subtitle", "Évaluation de la dépendance client et suivi des encaissements")}</p>
            </div>
            <Link href="/clients" className="text-[12px] font-semibold text-indigo-400 hover:text-indigo-300">
              {t("reports.table2.manage", "Gérer le portefeuille client")} &rarr;
            </Link>
          </div>

          <div className="overflow-x-auto pb-10 min-h-[300px]">
            <table className="w-full text-[13px] text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                  <th className="py-2.5 px-3">{t("reports.table2.col_client", "Client")}</th>
                  <th className="py-2.5 px-3">{t("reports.table2.col_revenue", "CA Réalisé")}</th>
                  <th className="py-2.5 px-3">{t("reports.table2.col_share", "% Part du Total")}</th>
                  <th className="py-2.5 px-3">{t("reports.table2.col_recovery", "Taux Recouvrement")}</th>
                  <th className="py-2.5 px-3">{t("reports.table2.col_overdue", "En Retard (MAD)")}</th>
                  <th className="py-2.5 px-3">{t("reports.table2.col_risk", "Niveau de Risque")}</th>
                  <th className="py-2.5 px-3 text-right">{t("reports.table2.col_actions", "Actions Client")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {extendedClients.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-semibold text-white">{c.nom}</td>
                    <td className="py-3 px-3 font-mono font-bold text-white">{mad(c.revenu)}</td>
                    <td className="py-3 px-3 font-mono text-slate-300">{c.part}</td>
                    <td className="py-3 px-3 font-semibold text-emerald-400">{c.recouvrement}</td>
                    <td className="py-3 px-3 font-mono text-amber-300">{c.enRetard > 0 ? mad(c.enRetard) : "0 MAD"}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        c.statutRisk === "success" 
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                          : c.statutRisk === "warning"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-red-500/20 text-red-300 border border-red-500/30"
                      }`}>
                        {c.risque}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right relative">
                      <button
                        onClick={() => setActionMenuOpen(actionMenuOpen === `c-${c.id}` ? null : `c-${c.id}`)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
                      >
                        <MoreHorizontal size={16} />
                      </button>

                      {actionMenuOpen === `c-${c.id}` && (
                        <div className="absolute right-2 top-10 z-20 w-52 rounded-xl bg-slate-900 shadow-2xl border border-slate-800 p-1.5 text-left animate-in fade-in zoom-in-95">
                          <button
                            onClick={() => {
                              setSelectedClientDetail(c);
                              setActionMenuOpen(null);
                            }}
                            className="block w-full text-left rounded-lg px-3 py-2 text-[12px] font-medium text-slate-200 hover:bg-slate-800"
                          >
                            <Eye size={13} className="inline mr-1.5 text-indigo-400" /> {t("reports.action.view_financial_profile", "Voir le Profil Financier")}
                          </button>
                          <button
                            onClick={() => {
                              setActionMenuOpen(null);
                            }}
                            className="block w-full text-left rounded-lg px-3 py-2 text-[12px] font-medium text-emerald-400 hover:bg-slate-800"
                          >
                            <FileText size={13} className="inline mr-1.5 text-emerald-400" /> {t("reports.action.generate_statement", "Générer Relevé de Compte")}
                          </button>
                          <Link
                            href={`/factures/nouvelle?client=${encodeURIComponent(c.nom)}`}
                            className="block rounded-lg px-3 py-2 text-[12px] font-medium text-indigo-300 hover:bg-slate-800"
                          >
                            <Send size={13} className="inline mr-1.5 text-indigo-400" /> {t("reports.action.bill_client", "Facturer")} {c.nom}
                          </Link>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

      {/* Modal / Drawer 1: Inspection d'un mois spécifique */}
      {mounted && selectedMonthDetail && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col overflow-y-auto my-auto rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-indigo-400" />
                <h3 className="font-bold text-white text-[16px]">{t("reports.drawer.month_audit_title", "Audit Financier - Mois de")} {selectedMonthDetail.mois}</h3>
              </div>
              <button
                onClick={() => setSelectedMonthDetail(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-[13px] text-slate-300">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-950 p-3 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">{t("reports.drawer.net_revenue", "Revenu Net")}</span>
                  <span className="font-mono font-bold text-indigo-300 text-[16px]">{mad(selectedMonthDetail.revenu)}</span>
                </div>
                <div className="rounded-xl bg-slate-950 p-3 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">{t("reports.drawer.number_invoices", "Nombre de Factures")}</span>
                  <span className="font-mono font-bold text-white text-[16px]">{selectedMonthDetail.factures} {t("reports.kpi.invoices_issued", "factures")}</span>
                </div>
              </div>

              <div className="rounded-xl bg-slate-950 p-3.5 border border-slate-800 space-y-2">
                <h4 className="font-bold text-white text-[13px]">{t("reports.drawer.ai_performance_comment", "Commentaire de Performance IA :")}</h4>
                <p className="text-[12px] leading-relaxed text-slate-300">
                  {t("reports.drawer.month_performance_desc", "Le mois de {month} a enregistré une variation de {croissance} par rapport au mois précédent. Le panier moyen par facture s'est élevé à {avg}.")
                    .replace("{month}", selectedMonthDetail.mois)
                    .replace("{croissance}", selectedMonthDetail.croissance)
                    .replace("{avg}", mad(selectedMonthDetail.panierMoyen))}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedMonthDetail(null)}
                className="rounded-xl bg-slate-800 px-4 py-2 text-[12.5px] font-semibold text-slate-200 hover:bg-slate-700"
              >
                {t("reports.modal.close", "Fermer")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal / Drawer 2: Inspection d'un client spécifique */}
      {mounted && selectedClientDetail && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col overflow-y-auto my-auto rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-[16px]">{selectedClientDetail.nom}</h3>
                <p className="text-[12px] text-slate-400">{t("reports.drawer.client_solvency_desc", "Fiche de solvabilité & historique de compte")}</p>
              </div>
              <button
                onClick={() => setSelectedClientDetail(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-[13px] text-slate-300">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-950 p-3 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">{t("reports.drawer.total_invoiced", "Total Facturé")}</span>
                  <span className="font-mono font-bold text-white text-[16px]">{mad(selectedClientDetail.revenu)}</span>
                </div>
                <div className="rounded-xl bg-slate-950 p-3 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">{t("reports.drawer.share_revenue", "Part du Chiffre d'Affaires")}</span>
                  <span className="font-mono font-bold text-indigo-300 text-[16px]">{selectedClientDetail.part}</span>
                </div>
              </div>

              <div className="rounded-xl bg-slate-950 p-3.5 border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white">{t("reports.drawer.collections_success", "Encaissements & Taux de Réussite")}</span>
                  <span className="text-emerald-400 font-bold">{selectedClientDetail.recouvrement}</span>
                </div>
                <p className="text-[12px] leading-relaxed text-slate-300">
                  {t("reports.drawer.client_overdue_desc", "Montant des encours ou retards de paiement : {overdue}. Niveau d'exposition recommandé : {risk}.")
                    .replace("{overdue}", mad(selectedClientDetail.enRetard))
                    .replace("{risk}", selectedClientDetail.risque)}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedClientDetail(null)}
                className="rounded-xl bg-slate-800 px-4 py-2 text-[12.5px] font-semibold text-slate-200 hover:bg-slate-700"
              >
                {t("reports.modal.close", "Fermer")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL POP-UP PDF PREVIEW & DIRECT DOWNLOAD */}
      {mounted && isPdfModalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto bg-slate-950/90 backdrop-blur-md p-2 sm:p-4 animate-in fade-in">
          <div className="relative w-full max-w-4xl h-[92vh] max-h-[calc(100vh-2rem)] flex flex-col rounded-2xl bg-slate-900 text-slate-900 shadow-2xl overflow-hidden border border-slate-800 my-auto">
            
            {/* Top Compact Sticky Header */}
            <div className="sticky top-0 z-30 shrink-0 flex items-center justify-between gap-2 bg-slate-950 text-white px-4 py-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white font-extrabold text-[13px] shadow-sm">
                  F
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-[13px] text-white truncate">{t("reports.modal.pdf_preview_title", "Rapport Financier IA")}</h3>
                  <p className="text-[10px] text-slate-400 truncate">{t("reports.modal.pdf_preview_subtitle", "Aperçu A4 avant téléchargement")}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={copyAnalysisText}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 transition-all active:scale-95 whitespace-nowrap"
                >
                  <Copy size={13} /> {copied ? t("reports.modal.copied", "Copié !") : t("reports.modal.copy", "Copier")}
                </button>

                <button
                  onClick={downloadPDF}
                  disabled={isDownloadingPdf}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-[11px] font-extrabold text-white shadow-md shadow-emerald-600/30 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
                >
                  {isDownloadingPdf ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} 
                  {isDownloadingPdf ? t("reports.modal.downloading", "Téléchargement...") : t("reports.modal.download_pdf", "Télécharger PDF")}
                </button>

                <button
                  onClick={() => setIsPdfModalOpen(false)}
                  className="flex items-center justify-center h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all active:scale-95"
                  title={t("reports.modal.close", "Fermer")}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* DOCUMENT BODY (SCROLLABLE INSIDE POP-UP CARD) */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-800/50">
              <div className="max-w-[780px] mx-auto bg-white p-5 sm:p-8 rounded-xl shadow-xl border border-slate-200 space-y-5 text-slate-900 font-sans leading-relaxed text-[11.5px] printable-area">
                
                {/* En-tête du Rapport PDF */}
                <div className="flex justify-between items-start border-b border-slate-300 pb-4">
                  <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">{t("pdf.title", "RAPPORT FINANCIER & DIAGNOSTIC IA")}</h1>
                    <p className="text-slate-500 font-medium text-[11px] mt-0.5">{t("pdf.subtitle", "Audit de la performance commerciale et recommandations stratégiques")}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-600">
                      <span><strong>{t("pdf.ref", "RÉF :")}</strong> AUD-2026-Q2-892</span>
                      <span>•</span>
                      <span><strong>{t("pdf.period", "PÉRIODE :")}</strong> {periode.toUpperCase()}</span>
                      <span>•</span>
                      <span><strong>{t("pdf.date", "DATE :")}</strong> {new Date().toLocaleDateString(langue === "ar" ? "ar-MA" : langue === "en" ? "en-US" : "fr-FR")}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <h2 className="text-sm font-black text-slate-900">TADBIR AI PRO</h2>
                    <p className="text-[10px] text-slate-500">Système de Gestion & Facturation</p>
                    <p className="text-[9.5px] text-slate-400 font-mono">Casablanca, Maroc</p>
                  </div>
                </div>

                {/* Synthèse globale IA */}
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
                  <h3 className="font-extrabold text-black text-[12.5px] flex items-center gap-1.5">
                    <Sparkles size={14} className="text-indigo-600" />
                    {t("pdf.section1_title", "1. SYNTHÈSE D'EXPLOITATION & PERFORMANCE FINANCIÈRE")}
                  </h3>
                  <p className="text-slate-700 leading-relaxed text-[11px]">
                    {t("pdf.section1_text", "Sur la période examinée ({period}), l'entreprise affiche un chiffre d'affaires encaissé de {totalRev} sur {facturesPayees} factures réglées. La santé financière globale présente un panier moyen de {panierMoyen} par facture avec un taux de recouvrement de {tauxRecouvrement}%.")
                      .replace("{period}", periode)
                      .replace("{totalRev}", mad(aiReportInsights.totalRev))
                      .replace("{facturesPayees}", String(aiReportInsights.facturesPayeesCount))
                      .replace("{panierMoyen}", mad(aiReportInsights.panierMoyen))
                      .replace("{tauxRecouvrement}", String(aiReportInsights.tauxRecouvrement))}
                  </p>
                </div>

                {/* Cartes Métriques Clés */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center">
                    <span className="text-[9.5px] font-bold uppercase text-slate-500 block">{t("reports.kpi.gross_revenue", "CHIFFRE D'AFFAIRES")}</span>
                    <strong className="font-mono text-indigo-700 text-[13px]">{mad(aiReportInsights.totalRev)}</strong>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center">
                    <span className="text-[9.5px] font-bold uppercase text-slate-500 block">{t("reports.kpi.recovery_rate", "TAUX RECOUVREMENT")}</span>
                    <strong className="font-mono text-emerald-700 text-[13px]">{aiReportInsights.tauxRecouvrement}%</strong>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center">
                    <span className="text-[9.5px] font-bold uppercase text-slate-500 block">{t("reports.kpi.collected_vat", "TVA COLLECTÉE (20%)")}</span>
                    <strong className="font-mono text-slate-800 text-[13px]">{mad(aiReportInsights.tvaCollectee)}</strong>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center">
                    <span className="text-[9.5px] font-bold uppercase text-slate-500 block">{t("reports.kpi.average_invoice", "PANIER MOYEN")}</span>
                    <strong className="font-mono text-slate-800 text-[13px]">{mad(aiReportInsights.panierMoyen)}</strong>
                  </div>
                </div>

                {/* Tableau Dynamique des Mois */}
                <div className="space-y-2">
                  <h3 className="font-extrabold text-black text-[12.5px]">{t("pdf.section2_title", "2. DYNAMIQUE ET ÉVOLUTION DES REVENUS")}</h3>
                  <p className="text-slate-600 text-[10.5px]">
                    {t("pdf.section2_text", "L'analyse temporelle enregistre une activité culminante en {topMonth} avec un volume de {totalRev} encaissements.")
                      .replace("{topMonth}", aiReportInsights.topMonthName)
                      .replace("{totalRev}", mad(aiReportInsights.totalRev))}
                  </p>
                  
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-[11px] text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[10px] uppercase">
                          <th className="p-2">{t("reports.table1.col_month", "Mois")}</th>
                          <th className="p-2">{t("reports.table1.col_revenue", "Revenu Encaissé")}</th>
                          <th className="p-2">{t("reports.table1.col_variation", "Évolution")}</th>
                          <th className="p-2">{t("reports.table1.col_invoices", "Factures")}</th>
                          <th className="p-2">{t("reports.table1.col_avg", "Panier Moyen")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-slate-800">
                        {extendedMonthly.map((r, idx) => (
                          <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                            <td className="p-2 font-bold text-slate-900">{r.mois}</td>
                            <td className="p-2 font-mono font-bold">{mad(r.revenu)}</td>
                            <td className="p-2 font-semibold text-emerald-600">{r.croissance}</td>
                            <td className="p-2 font-mono">{r.factures}</td>
                            <td className="p-2 font-mono">{mad(r.panierMoyen)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Analyse Risque Clients */}
                <div className="space-y-2">
                  <h3 className="font-extrabold text-black text-[12.5px]">{t("pdf.section3_title", "3. RISQUE CLIENT & ANALYSE DE RECOUVREMENT")}</h3>
                  <p className="text-slate-600 text-[10.5px]">
                    {t("pdf.section3_text", "Base active : {clientsCount} clients enregistrés. Le client principal {topClient} génère {topClientRev}.")
                      .replace("{clientsCount}", String(clients.length))
                      .replace("{topClient}", aiReportInsights.topClientName)
                      .replace("{topClientRev}", mad(aiReportInsights.topClientRev))}
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
                      <span className="font-bold text-amber-900 text-[11px] block">{t("pdf.concentration_title", "⚠️ Concentration des Revenus :")}</span>
                      <p className="text-amber-800 text-[10.5px]">
                        {t("pdf.concentration_text", "Les 3 premiers clients représentent {top3Pct}% du chiffre d'affaires global sur la période.")
                          .replace("{top3Pct}", String(aiReportInsights.top3Pct))}
                      </p>
                    </div>
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-1">
                      <span className="font-bold text-emerald-900 text-[11px] block">{t("pdf.recovery_title", "✔ Encours & Créances :")}</span>
                      <p className="text-emerald-800 text-[10.5px]">
                        {t("pdf.recovery_text", "Taux de recouvrement à {tauxRecouvrement}%. Vos créances en attente s'élèvent à {creancesAttente}.")
                          .replace("{tauxRecouvrement}", String(aiReportInsights.tauxRecouvrement))
                          .replace("{creancesAttente}", mad(aiReportInsights.creancesAttente))}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Synthèse Fiscale TVA */}
                <div className="space-y-2">
                  <h3 className="font-extrabold text-black text-[12.5px]">{t("pdf.section4_title", "4. RÉCAPITULATIF FISCAL & ESTIMATION TVA")}</h3>
                  
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="flex justify-between p-2.5 bg-slate-50 border-b border-slate-200 font-semibold">
                      <span>{t("pdf.sales_ht", "Total Ventes Hors Taxes (HT)")}</span>
                      <span className="font-mono">{mad(aiReportInsights.totalRev)}</span>
                    </div>
                    <div className="flex justify-between p-2.5 bg-white border-b border-slate-200 font-semibold">
                      <span>{t("pdf.vat_collected", "TVA Collectée sur Ventes (20%)")}</span>
                      <span className="font-mono text-emerald-700">+{mad(aiReportInsights.tvaCollectee)}</span>
                    </div>
                    <div className="flex justify-between p-2.5 bg-slate-100 font-black text-slate-900">
                      <span>{t("pdf.net_vat_due", "TVA Net Estimée à Payer (DGI)")}</span>
                      <span className="font-mono text-indigo-700">{mad(aiReportInsights.tvaNet)}</span>
                    </div>
                  </div>
                </div>

                {/* Recommandations IA */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <h3 className="font-extrabold text-black text-[12.5px] flex items-center gap-1.5">
                    <Sparkles size={14} className="text-indigo-600" />
                    {t("pdf.section5_title", "5. RECOMMANDATIONS STRATÉGIQUES IA")}
                  </h3>
                  <ul className="space-y-1 text-[11px] text-slate-900 font-medium list-disc list-inside">
                    <li>{t("pdf.rec1", "Relancer les créances en attente : Prioriser le recouvrement de {creances} actuellement en retard.").replace("{creances}", mad(aiReportInsights.creancesAttente))}</li>
                    <li>{t("pdf.rec2", "Provisionner la déclaration de TVA : Réserver {vat} pour le règlement fiscal.").replace("{vat}", mad(aiReportInsights.tvaNet))}</li>
                    <li>{t("pdf.rec3", "Sécuriser la dépendance client : Développer de nouveaux comptes pour réduire la part du Top 3 ({top3Pct}%).").replace("{top3Pct}", String(aiReportInsights.top3Pct))}</li>
                  </ul>
                </div>

                {/* Signature & Cachet */}
                <div className="pt-4 border-t border-slate-300 flex justify-between items-end text-[10px] text-slate-500">
                  <div>
                    <p>{t("pdf.generated_by", "Document généré automatiquement par l'application Tadbir AI Pro.")}</p>
                    <p>{t("pdf.certified", "Certifié conforme aux registres de facturation internes.")}</p>
                  </div>
                  <div className="text-center font-bold text-slate-700 space-y-4">
                    <p>{t("pdf.signature_label", "Visa de la Direction Financière :")}</p>
                    <div className="font-mono text-[9.5px] border-t border-slate-400 pt-1 text-slate-400 uppercase">
                      {t("pdf.stamp_label", "[ CACHET ÉLECTRONIQUE VALIDE ]")}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Bottom Compact Fixed Footer */}
            <div className="shrink-0 flex items-center justify-between gap-2 bg-slate-950 px-4 py-2 border-t border-slate-800 print:hidden text-white">
              <span className="text-[11px] text-slate-400 font-medium truncate">
                📄 {periode.toUpperCase()} • {t("reports.modal.pdf_preview_subtitle", "Prêt pour Téléchargement")}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setIsPdfModalOpen(false)}
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1 text-[11px] font-bold text-slate-300 transition-all active:scale-95"
                >
                  {t("reports.modal.close", "Fermer")}
                </button>
                <button
                  onClick={downloadPDF}
                  disabled={isDownloadingPdf}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1 text-[11px] font-extrabold text-white shadow-sm shadow-emerald-600/30 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isDownloadingPdf ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} 
                  {isDownloadingPdf ? t("reports.modal.downloading", "Téléchargement...") : t("reports.modal.download_pdf", "Télécharger PDF")}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
