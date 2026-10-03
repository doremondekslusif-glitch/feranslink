const $=s=>document.querySelector(s);
const pages=["devices","settings","help"];
let devices=JSON.parse(localStorage.getItem("feranslink_devices")||"[]");
let pendingDelete=-1;
let activeDeviceIndex=-1;
let activeChannel=null;
let activeSessionId=null;
let realtimeReady=false;

const supabaseClient=window.supabase?.createClient?.(
  window.FERANSLINK_SUPABASE?.url||"",
  window.FERANSLINK_SUPABASE?.publishableKey||""
);

function saveDevices(){localStorage.setItem("feranslink_devices",JSON.stringify(devices));}

function setRealtimeStatus(text,ok=true){
  const el=$("#realtimeStatus");
  el.innerHTML=`<i></i>${text}`;
  el.classList.toggle("offline",!ok);
}

function randomSessionId(){
  if(crypto.randomUUID)return crypto.randomUUID();
  return "sess-"+Date.now()+"-"+Math.random().toString(36).slice(2,10);
}

async function makeTopic(id,pin){
  const data=new TextEncoder().encode((id||"").trim().toLowerCase()+"|"+(pin||""));
  const hash=await crypto.subtle.digest("SHA-256",data);
  return "feranslink-"+[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,"0")).join("");
}

function render(){
  const list=$("#deviceList");
  list.innerHTML="";
  $("#empty").style.display=devices.length?"none":"flex";
  $("#deviceSummary").textContent=devices.length?devices.length+" perangkat tersimpan.":"Belum ada perangkat tersimpan.";
  devices.forEach((d,i)=>{
    const el=document.createElement("div");
    el.className="device";
    el.innerHTML=`<div class="device-top"><span class="device-name"></span><span class="status"><i></i><span>Offline</span></span></div><div class="device-id"></div><div class="device-actions"><button class="connect">Minta Koneksi</button><button class="delete-btn" title="Hapus perangkat">✕</button></div>`;
    el.querySelector(".device-name").textContent=d.name;
    el.querySelector(".device-id").textContent=d.id;
    el.querySelector(".connect").onclick=e=>{e.stopPropagation();openRemote(i)};
    el.querySelector(".delete-btn").onclick=e=>{e.stopPropagation();openDelete(i)};
    el.onclick=()=>openRemote(i);
    list.appendChild(el);
  });
}

async function openRemote(i){
  if(!devices[i])return;
  activeDeviceIndex=i;
  pages.forEach(x=>$("#"+x).classList.remove("active"));
  $("#remote").classList.add("active");
  $("#remoteName").textContent=devices[i].name;
  $("#remoteDeviceId").textContent=devices[i].id;
  $("#remoteStatusText").textContent="Menghubungkan ke server";
  $("#screenMessage").textContent="Menyiapkan permintaan koneksi...";
  await connectRealtime(i);
}

