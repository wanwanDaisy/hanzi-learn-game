import { recognizeDigit } from './digit-recognizer.js?v=20261030c';
export class NumberWriting {
  constructor(canvases,onChange){
    this.onChange=onChange;this.disabled=false;
    this.pads=canvases.map(canvas=>{
      const pad={canvas,strokes:[],pointer:null};
      canvas.addEventListener('pointerdown',e=>{
        if(this.disabled||pad.pointer!==null||e.button!==0)return;
        e.preventDefault();canvas.setPointerCapture(e.pointerId);pad.pointer=e.pointerId;
        pad.strokes.push([this.point(pad,e)]);this.draw(pad);this.onChange();
      });
      canvas.addEventListener('pointermove',e=>{
        if(pad.pointer!==e.pointerId)return;e.preventDefault();
        const stroke=pad.strokes[pad.strokes.length-1],p=this.point(pad,e);
        if(Math.hypot(p[0]-stroke[stroke.length-1][0],p[1]-stroke[stroke.length-1][1])<1)return;
        stroke.push(p);this.draw(pad);
      });
      const end=e=>{if(pad.pointer!==e.pointerId)return;
        if(e.type==='pointerup'){const stroke=pad.strokes[pad.strokes.length-1];stroke.push(this.point(pad,e));this.draw(pad);}
        pad.pointer=null;this.onChange();};
      canvas.addEventListener('pointerup',end);
      canvas.addEventListener('pointercancel',e=>{if(pad.pointer!==e.pointerId)return;pad.strokes.pop();end(e);this.draw(pad);});
      canvas.addEventListener('lostpointercapture',end);
      return pad;
    });
    this.resize=new ResizeObserver(()=>this.pads.forEach(p=>this.draw(p)));this.pads.forEach(p=>this.resize.observe(p.canvas));
  }
  point(pad,e){const r=pad.canvas.getBoundingClientRect();return [(e.clientX-r.left)*200/r.width,(e.clientY-r.top)*240/r.height];}
  draw(pad){
    const c=pad.canvas,r=c.getBoundingClientRect(),ratio=window.devicePixelRatio||1;
    c.width=Math.max(1,Math.round(r.width*ratio));c.height=Math.max(1,Math.round(r.height*ratio));
    const ctx=c.getContext('2d');ctx.scale(c.width/200,c.height/240);
    ctx.strokeStyle='#285c43';ctx.fillStyle='#285c43';ctx.lineWidth=7;ctx.lineCap='round';ctx.lineJoin='round';
    for(const stroke of pad.strokes){if(stroke.length===1){ctx.beginPath();ctx.arc(...stroke[0],3.5,0,Math.PI*2);ctx.fill();continue;}
      ctx.beginPath();ctx.moveTo(...stroke[0]);for(const p of stroke.slice(1))ctx.lineTo(...p);ctx.stroke();}
    c.classList.toggle('has-ink',pad.strokes.length>0);
  }
  clear(){this.pads.forEach(p=>{if(p.pointer!==null&&p.canvas.hasPointerCapture(p.pointer))p.canvas.releasePointerCapture(p.pointer);p.pointer=null;p.strokes=[];this.draw(p)});this.onChange();}
  hasInk(){return this.pads.some(p=>p.strokes.length);}
  busy(){return this.pads.some(p=>p.pointer!==null);}
  read(){
    const active=this.pads.filter(p=>p.strokes.length);if(!active.length||this.busy())return null;
    const digits=active.map(p=>recognizeDigit(p.strokes));if(digits.some(d=>d===null))return null;
    return {text:digits.join(''),value:Number(digits.join(''))};
  }
  lock(locked){this.disabled=locked;this.pads.forEach(p=>p.canvas.setAttribute('aria-disabled',String(locked)));}
}
