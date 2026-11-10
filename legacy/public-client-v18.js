export async function apiPost(name, body={}){
  const r=await fetch(`/api/${encodeURIComponent(name)}`,{
    method:"POST",
    headers:{"Content-Type":"application/json","x-lamsa-form-version":"18"},
    body:JSON.stringify(body)
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error||`Request failed (${r.status})`);
  return data;
}
export async function loadPublicConfig(){
  return apiPost("public-config",{});
}
