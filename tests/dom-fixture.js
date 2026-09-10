// Small DOM test double for controller/state tests; browser layout is tested separately.
export class Node {
  constructor(tag='div') {
    this.tagName=tag.toUpperCase(); this.children=[]; this.dataset={}; this.attributes={};
    this.style={}; this.listeners=new Map(); this.value=''; this.hidden=false; this.text='';
    this.validity={badInput:false}; this.captures=new Set();
    this.classList={
      contains: key=>(this.className||'').split(' ').includes(key),
      add: (...keys)=>{this.className=[...new Set([...(this.className||'').split(' ').filter(Boolean),...keys])].join(' ');},
      remove: (...keys)=>{this.className=(this.className||'').split(' ').filter(key=>!keys.includes(key)).join(' ');},
      toggle: (key,force)=>{const next=force??!this.classList.contains(key); next?this.classList.add(key):this.classList.remove(key);return next;},
    };
  }
  set textContent(text){this.text=String(text);this.children=[];}
  set value(value){this._value=String(value);}
  get value(){return this._value;}
  get textContent(){return this.text+this.children.map(child=>child.textContent).join('');}
  setAttribute(key,value){
    this.attributes[key]=String(value);
    if(key==='class')this.className=String(value);
    if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=String(value);
  }
  getAttribute(key){return key==='class'?(this.className||null):(this.attributes[key]??null);}
  removeAttribute(key){delete this.attributes[key];}
  append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
  add(node){this.append(node); if(this.children.length===1)this.value=node.value;}
  replaceChildren(...nodes){this.children.forEach(node=>node.parentElement=null);this.children=[];this.text='';this.append(...nodes);}
  remove(){if(this.parentElement){const list=this.parentElement.children;list.splice(list.indexOf(this),1);this.parentElement=null;}}
  addEventListener(name,fn,options={}){const list=this.listeners.get(name)||[];list.push({fn,once:options.once});this.listeners.set(name,list);}
  fire(name,properties={}){
    const event={type:name,target:this,preventDefault(){},stopPropagation(){},...properties};
    for(const item of [...(this.listeners.get(name)||[])]){
      if(item.once)this.listeners.set(name,this.listeners.get(name).filter(other=>other!==item));
      item.fn(event);
    }
  }
  click(){this.fire('click');}
  matches(selector){
    if(selector.startsWith('.'))return this.classList.contains(selector.slice(1));
    if(selector.startsWith('['))return this.getAttribute(selector.slice(1,-1))!==null;
    return this.tagName===selector.toUpperCase();
  }
  closest(selector){let node=this;while(node){if(selector.split(',').some(part=>node.matches(part.trim())))return node;node=node.parentElement;}return null;}
  querySelectorAll(selector){const result=[];for(const child of this.children){if(child.matches(selector))result.push(child);result.push(...child.querySelectorAll(selector));}return result;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  getComputedTextLength(){return this.textContent.length*7;}
  getBoundingClientRect(){return {left:0,top:0,width:850,height:700};}
  setPointerCapture(id){this.captures.add(id);}
  hasPointerCapture(id){return this.captures.has(id);}
  releasePointerCapture(id){this.captures.delete(id);this.fire('lostpointercapture',{pointerId:id});}
  focus(){}
  showModal(){this.open=true;}
  close(value){if(value!==undefined)this.returnValue=value;this.open=false;this.fire('close');}
}
export function installDocument(t,ids=[]){
  const originals=new Map(['document','requestAnimationFrame','ResizeObserver','Option'].map(key=>[key,globalThis[key]]));
  const nodes=new Map(ids.map(id=>[id,new Node()]));
  const body=new Node('body');
  globalThis.document={body,createElement:tag=>new Node(tag),createElementNS:(_,tag)=>new Node(tag),
    getElementById:id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);},
    querySelectorAll:()=>[]};
  globalThis.requestAnimationFrame=()=>1;
  globalThis.ResizeObserver=class{observe(){} disconnect(){}};
  globalThis.Option=class extends Node{constructor(label,value){super('option');this.textContent=label;this.value=value;}};
  t.after(()=>{for(const [key,value] of originals){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
  return {nodes};
}
