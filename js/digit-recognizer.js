// Small, local stroke-template recognizer. It never receives the expected answer.
const paths = {
  0: ['70,8 40,5 18,23 10,55 20,86 45,96 70,85 83,55 80,24 70,8'],
  1: ['50,5 50,95', '28,25 50,5 50,95', '25,25 50,5 50,95|25,95 75,95'],
  2: ['12,25 25,8 50,5 73,15 80,33 68,50 12,95 83,95', '10,20 30,5 65,8 80,28 65,50 15,85 8,95 85,95'],
  3: ['12,12 40,5 68,12 78,28 65,44 40,50 67,53 80,72 70,90 40,98 12,88', '12,8 80,8 40,48 65,50 80,68 72,88 45,96 12,88'],
  4: ['65,5 15,65 85,65|65,5 65,98', '25,5 15,65 85,65|65,5 65,98', '65,5 15,65 85,65 65,65 65,98'],
  5: ['78,8 20,8 16,50 45,43 70,50 83,72 70,92 40,98 12,88', '20,8 16,50 45,43 70,50 83,72 70,92 40,98 12,88|20,8 78,8'],
  6: ['72,8 48,12 25,35 12,65 20,88 45,98 70,88 80,65 65,48 40,45 16,63', '75,5 45,15 20,45 12,75 25,95 55,98 80,80 75,55 50,45 20,55'],
  7: ['12,8 85,8 35,98', '12,8 85,8 35,98|30,52 70,52'],
  8: ['50,48 22,28 25,10 50,4 75,15 72,32 50,48 18,70 20,90 50,98 80,88 80,68 50,48', '50,48 25,40 15,22 28,5 60,5 80,22 70,40 50,48|50,48 22,60 12,80 30,98 65,98 85,80 75,60 50,48'],
  9: ['78,45 55,52 25,45 12,25 25,5 55,5 78,20 78,45 65,75 45,98', '75,95 78,18 55,5 25,8 12,30 25,50 55,52 78,38'],
};
// Children's 5 often has a stem extending above its separately written bar.
// Vary bar height/length and the lower bowl instead of requiring typeset proportions.
for(const barY of [20,32])for(const barEnd of [60,95]){
  paths[5].push(`32,3 27,30 20,57 37,57 52,64 61,77 57,89 44,96 24,98 8,98|27,${barY} ${barEnd},${barY-2}`);
}
paths[5].push('28,3 20,25 12,50 62,50 75,55 82,65 80,78 70,89 48,98 14,98|23,20 53,14 82,11');
// A handwritten 9 commonly has a broad, shallow loop and a left-leaning tail.
paths[9].push('70,31 54,36 30,36 16,29 12,22 22,10 35,4 58,4 73,8 78,15 72,23 61,32 51,46 43,64 34,83 29,98');
export const DIGIT_TEMPLATES = Object.entries(paths).flatMap(([digit, variants]) => variants.map(path => ({digit:Number(digit), strokes:path.split('|').map(stroke=>stroke.split(' ').map(p=>p.split(',').map(Number)))})));
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function cloud(strokes) {
  const points=strokes.flat();
  if(points.length<2)return null;
  const minX=Math.min(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1]));
  const width=Math.max(...points.map(p=>p[0]))-minX,height=Math.max(...points.map(p=>p[1]))-minY;
  const scale=Math.max(width,height);
  // Normalize proportions while preserving a narrow straight 1.
  const scaleX=Math.max(width,scale*.3),scaleY=Math.max(height,scale*.65);
  const segments=[];let length=0;
  for(const stroke of strokes)for(let i=1;i<stroke.length;i++){
    const n=distance(stroke[i-1],stroke[i]);if(n){segments.push({a:stroke[i-1],b:stroke[i],start:length,n});length+=n;}
  }
  if(scale<8||length<12||!segments.length||length/scale>9)return null;
  const out=[];let k=0;
  for(let i=0;i<48;i++){
    const at=length*i/47;while(k<segments.length-1&&segments[k].start+segments[k].n<at)k++;
    const s=segments[k],t=Math.min(1,(at-s.start)/s.n);
    out.push([(s.a[0]+t*(s.b[0]-s.a[0])-minX-width/2)/scaleX,(s.a[1]+t*(s.b[1]-s.a[1])-minY-height/2)/scaleY]);
  }
  return out;
}
function match(a,b){
  let best=Infinity;
  // One-to-one matching preserves repeated crossings (e.g. 8 versus 0).
  for(let start=0;start<a.length;start+=6){
    const used=new Set();let sum=0;
    for(let step=0;step<a.length;step++){
      const p=a[(start+step)%a.length];let d=Infinity,index=-1;
      for(let j=0;j<b.length;j++)if(!used.has(j)){const n=distance(p,b[j]);if(n<d){d=n;index=j;}}
      used.add(index);sum+=(1-step/a.length)*d;
    }
    best=Math.min(best,sum/(a.length/2));
  }
  return best;
}
// Include mild lean in both directions; size and aspect ratio normalize above.
const templates=DIGIT_TEMPLATES.flatMap(t=>[-.18,0,.18].map(lean=>({
  digit:t.digit,points:cloud(t.strokes.map(stroke=>stroke.map(([x,y])=>[x+lean*(y-50),y])))
})));
export function recognizeDigit(strokes){
  const points=cloud(strokes);if(!points)return null;
  const scores=Array.from({length:10},(_,digit)=>({digit,score:Math.min(...templates.filter(t=>t.digit===digit).map(t=>Math.min(match(points,t.points),match(t.points,points))))})).sort((a,b)=>a.score-b.score);
  // Similar candidates still get a preview for the child to confirm.
  // Do not silently reject legible writing merely because two scores are close.
  if(scores[0].score>.25)return null;
  return scores[0].digit;
}
