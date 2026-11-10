import test from "node:test";
import assert from "node:assert/strict";

test("four moments on after_gallery keep their configured order",async()=>{
  const children=[];
  class Node{
    constructor(id=""){this.id=id;this.dataset={};this.className="";this.dir="";this.isConnected=true}
    insertAdjacentElement(where,node){assert.equal(where,"afterend");const i=children.indexOf(this);children.splice(i+1,0,node);return node}
  }
  const gallery=new Node("galleryChapter"),closing=new Node("closing");children.push(gallery,closing);
  globalThis.document={createElement:()=>new Node(),querySelector:s=>s===".closing"?closing:null,getElementById:id=>id==="galleryChapter"?gallery:null,body:{appendChild(n){children.push(n)}}};
  globalThis.matchMedia=()=>({matches:true});
  const {makeMoment}=await import("../../assets/js/wow/wow-core.js");
  for(const name of ["one","two","three","four"]){const node=makeMoment(name,{anchor:"after_gallery"});node.dataset.name=name}
  assert.deepEqual(children.filter(x=>x.dataset.name).map(x=>x.dataset.name),["one","two","three","four"]);
});
