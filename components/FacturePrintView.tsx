"use client";

import { useEffect, useState } from "react";
import { Loader2, Printer, ArrowLeft } from "lucide-react";
import { mad } from "@/lib/format";

async function fetchTemplateConfig(targetOrgId?: string) {
  let config = {
    accent: "#6B4FA0",
    template: "moderne",
    footerText: "",
    separateur: "A-B",
    inclureAnnee: false,
    longueur: 4,
    prefixeFac: "FAC"
    ,company: {}
  };

  const orgId = targetOrgId || (typeof window !== "undefined" ? localStorage.getItem("active_organization_id") : null);
  const orgParam = orgId ? `?org=${encodeURIComponent(orgId)}` : "";
  const orgHeaders: Record<string, string> = orgId ? { "x-organization-id": orgId } : {};

  try {
    const res = await fetch(`/api/settings${orgParam}`, { headers: orgHeaders });
    if (res.ok) {
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (data && data.factureTemplateConfig) {
        config = { ...config, ...data.factureTemplateConfig };
      }
    }
    const companyResponse = await fetch(`/api/company-settings${orgParam}`, { headers: orgHeaders });
    if (companyResponse.ok) {
      const text = await companyResponse.text();
      config.company = text ? JSON.parse(text) : {};
    }
  } catch (e) {
    console.warn("Error reading factureTemplateConfig in FacturePrintView", e);
  }
  
  return config;
}

