"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Box, 
  Settings,
  CreditCard,
  Building2,
  Receipt,
  Truck,
  Undo2,
  ShoppingCart,
  Calculator,
  UserSquare2,
  Users2,
  Store,
  BarChart3,
  Landmark,
  HelpCircle,
  Palette,
  Sparkles,
  Layers,
  MessageSquare,
  ShieldCheck,
  ChevronDown,
  LogOut
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store/authStore";

interface NavGroup {
  groupKey: string;
  defaultGroupName: string;
  items: { href: string; itemKey: string; defaultLabel: string; icon: any; roles?: string[] }[];
}

const navGroups: NavGroup[] = [
  {
    groupKey: "nav.group.overview",
    defaultGroupName: "Vue d'ensemble",
    items: [
      { href: "/", itemKey: "nav.apercu", defaultLabel: "Tableau de bord", icon: LayoutDashboard },
      { href: "/rapports", itemKey: "nav.rapports", defaultLabel: "Rapports & KPIs", icon: BarChart3, roles: ["Administrateur", "Comptable"] },
    ]
  },
  {
    groupKey: "nav.group.sales",
    defaultGroupName: "Ventes & Clients",
    items: [
      { href: "/factures", itemKey: "nav.factures", defaultLabel: "Factures", icon: FileText, roles: ["Administrateur", "Comptable", "Commercial", "Lecteur"] },
      { href: "/devis", itemKey: "nav.devis", defaultLabel: "Devis", icon: FileText, roles: ["Administrateur", "Commercial", "Lecteur"] },
      { href: "/avoirs", itemKey: "nav.avoirs", defaultLabel: "Avoirs", icon: Undo2, roles: ["Administrateur", "Comptable", "Lecteur"] },
      { href: "/clients", itemKey: "nav.clients", defaultLabel: "Clients", icon: Users, roles: ["Administrateur", "Commercial", "Comptable", "Lecteur"] },
    ]
  },
  {
    groupKey: "nav.group.purchases",
    defaultGroupName: "Achats & Fournisseurs",
    items: [
      { href: "/bons-de-commande", itemKey: "nav.bons_commande", defaultLabel: "Bons Cde", icon: ShoppingCart, roles: ["Administrateur", "Comptable", "Lecteur"] },
      { href: "/depenses", itemKey: "nav.depenses", defaultLabel: "Dépenses", icon: Receipt, roles: ["Administrateur", "Comptable", "Lecteur"] },
      { href: "/fournisseurs", itemKey: "nav.fournisseurs", defaultLabel: "Fournisseurs", icon: Truck, roles: ["Administrateur", "Comptable", "Lecteur"] },
    ]
  },
  {
    groupKey: "nav.group.operations",
    defaultGroupName: "Opérations & Stocks",
    items: [
      { href: "/stocks", itemKey: "nav.stocks", defaultLabel: "Stocks", icon: Box, roles: ["Administrateur", "Comptable", "Commercial", "Lecteur"] },
      { href: "/pos", itemKey: "nav.pos", defaultLabel: "Point de Vente", icon: Store, roles: ["Administrateur", "Commercial"] },
      { href: "/rapprochement", itemKey: "nav.banque", defaultLabel: "Banque", icon: Landmark, roles: ["Administrateur", "Comptable"] },
    ]
  },
  {
    groupKey: "nav.group.hr",
    defaultGroupName: "Ressources Humaines",
    items: [
      { href: "/employes", itemKey: "nav.employes", defaultLabel: "Employés", icon: UserSquare2, roles: ["Administrateur"] },
      { href: "/equipe", itemKey: "nav.equipe", defaultLabel: "Équipe & Rôles", icon: Users2, roles: ["Administrateur"] },
      { href: "/bulletins-de-paie", itemKey: "nav.bulletins_paie", defaultLabel: "Fiches de paie", icon: Calculator, roles: ["Administrateur", "Comptable"] },
    ]
  }
];

