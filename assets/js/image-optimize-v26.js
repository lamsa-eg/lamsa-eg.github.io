/* LAMSA V26 — ضغط الصور الكبيرة تلقائيًا قبل الرفع */
function canvasBlob(canvas,type,quality){
  return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("تعذر ضغط الصورة.")),type,quality));
}

async function decodeImage(file){
  if("createImageBitmap" in window){
    try{
      const bitmap=await createImageBitmap(file,{imageOrientation:"from-image"});
      if(bitmap.width>0&&bitmap.height>0)return{source:bitmap,width:bitmap.width,height:bitmap.height,close:()=>bitmap.close?.()};
      bitmap.close?.();
    }catch{}
  }
  return await new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file),img=new Image();
    const done=()=>URL.revokeObjectURL(url);
    img.onload=()=>{const width=img.naturalWidth,height=img.naturalHeight;if(width>0&&height>0)resolve({source:img,width,height,close:done});else{done();reject(new Error("الصورة غير قابلة للقراءة."))}};
    img.onerror=()=>{done();reject(new Error("الصورة غير قابلة للقراءة أو تالفة."))};
    img.src=url;
  });
}

function optimizedName(name){
  const base=String(name||"image").replace(/\.[^.]+$/,"" ).replace(/[^\w\-\u0600-\u06FF]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"")||"image";
  return `${base}-optimized.jpg`;
}

export async function optimizeImageFile(file,maxBytes,{maxDimension=2560,targetRatio=.90}={}){
  if(!file||!String(file.type||"").startsWith("image/"))return{file,compressed:false,originalBytes:file?.size||0,finalBytes:file?.size||0};
  if(file.size<=0)throw new Error("الصورة فارغة أو تالفة.");
  if(file.size<=maxBytes)return{file,compressed:false,originalBytes:file.size,finalBytes:file.size};

  const decoded=await decodeImage(file);
  try{
    let width=decoded.width,height=decoded.height;
    const firstScale=Math.min(1,maxDimension/Math.max(width,height));
    width=Math.max(1,Math.round(width*firstScale));
    height=Math.max(1,Math.round(height*firstScale));
    const target=Math.max(256*1024,Math.floor(maxBytes*targetRatio));
    const qualities=[.90,.84,.78,.72,.66,.60,.54,.48];
    let best=null;

    for(let round=0;round<4;round++){
      const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext("2d",{alpha:false});
      if(!ctx)throw new Error("المتصفح لا يدعم ضغط الصور على هذا الجهاز.");
      ctx.fillStyle="#fff";ctx.fillRect(0,0,width,height);
      ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
      ctx.drawImage(decoded.source,0,0,width,height);
      for(const q of qualities){
        const blob=await canvasBlob(canvas,"image/jpeg",q);
        if(!best||blob.size<best.size)best=blob;
        if(blob.size<=target){
          const out=new File([blob],optimizedName(file.name),{type:"image/jpeg",lastModified:file.lastModified||Date.now()});
          return{file:out,compressed:true,originalBytes:file.size,finalBytes:out.size,width,height};
        }
      }
      width=Math.max(720,Math.round(width*.82));height=Math.max(720,Math.round(height*.82));
    }

    if(best&&best.size<=maxBytes){
      const out=new File([best],optimizedName(file.name),{type:"image/jpeg",lastModified:file.lastModified||Date.now()});
      return{file:out,compressed:true,originalBytes:file.size,finalBytes:out.size,width,height};
    }
    throw new Error(`تعذر ضغط الصورة إلى أقل من ${Math.round(maxBytes/1024/1024)}MB.`);
  }finally{decoded.close?.()}
}
