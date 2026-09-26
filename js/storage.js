window.FinanceStorage=(()=>{
  let db=null;
  const isDateKey=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||""));
  const isMonthKey=v=>/^\d{4}-(0[1-9]|1[0-2])$/.test(String(v||""));
  const id=()=>crypto?.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const sum=arr=>arr.reduce((s,x)=>s+Number(x.amount||0),0);

  function load(){
    try{const raw=localStorage.getItem(FinanceData.STORAGE_KEY);db=raw?JSON.parse(raw):null}catch(e){db=null}
    if(!db){
      const old=localStorage.getItem("financetrack_v3_1_db");
      try{db=old?JSON.parse(old):FinanceData.createDefaultDB()}catch(e){db=FinanceData.createDefaultDB()}
    }
    normalize();save();return db;
  }

  function migrateMonth(m){
    if(!m||typeof m!=="object")return FinanceData.emptyMonth(FinanceData.monthKey());
    if(!isMonthKey(m.key))m.key=FinanceData.monthKey();
    m.savingTarget=Number(m.savingTarget)||0;
    if(!m.budgets||typeof m.budgets!=="object")m.budgets={};
    if(!Array.isArray(m.expenses))m.expenses=[];
    if(!Array.isArray(m.incomes)){
      m.incomes=[];
      const legacy=Number(m.income)||0;
      if(legacy>0)m.incomes.push({id:id(),date:FinanceData.lastDayOfMonth(m.key),amount:legacy,source:"Pemasukan lama",note:"Data pemasukan dimigrasikan dari versi sebelumnya."});
    }
    m.incomes=m.incomes.map(x=>({id:x.id||id(),date:isDateKey(x.date)?x.date:FinanceData.lastDayOfMonth(m.key),amount:Number(x.amount)||0,source:String(x.source||"Pemasukan"),note:String(x.note||"")})).filter(x=>x.amount>0);
    m.expenses=m.expenses.map(x=>({id:x.id||id(),date:isDateKey(x.date)?x.date:FinanceData.lastDayOfMonth(m.key),group:String(x.group||"Lain-lain"),category:String(x.category||"Lain-lain"),amount:Number(x.amount)||0,note:String(x.note||"")})).filter(x=>x.amount>0);
    m.income=sum(m.incomes);
    return m;
  }

  function normalize(){
    if(!db||typeof db!=="object")db=FinanceData.createDefaultDB();
    if(!db.months||typeof db.months!=="object")db.months={};
    if(!db.settings||typeof db.settings!=="object")db.settings={};
    db.settings={userName:"",appName:"FinanceTrack",theme:"light",ledgerBaseBalance:0,...db.settings};
    if(!db.settings.categories||typeof db.settings.categories!=="object")db.settings.categories=structuredClone(FinanceData.DEFAULT_CATEGORIES);
    if(!Object.keys(db.settings.categories).length)db.settings.categories=structuredClone(FinanceData.DEFAULT_CATEGORIES);
    db.meta={lastSystemMonth:"",...(db.meta||{})};

    // Migrate legacy monthly records first, then place every transaction in the month
    // dictated by its own date. This also repairs older versions that could store an
    // October transaction inside the September month selected by the user.
    const sourceMonths=Object.keys(db.months).map(k=>migrateMonth({...db.months[k],key:k}));
    const normalizedMonths={};
    sourceMonths.forEach(source=>{
      if(!normalizedMonths[source.key])normalizedMonths[source.key]=FinanceData.emptyMonth(source.key);
      const target=normalizedMonths[source.key];
      target.savingTarget=Number(source.savingTarget)||0;
      target.budgets={...(target.budgets||{}),...(source.budgets||{})};
      source.incomes.forEach(x=>{const k=FinanceData.monthKey(x.date);if(!normalizedMonths[k])normalizedMonths[k]=FinanceData.emptyMonth(k);normalizedMonths[k].incomes.push(x)});
      source.expenses.forEach(x=>{const k=FinanceData.monthKey(x.date);if(!normalizedMonths[k])normalizedMonths[k]=FinanceData.emptyMonth(k);normalizedMonths[k].expenses.push(x)});
    });
    db.months=normalizedMonths;

    const today=new Date();
    const current=FinanceData.monthKey(today);
    const cutoff=FinanceData.retentionCutoff(today);
    let base=Number(db.settings.ledgerBaseBalance)||0;

    // Purge transactions exactly after their three-year retention window.
    Object.keys(db.months).forEach(k=>{
      const m=db.months[k];
      const keptExpenses=[];
      m.expenses.forEach(x=>{if(x.date<cutoff)base-=Number(x.amount)||0;else keptExpenses.push(x)});
      const keptIncomes=[];
      m.incomes.forEach(x=>{if(x.date<cutoff)base+=Number(x.amount)||0;else keptIncomes.push(x)});
      m.expenses=keptExpenses;m.incomes=keptIncomes;m.income=sum(m.incomes);
    });
    db.settings.ledgerBaseBalance=base;

    // Keep history for the last three years, and pre-create the next three years.
    const start=FinanceData.addMonths(current,-FinanceData.RETENTION_YEARS*12);
    const end=FinanceData.addMonths(current,FinanceData.FUTURE_MONTHS);
    Object.keys(db.months).forEach(k=>{if(k<start||k>end)delete db.months[k]});
    for(let i=0;i<=FinanceData.FUTURE_MONTHS;i++){
      const k=FinanceData.addMonths(current,i);
      if(!db.months[k])db.months[k]=FinanceData.emptyMonth(k);
    }

    // The application automatically follows the real calendar when a new month begins.
    if(db.meta.lastSystemMonth!==current){db.activeMonth=current;db.meta.lastSystemMonth=current}
    if(!db.activeMonth||!db.months[db.activeMonth])db.activeMonth=current;

    Object.values(db.months).forEach(m=>{
      Object.keys(db.settings.categories).forEach(g=>(db.settings.categories[g]||[]).forEach(c=>{if(typeof m.budgets[c]!=="number")m.budgets[c]=Number(m.budgets[c])||0}));
      m.income=sum(m.incomes);
    });
    db.version=FinanceData.VERSION;
  }
  function save(){normalize();localStorage.setItem(FinanceData.STORAGE_KEY,JSON.stringify(db))}
  function getDB(){return db||load()}
  function getMonth(key=getDB().activeMonth){const d=getDB();if(!d.months[key]){d.months[key]=FinanceData.emptyMonth(key);save()}return d.months[key]}
  function setActiveMonth(key){const d=getDB();if(!d.months[key])return false;d.activeMonth=key;save();return true}
  function monthTotals(key=getDB().activeMonth){
    const d=getDB(),m=getMonth(key),income=sum(m.incomes),expense=sum(m.expenses);
    let opening=Number(d.settings.ledgerBaseBalance)||0;
    Object.keys(d.months).filter(k=>k<key).sort().forEach(k=>{const x=d.months[k];opening+=sum(x.incomes)-sum(x.expenses)});
    return {income,expense,net:income-expense,opening,balance:opening+income-expense};
  }
  function findIncome(idValue){const d=getDB();for(const [key,m] of Object.entries(d.months)){const x=m.incomes.find(v=>v.id===idValue);if(x)return{key,month:m,item:x}}return null}
  function addIncome(item){const d=getDB(),key=FinanceData.monthKey(item.date),m=getMonth(key);m.incomes.push({...item,id:item.id||id(),amount:Number(item.amount)||0});m.income=sum(m.incomes);save();return item.id}
  function updateIncome(oldId,item){const found=findIncome(oldId);if(!found)return false;const targetKey=FinanceData.monthKey(item.date);if(found.key===targetKey){Object.assign(found.item,item,{id:oldId,amount:Number(item.amount)||0});found.month.income=sum(found.month.incomes)}else{found.month.incomes=found.month.incomes.filter(x=>x.id!==oldId);found.month.income=sum(found.month.incomes);getMonth(targetKey).incomes.push({...item,id:oldId,amount:Number(item.amount)||0});getMonth(targetKey).income=sum(getMonth(targetKey).incomes)}save();return true}
  function deleteIncome(idValue){const found=findIncome(idValue);if(!found)return false;found.month.incomes=found.month.incomes.filter(x=>x.id!==idValue);found.month.income=sum(found.month.incomes);save();return true}
  function listIncomes(key=getDB().activeMonth){return [...getMonth(key).incomes].sort((a,b)=>b.date.localeCompare(a.date)||String(b.id).localeCompare(String(a.id)))}
  function findExpense(idValue){const d=getDB();for(const [key,m] of Object.entries(d.months)){const x=m.expenses.find(v=>v.id===idValue);if(x)return{key,month:m,item:x}}return null}
  function addExpense(item){const key=FinanceData.monthKey(item.date);const m=getMonth(key);m.expenses.push({...item,amount:Number(item.amount)||0});save();return item.id}
  function updateExpense(oldId,item){const found=findExpense(oldId);if(!found)return false;const targetKey=FinanceData.monthKey(item.date);if(found.key===targetKey){Object.assign(found.item,item,{id:oldId,amount:Number(item.amount)||0})}else{found.month.expenses=found.month.expenses.filter(x=>x.id!==oldId);getMonth(targetKey).expenses.push({...item,id:oldId,amount:Number(item.amount)||0})}save();return true}
  function deleteExpense(idValue){const found=findExpense(idValue);if(!found)return false;found.month.expenses=found.month.expenses.filter(x=>x.id!==idValue);save();return true}
  function reset(){db=FinanceData.createDefaultDB();save()}
  return {load,save,getDB,getMonth,setActiveMonth,reset,monthTotals,listIncomes,findIncome,addIncome,updateIncome,deleteIncome,findExpense,addExpense,updateExpense,deleteExpense};
})();