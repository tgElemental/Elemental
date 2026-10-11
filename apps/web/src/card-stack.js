/** A visual stack of physical cards; never render inventory as a visible number.
 * Each layer corresponds to exactly one owned card. At large inventory counts,
 * steps compress so the complete deck still fits on a mobile screen.
 */
export function stackLayers(count){
  if(!Number.isSafeInteger(count)||count<0)throw new RangeError('Invalid inventory');
  const layers=[];
  const step=Math.min(3.8,40/Math.max(1,count-1));
  for(let i=0;i<count-1;i++){
    // Real individual cards. The last layer is the top card handled in markup.
    layers.push({index:i,shift:Number(((i+1)*step).toFixed(2)),rotate:Number(((i%5-2)*.35).toFixed(2))});
  }
  return layers;
}
export function isArenaDrop(x,y,rect){
  if(!Number.isFinite(x)||!Number.isFinite(y)||!rect||rect.width<=0||rect.height<=0)return false;
  // Central orb rather than the entire rectangular arena; high intention throw.
  const dx=(x-(rect.left+rect.width/2))/(rect.width*.40);
  const dy=(y-(rect.top+rect.height*.45))/(rect.height*.44);
  return dx*dx+dy*dy<=1;
}

