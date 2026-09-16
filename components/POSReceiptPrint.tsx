"use client";

import { useState, useEffect } from "react";
import { mad } from "@/lib/format";

type CartLine = { produitId: string; nom: string; sku: string; prix: number; qte: number; remise: number };

export async function printPOSReceiptWindow(receipt: {
  id?: string;
  transactionId: string;
  total: number;
  rendu: number;
  paymentMethod?: string;
  montantRemis?: number;
  lignes: CartLine[];
  date?: string;
}) {
  if (!receipt) return;
  let company: any = {};
  try {
    const orgId = typeof window !== "undefined" ? localStorage.getItem("active_organization_id") : null;
    const orgParam = orgId ? `?org=${encodeURIComponent(orgId)}` : "";
    const orgHeaders: Record<string, string> = orgId ? { "x-organization-id": orgId } : {};
    const response = await fetch(`/api/company-settings${orgParam}`, { headers: orgHeaders });
    if (response.ok) company = await response.json();
  } catch (error) {
    console.error("Unable to load company settings for receipt", error);
  }

  const devise = company.devise || company.currency || (typeof window !== "undefined" ? localStorage.getItem("devise") : null) || "MAD";

  const nowStr = receipt.date || new Date().toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  const sousTotal = receipt.lignes.reduce((sum, l) => sum + (l.prix * l.qte * (1 - (l.remise || 0) / 100)), 0);
  const tva = sousTotal * 0.2;
  const totalTtc = receipt.total || (sousTotal + tva);

  const linesHtml = receipt.lignes.map((l) => `
    <tr style="border-bottom: 1px dashed #cccccc; vertical-align: top;">
      <td style="padding: 6px 0; font-weight: 600;">
        ${l.nom}
        ${l.remise > 0 ? `<br><small style="font-weight: normal; color: #666;">(-${l.remise}%)</small>` : ''}
      </td>
      <td style="padding: 6px 0; text-align: center; font-family: monospace; font-weight: bold;">${l.qte}</td>
      <td style="padding: 6px 0; text-align: right; font-family: monospace;">${mad(l.prix, devise)}</td>
      <td style="padding: 6px 0; text-align: right; font-family: monospace; font-weight: bold;">${mad(l.prix * l.qte * (1 - (l.remise || 0) / 100), devise)}</td>
    </tr>
  `).join('');

  const windowUrl = '';
  const printWindow = window.open(windowUrl, '_blank', 'width=450,height=700,top=100,left=100');
  
  if (!printWindow) {
    window.print();
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>Reçu Ticket #${receipt.transactionId}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            width: 80mm;
            max-width: 100%;
            margin: 0 auto;
            padding: 16px;
            background: #ffffff;
            color: #000000;
            font-size: 12px;
            line-height: 1.35;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .font-mono { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
          .border-b-dashed { border-bottom: 1px dashed #000000; padding-bottom: 8px; margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px; }
          th { border-bottom: 1.5px solid #000000; text-align: left; padding: 4px 0; font-size: 10px; text-transform: uppercase; }
          .flex { display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="text-center border-b-dashed">
          <h1 style="font-size: 22px; margin: 0 0 2px 0; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase;">${company.nom || company.name || 'Tadbir AI'}</h1>
          <p style="margin: 0; font-size: 11px; font-weight: 700; color: #111;">Solution de Facturation & Caisse POS</p>
          <p style="margin: 4px 0 0 0; font-size: 10px; color: #333;">${company.adresse || company.address || ''}${company.ville || company.city ? `, ${company.ville || company.city}` : ''}, ${company.pays || company.country || 'Maroc'}</p>
          <p style="margin: 0; font-size: 10px; color: #333;">ICE: ${company.ice || '-'} · IF: ${company.identifiant_fiscal || company.tax_identifier || '-'} · RC: ${company.registre_commerce || company.rc || '-'}</p>
          <p style="margin: 1px 0 0 0; font-size: 10px; font-weight: 600;">Tél: ${company.telephone || company.phone || ''}</p>
        </div>

        <div class="border-b-dashed" style="font-size: 11px;">
          <div class="flex" style="font-weight: bold; font-size: 12px;">
            <span>TICKET N°:</span>
            <span class="font-mono">${receipt.transactionId}</span>
          </div>
          <div class="flex" style="margin-top: 3px;">
            <span>Date & Heure:</span>
            <span>${nowStr}</span>
          </div>
          <div class="flex" style="margin-top: 2px;">
            <span>Caissier:</span>
            <span>Caisse Principale</span>
          </div>
          <div class="flex" style="margin-top: 2px;">
            <span>Client:</span>
            <span>Client Comptoir</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Article</th>
              <th style="text-align: center;">Qté</th>
              <th style="text-align: right;">P.U</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${linesHtml}
          </tbody>
        </table>

        <div class="border-b-dashed" style="font-size: 12px;">
          <div class="flex" style="margin-bottom: 2px;">
            <span>Sous-total HT :</span>
            <span class="font-mono">${mad(sousTotal, devise)}</span>
          </div>
          <div class="flex" style="margin-bottom: 4px;">
            <span>TVA (20%) :</span>
            <span class="font-mono">${mad(tva, devise)}</span>
          </div>
          <div class="flex" style="font-size: 16px; font-weight: 900; border-top: 1.5px solid #000000; padding-top: 4px; margin-top: 4px;">
            <span>TOTAL TTC :</span>
            <span class="font-mono">${mad(totalTtc, devise)}</span>
          </div>
          ${receipt.paymentMethod ? `
          <div class="flex" style="margin-top: 4px; font-size: 11px;">
            <span>Mode de paiement :</span>
            <span style="font-weight: bold;">${receipt.paymentMethod}</span>
          </div>
          ` : ''}
          ${receipt.montantRemis ? `
          <div class="flex" style="margin-top: 2px; font-size: 11px;">
            <span>Montant remis :</span>
            <span class="font-mono">${mad(receipt.montantRemis, devise)}</span>
          </div>
          ` : ''}
          ${receipt.rendu > 0 ? `
          <div class="flex" style="font-size: 12px; font-weight: bold; margin-top: 2px;">
            <span>Monnaie rendue :</span>
            <span class="font-mono">${mad(receipt.rendu, devise)}</span>
          </div>
          ` : ''}
        </div>

        <div class="text-center" style="margin-top: 15px;">
          <div style="border: 1px solid #000000; display: inline-block; padding: 4px 14px; font-family: monospace; font-weight: bold; font-size: 11px; letter-spacing: 2px;">
            ||||| ${receipt.transactionId} |||||
          </div>
          <p style="margin: 10px 0 2px 0; font-weight: bold; font-size: 11px;">Merci pour votre visite !</p>
          <p style="margin: 0; font-size: 10px; color: #444;">Conservez ce ticket pour tout échange sous 7 jours.</p>
          <p style="margin: 4px 0 0 0; font-size: 9px; font-family: monospace; color: #666;">www.tadbir.ai</p>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 200);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

export default function POSReceiptPrint({
  receipt
}: {
  receipt: {
    id?: string;
    transactionId: string;
    total: number;
    rendu: number;
    paymentMethod?: string;
    montantRemis?: number;
    lignes: CartLine[];
    date?: string;
  } | null;
}) {
  const [company, setCompany] = useState<any>({});

  useEffect(() => {
    fetch("/api/company-settings")
      .then(res => res.ok ? res.json() : {})
      .then(data => setCompany(data || {}))
      .catch(() => {});
  }, []);

  if (!receipt) return null;

  const devise = company.devise || company.currency || (typeof window !== "undefined" ? localStorage.getItem("devise") : null) || "MAD";

  const nowStr = receipt.date || new Date().toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  const sousTotal = receipt.lignes.reduce((sum, l) => sum + (l.prix * l.qte * (1 - (l.remise || 0) / 100)), 0);
  const tva = sousTotal * 0.2;
  const totalTtc = receipt.total || (sousTotal + tva);

  return (
    <div id="printable-pos-receipt">
      {/* Header */}
      <div className="text-center pb-3 mb-3 border-b border-black border-dashed">
        <h1 className="text-[20px] font-black tracking-tight uppercase text-black">{company.nom || company.name || 'TADBIR AI'}</h1>
        <p className="text-[10.5px] font-bold text-black">Solution de Facturation & Caisse POS</p>
        <p className="text-[10px] mt-1 text-black">{company.adresse || company.address || ''}{company.ville || company.city ? `, ${company.ville || company.city}` : ''}, {company.pays || company.country || 'Maroc'}</p>
        <p className="text-[10px] text-black">ICE: {company.ice || '-'} · IF: {company.identifiant_fiscal || company.tax_identifier || '-'} · RC: {company.registre_commerce || company.rc || '-'}</p>
        <p className="text-[10px] font-semibold text-black">Tél: {company.telephone || company.phone || ''}</p>
      </div>

      {/* Ticket Details */}
      <div className="mb-3 text-[11px] border-b border-black border-dashed pb-2">
        <div className="flex justify-between font-bold">
          <span>TICKET N°:</span>
          <span className="font-mono">{receipt.transactionId}</span>
        </div>
        <div className="flex justify-between mt-0.5">
          <span>Date & Heure:</span>
          <span>{nowStr}</span>
        </div>
        <div className="flex justify-between mt-0.5">
          <span>Caissier:</span>
          <span>Caisse Principale</span>
        </div>
        <div className="flex justify-between mt-0.5">
          <span>Client:</span>
          <span>Client Comptoir</span>
        </div>
      </div>

      {/* Articles Table */}
      <table className="w-full text-left text-[11px] mb-3 border-b border-black border-dashed pb-2">
        <thead>
          <tr className="border-b border-black text-[10px] font-bold uppercase">
            <th className="py-1">Article</th>
            <th className="py-1 text-center">Qté</th>
            <th className="py-1 text-right">P.U</th>
            <th className="py-1 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {receipt.lignes.map((l, i) => (
            <tr key={i} className="align-top">
              <td className="py-1 font-semibold pr-1">
                {l.nom}
                {l.remise > 0 && <span className="block text-[9.5px] font-normal">(-{l.remise}%)</span>}
              </td>
              <td className="py-1 text-center font-mono">{l.qte}</td>
              <td className="py-1 text-right font-mono">{mad(l.prix, devise)}</td>
              <td className="py-1 text-right font-mono font-bold">{mad(l.prix * l.qte * (1 - (l.remise || 0) / 100), devise)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary Totals */}
      <div className="space-y-1 text-[11.5px] border-b border-black border-dashed pb-3 mb-3">
        <div className="flex justify-between">
          <span>Sous-total HT :</span>
          <span className="font-mono">{mad(sousTotal, devise)}</span>
        </div>
        <div className="flex justify-between">
          <span>TVA (20%) :</span>
          <span className="font-mono">{mad(tva, devise)}</span>
        </div>
        <div className="flex justify-between text-[15px] font-extrabold border-t border-black pt-1">
          <span>TOTAL TTC :</span>
          <span className="font-mono">{mad(totalTtc, devise)}</span>
        </div>
        
        {receipt.paymentMethod && (
          <div className="flex justify-between pt-1 text-[11px]">
            <span>Mode de paiement :</span>
            <span className="font-bold">{receipt.paymentMethod}</span>
          </div>
        )}
        {receipt.montantRemis !== undefined && receipt.montantRemis > 0 && (
          <div className="flex justify-between text-[11px]">
            <span>Montant remis :</span>
            <span className="font-mono">{mad(receipt.montantRemis, devise)}</span>
          </div>
        )}
        {receipt.rendu > 0 && (
          <div className="flex justify-between text-[11px] font-bold text-black">
            <span>Monnaie rendue :</span>
            <span className="font-mono">{mad(receipt.rendu, devise)}</span>
          </div>
        )}
      </div>

      {/* Barcode & Footer */}
      <div className="text-center space-y-1">
        <div className="inline-block border border-black px-4 py-1.5 font-mono text-[11px] font-bold tracking-widest uppercase">
          ||||| {receipt.transactionId} |||||
        </div>
        <p className="text-[10.5px] font-semibold mt-2">Merci pour votre visite !</p>
        <p className="text-[9.5px] text-gray-700">Conservez ce ticket pour tout échange sous 7 jours.</p>
        <p className="text-[9px] text-gray-500 font-mono">{company.site_web || company.website || 'www.tadbir.ai'}</p>
      </div>
    </div>
  );
}