const bottomNavItems = [
  { href: "/parametres", itemKey: "nav.parametres", defaultLabel: "Paramètres", icon: Settings, roles: ["Administrateur"] },
  { href: "/whatsapp", itemKey: "nav.whatsapp", defaultLabel: "WhatsApp Config", icon: MessageSquare, roles: ["Administrateur", "Commercial"] },
  { href: "/abonnement", itemKey: "nav.abonnement", defaultLabel: "Abonnement", icon: CreditCard, roles: ["Administrateur"] },
  { href: "/entreprise", itemKey: "nav.entreprise", defaultLabel: "Mon Entreprise", icon: Building2, roles: ["Administrateur"] },
  { href: "/modele-facture", itemKey: "nav.modeles", defaultLabel: "Modèles", icon: Palette, roles: ["Administrateur", "Comptable"] },
  { href: "/support", itemKey: "nav.support", defaultLabel: "Support", icon: HelpCircle },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { user, setRole, logout, hydrate } = useAuthStore();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  useEffect(() => {
    hydrate();
  }, []);

  const rawRole = user?.role || "Administrateur";
  const activeRole = rawRole.toLowerCase().includes("admin") ? "Administrateur" : rawRole;

  const isRoleAllowed = (allowedRoles?: string[]) => {
    if (!allowedRoles || allowedRoles.length === 0) return true;
    if (activeRole === "Administrateur") return true;
    return allowedRoles.includes(activeRole);
  };

  return (
    <aside className="w-[240px] h-full flex flex-col relative z-20 overflow-hidden border-r border-slate-800/80 bg-slate-950/90 backdrop-blur-2xl">
      {/* Brand */}
      <div className="mb-4 px-4 mt-4 shrink-0">
        <Link href="/" className="inline-block transition-transform hover:scale-[1.02] active:scale-95">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
              <span className="font-sans text-[17px] font-black text-white">T</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-sans text-[17px] font-bold tracking-tight text-white block leading-none">
                  Tadbir AI
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <span className="text-[9.5px] font-extrabold text-indigo-400 tracking-wider uppercase mt-1 block">
                AI Financial OS
              </span>
            </div>
          </div>
        </Link>
      </div>

      {/* Main Navigation (Scrollable & Role-Filtered) */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide px-3 pb-4 space-y-4">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => isRoleAllowed(item.roles));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.groupKey}>
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {t(group.groupKey, group.defaultGroupName)}
              </p>
              <nav className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={true}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 text-[12.5px] font-medium transition-all duration-200 ${
                        isActive
                          ? "bg-indigo-600/20 text-indigo-300 font-semibold ring-1 ring-indigo-500/40 shadow-sm"
                          : "text-slate-400 hover:bg-slate-900/80 hover:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <item.icon size={15} className={isActive ? "text-indigo-400" : "text-slate-500"} />
                        <span>{t(item.itemKey, item.defaultLabel)}</span>
                      </div>
                      {isActive && (
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-xs shadow-indigo-400" />
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          );
        })}

        {/* Bottom Navigation */}
        <div className="border-t border-slate-800/80 pt-3">
          <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {t("nav.group.system", "System & Support")}
          </p>
          <nav className="space-y-0.5">
            {bottomNavItems.filter((item) => isRoleAllowed(item.roles)).map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-[12.5px] font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-indigo-600/20 text-indigo-300 font-semibold ring-1 ring-indigo-500/40 shadow-sm"
                      : "text-slate-400 hover:bg-slate-900/80 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <item.icon size={15} className={isActive ? "text-indigo-400" : "text-slate-500"} />
                    <span>{t(item.itemKey, item.defaultLabel)}</span>
                  </div>
                  {isActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-xs shadow-indigo-400" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* User Profile & Role Switcher Popup */}
      <div className="p-3 pt-0 shrink-0 relative">
        <div 
          onClick={() => setRoleMenuOpen(!roleMenuOpen)}
          className="group flex items-center justify-between gap-2.5 rounded-xl bg-slate-900/90 border border-slate-800 p-2.5 hover:border-indigo-500/40 cursor-pointer transition-all shadow-md"
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300 font-extrabold text-[11px] border border-indigo-500/30">
              {user?.nom ? user.nom.charAt(0).toUpperCase() : "A"}
            </div>
            <div className="overflow-hidden">
              <p className="truncate text-[12px] font-bold text-white leading-tight">
                {user?.nom || user?.email?.split('@')[0] || "Utilisateur"}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`inline-block rounded-md px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider ${
                  activeRole === "Administrateur"
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                    : activeRole === "Comptable"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : activeRole === "Commercial"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "bg-slate-800 text-slate-300 border border-slate-700"
                }`}>
                  {activeRole}
                </span>
              </div>
            </div>
          </div>
          <ChevronDown size={14} className="text-slate-400 shrink-0 group-hover:text-white transition-colors" />
        </div>

        {/* Profile Action & Logout Popover */}
        {roleMenuOpen && (
          <div className="absolute bottom-16 left-3 right-3 z-50 rounded-2xl bg-slate-900 shadow-2xl border border-slate-800 p-2 text-left animate-in fade-in zoom-in-95 space-y-1">
            <div className="px-2.5 py-1.5 border-b border-slate-800 mb-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Compte Actif</p>
              <p className="text-[12px] font-bold text-white mt-0.5">{user?.email || "Utilisateur"}</p>
              <p className="text-[10.5px] font-semibold text-indigo-400">Rôle : {activeRole}</p>
            </div>
            {activeRole === "Administrateur" && (
              <>
                <div className="px-2.5 py-1.5">
                  <p className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider">
                    Aperçu Rôle
                  </p>
                  <p className="text-[9px] text-amber-400/80 font-semibold mt-0.5">
                    ⚠️ Mode Aperçu — non persistant
                  </p>
                </div>
                {["Administrateur", "Comptable", "Commercial", "Lecteur"].map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      setRole(r);
                      setRoleMenuOpen(false);
                    }}
                    className={`flex items-center justify-between w-full text-left rounded-xl px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors ${
                      activeRole === r
                        ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                        : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <span>{r}</span>
                    {activeRole === r && <ShieldCheck size={13} className="text-indigo-400" />}
                  </button>
                ))}
              </>
            )}
            <div className="border-t border-slate-800 pt-1 mt-1 space-y-1">
              <Link
                href="/profil"
                onClick={() => setRoleMenuOpen(false)}
                className="flex items-center gap-2 w-full text-left rounded-xl px-2.5 py-2 text-[12px] text-indigo-300 hover:bg-indigo-500/10 font-semibold"
              >
                <UserSquare2 size={14} /> Mon Profil & Sécurité
              </Link>
              <button
                onClick={() => logout()}
                className="flex items-center gap-2 w-full text-left rounded-xl px-2.5 py-2 text-[12px] text-rose-400 hover:bg-rose-500/10 font-semibold"
              >
                <LogOut size={14} /> Se déconnecter
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
