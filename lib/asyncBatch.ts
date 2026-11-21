export async function runWithConcurrency<T,R>(
  items:readonly T[],
  worker:(item:T,index:number)=>Promise<R>,
  concurrency=5,
):Promise<R[]>{
  const results=new Array<R>(items.length);
  let cursor=0;
  const workerCount=Math.min(items.length,Math.max(1,Math.floor(concurrency)||1));
  await Promise.all(Array.from({length:workerCount},async()=>{
    while(true){
      const index=cursor++;
      if(index>=items.length)return;
      results[index]=await worker(items[index],index);
    }
  }));
  return results;
}
