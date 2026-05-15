
import React, { useState, useRef } from 'react';
import { Material, Transaction } from '../types';
import { getAppData, ensureMasterData, resetAppData, chunkedUpsert, updateMeta, recalculateAllStock } from '../services/storageService';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Upload, AlertTriangle, Download, Settings, Trash2, Loader2 } from 'lucide-react';

interface Props {
    onComplete: () => void;
}

type FieldKey = 'mrnNo' | 'mrnDate' | 'grnNo' | 'grnDate' | 'billNo' | 'billDate' | 'vendor' | 'gstNo' | 'name' | 'unit' | 'qty' | 'rate' | 'department' | 'location' | 'group' | 'avgRate' | 'gstRate' | 'totalValue' | 'discount' | 'freight';

interface MappingConfig {
    key: FieldKey;
    label: string;
    required: boolean;
    index: number;
    keywords: string[]; 
}

const INITIAL_MAPPING: MappingConfig[] = [
    { key: 'mrnNo', label: 'MRN No', required: false, index: -1, keywords: ['mrn'] },
    { key: 'mrnDate', label: 'MRN Date', required: false, index: -1, keywords: ['mrn date', 'mrn_date'] },
    { key: 'grnNo', label: 'GRN No', required: false, index: -1, keywords: ['grn'] },
    { key: 'grnDate', label: 'GRN Date', required: false, index: -1, keywords: ['grn date'] },
    { key: 'billNo', label: 'Bill No', required: true, index: -1, keywords: ['bill no', 'invoice', 'bill_no'] },
    { key: 'billDate', label: 'Bill Date', required: true, index: -1, keywords: ['bill date', 'invoice date', 'bill_date'] },
    { key: 'gstNo', label: 'GSTIN', required: false, index: -1, keywords: ['gst', 'gstin'] },
    { key: 'vendor', label: 'Vendor Name', required: true, index: -1, keywords: ['vander', 'vendor', 'party', 'supplier'] },
    { key: 'name', label: 'Item Name', required: true, index: -1, keywords: ['item name', 'material', 'product', 'description'] },
    { key: 'unit', label: 'UOM', required: false, index: -1, keywords: ['uom', 'unit'] },
    { key: 'qty', label: 'Quantity', required: true, index: -1, keywords: ['quant', 'qty'] },
    { key: 'rate', label: 'Rate (Basic)', required: true, index: -1, keywords: ['rate (basic', 'basic rate', 'unit price'] },
    { key: 'avgRate', label: 'Avg Rate (Landed)', required: false, index: -1, keywords: ['avg rate', 'landed'] },
    { key: 'totalValue', label: 'Total Amount', required: false, index: -1, keywords: ['amt', 'amount', 'total', 'value'] },
    { key: 'department', label: 'Department', required: false, index: -1, keywords: ['department', 'dept'] },
    { key: 'location', label: 'Bin / Location', required: false, index: -1, keywords: ['bin', 'location', 'rack'] },
    { key: 'group', label: 'Material Group', required: false, index: -1, keywords: ['c. head', 'group', 'category', 'head'] },
    { key: 'gstRate', label: 'GST %', required: false, index: -1, keywords: ['gst %', 'tax'] },
    { key: 'discount', label: 'Discount', required: false, index: -1, keywords: ['disc'] },
    { key: 'freight', label: 'Freight', required: false, index: -1, keywords: ['freight'] },
];

const TEMPLATE_HEADERS = [
    "MRN", "MRN DATE", "GRN NO", "GRN DATE", "BILL NO", "BILL DATE", 
    "GSTIN", "VENDOR NAME", "ITEM NAME", "UOM", "QUANTITY", 
    "RATE (BASIC)", "AVG RATE (LANDED)", "TOTAL AMOUNT", 
    "DEPARTMENT", "BIN", "C. HEAD", "GST %"
];

