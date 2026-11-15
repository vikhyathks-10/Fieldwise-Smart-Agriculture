import { useEffect, useMemo, useState } from 'react'
import api, { getError } from '../services/api'
import { tables } from '../../shared/schema.js'

const operationLabels={select:'SELECT records',insert:'INSERT record',update:'UPDATE record',delete:'DELETE record'}
const descriptions={
 select:'Reads current rows from the selected MySQL table.',
 insert:'Creates one validated row through the existing service and repository path.',
 update:'Updates one selected field on the row identified by its primary key.',
 delete:'Deletes only the row identified by its primary key. The database enforces foreign keys.'
}
const valueFor=(value,type)=>type==='number'&&value!==''&&value!=null?Number(value):value

function OperationResult({result,submitted,error}){
 if(!result&&!error)return null
 const execution=result?.execution
 const rows=result?.rows|| (result?.record?[result.record]:null)
 const summary=result?{...(result.record||{}),affectedRows:execution?.affectedRows??result.affectedRows??null,insertId:execution?.insertId??null}:null
 return <div className="workbench-result" aria-live="polite">
  <span className={`op-state ${error?'warn':'ok'}`}>{error?'Failed':result?.operation==='select'?'Executed · SELECT':`Executed · ${operationLabels[result?.operation]||'database operation'}`}</span>
  {execution?.statement&&<><p><b>Executed SQL</b></p><pre>{execution.statement}</pre></>}
  {submitted&&Object.keys(submitted).length>0&&<><p><b>Input parameters</b></p><pre>{JSON.stringify(submitted,null,2)}</pre></>}
  {error&&<div className="alert">{error}</div>}
  {result&&execution&&<p className="workbench-metrics">MySQL result: {result.operation==='select'?`${execution.rowCount} row(s) returned`:`${execution.affectedRows??0} row(s) affected`}{execution.insertId?` · ID ${execution.insertId}`:''}</p>}
  {Array.isArray(rows)&&rows.length>0&&<div className="op-result"><table><thead><tr>{Object.keys(rows[0]).map(key=><th key={key}>{key}</th>)}</tr></thead><tbody>{rows.slice(0,30).map((row,index)=><tr key={index}>{Object.keys(rows[0]).map(key=><td key={key}>{row[key]===null?'NULL':String(row[key])}</td>)}</tr>)}</tbody></table></div>}
  {result&&summary&&result.operation!=='select'&&<div className="workbench-metrics">{Object.entries(summary).filter(([,value])=>value!==null).map(([key,value])=><span key={key}>{key}: {String(value)}</span>)}</div>}
 </div>
}