async function connectRealtime(i){
  if(!supabaseClient){
    setRealtimeStatus("Realtime belum tersedia",false);
    $("#remoteStatusText").textContent="Server tidak tersedia";
    return;
  }
  if(activeChannel){
    await supabaseClient.removeChannel(activeChannel);
    activeChannel=null;
  }
  const device=devices[i];
  const topic=await makeTopic(device.id,device.pin);
  activeSessionId=randomSessionId();

  activeChannel=supabaseClient
    .channel(topic,{config:{broadcast:{ack:true}}})
    .on("broadcast",{event:"connection_response"},payload=>{
      const data=payload.payload||{};
      if(data.sessionId!==activeSessionId)return;
      if(data.action==="allow"){
        $("#remoteStatusText").textContent="Connected";
        $("#screenMessage").textContent="Android mengizinkan koneksi. Menunggu stream layar...";
      }else{
        $("#remoteStatusText").textContent="Ditolak Android";
        $("#screenMessage").textContent="Permintaan koneksi ditolak oleh perangkat Android.";
      }
    })
    .on("broadcast",{event:"device_status"},payload=>{
      const data=payload.payload||{};
      if(data.deviceId===device.id){
        $("#remoteStatusText").textContent=data.status==="ready"?"Siap — meminta izin":"Offline";
        $("#screenMessage").textContent=data.status==="ready"?"Menunggu persetujuan di Android...":"Perangkat Android sedang offline.";
      }
    })
    .on("broadcast",{event:"session_stopped"},payload=>{
      const data=payload.payload||{};
      if(data.sessionId===activeSessionId){
        $("#remoteStatusText").textContent="Terputus";
        $("#screenMessage").textContent="Sesi remote control telah dihentikan.";
      }
    });

  activeChannel.subscribe(async status=>{
    if(status==="SUBSCRIBED"){
      realtimeReady=true;
      setRealtimeStatus("Server terhubung",true);
      $("#remoteStatusText").textContent="Meminta izin Android";
      $("#screenMessage").textContent="Permintaan koneksi sedang dikirim ke Android...";
      try{
        const sendResult=await activeChannel.send({
          type:"broadcast",
          event:"connection_request",
          payload:{
            sessionId:activeSessionId,
            deviceId:device.id,
            controller:"windows",
            requestedAt:new Date().toISOString()
          }
        });
        if(sendResult!=="ok"){
          $("#remoteStatusText").textContent="Request gagal dikirim";
          $("#screenMessage").textContent="Server FeransLink tidak mengonfirmasi pengiriman permintaan ("+String(sendResult)+").";
        }
      }catch(e){
        $("#remoteStatusText").textContent="Request gagal dikirim";
        $("#screenMessage").textContent="Pengiriman permintaan gagal: "+(e?.message||String(e));
      }
    }else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"){
      realtimeReady=false;
      setRealtimeStatus("Koneksi server bermasalah",false);
      $("#remoteStatusText").textContent="Gagal terhubung";
      $("#screenMessage").textContent="Tidak dapat terhubung ke server FeransLink.";
    }
  });
}

async function stopRealtime(){
  if(activeChannel&&supabaseClient){
    try{
      if(activeSessionId)await activeChannel.send({
        type:"broadcast",
        event:"session_stopped",
        payload:{sessionId:activeSessionId,reason:"controller_stop"}
      });
    }catch(e){}
    await supabaseClient.removeChannel(activeChannel);
  }
  activeChannel=null;
  activeSessionId=null;
  activeDeviceIndex=-1;
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
  $("#devicePin").value="";
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
  const pin=$("#devicePin").value.trim();
  if(!id||!/^[0-9]{6}$/.test(pin)){
    $("#addError").textContent="Device ID dan PIN 6 digit harus diisi.";
    $("#addError").classList.remove("hidden");
    return;
  }
  if(devices.some(d=>d.id.toLowerCase()===id.toLowerCase())){
    $("#addError").textContent="Device ID tersebut sudah ada.";
    $("#addError").classList.remove("hidden");
    return;
  }
  devices.push({id,pin,name:"Perangkat Android "+(devices.length+1)});
  saveDevices();
  closeAdd();
  render();
};

$("#deviceId").addEventListener("keydown",e=>{if(e.key==="Escape")closeAdd();if(e.key==="Enter")$("#devicePin").focus()});
$("#devicePin").addEventListener("keydown",e=>{if(e.key==="Escape")closeAdd();if(e.key==="Enter")$("#save").click()});
$("#backBtn").onclick=async()=>{await stopRealtime();showPage("devices")};
$("#deleteCancel").onclick=closeDelete;
$("#deleteConfirm").onclick=()=>{
  if(pendingDelete>-1){devices.splice(pendingDelete,1);saveDevices();render();}
  closeDelete();
};
$("#stopBtn").onclick=()=>$("#stopModal").classList.remove("hidden");
$("#stopCancel").onclick=()=>$("#stopModal").classList.add("hidden");
$("#stopConfirm").onclick=async()=>{
  $("#stopModal").classList.add("hidden");
  await stopRealtime();
  showPage("devices");
};
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
window.addEventListener("keydown",e=>{
  if(e.key==="Escape"){
    $("#modal").classList.add("hidden");
    $("#deleteModal").classList.add("hidden");
    $("#stopModal").classList.add("hidden");
  }
});

if(supabaseClient){
  setRealtimeStatus("Menghubungkan...",true);
  supabaseClient.channel("feranslink-control").subscribe(status=>{
    if(status==="SUBSCRIBED")setRealtimeStatus("Server terhubung",true);
    if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")setRealtimeStatus("Server bermasalah",false);
  });
}else{
  setRealtimeStatus("Realtime belum dikonfigurasi",false);
}

render();