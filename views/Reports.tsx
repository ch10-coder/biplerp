import React, { useState, useMemo, useEffect } from 'react';
import { AppData, SavedReport, ReportFilter, Material, Transaction } from '../types';
import { saveReportConfiguration, deleteReportConfiguration, calculateBatches, deleteTransaction, repairMaterialTransactionValues } from '../services/storageService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { MultiSelect } from '../components/ui/MultiSelect';
import { FilterHeader } from '../components/ui/FilterHeader';
import { SlidersHorizontal, ShoppingCart, Download, X, Check, Search, Plus, Save, FileText, ChevronRight, Trash2, RotateCcw, TrendingUp, Archive, DollarSign, Info, Table, ShieldCheck, ShieldAlert, Activity, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';

interface Props {
    data: AppData;
    onUpdate: () => void;
}

type ReportType = 'OPENING' | 'PURCHASE' | 'ISSUE' | 'ADJUSTMENT' | 'CLOSING' | 'CUSTOM' | 'FULL_LEDGER';
type SortOrder = 'DATE_NEW' | 'DATE_OLD' | 'MRN' | 'VENDOR' | 'NAME' | 'VALUE_HIGH';

const FILTER_FIELDS = [
    { value: 'name', label: 'Item Name' },
    { value: 'vendor', label: 'Vendor' },
    { value: 'billNo', label: 'Bill No' },
    { value: 'mrnNo', label: 'MRN No' },
    { value: 'group', label: 'Group' },
    { value: 'department', label: 'Department' },
    { value: 'location', label: 'Location' },
    { value: 'remarks', label: 'Remarks' },
    { value: 'qty', label: 'Quantity' },
    { value: 'value', label: 'Value' }
];

// Enhanced Column Definitions with width and numeric metadata
const COLUMNS_DEF: Record<string, {id: string, label: string, isRight?: boolean, isNumeric?: boolean, width?: number}[]> = {
    'SNAPSHOT': [
        { id: 'name', label: 'Material Name', width: 220 },
        { id: 'description', label: 'Description', width: 150 },
        { id: 'group', label: 'Group', width: 100 },
        { id: 'department', label: 'Department', width: 100 },
        { id: 'location', label: 'Location', width: 80 },
        { id: 'unit', label: 'Unit', width: 60 },
        { id: 'qty', label: 'Quantity', isRight: true, isNumeric: true, width: 80 },
        { id: 'rate', label: 'Avg Rate', isRight: true, isNumeric: true, width: 100 },
        { id: 'value', label: 'Total Value', isRight: true, isNumeric: true, width: 120 },
    ],
    'PURCHASE': [
        { id: 'date', label: 'Entry Date', width: 90 },
        { id: 'mrnNo', label: 'MRN No', width: 80 },
        { id: 'mrnDate', label: 'MRN Date', width: 90 },
        { id: 'billNo', label: 'Bill No', width: 100 },
        { id: 'billDate', label: 'Bill Date', width: 90 },
        { id: 'vendor', label: 'Vendor', width: 180 },
        { id: 'name', label: 'Item Name', width: 200 },
        { id: 'group', label: 'Group', width: 100 },
        { id: 'department', label: 'Department', width: 100 },
        { id: 'unit', label: 'Unit', width: 60 },
        { id: 'qty', label: 'Qty', isRight: true, isNumeric: true, width: 70 },
        { id: 'rate', label: 'Basic Rate', isRight: true, isNumeric: true, width: 90 },
        { id: 'value', label: 'Total Value', isRight: true, isNumeric: true, width: 110 },
        { id: 'action', label: 'Action', isRight: false, width: 60 },
    ],
    'ISSUE': [
        { id: 'date', label: 'Issue Date', width: 90 },
        { id: 'id', label: 'Slip ID', width: 80 },
        { id: 'name', label: 'Material', width: 200 },
        { id: 'group', label: 'Group', width: 100 },
        { id: 'department', label: 'Target Dept', width: 100 },
        { id: 'remarks', label: 'Remarks', width: 180 },
        { id: 'qty', label: 'Qty', isRight: true, isNumeric: true, width: 70 },
        { id: 'rate', label: 'Avg Rate', isRight: true, isNumeric: true, width: 90 },
        { id: 'value', label: 'Value', isRight: true, isNumeric: true, width: 110 },
        { id: 'action', label: 'Action', isRight: false, width: 60 },
    ],
    'FULL_LEDGER': [
        { id: 'source', label: 'TYPE', width: 70 },
        { id: 'mrnDate', label: 'Date', width: 80 },
        { id: 'mrn', label: 'MRN No', width: 70 },
        { id: 'vendor', label: 'Vendor/Party', width: 130 },
        { id: 'matName', label: 'Item Description', width: 180 },
        { id: 'uom', label: 'UOM', width: 50 },
        { id: 'qtyIn', label: 'In Qty', isRight: true, isNumeric: true, width: 60 },
        { id: 'rate', label: 'Rate', isRight: true, isNumeric: true, width: 70 },
        { id: 'amtIn', label: 'In Val', isRight: true, isNumeric: true, width: 80 },
        { id: 'issueQty', label: 'Out Qty', isRight: true, isNumeric: true, width: 60 },
        { id: 'issueAmt', label: 'Out Val', isRight: true, isNumeric: true, width: 80 },
        { id: 'closeQty', label: 'Bal Qty', isRight: true, isNumeric: true, width: 60 },
        { id: 'closeAmt', label: 'Bal Val', isRight: true, isNumeric: true, width: 80 },
        { id: 'group', label: 'Group', width: 100 },
        { id: 'dept', label: 'Dept', width: 100 },
    ],
    'ADJUSTMENT': [
        { id: 'date', label: 'Date', width: 90 },
        { id: 'name', label: 'Material', width: 220 },
        { id: 'group', label: 'Group', width: 100 },
        { id: 'qty', label: 'Qty', isRight: true, isNumeric: true, width: 80 },
        { id: 'value', label: 'Value', isRight: true, isNumeric: true, width: 110 },
        { id: 'remarks', label: 'Remarks', width: 200 }
    ],
    'CUSTOM': [
        { id: 'date', label: 'Date', width: 90 },
        { id: 'name', label: 'Material', width: 220 },
        { id: 'qty', label: 'Qty', isRight: true, isNumeric: true, width: 80 },
        { id: 'value', label: 'Value', isRight: true, isNumeric: true, width: 110 }
    ]
};

const Reports: React.FC<Props> = ({ data, onUpdate }) => {
    const { departments, groups, savedReports } = data;

    const [periodMode, setPeriodMode] = useState<'MONTH' | 'RANGE'>('MONTH');
    const [month, setMonth] = useState(new Date().getMonth());
    const [year, setYear] = useState(new Date().getFullYear());
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1); 
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    
    const [filterDepts, setFilterDepts] = useState<string[]>([]);
    const [filterGroups, setFilterGroups] = useState<string[]>([]);
    const [groupBy, setGroupBy] = useState<'DEPARTMENT' | 'GROUP'>('GROUP');
    
    const [detailView, setDetailView] = useState<ReportType | null>(null);
    const [isSummaryMode, setIsSummaryMode] = useState(true); 
    const [modalSearchTerm, setModalSearchTerm] = useState('');
    const [modalActiveFilters, setModalActiveFilters] = useState<Record<string, string[]>>({});
    const [openFilterCol, setOpenFilterCol] = useState<string | null>(null);
    
    const [sortOrder, setSortOrder] = useState<SortOrder>('DATE_NEW');
    const [isBillWiseMode, setIsBillWiseMode] = useState(false);
    const [modalFilterGroups, setModalFilterGroups] = useState<string[]>([]);
    const [modalFilterDepts, setModalFilterDepts] = useState<string[]>([]);
    const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
    const [isColSelectorOpen, setIsColSelectorOpen] = useState(false);
    const [customFilters, setCustomFilters] = useState<ReportFilter[]>([]);
    const [saveReportName, setSaveReportName] = useState('');
    const [isSaveMode, setIsSaveMode] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isFullWidth, setIsFullWidth] = useState(true); // Default to full width for sheets

    // NEW STATE FOR DRILLDOWN
    const [drilldownData, setDrilldownData] = useState<{ title: string, transactions: any[], type?: 'MISMATCH' } | null>(null);

    const cleanDepartments = useMemo(() => {
        const depts = new Set<string>();
        (data.departments || []).forEach(d => { if (d) depts.add(d.trim()); });
        (data.materials || []).forEach(m => { if (m.department) depts.add(m.department.trim()); });
        (data.transactions || []).forEach(t => { if (t.department) depts.add(t.department.trim()); });
        return Array.from(depts).sort();
    }, [data]);

    const cleanGroups = useMemo(() => {
        const grps = new Set<string>();
        (data.groups || []).forEach(g => { if (g) grps.add(g.trim()); });
        (data.materials || []).forEach(m => { if (m.group) grps.add(m.group.trim()); });
        (data.transactions || []).forEach(t => { if (t.group) grps.add(t.group.trim()); });
        return Array.from(grps).sort();
    }, [data]);

    useEffect(() => {
        setModalFilterDepts([]);
        setModalFilterGroups([]);
    }, [groupBy]);

    const toggleColumn = (colId: string) => {
        setVisibleColumns(prev => 
            prev.includes(colId) ? prev.filter(c => c !== colId) : [...prev, colId]
        );
    };

    // --- SHARED HELPERS ---
    const resolveBatchGroup = (item: { group?: string, department?: string }, mat: Material) => {
        if (item.group) return item.group;
        if (mat.group) return mat.group;
        return 'Unassigned';
    };

    const matchFilter = (group: string, dept: string, fGroups: string[], fDepts: string[]) => {
        const matGroup = (group || '').trim().toLowerCase();
        const matDept = (dept || '').trim().toLowerCase();

        if (fGroups.length > 0) {
            if (!fGroups.some(g => g.trim().toLowerCase() === matGroup)) return false;
        }
        if (fDepts.length > 0) {
            if (!fDepts.some(d => d.trim().toLowerCase() === matDept)) return false;
        }
        return true;
    };

    const getGroupLabel = (group: string, dept: string) => {
        const val = groupBy === 'GROUP' ? group : dept;
        return (val || 'Unassigned').trim();
    };

    const handleDelete = (id: string, type: string) => {
        if (!id) return;
        const msg = type === 'ISSUE' 
            ? "Reverse this Issue? Stock will be returned to inventory."
            : "Delete this transaction? Stock calculation will change.";
            
        if (confirm(msg)) {
            deleteTransaction(id);
            onUpdate(); 
        }
    };

    const downloadCsv = (content: string, filename: string) => {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const sortTxsTimeSensitive = (a: Transaction, b: Transaction) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        const typeScore = (t: string) => (t === 'PURCHASE' || (t === 'ADJUSTMENT' && (a.quantity || 0) > 0)) ? 0 : 1;
        return typeScore(a.type) - typeScore(b.type);
    };

    const generateLedgerData = (fGroups: string[], fDepts: string[]) => {
        let startOfPeriod: Date;
        let endOfPeriod: Date;

        if (periodMode === 'MONTH') {
            startOfPeriod = new Date(year, month, 1);
            endOfPeriod = new Date(year, month + 1, 0, 23, 59, 59);
        } else {
            startOfPeriod = new Date(startDate);
            startOfPeriod.setHours(0,0,0,0);
            endOfPeriod = new Date(endDate);
            endOfPeriod.setHours(23,59,59,999);
        }

        const exportRows: any[] = [];

        data.materials.forEach(mat => {
            const matTxs = data.transactions
                .filter(t => t.materialId === mat.id)
                .sort(sortTxsTimeSensitive);

            const prePeriodTxs = matTxs.filter(t => new Date(t.date) < startOfPeriod);
            let consumedPre = prePeriodTxs
                .filter(t => t.type === 'ISSUE' || (t.type === 'ADJUSTMENT' && t.quantity < 0))
                .reduce((acc, t) => acc + Math.abs(t.quantity), 0);
            
            const preInflows = prePeriodTxs.filter(t => t.type === 'PURCHASE' || (t.type === 'ADJUSTMENT' && t.quantity > 0));
            const openingBatches: any[] = [];
            preInflows.forEach(inTx => {
                if (consumedPre >= inTx.quantity) {
                    consumedPre -= inTx.quantity;
                } else {
                    const remaining = inTx.quantity - consumedPre;
                    consumedPre = 0;
                    if (remaining > 0.001) {
                        openingBatches.push({
                            ...inTx,
                            qtyAtStart: remaining,
                            source: 'OPENING',
                            effectiveDate: startOfPeriod
                        });
                    }
                }
            });

            const periodInflows = matTxs
                .filter(t => {
                    const d = new Date(t.date);
                    return d >= startOfPeriod && d <= endOfPeriod && (t.type === 'PURCHASE' || (t.type === 'ADJUSTMENT' && t.quantity > 0));
                })
                .map(t => ({
                    ...t,
                    qtyAtStart: t.quantity,
                    source: 'PURCHASE',
                    effectiveDate: new Date(t.date)
                }));

            const allActiveBatches = [...openingBatches, ...periodInflows];
            let periodIssueQty = matTxs
                .filter(t => {
                    const d = new Date(t.date);
                    return d >= startOfPeriod && d <= endOfPeriod && (t.type === 'ISSUE' || (t.type === 'ADJUSTMENT' && t.quantity < 0));
                })
                .reduce((acc, t) => acc + Math.abs(t.quantity), 0);

            allActiveBatches.forEach(batch => {
                const batchGroup = resolveBatchGroup(batch, mat);
                const batchDept = batch.department || mat.department;
                if (!matchFilter(batchGroup, batchDept, fGroups, fDepts)) return;

                const batchQty = batch.qtyAtStart;
                let issueFromBatch = 0;

                if (periodIssueQty > 0) {
                    if (periodIssueQty >= batchQty) {
                        issueFromBatch = batchQty;
                        periodIssueQty -= batchQty;
                    } else {
                        issueFromBatch = periodIssueQty;
                        periodIssueQty = 0;
                    }
                }

                const closeQty = batchQty - issueFromBatch;
                let effectiveRate = batch.avgRate || batch.rate; 
                if (batch.totalValue > 0 && batch.quantity > 0) {
                     effectiveRate = (batch.totalValue - (batch.gstAmount || 0)) / batch.quantity;
                }

                exportRows.push({
                    source: batch.source,
                    mrnDate: batch.mrnDate || (batch.source === 'OPENING' ? '-' : new Date(batch.date).toLocaleDateString()),
                    rawDate: batch.effectiveDate,
                    mrn: batch.mrnNo || (batch.source === 'OPENING' ? 'OPENING' : '-'),
                    vendor: batch.vendor || '-',
                    matName: mat.name,
                    uom: mat.unit,
                    qtyIn: batchQty,
                    rate: effectiveRate,
                    amtIn: batchQty * effectiveRate,
                    dept: batchDept,
                    bin: batch.location || mat.location,
                    group: batchGroup,
                    issueQty: issueFromBatch,
                    issueAmt: issueFromBatch * effectiveRate,
                    closeQty: closeQty,
                    closeAmt: closeQty * effectiveRate,
                });
            });
        });

        return exportRows.sort((a, b) => {
            const dateDiff = new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime();
            if (dateDiff !== 0) return dateDiff;
            return (a.mrn || '').localeCompare(b.mrn || '');
        });
    };

    const generateReportRows = (type: ReportType, groupsFilter: string[], deptsFilter: string[]) => {
        if (type === 'FULL_LEDGER') {
            return generateLedgerData(groupsFilter, deptsFilter);
        }

        let startOfPeriod: Date;
        let endOfPeriod: Date;

        if (periodMode === 'MONTH') {
            startOfPeriod = new Date(year, month, 1);
            endOfPeriod = new Date(year, month + 1, 0, 23, 59, 59);
        } else {
            startOfPeriod = new Date(startDate);
            startOfPeriod.setHours(0,0,0,0);
            endOfPeriod = new Date(endDate);
            endOfPeriod.setHours(23,59,59,999);
        }

        const rows: any[] = [];

        if (type === 'OPENING' || type === 'CLOSING') {
            const targetDate = type === 'OPENING' ? startOfPeriod : endOfPeriod;
            
            data.materials.forEach(mat => {
                const matTrans = data.transactions
                    .filter(t => t.materialId === mat.id && (type === 'CLOSING' ? new Date(t.date) <= targetDate : new Date(t.date) < targetDate))
                    .sort(sortTxsTimeSensitive);

                const batches: { qty: number, rate: number, group: string, dept: string, vendor: string }[] = [];
                let pendingDeduction = 0; 
                let lastKnownRate = mat.pricePerUnit || 0; 

                matTrans.forEach(t => {
                    if (t.type === 'PURCHASE' || (t.type === 'ADJUSTMENT' && t.quantity > 0)) {
                        let effectiveRate = t.avgRate || t.rate;
                        if (t.totalValue > 0 && t.quantity > 0) {
                             const basicVal = t.totalValue - (t.gstAmount || 0);
                             effectiveRate = basicVal / t.quantity;
                        }
                        lastKnownRate = effectiveRate; 

                        let qtyToAdd = t.quantity;
                        
                        if (pendingDeduction > 0) {
                            if (qtyToAdd >= pendingDeduction) {
                                qtyToAdd -= pendingDeduction;
                                pendingDeduction = 0;
                            } else {
                                pendingDeduction -= qtyToAdd;
                                qtyToAdd = 0;
                            }
                        }

                        if (qtyToAdd > 0) {
                            let safeDept = t.department || mat.department || 'Store';
                            if (safeDept === 'Paper Cone' || safeDept === 'Raw Material') {
                                safeDept = mat.department || 'Store';
                            }

                            batches.push({
                                qty: qtyToAdd,
                                rate: effectiveRate,
                                group: resolveBatchGroup(t, mat),
                                dept: safeDept,
                                vendor: t.vendor || ''
                            });
                        }

                    } else if (t.type === 'ISSUE' || (t.type === 'ADJUSTMENT' && t.quantity < 0)) {
                        let remaining = Math.abs(t.quantity);
                        while (remaining > 0.0001 && batches.length > 0) {
                            const batch = batches[0];
                            if (batch.qty > remaining) {
                                batch.qty -= remaining;
                                remaining = 0;
                            } else {
                                remaining -= batch.qty;
                                batches.shift();
                            }
                        }
                        if (remaining > 0.0001) {
                            pendingDeduction += remaining;
                        }
                    }
                });

                const bucketStock: Record<string, { qty: number, val: number }> = {};
                batches.forEach(b => {
                    const key = `${b.group.toUpperCase()}|${b.dept.toUpperCase()}`;
                    if (!bucketStock[key]) bucketStock[key] = { qty: 0, val: 0 };
                    bucketStock[key].qty += b.qty;
                    bucketStock[key].val += b.qty * b.rate;
                });

                if (pendingDeduction > 0.0001) {
                    const key = `${(mat.group||'General').toUpperCase()}|${(mat.department||'Store').toUpperCase()}`;
                    if (!bucketStock[key]) bucketStock[key] = { qty: 0, val: 0 };
                    bucketStock[key].qty -= pendingDeduction;
                    bucketStock[key].val -= pendingDeduction * lastKnownRate; 
                }

                Object.entries(bucketStock).forEach(([key, d]) => {
                    if (Math.abs(d.qty) <= 0.0001 && Math.abs(d.val) <= 0.01) return;
                    const [grp, dpt] = key.split('|');
                    if (!matchFilter(grp, dpt, groupsFilter, deptsFilter)) return;
                    
                    rows.push({
                        id: mat.id,
                        rawMatId: mat.id, 
                        name: mat.name,
                        matName: mat.name,
                        description: mat.description || '',
                        group: grp, 
                        department: dpt,
                        dept: dpt,
                        label: getGroupLabel(grp, dpt),
                        location: mat.location,
                        unit: mat.unit,
                        uom: mat.unit,
                        qty: parseFloat(d.qty.toFixed(2)),
                        rate: d.qty !== 0 ? parseFloat((d.val / d.qty).toFixed(4)) : 0, 
                        value: parseFloat(d.val.toFixed(2))
                    });
                });
            });
        } else {
            let relevantTransactions = data.transactions.filter(t => {
                const d = new Date(t.date);
                return d >= startOfPeriod && d <= endOfPeriod && (type === 'CUSTOM' || t.type === type);
            });

            relevantTransactions.forEach(t => {
                const mat = data.materials.find(m => m.id === t.materialId);
                if (!mat) return;
                
                const tGroup = resolveBatchGroup(t, mat);
                let tDept = t.department || mat.department;
                if (tDept === 'Paper Cone' || tDept === 'Raw Material') tDept = mat.department || 'Store';

                if (type !== 'CUSTOM' && !matchFilter(tGroup, tDept, groupsFilter, deptsFilter)) return;

                let val = t.totalValue;
                if (t.type === 'PURCHASE') {
                     val = t.totalValue - (t.gstAmount || 0);
                } 
                
                rows.push({
                    id: t.id,
                    rawMatId: t.materialId, 
                    date: t.date ? new Date(t.date).toLocaleDateString('en-GB') : '-',
                    rawDate: t.date,
                    billNo: t.billNo || '-',
                    billDate: t.billDate ? new Date(t.billDate).toLocaleDateString('en-GB') : '-',
                    vendor: t.vendor || '-',
                    gstNo: t.gstNo || '-',
                    mrn: t.mrnNo || '-',
                    mrnNo: t.mrnNo || '-',
                    mrnDate: t.mrnDate ? new Date(t.mrnDate).toLocaleDateString('en-GB') : '-',
                    name: t.materialName,
                    materialName: t.materialName, 
                    matName: t.materialName,
                    description: mat.description || '-',
                    group: tGroup,
                    department: tDept || '-',
                    dept: tDept || '-',
                    label: getGroupLabel(tGroup, tDept || '-'), 
                    unit: mat.unit || '-',
                    uom: mat.unit || '-',
                    qty: t.quantity,
                    rate: t.rate,
                    avgRate: t.avgRate || 0,
                    value: val,
                    totalValue: t.totalValue, 
                    remarks: t.remarks || '-',
                    type: t.type
                });
            });
        }
        return rows;
    };

    const reportData = useMemo(() => {
        if (detailView === 'FULL_LEDGER') return { totalOpening: 0, totalPurchase: 0, totalIssue: 0, totalAdjustment: 0, totalClosing: 0, rowsOpening: [], rowsPurchase: [], rowsIssue: [], rowsAdjustment: [], rowsClosing: [], negativeItems: 0, zeroRateItems: 0, negativeItemsList: [] };

        const openingRows = generateReportRows('OPENING', filterGroups, filterDepts);
        const purchaseRows = generateReportRows('PURCHASE', filterGroups, filterDepts);
        const issueRows = generateReportRows('ISSUE', filterGroups, filterDepts);
        const adjRows = generateReportRows('ADJUSTMENT', filterGroups, filterDepts);
        const closingRows = generateReportRows('CLOSING', filterGroups, filterDepts);

        const negativeItemsList = closingRows.filter(r => r.qty < 0);
        const negativeItems = negativeItemsList.length;
        const zeroRateItems = closingRows.filter(r => r.qty > 0 && r.value === 0).length;

        const aggregate = (rows: any[]) => {
            const map: Record<string, {q: number, v: number}> = {};
            let totalQ = 0;
            let totalV = 0;
            rows.forEach(r => {
                const label = r.label || r.group || 'General';
                if (!map[label]) map[label] = { q: 0, v: 0 };
                map[label].q += r.qty;
                map[label].v += r.value;
                totalQ += r.qty;
                totalV += r.value;
            });
            return {
                totalQ,
                totalV,
                breakdown: Object.entries(map)
                    .map(([label, val]) => ({ label, qty: val.q, value: val.v }))
                    .filter(r => Math.abs(r.value) > 0.01 || Math.abs(r.qty) > 0.001)
                    .sort((a, b) => b.value - a.value)
            };
        };

        const op = aggregate(openingRows);
        const pur = aggregate(purchaseRows);
        const iss = aggregate(issueRows);
        const adj = aggregate(adjRows);
        const cl = aggregate(closingRows);

        return {
            totalOpening: op.totalV,
            totalPurchase: pur.totalV,
            totalIssue: iss.totalV,
            totalAdjustment: adj.totalV,
            totalClosing: cl.totalV,
            rowsOpening: op.breakdown,
            rowsPurchase: pur.breakdown,
            rowsIssue: iss.breakdown,
            rowsAdjustment: adj.breakdown,
            rowsClosing: cl.breakdown,
            negativeItems,
            negativeItemsList, 
            zeroRateItems
        };

    }, [data, periodMode, month, year, startDate, endDate, filterDepts, filterGroups, groupBy, detailView]);

    const breakdownLabels = useMemo(() => {
        const labels = new Set<string>();
        if (detailView !== 'FULL_LEDGER') {
            reportData.rowsOpening.forEach(r => labels.add(r.label));
            reportData.rowsPurchase.forEach(r => labels.add(r.label));
            reportData.rowsIssue.forEach(r => labels.add(r.label));
            reportData.rowsAdjustment.forEach(r => labels.add(r.label));
            reportData.rowsClosing.forEach(r => labels.add(r.label));
        }
        return Array.from(labels).sort();
    }, [reportData, detailView]);

    const addFilter = () => setCustomFilters([...customFilters, { field: 'vendor', operator: 'contains', value: '' }]);
    const removeFilter = (idx: number) => setCustomFilters(customFilters.filter((_, i) => i !== idx));
    const clearFilters = () => setCustomFilters([]);
    const updateFilter = (idx: number, field: keyof ReportFilter, val: string) => {
        const newFilters = [...customFilters];
        newFilters[idx] = { ...newFilters[idx], [field]: val };
        setCustomFilters(newFilters);
    };
    const handleSaveReport = () => { if (!saveReportName.trim()) return; saveReportConfiguration({id: Date.now().toString(), name: saveReportName, filters: customFilters, columns: visibleColumns}); setIsSaveMode(false); setSaveReportName(''); data.savedReports.push({id: Date.now().toString(), name: saveReportName, filters: customFilters, columns: visibleColumns}); };
    const loadReport = (report: SavedReport) => { setDetailView('CUSTOM'); setModalSearchTerm(''); setIsBillWiseMode(false); setSortOrder('DATE_NEW'); setIsSummaryMode(false); setCustomFilters(report.filters); setVisibleColumns(report.columns); setModalFilterDepts([]); setModalFilterGroups([]); };
    const deleteReport = (id: string, e: React.MouseEvent) => { e.stopPropagation(); if (confirm('Delete this saved report?')) { deleteReportConfiguration(id); const idx = data.savedReports.findIndex(r => r.id === id); if(idx !== -1) data.savedReports.splice(idx, 1); setSaveReportName(' '); setTimeout(() => setSaveReportName(''), 0); } };

    const handleOpenDetail = (type: ReportType | 'FULL_LEDGER') => {
        setDetailView(type as ReportType);
        setModalSearchTerm('');
        setModalActiveFilters({});
        if (type === 'FULL_LEDGER') {
            setVisibleColumns(COLUMNS_DEF['FULL_LEDGER'].map(c => c.id));
        } else if (type === 'OPENING' || type === 'CLOSING') {
            setVisibleColumns(COLUMNS_DEF['SNAPSHOT'].map(c => c.id));
        } else if (type === 'CUSTOM') {
            setVisibleColumns(COLUMNS_DEF['CUSTOM'].map(c => c.id));
        } else {
            setVisibleColumns(COLUMNS_DEF[type].map(c => c.id));
        }
    };

    const handleFixMismatch = (matId: string) => {
        repairMaterialTransactionValues(matId);
        onUpdate();
        setDrilldownData(null);
    };

    const handleHealthClick = (type: 'ZERO_VALUE' | 'NEGATIVE' | 'MISMATCH') => {
        if (type === 'ZERO_VALUE') {
            const closing = generateReportRows('CLOSING', filterGroups, filterDepts);
            const zeroRows = closing.filter(r => r.qty > 0 && r.value === 0);
            setDrilldownData({
                title: 'Items with Zero Value (Potential FOC)',
                transactions: zeroRows
            });
        } else if (type === 'NEGATIVE') {
            const closing = generateReportRows('CLOSING', filterGroups, filterDepts);
            const negativeRows = closing.filter(r => r.qty < 0);
            setDrilldownData({
                title: 'Items with Negative Stock',
                transactions: negativeRows
            });
        } else if (type === 'MISMATCH') {
            const opRows = generateReportRows('OPENING', filterGroups, filterDepts);
            const purRows = generateReportRows('PURCHASE', filterGroups, filterDepts);
            const issRows = generateReportRows('ISSUE', filterGroups, filterDepts);
            const adjRows = generateReportRows('ADJUSTMENT', filterGroups, filterDepts);
            const clRows = generateReportRows('CLOSING', filterGroups, filterDepts);

            const map: Record<string, { name: string, op: number, in: number, out: number, adj: number, close: number, id: string }> = {};

            const process = (rows: any[], key: 'op'|'in'|'out'|'adj'|'close') => {
                rows.forEach(r => {
                    const id = r.rawMatId;
                    if (!id) return;
                    if (!map[id]) map[id] = { name: r.name || r.materialName, op: 0, in: 0, out: 0, adj: 0, close: 0, id };
                    map[id][key] += (r.value || 0);
                });
            };

            process(opRows, 'op');
            process(purRows, 'in');
            process(issRows, 'out'); 
            process(adjRows, 'adj');
            process(clRows, 'close'); 

            const mismatches = Object.values(map).map(item => {
                const expectedClose = item.op + item.in - item.out + item.adj;
                const diff = expectedClose - item.close;
                return { 
                    ...item, 
                    diff, 
                    absDiff: Math.abs(diff) 
                };
            }).filter(item => item.absDiff > 1.0).sort((a, b) => b.absDiff - a.absDiff);

            const mismatchRows = mismatches.map(m => ({
                materialName: m.name,
                rawMatId: m.id,
                qty: 0, rate: 0, 
                billNo: `Stored Flow: ${m.op.toFixed(0)} + ${m.in.toFixed(0)} - ${m.out.toFixed(0)}`,
                vendor: 'Value Mismatch',
                date: 'Recalc Required',
                value: m.diff, 
                department: `Actual Close: ${m.close.toFixed(2)}`
            }));

            setDrilldownData({
                title: 'Stock Flow Mismatches (Values out of sync with FIFO)',
                transactions: mismatchRows,
                type: 'MISMATCH'
            });
        }
    };

    const getDetailRows = () => {
        if (!detailView) return [];
        let rows = detailView === 'FULL_LEDGER' 
            ? generateLedgerData(filterGroups, filterDepts)
            : generateReportRows(detailView, filterGroups, filterDepts);

        // Header Filtering
        rows = rows.filter((r: any) => {
            for (const [key, values] of Object.entries(modalActiveFilters)) {
                const selectedValues = values as string[];
                if (selectedValues.length === 0) continue;
                const val = String(r[key] || '');
                if (!selectedValues.includes(val)) return false;
            }
            return true;
        });

        if (modalSearchTerm) {
            const term = modalSearchTerm.toLowerCase();
            return rows.filter((r: any) => Object.values(r).some(v => String(v).toLowerCase().includes(term)));
        }
        return rows;
    };

    const handleModalFilterChange = (colKey: string, selectedValues: string[]) => {
        setModalActiveFilters(prev => {
            const next = { ...prev, [colKey]: selectedValues };
            if (selectedValues.length === 0) delete next[colKey];
            return next;
        });
        setOpenFilterCol(null);
    };

    const handleExportDetail = () => {
        const rows = getDetailRows();
        if (rows.length === 0) return alert("No data to export");
        
        let activeDefKey = 'CUSTOM';
        if (detailView === 'FULL_LEDGER') activeDefKey = 'FULL_LEDGER';
        else if (detailView === 'OPENING' || detailView === 'CLOSING') activeDefKey = 'SNAPSHOT';
        else if (detailView) activeDefKey = detailView;
        
        const defs = COLUMNS_DEF[activeDefKey] || [];
        const headers = visibleColumns.map(id => defs.find(d => d.id === id)?.label || id);
        
        const csv = [
            headers.join(','),
            ...rows.map((r: any) => visibleColumns.map(id => `"${String(r[id]||'').replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        
        downloadCsv(csv, `${detailView}_Report_${new Date().toISOString().split('T')[0]}.csv`);
    };

    const handleExportFullAnalysis = () => {
        const rows = generateLedgerData(filterGroups, filterDepts);
        const headers = COLUMNS_DEF['FULL_LEDGER'].map(c => c.label);
        const keys = COLUMNS_DEF['FULL_LEDGER'].map(c => c.id);
        
        const csv = [
            headers.join(','),
            ...rows.map(r => keys.map(k => `"${String(r[k]||'').replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        
        downloadCsv(csv, `Full_Ledger_Analysis_${new Date().toISOString().split('T')[0]}.csv`);
    };

    const handleDrilldown = (source: 'OPENING'|'PURCHASE'|'ISSUE'|'ADJUSTMENT'|'CLOSING', label: string) => {
        const allRows = generateReportRows(source, filterGroups, filterDepts);
        const filtered = allRows.filter((r: any) => (r.label || r.group || 'General') === label);
        
        setDrilldownData({
            title: `${source} Details - ${label}`,
            transactions: filtered
        });
    };

    if (!detailView) {
        const calculatedClosing = reportData.totalOpening + reportData.totalPurchase - reportData.totalIssue + reportData.totalAdjustment;
        const diff = Math.abs(calculatedClosing - reportData.totalClosing);
        const isBalanced = diff < 1.0; 

        return (
            <div className="h-full overflow-y-auto custom-scrollbar p-4 space-y-4" onClick={() => setShowExportMenu(false)}>
                {/* Header & Filters */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center shrink-0 gap-4">
                    <div><h2 className="text-2xl font-bold text-[var(--text-primary)]">Financial Reports</h2><p className="text-gray-400 text-xs">Inventory valuation and transaction summary.</p></div>
                     
                     <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                        <div className="bg-[var(--bg-card)] p-1 rounded-lg border border-[var(--border-color)] flex gap-2 self-start">
                            <select value={periodMode} onChange={(e: any) => setPeriodMode(e.target.value)} className="bg-[var(--bg-main)] text-white text-xs border-none rounded focus:ring-0"><option value="MONTH">Monthly</option><option value="RANGE">Custom Range</option></select>
                            {periodMode === 'MONTH' ? (<><select value={month} onChange={(e: any) => setMonth(parseInt(e.target.value))} className="bg-[var(--bg-main)] text-white text-xs border-none rounded focus:ring-0">{Array.from({length: 12}, (_, i) => i).map(m => <option key={m} value={m}>{new Date(0, m).toLocaleString('default', { month: 'short' })}</option>)}</select><select value={year} onChange={(e: any) => setYear(parseInt(e.target.value))} className="bg-[var(--bg-main)] text-white text-xs border-none rounded focus:ring-0">{Array.from({length: 5}, (_, i) => new Date().getFullYear() - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}</select></>) : (<><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-[var(--bg-main)] text-white text-xs border-none rounded focus:ring-0 w-24"/><span className="text-gray-500 self-center">-</span><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-[var(--bg-main)] text-white text-xs border-none rounded focus:ring-0 w-24"/></>)}
                        </div>

                        <Button onClick={() => handleOpenDetail('FULL_LEDGER')} variant="secondary" className="text-xs py-1 px-3 h-full flex items-center gap-2 border-blue-500/50 text-blue-400 hover:bg-blue-900/20">
                            <Table size={14}/> View Ledger
                        </Button>

                        <div className="relative">
                            <Button onClick={(e) => { e.stopPropagation(); setShowExportMenu(!setShowExportMenu); }} variant="primary" className="text-xs py-1 px-3 h-full flex items-center gap-2 shadow-lg shadow-blue-500/20">
                                <Download size={14}/> Export Data
                            </Button>
                            {showExportMenu && (
                                <div className="absolute right-0 top-full mt-2 w-64 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg shadow-2xl z-[100] overflow-hidden animate-fadeIn ring-1 ring-white/10">
                                    <div className="p-3 border-b border-[var(--border-color)] bg-[var(--bg-main)]/50">
                                        <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase">Export Options</h4>
                                    </div>
                                    <button onClick={handleExportFullAnalysis} className="w-full text-left px-4 py-3 text-xs text-green-400 hover:bg-[var(--bg-main)] transition-colors">
                                        <div className="font-bold flex items-center gap-2"><FileText size={12}/> Full Ledger Analysis</div>
                                        <div className="text-[10px] text-green-500/50 mt-0.5">FIFO Batch Wise (In/Out/Bal)</div>
                                    </button>
                                </div>
                            )}
                        </div>
                     </div>
                </div>
                 <div className="shrink-0 grid grid-cols-1 md:grid-cols-2 gap-4"><MultiSelect label="Filter Groups" options={cleanGroups} selected={filterGroups} onChange={setFilterGroups} /><MultiSelect label="Filter Depts" options={cleanDepartments} selected={filterDepts} onChange={setFilterDepts} /></div>

                {/* --- RECONCILIATION & HEALTH MONITOR --- */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 shrink-0">
                    {/* Reconciliation Card */}
                    <Card className="lg:col-span-2 p-4 bg-[var(--bg-card)] relative overflow-hidden border-[var(--border-color)]">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-2">
                                <Activity className="text-[var(--accent)]" size={18}/>
                                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Stock Flow Reconciliation</h3>
                            </div>
                            {isBalanced ? 
                                <span className="flex items-center gap-1 text-[10px] bg-green-900/30 text-green-400 px-2 py-1 rounded-full border border-green-800"><ShieldCheck size={12}/> Balanced</span> :
                                <button onClick={() => handleHealthClick('MISMATCH')} className="flex items-center gap-1 text-[10px] bg-red-900/30 text-red-400 px-2 py-1 rounded-full border border-red-800 hover:bg-red-900/50 transition-colors cursor-pointer"><ShieldAlert size={12}/> Mismatch ({diff.toFixed(0)}) <span className="underline ml-1">Check</span></button>
                            }
                        </div>
                        
                        <div className="flex items-center justify-between gap-2 text-xs md:text-sm font-mono relative z-10">
                            <div className="flex flex-col items-center">
                                <span className="text-blue-400 font-bold">{(reportData.totalOpening/1000).toFixed(1)}k</span>
                                <span className="text-[10px] text-gray-500">OPEN</span>
                            </div>
                            <Plus size={12} className="text-gray-600"/>
                            <div className="flex flex-col items-center">
                                <span className="text-green-400 font-bold">{(reportData.totalPurchase/1000).toFixed(1)}k</span>
                                <span className="text-[10px] text-gray-500">PUR</span>
                            </div>
                            <div className="text-gray-600 font-bold">-</div>
                            <div className="flex flex-col items-center">
                                <span className="text-red-400 font-bold">{(reportData.totalIssue/1000).toFixed(1)}k</span>
                                <span className="text-[10px] text-gray-500">ISS</span>
                            </div>
                            <div className="text-gray-600 font-bold">=</div>
                            <div className="flex flex-col items-center bg-[var(--bg-main)] px-3 py-1 rounded border border-[var(--border-color)]">
                                <span className="text-purple-400 font-bold">{(reportData.totalClosing/1000).toFixed(1)}k</span>
                                <span className="text-[10px] text-gray-500">CLOSE</span>
                            </div>
                        </div>
                        {/* Background Flow Line */}
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-green-500 to-purple-500 opacity-20"></div>
                    </Card>

                    {/* Data Health Card */}
                    <Card className="p-4 bg-[var(--bg-card)] border-[var(--border-color)] flex flex-col justify-between">
                        <div className="flex items-center gap-2 mb-2 text-gray-400 text-xs font-bold uppercase tracking-wider">
                            <Info size={14}/> Data Health
                        </div>
                        <div className="flex gap-4">
                            <div 
                                onClick={() => reportData.negativeItems > 0 && handleHealthClick('NEGATIVE')} 
                                title={reportData.negativeItemsList?.map(i => i.name).join('\n')}
                                className={`flex-1 p-2 rounded border flex flex-col items-center transition-colors cursor-pointer ${reportData.negativeItems > 0 ? 'bg-red-900/10 border-red-800 hover:bg-red-900/20' : 'bg-[var(--bg-main)] border-[var(--border-color)] opacity-50 cursor-default'}`}
                            >
                                <span className={`text-lg font-bold ${reportData.negativeItems > 0 ? 'text-red-400' : 'text-gray-300'}`}>{reportData.negativeItems}</span>
                                <span className="text-[9px] text-gray-500 text-center">Negative Stock</span>
                                {reportData.negativeItems > 0 && reportData.negativeItems <= 3 && (
                                    <div className="mt-1 text-[9px] text-red-300 text-center leading-tight max-w-[100px] truncate">
                                        {reportData.negativeItemsList.map(i => i.name).join(', ')}
                                    </div>
                                )}
                            </div>
                            <div onClick={() => reportData.zeroRateItems > 0 && handleHealthClick('ZERO_VALUE')} className={`flex-1 p-2 rounded border flex flex-col items-center transition-colors cursor-pointer ${reportData.zeroRateItems > 0 ? 'bg-yellow-900/10 border-yellow-800 hover:bg-yellow-900/20' : 'bg-[var(--bg-main)] border-[var(--border-color)] opacity-50 cursor-default'}`}>
                                <span className={`text-lg font-bold ${reportData.zeroRateItems > 0 ? 'text-yellow-400' : 'text-gray-300'}`}>{reportData.zeroRateItems}</span>
                                <span className="text-[9px] text-gray-500 text-center">Zero Value</span>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Stats Cards */}
                <div className="shrink-0 grid grid-cols-2 md:grid-cols-5 gap-3">
                    <Card className="p-3 cursor-pointer hover:border-blue-500 transition-colors bg-[var(--bg-card)] group" onClick={() => handleOpenDetail('OPENING')}><div className="flex justify-between items-start"><div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Opening</div><Archive size={14} className="text-blue-500 opacity-50 group-hover:opacity-100"/></div><div className="text-base md:text-lg font-bold text-blue-400 mt-1 font-mono">₹{reportData.totalOpening.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div></Card>
                    <Card className="p-3 cursor-pointer hover:border-green-500 transition-colors bg-[var(--bg-card)] group" onClick={() => handleOpenDetail('PURCHASE')}><div className="flex justify-between items-start"><div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Purchase</div><ShoppingCart size={14} className="text-green-500 opacity-50 group-hover:opacity-100"/></div><div className="text-base md:text-lg font-bold text-green-400 mt-1 font-mono">₹{reportData.totalPurchase.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div></Card>
                    <Card className="p-3 cursor-pointer hover:border-red-500 transition-colors bg-[var(--bg-card)] group" onClick={() => handleOpenDetail('ISSUE')}><div className="flex justify-between items-start"><div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Issue</div><TrendingUp size={14} className="text-red-500 opacity-50 group-hover:opacity-100"/></div><div className="text-base md:text-lg font-bold text-red-400 mt-1 font-mono">₹{reportData.totalIssue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div></Card>
                    <Card className="p-3 cursor-pointer hover:border-yellow-500 transition-colors bg-[var(--bg-card)] group" onClick={() => handleOpenDetail('ADJUSTMENT')}><div className="flex justify-between items-start"><div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Adj.</div><SlidersHorizontal size={14} className="text-yellow-500 opacity-50 group-hover:opacity-100"/></div><div className="text-base md:text-lg font-bold text-yellow-400 mt-1 font-mono">₹{reportData.totalAdjustment.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div></Card>
                    <Card className="p-3 cursor-pointer hover:border-purple-500 transition-colors bg-[var(--bg-card)] group" onClick={() => handleOpenDetail('CLOSING')}><div className="flex justify-between items-start"><div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Closing</div><DollarSign size={14} className="text-purple-500 opacity-50 group-hover:opacity-100"/></div><div className="text-base md:text-lg font-bold text-purple-400 mt-1 font-mono">₹{reportData.totalClosing.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div></Card>
                </div>
                
                {/* Breakdown Table */}
                <div className="relative border border-[var(--border-color)] bg-[var(--bg-card)] rounded-xl overflow-hidden glass-effect shadow-inner flex flex-col min-h-[600px]">
                     <div className="p-3 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-main)] shrink-0 z-20">
                         <div className="flex items-center gap-2"><h3 className="text-sm font-bold text-[var(--text-primary)]">Breakdown</h3><div className="flex bg-[var(--bg-card)] rounded p-0.5 border border-[var(--border-color)]"><button onClick={() => setGroupBy('GROUP')} className={`text-[10px] px-2 py-0.5 rounded transition-all ${groupBy === 'GROUP' ? 'bg-[var(--accent)] text-white' : 'text-gray-400 hover:text-white'}`}>Group</button><button onClick={() => setGroupBy('DEPARTMENT')} className={`text-[10px] px-2 py-0.5 rounded transition-all ${groupBy === 'DEPARTMENT' ? 'bg-[var(--accent)] text-white' : 'text-gray-400 hover:text-white'}`}>Dept</button></div></div>
                     </div>
                     <div className="flex-1 overflow-auto custom-scrollbar p-0">
                        <table className="w-full text-left text-sm text-[var(--text-secondary)] whitespace-nowrap">
                                <thead className="bg-[var(--bg-main)] text-xs uppercase font-bold text-[var(--text-secondary)] sticky top-0 z-20 shadow-md">
                                    <tr>
                                        <th rowSpan={2} className="p-3 border-r border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-primary)] sticky left-0 z-30 w-48 shadow-[2px_0_5px_rgba(0,0,0,0.1)]">Category</th>
                                        <th colSpan={2} className="px-2 py-1 text-center border-b border-r border-[var(--border-color)] text-blue-400 bg-[var(--bg-main)]">Opening</th>
                                        <th colSpan={2} className="px-2 py-1 text-center border-b border-r border-[var(--border-color)] text-green-400 bg-[var(--bg-main)]">Purchase</th>
                                        <th colSpan={2} className="px-2 py-1 text-center border-b border-r border-[var(--border-color)] text-red-400 bg-[var(--bg-main)]">Issue</th>
                                        <th colSpan={2} className="px-2 py-1 text-center border-b border-r border-[var(--border-color)] text-yellow-400 bg-[var(--bg-main)]">Adjustment</th>
                                        <th colSpan={2} className="px-2 py-1 text-center border-b border-r border-[var(--border-color)] text-purple-400 bg-[var(--bg-main)]">Closing</th>
                                    </tr>
                                    <tr>
                                        <th className="px-2 py-2 text-right border-r border-b border-[var(--border-color)] w-24 bg-[var(--bg-main)]">Qty</th>
                                        <th className="px-2 py-2 text-right border-r border-b border-[var(--border-color)] w-28 bg-[var(--bg-main)]">Amt</th>
                                        <th className="px-2 py-2 text-right border-r border-b border-[var(--border-color)] w-24 bg-[var(--bg-main)]">Qty</th>
                                        <th className="px-2 py-2 text-right border-r border-b border-[var(--border-color)] w-28 bg-[var(--bg-main)]">Amt</th>
                                        <th className="px-2 py-2 text-right border-r border-b border-[var(--border-color)] w-24 bg-[var(--bg-main)]">Qty</th>
                                        <th className="px-2 py-2 text-right border-r border-b border-[var(--border-color)] w-28 bg-[var(--bg-main)]">Amt</th>
                                        <th className="px-2 py-2 text-right border-r border-b border-[var(--border-color)] w-24 bg-[var(--bg-main)]">Qty</th>
                                        <th className="px-2 py-2 text-right border-r border-b border-[var(--border-color)] w-28 bg-[var(--bg-main)]">Amt</th>
                                        <th className="px-2 py-2 text-right border-r border-b border-[var(--border-color)] w-24 bg-[var(--bg-main)]">Qty</th>
                                        <th className="px-2 py-2 text-right border-b border-[var(--border-color)] w-28 bg-[var(--bg-main)]">Amt</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-color)]">
                                    {breakdownLabels.map(label => {
                                        const open = reportData.rowsOpening.find(r => r.label === label) || { qty: 0, value: 0 };
                                        const pur = reportData.rowsPurchase.find(r => r.label === label) || { qty: 0, value: 0 };
                                        const iss = reportData.rowsIssue.find(r => r.label === label) || { qty: 0, value: 0 };
                                        const adj = reportData.rowsAdjustment.find(r => r.label === label) || { qty: 0, value: 0 };
                                        const close = reportData.rowsClosing.find(r => r.label === label) || { qty: 0, value: 0 };
                                        const hasData = (open?.value||0) + (pur?.value||0) + (iss?.value||0) + (adj?.value||0) + (close?.value||0) !== 0;
                                        if (!hasData) return null;
                                        const clickableCell = "hover:bg-white/10 cursor-pointer underline decoration-dotted decoration-gray-500/50";
                                        return (
                                            <tr key={label} className="hover:bg-[var(--bg-card-hover)] group transition-colors">
                                                <td className="p-3 border-r border-[var(--border-color)] font-bold text-[var(--text-primary)] sticky left-0 bg-[var(--bg-card)] group-hover:bg-[var(--bg-card-hover)] z-10 shadow-[2px_0_5px_rgba(0,0,0,0.1)] text-xs">{label}</td>
                                                <td className="px-2 py-2 text-right border-r border-[var(--border-color)] font-mono text-gray-400">{open.qty !== 0 ? open.qty : '-'}</td>
                                                <td onClick={() => handleDrilldown('OPENING', label)} className={`px-2 py-2 text-right border-r border-[var(--border-color)] font-mono text-blue-400 ${clickableCell}`}>{open.value !== 0 ? open.value.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0}) : '-'}</td>
                                                <td className="px-2 py-2 text-right border-r border-[var(--border-color)] font-mono text-gray-400">{pur.qty !== 0 ? pur.qty : '-'}</td>
                                                <td onClick={() => handleDrilldown('PURCHASE', label)} className={`px-2 py-2 text-right border-r border-[var(--border-color)] font-mono text-green-400 ${clickableCell}`}>{pur.value !== 0 ? pur.value.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0}) : '-'}</td>
                                                <td className="px-2 py-2 text-right border-r border-[var(--border-color)] font-mono text-gray-400">{iss.qty !== 0 ? iss.qty : '-'}</td>
                                                <td onClick={() => handleDrilldown('ISSUE', label)} className={`px-2 py-2 text-right border-r border-[var(--border-color)] font-mono text-red-400 ${clickableCell}`}>{iss.value !== 0 ? iss.value.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0}) : '-'}</td>
                                                <td className="px-2 py-2 text-right border-r border-[var(--border-color)] font-mono text-gray-400">{adj.qty !== 0 ? adj.qty : '-'}</td>
                                                <td onClick={() => handleDrilldown('ADJUSTMENT', label)} className={`px-2 py-2 text-right border-r border-[var(--border-color)] font-mono text-yellow-400 ${clickableCell}`}>{adj.value !== 0 ? adj.value.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0}) : '-'}</td>
                                                <td className="px-2 py-2 text-right border-r border-[var(--border-color)] font-mono font-bold text-gray-300">{close.qty !== 0 ? close.qty : '-'}</td>
                                                <td onClick={() => handleDrilldown('CLOSING', label)} className={`px-2 py-2 text-right border-[var(--border-color)] font-mono font-bold text-purple-400 ${clickableCell}`}>{close.value !== 0 ? close.value.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0}) : '-'}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                                <tfoot className="bg-[var(--bg-main)] sticky bottom-0 z-20 font-bold text-[var(--text-primary)] shadow-[0_-5px_20px_rgba(0,0,0,0.3)] border-t border-[var(--border-color)] text-xs">
                                     <tr>
                                        <td className="p-3 border-r border-[var(--border-color)] sticky left-0 bg-[var(--bg-main)] z-30 shadow-[2px_0_5px_rgba(0,0,0,0.1)]">TOTAL</td>
                                        <td className="px-2 py-2 text-right border-r border-[var(--border-color)] text-gray-500">-</td>
                                        <td className="px-2 py-2 text-right border-r border-[var(--border-color)] text-blue-400">{reportData.totalOpening.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                                        <td className="px-2 py-2 text-right border-r border-[var(--border-color)] text-gray-500">-</td>
                                        <td className="px-2 py-2 text-right border-r border-[var(--border-color)] text-green-400">{reportData.totalPurchase.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                                        <td className="px-2 py-2 text-right border-r border-[var(--border-color)] text-gray-500">-</td>
                                        <td className="px-2 py-2 text-right border-r border-[var(--border-color)] text-red-400">{reportData.totalIssue.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                                        <td className="px-2 py-2 text-right border-r border-[var(--border-color)] text-gray-500">-</td>
                                        <td className="px-2 py-2 text-right border-r border-[var(--border-color)] text-yellow-400">{reportData.totalAdjustment.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                                        <td className="px-2 py-2 text-right border-r border-[var(--border-color)] text-gray-500">-</td>
                                        <td className="px-2 py-2 text-right text-purple-400">{reportData.totalClosing.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                                     </tr>
                                </tfoot>
                            </table>
                        </div>
                </div>
                {savedReports.length > 0 && <Card className="shrink-0 p-3"><h3 className="text-sm font-bold text-[var(--text-primary)] mb-2 flex items-center gap-2"><Save size={14}/> Saved Custom Reports</h3><div className="flex flex-wrap gap-2">{savedReports.map(r => (<div key={r.id} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-2 flex items-center gap-3 cursor-pointer hover:bg-[var(--bg-main)]" onClick={() => loadReport(r)}><FileText size={14} className="text-blue-400"/><span className="text-xs text-gray-200">{r.name}</span><button onClick={(e) => deleteReport(r.id, e)} className="text-gray-500 hover:text-red-400"><X size={12}/></button></div>))}</div></Card>}
                 <div className="flex justify-center shrink-0"><Button variant="secondary" onClick={() => handleOpenDetail('CUSTOM')} className="text-xs">+ Create Custom Query</Button></div>
                
                {drilldownData && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
                        <div className="bg-[var(--bg-card)] w-full max-w-4xl rounded-2xl border border-[var(--border-color)] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                            <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-main)]">
                                <h3 className="text-lg font-bold text-[var(--text-primary)]">{drilldownData.title}</h3>
                                <button onClick={() => setDrilldownData(null)} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-[var(--bg-card)]"><X size={20}/></button>
                            </div>
                            <div className="flex-1 overflow-auto custom-scrollbar p-0">
                                <table className="w-full text-left text-xs text-[var(--text-secondary)]">
                                    <thead className="bg-[var(--bg-main)] sticky top-0 font-bold uppercase">
                                        <tr>
                                            {drilldownData.type === 'MISMATCH' ? (
                                                <>
                                                    <th className="p-3">Material Name</th>
                                                    <th className="p-3">Calculation Logic</th>
                                                    <th className="p-3 text-right">Difference Amount</th>
                                                    <th className="p-3 text-center">Action</th>
                                                </>
                                            ) : (
                                                <>
                                                    <th className="p-3">Date</th>
                                                    <th className="p-3">Ref (Bill/Slip)</th>
                                                    <th className="p-3">Party/Dept</th>
                                                    <th className="p-3">Item</th>
                                                    <th className="p-3 text-right">Qty</th>
                                                    <th className="p-3 text-right">Rate</th>
                                                    <th className="p-3 text-right">Total</th>
                                                </>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border-color)]">
                                        {drilldownData.transactions.map((t, i) => (
                                            <tr key={i} className="hover:bg-[var(--bg-card-hover)]">
                                                {drilldownData.type === 'MISMATCH' ? (
                                                    <>
                                                        <td className="p-3 font-medium text-white">{t.materialName}</td>
                                                        <td className="p-3 font-mono text-gray-400 text-[10px]">{t.billNo}</td>
                                                        <td className="p-3 text-right font-bold text-red-400">{typeof t.value === 'number' ? t.value.toLocaleString(undefined, {minimumFractionDigits: 2}) : t.value}</td>
                                                        <td className="p-3 text-center">
                                                            <button onClick={() => handleFixMismatch(t.rawMatId)} className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 mx-auto">
                                                                <RefreshCw size={10}/> Fix
                                                            </button>
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="p-3">
                                                            {(() => {
                                                                try {
                                                                    const dStr = t.date || t.rawDate;
                                                                    if (!dStr || dStr === 'Invalid Date') return '-';
                                                                    const d = new Date(dStr);
                                                                    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString();
                                                                } catch (e) { return '-'; }
                                                            })()}
                                                        </td>
                                                        <td className="p-3 font-mono text-blue-300">{t.billNo || (t.id ? t.id.slice(-6) : '-')}</td>
                                                        <td className="p-3">{t.vendor || t.department}</td>
                                                        <td className="p-3 font-medium text-white">{t.materialName || t.name}</td>
                                                        <td className="p-3 text-right text-white">{t.qty || t.quantity}</td>
                                                        <td className="p-3 text-right">{typeof t.rate === 'number' ? t.rate.toFixed(4) : '-'}</td>
                                                        <td className="p-3 text-right font-bold text-green-400">{(t.value || t.totalValue || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}
                                        {drilldownData.transactions.length === 0 && <tr><td colSpan={8} className="p-6 text-center">No records found.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-4 bg-[var(--bg-main)] border-t border-[var(--border-color)] flex justify-end">
                                <Button variant="secondary" onClick={() => setDrilldownData(null)}>Close</Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }
    
    // --- DETAIL VIEW RENDERING ---
    const currentRows = getDetailRows();
    const columnTotals = visibleColumns.reduce((acc, colId) => {
        if (['qty', 'quantity', 'value', 'totalValue', 'discount', 'freight', 'gstAmount', 'qtyIn', 'amtIn', 'issueQty', 'issueAmt', 'closeQty', 'closeAmt'].includes(colId)) {
            acc[colId] = currentRows.reduce((sum: number, row: any) => sum + (Number(row[colId]) || 0), 0);
        }
        return acc;
    }, {} as Record<string, number>);

    let activeDefKey = 'CUSTOM';
    if (detailView === 'FULL_LEDGER') activeDefKey = 'FULL_LEDGER';
    else if (detailView === 'OPENING' || detailView === 'CLOSING') activeDefKey = 'SNAPSHOT';
    else if (detailView) activeDefKey = detailView;

    const currentDef = COLUMNS_DEF[activeDefKey] || [];

    return (
        <div className="h-full flex flex-col p-4 space-y-4" onClick={(e) => { 
            const target = e.target as HTMLElement;
            // Only close if we didn't click a filter trigger or dropdown
            if (!target.closest('.filter-trigger-area') && !target.closest('.portal-dropdown-content')) {
                setIsColSelectorOpen(false); 
                setOpenFilterCol(null);
            }
        }}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center shrink-0 gap-4">
                <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => setDetailView(null)} className="p-2 h-9 w-9 flex items-center justify-center rounded-lg"><ChevronRight className="rotate-180" size={16}/></Button>
                    <div>
                        <h2 className="text-xl font-bold text-[var(--text-primary)]">{detailView === 'FULL_LEDGER' ? 'Full Ledger Analysis' : `${detailView} Detail`}</h2>
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                            {periodMode === 'MONTH' ? new Date(0, month).toLocaleString('default', { month: 'long', year: 'numeric' }) : `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`}
                        </div>
                    </div>
                </div>
                
                 <div className="flex gap-2 w-full md:w-auto">
                    <button 
                        onClick={() => setIsFullWidth(!isFullWidth)} 
                        className={`hidden lg:flex p-2 rounded-lg border transition-all h-9 w-9 items-center justify-center ${isFullWidth ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'bg-[var(--bg-card)] border-[var(--border-color)] text-gray-400 hover:text-white'}`}
                        title={isFullWidth ? "Standard View" : "Full Sheet View"}
                    >
                        {isFullWidth ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
                    </button>

                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-2.5 text-gray-500" size={14}/>
                        <input type="text" placeholder="Quick search..." value={modalSearchTerm} onChange={e => setModalSearchTerm(e.target.value)} className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg pl-9 pr-2 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"/>
                    </div>
                    
                    <div className="relative" onClick={e => e.stopPropagation()}>
                        <Button variant="secondary" onClick={() => setIsColSelectorOpen(!isColSelectorOpen)} className="p-2 h-9 w-9 flex items-center justify-center rounded-lg">
                            <SlidersHorizontal size={16}/>
                        </Button>
                        {isColSelectorOpen && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl z-[100] p-2 max-h-80 overflow-y-auto ring-1 ring-white/10 backdrop-blur-xl">
                                <div className="text-[10px] font-bold text-gray-500 p-2 uppercase tracking-wider">Visible Columns</div>
                                {currentDef.map(col => (
                                    <div key={col.id} onClick={() => toggleColumn(col.id)} className="flex items-center gap-3 p-2 hover:bg-[var(--bg-main)] rounded-lg cursor-pointer text-xs text-gray-300 transition-colors">
                                        <div className={`w-4 h-4 border rounded flex items-center justify-center transition-all ${visibleColumns.includes(col.id) ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-gray-600'}`}>
                                            {visibleColumns.includes(col.id) && <Check size={10} className="text-white"/>}
                                        </div>
                                        {col.label}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    <Button variant="primary" onClick={handleExportDetail} className="text-xs h-9 font-bold flex items-center gap-2 shadow-lg shadow-[var(--accent)]/20">
                        <Download size={14}/> <span className="hidden sm:inline">Export CSV</span>
                    </Button>
                </div>
            </div>

            {(detailView === 'CUSTOM' || detailView === 'FULL_LEDGER') && customFilters.length > 0 && (
                <Card className="p-3 bg-[var(--bg-card)] shrink-0 border-[var(--border-color)]">
                    <div className="flex justify-between items-center mb-2"><h4 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Applied Rules</h4><button onClick={clearFilters} className="text-[10px] uppercase font-bold text-red-400 hover:text-red-300">Clear All</button></div>
                    <div className="flex flex-wrap gap-2">
                        {customFilters.map((f, i) => (
                            <span key={i} className="bg-[var(--bg-main)] border border-[var(--border-color)] text-[10px] text-white px-2 py-1 rounded flex items-center gap-2">
                                <span className="text-gray-500 font-bold uppercase">{FILTER_FIELDS.find(ff=>ff.value===f.field)?.label}:</span> {f.operator} '{f.value}'
                                <X size={10} className="cursor-pointer hover:text-red-400" onClick={() => removeFilter(i)}/>
                            </span>
                        ))}
                    </div>
                </Card>
            )}
            
             <div className={`flex-1 relative overflow-hidden bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-inner glass-effect transition-all duration-500 ${isFullWidth ? 'w-full' : 'max-w-7xl mx-auto'}`}>
                <div className="absolute inset-0 overflow-auto custom-scrollbar">
                    <table className="w-full text-left text-xs text-gray-400 whitespace-nowrap table-fixed">
                        <thead className="bg-[var(--bg-main)] text-gray-200 uppercase text-[10px] font-bold sticky top-0 z-40 shadow-sm">
                            <tr>
                                {visibleColumns.map(colId => { 
                                    const def = currentDef.find(c => c.id === colId); 
                                    const uniqueVals = Array.from(new Set(currentRows.map((r: any) => String(r[colId] || '')))).sort();
                                    
                                    return (
                                        <FilterHeader 
                                            key={colId}
                                            colKey={colId}
                                            label={def?.label || colId}
                                            width={def?.width || 120}
                                            isNumeric={def?.isNumeric || false}
                                            uniqueValues={uniqueVals}
                                            activeSelection={modalActiveFilters[colId] || []}
                                            isOpen={openFilterCol === colId}
                                            onToggle={() => setOpenFilterCol(openFilterCol === colId ? null : colId)}
                                            onApply={(vals) => handleModalFilterChange(colId, vals)}
                                            onClose={() => setOpenFilterCol(null)}
                                        />
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-color)]">
                            {currentRows.map((row: any, idx) => (
                                <tr key={idx} className="hover:bg-white/5 transition-colors group">
                                    {visibleColumns.map(colId => { 
                                        const def = currentDef.find(c => c.id === colId); 
                                        if (colId === 'action') { return (<td key={colId} className="p-2 text-center" style={{width: def?.width}}><button onClick={() => handleDelete(row.id, row.type)} className={`p-1 rounded ${row.type === 'ISSUE' ? 'text-orange-400 hover:bg-orange-900/30' : 'text-red-400 hover:bg-red-900/30'}`} title={row.type === 'ISSUE' ? 'Reverse Issue (Return Stock)' : 'Delete Record'}>{row.type === 'ISSUE' ? <RotateCcw size={12}/> : <Trash2 size={12}/>}</button></td>) } 
                                        
                                        let val = row[colId]; 
                                        
                                        if ((colId === 'rate' || colId === 'avgRate') && row.value && row.qty && row.qty !== 0) {
                                            val = row.value / row.qty;
                                        }

                                        if (typeof val === 'number') {
                                            if (colId === 'rate' || colId === 'avgRate') {
                                                val = val.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 4 });
                                            } else {
                                                val = val.toLocaleString(undefined, { maximumFractionDigits: 2 });
                                            }
                                        }
                                        
                                        let specialClass = '';
                                        if (colId === 'source') {
                                            specialClass = val === 'OPENING' ? 'text-blue-400 font-bold' : 'text-green-400 font-bold';
                                        }
                                        if (colId === 'mrn') specialClass = 'text-yellow-500 font-mono font-medium';

                                        return (
                                            <td key={colId} className={`p-2 px-3 border-r border-[var(--border-color)] truncate group-hover:bg-[var(--accent)]/5 ${def?.isRight ? 'text-right font-mono' : ''} ${colId === 'name' || colId === 'matName' ? 'text-white font-medium' : ''} ${specialClass}`} style={{width: def?.width}}>
                                                {val}
                                            </td> 
                                        );
                                    })}
                                </tr>
                            ))} 
                            {currentRows.length === 0 && <tr><td colSpan={visibleColumns.length} className="p-10 text-center text-gray-500 italic">No records match the current filters.</td></tr>}
                        </tbody>
                        {currentRows.length > 0 && (
                            <tfoot className="bg-[var(--bg-main)] text-white font-bold sticky bottom-0 z-40 border-t-2 border-[var(--border-color)] shadow-2xl">
                                <tr>
                                    {visibleColumns.map((colId, index) => { 
                                        const def = currentDef.find(c => c.id === colId);
                                        const total = columnTotals[colId]; 
                                        if (index === 0) return (<td key={colId} className="p-3 pl-4 border-r border-[var(--border-color)] bg-[var(--bg-main)]" style={{width: def?.width}}>TOTAL: {currentRows.length}</td>); 
                                        if (total !== undefined) return (<td key={colId} className={`p-3 text-right font-mono text-[var(--accent)] border-r border-[var(--border-color)] bg-[var(--bg-main)]`} style={{width: def?.width}}>{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>); 
                                        return <td key={colId} className="p-3 border-r border-[var(--border-color)] bg-[var(--bg-main)]" style={{width: def?.width}}></td>; 
                                    })}
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
             </div>
        </div>
    );
};

export default Reports;