export function SqlCrudWorkbench(){
 const [slug,setSlug]=useState('farmers'),[operation,setOperation]=useState('select'),[id,setId]=useState(''),[form,setForm]=useState({}),[field,setField]=useState(''),[fieldValue,setFieldValue]=useState(''),[busy,setBusy]=useState(false),[result,setResult]=useState(null),[error,setError]=useState(''),[submitted,setSubmitted]=useState(null)
 const meta=tables[slug]
 const updateFields=useMemo(()=>meta.fields.filter(([key])=>key!==meta.key),[meta])
 const updateField=updateFields.some(([key])=>key===field)?field:updateFields[0]?.[0]
 const updateMeta=updateFields.find(([key])=>key===updateField)
 const reset=()=>{setResult(null);setError('');setSubmitted(null)}
 const run=async event=>{
  event.preventDefault();reset()
  if(operation==='delete'&&!window.confirm(`Delete ${meta.label} record #${id}? MySQL will enforce its foreign-key constraints.`))return
  const data=operation==='insert'?Object.fromEntries(meta.fields.map(([key,,type])=>[key,valueFor(form[key]??'',type)])):operation==='update'?{[updateField]:valueFor(fieldValue,updateMeta?.[2])}:undefined
  const params=operation==='insert'?data:operation==='update'?{id,...data}:operation==='delete'?{id}:{}
  setSubmitted(params);setBusy(true)
  try{const response=await api.post('/database-operations/execute',{operation,slug,id,data});setResult(response.data)}
  catch(err){setError(getError(err))}
  finally{setBusy(false)}
 }
 return <section className="panel op-card workbench-card">
  <div className="panel-head"><div><span className="eyebrow">PREDEFINED DML / CRUD</span><h3>Execute a database-backed operation</h3></div><span className="op-state">Allowlisted tables · bound values</span></div>
  <p>Choose a resource and operation. This form calls the normal route/controller/service/repository chain; SQL is never entered in the browser.</p>
  <form onSubmit={run}>
   <div className="workbench-controls">
    <label>Resource<select value={slug} onChange={event=>{setSlug(event.target.value);setForm({});reset()}}>{Object.entries(tables).map(([key,item])=><option key={key} value={key}>{item.label}</option>)}</select></label>
    <label>Operation<select value={operation} onChange={event=>{setOperation(event.target.value);reset()}}>{Object.entries(operationLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   </div>
   <p className="workbench-description">{descriptions[operation]}</p>
   {operation==='insert'&&<div className="form-grid workbench-fields">{meta.fields.map(([key,label,type])=><label className={type==='textarea'?'span-two':''} key={key}><span>{label}{meta.required.includes(key)&&<i> *</i>}</span>{type==='textarea'?<textarea rows="2" required={meta.required.includes(key)} value={form[key]??''} onChange={event=>setForm({...form,[key]:event.target.value})}/>:<input type={type==='number'?'number':type} step={type==='number'?'any':undefined} required={meta.required.includes(key)} value={form[key]??''} onChange={event=>setForm({...form,[key]:event.target.value})}/>}</label>)}</div>}
   {(operation==='update'||operation==='delete')&&<label className="workbench-input">{meta.key} <input type="number" min="1" required value={id} onChange={event=>setId(event.target.value)} placeholder={`Enter ${meta.key}`}/></label>}
   {operation==='update'&&<div className="workbench-controls"><label>Column<select value={updateField} onChange={event=>setField(event.target.value)}>{updateFields.map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label><label>New value<input type={updateMeta?.[2]==='number'?'number':updateMeta?.[2]||'text'} step={updateMeta?.[2]==='number'?'any':undefined} required value={fieldValue} onChange={event=>setFieldValue(event.target.value)}/></label></div>}
   <div className="workbench-actions"><button className="button" disabled={busy}>{busy?'Executing…':operationLabels[operation]}</button><span className="op-state">{meta.table} · primary key {meta.key}</span></div>
  </form>
  <OperationResult result={result} submitted={submitted} error={error}/>
 </section>
}

export function FarmerFarmSummaryView(){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const load=async()=>{setBusy(true);setError('');try{const response=await api.get('/database-operations/views/farmer-farm-summary');setData(response.data)}catch(err){setError(getError(err))}finally{setBusy(false)}}
 useEffect(()=>{load()},[])
 return <section className="panel op-card"><div className="panel-head"><div><span className="eyebrow">DATABASE VIEW</span><h3>Farmer_Farm_Summary</h3></div><button className="text-button" disabled={busy} onClick={load}>{busy?'Loading…':'Refresh view rows'}</button></div><p>Read-only view with farmers, farms and locations. LEFT JOIN keeps farmers with no farm; contact fields are excluded.</p><pre>{data?.statement||'SELECT Farmer_ID, Farmer_Name, Farm_ID, Farm_Name, Area, Soil_Type, Location_ID, Village, District, State FROM Farmer_Farm_Summary ORDER BY Farmer_ID, Farm_ID;'}</pre>{error?<div className="alert">{error}</div>:<span className={`op-state ${data?'ok':'warn'}`}>{data?'SELECT from view succeeded':'Loading view'}</span>}{data&&<ResultRows rows={data.rows}/>}</section>
}

export function CultivationTransactionWorkbench(){
 const [farms,setFarms]=useState([]),[crops,setCrops]=useState([]),[form,setForm]=useState({}),[busy,setBusy]=useState(false),[result,setResult]=useState(null),[error,setError]=useState('')
 useEffect(()=>{Promise.all([api.get('/farms'),api.get('/crops'),api.get('/cultivation')]).then(([farmRows,cropRows,cultivationRows])=>{setFarms(farmRows.data);setCrops(cropRows.data);const nextId=Math.max(0,...cultivationRows.data.map(row=>Number(row.Cultivation_ID)||0))+1;setForm({Cultivation_ID:nextId,Farm_ID:farmRows.data[0]?.Farm_ID??'',Crop_ID:cropRows.data[0]?.Crop_ID??'',Start_Date:'',End_Date:'',Status:'Planned',Yield_Estimate:'',Remarks:''})}).catch(err=>setError(getError(err)))},[])
 const set=(key,value)=>setForm(previous=>({...previous,[key]:value}))
 const submit=async event=>{event.preventDefault();setBusy(true);setResult(null);setError('');try{const body={...form,Cultivation_ID:Number(form.Cultivation_ID),Farm_ID:Number(form.Farm_ID),Crop_ID:Number(form.Crop_ID),Yield_Estimate:form.Yield_Estimate===''?null:Number(form.Yield_Estimate)};const response=await api.post('/cultivation/transaction',body);setResult(response.data)}catch(err){const transactionStatus=err?.response?.data?.transactionStatus;if(transactionStatus)setResult({transaction:{status:transactionStatus,steps:[]}});setError(getError(err))}finally{setBusy(false)}}
 return <section className="panel op-card workbench-card"><div className="panel-head"><div><span className="eyebrow">TRANSACTION WORKFLOW</span><h3>Register cultivation atomically</h3></div><span className="op-state">MySQL transaction · commit or rollback</span></div><p>Locks and verifies the selected Farm and Crop, inserts one Cultivation row, reads it back, then commits. Any error rolls the operation back.</p>
  <form onSubmit={submit}><div className="workbench-controls"><label>Cultivation ID<input type="number" min="1" required value={form.Cultivation_ID??''} onChange={event=>set('Cultivation_ID',event.target.value)}/></label><label>Farm<select required value={form.Farm_ID??''} onChange={event=>set('Farm_ID',event.target.value)}><option value="">Select farm</option>{farms.map(row=><option value={row.Farm_ID} key={row.Farm_ID}>{row.Farm_Name||`Farm ${row.Farm_ID}`} · #{row.Farm_ID}</option>)}</select></label><label>Crop<select required value={form.Crop_ID??''} onChange={event=>set('Crop_ID',event.target.value)}><option value="">Select crop</option>{crops.map(row=><option value={row.Crop_ID} key={row.Crop_ID}>{row.Crop_Name} · #{row.Crop_ID}</option>)}</select></label><label>Start date<input type="date" value={form.Start_Date??''} onChange={event=>set('Start_Date',event.target.value)}/></label><label>End date<input type="date" value={form.End_Date??''} onChange={event=>set('End_Date',event.target.value)}/></label><label>Status<input value={form.Status??''} onChange={event=>set('Status',event.target.value)}/></label><label>Yield estimate<input type="number" step="0.01" value={form.Yield_Estimate??''} onChange={event=>set('Yield_Estimate',event.target.value)}/></label><label>Remarks<input value={form.Remarks??''} onChange={event=>set('Remarks',event.target.value)}/></label></div><div className="workbench-actions"><button className="button" disabled={busy||!farms.length||!crops.length}>{busy?'Saving transaction…':'Register cultivation'}</button>{!farms.length||!crops.length?<span className="op-state warn">Farm and crop rows are required before registration.</span>:null}</div></form>
  {error&&<div className="alert">{error}{result?.transaction?.status==='rolled_back'?' · MySQL transaction rolled back.':''}</div>}
  {result?.transaction&&<div className="workbench-result"><span className="op-state ok">Transaction {result.transaction.status}</span><p><b>Input parameters</b></p><pre>{JSON.stringify({Cultivation_ID:form.Cultivation_ID,Farm_ID:form.Farm_ID,Crop_ID:form.Crop_ID},null,2)}</pre>{result.transaction.steps.map((step,index)=><div key={index}><p><b>Step {index+1} · {step.rowCount!==undefined?`${step.rowCount} row(s) read`:step.affectedRows!==undefined?`${step.affectedRows} row(s) affected`:'statement'}</b></p><pre>{step.statement}</pre></div>)}<p><b>Committed MySQL row</b></p><ResultRows rows={result.cultivation?[result.cultivation]:[]}/></div>}
 </section>
}

function ResultRows({rows}){if(!Array.isArray(rows)||!rows.length)return <span className="op-state">Query returned 0 rows.</span>;const columns=Object.keys(rows[0]);return <div className="op-result"><table><thead><tr>{columns.map(column=><th key={column}>{column}</th>)}</tr></thead><tbody>{rows.slice(0,30).map((row,index)=><tr key={index}>{columns.map(column=><td key={column}>{row[column]===null?'NULL':String(row[column])}</td>)}</tr>)}</tbody></table></div>}
