
import { AppData, Material, Transaction, SavedReport, AppSettings, Task } from '../types';
import { supabase } from './supabaseClient';

// --- In-Memory Cache (prevents redundant DB downloads) ---
interface CacheEntry {
    data: AppData;
    fetchedAt: number;
}
let _cache: CacheEntry | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const getCachedData = (): AppData | null => {
    if (_cache && (Date.now() - _cache.fetchedAt) < CACHE_TTL_MS) {
        return _cache.data;
    }
    return null;
};

export const setCacheData = (data: AppData): void => {
    _cache = { data, fetchedAt: Date.now() };
};

export const invalidateCache = (): void => {
    _cache = null;
};

// --- Default Data ---
const initialData: AppData = {
  materials: [],
  transactions: [],
  tasks: [],
  vendors: [],
  departments: [],
  groups: [],
  savedReports: [],
  lastAction: undefined,
  appSettings: {
      appName: 'InventoryMate',
      companyName: 'My Company',
      companyAddress: '',
      companyGst: '',
      currencySymbol: '₹',
      defaultGstRate: 18,
      defaultMinLevel: 5,
      enableNegativeStock: false,
      adminPassword: '1234',
      monthlyEssentials: [],
      monthlyRestockRecord: {},
      theme: 'default'
  }
};

const CHUNK_SIZE = 20; 
const MAX_ATTEMPTS = 10;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- Helper: Robust Chunked Upsert ---
export const chunkedUpsert = async (tableName: string, items: any[], onProgress?: (count: number) => void) => {
    if (!supabase || !items || items.length === 0) return;

    const totalChunks = Math.ceil(items.length / CHUNK_SIZE);
    let processedCount = 0;

    for (let i = 0; i < totalChunks; i++) {
        const chunk = items.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        let attempts = 0;
        let success = false;

        while (!success && attempts < MAX_ATTEMPTS) {
            try {
                const { error } = await supabase.from(tableName).upsert(chunk);
                if (error) throw new Error(error.message);
                success = true;
                processedCount += chunk.length;
                if (onProgress) onProgress(processedCount);
            } catch (err: any) {
                attempts++;
                const delay = Math.min(1000 * Math.pow(1.5, attempts), 10000);
                console.warn(`[${tableName}] Chunk ${i+1}/${totalChunks} failed (Attempt ${attempts}/${MAX_ATTEMPTS}). Retrying in ${delay}ms...`);
                if (attempts === MAX_ATTEMPTS) throw new Error(`${tableName} upload failed at chunk ${i+1}: ${err.message}`);
                await sleep(delay);
            }
        }
        await sleep(30); // Tiny breather
    }
};

// --- Helper: Fetch All Rows with Pagination ---
const fetchAllRows = async (tableName: string) => {
    if (!supabase) return [];
    
    let allRows: any[] = [];
    const pageSize = 1000;
    let from = 0;
    let to = pageSize - 1;
    let moreData = true;

    while (moreData) {
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .range(from, to);

        if (error) {
            console.error(`Error fetching ${tableName}:`, error);
            throw error;
        }

        if (data && data.length > 0) {
            allRows = [...allRows, ...data];
            from += pageSize;
            to += pageSize;
            if (data.length < pageSize) moreData = false;
        } else {
            moreData = false;
        }
    }
    return allRows;
};

// --- Core Data Access ---

