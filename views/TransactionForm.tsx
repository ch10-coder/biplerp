import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Material, TransactionType, Transaction, AppData, AppSettings } from '../types';
import { addTransactions, addMaterial, getAppData, calculateBatches, saveEditedBill } from '../services/storageService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { 
  Copy, Plus, Trash2, Sparkles, AlertCircle, Info, ShoppingCart, 
  ArrowRightLeft, Calculator, Calendar, Ban, Edit3, XCircle, Loader2, 
  Save, Truck, User, FileText, Package, MapPin, Search, Check, X, 
  ChevronRight, Hash, Box, Building, ArrowRight, ShieldCheck, CheckCircle2
} from 'lucide-react';

interface Props {
    type: TransactionType;
    materials: Material[];
    settings?: AppSettings;
    onComplete: () => void;
    editMode?: boolean;
    cloneMode?: boolean;
    initialData?: {
        header: any;
        items: Transaction[];
    };
    onCancel?: () => void;
}

interface PurchaseItemRow {
    tempId: string;
    txId?: string;
    materialId: string;
    materialName: string;
    isNew: boolean;
    group: string;
    department: string;
    location: string;
    unit: string;
    hsn: string;
    description: string;
    qty: number;
    rate: number;
    discountPercent: number; 
    gstRate: number;
    freight?: number;
}

interface IssueItemRow {
    tempId: string;
    materialId: string;
    materialName: string;
    currentStock: number;
    unit: string;
    sourceDepartment?: string; 
    qty: number;
    remarks: string; 
    batchesUsed: any[]; 
    valuation: number; 
}

