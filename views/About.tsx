
import React from 'react';
import { Card } from '../components/ui/Card';
import { LayoutDashboard, Truck, ShoppingCart, ClipboardList, CheckSquare, BarChart3, Database, Heart, Zap } from 'lucide-react';

const About: React.FC = () => {
    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-6">
            <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-fadeIn">
                <div className="text-center space-y-4 pt-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--accent)] rounded-2xl mb-2 shadow-lg shadow-[var(--accent)]/20">
                        <span className="text-2xl font-bold text-white">IM</span>
                    </div>
                    <h1 className="text-4xl font-bold text-white tracking-tight">InventoryMate ERP</h1>
                    <p className="text-xl text-gray-400">A modern, efficient inventory management system.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                    <Card className="p-6 bg-[var(--bg-card)] border-[var(--border-color)] hover:border-blue-500/30 transition-colors group">
                        <h3 className="text-lg font-bold text-blue-400 flex items-center gap-2 mb-3 group-hover:text-blue-300">
                            <LayoutDashboard size={20} /> Dashboard
                        </h3>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Your command center. Get a real-time overview of total inventory value, low stock alerts, pending tasks, and recent activity. Visual charts help track stock distribution and spending trends.
                        </p>
                    </Card>

                    <Card className="p-6 bg-[var(--bg-card)] border-[var(--border-color)] hover:border-green-500/30 transition-colors group">
                        <h3 className="text-lg font-bold text-green-400 flex items-center gap-2 mb-3 group-hover:text-green-300">
                            <Truck size={20} /> Purchase (Inward)
                        </h3>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Record material receipts with detailed bill information including GST, freight, and vendor details. The system automatically calculates landed costs and updates the Weighted Average Price (WAP) for accurate valuation.
                        </p>
                    </Card>

                    <Card className="p-6 bg-[var(--bg-card)] border-[var(--border-color)] hover:border-red-500/30 transition-colors group">
                        <h3 className="text-lg font-bold text-red-400 flex items-center gap-2 mb-3 group-hover:text-red-300">
                            <ShoppingCart size={20} /> Issue (Outward)
                        </h3>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Issue materials to departments or machines. The system utilizes FIFO (First-In-First-Out) logic to track which specific purchase batches are being consumed, ensuring precise cost tracking.
                        </p>
                    </Card>

                     <Card className="p-6 bg-[var(--bg-card)] border-[var(--border-color)] hover:border-purple-400/30 transition-colors group">
                        <h3 className="text-lg font-bold text-purple-400 flex items-center gap-2 mb-3 group-hover:text-purple-300">
                            <ClipboardList size={20} /> Stock Register
                        </h3>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            The heart of the inventory. Switch between <strong>Summary View</strong> for weighted average valuation and <strong>Batches View</strong> for a detailed FIFO breakdown of every remaining purchase lot.
                        </p>
                    </Card>

                     <Card className="p-6 bg-[var(--bg-card)] border-[var(--border-color)] hover:border-yellow-400/30 transition-colors group">
                        <h3 className="text-lg font-bold text-yellow-400 flex items-center gap-2 mb-3 group-hover:text-yellow-300">
                            <CheckSquare size={20} /> Stock Taking
                        </h3>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Perform physical stock verification effortlessly. The app highlights items pending verification in the current cycle (Daily/Weekly/Monthly) and allows for quick adjustments to match system stock with reality.
                        </p>
                    </Card>

                     <Card className="p-6 bg-[var(--bg-card)] border-[var(--border-color)] hover:border-pink-400/30 transition-colors group">
                        <h3 className="text-lg font-bold text-pink-400 flex items-center gap-2 mb-3 group-hover:text-pink-300">
                            <BarChart3 size={20} /> Reports
                        </h3>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Generate comprehensive reports for Opening Stock, Purchase, Issue, and Closing Stock. Build custom filtered reports or export data to CSV for external analysis.
                        </p>
                    </Card>
                </div>

                <div className="pt-16 pb-8 text-center">
                     <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] text-gray-500 text-sm font-medium hover:border-[var(--accent)]/50 hover:text-[var(--accent)] transition-all cursor-default">
                        <Zap size={16} className="fill-current" /> 
                        Vibe coded and designed by Chetan Luthra
                    </div>
                </div>
            </div>
        </div>
    );
};

export default About;
