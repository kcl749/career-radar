const REQUIRED_FIELDS=['id','company','title','city','type','url','batch','verified'];

export function validateCatalog(rows){
  if(!Array.isArray(rows))throw new Error('Catalog must be an array');
  const ids=new Set();
  for(const [index,row] of rows.entries()){
    if(!row||typeof row!=='object'||Array.isArray(row))throw new Error(`Catalog row ${index+1} is invalid`);
    for(const field of REQUIRED_FIELDS)if(typeof row[field]!=='string'||!row[field].trim())throw new Error(`Catalog row ${index+1} is missing ${field}`);
    if(ids.has(row.id))throw new Error(`Duplicate catalog id: ${row.id}`);
    ids.add(row.id);
    if(!['秋招','实习'].includes(row.type))throw new Error(`Unsupported job type for ${row.id}: ${row.type}`);
    const url=new URL(row.url);
    if(!['http:','https:'].includes(url.protocol))throw new Error(`Unsupported URL for ${row.id}`);
  }
  return rows;
}

export function mergeCatalog(existing,incoming){
  validateCatalog(existing);
  validateCatalog(incoming);
  const ids=new Set(existing.map(row=>row.id));
  const urls=new Set(existing.map(row=>row.url).filter(Boolean));
  const inserted=[];
  const skipped=[];
  for(const row of incoming){
    if(ids.has(row.id)||urls.has(row.url)){
      skipped.push(row);
      continue;
    }
    ids.add(row.id);
    urls.add(row.url);
    inserted.push(row);
  }
  return {rows:[...existing,...inserted],inserted,skipped};
}

export function catalogMeta(rows){
  validateCatalog(rows);
  const batches=[];
  const seen=new Set();
  for(let index=rows.length-1;index>=0;index--){
    const batch=rows[index].batch;
    if(!seen.has(batch)){
      seen.add(batch);
      batches.push(batch);
    }
  }
  const latestBatch=batches[0]||'';
  const latestJobs=rows.filter(row=>row.batch===latestBatch);
  const latestVerified=latestJobs.map(row=>row.verified).filter(Boolean).sort().at(-1)||'';
  return {count:rows.length,batches,latestBatch,latestBatchCount:latestJobs.length,latestVerified};
}