export const getAppData = async (forceRefresh = false): Promise<AppData> => {
    if (!supabase) return initialData;

    // Return cached data if still fresh and not forced to refresh
    if (!forceRefresh) {
        const cached = getCachedData();
        if (cached) {
            console.log('[Cache] Serving data from in-memory cache (no DB fetch)');
            return cached;
        }
    }

    console.log('[Cache] Cache miss — fetching from Supabase...');
    try {
        const [materials, transactions, metaRes] = await Promise.all([
            fetchAllRows('materials'),
            fetchAllRows('transactions'),
            supabase.from('app_meta').select('data').eq('id', 1).single()
        ]);

        const meta = metaRes.data?.data || {};
        
        const data: AppData = {
            materials: materials || [],
            transactions: transactions || [],
            tasks: meta.tasks || [],
            vendors: meta.vendors || [],
            departments: meta.departments || [],
            groups: meta.groups || [],
            savedReports: meta.savedReports || [],
            appSettings: { ...initialData.appSettings, ...(meta.appSettings || {}) },
            lastAction: meta.lastAction
        };

        if (data.appSettings.theme === undefined) data.appSettings.theme = 'default';
        setCacheData(data);
        return data;
    } catch (e) {
        console.error("Supabase Load Error:", e);
        return initialData;
    }
};

export const updateMeta = async (data: AppData) => {
    if (!supabase) return;
    const metaPayload = {
        vendors: data.vendors,
        departments: data.departments,
        groups: data.groups,
        savedReports: data.savedReports,
        appSettings: data.appSettings,
        tasks: data.tasks,
        lastAction: data.lastAction
    };
    await supabase.from('app_meta').upsert({ id: 1, data: metaPayload });
    // Update cache with latest meta so next getAppData() doesn't re-fetch
    setCacheData(data);
};

// --- Propagation Helper ---
export const propagateItemCategorization = async (materialId: string, newGroup: string, newDept: string) => {
    if (!supabase) return;
    const data = await getAppData(); // Uses cache if available
    
    // 1. Update Material Record
    const matIndex = data.materials.findIndex(m => m.id === materialId);
    if (matIndex !== -1) {
        const updatedMat = { 
            ...data.materials[matIndex], 
            group: newGroup, 
            department: newDept 
        };
        await supabase.from('materials').update(updatedMat).eq('id', materialId);
    }

    // 2. Update Transactions
    // Propagate Group to ALL transactions
    // Propagate Dept only to PURCHASE (since ISSUE dept is the target destination)
    const affectedTxs = data.transactions.filter(t => t.materialId === materialId);
    if (affectedTxs.length > 0) {
        const updatedTxs = affectedTxs.map(t => ({
            ...t,
            group: newGroup,
            department: t.type === 'PURCHASE' ? newDept : t.department
        }));
        await chunkedUpsert('transactions', updatedTxs);
    }
};

// --- CRUD Operations (Supabase Wired) ---

export const saveAppData = async (data: AppData) => {
    if (!supabase) return;
    await updateMeta(data);
    await chunkedUpsert('materials', data.materials);
    await chunkedUpsert('transactions', data.transactions);
};

export const addTransactions = async (newTransactions: Transaction[]) => {
  if (!supabase || newTransactions.length === 0) return;
  const data = await getAppData(); // Uses cache — no extra DB download
  
  const potentialVendors = new Set<string>();
  const potentialDepts = new Set<string>();
  const potentialGroups = new Set<string>();
  newTransactions.forEach(t => {
      if (t.vendor) potentialVendors.add(t.vendor);
      if (t.department) potentialDepts.add(t.department);
      if (t.group) potentialGroups.add(t.group);
  });
  ensureMasterData(data, Array.from(potentialVendors), Array.from(potentialDepts), Array.from(potentialGroups));
  
  await chunkedUpsert('transactions', newTransactions);

  const affectedMatIds = Array.from(new Set(newTransactions.map(t => t.materialId)));
  data.transactions.push(...newTransactions);
  
  const matsToUpdate: Material[] = [];
  affectedMatIds.forEach(id => {
      recalculateMaterialState(id, data);
      const m = data.materials.find(mat => mat.id === id);
      if (m) matsToUpdate.push(m);
  });

  if (matsToUpdate.length > 0) {
      await chunkedUpsert('materials', matsToUpdate);
  }

  if (newTransactions.length > 0) {
      logLastAction(data, 'ADD', newTransactions[0].type === 'PURCHASE' ? `Bill: ${newTransactions[0].billNo}` : `Issue: ${newTransactions.length} Items`);
  }
  // updateMeta also updates the cache with the latest state
  await updateMeta(data);
};

