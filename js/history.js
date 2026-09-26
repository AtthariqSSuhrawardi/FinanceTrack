window.FinanceHistory=(()=>{
  const $=id=>document.getElementById(id);
  function render(){
    const d=FinanceStorage.getDB(),rows=Object.values(d.months).sort((a,b)=>b.key.localeCompare(a.key));
    $("historyTableBody").innerHTML=rows.map(m=>{const t=FinanceStorage.monthTotals(m.key),i=FinanceDashboard.statusInfo(m);return `<tr><td><strong>${FinanceApp.monthLabel(m.key)}</strong></td><td>${FinanceApp.formatCurrency(t.income)}</td><td>${FinanceApp.formatCurrency(t.expense)}</td><td class="${t.balance<0?"negative":"positive"}">${FinanceApp.formatCurrency(t.balance)}</td><td>${FinanceApp.formatCurrency(m.savingTarget)}</td><td><span class="status-pill">${i.label}</span></td></tr>`}).join("")||`<tr><td colspan="6" class="empty-state">Belum ada bulan.</td></tr>`;
  }
  function createMonth(){FinanceStorage.save();FinanceApp.refresh();FinanceApp.toast("Kalender 3 tahun FinanceTrack sudah disinkronkan otomatis.")}
  return {render,createMonth};
})();