// Packed builds embed assets; development reads the exact same project files.
export const ENDING_MEDIA = null;
export function endingAsset(id){return ENDING_MEDIA?.[id]||`assets/ending/${id}.${id==='epilogue'?'webm':'jpg'}`;}
export function endingIllustration(kind){
  const id=kind==='final-transfer'?'transfer':kind==='final-embers'?'embers':null;
  return id?`<div class="ending-shot"><img src="${endingAsset(id)}" alt="${id==='transfer'?'执炬王亲手交出掌中之火':'烬散为余火，照亮万家'}"><div class="ending-grain"></div></div>`:null;
}