export const addMaterial = async (material: Material) => {
  if (!supabase) return;
  await supabase.from('materials').insert(material);
  // Update cache directly instead of re-fetching from DB
  const data = await getAppData();
  data.materials.push(material);
  ensureMasterData(data, [], [material.department], [material.group]);
  await updateMeta(data);
  return material; 
};

export const updateMaterial = async (updatedMaterial: Material) => {
  if (!supabase) return;
  await supabase.from('materials').update(updatedMaterial).eq('id', updatedMaterial.id);
  // Update cache directly instead of re-fetching from DB
  const data = await getAppData();
  const idx = data.materials.findIndex(m => m.id === updatedMaterial.id);
  if (idx !== -1) data.materials[idx] = updatedMaterial;
  else data.materials.push(updatedMaterial);
  ensureMasterData(data, [], [updatedMaterial.department], [updatedMaterial.group]);
  await updateMeta(data);
};

export const updateTransaction = async (updatedTx: Transaction) => {
    if (!supabase) return;
    await supabase.from('transactions').update(updatedTx).eq('id', updatedTx.id);
    // Use cache — no extra DB download
    const data = await getAppData();
    const index = data.transactions.findIndex(t => t.id === updatedTx.id);
    if (index !== -1) data.transactions[index] = updatedTx;
    recalculateFIFOHistory(updatedTx.materialId, data);
    recalculateMaterialState(updatedTx.materialId, data);
    const mat = data.materials.find(m => m.id === updatedTx.materialId);
    if (mat) {
        await supabase.from('materials').update(mat).eq('id', mat.id);
        // Persist updated cache state
        setCacheData(data);
    }
};

export const deleteTransaction = async (transactionId: string) => {
    if (!supabase) return;
    const data = await getAppData(); // Uses cache
    const tx = data.transactions.find(t => t.id === transactionId);
    if (!tx) return;
    await supabase.from('transactions').delete().eq('id', transactionId);
    data.transactions = data.transactions.filter(t => t.id !== transactionId);
    recalculateFIFOHistory(tx.materialId, data);
    recalculateMaterialState(tx.materialId, data);
    const mat = data.materials.find(m => m.id === tx.materialId);
    if (mat) {
        await supabase.from('materials').update(mat).eq('id', mat.id);
        setCacheData(data);
    }
};

export const deleteBill = async (billNo: string, vendor: string) => {
    if (!supabase) return 0;
    const data = await getAppData();
    
    // 1. Identify transactions to delete
    const transactionsToDelete = data.transactions.filter(t => t.billNo === billNo && t.vendor === vendor);
    const toDeleteIds = transactionsToDelete.map(t => t.id);
    
    if (toDeleteIds.length === 0) return 0;

    // 2. Identify affected materials BEFORE deleting (so we know who to update)
    const affectedMaterialIds: string[] = Array.from(new Set(transactionsToDelete.map(t => t.materialId)));

    // 3. Delete transactions from DB
    await supabase.from('transactions').delete().in('id', toDeleteIds);

    // 4. Update local state to reflect deletion immediately for calculation
    data.transactions = data.transactions.filter(t => !toDeleteIds.includes(t.id));

    // 5. Recalculate and Update Materials
    const materialsToUpdate: Material[] = [];
    
    for (const matId of affectedMaterialIds) {
        // Recalculate based on remaining transactions
        recalculateFIFOHistory(matId, data);
        recalculateMaterialState(matId, data);
        
        const updatedMat = data.materials.find(m => m.id === matId);
        if (updatedMat) {
            materialsToUpdate.push(updatedMat);
        }
    }

    if (materialsToUpdate.length > 0) {
        await chunkedUpsert('materials', materialsToUpdate);
    }

    return toDeleteIds.length;
};

