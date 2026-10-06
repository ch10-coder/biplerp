import React from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { 
  LayoutDashboard, Truck, ShoppingCart, ClipboardList, CheckSquare, 
  BarChart3, Database, Heart, Zap, Layers, Sparkles, ShieldCheck 
} from 'lucide-react';

const About: React.FC = () => {
    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 max-w-5xl mx-auto">
            <div className="space-y-8 pb-20 animate-fadeIn">
                
                {/* Header Showcase */}
                <div className="text-center space-y-3 pt-4 sm:pt-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[var(--accent)] to-purple-600 rounded-2xl mb-2 shadow-lg shadow-[var(--accent)]/25 text-white font-mono font-bold text-2xl">
                        IM
                    </div>
                    <div className="flex items-center justify-center gap-2">
                        <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)] tracking-tight">
                            InventoryMate ERP
                        </h1>
                        <Badge variant="blue" size="sm">v2.9 Pro</Badge>
                    </div>
                    <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-xl mx-auto font-medium">
                        Next-generation dark-mode inventory ERP with FIFO batch tracking, weighted average valuation, and physical stock auditing.
                    </p>
                </div>

                {/* Modules Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mt-6">
                    <Card 
                        className="hover:border-blue-500/40 transition-all" 
                        hoverable
                        headerIcon={<LayoutDashboard size={20} className="text-blue-400" />}
                        title="Dashboard & KPIs"
                        subtitle="Command center with real-time financial trajectory"
                    >
                        <p className="text-[var(--text-secondary)] text-xs sm:text-sm leading-relaxed">
                            Live visibility into total inventory valuation, 6-month inflow vs outflow trends, category distribution donuts, and critical low-stock alerts.
                        </p>
                    </Card>

                    <Card 
                        className="hover:border-emerald-500/40 transition-all" 
                        hoverable
                        headerIcon={<Truck size={20} className="text-emerald-400" />}
                        title="Purchase & Inward Bills"
                        subtitle="Detailed landed cost & batch generation"
                    >
                        <p className="text-[var(--text-secondary)] text-xs sm:text-sm leading-relaxed">
                            Record supplier bills with freight, GST, and discounts. Automatically computes item-level landed cost, assigns Unique Identification Numbers (UIN), and recalculates Weighted Average Price.
                        </p>
                    </Card>

                    <Card 
                        className="hover:border-rose-500/40 transition-all" 
                        hoverable
                        headerIcon={<ShoppingCart size={20} className="text-rose-400" />}
                        title="Material Issuance (FIFO)"
                        subtitle="Departmental consumption & cost tracking"
                    >
                        <p className="text-[var(--text-secondary)] text-xs sm:text-sm leading-relaxed">
                            Issue materials directly to production departments or job orders. Strict FIFO (First-In, First-Out) logic depletes the oldest batches first for audit-ready valuation.
                        </p>
                    </Card>

                    <Card 
                        className="hover:border-purple-500/40 transition-all" 
                        hoverable
                        headerIcon={<ClipboardList size={20} className="text-purple-400" />}
                        title="Live Stock Register"
                        subtitle="Dual-mode: Aggregate Summary & Batch Breakdown"
                    >
                        <p className="text-[var(--text-secondary)] text-xs sm:text-sm leading-relaxed">
                            High-density virtualized data tables powered by TableVirtuoso. Toggle between aggregate SKU valuation and individual remaining batch lots with sparkline price trends.
                        </p>
                    </Card>

                    <Card 
                        className="hover:border-amber-500/40 transition-all" 
                        hoverable
                        headerIcon={<ShieldCheck size={20} className="text-amber-400" />}
                        title="Physical Stock Audit"
                        subtitle="Cycle counts & reconciliation"
                    >
                        <p className="text-[var(--text-secondary)] text-xs sm:text-sm leading-relaxed">
                            Daily verification queue of active items that have recent issues. 1-tap verification checkmark, variance adjustment slips, and historical audit trail.
                        </p>
                    </Card>

                    <Card 
                        className="hover:border-pink-500/40 transition-all" 
                        hoverable
                        headerIcon={<BarChart3 size={20} className="text-pink-400" />}
                        title="Reports & Analytics"
                        subtitle="Custom filters & CSV data export"
                    >
                        <p className="text-[var(--text-secondary)] text-xs sm:text-sm leading-relaxed">
                            Generate comprehensive reports for Opening Stock, Receipts, Issues, and Closing Stock with flexible date range filters and instant spreadsheet exports.
                        </p>
                    </Card>
                </div>

                {/* Creator Attribution */}
                <div className="pt-8 text-center">
                    <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] text-xs font-semibold hover:border-[var(--accent)] hover:text-[var(--text-primary)] transition-all cursor-default shadow-sm">
                        <Zap size={14} className="text-[var(--accent)]" />
                        Designed & Coded with passion by Chetan Luthra
                    </div>
                </div>
            </div>
        </div>
    );
};

export default About;