const BulkImport: React.FC<Props> = ({ onComplete }) => {
    const [step, setStep] = useState<'UPLOAD' | 'MAPPING' | 'PREVIEW'>('UPLOAD');
    const [rawRows, setRawRows] = useState<string[][]>([]);
    const [mappings, setMappings] = useState<MappingConfig[]>(INITIAL_MAPPING);
    const [parsedRows, setParsedRows] = useState<any[]>([]);
    const [log, setLog] = useState<string[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [defaultGst, setDefaultGst] = useState(18);
    const [clearPreviousData, setClearPreviousData] = useState(false);

    const cleanNumber = (str: string) => {
        if (!str) return 0;
        const cleaned = str.replace(/[₹, %]/g, '');
        return parseFloat(cleaned) || 0;
    };

    const parseDate = (dateStr: string) => {
        if (!dateStr) return null;
        let cleanStr = dateStr.trim();
        if (/^\d{5}$/.test(cleanStr)) {
            const date = new Date((parseInt(cleanStr) - 25569) * 86400 * 1000);
            return date.toISOString().split('T')[0];
        }
        const monthNames: Record<string, number> = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
        const textMonthRegex = /^(\d{1,2})[\-\s\/]([a-zA-Z]{3})[\-\s\/](\d{2,4})$/;
        const textMatch = cleanStr.match(textMonthRegex);
        if (textMatch) {
            const day = parseInt(textMatch[1]);
            const monthStr = textMatch[2].toLowerCase();
            let year = parseInt(textMatch[3]);
            if (year < 100) year += 2000;
            const monthIndex = monthNames[monthStr];
            if (monthIndex !== undefined) {
                const d = new Date(Date.UTC(year, monthIndex, day));
                return d.toISOString().split('T')[0];
            }
        }
        const ddmmyyyy = cleanStr.match(/^(\d{1,2})[\.\-\/](\d{1,2})[\.\-\/](\d{2,4})$/);
        if (ddmmyyyy) {
            const day = parseInt(ddmmyyyy[1]);
            const month = parseInt(ddmmyyyy[2]);
            let year = parseInt(ddmmyyyy[3]);
            if (year < 100) year += 2000;
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
        const d = new Date(cleanStr);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
        return new Date().toISOString().split('T')[0];
    };

    const parseCSV = (text: string) => {
        const rows: string[][] = [];
        let currentRow: string[] = [];
        let currentCell = '';
        let insideQuote = false;
        for (let i = 0; i < text.length; i++) {
            const char = text[i]; const nextChar = text[i + 1];
            if (char === '"') {
                if (insideQuote && nextChar === '"') { currentCell += '"'; i++; }
                else insideQuote = !insideQuote;
            } else if (char === ',' && !insideQuote) {
                currentRow.push(currentCell); currentCell = '';
            } else if ((char === '\r' || char === '\n') && !insideQuote) {
                if (currentCell || currentRow.length > 0) currentRow.push(currentCell);
                if (currentRow.length > 0) rows.push(currentRow);
                currentRow = []; currentCell = '';
                if (char === '\r' && nextChar === '\n') i++;
            } else currentCell += char;
        }
        if (currentCell || currentRow.length > 0) { currentRow.push(currentCell); rows.push(currentRow); }
        return rows;
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = evt.target?.result as string;
            const rows = parseCSV(text);
            const validRows = rows.filter(r => r.some(c => c.trim() !== ''));
            setRawRows(validRows);
            if (validRows.length > 0) {
                const headers = validRows[0].map(h => h.toLowerCase().trim());
                const newMapping = [...mappings];
                newMapping.forEach(m => {
                    const matchIndex = headers.findIndex(h => m.keywords.some(k => h.includes(k)));
                    if (m.key === 'rate' && matchIndex !== -1) {
                         if (headers[matchIndex].includes('avg') || headers[matchIndex].includes('landed')) { } else m.index = matchIndex;
                    } else if (matchIndex !== -1) m.index = matchIndex;
                });
                setMappings(newMapping);
            }
            setStep('MAPPING');
        };
        reader.readAsText(file);
    };

    const handleFinalImport = async () => {
        setIsImporting(true);
        setError(null);
        setProgress(0);
        try {
            if (clearPreviousData) await resetAppData();

            const currentData = await getAppData();
            const newTransactions: Transaction[] = [];
            
            // Map to track all materials that need to be saved (New + Updated)
            // Key: Material ID, Value: Material Object
            const materialsToUpsert = new Map<string, Material>();

            // Lookup map for Name matching: "Name|Group|Dept" -> Material ID
            const nameToIdMap = new Map<string, string>();

            // 1. Index Existing Materials
            currentData.materials.forEach(m => {
                const key = `${m.name.trim().toLowerCase()}|${(m.group || '').trim().toLowerCase()}|${(m.department || '').trim().toLowerCase()}`;
                nameToIdMap.set(key, m.id);
            });

            const uniqueVendors = new Set<string>(currentData.vendors);
            const uniqueDepts = new Set<string>(currentData.departments);
            const uniqueGroups = new Set<string>(currentData.groups);

            parsedRows.forEach((row: any) => {
                if (row.vendor) uniqueVendors.add(row.vendor);
                if (row.department) uniqueDepts.add(row.department);
                if (row.group) uniqueGroups.add(row.group);

                const key = `${row.name.trim().toLowerCase()}|${(row.group || '').trim().toLowerCase()}|${(row.department || '').trim().toLowerCase()}`;
                
                let matId = nameToIdMap.get(key);
                let mat: Material;

                if (matId) {
                    // Item Exists (either in DB or created in previous loop iteration)
                    if (materialsToUpsert.has(matId)) {
                        // Already in our dirty list
                        mat = materialsToUpsert.get(matId)!;
                    } else {
                        // In DB but not yet touched in this batch -> Clone it
                        const existing = currentData.materials.find(m => m.id === matId);
                        if (existing) {
                            mat = { ...existing };
                            materialsToUpsert.set(matId, mat);
                        } else {
                            // Fallback (should not happen)
                            mat = {
                                id: matId,
                                name: row.name,
                                group: row.group,
                                department: row.department,
                                unit: row.unit,
                                location: row.location,
                                currentStock: 0,
                                pricePerUnit: 0,
                                gstRate: row.gstRate
                            };
                            materialsToUpsert.set(matId, mat);
                        }
                    }
                } else {
                    // New Item
                    mat = {
                        id: Date.now().toString() + Math.random().toString().slice(2, 8),
                        name: row.name,
                        group: row.group,
                        department: row.department,
                        unit: row.unit,
                        location: row.location,
                        currentStock: 0,
                        pricePerUnit: 0,
                        hsn: '',
                        gstRate: row.gstRate,
                    };
                    matId = mat.id;
                    nameToIdMap.set(key, matId);
                    materialsToUpsert.set(matId, mat);
                }

                // --- Calculate Values ---
                let finalTotalValue = row.totalValue;
                let finalGstAmount = 0;
                let taxableValue = 0;

                if (row.source === 'CSV') {
                    if (finalTotalValue !== 0) {
                         const factor = 1 + (row.gstRate / 100);
                         taxableValue = finalTotalValue / factor;
                         finalGstAmount = finalTotalValue - taxableValue;
                    }
                } else if (row.source === 'AVG*QTY') {
                     taxableValue = row.avgRate * row.qty;
                     finalGstAmount = taxableValue * (row.gstRate / 100);
                     finalTotalValue = taxableValue + finalGstAmount;
                } else {
                    const basic = row.qty * row.rate;
                    taxableValue = basic - row.discount + row.freight;
                    finalGstAmount = taxableValue * (row.gstRate / 100);
                    finalTotalValue = taxableValue + finalGstAmount;
                }

                // Rate for Stock Valuation (Landed Cost per unit)
                let stockValuationRate = row.qty > 0 ? (taxableValue / row.qty) : (row.avgRate || row.rate);

                // --- Update Material Stock & Price ---
                // We perform a weighted average update logic here to ensure the final Master Data is correct
                // NOTE: We also run recalculateAllStock() at the end to be double sure.
                const oldStock = mat.currentStock || 0;
                const oldVal = oldStock * (mat.pricePerUnit || 0);
                const newVal = row.qty * stockValuationRate;
                
                mat.currentStock = oldStock + row.qty;
                
                if (mat.currentStock > 0) {
                    mat.pricePerUnit = (oldVal + newVal) / mat.currentStock;
                } else {
                    mat.pricePerUnit = stockValuationRate;
                }
                
                // Update Location if provided in CSV (Last in wins)
                if (row.location) mat.location = row.location;

                // --- Create Transaction ---
                const effectiveDate = row.mrnDate || row.grnDate || row.billDate || new Date().toISOString().split('T')[0];
                newTransactions.push({
                    id: Date.now().toString() + Math.random().toString().slice(2, 8),
                    type: 'PURCHASE', date: effectiveDate, materialId: matId!, materialName: row.name,
                    quantity: row.qty, rate: row.rate, avgRate: stockValuationRate, totalValue: finalTotalValue,
                    billNo: row.billNo, billDate: row.billDate || effectiveDate, grnNo: row.grnNo || row.mrnNo,
                    grnDate: row.grnDate || row.mrnDate, mrnNo: row.mrnNo, mrnDate: row.mrnDate,
                    vendor: row.vendor, gstNo: row.gstNo, gstRate: row.gstRate, gstAmount: finalGstAmount,
                    discount: row.discount, freight: row.freight, department: row.department,
                    group: row.group, location: row.location, remarks: 'CSV Bulk Import'
                });
            });

            // Update Master Data
            ensureMasterData(currentData, Array.from(uniqueVendors), Array.from(uniqueDepts), Array.from(uniqueGroups));
            await updateMeta(currentData);

            // 1. Upload Materials (New & Updated)
            if (materialsToUpsert.size > 0) {
                setLog([`Updating ${materialsToUpsert.size} materials (Stock & Price)...`]);
                await chunkedUpsert('materials', Array.from(materialsToUpsert.values()));
            }

            // 2. Upload Transactions with Progress
            setLog(prev => [...prev, `Uploading ${newTransactions.length} transactions...`]);
            await chunkedUpsert('transactions', newTransactions, (count) => {
                setProgress(count);
            });
            
            // 3. FORCE RECALCULATION
            // This is critical when data is reset and re-imported to ensure 
            // the Material Master 'currentStock' matches the sum of all transactions.
            setLog(prev => [...prev, `Verifying & Syncing final stock levels...`]);
            await recalculateAllStock();
            
            setLog(prev => [...prev, `Success! Imported all items.`]);
            setTimeout(onComplete, 1500);
        } catch (err: any) {
            console.error(err);
            setError(`Import failed: ${err.message || 'Unknown error'}`);
        } finally {
            setIsImporting(false);
        }
    };

    if (step === 'UPLOAD') {
        return (
            <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-6">
                <div className="space-y-6 max-w-2xl mx-auto pt-10">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Import CSV Data</h2>
                        <Button variant="secondary" onClick={onComplete}>Cancel</Button>
                    </div>
                    <Card className="border-dashed border-2 border-[var(--border-color)] bg-[var(--bg-card)]/50 hover:bg-[var(--bg-card)] transition-colors p-10 flex flex-col items-center justify-center gap-4">
                        <div className="p-4 bg-[var(--accent)]/20 rounded-full text-[var(--accent)]"><Upload size={48} /></div>
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-[var(--text-primary)]">Upload your CSV File</h3>
                            <p className="text-[var(--text-secondary)] text-sm mt-1">Save Excel as <strong>CSV (Comma delimited)</strong>.</p>
                        </div>
                        <div className="flex gap-4">
                            <Button variant="secondary" onClick={() => {
                                const csvContent = "data:text/csv;charset=utf-8," + TEMPLATE_HEADERS.join(",") + "\n";
                                const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", "Inventory_Template.csv");
                                document.body.appendChild(link); link.click(); document.body.removeChild(link);
                            }} className="flex items-center gap-2"><Download size={16} /> Download Template</Button>
                            <Button onClick={() => fileInputRef.current?.click()} className="px-8">Select File</Button>
                        </div>
                        <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                    </Card>
                </div>
            </div>
        );
    }
    
    if (step === 'MAPPING') {
        const headerRow = rawRows[0] || []; const sampleRow = rawRows[1] || [];
        return (
            <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-6">
                <div className="space-y-6 max-w-6xl mx-auto">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Map CSV Columns</h2>
                        <Button variant="secondary" onClick={() => setStep('UPLOAD')}>Back</Button>
                    </div>
                    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-blue-400 font-bold uppercase block mb-2 flex items-center gap-1"><Settings size={14}/> Default GST %</label>
                            <input type="number" value={defaultGst} onChange={(e) => setDefaultGst(parseFloat(e.target.value))} className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded p-2 text-[var(--text-primary)]" />
                        </div>
                        <div>
                             <label className="text-xs text-red-400 font-bold uppercase block mb-2 flex items-center gap-1"><Trash2 size={14}/> Data Cleanup</label>
                            <label className="flex items-center gap-2 p-2 bg-red-900/10 border border-red-900/30 rounded cursor-pointer">
                                <input type="checkbox" checked={clearPreviousData} onChange={(e) => setClearPreviousData(e.target.checked)} className="w-4 h-4 rounded bg-[var(--bg-main)] border-red-500 text-red-600"/>
                                <span className="text-sm text-red-400">Clear all data before import?</span>
                            </label>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {mappings.map(field => (
                            <div key={field.key} className={`p-3 rounded border ${field.required && field.index === -1 ? 'bg-red-900/10 border-red-500/50' : 'bg-[var(--bg-card)] border-[var(--border-color)]'}`}>
                                <label className="block text-xs uppercase text-gray-400 font-bold mb-1">{field.label} {field.required && <span className="text-red-500">*</span>}</label>
                                <select value={field.index} onChange={(e) => { const idx = parseInt(e.target.value); setMappings(prev => prev.map(m => m.key === field.key ? { ...m, index: idx } : m)); }} className="w-full text-sm rounded p-2 bg-[var(--bg-main)] border border-[var(--border-color)] text-[var(--text-primary)]">
                                    <option value="-1">-- Unmapped --</option>
                                    {headerRow.map((h, i) => (<option key={i} value={i}>{h.substring(0, 25)} ({sampleRow[i] ? sampleRow[i].substring(0, 15) + '...' : ''})</option>))}
                                </select>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-end pt-4"><Button onClick={() => {
                        const missing = mappings.filter(m => m.required && m.index === -1);
                        if (missing.length > 0) { alert(`Missing: ${missing.map(m => m.label).join(', ')}`); return; }
                        const res = rawRows.slice(1).map(row => {
                            const gv = (k: FieldKey) => { const m = mappings.find(x => x.key === k); return (m && m.index !== -1 && row[m.index]) ? row[m.index].trim() : ''; };
                            const q = cleanNumber(gv('qty')); if (!gv('name') || (q <= 0 && gv('qty') === '')) return null;
                            let r = cleanNumber(gv('rate')); const ar = cleanNumber(gv('avgRate')); const d = cleanNumber(gv('discount')); const f = cleanNumber(gv('freight'));
                            const gr = mappings.find(x => x.key === 'gstRate')?.index !== -1 ? cleanNumber(gv('gstRate')) : defaultGst;
                            const rateColMapped = (mappings.find(x => x.key === 'rate')?.index ?? -1) !== -1;
                            let tv = 0; let src = 'AUTO';
                            if (mappings.find(x => x.key === 'totalValue')?.index !== -1) {
                                tv = cleanNumber(gv('totalValue')); src = 'CSV';
                                // Only back-calculate rate if user did NOT provide it explicitly
                                if (q > 0 && (!rateColMapped || r === 0)) r = (tv / (1 + gr/100) + d - f) / q;
                            }
                            else if (mappings.find(x => x.key === 'avgRate')?.index !== -1 && ar > 0) { const tx = ar * q; tv = tx + tx * (gr/100); src = 'AVG*QTY'; }
                            else { const tx = q * r - d + f; tv = tx + tx * (gr/100); }
                            return { mrnNo: gv('mrnNo'), mrnDate: parseDate(gv('mrnDate')), grnNo: gv('grnNo'), billNo: gv('billNo') || 'OPENING', billDate: parseDate(gv('billDate')), vendor: gv('vendor') || 'Unknown', name: gv('name'), unit: gv('unit') || 'Nos', qty: q, rate: r, avgRate: ar, discount: d, freight: f, gstRate: gr, totalValue: tv, source: src, department: gv('department') || 'Store', location: gv('location'), group: gv('group') || 'General' };
                        }).filter(Boolean);
                        setParsedRows(res); setStep('PREVIEW');
                    }} variant="success">Preview Data</Button></div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-6">
            <div className="space-y-6 max-w-6xl mx-auto">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-[var(--text-primary)]">Preview & Confirm</h2>
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => setStep('MAPPING')} disabled={isImporting}>Back</Button>
                        <Button variant="success" onClick={handleFinalImport} disabled={isImporting} className="min-w-[140px]">
                            {isImporting ? <><Loader2 className="animate-spin mr-2" size={16}/> {progress > 0 ? `Importing ${progress}/${parsedRows.length}` : 'Processing...'}</> : `${clearPreviousData ? 'Clear & Import' : 'Import'} ${parsedRows.length} Items`}
                        </Button>
                    </div>
                </div>

                {error && <div className="bg-red-900/20 border border-red-500 text-red-400 p-4 rounded-lg flex items-center gap-3"><AlertTriangle size={20}/> {error}</div>}
                
                <div className="overflow-x-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
                    <table className="w-full text-left text-xs text-[var(--text-secondary)]">
                        <thead className="bg-[var(--bg-main)] text-[var(--text-primary)] uppercase font-bold"><tr><th className="p-2">Item Name</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Rate</th><th className="p-2 text-right text-green-400">Total</th><th className="p-2 text-center">Group</th><th className="p-2 text-center">Department</th></tr></thead>
                        <tbody className="divide-y divide-[var(--border-color)]">
                            {parsedRows.slice(0, 50).map((r, i) => (
                                <tr key={i} className="hover:bg-[var(--bg-card-hover)]"><td className="p-2 font-medium text-[var(--text-primary)]">{r.name}</td><td className="p-2 text-right font-mono">{r.qty}</td><td className="p-2 text-right font-mono">{r.rate.toFixed(4)}</td><td className="p-2 text-right font-mono text-green-400 font-bold">{r.totalValue.toFixed(2)}</td><td className="p-2 text-center">{r.group}</td><td className="p-2 text-center">{r.department}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {log.length > 0 && <div className="p-4 bg-green-900/20 text-green-400 border border-green-800 rounded-lg">{log.map((l,i) => <div key={i}>{l}</div>)}</div>}
            </div>
        </div>
    );
};

export default BulkImport;
