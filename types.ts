
export type TransactionType = 'PURCHASE' | 'ISSUE' | 'ADJUSTMENT';

export interface Material {
  id: string;
  name: string;
  group: string; // e.g., Hardware, Chemicals
  department: string; // The department this material belongs to (e.g., Maintenance Store)
  unit: string; // e.g., Kg, Ltr, Pcs
  currentStock: number;
  location: string; // e.g., Rack A1
  pricePerUnit: number; // Weighted Average Price
  hsn?: string;
  description?: string;
  gstRate?: number;
  lastVerified?: string; // ISO Date string of last physical stock check
  minLevel?: number; // Reorder Level
}

export interface Transaction {
  id: string;
  type: TransactionType;
  date: string; // ISO Date string
  materialId: string;
  materialName: string;
  quantity: number;
  
  // Value fields
  rate: number; // Unit Rate
  totalValue: number; // Final value after tax/disc
  
  // Purchase Specific Fields
  billNo?: string;
  billDate?: string;
  grnNo?: string;
  grnDate?: string;
  mrnNo?: string;
  mrnDate?: string;
  vendor?: string;
  gstNo?: string;
  
  // Item specifics in a bill
  hsn?: string;
  discount?: number;
  freight?: number;
  gstRate?: number;
  gstAmount?: number;
  avgRate?: number; // (Rate - Disc + Freight) / Qty roughly
  
  // Issue Specific
  department?: string; // The department associated with the material
  group?: string; // Allow overriding Group per transaction (e.g. Purchase for General vs Maintenance)
  issuedTo?: string; // (Optional) If you want to track who took it, currently we use 'department' as the material owner
  
  location?: string; // Storage location for this specific batch
  
  remarks?: string;
}

export interface ReportFilter {
    field: string;
    operator: 'equals' | 'contains' | 'greater' | 'less';
    value: string;
}

export interface SavedReport {
    id: string;
    name: string;
    filters: ReportFilter[];
    columns: string[];
}

export interface Task {
    id: string;
    text: string;
    done: boolean;
}

export interface LastAction {
    type: 'ADD' | 'EDIT' | 'DELETE' | 'IMPORT' | 'SETTINGS';
    description: string;
    timestamp: string;
    user?: string;
}

export interface AppSettings {
    appName: string;
    companyName: string;
    companyAddress: string; 
    companyGst: string;
    currencySymbol: string;
    defaultGstRate: number;
    defaultMinLevel: number;
    enableNegativeStock: boolean;
    adminPassword: string;
    monthlyEssentials: string[];
    monthlyRestockRecord: Record<string, string>;
    theme: 'default' | 'midnight' | 'forest' | 'light'; // Added theme support
}

export interface AppData {
  materials: Material[];
  transactions: Transaction[];
  tasks: Task[]; // Added Tasks here so they persist in Backup/Restore
  // Master Data Lists
  vendors: string[];
  departments: string[];
  groups: string[];
  savedReports: SavedReport[];
  appSettings: AppSettings;
  lastAction?: LastAction; // New field
}

export type ViewName = 'DASHBOARD' | 'PURCHASE' | 'ISSUE' | 'STOCK_REGISTER' | 'MRN_REGISTER' | 'ISSUE_REGISTER' | 'STOCK_TAKING' | 'REPORTS' | 'BULK_IMPORT' | 'SETTINGS' | 'MASTER_DATA' | 'WORK_AREA' | 'ABOUT';

// Default seeds (used if data is empty)
export const DEFAULT_DEPARTMENTS = ['Production', 'Maintenance', 'Electrical', 'Civil', 'Admin', 'Stores', 'Quality', 'Packing', 'Mechanical'];
export const DEFAULT_GROUPS = ['Raw Material', 'Consumables', 'Hardware', 'Electronics', 'Packaging', 'Spares', 'Fuel', 'CAPITAL', 'MAINT'];

export const DEPARTMENTS = DEFAULT_DEPARTMENTS;
export const MATERIAL_GROUPS = DEFAULT_GROUPS;
