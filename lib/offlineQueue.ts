import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY='flowos:offline-queue:v2';
export type PendingMutation={id:string;table:'commitments';action:'upsert'|'delete';payload:Record<string,unknown>;createdAt:string;attempts?:number;lastError?:string};
function targetId(m:PendingMutation){return String(m.payload.id??m.id);}
export async function enqueueMutation(mutation:PendingMutation){const queue=await readQueue();const target=targetId(mutation);const next=queue.filter(item=>!(item.table===mutation.table&&targetId(item)===target));await AsyncStorage.setItem(KEY,JSON.stringify([...next,mutation]));}
export async function readQueue():Promise<PendingMutation[]>{const raw=await AsyncStorage.getItem(KEY);if(!raw)return[];try{const parsed=JSON.parse(raw);return Array.isArray(parsed)?parsed as PendingMutation[]:[];}catch{return[];}}
export async function replaceQueue(queue:PendingMutation[]){await AsyncStorage.setItem(KEY,JSON.stringify(queue));}
export async function getPendingCommitmentIds(){return new Set((await readQueue()).filter(item=>item.table==='commitments').map(item=>targetId(item)));}
export async function getOfflineQueueSize(){return(await readQueue()).length;}