export async function printFactureWindow(facture: any, config: any = {}) {
  if (!facture) return;
  config = config || {};
  const orgId = facture?.organization_id || facture?.company || (typeof window !== "undefined" ? localStorage.getItem("active_organization_id") : null);
  const orgParam = orgId ? `?org=${encodeURIComponent(orgId)}` : "";
  const orgHeaders: Record<string, string> = orgId ? { "x-organization-id": orgId } : {};

  if (!config.company || Object.keys(config.company).length === 0) {
    try {
      const companyResponse = await fetch(`/api/company-settings${orgParam}`, { headers: orgHeaders });
      config.company = companyResponse.ok ? await companyResponse.json() : {};
    } catch {}
  }
  const company = config.company || {};
  const devise = company.devise || company.currency || (typeof window !== "undefined" ? localStorage.getItem("devise") : null) || "MAD";
  const accent = config.accent || "#6B4FA0";

  const rawTotal = parseFloat(facture.total_amount || facture.montant) || 0;
  const rawLignes = facture.lignes || facture.items || facture.articles || [];
  
  let lignes = rawLignes;
  let sousTotal = 0;
  let tva = 0;
  let totalTtc = rawTotal;

  if (lignes.length > 0) {
    sousTotal = lignes.reduce((sum: number, l: any) => sum + (l.quantite || l.qte || 1) * (l.prix_unitaire || l.prix || 0), 0);
    tva = sousTotal * 0.2;
    if (totalTtc === 0) totalTtc = sousTotal + tva;
  } else {
    sousTotal = totalTtc / 1.2;
    tva = totalTtc - sousTotal;
    lignes = [{
      description: `Facture ${facture.invoice_number || facture.numero || ''} - Prestation / Vente`,
      quantite: 1,
      prix_unitaire: sousTotal
    }];
  }

  const linesHtml = lignes.map((l: any, idx: number) => {
    const q = l.quantite || l.qte || 1;
    const p = l.prix_unitaire || l.prix || 0;
    return `
      <tr style="border-bottom: 1px solid #e2e8f0; vertical-align: top;">
        <td style="padding: 10px 12px; font-family: monospace; color: #64748b;">${idx + 1}</td>
        <td style="padding: 10px 12px; font-weight: 600; color: #0f172a;">${l.description || l.article || l.nom || "Prestation / Article"}</td>
        <td style="padding: 10px 12px; text-align: right; font-family: monospace; font-weight: 600;">${q}</td>
        <td style="padding: 10px 12px; text-align: right; font-family: monospace;">${mad(p, devise)}</td>
        <td style="padding: 10px 12px; text-align: right; font-family: monospace; font-weight: bold; color: #0f172a;">${mad(q * p, devise)}</td>
      </tr>
    `;
  }).join('');

  const printWindow = window.open('', '_blank', 'width=850,height=1000,top=50,left=100');
  if (!printWindow) {
    window.print();
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>Facture #${facture.invoice_number || facture.numero || facture.id}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          * { box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; color: #0f172a; font-size: 13px; margin: 0; padding: 20px; }
          .container { max-width: 800px; margin: 0 auto; background: #ffffff; ${config.template === 'moderne' ? `border-left: 6px solid ${accent}; padding-left: 20px;` : ''} }
          .header-banner { ${config.template === 'audacieux' ? `background: ${accent}; color: #ffffff; padding: 20px; border-radius: 12px; margin-bottom: 25px;` : `border-bottom: 2px solid ${accent}; padding-bottom: 20px; margin-bottom: 25px;`} }
          .header-title { font-size: 32px; font-weight: 900; letter-spacing: -1px; color: ${config.template === 'audacieux' ? '#ffffff' : accent}; margin: 0; }
          .badge-status { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 800; text-transform: uppercase; background: #e0e7ff; color: #3730a3; }
          .badge-paid { background: #dcfce7; color: #166534; }
          .card-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 25px; }
          th { background: ${accent}; color: #ffffff; font-size: 11px; font-weight: 800; text-transform: uppercase; padding: 10px 12px; text-align: left; }
          .total-box { width: 320px; margin-left: auto; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
          .total-row { display: flex; justify-content: space-between; padding: 4px 0; color: #475569; }
          .total-ttc { display: flex; justify-content: space-between; font-size: 18px; font-weight: 900; color: ${accent}; border-top: 2px solid ${accent}; padding-top: 10px; margin-top: 8px; }
          .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-size: 11px; color: #64748b; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header-banner flex-between" style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <h1 class="header-title">FACTURE</h1>
              <p style="font-size: 16px; font-weight: 700; color: ${config.template === 'audacieux' ? '#ffffff' : accent}; margin: 4px 0 0 0; font-family: monospace;">
                N° ${facture.invoice_number || facture.numero || facture.id}
              </p>
              <div style="margin-top: 8px;">
                <span class="badge-status ${(facture.status || facture.statut) === 'Payée' ? 'badge-paid' : ''}">
                  ${facture.status || facture.statut || 'Brouillon'}
                </span>
              </div>
            </div>

            <div style="text-align: right;">
              <h2 style="font-size: 18px; font-weight: 900; color: ${config.template === 'audacieux' ? '#ffffff' : '#020617'}; margin: 0;">${company.nom || company.name || 'Entreprise'}</h2>
              <p style="margin: 2px 0 0 0; color: ${config.template === 'audacieux' ? '#f1f5f9' : '#475569'};">${company.adresse || company.address || ''}${company.ville || company.city ? `, ${company.ville || company.city}` : ''}</p>
              <p style="margin: 0; color: ${config.template === 'audacieux' ? '#f1f5f9' : '#475569'};">${company.pays || company.country || 'Maroc'}</p>
              <p style="margin: 2px 0 0 0; font-size: 11px; color: ${config.template === 'audacieux' ? '#e2e8f0' : '#64748b'}; font-family: monospace;">
                ICE: ${company.ice || '-'} · IF: ${company.identifiant_fiscal || company.tax_identifier || '-'} · RC: ${company.registre_commerce || company.rc || '-'}
              </p>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; gap: 20px; margin-bottom: 25px;">
            <div class="card-box" style="flex: 1;">
              <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 4px;">FACTURÉ À (CLIENT)</span>
              <p style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 0;">${facture.client_name || facture.client || "Client Comptoir"}</p>
              <p style="margin: 4px 0 0 0; color: #475569; font-size: 12px;">${facture.client_address || facture.client_city || (company.ville || company.city || 'Casablanca') + ', ' + (company.pays || company.country || 'Maroc')}</p>
            </div>

            <div class="card-box" style="flex: 1;">
              <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 4px;">DÉTAILS DE FACTURATION</span>
              <div class="total-row" style="font-size: 12px;">
                <span>Date d'Émission :</span>
                <strong style="color: #0f172a;">${facture.date || facture.dateEmission || new Date().toISOString().split("T")[0]}</strong>
              </div>
              <div class="total-row" style="font-size: 12px;">
                <span>Date d'Échéance :</span>
                <strong style="color: #0f172a;">À réception</strong>
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 40px;">#</th>
                <th>Désignation / Prestation</th>
                <th style="text-align: right; width: 70px;">Qté</th>
                <th style="text-align: right; width: 140px;">Prix U. HT</th>
                <th style="text-align: right; width: 140px;">Total HT</th>
              </tr>
            </thead>
            <tbody>
              ${linesHtml}
            </tbody>
          </table>

          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div class="card-box" style="width: 420px; font-size: 12px;">
              <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 6px;">COORDONNÉES BANCAIRES</span>
              <p style="margin: 0; font-weight: 700; color: #0f172a;">${company.email || company.telephone || ''}</p>
              <p style="margin: 2px 0 0 0; font-family: monospace; font-weight: 700; color: ${accent};">RIB : ${company.rib || company.iban || '-'}</p>
              ${company.bank_name || company.banque ? `<p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b;">${company.bank_name || company.banque}</p>` : ''}
            </div>

            <div class="total-box">
              <div class="total-row">
                <span>Sous-total HT :</span>
                <strong style="font-family: monospace; color: #0f172a;">${mad(sousTotal, devise)}</strong>
              </div>
              <div class="total-row">
                <span>TVA (20%) :</span>
                <strong style="font-family: monospace; color: ${accent};">+${mad(tva, devise)}</strong>
              </div>
              <div class="total-ttc">
                <span>Total TTC :</span>
                <span style="font-family: monospace;">${mad(totalTtc, devise)}</span>
              </div>
            </div>
          </div>

          <div class="footer">
            ${company.footer_text || config.footerText || ""}
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

export default function FacturePrintView({ id }: { id: string }) {
  const [facture, setFacture] = useState<any>(null);
  const [config, setConfig] = useState<any>({
    accent: "#6B4FA0",
    template: "moderne",
    footerText: ""
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/invoices").then(r => r.json()),
      fetchTemplateConfig()
    ]).then(([invoicesData, configData]) => {
      setConfig(configData);
      
      const list = Array.isArray(invoicesData) ? invoicesData : invoicesData.results || [];
      const found = list.find((f: any) => f.id === id || f.invoice_number === id);
      setFacture(found || {
        id: id || "FAC-2026-0047",
        invoice_number: id || "FAC-2026-0047",
        client_name: "Société Marocaine de Distribution",
        status: "Payée",
        date: new Date().toISOString().split("T")[0],
          montant: 18450.00,
          lignes: [
            { description: "Prestation de service & Développement web", quantite: 1, prix_unitaire: 12000.00 },
            { description: "Hébergement Cloud annuel & Domaine .MA", quantite: 1, prix_unitaire: 3375.00 }
          ]
        });

      const handleAfterPrint = () => {
        window.close();
      };
      window.addEventListener("afterprint", handleAfterPrint);
      
      // Pass the fetched config
      setTimeout(() => window.print(), 600);
      return () => window.removeEventListener("afterprint", handleAfterPrint);
    });
  }, [id]);

  if (!facture) {
    return (
      <div className="p-12 flex justify-center items-center min-h-screen bg-slate-950 text-white">
        <Loader2 className="animate-spin text-indigo-400" size={36} />
      </div>
    );
  }

  const accent = config.accent || "#6B4FA0";
  const company = config.company || {};
  const devise = company.devise || company.currency || (typeof window !== "undefined" ? localStorage.getItem("devise") : null) || "MAD";
  const rawLignes = facture.lignes || facture.items || [];
  const sousTotal = rawLignes.reduce((sum: number, l: any) => sum + (l.quantite || l.qte || 1) * (l.prix_unitaire || l.prix || 0), 0) || (facture.montant / 1.2);
  const tva = sousTotal * 0.2;
  const totalTtc = sousTotal + tva;

  return (
    <div className="bg-slate-100 text-slate-900 min-h-screen p-4 sm:p-8 font-sans">
      {/* Top Action Bar */}
      <div className="sticky top-0 z-50 mb-6 print:hidden flex items-center justify-between bg-slate-900 text-white p-4 rounded-2xl shadow-xl border border-slate-800">
        <button
          onClick={() => {
            if (window.history.length > 1) window.history.back();
            else window.location.href = "/factures";
          }}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all"
        >
          <ArrowLeft size={15} /> Retour à l'application
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-medium hidden sm:inline">Facture #{facture.invoice_number || facture.id}</span>
          <button
            onClick={() => printFactureWindow(facture, config)}
            className="flex items-center gap-2 px-4.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
          >
            <Printer size={15} /> Imprimer / Imprimer PDF
          </button>
        </div>
      </div>

      {/* Printable Invoice Container with Dynamic Accent & Template */}
      <div className={`max-w-[800px] mx-auto bg-white p-8 rounded-2xl shadow-xl border border-slate-200 printable-area ${config.template === 'moderne' ? `border-l-[8px]` : ''}`} style={{ borderColor: config.template === 'moderne' ? accent : undefined }}>
        
        {/* Header */}
        <div className={`flex justify-between items-start pb-6 mb-6 ${config.template === 'audacieux' ? 'p-6 rounded-xl text-white' : 'border-b-2'}`} style={{ backgroundColor: config.template === 'audacieux' ? accent : undefined, borderColor: config.template === 'audacieux' ? undefined : accent }}>
          <div>
            <h1 className="text-3xl font-black tracking-tight" style={{ color: config.template === 'audacieux' ? '#ffffff' : accent }}>FACTURE</h1>
            <p className="text-base font-bold font-mono mt-1" style={{ color: config.template === 'audacieux' ? '#ffffff' : accent }}>N° {facture.invoice_number || facture.id}</p>
            <span className="inline-block mt-2 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase bg-emerald-100 text-emerald-800">
              {facture.status || "Payée"}
            </span>
          </div>

          <div className="text-right">
            <h2 className="text-lg font-black" style={{ color: config.template === 'audacieux' ? '#ffffff' : '#020617' }}>{company.nom || company.name || 'Entreprise'}</h2>
            <p className="text-[12.5px] text-slate-600">{company.adresse || company.address || ''}{company.ville || company.city ? `, ${company.ville || company.city}` : ''}, {company.pays || company.country || 'Maroc'}</p>
            <p className="text-[11px] text-slate-500 font-mono mt-1">ICE: {company.ice || '-'} · IF: {company.identifiant_fiscal || company.tax_identifier || '-'}</p>
          </div>
        </div>

        {/* Client & Date Info */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">FACTURÉ À (CLIENT)</span>
            <p className="text-base font-extrabold text-slate-900">{facture.client_name || "Client"}</p>
            <p className="text-[12px] text-slate-600">{facture.client_address || facture.client_city || (company.ville || company.city || 'Casablanca') + ', ' + (company.pays || company.country || 'Maroc')}</p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">DÉTAILS</span>
            <p className="text-[12px] text-slate-700">Date : <strong>{facture.date || new Date().toISOString().split("T")[0]}</strong></p>
            <p className="text-[12px] text-slate-700 mt-1">Paiement : <strong>Virement / CB</strong></p>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full text-[12.5px] border-collapse mb-6">
          <thead>
            <tr className="text-white uppercase font-bold text-[11px]" style={{ backgroundColor: accent }}>
              <th className="p-2.5 text-left rounded-l-lg">Désignation</th>
              <th className="p-2.5 text-right">Qté</th>
              <th className="p-2.5 text-right">Prix Unit. HT</th>
              <th className="p-2.5 text-right rounded-r-lg">Total HT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rawLignes.map((l: any, idx: number) => (
              <tr key={idx}>
                <td className="p-3 font-semibold text-slate-900">{l.description || l.article || "Prestation"}</td>
                <td className="p-3 text-right font-mono font-bold">{l.quantite || 1}</td>
                <td className="p-3 text-right font-mono">{mad(l.prix_unitaire || 0, devise)}</td>
                <td className="p-3 text-right font-mono font-bold text-slate-900">{mad((l.quantite || 1) * (l.prix_unitaire || 0), devise)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-between items-start pt-4 border-t border-slate-200">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 w-80 text-[12px]">
            <span className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">RIB RÈGLEMENT</span>
            <p className="font-bold font-mono text-[12px]" style={{ color: accent }}>{company.rib || company.iban || '-'}</p>
            <p className="text-[11px] text-slate-500">{company.bank_name || company.banque || ''}</p>
          </div>

          <div className="w-72 space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200 text-[13px]">
            <div className="flex justify-between text-slate-600">
              <span>Sous-total HT :</span>
              <strong className="font-mono">{mad(sousTotal, devise)}</strong>
            </div>
            <div className="flex justify-between" style={{ color: accent }}>
              <span>TVA (20%) :</span>
              <strong className="font-mono">+{mad(tva, devise)}</strong>
            </div>
            <div className="flex justify-between text-base font-black pt-2 border-t border-slate-300" style={{ color: accent }}>
              <span>Total TTC :</span>
              <strong className="font-mono text-lg">{mad(totalTtc, devise)}</strong>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 pt-4 border-t border-slate-200 text-center text-[11px] font-semibold text-slate-500">
          {config.company?.footer_text || config.footerText || ""}
        </div>
      </div>
    </div>
  );
}