const sortTransactionsDeterministic = (txs: Transaction[]) => {
    return txs.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        
        const getScore = (t: Transaction) => (t.type === 'PURCHASE' || (t.type === 'ADJUSTMENT' && (t.quantity || 0) > 0)) ? 0 : 1;
        const scoreA = getScore(a);
        const scoreB = getScore(b);
        if (scoreA !== scoreB) return scoreA - scoreB;
        
        return String(a.id || '').localeCompare(String(b.id || ''));
    });
};

export const calculateBatches = (materialId: string, data: AppData) => {
    const matTrans = data.transactions.filter(t => t.materialId === materialId);
    const totalOut = matTrans.reduce((acc, t) => {
        if (t.type === 'ISSUE') return acc + t.quantity;
        if (t.type === 'ADJUSTMENT' && t.quantity < 0) return acc + Math.abs(t.quantity);
        return acc;
    }, 0);
    const inflows = matTrans.filter(t => t.type === 'PURCHASE' || (t.type === 'ADJUSTMENT' && t.quantity > 0));
    sortTransactionsDeterministic(inflows);
    let consumedSoFar = totalOut;
    const availableBatches: any[] = [];
    inflows.forEach(p => {
        if (consumedSoFar >= p.quantity) consumedSoFar -= p.quantity;
        else {
            const remaining = p.quantity - consumedSoFar;
            consumedSoFar = 0;
            if (remaining > 0.0001) {
                // ROBUSTNESS FIX: Calculate effective rate if stored rate is 0 but totalValue exists.
                // This handles cases where rate was lost or not set, preventing 0-value re-issues.
                let effectiveRate = p.avgRate || p.rate;
                if ((!effectiveRate || effectiveRate === 0) && p.totalValue > 0 && p.quantity > 0) {
                    const basicVal = p.totalValue - (p.gstAmount || 0);
                    effectiveRate = basicVal / p.quantity;
                }
                
                availableBatches.push({ 
                    ...p, 
                    remainingQty: remaining,
                    rate: p.rate || effectiveRate,
                    avgRate: p.avgRate || effectiveRate 
                });
            }
        }
    });
    return availableBatches;
};

const recalculateFIFOHistory = (materialId: string, data: AppData) => {
    const txs = data.transactions.filter(t => t.materialId === materialId);
    sortTransactionsDeterministic(txs);
    let inventory: { qty: number, rate: number, val: number }[] = [];
    let negativeBacklog: { txId: string, qtyNeeded: number }[] = [];
    txs.forEach(t => {
        if (t.type === 'PURCHASE' || (t.type === 'ADJUSTMENT' && t.quantity > 0)) {
            let rate = t.rate;
            let totalBasicValue = t.totalValue;
            
            // Recalculate rate from Total Value if available (Source of Truth)
            if (t.totalValue > 0 && t.quantity > 0) {
                 const basicVal = t.totalValue - (t.gstAmount || 0);
                 rate = basicVal / t.quantity; 
                 totalBasicValue = basicVal;
                 // Self-heal the transaction object in memory
                 t.rate = rate; 
                 t.avgRate = rate;
            }
            
            let remainingQty = t.quantity;
            let remainingVal = totalBasicValue;
            while (negativeBacklog.length > 0 && remainingQty > 0.000001) {
                const debt = negativeBacklog[0];
                let fill = 0;
                let valueToAdd = 0;
                if (debt.qtyNeeded <= remainingQty + 0.000001) {
                    fill = debt.qtyNeeded;
                    valueToAdd = (Math.abs(fill - remainingQty) < 0.000001) ? remainingVal : fill * rate;
                    negativeBacklog.shift(); 
                } else {
                    fill = remainingQty;
                    valueToAdd = remainingVal; 
                    debt.qtyNeeded -= fill;
                }
                const issueTx = data.transactions.find(x => x.id === debt.txId);
                if (issueTx) {
                    issueTx.totalValue = (issueTx.totalValue || 0) + valueToAdd;
                    if (issueTx.quantity > 0) issueTx.rate = issueTx.totalValue / issueTx.quantity; 
                }
                remainingQty -= fill;
                remainingVal -= valueToAdd;
            }
            if (remainingQty > 0.000001) inventory.push({ qty: remainingQty, rate: rate, val: remainingVal });
        } else if (t.type === 'ISSUE' || (t.type === 'ADJUSTMENT' && t.quantity < 0)) {
            let needed = Math.abs(t.quantity);
            let totalCost = 0;
            t.totalValue = 0; 
            while (needed > 0.000001 && inventory.length > 0) {
                const batch = inventory[0];
                let take = 0; let cost = 0;
                if (batch.qty <= needed + 0.000001) {
                    take = batch.qty; cost = batch.val; inventory.shift();
                } else {
                    take = needed; cost = take * batch.rate; batch.qty -= take; batch.val -= cost;
                }
                totalCost += cost; needed -= take;
            }
            t.totalValue += totalCost;
            if (needed > 0.000001) negativeBacklog.push({ txId: t.id, qtyNeeded: needed });
            if (t.quantity > 0) t.rate = t.totalValue / t.quantity; 
        }
    });
};

