
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Material, TransactionType, Transaction, AppData, AppSettings } from '../types';
import { addTransactions, addMaterial, getAppData, calculateBatches, saveEditedBill } from '../services/storageService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Copy, Plus, Trash2, Sparkles, AlertCircle, Info, ShoppingCart, ArrowRightLeft, Calculator, Calendar, Ban, Edit3, XCircle, Loader2, Save, Truck, User, FileText, Package, MapPin, Search, Check, X, ChevronRight, Hash, Box, Building } from 'lucide-react';

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

const TransactionForm: React.FC<Props> = ({ type, materials, settings, onComplete, editMode = false, cloneMode = false, initialData, onCancel }) => {
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
    const [activeRowId, setActiveRowId] = useState<string | null>(null);
    const [pickerMode, setPickerMode] = useState<'PURCHASE' | 'ISSUE'>('ISSUE');
    const [cachedAppData, setCachedAppData] = useState<AppData | null>(null);
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    useEffect(() => {
        getAppData().then(setCachedAppData);
    }, []);

    // NEW: Logic to extract unique historical receivers for auto-suggestions
    const historicalReceivers = useMemo(() => {
        if (!cachedAppData) return [];
        const receivers = new Set<string>();
        cachedAppData.transactions.forEach(t => {
            if (t.type === 'ISSUE' && t.remarks) {
                // Parse out "Receiver: [name] |" pattern used in submitIssue
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

    // INIT DATA
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
            unit: material.unit, 
            hsn: material.hsn || '', 
            description: material.description || '', 
            gstRate: material.gstRate || defaultBillGst
        } : item));
        setSearchTerm(''); 
        setActiveRowId(null);
        setIsPickerOpen(false);
    };

    const handleCreateNewFromPicker = () => {
        if (!activeRowId || !searchTerm) return;
        setPurchaseItems(items => items.map(item => item.tempId === activeRowId ? {
            ...item, 
            materialName: searchTerm, 
            isNew: true, 
            materialId: '', 
            unit: 'Nos',
            group: 'General',
            department: 'Store'
        } : item));
        setSearchTerm(''); 
        setActiveRowId(null);
        setIsPickerOpen(false);
    }

    // HANDLERS: ISSUE
    const handleAddIssueRow = () => {
        setIssueItems([...issueItems, { tempId: Date.now().toString(), materialId: '', materialName: '', currentStock: 0, unit: '', qty: 0, remarks: '', batchesUsed: [], valuation: 0 }]);
    };

    const handleRemoveIssueRow = (id: string) => {
        if (issueItems.length === 1) {
            setIssueItems([{ tempId: Date.now().toString(), materialId: '', materialName: '', currentStock: 0, unit: '', qty: 0, remarks: '', batchesUsed: [], valuation: 0 }]);
            return;
        }
        setIssueItems(issueItems.filter(i => i.tempId !== id));
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
        setIsSubmitting(true);
        if (!billNo || !vendor) { setError("Bill No and Vendor are required"); setIsSubmitting(false); return; }
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
                const newMat: Material = { id: Date.now().toString()+Math.random().toString().slice(2,5), name: row.materialName, group: row.group, department: row.department, unit: row.unit, location: row.location, currentStock: 0, pricePerUnit: 0, hsn: row.hsn, gstRate: row.gstRate, description: row.description, minLevel: appSettings.defaultMinLevel || 5 };
                await addMaterial(newMat); 
                matId = newMat.id;
            }
            const base = row.qty * row.rate;
            const discAmt = base * (row.discountPercent / 100);
            const taxable = base - discAmt;
            const gstAmt = taxable * (row.gstRate / 100);
            let allocatedFreight = totalTaxableValue > 0 ? (taxable / totalTaxableValue) * billFreight : (billFreight > 0 && purchaseItems.length === 1 ? billFreight : 0);
            const inventoryValue = taxable + allocatedFreight;
            const avgRate = row.qty > 0 ? inventoryValue / row.qty : 0; 
            const totalBillAmount = inventoryValue + gstAmt;
            txs.push({ id: (editMode && row.txId) ? row.txId! : (Date.now().toString() + Math.random().toString().slice(2, 5)), type: 'PURCHASE', date: materialEntryDate, materialId: matId, materialName: row.materialName, quantity: row.qty, rate: row.rate, totalValue: totalBillAmount, billNo, billDate: date, vendor, gstNo, grnNo, grnDate, mrnNo, mrnDate, discount: discAmt, freight: allocatedFreight, gstRate: row.gstRate, gstAmount: gstAmt, avgRate: avgRate, department: row.department, group: row.group, location: row.location });
        }
        if (txs.length === 0) { setError("No valid items"); setIsSubmitting(false); return; }
        if (editMode && initialData) {
            const header = { entryDate: mrnDate || grnDate || date, billNo, billDate: date, vendor, gstNo, mrnNo, mrnDate, grnNo, grnDate };
            await saveEditedBill(initialData.header.billNo, initialData.header.vendor, header, txs);
            setSuccess("Bill Updated Successfully!");
        } else {
            await addTransactions(txs);
            setSuccess(cloneMode ? "Bill Cloned & Saved!" : "Purchase Saved!"); 
        }
        setIsSubmitting(false);
        setTimeout(onComplete, 1000);
    };

    // SUBMIT: ISSUE
    const submitIssue = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        if (!issueDept) { setError("Select Target Department"); setIsSubmitting(false); return; }
        const txs: Transaction[] = [];
        let hasError = false;
        issueItems.forEach(row => {
            if (!row.materialId || row.qty <= 0) return;
            const canIssue = appSettings.enableNegativeStock || (row.qty <= row.currentStock + 0.001);
            if (!canIssue) { setError(`Error: Insufficient stock for ${row.materialName}. Available: ${row.currentStock}`); hasError = true; return; }
            const effRate = row.qty > 0 ? row.valuation / row.qty : 0;
            const batchRefs = row.batchesUsed.map(b => `#${b.id.slice(-4)}`).join(', ');
            const fullRemark = `${issueReceiver ? `Receiver: ${issueReceiver} | ` : ''}${row.remarks} ${batchRefs ? `(Ref: ${batchRefs})` : ''}`;
            txs.push({ id: Date.now().toString() + Math.random().toString().slice(2,5), type: 'ISSUE', date: date, materialId: row.materialId, materialName: row.materialName, quantity: row.qty, rate: effRate, totalValue: row.valuation, department: issueDept, remarks: fullRemark });
        });
        if (hasError) { setIsSubmitting(false); return; }
        if (txs.length === 0) { setError("No valid items to issue"); setIsSubmitting(false); return; }
        await addTransactions(txs);
        setSuccess("Issue Saved!"); 
        setIssueItems([{ tempId: Date.now().toString(), materialId: '', materialName: '', currentStock: 0, unit: '', qty: 0, remarks: '', batchesUsed: [], valuation: 0 }]);
        setIsSubmitting(false);
        setTimeout(onComplete, 1000);
    };

    const filteredMaterialsForPicker = useMemo(() => {
        return materials.filter(m => {
            if (pickerMode === 'ISSUE' && m.currentStock <= 0) return false;
            const term = searchTerm.toLowerCase();
            return m.name.toLowerCase().includes(term) || 
                   m.group.toLowerCase().includes(term) || 
                   m.department.toLowerCase().includes(term) ||
                   (m.location || '').toLowerCase().includes(term);
        }).sort((a,b) => b.currentStock - a.currentStock);
    }, [materials, searchTerm, pickerMode]);

    if (!cachedAppData) return <div className="p-10 text-center"><Loader2 className="animate-spin inline-block text-[var(--accent)]"/> Loading data...</div>;

    if (type === 'PURCHASE') {
        return (
             <div className="space-y-4 pb-32 animate-fadeIn h-full flex flex-col">
                <div className="flex justify-between items-center shrink-0">
                    <h2 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                        {editMode ? <Edit3 className="text-yellow-500" /> : cloneMode ? <Copy className="text-cyan-400" /> : <Truck className="text-green-500"/>} 
                        {editMode ? 'Edit Bill' : cloneMode ? 'Clone Bill' : 'Inward Bill Entry'}
                    </h2>
                    <Button variant="secondary" onClick={onCancel || onComplete}>Cancel</Button>
                </div>
                <form onSubmit={submitPurchase} className="flex-1 flex flex-col gap-4 overflow-hidden">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 shrink-0">
                        <Card className="p-4 border-[var(--border-color)] bg-[var(--bg-card)]">
                            <div className="flex items-center gap-2 mb-3 text-[var(--accent)] font-bold text-xs uppercase border-b border-[var(--border-color)] pb-2"><User size={14} /> Vendor & Invoice Info</div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2"><label className="block text-[10px] text-[var(--text-secondary)] font-bold uppercase mb-1">Vendor Name <span className="text-red-500">*</span></label><input type="text" list="vendors" value={vendor} onChange={e=>setVendor(e.target.value)} className="w-full h-9 px-3 rounded-md text-sm font-medium focus:ring-2 focus:ring-[var(--accent)] text-[var(--text-primary)]" placeholder="Search Vendor..." required autoFocus /><datalist id="vendors">{cachedAppData?.vendors.map(v=><option key={v} value={v}/>)}</datalist></div>
                                <div><label className="block text-[10px] text-[var(--text-secondary)] font-bold uppercase mb-1">Bill No <span className="text-red-500">*</span></label><input type="text" value={billNo} onChange={e=>setBillNo(e.target.value)} className="w-full h-9 px-3 rounded-md text-sm font-bold text-[var(--text-primary)]" placeholder="Invoice #" required /></div>
                                <div><label className="block text-[10px] text-[var(--text-secondary)] font-bold uppercase mb-1">Bill Date <span className="text-red-500">*</span></label><input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full h-9 px-3 rounded-md text-sm text-[var(--text-primary)]" required /></div>
                                <div className="col-span-2"><label className="block text-[10px] text-[var(--text-secondary)] font-bold uppercase mb-1">GSTIN (Optional)</label><input type="text" value={gstNo} onChange={e=>setGstNo(e.target.value)} className="w-full h-9 px-3 rounded-md text-xs font-mono text-[var(--text-primary)]" placeholder="GST Number" /></div>
                            </div>
                        </Card>
                        <Card className="p-4 border-[var(--border-color)] bg-[var(--bg-card)]">
                            <div className="flex items-center gap-2 mb-3 text-yellow-500 font-bold text-xs uppercase border-b border-[var(--border-color)] pb-2"><FileText size={14} /> Stock Reference</div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] text-[var(--text-secondary)] font-bold uppercase mb-1">MRN No (Gate)</label><input type="text" value={mrnNo} onChange={e=>setMrnNo(e.target.value)} className="w-full h-9 px-3 rounded-md text-sm font-mono text-[var(--text-primary)]" placeholder="Auto / Manual" /></div>
                                <div><label className="block text-[10px] text-green-500 font-bold uppercase mb-1">Stock Date <span className="text-red-500">*</span></label><input type="date" value={mrnDate} onChange={e=>setMrnDate(e.target.value)} className="w-full h-9 px-3 rounded-md text-sm text-[var(--text-primary)] border-green-900/50" required /></div>
                                <div><label className="block text-[10px] text-[var(--text-secondary)] font-bold uppercase mb-1">GRN No</label><input type="text" value={grnNo} onChange={e=>setGrnNo(e.target.value)} className="w-full h-9 px-3 rounded-md text-sm text-[var(--text-primary)]" placeholder="Optional" /></div>
                                <div><label className="block text-[10px] text-[var(--text-secondary)] font-bold uppercase mb-1">GRN Date</label><input type="date" value={grnDate} onChange={e=>setGrnDate(e.target.value)} className="w-full h-9 px-3 rounded-md text-sm text-[var(--text-primary)]" /></div>
                            </div>
                        </Card>
                    </div>
                    <div className="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden flex flex-col relative shadow-xl">
                        <div className="overflow-auto custom-scrollbar flex-1">
                            <table className="w-full text-left text-sm text-[var(--text-secondary)]">
                                <thead className="bg-[var(--bg-card)] text-[10px] uppercase font-bold sticky top-0 z-10 shadow-sm">
                                    <tr><th className="p-3 w-10">#</th><th className="p-3 min-w-[200px]">Item Description</th><th className="p-3 w-20 text-center">Unit</th><th className="p-3 w-24 text-right">Qty</th><th className="p-3 w-28 text-right">Rate</th><th className="p-3 w-20 text-right">Disc%</th><th className="p-3 w-20 text-right">GST%</th><th className="p-3 w-32 text-right">Amount</th><th className="p-3 w-10"></th></tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-color)]">
                                    {purchaseItems.map((row, idx) => {
                                        const base = row.qty * row.rate;
                                        const disc = base * (row.discountPercent / 100);
                                        const total = ((base - disc) * (1 + row.gstRate/100)).toFixed(2);
                                        return (
                                            <tr key={row.tempId} className="hover:bg-[var(--bg-card-hover)] group">
                                                <td className="p-3 text-center text-xs">{idx + 1}</td>
                                                <td className="p-3">
                                                    <div 
                                                        className={`p-2 border rounded-lg cursor-pointer flex items-center justify-between transition-all ${!row.materialName ? 'bg-red-900/10 border-red-900/50 text-red-300' : 'bg-[var(--bg-main)] border-[var(--border-color)] text-[var(--text-primary)] font-medium'}`}
                                                        onClick={() => { setActiveRowId(row.tempId); setPickerMode('PURCHASE'); setIsPickerOpen(true); }}
                                                    >
                                                        <div className="flex items-center gap-2 truncate">
                                                            {row.materialName ? (row.isNew ? <Plus size={14} className="text-green-500" /> : <Check size={14} className="text-green-500" />) : <Search size={14} className="text-gray-500" />}
                                                            <span className="truncate">{row.materialName || 'Click to select Item...'}</span>
                                                        </div>
                                                        <ChevronRight size={14} className="opacity-40" />
                                                    </div>
                                                </td>
                                                <td className="p-3 align-top"><input type="text" value={row.unit} onChange={e=>updatePurchaseRow(row.tempId, 'unit', e.target.value)} className="w-full bg-transparent text-center text-xs text-[var(--text-primary)]" placeholder="Unit"/></td>
                                                <td className="p-3 align-top"><input type="number" step="any" value={row.qty || ''} onChange={e=>updatePurchaseRow(row.tempId, 'qty', parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-right font-bold focus:border-[var(--accent)]" /></td>
                                                <td className="p-3 align-top"><input type="number" step="any" value={row.rate || ''} onChange={e=>updatePurchaseRow(row.tempId, 'rate', parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-right font-mono" /></td>
                                                <td className="p-3 align-top"><input type="number" step="any" value={row.discountPercent || ''} onChange={e=>updatePurchaseRow(row.tempId, 'discountPercent', parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-right text-xs" /></td>
                                                <td className="p-3 align-top"><input type="number" step="any" value={row.gstRate || ''} onChange={e=>updatePurchaseRow(row.tempId, 'gstRate', parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-center text-xs" /></td>
                                                <td className="p-3 text-right font-mono font-bold text-green-400">{total}</td>
                                                <td className="p-3 text-center"><button type="button" onClick={()=>setPurchaseItems(prev=>prev.filter(r=>r.tempId!==row.tempId))} className="text-gray-600 hover:text-red-500"><Trash2 size={16}/></button></td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                            <button type="button" onClick={()=>setPurchaseItems([...purchaseItems, {tempId: Date.now().toString(), materialId: '', materialName: '', isNew: false, group: '', department: '', location: '', unit: '', hsn: '', description: '', qty: 0, rate: 0, discountPercent: 0, gstRate: appSettings.defaultGstRate || 18}])} className="p-3 text-xs flex items-center gap-2 text-[var(--accent)] hover:text-white transition-colors font-bold"><Plus size={14}/> Add Row</button>
                        </div>
                    </div>
                    <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2 z-20">
                        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl p-4 w-72 backdrop-blur-md">
                            <div className="flex justify-between items-center mb-2 text-xs"><span className="text-[var(--text-secondary)] font-bold">Total Freight</span><input type="number" value={billFreight || ''} onChange={e=>setBillFreight(parseFloat(e.target.value) || 0)} className="w-24 bg-[var(--bg-main)] border border-yellow-700/50 rounded p-1 text-yellow-400 font-bold text-right" placeholder="0.00" /></div>
                            <div className="h-px bg-[var(--border-color)] my-2"></div>
                            <div className="flex justify-between items-end"><div><div className="text-[10px] text-[var(--text-secondary)] uppercase font-bold">Grand Total</div><div className="text-xs text-[var(--text-secondary)]">{purchaseItems.length} Items</div></div><div className="text-2xl font-bold text-green-400 font-mono">{appSettings.currencySymbol} {purchaseGrandTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</div></div>
                            <Button type="submit" variant="success" className="w-full mt-3 h-10 font-bold" disabled={isSubmitting}>{isSubmitting ? <Loader2 size={18} className="animate-spin mx-auto" /> : (editMode ? 'Update Bill' : 'Save Bill')}</Button>
                        </div>
                    </div>
                </form>
             </div>
        );
    }

    return (
        <div className="space-y-6 pb-20 h-full flex flex-col animate-fadeIn">
            <div className="flex justify-between items-center shrink-0">
                <div><h2 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2"><ShoppingCart size={24} className="text-red-500"/> Issue Material</h2><p className="text-xs text-[var(--text-secondary)]">Multi-Item Issue Cart with Auto-FIFO</p></div>
                <Button variant="secondary" onClick={onCancel || onComplete} className="text-sm">Cancel</Button>
            </div>
            
            <form onSubmit={submitIssue} className="flex-1 flex flex-col gap-4 overflow-hidden">
                <Card className="p-4 bg-[var(--bg-card)] border-[var(--border-color)] shrink-0">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className="text-xs text-[var(--text-secondary)] uppercase font-bold mb-1 block">Issue Date <span className="text-red-500">*</span></label><div className="relative"><Calendar className="absolute left-2.5 top-2.5 text-gray-400" size={14}/><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded p-2 pl-9 text-[var(--text-primary)] focus:border-red-500" required /></div></div>
                        <div><label className="text-xs text-[var(--text-secondary)] uppercase font-bold mb-1 block">Target Department <span className="text-red-500">*</span></label><select value={issueDept} onChange={e => setIssueDept(e.target.value)} className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded p-2 text-[var(--text-primary)] focus:border-red-500" required><option value="">-- Select Department --</option>{uniqueDepartments.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                        <div>
                            <label className="text-xs text-[var(--text-secondary)] uppercase font-bold mb-1 block">Receiver / Machine</label>
                            <input 
                                type="text" 
                                list="receivers-list"
                                value={issueReceiver} 
                                onChange={e => setIssueReceiver(e.target.value)} 
                                placeholder="e.g. John Doe / CNC-01" 
                                className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded p-2 text-[var(--text-primary)]" 
                            />
                            <datalist id="receivers-list">
                                {historicalReceivers.map(name => (
                                    <option key={name} value={name} />
                                ))}
                            </datalist>
                        </div>
                    </div>
                </Card>

                <div className="flex-1 overflow-x-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-xl relative flex flex-col">
                    <div className="overflow-auto custom-scrollbar flex-1">
                        <table className="w-full text-left text-sm text-[var(--text-secondary)]">
                            <thead className="bg-[var(--bg-main)] text-xs uppercase font-bold text-gray-500 sticky top-0 z-10"><tr><th className="p-3 min-w-[200px]">Material Name (Search to Open Picker)</th><th className="p-3 w-28 text-right">Available Stock</th><th className="p-3 w-28 text-right">Issue Qty</th><th className="p-3 w-32 text-right">Value</th><th className="p-3 w-48">Remarks</th><th className="p-3 w-10"></th></tr></thead>
                            <tbody className="divide-y divide-[var(--border-color)]">
                                {issueItems.map((row, idx) => (
                                    <tr key={row.tempId} className="hover:bg-[var(--bg-card-hover)] group">
                                        <td className="p-3">
                                            <div 
                                                className={`p-2 border rounded-lg cursor-pointer flex items-center justify-between transition-all ${!row.materialId ? 'bg-red-900/10 border-red-900/50 text-red-300' : 'bg-[var(--bg-main)] border-[var(--border-color)] text-[var(--text-primary)] font-medium'}`}
                                                onClick={() => { setActiveRowId(row.tempId); setPickerMode('ISSUE'); setIsPickerOpen(true); }}
                                            >
                                                <div className="flex items-center gap-2 truncate">
                                                    {row.materialId ? <Check size={14} className="text-green-500" /> : <Search size={14} className="text-gray-500" />}
                                                    <span className="truncate">{row.materialName || 'Click to select Item...'}</span>
                                                </div>
                                                <ChevronRight size={14} className="opacity-40" />
                                            </div>
                                        </td>
                                        <td className="p-3 text-right">
                                            <div className={`font-mono font-bold text-lg ${row.materialId ? 'text-green-400' : 'text-gray-700'}`}>{row.materialId ? row.currentStock : '--'}</div>
                                            {row.materialId && <div className="text-[10px] text-gray-600 uppercase">{row.unit}</div>}
                                        </td>
                                        <td className="p-3 text-right">
                                            <input 
                                                type="number" 
                                                placeholder="0" 
                                                value={row.qty || ''} 
                                                onFocus={(e) => e.target.select()}
                                                onChange={e => updateIssueQty(row.tempId, parseFloat(e.target.value) || 0)} 
                                                className={`w-24 bg-[var(--bg-main)] border rounded-lg p-2 text-right font-bold text-[var(--text-primary)] text-lg focus:ring-2 focus:ring-[var(--accent)] ${row.qty > row.currentStock && !appSettings.enableNegativeStock ? 'border-red-500' : 'border-gray-600'}`} 
                                            />
                                        </td>
                                        <td className="p-3 text-right font-mono font-bold text-[var(--text-primary)]">
                                            <div>{appSettings.currencySymbol} {row.valuation.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                                            {row.qty > 0 && <div className="text-[10px] text-gray-500 font-normal">@ {(row.valuation/row.qty).toFixed(2)}</div>}
                                        </td>
                                        <td className="p-3"><input type="text" placeholder="Add remark..." value={row.remarks} onChange={e => updateIssueRemark(row.tempId, e.target.value)} className="w-full bg-transparent border-b border-gray-700 focus:border-gray-400 outline-none text-xs text-[var(--text-primary)] py-1" /></td>
                                        <td className="p-3 text-center"><button type="button" onClick={() => handleRemoveIssueRow(row.tempId)} className="text-gray-600 hover:text-red-500"><Trash2 size={16}/></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-main)]/30 flex justify-between items-center backdrop-blur-sm sticky bottom-0">
                            <button type="button" onClick={handleAddIssueRow} className="text-xs flex items-center gap-2 text-blue-400 hover:text-white font-bold"><Plus size={14}/> Add Another Item</button>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end shrink-0">
                    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-3 px-5 flex items-center gap-6 shadow-xl">
                        <div className="text-right">
                            <div className="text-[10px] text-[var(--text-secondary)] uppercase font-bold">Total Issue Value</div>
                            <div className="text-xl font-bold text-red-400 font-mono">{appSettings.currencySymbol} {issueGrandTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                        </div>
                        <Button type="submit" variant="danger" className="px-6 py-2 font-bold flex items-center gap-2" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <><ShoppingCart size={18}/> Process Issue</>}
                        </Button>
                    </div>
                </div>
            </form>

            {isPickerOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 bg-black/90 backdrop-blur-md animate-fadeIn">
                    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                        <div className="p-5 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-main)]">
                            <div>
                                <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2"><Box size={20} className="text-[var(--accent)]"/> Select Material</h3>
                                <p className="text-xs text-[var(--text-secondary)] mt-1">
                                    {pickerMode === 'ISSUE' ? "Only showing items with available physical stock." : "Search all items or create new."}
                                </p>
                            </div>
                            <button onClick={() => setIsPickerOpen(false)} className="p-2 hover:bg-[var(--bg-card-hover)] rounded-full text-[var(--text-secondary)] transition-colors"><X size={24}/></button>
                        </div>
                        <div className="p-4 bg-[var(--bg-main)] border-b border-[var(--border-color)]">
                            <div className="relative group">
                                <Search size={20} className="absolute left-4 top-3.5 text-[var(--text-secondary)] group-focus-within:text-[var(--accent)] transition-colors"/>
                                <input 
                                    autoFocus
                                    placeholder="Search by Name, Group, Department or Location..."
                                    className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl py-3.5 pl-12 pr-4 text-[var(--text-primary)] text-lg focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] shadow-inner transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-[var(--bg-main)]">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-10">
                                {pickerMode === 'PURCHASE' && searchTerm.length > 1 && (
                                    <div 
                                        onClick={handleCreateNewFromPicker}
                                        className="col-span-full bg-green-900/10 border border-green-800/50 p-4 rounded-xl cursor-pointer hover:bg-green-900/20 hover:border-green-500 transition-all flex items-center gap-3 group"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-green-900/50 flex items-center justify-center text-green-400 group-hover:scale-110 transition-transform"><Plus size={20}/></div>
                                        <div>
                                            <h4 className="font-bold text-green-400">Create New Item: "{searchTerm}"</h4>
                                            <p className="text-xs text-green-500/70">Item will be added to Master Data automatically.</p>
                                        </div>
                                    </div>
                                )}
                                {filteredMaterialsForPicker.map(m => (
                                    <div 
                                        key={m.id} 
                                        onClick={() => pickerMode === 'ISSUE' ? handleIssueMatSelect(m) : handlePurchaseMatSelect(m)}
                                        className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 rounded-xl cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--bg-card-hover)] transition-all flex justify-between items-center group"
                                    >
                                        <div className="overflow-hidden mr-4">
                                            <h4 className="font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] truncate">{m.name}</h4>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                <span className="text-[9px] bg-[var(--bg-main)] px-1.5 py-0.5 rounded border border-[var(--border-color)] text-[var(--text-secondary)] uppercase tracking-wider">{m.group}</span>
                                                <span className="text-[9px] bg-[var(--bg-main)] px-1.5 py-0.5 rounded border border-[var(--border-color)] text-[var(--text-secondary)] uppercase tracking-wider">{m.department}</span>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-2xl font-mono font-bold text-green-500">{m.currentStock}</div>
                                            <div className="text-[10px] text-[var(--text-secondary)] font-bold uppercase">{m.unit}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="p-3 bg-[var(--bg-main)] border-t border-[var(--border-color)] text-[10px] text-[var(--text-secondary)] flex justify-between items-center">
                            <span>Showing {filteredMaterialsForPicker.length} items</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TransactionForm;
