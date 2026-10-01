const $=s=>document.querySelector(s);
const pages=["devices","settings","help"];
let devices=JSON.parse(localStorage.getItem("feranslink_devices")||"[]");
let pendingDelete=-1;

function saveDevices(){localStorage.setItem("feranslink_devices",JSON.stringify(devices));}
function render(){
  const list=$("#deviceList");
  list.innerHTML="";
  $("#empty").style.display=devices.length?"none":"flex";
  $("#deviceSummary").textContent=devices.length?devices.length+" perangkat tersimpan.":"Belum ada perangkat tersimpan.";
  devices.forEach((d,i)=>{
    const el=document.createElement("div");
    el.className="device";
    el.innerHTML=`<div class="device-top"><span class="device-name"></span><span class="status"><i></i>Offline</span></div><div class="device-id"></div><div class="device-actions"><button class="connect">Buka Remote Control</button><button class="delete-btn" title="Hapus perangkat">✕</button></div>`;
    el.querySelector(".device-name").textContent=d.name;
    el.querySelector(".device-id").textContent=d.id;
    el.querySelector(".connect").onclick=e=>{e.stopPropagation();openRemote(i)};
    el.querySelector(".delete-btn").onclick=e=>{e.stopPropagation();openDelete(i)};
    el.onclick=()=>openRemote(i);
    list.appendChild(el);
  });
}
function openRemote(i){
  if(!devices[i])return;
  pages.forEach(x=>$("#"+x).classList.remove("active"));
  $("#remote").classList.add("active");
  $("#remoteName").textContent=devices[i].name;
  $("#remoteDeviceId").textContent=devices[i].id;
  $("#remoteStatusText").textContent="Menunggu koneksi";
}
function showPage(p){
  pages.forEach(x=>$("#"+x).classList.toggle("active",x===p));
  $("#remote").classList.remove("active");
  $("#page-title").textContent=p==="devices"?"Perangkat":p==="settings"?"Pengaturan":"Bantuan";
  $("#page-subtitle").textContent=p==="devices"?"Kelola perangkat Android yang terhubung.":p==="settings"?"Atur preferensi FeransLink.":"Informasi penggunaan FeransLink.";
  $("#addBtn").style.display=p==="devices"?"block":"none";
}
function openAdd(){
  $("#modal").classList.remove("hidden");
  $("#addError").classList.add("hidden");
  $("#deviceId").value="";
  $("#deviceId").focus();
}
function closeAdd(){$("#modal").classList.add("hidden")}
function openDelete(i){
  pendingDelete=i;
  $("#deleteText").textContent=`Perangkat "${devices[i].name}" akan dihapus dari daftar FeransLink.`;
  $("#deleteModal").classList.remove("hidden");
}
function closeDelete(){pendingDelete=-1;$("#deleteModal").classList.add("hidden")}

document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>{
  document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");
  showPage(b.dataset.page);
});
$("#addBtn").onclick=openAdd;
$("#emptyAdd").onclick=openAdd;
$("#cancel").onclick=closeAdd;
$("#cancelTop").onclick=closeAdd;
$("#save").onclick=()=>{
  const id=$("#deviceId").value.trim();
  if(!id){$("#addError").classList.remove("hidden");$("#deviceId").focus();return}
  if(devices.some(d=>d.id.toLowerCase()===id.toLowerCase())){
    $("#addError").textContent="Device ID tersebut sudah ada.";
    $("#addError").classList.remove("hidden");
    return;
  }
  devices.push({id,name:"Perangkat Android "+(devices.length+1)});
  saveDevices();
  closeAdd();
  render();
};
$("#deviceId").addEventListener("keydown",e=>{if(e.key==="Enter")$("#save").click();if(e.key==="Escape")closeAdd()});
$("#backBtn").onclick=()=>showPage("devices");
$("#deleteCancel").onclick=closeDelete;
$("#deleteConfirm").onclick=()=>{
  if(pendingDelete>-1){devices.splice(pendingDelete,1);saveDevices();render();}
  closeDelete();
};
$("#stopBtn").onclick=()=>$("#stopModal").classList.remove("hidden");
$("#stopCancel").onclick=()=>$("#stopModal").classList.add("hidden");
$("#stopConfirm").onclick=()=>{$("#stopModal").classList.add("hidden");showPage("devices")};
$("#fitBtn").onclick=()=>{$("#phoneFrame").style.height="min(82%,700px)";$("#phoneFrame").classList.remove("landscape")};
$("#rotateBtn").onclick=()=>$("#phoneFrame").classList.toggle("landscape");
$("#fullscreenBtn").onclick=async()=>{
  const target=$("#remote");
  if(!document.fullscreenElement)await target.requestFullscreen?.();
  else await document.exitFullscreen?.();
};
document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>{
  const action=b.dataset.action;
  $("#remoteStatusText").textContent=action==="keyboard"?"Keyboard dipilih":action==="mouse"?"Mouse dipilih":action.charAt(0).toUpperCase()+action.slice(1)+" dipilih";
});
window.addEventListener("keydown",e=>{if(e.key==="Escape"){$("#modal").classList.add("hidden");$("#deleteModal").classList.add("hidden");$("#stopModal").classList.add("hidden")}});
render();