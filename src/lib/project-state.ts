export type DatabaseProjectStatus='not_started'|'in_progress'|'on_hold'|'completed'|'cancelled';

export function normalizedProjectProgress(
  status: DatabaseProjectStatus, previousProgress: number, requestedProgress?: number,
): number {
  const progress=requestedProgress ?? previousProgress;
  if(!Number.isInteger(progress) || progress<0 || progress>100)throw new Error('Progress must be between 0 and 100.');
  if(status==='completed')return 100;
  if(status==='not_started')return 0;
  if(progress===100){
    if(requestedProgress!==undefined)throw new Error('100% progress requires Completed status.');
    return 99;
  }
  return progress;
}
