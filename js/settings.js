window.FinanceSettings=(()=>{
  const $=id=>document.getElementById(id);
  function render(){const d=FinanceStorage.getDB(),s=d.settings;$("userNameInput").value=s.userName||"";$("appNameInput").value=s.appName||"FinanceTrack";$("brandName").textContent=s.appName||"FinanceTrack";document.title=`${s.appName||"FinanceTrack"} v3.2`;renderCategories()}
  function save(){const d=FinanceStorage.getDB();d.settings.userName=$("userNameInput").value.trim();d.settings.appName=$("appNameInput").value.trim()||"FinanceTrack";FinanceStorage.save();render();FinanceApp.refresh();FinanceApp.toast("Pengaturan disimpan.")}
  function backup(){const blob=new Blob([JSON.stringify(FinanceStorage.getDB(),null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`FinanceTrack-backup-${FinanceStorage.getDB().activeMonth}.json`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
  function restore(file){const r=new FileReader();r.onload=()=>{try{const data=JSON.parse(r.result);if(!data.months||!data.settings)throw Error();localStorage.setItem(FinanceData.STORAGE_KEY,JSON.stringify(data));FinanceStorage.load();FinanceApp.refresh();FinanceApp.toast("Backup berhasil dipulihkan.")}catch(e){FinanceApp.toast("File backup tidak valid.")}};r.readAsText(file)}
  function reset(){if(!confirm("Yakin ingin menghapus seluruh data FinanceTrack di browser ini?"))return;FinanceStorage.reset();FinanceApp.refresh();FinanceApp.toast("Seluruh data telah direset.")}
  function theme(){const dark=document.body.classList.toggle("dark"),d=FinanceStorage.getDB();d.settings.theme=dark?"dark":"light";FinanceStorage.save();$("themeToggle").innerHTML=dark?"☀️ <span>Mode Terang</span>":"🌙 <span>Mode Gelap</span>"}
  function applyTheme(){const dark=FinanceStorage.getDB().settings.theme==="dark";document.body.classList.toggle("dark",dark);$("themeToggle").innerHTML=dark?"☀️ <span>Mode Terang</span>":"🌙 <span>Mode Gelap</span>"}

  function openModal(type,parent="",old=""){
    const d=FinanceStorage.getDB(),groups=Object.keys(d.settings.categories);
    $("categoryEditType").value=type;$("categoryOldName").value=old;$("categoryParentGroup").value=parent;
    $("categoryModalTitle").textContent=type==="group"?(old?"Edit Kelompok":"Tambah Kelompok"):(old?"Edit Sub-Kategori":"Tambah Sub-Kategori");
    $("categoryNameInput").value=old||"";
    $("categoryGroupField").classList.toggle("hidden",type==="group");
    if(type==="subcategory"){
      $("categoryParentSelect").innerHTML=groups.map(g=>`<option value="${FinanceApp.escapeAttr(g)}">${FinanceApp.escapeHtml(g)}</option>`).join("");
      $("categoryParentSelect").value=parent;
    }
    $("categoryModal").classList.remove("hidden");setTimeout(()=>$("categoryNameInput").focus(),50);
  }
  function closeModal(){$("categoryModal").classList.add("hidden")}
  function renderCategories(){
    const cats=FinanceStorage.getDB().settings.categories;
    $("categoryManager").innerHTML=Object.entries(cats).map(([group,items])=>`
      <div class="category-card">
        <div class="category-card-head"><div><div class="category-title">${FinanceApp.escapeHtml(group)}</div><div class="muted">${items.length} sub-kategori</div></div>
        <div class="manager-actions"><button class="secondary-button small-button" data-edit-group="${FinanceApp.escapeAttr(group)}">✎ Edit Judul</button><button class="danger-button small-button" data-delete-group="${FinanceApp.escapeAttr(group)}">Hapus</button><button class="primary-button small-button" data-add-sub="${FinanceApp.escapeAttr(group)}">＋ Sub-kategori</button></div></div>
        <div class="category-sublist">${items.length?items.map(c=>`<div class="subcategory-row"><span class="subcategory-name">${FinanceApp.escapeHtml(c)}</span><div class="manager-actions"><button class="secondary-button small-button" data-edit-sub="${FinanceApp.escapeAttr(group)}" data-old-sub="${FinanceApp.escapeAttr(c)}">✎ Edit</button><button class="danger-button small-button" data-delete-sub="${FinanceApp.escapeAttr(group)}" data-old-sub="${FinanceApp.escapeAttr(c)}">Hapus</button></div></div>`).join(""):`<div class="empty-mini">Belum ada sub-kategori.</div>`}</div>
      </div>`).join("")||`<div class="empty-state">Belum ada kelompok. Tambahkan kelompok pertama Anda.</div>`;
  }

  function renameGroup(oldName,newName){
    const d=FinanceStorage.getDB(),cats=d.settings.categories;
    if(!newName||newName===oldName)return closeModal();
    if(cats[newName])return FinanceApp.toast("Nama kelompok sudah digunakan.");
    cats[newName]=cats[oldName];delete cats[oldName];
    Object.values(d.months).forEach(m=>m.expenses.forEach(e=>{if(e.group===oldName)e.group=newName}));
    FinanceStorage.save();closeModal();FinanceApp.refresh();FinanceApp.toast("Judul kelompok berhasil diubah.");
  }
  function renameSub(group,oldName,newName){
    const d=FinanceStorage.getDB(),cats=d.settings.categories,items=cats[group]||[];
    if(!newName||newName===oldName)return closeModal();
    if(items.includes(newName))return FinanceApp.toast("Nama sub-kategori sudah digunakan pada kelompok ini.");
    const idx=items.indexOf(oldName);if(idx<0)return;
    items[idx]=newName;
    Object.values(d.months).forEach(m=>{if(Object.prototype.hasOwnProperty.call(m.budgets,oldName)){m.budgets[newName]=m.budgets[oldName];delete m.budgets[oldName]}m.expenses.forEach(e=>{if(e.group===group&&e.category===oldName)e.category=newName})});
    FinanceStorage.save();closeModal();FinanceApp.refresh();FinanceApp.toast("Judul sub-kategori berhasil diubah.");
  }
  function submitCategory(e){
    e.preventDefault();const type=$("categoryEditType").value,old=$("categoryOldName").value,name=$("categoryNameInput").value.trim(),parent=$("categoryParentSelect").value,d=FinanceStorage.getDB(),cats=d.settings.categories;
    if(!name)return;
    if(type==="group"){if(old)renameGroup(old,name);else{if(cats[name])return FinanceApp.toast("Nama kelompok sudah digunakan.");cats[name]=[];FinanceStorage.save();closeModal();FinanceApp.refresh();FinanceApp.toast("Kelompok berhasil ditambahkan.")}}
    else{if(old)renameSub(parent,old,name);else{const items=cats[parent]||[];if(items.includes(name))return FinanceApp.toast("Nama sub-kategori sudah digunakan.");items.push(name);cats[parent]=items;FinanceStorage.save();closeModal();FinanceApp.refresh();FinanceApp.toast("Sub-kategori berhasil ditambahkan.")}}
  }
  function deleteGroup(group){
    const d=FinanceStorage.getDB(),items=d.settings.categories[group]||[],count=Object.values(d.months).reduce((n,m)=>n+m.expenses.filter(e=>e.group===group).length,0);
    if(!confirm(`Hapus kelompok "${group}" beserta ${items.length} sub-kategori? ${count?`Ada ${count} transaksi terkait. Transaksi tersebut juga akan dihapus dari semua bulan.`:"Tidak ada transaksi terkait."}`))return;
    delete d.settings.categories[group];Object.values(d.months).forEach(m=>{m.expenses=m.expenses.filter(e=>e.group!==group);items.forEach(c=>delete m.budgets[c])});FinanceStorage.save();FinanceApp.refresh();FinanceApp.toast("Kelompok berhasil dihapus.")
  }
  function deleteSub(group,sub){
    const d=FinanceStorage.getDB(),count=Object.values(d.months).reduce((n,m)=>n+m.expenses.filter(e=>e.group===group&&e.category===sub).length,0);
    if(!confirm(`Hapus sub-kategori "${sub}"? ${count?`Ada ${count} transaksi terkait dan transaksi tersebut akan ikut dihapus.`:""}`))return;
    d.settings.categories[group]=(d.settings.categories[group]||[]).filter(x=>x!==sub);Object.values(d.months).forEach(m=>{delete m.budgets[sub];m.expenses=m.expenses.filter(e=>!(e.group===group&&e.category===sub))});FinanceStorage.save();FinanceApp.refresh();FinanceApp.toast("Sub-kategori berhasil dihapus.")
  }
  function bind(){
    $("saveSettingsButton").onclick=save;$("backupButton").onclick=backup;$("restoreInput").onchange=e=>{if(e.target.files[0])restore(e.target.files[0]);e.target.value=""};$("resetDataButton").onclick=reset;$("themeToggle").onclick=theme;
    $("addGroupButton").onclick=()=>openModal("group");$("closeCategoryModal").onclick=closeModal;$("cancelCategoryButton").onclick=closeModal;$("categoryForm").onsubmit=submitCategory;
    $("categoryManager").onclick=e=>{const eg=e.target.closest("[data-edit-group]"),dg=e.target.closest("[data-delete-group]"),as=e.target.closest("[data-add-sub]"),es=e.target.closest("[data-edit-sub]"),ds=e.target.closest("[data-delete-sub]");if(eg)openModal("group","",eg.dataset.editGroup);else if(dg)deleteGroup(dg.dataset.deleteGroup);else if(as)openModal("subcategory",as.dataset.addSub);else if(es)openModal("subcategory",es.dataset.editSub,es.dataset.oldSub);else if(ds)deleteSub(ds.dataset.deleteSub,ds.dataset.oldSub)}
  }
  return {render,bind,applyTheme};
})();