export const recalculateMaterialState = (materialId: string, data: AppData) => {
    const matIndex = data.materials.findIndex(m => m.id === materialId);
    if (matIndex === -1) return;
    const mat = data.materials[matIndex];
    const batches = calculateBatches(materialId, data);
    let totalStock = 0; let totalValue = 0;
    batches.forEach(b => {
        totalStock += b.remainingQty;
        // Use robust rate logic
        let batchRate = b.avgRate || b.rate;
        if ((!batchRate || batchRate === 0) && b.totalValue > 0 && b.quantity > 0) {
             const basicVal = b.totalValue - (b.gstAmount || 0);
             batchRate = basicVal / b.quantity;
        }
        totalValue += b.remainingQty * batchRate;
    });
    const allTx = data.transactions.filter(t => t.materialId === materialId);
    const actualStock = allTx.reduce((acc, t) => {
        if (t.type === 'PURCHASE') return acc + t.quantity;
        if (t.type === 'ISSUE') return acc - t.quantity;
        if (t.type === 'ADJUSTMENT') return acc + t.quantity;
        return acc;
    }, 0);
    mat.currentStock = parseFloat(actualStock.toFixed(4));
    if (mat.currentStock < 0) {
        const lastTx = allTx.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        mat.pricePerUnit = lastTx?.rate || mat.pricePerUnit || 0;
    } else if (mat.currentStock > 0 && totalStock > 0) mat.pricePerUnit = totalValue / totalStock;
    else mat.pricePerUnit = 0;
    data.materials[matIndex] = mat;
};

export const ensureMasterData = (data: AppData, newVendors: string[], newDepts: string[], newGroups: string[]) => {
    let changed = false;
    newVendors.forEach(v => { if (v && !data.vendors.some(ev => ev.toLowerCase() === v.toLowerCase())) { data.vendors.push(v); changed = true; } });
    newDepts.forEach(d => { if (d && !data.departments.some(ed => ed.toLowerCase() === d.toLowerCase())) { data.departments.push(d); changed = true; } });
    newGroups.forEach(g => { if (g && !data.groups.some(eg => eg.toLowerCase() === g.toLowerCase())) { data.groups.push(g); changed = true; } });
    if (changed) { data.vendors.sort(); data.departments.sort(); data.groups.sort(); }
    return changed;
};

export const resetAppData = async () => {
    if (!supabase) return;
    await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000'); 
    await supabase.from('materials').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const emptyMeta = { vendors: [], departments: [], groups: [], savedReports: [], tasks: [], lastAction: null };
    await supabase.from('app_meta').update({ data: emptyMeta }).eq('id', 1);
    // Clear cache after reset so fresh data is fetched
    invalidateCache();
};