const TransactionForm: React.FC<Props> = ({ 
    type, 
    materials, 
    settings, 
    onComplete, 
    editMode = false, 
    cloneMode = false, 
    initialData, 
    onCancel 
}) => {
    const appSettings = settings || { defaultGstRate: 18, currencySymbol: '₹', defaultMinLevel: 5, enableNegativeStock: false };

    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Purchase State
    const [grnNo, setGrnNo] = useState('');
    const [grnDate, setGrnDate] = useState('');
    const [mrnNo, setMrnNo] = useState('');
    const [mrnDate, setMrnDate] = useState(new Date().toISOString().split('T')[0]); 
    const [billNo, setBillNo] = useState('');
    const [vendor, setVendor] = useState('');
    const [gstNo, setGstNo] = useState('');
    const [billFreight, setBillFreight] = useState<number>(0); 
    const [defaultBillGst, setDefaultBillGst] = useState<number>(appSettings.defaultGstRate || 18);
    
    const [purchaseItems, setPurchaseItems] = useState<PurchaseItemRow[]>([
        { tempId: '1', materialId: '', materialName: '', isNew: false, group: '', department: '', location: '', unit: '', hsn: '', description: '', qty: 0, rate: 0, discountPercent: 0, gstRate: appSettings.defaultGstRate || 18 }
    ]);

    // Issue State
    const [issueDept, setIssueDept] = useState('');
    const [issueReceiver, setIssueReceiver] = useState(''); 
    const [issueItems, setIssueItems] = useState<IssueItemRow[]>([
        { tempId: '1', materialId: '', materialName: '', currentStock: 0, unit: '', qty: 0, remarks: '', batchesUsed: [], valuation: 0 }
    ]);

    // Helper State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGroupFilter, setSelectedGroupFilter] = useState('ALL');
    const [activeRowId, setActiveRowId] = useState<string | null>(null);
    const [pickerMode, setPickerMode] = useState<'PURCHASE' | 'ISSUE'>('PURCHASE');
    const [cachedAppData, setCachedAppData] = useState<AppData | null>(null);
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    useEffect(() => {
        getAppData().then(setCachedAppData);
    }, []);

    // Extract unique historical receivers for auto-suggestions
    const historicalReceivers = useMemo(() => {
        if (!cachedAppData) return [];
        const receivers = new Set<string>();
        cachedAppData.transactions.forEach(t => {
            if (t.type === 'ISSUE' && t.remarks) {
                const match = t.remarks.match(/^Receiver: (.*?) \|/);
                if (match && match[1]) {
                    const name = match[1].trim();
                    if (name) receivers.add(name);
                }
            }
        });
        return Array.from(receivers).sort();
    }, [cachedAppData]);

    const uniqueDepartments = useMemo(() => {
        if (!cachedAppData) return [];
        const depts = new Set<string>();
        cachedAppData.departments.forEach(d => { if (d) depts.add(d.trim()); });
        cachedAppData.materials.forEach(m => { if (m.department) depts.add(m.department.trim()); });
        cachedAppData.transactions.forEach(t => { if (t.department) depts.add(t.department.trim()); });
        return Array.from(depts).sort();
    }, [cachedAppData]);

    // Unique groups for modal filtering
    const uniqueGroups = useMemo(() => {
        const groups = new Set<string>();
        materials.forEach(m => { if (m.group) groups.add(m.group.trim()); });
        return ['ALL', ...Array.from(groups).sort()];
    }, [materials]);

    // Keyboard listener to close picker with ESC
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isPickerOpen) {
                setIsPickerOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPickerOpen]);

    // INIT DATA FOR EDIT / CLONE MODE
    useEffect(() => {
        if (initialData && type === 'PURCHASE') {
            const h = initialData.header;
            setVendor(h.vendor || '');
            setGstNo(h.gstNo || '');
            const totalFreight = initialData.items.reduce((sum, item) => sum + (item.freight || 0), 0);
            setBillFreight(totalFreight);

            if (editMode) {
                setBillNo(h.billNo || '');
                setDate(h.billDate ? new Date(h.billDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
                setMrnNo(h.mrnNo || '');
                setMrnDate(h.mrnDate ? new Date(h.mrnDate).toISOString().split('T')[0] : '');
                setGrnNo(h.grnNo || '');
                setGrnDate(h.grnDate ? new Date(h.grnDate).toISOString().split('T')[0] : '');
            } else if (cloneMode) {
                setBillNo('');
                setDate(new Date().toISOString().split('T')[0]);
                setMrnNo('');
                setMrnDate(new Date().toISOString().split('T')[0]);
                setGrnNo('');
                setGrnDate('');
            }
            
            const loadedItems: PurchaseItemRow[] = initialData.items.map((item, idx) => {
                const mat = materials.find(m => m.id === item.materialId);
                const base = (item.quantity || 0) * (item.rate || 0);
                const discountPercent = (base > 0 && item.discount) ? (item.discount / base) * 100 : 0;

                return {
                    tempId: item.id || idx.toString(),
                    txId: cloneMode ? undefined : item.id,
                    materialId: item.materialId,
                    materialName: item.materialName,
                    isNew: false,
                    group: item.group || mat?.group || '',
                    department: item.department || mat?.department || '',
                    location: item.location || mat?.location || '',
                    unit: mat?.unit || 'Pcs',
                    hsn: item.hsn || mat?.hsn || '',
                    description: mat?.description || '',
                    qty: item.quantity,
                    rate: item.rate,
                    discountPercent: parseFloat(discountPercent.toFixed(2)),
                    gstRate: item.gstRate || appSettings.defaultGstRate || 18,
                    freight: item.freight
                };
            });
            setPurchaseItems(loadedItems.length > 0 ? loadedItems : purchaseItems);
        }
    }, [editMode, cloneMode, initialData, type, materials]);

    const purchaseGrandTotal = useMemo(() => {
        let itemsTotal = 0;
        purchaseItems.forEach(row => {
            const base = row.qty * row.rate;
            const discAmt = base * (row.discountPercent / 100);
            const taxable = base - discAmt;
            const gstAmt = taxable * (row.gstRate / 100);
            itemsTotal += (taxable + gstAmt);
        });
        return itemsTotal + (billFreight || 0);
    }, [purchaseItems, billFreight]);

    const issueGrandTotal = useMemo(() => {
        return issueItems.reduce((acc, row) => acc + (row.valuation || 0), 0);
    }, [issueItems]);

    // HANDLERS: PURCHASE
    const updatePurchaseRow = (id: string, field: keyof PurchaseItemRow, value: any) => {
        setPurchaseItems(items => items.map(item => item.tempId === id ? { ...item, [field]: value } : item));
    };

    const handleAddPurchaseRow = () => {
        setPurchaseItems(prev => [
            ...prev,
            { 
                tempId: Date.now().toString() + Math.random().toString().slice(2, 5), 
                materialId: '', 
                materialName: '', 
                isNew: false, 
                group: '', 
                department: '', 
                location: '', 
                unit: 'Nos', 
                hsn: '', 
                description: '', 
                qty: 0, 
                rate: 0, 
                discountPercent: 0, 
                gstRate: appSettings.defaultGstRate || 18 
            }
        ]);
    };

    const handleRemovePurchaseRow = (id: string) => {
        if (purchaseItems.length === 1) {
            setPurchaseItems([{ 
                tempId: Date.now().toString(), 
                materialId: '', 
                materialName: '', 
                isNew: false, 
                group: '', 
                department: '', 
                location: '', 
                unit: 'Nos', 
                hsn: '', 
                description: '', 
                qty: 0, 
                rate: 0, 
                discountPercent: 0, 
                gstRate: appSettings.defaultGstRate || 18 
            }]);
            return;
        }
        setPurchaseItems(prev => prev.filter(r => r.tempId !== id));
    };

    const handleOpenPicker = (rowId: string, mode: 'PURCHASE' | 'ISSUE') => {
        setActiveRowId(rowId);
        setPickerMode(mode);
        setSearchTerm('');
        setSelectedGroupFilter('ALL');
        setIsPickerOpen(true);
    };

    const handlePurchaseMatSelect = (material: Material) => {
        if (!activeRowId) return;
        setPurchaseItems(items => items.map(item => item.tempId === activeRowId ? {
            ...item, 
            materialId: material.id, 
            materialName: material.name, 
            isNew: false, 
            group: material.group, 
            department: material.department, 
            location: material.location, 
            unit: material.unit || 'Nos', 
            hsn: material.hsn || '', 
            description: material.description || '', 
            gstRate: material.gstRate || defaultBillGst
        } : item));
        setSearchTerm(''); 
        setActiveRowId(null);
        setIsPickerOpen(false);
    };

    const handleCreateNewFromPicker = () => {
        if (!activeRowId || !searchTerm.trim()) return;
        setPurchaseItems(items => items.map(item => item.tempId === activeRowId ? {
            ...item, 
            materialName: searchTerm.trim(), 
            isNew: true, 
            materialId: '', 
            unit: 'Nos',
            group: 'General',
            department: 'Store'
        } : item));
        setSearchTerm(''); 
        setActiveRowId(null);
        setIsPickerOpen(false);
    };

    // HANDLERS: ISSUE
    const handleAddIssueRow = () => {
        setIssueItems(prev => [
            ...prev, 
            { tempId: Date.now().toString() + Math.random().toString().slice(2, 5), materialId: '', materialName: '', currentStock: 0, unit: '', qty: 0, remarks: '', batchesUsed: [], valuation: 0 }
        ]);
    };

    const handleRemoveIssueRow = (id: string) => {
        if (issueItems.length === 1) {
            setIssueItems([{ tempId: Date.now().toString(), materialId: '', materialName: '', currentStock: 0, unit: '', qty: 0, remarks: '', batchesUsed: [], valuation: 0 }]);
            return;
        }
        setIssueItems(prev => prev.filter(i => i.tempId !== id));
    };

    const handleIssueMatSelect = (material: Material) => {
        if (!activeRowId) return;
        setIssueItems(items => items.map(item => item.tempId === activeRowId ? {
            ...item, 
            materialId: material.id, 
            materialName: material.name, 
            currentStock: material.currentStock, 
            unit: material.unit, 
            sourceDepartment: material.department, 
            qty: 0, 
            batchesUsed: [], 
            valuation: 0
        } : item));
        setSearchTerm(''); 
        setIsPickerOpen(false);
        setActiveRowId(null);
    };

    const updateIssueQty = (rowId: string, qty: number) => {
        if (!cachedAppData) return;
        setIssueItems(items => items.map(item => {
            if (item.tempId !== rowId) return item;
            if (qty <= 0 || !item.materialId) return { ...item, qty, batchesUsed: [], valuation: 0 };
            const batches = calculateBatches(item.materialId, cachedAppData);
            let remainingToIssue = qty;
            let totalVal = 0;
            const used: any[] = [];
            if (batches.length > 0) {
                for (const batch of batches) {
                    if (remainingToIssue <= 0) break;
                    const take = Math.min(batch.remainingQty, remainingToIssue);
                    const cost = batch.avgRate || batch.rate; 
                    totalVal += (take * cost);
                    used.push({ ...batch, take });
                    remainingToIssue -= take;
                }
                if (remainingToIssue > 0 && appSettings.enableNegativeStock) {
                    const lastRate = batches[batches.length-1]?.rate || batches[batches.length-1]?.avgRate || 0;
                    totalVal += (remainingToIssue * lastRate);
                }
            } else if (appSettings.enableNegativeStock) {
                const mat = materials.find(m => m.id === item.materialId);
                totalVal = qty * (mat?.pricePerUnit || 0);
            }
            return { ...item, qty, batchesUsed: used, valuation: totalVal };
        }));
    };

    const updateIssueRemark = (rowId: string, val: string) => {
        setIssueItems(items => items.map(item => item.tempId === rowId ? { ...item, remarks: val } : item));
    };

    // SUBMIT: PURCHASE
    const submitPurchase = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        if (!billNo.trim() || !vendor.trim()) { 
            setError("Bill No and Vendor Name are required."); 
            setIsSubmitting(false); 
            return; 
        }

        let totalTaxableValue = 0;
        purchaseItems.forEach(row => {
            if ((!row.materialId && !row.isNew) || row.qty <= 0) return;
            const base = row.qty * row.rate;
            const discAmt = base * (row.discountPercent / 100);
            totalTaxableValue += (base - discAmt);
        });

        const txs: Transaction[] = [];
        const materialEntryDate = mrnDate || grnDate || date;
        for (const row of purchaseItems) {
            if ((!row.materialId && !row.isNew) || row.qty <= 0) continue;
            let matId = row.materialId;
            if (row.isNew) {
                const newMat: Material = { 
                    id: Date.now().toString() + Math.random().toString().slice(2, 5), 
                    name: row.materialName, 
                    group: row.group || 'General', 
                    department: row.department || 'Store', 
                    unit: row.unit || 'Nos', 
                    location: row.location || '', 
                    currentStock: 0, 
                    pricePerUnit: 0, 
                    hsn: row.hsn, 
                    gstRate: row.gstRate, 
                    description: row.description, 
                    minLevel: appSettings.defaultMinLevel || 5 
                };
                await addMaterial(newMat); 
                matId = newMat.id;
            }
            const base = row.qty * row.rate;
            const discAmt = base * (row.discountPercent / 100);
            const taxable = base - discAmt;
            const gstAmt = taxable * (row.gstRate / 100);
            const allocatedFreight = totalTaxableValue > 0 
                ? (taxable / totalTaxableValue) * billFreight 
                : (billFreight > 0 && purchaseItems.length === 1 ? billFreight : 0);
            const inventoryValue = taxable + allocatedFreight;
            const avgRate = row.qty > 0 ? inventoryValue / row.qty : 0; 
            const totalBillAmount = inventoryValue + gstAmt;

            txs.push({ 
                id: (editMode && row.txId) ? row.txId! : (Date.now().toString() + Math.random().toString().slice(2, 5)), 
                type: 'PURCHASE', 
                date: materialEntryDate, 
                materialId: matId, 
                materialName: row.materialName, 
                quantity: row.qty, 
                rate: row.rate, 
                totalValue: totalBillAmount, 
                billNo, 
                billDate: date, 
                vendor, 
                gstNo, 
                grnNo, 
                grnDate, 
                mrnNo, 
                mrnDate, 
                discount: discAmt, 
                freight: allocatedFreight, 
                gstRate: row.gstRate, 
                gstAmount: gstAmt, 
                avgRate: avgRate, 
                department: row.department, 
                group: row.group, 
                location: row.location 
            });
        }

        if (txs.length === 0) { 
            setError("Please add at least one valid item with Quantity > 0."); 
            setIsSubmitting(false); 
            return; 
        }

        if (editMode && initialData) {
            const header = { entryDate: mrnDate || grnDate || date, billNo, billDate: date, vendor, gstNo, mrnNo, mrnDate, grnNo, grnDate };
            await saveEditedBill(initialData.header.billNo, initialData.header.vendor, header, txs);
            setSuccess("Bill updated successfully!");
        } else {
            await addTransactions(txs);
            setSuccess(cloneMode ? "Bill cloned and recorded!" : "Purchase bill recorded successfully!"); 
        }
        setIsSubmitting(false);
        setTimeout(onComplete, 900);
    };

    // SUBMIT: ISSUE
    const submitIssue = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        if (!issueDept) { 
            setError("Please select the Target Department."); 
            setIsSubmitting(false); 
            return; 
        }

        const txs: Transaction[] = [];
        let hasError = false;
        issueItems.forEach(row => {
            if (!row.materialId || row.qty <= 0) return;
            const canIssue = appSettings.enableNegativeStock || (row.qty <= row.currentStock + 0.001);
            if (!canIssue) { 
                setError(`Insufficient stock for "${row.materialName}". Available: ${row.currentStock} ${row.unit}`); 
                hasError = true; 
                return; 
            }
            const effRate = row.qty > 0 ? row.valuation / row.qty : 0;
            const batchRefs = row.batchesUsed.map(b => `#${b.id.slice(-4)}`).join(', ');
            const fullRemark = `${issueReceiver ? `Receiver: ${issueReceiver} | ` : ''}${row.remarks || ''} ${batchRefs ? `(Ref: ${batchRefs})` : ''}`.trim();

            txs.push({ 
                id: Date.now().toString() + Math.random().toString().slice(2, 5), 
                type: 'ISSUE', 
                date: date, 
                materialId: row.materialId, 
                materialName: row.materialName, 
                quantity: row.qty, 
                rate: effRate, 
                totalValue: row.valuation, 
                department: issueDept, 
                remarks: fullRemark 
            });
        });

        if (hasError) { setIsSubmitting(false); return; }
        if (txs.length === 0) { 
            setError("Please add at least one material with Quantity > 0 to issue."); 
            setIsSubmitting(false); 
            return; 
        }

        await addTransactions(txs);
        setSuccess("Material issue processed successfully!"); 
        setIssueItems([{ tempId: Date.now().toString(), materialId: '', materialName: '', currentStock: 0, unit: '', qty: 0, remarks: '', batchesUsed: [], valuation: 0 }]);
        setIsSubmitting(false);
        setTimeout(onComplete, 900);
    };

    const filteredMaterialsForPicker = useMemo(() => {
        return materials.filter(m => {
            if (pickerMode === 'ISSUE' && m.currentStock <= 0) return false;
            if (selectedGroupFilter !== 'ALL' && m.group !== selectedGroupFilter) return false;
            const term = searchTerm.toLowerCase().trim();
            if (!term) return true;
            return m.name.toLowerCase().includes(term) || 
                   (m.group || '').toLowerCase().includes(term) || 
                   (m.department || '').toLowerCase().includes(term) ||
                   (m.location || '').toLowerCase().includes(term) ||
                   (m.hsn || '').toLowerCase().includes(term);
        }).sort((a, b) => b.currentStock - a.currentStock);
    }, [materials, searchTerm, pickerMode, selectedGroupFilter]);

    if (!cachedAppData) {
        return (
            <div className="p-16 flex flex-col items-center justify-center text-center">
                <Loader2 className="animate-spin text-[var(--accent)] mb-3" size={32} />
                <p className="text-sm font-semibold text-[var(--text-secondary)]">Loading inventory catalog...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20 max-w-7xl mx-auto animate-fadeIn">
            
            {/* Header Strip */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[var(--border-color)]">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg ${
                            type === 'PURCHASE' ? 'bg-gradient-to-br from-emerald-500 to-teal-700 shadow-emerald-500/20' : 'bg-gradient-to-br from-purple-500 to-indigo-700 shadow-purple-500/20'
                        }`}>
                            {type === 'PURCHASE' ? (editMode ? <Edit3 size={20}/> : <Truck size={20}/>) : <ShoppingCart size={20}/>}
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">
                                {type === 'PURCHASE' 
                                    ? (editMode ? 'Edit Inward Bill' : cloneMode ? 'Clone Inward Bill' : 'Inward Bill Entry') 
                                    : 'Material Issuance'}
                            </h2>
                            <p className="text-xs text-[var(--text-secondary)]">
                                {type === 'PURCHASE' ? 'Record vendor inward invoice & FIFO stock receipts' : 'Multi-item departmental issue with automated FIFO batch valuation'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button 
                        variant="secondary" 
                        size="md" 
                        onClick={onCancel || onComplete} 
                        className="cursor-pointer"
                    >
                        Cancel
                    </Button>
                </div>
            </div>

            {/* Error & Success Feedback Alerts */}
            {error && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 flex items-center gap-3 animate-fadeIn">
                    <AlertCircle size={18} className="shrink-0 text-rose-500" />
                    <span className="text-xs sm:text-sm font-semibold">{error}</span>
                </div>
            )}
            {success && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 flex items-center gap-3 animate-fadeIn">
                    <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />
                    <span className="text-xs sm:text-sm font-semibold">{success}</span>
                </div>
            )}

            {/* ================= PURCHASE FORM ================= */}
            {type === 'PURCHASE' ? (
                <form onSubmit={submitPurchase} className="space-y-6">
                    {/* Top Metadata Cards */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        
                        {/* 1. Vendor & Invoice Info */}
                        <Card 
                            className="p-5" 
                            headerIcon={<User size={18} />} 
                            title="Vendor & Invoice Info" 
                            subtitle="Billing credentials & dates"
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                                        Vendor Name <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            list="vendors-datalist" 
                                            value={vendor} 
                                            onChange={e => setVendor(e.target.value)} 
                                            className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl py-2.5 px-3.5 text-sm font-semibold text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-all shadow-inner" 
                                            placeholder="Search or enter vendor name..." 
                                            required 
                                            autoFocus 
                                        />
                                        <datalist id="vendors-datalist">
                                            {cachedAppData?.vendors.map(v => <option key={v} value={v} />)}
                                        </datalist>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                                        Bill No <span className="text-rose-500">*</span>
                                    </label>
                                    <input 
                                        type="text" 
                                        value={billNo} 
                                        onChange={e => setBillNo(e.target.value)} 
                                        className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl py-2.5 px-3.5 text-sm font-bold font-mono text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-all" 
                                        placeholder="INV-001" 
                                        required 
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                                        Bill Date <span className="text-rose-500">*</span>
                                    </label>
                                    <input 
                                        type="date" 
                                        value={date} 
                                        onChange={e => setDate(e.target.value)} 
                                        className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl py-2.5 px-3.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-all" 
                                        required 
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                                        GSTIN (Optional)
                                    </label>
                                    <input 
                                        type="text" 
                                        value={gstNo} 
                                        onChange={e => setGstNo(e.target.value)} 
                                        className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl py-2 px-3.5 text-xs font-mono text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-all" 
                                        placeholder="22AAAAA0000A1Z5" 
                                    />
                                </div>
                            </div>
                        </Card>

                        {/* 2. Stock Reference */}
                        <Card 
                            className="p-5" 
                            headerIcon={<FileText size={18} />} 
                            title="Stock Reference" 
                            subtitle="Gate pass & store entry details"
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                                        MRN No (Gate)
                                    </label>
                                    <input 
                                        type="text" 
                                        value={mrnNo} 
                                        onChange={e => setMrnNo(e.target.value)} 
                                        className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl py-2.5 px-3.5 text-sm font-mono text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-all" 
                                        placeholder="Auto / Manual MRN" 
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1.5">
                                        Stock Date <span className="text-rose-500">*</span>
                                    </label>
                                    <input 
                                        type="date" 
                                        value={mrnDate} 
                                        onChange={e => setMrnDate(e.target.value)} 
                                        className="w-full bg-[var(--bg-main)] border border-emerald-500/40 rounded-xl py-2.5 px-3.5 text-sm text-[var(--text-primary)] focus:border-emerald-500 focus:outline-none transition-all" 
                                        required 
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                                        GRN No
                                    </label>
                                    <input 
                                        type="text" 
                                        value={grnNo} 
                                        onChange={e => setGrnNo(e.target.value)} 
                                        className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl py-2.5 px-3.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-all" 
                                        placeholder="Optional GRN" 
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                                        GRN Date
                                    </label>
                                    <input 
                                        type="date" 
                                        value={grnDate} 
                                        onChange={e => setGrnDate(e.target.value)} 
                                        className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl py-2.5 px-3.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-all" 
                                    />
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Inward Items Section */}
                    <Card className="p-0 overflow-hidden">
                        <div className="p-4 sm:p-5 border-b border-[var(--border-color)] bg-[var(--bg-main)]/50 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                                <Package size={18} className="text-[var(--accent)]" />
                                <h3 className="text-base font-bold text-[var(--text-primary)]">Bill Items</h3>
                                <Badge variant="blue" size="sm">{purchaseItems.length} {purchaseItems.length === 1 ? 'Row' : 'Rows'}</Badge>
                            </div>
                            <Button 
                                variant="secondary" 
                                size="sm" 
                                onClick={handleAddPurchaseRow}
                                icon={<Plus size={14} />}
                                className="cursor-pointer font-bold"
                            >
                                Add Row
                            </Button>
                        </div>

                        {/* DESKTOP TABLE VIEW (md & above) */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left text-sm text-[var(--text-secondary)]">
                                <thead className="bg-[var(--bg-main)]/80 text-[11px] uppercase font-bold tracking-wider text-[var(--text-secondary)] border-b border-[var(--border-color)]">
                                    <tr>
                                        <th className="py-3 px-4 w-12 text-center">#</th>
                                        <th className="py-3 px-4 min-w-[260px]">Item Description</th>
                                        <th className="py-3 px-4 w-24 text-center">Unit</th>
                                        <th className="py-3 px-4 w-28 text-right">Qty</th>
                                        <th className="py-3 px-4 w-32 text-right">Rate (₹)</th>
                                        <th className="py-3 px-4 w-24 text-right">Disc %</th>
                                        <th className="py-3 px-4 w-24 text-right">GST %</th>
                                        <th className="py-3 px-4 w-36 text-right">Amount</th>
                                        <th className="py-3 px-4 w-12 text-center"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-color)]">
                                    {purchaseItems.map((row, idx) => {
                                        const base = row.qty * row.rate;
                                        const disc = base * (row.discountPercent / 100);
                                        const total = ((base - disc) * (1 + row.gstRate / 100)).toFixed(2);
                                        return (
                                            <tr key={row.tempId} className="hover:bg-[var(--bg-card-hover)] transition-colors group">
                                                <td className="py-3 px-4 text-center font-mono text-xs text-[var(--text-secondary)]">
                                                    {idx + 1}
                                                </td>
                                                <td className="py-3 px-4 max-w-[320px]">
                                                    <div 
                                                        className={`p-2.5 border rounded-xl cursor-pointer flex items-center justify-between transition-all min-w-0 ${
                                                            !row.materialName 
                                                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400 hover:border-rose-500' 
                                                                : 'bg-[var(--bg-main)] border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent)] font-semibold'
                                                        }`}
                                                        onClick={() => handleOpenPicker(row.tempId, 'PURCHASE')}
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                                                            {row.materialName ? (
                                                                row.isNew ? <Badge variant="emerald" size="sm">NEW</Badge> : <Check size={14} className="text-emerald-500 shrink-0" />
                                                            ) : (
                                                                <Search size={14} className="text-[var(--text-secondary)] shrink-0" />
                                                            )}
                                                            <span className="truncate text-xs sm:text-sm">{row.materialName || 'Click to select Item...'}</span>
                                                        </div>
                                                        <ChevronRight size={14} className="opacity-50 shrink-0" />
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 align-middle">
                                                    <input 
                                                        type="text" 
                                                        value={row.unit} 
                                                        onChange={e => updatePurchaseRow(row.tempId, 'unit', e.target.value)} 
                                                        className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg text-center text-xs text-[var(--text-primary)] font-medium py-1.5 focus:border-[var(--accent)] focus:outline-none" 
                                                        placeholder="Nos"
                                                    />
                                                </td>
                                                <td className="py-3 px-4 align-middle">
                                                    <input 
                                                        type="number" 
                                                        step="any" 
                                                        value={row.qty || ''} 
                                                        onChange={e => updatePurchaseRow(row.tempId, 'qty', parseFloat(e.target.value) || 0)} 
                                                        className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg text-right font-bold text-sm text-[var(--text-primary)] py-1.5 px-2 focus:border-[var(--accent)] focus:outline-none font-mono" 
                                                        placeholder="0"
                                                    />
                                                </td>
                                                <td className="py-3 px-4 align-middle">
                                                    <input 
                                                        type="number" 
                                                        step="any" 
                                                        value={row.rate || ''} 
                                                        onChange={e => updatePurchaseRow(row.tempId, 'rate', parseFloat(e.target.value) || 0)} 
                                                        className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg text-right font-mono text-sm text-[var(--text-primary)] py-1.5 px-2 focus:border-[var(--accent)] focus:outline-none" 
                                                        placeholder="0.00"
                                                    />
                                                </td>
                                                <td className="py-3 px-4 align-middle">
                                                    <input 
                                                        type="number" 
                                                        step="any" 
                                                        value={row.discountPercent || ''} 
                                                        onChange={e => updatePurchaseRow(row.tempId, 'discountPercent', parseFloat(e.target.value) || 0)} 
                                                        className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg text-right text-xs text-[var(--text-primary)] py-1.5 px-2 focus:border-[var(--accent)] focus:outline-none" 
                                                        placeholder="0%"
                                                    />
                                                </td>
                                                <td className="py-3 px-4 align-middle">
                                                    <input 
                                                        type="number" 
                                                        step="any" 
                                                        value={row.gstRate || ''} 
                                                        onChange={e => updatePurchaseRow(row.tempId, 'gstRate', parseFloat(e.target.value) || 0)} 
                                                        className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg text-center text-xs text-[var(--text-primary)] py-1.5 px-2 focus:border-[var(--accent)] focus:outline-none" 
                                                        placeholder="18%"
                                                    />
                                                </td>
                                                <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                                                    {appSettings.currencySymbol} {parseFloat(total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <button 
                                                        type="button" 
                                                        onClick={() => handleRemovePurchaseRow(row.tempId)} 
                                                        className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                                        title="Delete row"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* MOBILE CARD VIEW (under md) */}
                        <div className="block md:hidden p-4 space-y-4">
                            {purchaseItems.map((row, idx) => {
                                const base = row.qty * row.rate;
                                const disc = base * (row.discountPercent / 100);
                                const total = ((base - disc) * (1 + row.gstRate / 100)).toFixed(2);
                                return (
                                    <div key={row.tempId} className="p-4 rounded-2xl bg-[var(--bg-main)]/60 border border-[var(--border-color)] space-y-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-mono font-bold text-[var(--text-secondary)]">#{idx + 1}</span>
                                            <button 
                                                type="button" 
                                                onClick={() => handleRemovePurchaseRow(row.tempId)}
                                                className="text-rose-500 hover:text-rose-700 p-1 rounded-lg"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        {/* Item Select Pill */}
                                        <div 
                                            className={`p-3 border rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                                                !row.materialName 
                                                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400' 
                                                    : 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-primary)] font-semibold'
                                            }`}
                                            onClick={() => handleOpenPicker(row.tempId, 'PURCHASE')}
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                {row.materialName ? <Check size={14} className="text-emerald-500" /> : <Search size={14} className="text-[var(--text-secondary)]" />}
                                                <span className="text-sm truncate">{row.materialName || 'Click to select Item...'}</span>
                                            </div>
                                            <ChevronRight size={14} className="opacity-50" />
                                        </div>

                                        {/* Input Grid: Qty, Unit, Rate, GST */}
                                        <div className="grid grid-cols-2 gap-3 pt-1">
                                            <div>
                                                <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1">Qty</label>
                                                <input 
                                                    type="number" 
                                                    step="any" 
                                                    value={row.qty || ''} 
                                                    onChange={e => updatePurchaseRow(row.tempId, 'qty', parseFloat(e.target.value) || 0)} 
                                                    className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl py-2 px-3 text-sm font-bold font-mono text-[var(--text-primary)]" 
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1">Unit</label>
                                                <input 
                                                    type="text" 
                                                    value={row.unit} 
                                                    onChange={e => updatePurchaseRow(row.tempId, 'unit', e.target.value)} 
                                                    className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl py-2 px-3 text-sm text-center text-[var(--text-primary)]" 
                                                    placeholder="Nos"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1">Rate (₹)</label>
                                                <input 
                                                    type="number" 
                                                    step="any" 
                                                    value={row.rate || ''} 
                                                    onChange={e => updatePurchaseRow(row.tempId, 'rate', parseFloat(e.target.value) || 0)} 
                                                    className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl py-2 px-3 text-sm font-mono text-[var(--text-primary)]" 
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1">GST %</label>
                                                <input 
                                                    type="number" 
                                                    step="any" 
                                                    value={row.gstRate || ''} 
                                                    onChange={e => updatePurchaseRow(row.tempId, 'gstRate', parseFloat(e.target.value) || 0)} 
                                                    className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl py-2 px-3 text-sm text-center text-[var(--text-primary)]" 
                                                    placeholder="18"
                                                />
                                            </div>
                                        </div>

                                        {/* Subtotal row */}
                                        <div className="flex items-center justify-between pt-2 border-t border-[var(--border-color)]">
                                            <span className="text-xs text-[var(--text-secondary)] font-semibold">Row Total</span>
                                            <span className="font-mono font-bold text-sm text-emerald-700 dark:text-emerald-400">
                                                {appSettings.currencySymbol} {parseFloat(total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}

                            <Button 
                                variant="secondary" 
                                size="md" 
                                onClick={handleAddPurchaseRow} 
                                icon={<Plus size={16} />} 
                                className="w-full font-bold cursor-pointer"
                            >
                                Add Another Item
                            </Button>
                        </div>
                    </Card>

                    {/* Integrated Bottom Summary Checkout Card (No clumsy absolute overlap!) */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-5">
                        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                            <div>
                                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                                    Total Freight ({appSettings.currencySymbol})
                                </label>
                                <input 
                                    type="number" 
                                    value={billFreight || ''} 
                                    onChange={e => setBillFreight(parseFloat(e.target.value) || 0)} 
                                    className="w-36 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl py-2 px-3 text-sm font-bold font-mono text-[var(--text-primary)] text-right focus:border-[var(--accent)] focus:outline-none" 
                                    placeholder="0.00" 
                                />
                            </div>
                            <div className="text-xs text-[var(--text-secondary)] pl-2 border-l border-[var(--border-color)]">
                                <span className="font-bold text-[var(--text-primary)]">{purchaseItems.filter(i => i.qty > 0).length}</span> active items
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-5 w-full md:w-auto justify-end">
                            <div className="text-right">
                                <div className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wider">Grand Total (Inc. GST & Freight)</div>
                                <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                                    {appSettings.currencySymbol} {purchaseGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <Button 
                                type="submit" 
                                variant="success" 
                                size="lg" 
                                className="w-full sm:w-auto px-8 font-extrabold tracking-wide cursor-pointer shadow-lg shadow-emerald-500/20" 
                                loading={isSubmitting}
                            >
                                <Save size={18} />
                                {editMode ? 'Update Bill' : cloneMode ? 'Clone & Save' : 'Save Bill'}
                            </Button>
                        </div>
                    </div>
                </form>
            ) : (
                /* ================= ISSUE FORM ================= */
                <form onSubmit={submitIssue} className="space-y-6">
                    {/* Target Department & Receiver Card */}
                    <Card 
                        className="p-5" 
                        headerIcon={<Building size={18} />} 
                        title="Department & Issuance Target" 
                        subtitle="Destination center and receiver verification"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="text-xs text-[var(--text-secondary)] uppercase font-bold mb-1.5 block">
                                    Issue Date <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <input 
                                        type="date" 
                                        value={date} 
                                        onChange={e => setDate(e.target.value)} 
                                        className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl py-2.5 px-3.5 text-sm text-[var(--text-primary)] focus:border-rose-500 focus:outline-none transition-all" 
                                        required 
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-[var(--text-secondary)] uppercase font-bold mb-1.5 block">
                                    Target Department <span className="text-rose-500">*</span>
                                </label>
                                <select 
                                    value={issueDept} 
                                    onChange={e => setIssueDept(e.target.value)} 
                                    className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl py-2.5 px-3.5 text-sm text-[var(--text-primary)] focus:border-rose-500 focus:outline-none transition-all cursor-pointer font-medium" 
                                    required
                                >
                                    <option value="">-- Select Department --</option>
                                    {uniqueDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs text-[var(--text-secondary)] uppercase font-bold mb-1.5 block">
                                    Receiver / Machine Reference
                                </label>
                                <input 
                                    type="text" 
                                    list="issue-receivers-list"
                                    value={issueReceiver} 
                                    onChange={e => setIssueReceiver(e.target.value)} 
                                    placeholder="e.g. Mechanical Shop / CNC-02" 
                                    className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl py-2.5 px-3.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-all" 
                                />
                                <datalist id="issue-receivers-list">
                                    {historicalReceivers.map(name => (
                                        <option key={name} value={name} />
                                    ))}
                                </datalist>
                            </div>
                        </div>
                    </Card>

                    {/* Issue Items Card */}
                    <Card className="p-0 overflow-hidden">
                        <div className="p-4 sm:p-5 border-b border-[var(--border-color)] bg-[var(--bg-main)]/50 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                                <ShoppingCart size={18} className="text-rose-500" />
                                <h3 className="text-base font-bold text-[var(--text-primary)]">Issue Cart</h3>
                                <Badge variant="rose" size="sm">{issueItems.length} {issueItems.length === 1 ? 'Item' : 'Items'}</Badge>
                            </div>
                            <Button 
                                variant="secondary" 
                                size="sm" 
                                onClick={handleAddIssueRow} 
                                icon={<Plus size={14} />} 
                                className="cursor-pointer font-bold"
                            >
                                Add Another Item
                            </Button>
                        </div>

                        {/* DESKTOP ISSUE TABLE */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left text-sm text-[var(--text-secondary)]">
                                <thead className="bg-[var(--bg-main)]/80 text-[11px] uppercase font-bold tracking-wider text-[var(--text-secondary)] border-b border-[var(--border-color)]">
                                    <tr>
                                        <th className="py-3 px-4 min-w-[280px]">Material Name</th>
                                        <th className="py-3 px-4 w-32 text-right">Available Stock</th>
                                        <th className="py-3 px-4 w-32 text-right">Issue Qty</th>
                                        <th className="py-3 px-4 w-36 text-right">FIFO Valuation</th>
                                        <th className="py-3 px-4 min-w-[200px]">Remarks / Note</th>
                                        <th className="py-3 px-4 w-12 text-center"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-color)]">
                                    {issueItems.map(row => (
                                        <tr key={row.tempId} className="hover:bg-[var(--bg-card-hover)] transition-colors group">
                                            <td className="py-3 px-4">
                                                <div 
                                                    className={`p-2.5 border rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                                                        !row.materialId 
                                                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400 hover:border-rose-500' 
                                                            : 'bg-[var(--bg-main)] border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent)] font-semibold'
                                                    }`}
                                                    onClick={() => handleOpenPicker(row.tempId, 'ISSUE')}
                                                >
                                                    <div className="flex items-center gap-2.5 truncate">
                                                        {row.materialId ? <Check size={14} className="text-emerald-500" /> : <Search size={14} className="text-[var(--text-secondary)]" />}
                                                        <span className="truncate">{row.materialName || 'Click to select Item...'}</span>
                                                    </div>
                                                    <ChevronRight size={14} className="opacity-50 shrink-0" />
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className={`font-mono font-bold text-base ${row.materialId ? (row.currentStock > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500') : 'text-[var(--text-secondary)]'}`}>
                                                    {row.materialId ? row.currentStock : '--'}
                                                </div>
                                                {row.materialId && <div className="text-[10px] text-[var(--text-secondary)] font-semibold uppercase">{row.unit}</div>}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <input 
                                                    type="number" 
                                                    placeholder="0" 
                                                    value={row.qty || ''} 
                                                    onFocus={e => e.target.select()}
                                                    onChange={e => updateIssueQty(row.tempId, parseFloat(e.target.value) || 0)} 
                                                    className={`w-28 bg-[var(--bg-main)] border rounded-xl p-2 text-right font-bold text-[var(--text-primary)] text-base font-mono focus:ring-2 focus:ring-[var(--accent)] focus:outline-none ${
                                                        row.qty > row.currentStock && !appSettings.enableNegativeStock 
                                                            ? 'border-rose-500 text-rose-500' 
                                                            : 'border-[var(--border-color)]'
                                                    }`} 
                                                />
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono font-bold text-[var(--text-primary)]">
                                                <div className="text-sm">{appSettings.currencySymbol} {row.valuation.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                                {row.qty > 0 && <div className="text-[10px] text-[var(--text-secondary)] font-normal">@ {(row.valuation / row.qty).toFixed(2)} / {row.unit}</div>}
                                            </td>
                                            <td className="py-3 px-4">
                                                <input 
                                                    type="text" 
                                                    placeholder="Project or batch note..." 
                                                    value={row.remarks} 
                                                    onChange={e => updateIssueRemark(row.tempId, e.target.value)} 
                                                    className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl py-1.5 px-3 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none" 
                                                />
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleRemoveIssueRow(row.tempId)} 
                                                    className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* MOBILE ISSUE CARD VIEW */}
                        <div className="block md:hidden p-4 space-y-4">
                            {issueItems.map((row, idx) => (
                                <div key={row.tempId} className="p-4 rounded-2xl bg-[var(--bg-main)]/60 border border-[var(--border-color)] space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-mono font-bold text-[var(--text-secondary)]">Item #{idx + 1}</span>
                                        <button 
                                            type="button" 
                                            onClick={() => handleRemoveIssueRow(row.tempId)}
                                            className="text-rose-500 hover:text-rose-700 p-1 rounded-lg"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    {/* Material select button */}
                                    <div 
                                        className={`p-3 border rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                                            !row.materialId 
                                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400' 
                                                : 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-primary)] font-semibold'
                                        }`}
                                        onClick={() => handleOpenPicker(row.tempId, 'ISSUE')}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            {row.materialId ? <Check size={14} className="text-emerald-500" /> : <Search size={14} className="text-[var(--text-secondary)]" />}
                                            <span className="text-sm truncate">{row.materialName || 'Click to select Item...'}</span>
                                        </div>
                                        <ChevronRight size={14} className="opacity-50" />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 pt-1">
                                        <div>
                                            <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1">Available</label>
                                            <div className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                                                {row.materialId ? `${row.currentStock} ${row.unit}` : '--'}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1">Issue Qty</label>
                                            <input 
                                                type="number" 
                                                placeholder="0" 
                                                value={row.qty || ''} 
                                                onFocus={e => e.target.select()}
                                                onChange={e => updateIssueQty(row.tempId, parseFloat(e.target.value) || 0)} 
                                                className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl py-2 px-3 text-sm font-bold font-mono text-[var(--text-primary)]" 
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1">Remarks</label>
                                        <input 
                                            type="text" 
                                            placeholder="Note / Reference..." 
                                            value={row.remarks} 
                                            onChange={e => updateIssueRemark(row.tempId, e.target.value)} 
                                            className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl py-2 px-3 text-xs text-[var(--text-primary)]" 
                                        />
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-[var(--border-color)]">
                                        <span className="text-xs text-[var(--text-secondary)] font-semibold">FIFO Valuation</span>
                                        <span className="font-mono font-bold text-sm text-[var(--text-primary)]">
                                            {appSettings.currencySymbol} {row.valuation.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            ))}

                            <Button 
                                variant="secondary" 
                                size="md" 
                                onClick={handleAddIssueRow} 
                                icon={<Plus size={16} />} 
                                className="w-full font-bold cursor-pointer"
                            >
                                Add Another Item
                            </Button>
                        </div>
                    </Card>

                    {/* Integrated Bottom Summary Checkout Card for Issue */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-5">
                        <div className="text-xs text-[var(--text-secondary)]">
                            Auto-FIFO picks earliest batches first based on actual purchase receipt dates.
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-5 w-full md:w-auto justify-end">
                            <div className="text-right">
                                <div className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wider">Total Issue Valuation</div>
                                <div className="text-2xl sm:text-3xl font-extrabold text-rose-500 font-mono">
                                    {appSettings.currencySymbol} {issueGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <Button 
                                type="submit" 
                                variant="danger" 
                                size="lg" 
                                className="w-full sm:w-auto px-8 font-extrabold tracking-wide cursor-pointer shadow-lg shadow-rose-500/20" 
                                loading={isSubmitting}
                            >
                                <ShoppingCart size={18} /> Process Issue
                            </Button>
                        </div>
                    </div>
                </form>
            )}

            {/* ================= UNIVERSAL ITEM PICKER MODAL ================= */}
            {/* Rendered at top level so it works for BOTH Purchase and Issue */}
            {isPickerOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 md:p-10 bg-black/80 backdrop-blur-xl animate-fadeIn">
                    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] w-full max-w-4xl h-[90vh] max-h-[800px] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-scaleUp">
                        
                        {/* Modal Header */}
                        <div className="p-4 sm:p-5 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-main)]/70">
                            <div>
                                <h3 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                                    <Box size={20} className="text-[var(--accent)]"/> Select Material
                                </h3>
                                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                    {pickerMode === 'ISSUE' ? "Showing items with positive available stock." : "Select existing item or create new."}
                                </p>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setIsPickerOpen(false)} 
                                className="p-2 hover:bg-[var(--bg-card-hover)] rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                            >
                                <X size={20}/>
                            </button>
                        </div>

                        {/* Search & Category Chips */}
                        <div className="p-4 bg-[var(--bg-main)]/50 border-b border-[var(--border-color)] space-y-3">
                            <div className="relative group">
                                <Search size={18} className="absolute left-4 top-3.5 text-[var(--text-secondary)] group-focus-within:text-[var(--accent)] transition-colors"/>
                                <input 
                                    autoFocus
                                    placeholder="Search by name, group, department, HSN, location..."
                                    className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl py-3 pl-11 pr-10 text-[var(--text-primary)] text-sm sm:text-base focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] shadow-inner transition-all"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                                {searchTerm && (
                                    <button 
                                        type="button"
                                        onClick={() => setSearchTerm('')} 
                                        className="absolute right-3.5 top-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>

                            {/* Group Filter Chips */}
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                                {uniqueGroups.slice(0, 8).map(group => (
                                    <button
                                        key={group}
                                        type="button"
                                        onClick={() => setSelectedGroupFilter(group)}
                                        className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                                            selectedGroupFilter === group
                                                ? 'bg-[var(--accent)] text-white shadow-sm'
                                                : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:border-[var(--accent)]/50'
                                        }`}
                                    >
                                        {group}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Items Grid List */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-[var(--bg-main)]">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-8">
                                
                                {/* Create New Item Card (Purchase Mode Only) */}
                                {pickerMode === 'PURCHASE' && searchTerm.trim().length > 1 && (
                                    <div 
                                        onClick={handleCreateNewFromPicker}
                                        className="col-span-full bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl cursor-pointer hover:bg-emerald-500/20 hover:border-emerald-500 transition-all flex items-center gap-3.5 group shadow-sm"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                                            <Plus size={22}/>
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-sm text-emerald-700 dark:text-emerald-400 truncate">
                                                Create New Item: "{searchTerm.trim()}"
                                            </h4>
                                            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/70">
                                                Click to create & add directly to this bill and Master Catalog.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {filteredMaterialsForPicker.map(m => (
                                    <div 
                                        key={m.id} 
                                        onClick={() => pickerMode === 'ISSUE' ? handleIssueMatSelect(m) : handlePurchaseMatSelect(m)}
                                        className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 rounded-2xl cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--bg-card-hover)] transition-all flex justify-between items-center group shadow-sm"
                                    >
                                        <div className="min-w-0 mr-3">
                                            <h4 className="font-bold text-sm text-[var(--text-primary)] group-hover:text-[var(--accent)] truncate">
                                                {m.name}
                                            </h4>
                                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                                {m.group && (
                                                    <span className="text-[10px] bg-[var(--bg-main)] px-2 py-0.5 rounded-md border border-[var(--border-color)] text-[var(--text-secondary)] font-medium uppercase">
                                                        {m.group}
                                                    </span>
                                                )}
                                                {m.location && (
                                                    <span className="text-[10px] bg-[var(--bg-main)] px-2 py-0.5 rounded-md border border-[var(--border-color)] text-[var(--text-secondary)] font-mono">
                                                        📍 {m.location}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className={`text-xl font-mono font-bold ${
                                                m.currentStock > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--text-secondary)]'
                                            }`}>
                                                {m.currentStock}
                                            </div>
                                            <div className="text-[10px] text-[var(--text-secondary)] font-semibold uppercase">{m.unit}</div>
                                        </div>
                                    </div>
                                ))}

                                {filteredMaterialsForPicker.length === 0 && searchTerm.trim().length <= 1 && (
                                    <div className="col-span-full py-16 text-center text-[var(--text-secondary)]">
                                        <Box size={36} className="mx-auto mb-2 opacity-40" />
                                        <p className="text-sm font-semibold">No materials match this filter</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-3.5 bg-[var(--bg-main)] border-t border-[var(--border-color)] text-xs text-[var(--text-secondary)] flex justify-between items-center">
                            <span>Showing {filteredMaterialsForPicker.length} items</span>
                            <span className="font-mono text-[10px]">Press Esc to close</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TransactionForm;
