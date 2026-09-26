window.FinanceData=(()=>{
  const VERSION="3.4";
  const DEFAULT_CATEGORIES={
    "Pokok":["Sewa tempat tinggal","Token listrik","Iuran kebersihan kos","Transportasi","Makan","Laundry","Hutang","Kirim uang"],
    "Sekunder":["Jajan / self reward","Iuran kantor","Beli pakaian kerja","Beli / perbaiki jam tangan"],
    "Lain-lain":["Zakat","Infaq","Sodaqah"]
  };
  const STORAGE_KEY="financetrack_v3_2_db";
  const RETENTION_YEARS=3;
  const FUTURE_MONTHS=36;
  const pad=n=>String(n).padStart(2,"0");
  const toLocalDate=date=>{
    if(date instanceof Date)return new Date(date.getFullYear(),date.getMonth(),date.getDate());
    const s=String(date||"");
    if(/^\d{4}-\d{2}-\d{2}$/.test(s)){const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)}
    const d=new Date(date);return new Date(d.getFullYear(),d.getMonth(),d.getDate());
  };
  const dateKey=(date=new Date())=>{const d=toLocalDate(date);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
  const monthKey=(date=new Date())=>dateKey(date).slice(0,7);
  const parseMonth=key=>{const [y,m]=String(key).split("-").map(Number);return new Date(y,m-1,1)};
  const addMonths=(key,count)=>{const d=parseMonth(key);d.setMonth(d.getMonth()+count);return `${d.getFullYear()}-${pad(d.getMonth()+1)}`};
  const lastDayOfMonth=key=>{const d=parseMonth(key);d.setMonth(d.getMonth()+1,0);return dateKey(d)};
  const shiftYears=(date,years)=>{const d=toLocalDate(date);d.setFullYear(d.getFullYear()+years);return d};
  const retentionCutoff=(today=new Date())=>dateKey(shiftYears(today,-RETENTION_YEARS));
  const emptyMonth=key=>({key,income:0,incomes:[],savingTarget:0,budgets:{},expenses:[]});
  const createDefaultDB=()=>{
    const current=monthKey();
    const months={};
    for(let i=0;i<=FUTURE_MONTHS;i++){const k=addMonths(current,i);months[k]=emptyMonth(k)}
    return {version:VERSION,activeMonth:current,months,meta:{lastSystemMonth:current},settings:{userName:"",appName:"FinanceTrack",theme:"light",categories:structuredClone(DEFAULT_CATEGORIES),ledgerBaseBalance:0}};
  };
  return {VERSION,DEFAULT_CATEGORIES,STORAGE_KEY,RETENTION_YEARS,FUTURE_MONTHS,dateKey,monthKey,addMonths,lastDayOfMonth,retentionCutoff,emptyMonth,createDefaultDB};
})();