const logLastAction = (data: AppData, type: 'ADD' | 'EDIT' | 'DELETE' | 'IMPORT' | 'SETTINGS', description: string) => {
    data.lastAction = { type, description, timestamp: new Date().toISOString() };
};

export const updateDashboardTasks = async (tasks: Task[]) => { const data = await getAppData(); data.tasks = tasks; await updateMeta(data); };
export const updateAppSettings = async (settings: AppSettings) => { const data = await getAppData(); data.appSettings = settings; await updateMeta(data); };
export const toggleMonthlyEssentialStatus = async (materialId: string, isDone: boolean) => { const data = await getAppData(); const currentMonth = new Date().toISOString().slice(0, 7); if (!data.appSettings.monthlyRestockRecord) data.appSettings.monthlyRestockRecord = {}; if (isDone) data.appSettings.monthlyRestockRecord[materialId] = currentMonth; else delete data.appSettings.monthlyRestockRecord[materialId]; await updateMeta(data); };
export const vacuumMasterData = async () => { 
    const data = await getAppData(); 
    // Basic vacuum logic
    await updateMeta(data); 
    return 0; 
};
export const recalculateAllStock = async () => { const data = await getAppData(); let count = 0; data.materials.forEach(m => { recalculateFIFOHistory(m.id, data); recalculateMaterialState(m.id, data); count++; }); if (data.materials.length > 0) await chunkedUpsert('materials', data.materials); return count; };
export const migrateLegacyItemsToStrictIds = async () => { return { splitCount: 0, newMaterialsCount: 0 }; };
export const smartUpdateSingleTransaction = updateTransaction;
export const bulkUpdateMaterials = async (ids: string[], updates: Partial<Material>) => { if (!supabase) return; await supabase.from('materials').update(updates).in('id', ids); };
export const saveEditedBill = async (originalBillNo: string, originalVendor: string, header: any, rows: Transaction[]) => { await deleteBill(originalBillNo, originalVendor); await addTransactions(rows); };

// --- Master Data Operations ---

export const renameMasterEntry = async (type: 'GROUP' | 'DEPARTMENT' | 'VENDOR' | 'ITEM' | 'UOM', oldName: string, newName: string) => {
    if (!supabase || !oldName || !newName || oldName === newName) return;
    const data = await getAppData();
    const oldClean = oldName.trim().toLowerCase();

    // 1. Transactions Update
    const txField = type === 'GROUP' ? 'group' : type === 'DEPARTMENT' ? 'department' : type === 'VENDOR' ? 'vendor' : type === 'ITEM' ? 'materialName' : null;
    if (txField) {
        const txsToUpdate = data.transactions
            .filter(t => ((t as any)[txField] || '').trim().toLowerCase() === oldClean)
            .map(t => ({ ...t, [txField]: newName }));
        if (txsToUpdate.length > 0) await chunkedUpsert('transactions', txsToUpdate);
    }

    // 2. Materials Update
    const matField = type === 'GROUP' ? 'group' : type === 'DEPARTMENT' ? 'department' : type === 'ITEM' ? 'name' : type === 'UOM' ? 'unit' : null;
    if (matField) {
        const matsToUpdate = data.materials
            .filter(m => ((m as any)[matField] || '').trim().toLowerCase() === oldClean)
            .map(m => ({ ...m, [matField]: newName }));
        if (matsToUpdate.length > 0) await chunkedUpsert('materials', matsToUpdate);
    }

    // 3. Meta List Update
    const listKey = type === 'GROUP' ? 'groups' : type === 'DEPARTMENT' ? 'departments' : type === 'VENDOR' ? 'vendors' : null;
    if (listKey) {
        data[listKey] = Array.from(new Set(data[listKey].map(i => i.trim().toLowerCase() === oldClean ? newName : i))).sort();
    }

    await updateMeta(data);
};

