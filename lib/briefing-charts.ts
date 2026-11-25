/**
 * Aggregate matrix rows for the editable PowerPoint briefing graphs.
 * Format: [formCode,label,valid,passed,failed,poor,passRate,errorRate,alert].
 * Empty (not evaluated) criteria are excluded rather than shown as zero success.
 */
export type BriefingGraph={formCode:string;labels:string[];pass:number[];fail:number[];total:number}
export function briefingGraphs(rows:(number|string|null)[][],limit=10):BriefingGraph[]{
 const groups=new Map<string,BriefingGraph>()
 for(const row of rows){
  const formCode=String(row[0]??'').trim()
  const label=String(row[1]??'').trim()
  const total=Number(row[2])
  const passed=Number(row[6])
  const failed=Number(row[7])
  if(!formCode||!label||!Number.isFinite(total)||total<=0)continue
  if(!Number.isFinite(passed)||!Number.isFinite(failed))continue
  const graph=groups.get(formCode)||{formCode,labels:[],pass:[],fail:[],total:0}
  if(graph.labels.length<limit){
   graph.labels.push(label)
   graph.pass.push(Math.min(100,Math.max(0,passed)))
   graph.fail.push(Math.min(100,Math.max(0,failed)))
   graph.total+=total
  }
  groups.set(formCode,graph)
 }
 return [...groups.values()]
}
