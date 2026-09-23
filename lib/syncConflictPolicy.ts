export function changedSince(value:string|undefined|null, baseline:string|undefined|null):boolean {
  if (!value || !baseline) return false;
  const valueMs = new Date(value).getTime();
  const baselineMs = new Date(baseline).getTime();
  return Number.isFinite(valueMs) && Number.isFinite(baselineMs) && valueMs > baselineMs;
}

export function bothChangedSince(
  localUpdatedAt:string|undefined|null,
  remoteUpdatedAt:string|undefined|null,
  lastSyncAt:string|undefined|null,
):boolean {
  return changedSince(localUpdatedAt, lastSyncAt) && changedSince(remoteUpdatedAt, lastSyncAt);
}

export function bothCreatedSince(
  localCreatedAt:string|undefined|null,
  remoteCreatedAt:string|undefined|null,
  lastSyncAt:string|undefined|null,
):boolean {
  return bothChangedSince(localCreatedAt, remoteCreatedAt, lastSyncAt);
}

export function localChangedAndRemoteDeleted(
  localUpdatedAt:string|undefined|null,
  remoteExists:boolean,
  lastSyncAt:string|undefined|null,
):boolean {
  return !remoteExists && changedSince(localUpdatedAt, lastSyncAt);
}