export const deleteMasterEntry = async (type: 'GROUP' | 'DEPARTMENT' | 'VENDOR', name: string) => {
    if (!supabase || !name) return;
    const data = await getAppData();
    const cleanName = name.trim().toLowerCase();
    
    const txField = type === 'GROUP' ? 'group' : type === 'DEPARTMENT' ? 'department' : 'vendor';
    const txsToScrub = data.transactions
        .filter(t => ((t as any)[txField] || '').trim().toLowerCase() === cleanName)
        .map(t => ({ ...t, [txField]: '' }));
    
    if (txsToScrub.length > 0) await chunkedUpsert('transactions', txsToScrub);

    if (type !== 'VENDOR') {
        const matField = type === 'GROUP' ? 'group' : 'department';
        const matsToScrub = data.materials
            .filter(m => ((m as any)[matField] || '').trim().toLowerCase() === cleanName)
            .map(m => ({ ...m, [matField]: '' }));
        if (matsToScrub.length > 0) await chunkedUpsert('materials', matsToScrub);
    }

    const listKey = type === 'GROUP' ? 'groups' : type === 'DEPARTMENT' ? 'departments' : 'vendors';
    data[listKey] = data[listKey].filter(i => i.trim().toLowerCase() !== cleanName);
    
    await updateMeta(data);
};

export const mergeMasterEntries = async (type: string, variants: string[], master: string) => {
    if (!supabase || variants.length === 0) return;
    const data = await getAppData();
    
    const txsToUpdate: Transaction[] = [];
    const matsToUpdate: Material[] = [];
    const variantsSet = new Set(variants.map(v => v.trim().toLowerCase()));

    // 1. Transactions Update
    const txField = type === 'GROUP' ? 'group' : type === 'DEPARTMENT' ? 'department' : type === 'VENDOR' ? 'vendor' : type === 'ITEM' ? 'materialName' : null;
    if (txField) {
        data.transactions.forEach(t => {
            // Safe access using dynamic key if needed, though txField is known key of Transaction
            // Casting to any to allow dynamic key access safely in this context
            const val = (t as any)[txField];
            if (val && variantsSet.has(val.trim().toLowerCase())) {
                (t as any)[txField] = master;
                txsToUpdate.push(t);
            }
        });
    }

    // 2. Materials Update
    const matField = type === 'GROUP' ? 'group' : type === 'DEPARTMENT' ? 'department' : type === 'ITEM' ? 'name' : type === 'UOM' ? 'unit' : null;
    if (matField) {
        data.materials.forEach(m => {
            const val = (m as any)[matField];
            if (val && variantsSet.has(val.trim().toLowerCase())) {
                (m as any)[matField] = master;
                matsToUpdate.push(m);
            }
        });
    }

    // 3. Meta List Update
    const listKey = type === 'GROUP' ? 'groups' : type === 'DEPARTMENT' ? 'departments' : type === 'VENDOR' ? 'vendors' : null;
    if (listKey) {
        data[listKey] = Array.from(new Set(data[listKey].map(i => variantsSet.has(i.trim().toLowerCase()) ? master : i))).sort();
    }

    // Save All
    if (txsToUpdate.length > 0) await chunkedUpsert('transactions', txsToUpdate);
    if (matsToUpdate.length > 0) await chunkedUpsert('materials', matsToUpdate);
    await updateMeta(data);
};

export const saveReportConfiguration = async (r: SavedReport) => { const d = await getAppData(); d.savedReports.push(r); await updateMeta(d); };
export const deleteReportConfiguration = async (id: string) => { const d = await getAppData(); d.savedReports = d.savedReports.filter(x=>x.id!==id); await updateMeta(d); };
export const repairMaterialTransactionValues = async (id: string) => { const data = await getAppData(); recalculateFIFOHistory(id, data); recalculateMaterialState(id, data); const m = data.materials.find(x=>x.id===id); if (m) await supabase?.from('materials').update(m).eq('id', id); };
