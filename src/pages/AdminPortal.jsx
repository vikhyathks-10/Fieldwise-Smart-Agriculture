import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Check, CircleAlert, Clock3, Leaf, Plus, RefreshCw, Search, Shield, Users, Warehouse, X } from 'lucide-react'
import api, { getError } from '../services/api'

const pretty=value=>String(value||'').replaceAll('_',' ').toLowerCase().replace(/^\w/,c=>c.toUpperCase())
const date=value=>value?new Date(value).toLocaleString():'—'
const Status=({value})=><span className={`portal-status status-${String(value||'').toLowerCase()}`}>{pretty(value)}</span>
function ErrorBanner({error,retry}){return error?<div className="alert"><CircleAlert size={16}/><span>{error}</span>{retry&&<button onClick={retry}>Retry</button>}</div>:null}

export function AdminOverviewPanel(){
 const [data,setData]=useState(null),[error,setError]=useState('')
 const load=()=>api.get('/admin/dashboard').then(r=>{setData(r.data);setError('')}).catch(e=>setError(getError(e)))
 useEffect(()=>{load()},[])
 const counts=data?.counts||{}
 return <section className="portal-section"><header className="portal-heading"><div><span className="eyebrow">ADMINISTRATOR WORKSPACE</span><h2>Review farmer activity</h2><p>Pending submissions stay separate from agricultural records until approved.</p></div><button className="button button-secondary button-small" onClick={load}><RefreshCw size={14}/> Refresh</button></header><ErrorBanner error={error} retry={load}/><div className="portal-stats"><div><Users/><b>{counts.pending_updates??'—'}</b><span>Pending updates</span></div><div><Check/><b>{counts.approved_updates??'—'}</b><span>Approved</span></div><div><X/><b>{counts.rejected_updates??'—'}</b><span>Rejected</span></div><div><Clock3/><b>{counts.clarification_updates??'—'}</b><span>Awaiting clarification</span></div></div><div className="portal-columns"><div className="panel portal-panel"><h3>Recent farmer updates</h3>{data?.recentUpdates?.length?data.recentUpdates.map(row=><Link className="portal-list-row" to="/admin/updates" key={row.update_id}><span><b>{row.title}</b><small>{row.farmer_name} · {row.farm_name} · {date(row.submitted_at)}</small></span><Status value={row.status}/></Link>):<p className="portal-muted">No update submissions are available.</p>}</div><div className="panel portal-panel"><h3>Agricultural advisories</h3>{data?.alerts?.length?data.alerts.map(row=><div className="portal-list-row" key={row.Advisory_ID}><span><b>{row.Title}</b><small>{row.Pest_Name||row.Type||'Advisory'} · {date(row.Advisory_Date)}</small></span><Leaf size={17}/></div>):<p className="portal-muted">No advisories are recorded.</p>}</div></div></section>
}

export function AdminFarmerDirectory(){
 const [query,setQuery]=useState(''),[rows,setRows]=useState([]),[profile,setProfile]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const load=()=>api.get('/admin/farmers',{params:{search:query}}).then(r=>{setRows(r.data);setError('')}).catch(e=>setError(getError(e)))
 useEffect(()=>{const timer=setTimeout(load,180);return()=>clearTimeout(timer)},[query])
 const open=async id=>{setBusy(true);try{setProfile((await api.get(`/admin/farmers/${id}`)).data)}catch(e){setError(getError(e))}finally{setBusy(false)}}
 return <section className="portal-section"><header className="portal-heading"><div><span className="eyebrow">FARMER MANAGEMENT</span><h2>Farmer directory</h2><p>Profiles, associated farms and cultivation history.</p></div><Link className="button button-small" to="/farmers"><Plus size={14}/> Farmer records</Link></header><ErrorBanner error={error}/><label className="portal-search"><Search size={15}/><input placeholder="Search by name, email or Farmer_ID" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="panel portal-table-wrap"><table><thead><tr><th>Farmer</th><th>Contact</th><th>Farms</th><th>Total area</th><th>Account</th><th/></tr></thead><tbody>{rows.map(row=><tr key={row.Farmer_ID}><td><b>{row.Name}</b><small>#{row.Farmer_ID}</small></td><td>{row.Email||row.Phone||'—'}</td><td>{row.farm_count}</td><td>{row.total_area??0}</td><td>{row.account_status?<Status value={row.account_status}/>:<span className="portal-status">No login</span>}</td><td><button className="button button-secondary button-small" onClick={()=>open(row.Farmer_ID)}>View</button></td></tr>)}{!rows.length&&<tr><td colSpan="6" className="portal-empty">No farmers match this search.</td></tr>}</tbody></table></div>{busy&&<p className="portal-muted">Loading profile…</p>}{profile&&<div className="panel portal-detail"><header><div><span className="eyebrow">FARMER PROFILE</span><h3>{profile.farmer.Name} · #{profile.farmer.Farmer_ID}</h3><p>{profile.farmer.Email||'No contact email'} · {profile.farmer.Phone||'No phone'}</p></div><button className="button button-secondary button-small" onClick={()=>setProfile(null)}>Close</button></header><h4>Farms</h4><div className="portal-chips">{profile.farms.map(f=><span key={f.Farm_ID}><Warehouse size={14}/>{f.Farm_Name||`Farm ${f.Farm_ID}`} · {f.Area??'—'} acres · {[f.Village,f.District,f.State].filter(Boolean).join(', ')||'No location'}</span>)}</div><h4>Submitted updates</h4><div className="portal-update-list">{profile.updates.map(u=><article className="panel portal-update-card" key={u.update_id}><div className="portal-update-head"><div><span className="eyebrow">UPDATE #{u.update_id} · {pretty(u.update_category)}</span><h3>{u.title}</h3><p>{u.farm_name||'Farm'}{u.crop_name?` · ${u.crop_name}`:''} · submitted {date(u.submitted_at)}</p></div><Status value={u.status}/></div><p>{u.description}</p><div className="portal-detail-grid"><span>Observed on<b>{u.observed_on||'—'}</b></span><span>Crop condition<b>{u.crop_condition||'—'}</b></span><span>Progress<b>{u.progress_details||'—'}</b></span><span>Requested field<b>{pretty(u.target_field)}</b></span><span>Requested value<b>{u.proposed_value||'—'}</b></span><span>Observed yield estimate<b>{u.yield_estimate??'—'}</b></span></div></article>)}{!profile.updates.length&&<div className="portal-empty">No submitted updates.</div>}</div><h4>Cultivation history</h4><div className="portal-table-wrap"><table><thead><tr><th>Crop</th><th>Farm</th><th>Dates</th><th>Status</th><th>Yield</th></tr></thead><tbody>{profile.cultivations.map(c=><tr key={c.Cultivation_ID}><td>{c.Crop_Name}</td><td>{c.Farm_Name}</td><td>{c.Start_Date||'—'} – {c.End_Date||'—'}</td><td>{c.Status||'—'}</td><td>{c.Yield_Estimate??'—'}</td></tr>)}{!profile.cultivations.length&&<tr><td colSpan="5" className="portal-empty">No cultivation rows.</td></tr>}</tbody></table></div></div>}</section>
}

export function AdminFarmsPage(){
 const [rows,setRows]=useState([]),[error,setError]=useState('')
 const load=()=>api.get('/admin/farms').then(r=>{setRows(r.data);setError('')}).catch(e=>setError(getError(e)))
 useEffect(()=>{load()},[])
 return <section className="portal-section"><header className="portal-heading"><div><span className="eyebrow">FARM MANAGEMENT</span><h2>Registered farms</h2><p>Farmers, locations, areas, soil type and cultivation totals.</p></div><Link className="button button-small" to="/farms"><Plus size={14}/> Manage farm records</Link></header><ErrorBanner error={error} retry={load}/><div className="panel portal-table-wrap"><table><thead><tr><th>Farm</th><th>Farmer</th><th>Area</th><th>Soil</th><th>Location</th><th>Cultivations</th></tr></thead><tbody>{rows.map(row=><tr key={row.Farm_ID}><td><b>{row.Farm_Name||`Farm ${row.Farm_ID}`}</b><small>#{row.Farm_ID}</small></td><td>{row.farmer_name} · #{row.Farmer_ID}</td><td>{row.Area??'—'}</td><td>{row.Soil_Type||'—'}</td><td>{[row.Village,row.District,row.State].filter(Boolean).join(', ')||'—'}</td><td>{row.cultivation_count}</td></tr>)}{!rows.length&&<tr><td colSpan="6" className="portal-empty">No farms are recorded.</td></tr>}</tbody></table></div></section>
}

export function AdminNotificationsPage(){
 const [rows,setRows]=useState([]),[error,setError]=useState('')
 const load=()=>api.get('/admin/notifications').then(r=>{setRows(r.data);setError('')}).catch(e=>setError(getError(e)))
 useEffect(()=>{load()},[])
 const mark=async id=>{try{await api.patch(`/admin/notifications/${id}/read`);load()}catch(e){setError(getError(e))}}
 return <section className="portal-section"><header className="portal-heading"><div><span className="eyebrow">ADMINISTRATOR INBOX</span><h2>Notifications</h2><p>New farmer submissions and clarification responses.</p></div><button className="button button-secondary button-small" onClick={load}><RefreshCw size={14}/> Refresh</button></header><ErrorBanner error={error}/><div className="portal-update-list">{rows.map(n=><article className="panel portal-notice" key={n.notification_id}><div><span className="eyebrow">{date(n.created_at)} · {n.is_read?'Read':'Unread'}</span><h3>{n.title}</h3><p>{n.message}</p></div>{!n.is_read&&<button className="button button-secondary button-small" onClick={()=>mark(n.notification_id)}>Mark read</button>}</article>)}{!rows.length&&<div className="panel portal-empty">No notifications.</div>}</div></section>
}

export function AdminUpdatesPage(){
 const [status,setStatus]=useState('PENDING'),[rows,setRows]=useState([]),[selected,setSelected]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const load=()=>api.get('/admin/updates',{params:status?{status}:{}}).then(r=>{setRows(r.data);setError('')}).catch(e=>setError(getError(e)))
 useEffect(()=>{load()},[status])
 const open=async id=>{try{setSelected((await api.get(`/admin/updates/${id}`)).data)}catch(e){setError(getError(e))}}
 const decide=async (decision,row=selected)=>{if(!row)return;const comment=window.prompt(decision==='APPROVED'?'Optional review note:':'Add a review reason or clarification request:','');if(decision!=='APPROVED'&&!comment?.trim())return;setBusy(true);try{await api.post(`/admin/updates/${row.update_id}/review`,{decision,comment:comment||null});setSelected(null);load()}catch(e){setError(getError(e))}finally{setBusy(false)}}
 return <section className="portal-section"><header className="portal-heading"><div><span className="eyebrow">FARMER COMMUNICATION</span><h2>Farmer updates</h2><p>Review submissions; only approval applies the requested change to the agricultural record.</p></div><button className="button button-secondary button-small" onClick={load}><RefreshCw size={14}/> Refresh</button></header><ErrorBanner error={error}/><div className="portal-filter"><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="CLARIFICATION_REQUESTED">Clarification requested</option><option value="">All updates</option></select></label></div><div className="portal-update-list">{rows.map(row=><article className="panel portal-update-card" key={row.update_id}><div className="portal-update-head"><div><span className="eyebrow">UPDATE #{row.update_id} · {pretty(row.update_category)}</span><h3>{row.title}</h3><p>{row.farmer_name} · {row.farm_name}{row.crop_name?` · ${row.crop_name}`:''} · {date(row.submitted_at)}</p></div><Status value={row.status}/></div><p>{row.description}</p><div className="portal-detail-grid"><span>Farmer ID<b>#{row.farmer_id}</b></span><span>Cultivation / crop<b>{row.cultivation_id?`#${row.cultivation_id}`:'—'}{row.cultivation_status?` · ${row.cultivation_status}`:''}{row.crop_name?` · ${row.crop_name}`:''}</b></span><span>Observed yield estimate<b>{row.yield_estimate??'—'}</b></span><span>Observed on<b>{row.observed_on||'—'}</b></span><span>Proposed field<b>{pretty(row.target_field)}</b></span><span>Proposed value<b>{row.proposed_value}</b></span><span>Crop condition<b>{row.crop_condition||'—'}</b></span><span>Progress<b>{row.progress_details||'—'}</b></span></div><div className="portal-actions"><button className="button button-secondary button-small" onClick={()=>open(row.update_id)}>Review history</button>{row.status==='PENDING'&&<><button disabled={busy} className="button button-small" onClick={()=>decide('APPROVED',row)}><Check size={14}/> Approve</button><button disabled={busy} className="button button-secondary button-small" onClick={()=>decide('CLARIFICATION_REQUESTED',row)}>Request clarification</button><button disabled={busy} className="button button-secondary button-small" onClick={()=>decide('REJECTED',row)}>Reject</button></>}</div></article>)}{!rows.length&&<div className="panel portal-empty">No updates match this status.</div>}</div>{selected?.history&&<div className="panel portal-detail"><header><div><span className="eyebrow">REVIEW HISTORY</span><h3>{selected.title} · #{selected.update_id}</h3></div><button className="button button-secondary button-small" onClick={()=>setSelected(null)}>Close</button></header><div className="portal-history">{selected.history.map(item=><div key={item.review_id}><Status value={item.decision}/><b>{item.admin_name||pretty(item.actor_type)}</b><span>{item.review_comment||'No comment'}</span><small>{date(item.reviewed_at)}</small></div>)}</div></div>}</section>
}

export function AdminManagementPage({user,section='farmers'}){
 const superAdmin=user?.type==='admin'&&user.role==='SUPER_ADMIN'
 const [farmers,setFarmers]=useState([]),[accounts,setAccounts]=useState([]),[admins,setAdmins]=useState([])
 const [query,setQuery]=useState(''),[statusFilter,setStatusFilter]=useState('ALL'),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false)
 const [selected,setSelected]=useState([]),[adminRows,setAdminRows]=useState([{name:'Yaseen Mulla',email:'',password:'',confirmPassword:'',role:'ADMIN'}])
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[results,setResults]=useState([])
 const load=async()=>{
  setLoading(true)
  try{
   const [f,a,adminsResponse]=await Promise.all([api.get('/admin/farmers'),api.get('/admin/farmer-accounts'),superAdmin?api.get('/admin/admins'):Promise.resolve({data:[]})])
   setFarmers(f.data);setAccounts(a.data);setAdmins(adminsResponse.data);setError('')
  }catch(e){setError(getError(e))}finally{setLoading(false)}
 }
 useEffect(()=>{if(section!=='admins'||superAdmin)load()},[section,superAdmin])
 if(section==='admins'&&!superAdmin)return <section className="portal-section"><ErrorBanner error="Administrator account management is restricted to the Super Administrator."/></section>
 const linkedIds=new Set(accounts.map(row=>Number(row.farmer_id)))
 const filteredFarmers=farmers.filter(row=>{
  const linked=linkedIds.has(Number(row.Farmer_ID)),account=accounts.find(item=>Number(item.farmer_id)===Number(row.Farmer_ID))
  const term=query.trim().toLowerCase(),matches=!term||[row.Name,row.Email,row.login_email,row.Farmer_ID].some(value=>String(value||'').toLowerCase().includes(term))
  const matchesStatus=statusFilter==='ALL'||(statusFilter==='NO_ACCOUNT'&&!linked)||(statusFilter==='LINKED'&&linked)||(statusFilter==='ACTIVE'&&account?.status==='ACTIVE')||(statusFilter==='INACTIVE'&&account?.status!=='ACTIVE'&&linked)
  return matches&&matchesStatus
 })
 const toggleFarmer=row=>setSelected(current=>{
  const id=Number(row.Farmer_ID)
  return current.some(item=>item.farmerId===id)?current.filter(item=>item.farmerId!==id):[...current,{farmerId:id,name:row.Name,email:row.Email||'',password:''}]
 })
 const updateSelected=(id,key,value)=>setSelected(rows=>rows.map(row=>row.farmerId===id?{...row,[key]:value}:row))
 const submitFarmerBatch=async event=>{
  event.preventDefault();setError('');setNotice('');setResults([])
  if(!selected.length){setError('Select at least one farmer who does not already have a login account.');return}
  if(selected.some(row=>!row.email||!row.password)){setError('Enter an email address and password for every selected farmer.');return}
  if(!window.confirm(`Create login accounts for ${selected.length} selected farmer${selected.length===1?'':'s'}?`))return
  setBusy(true)
  try{
   const response=await api.post('/admin/farmer-accounts/bulk',{accounts:selected.map(({farmerId,email,password})=>({farmerId,email,password}))})
   setResults(response.data.results||[])
   if(response.data.ok){setNotice(`Created ${response.data.results.length} farmer account${response.data.results.length===1?'':'s'}.`);setSelected([]);await load()}else setError(response.data.message||'The batch was not created.')
  }catch(e){const data=e?.response?.data;if(data?.results){setResults(data.results);setError(data.message||'The batch was not created.')}else setError(getError(e))}
  finally{setBusy(false)}
 }
 const updateAdminRow=(index,key,value)=>setAdminRows(rows=>rows.map((row,i)=>i===index?{...row,[key]:value}:row))
 const addAdminRow=()=>setAdminRows(rows=>rows.length<50?[...rows,{name:'',email:'',password:'',confirmPassword:'',role:'ADMIN'}]:rows)
 const removeAdminRow=index=>setAdminRows(rows=>rows.length===1?rows:rows.filter((_,i)=>i!==index))
 const submitAdminBatch=async event=>{
  event.preventDefault();setError('');setNotice('');setResults([])
  if(adminRows.some(row=>!row.name.trim()||!row.email||!row.password||!row.confirmPassword)){setError('Complete every administrator name, email and password field.');return}
  if(adminRows.some(row=>row.password!==row.confirmPassword)){setError('Password confirmation does not match for every administrator.');return}
  if(adminRows.some(row=>row.role!=='ADMIN')){setError('Only ADMIN accounts can be created here.');return}
  const yaseenAlreadyExists=admins.some(row=>String(row.name||'').trim().toLowerCase()==='yaseen mulla')
  if(yaseenAlreadyExists&&adminRows.some(row=>row.name.trim().toLowerCase()==='yaseen mulla')){setError('Yaseen Mulla already has an administrator account. Choose a different name or do not submit a duplicate.');return}
  if(!window.confirm(`Create ${adminRows.length} ADMIN account${adminRows.length===1?'':'s'}?`))return
  setBusy(true)
  try{
   const response=await api.post('/admin/admins/bulk',{accounts:adminRows.map(({name,email,password,role})=>({name,email,password,role}))})
   setResults(response.data.results||[])
   if(response.data.ok){setNotice(`Created ${response.data.results.length} administrator account${response.data.results.length===1?'':'s'}.`);setAdminRows([{name:'',email:'',password:'',confirmPassword:'',role:'ADMIN'}]);await load()}else setError(response.data.message||'The batch was not created.')
  }catch(e){const data=e?.response?.data;if(data?.results){setResults(data.results);setError(data.message||'The batch was not created.')}else setError(getError(e))}
  finally{setBusy(false)}
 }
 const setAccountStatus=async(type,id,current)=>{
  const next=current==='ACTIVE'?'INACTIVE':'ACTIVE'
  if(!window.confirm(`${next==='INACTIVE'?'Deactivate':'Reactivate'} this ${type==='admins'?'administrator':'farmer'} login? The original farmer record will remain unchanged.`))return
  setBusy(true);setError('');setNotice('')
  try{await api.patch(`/admin/${type}/${id}/status`,{status:next});setNotice(`Account ${next.toLowerCase()}.`);await load()}catch(e){setError(getError(e))}finally{setBusy(false)}
 }
 const header=section==='admins'?{eyebrow:'SUPER ADMINISTRATOR',title:'Administrator management',description:'Create and manage ADMIN accounts. New Super Administrator accounts cannot be created here.'}:{eyebrow:'FARMER ACCOUNTS',title:'Farmer account management',description:'Link portal logins to existing farmers. Account deactivation never deletes farmer or agricultural records.'}
 return <section className="portal-section">
  <header className="portal-heading"><div><span className="eyebrow">{header.eyebrow}</span><h2>{header.title}</h2><p>{header.description}</p></div><button className="button button-secondary button-small" onClick={load} disabled={loading}><RefreshCw size={14}/>{loading?'Loading…':'Refresh'}</button></header>
  <div className="portal-account-tabs"><Link className={`button button-small ${section==='farmers'?'':'button-secondary'}`} to="/admin/farmer-accounts"><Users size={14}/> Farmer accounts</Link>{superAdmin&&<Link className={`button button-small ${section==='admins'?'':'button-secondary'}`} to="/admin/administrator-accounts"><Shield size={14}/> Administrators</Link>}</div>
  <ErrorBanner error={error}/>{notice&&<div className="portal-success">{notice}</div>}
  {section==='farmers'?<>
   <form className="panel portal-bulk-form" onSubmit={submitFarmerBatch}>
    <div className="portal-heading compact"><div><h3>Create login accounts for farmers</h3><p>Select farmers without accounts below. Each selected farmer needs a unique email and password.</p></div></div>
    {selected.map(row=><div className="portal-bulk-row" key={row.farmerId}><div><b>{row.name}</b><small>Farmer ID #{row.farmerId}</small></div><label>Email<input required type="email" maxLength="254" value={row.email} onChange={e=>updateSelected(row.farmerId,'email',e.target.value)} autoComplete="off"/></label><label>Password<input required type="password" minLength="12" maxLength="128" value={row.password} onChange={e=>updateSelected(row.farmerId,'password',e.target.value)} autoComplete="new-password"/></label><button type="button" className="button button-secondary button-small" onClick={()=>setSelected(rows=>rows.filter(item=>item.farmerId!==row.farmerId))} aria-label={`Remove farmer ${row.farmerId}`}>Remove</button></div>)}
    <div className="portal-form-actions"><small>Passwords require at least 12 characters and are bcrypt-hashed before storage.</small><button className="button button-small" disabled={busy||loading||selected.length===0}><Plus size={14}/>{busy?'Creating…':`Create ${selected.length||''} selected account${selected.length===1?'':'s'}`}</button></div>
   </form>
   <div className="portal-filter portal-account-filters"><label>Search<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, email or Farmer_ID"/></label><label>Account status<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="ALL">All farmers</option><option value="NO_ACCOUNT">No login account</option><option value="LINKED">Has login account</option><option value="ACTIVE">Active account</option><option value="INACTIVE">Inactive account</option></select></label></div>
   <div className="panel portal-table-wrap"><table><thead><tr><th>Select</th><th>Farmer ID</th><th>Farmer</th><th>Registered email</th><th>Login email</th><th>Account status</th><th>Created</th><th/></tr></thead><tbody>{filteredFarmers.map(row=>{const account=accounts.find(item=>Number(item.farmer_id)===Number(row.Farmer_ID));const exists=!!account;return <tr key={row.Farmer_ID}><td>{!exists&&<input type="checkbox" checked={selected.some(item=>item.farmerId===Number(row.Farmer_ID))} onChange={()=>toggleFarmer(row)} aria-label={`Select ${row.Name}`}/>}</td><td>#{row.Farmer_ID}</td><td><b>{row.Name}</b></td><td>{row.Email||'—'}</td><td>{account?.email||'—'}</td><td><Status value={account?.status||'NO_ACCOUNT'}/></td><td>{date(account?.created_at)}</td><td>{account&&<button className="button button-secondary button-small" disabled={busy} onClick={()=>setAccountStatus('farmer-accounts',account.account_id,account.status)}>{account.status==='ACTIVE'?'Deactivate':'Activate'}</button>}</td></tr>})}{!loading&&!filteredFarmers.length&&<tr><td colSpan="8" className="portal-empty">No farmers match these filters.</td></tr>}{loading&&<tr><td colSpan="8" className="portal-empty">Loading farmers…</td></tr>}</tbody></table></div>
  </>:<>
   <form className="panel portal-bulk-form" onSubmit={submitAdminBatch}>
    <div className="portal-heading compact"><div><h3>Create ADMIN accounts</h3><p>All entries are validated before the atomic batch is written. Password confirmation is checked in the browser.</p><small>{admins.some(row=>String(row.name||'').trim().toLowerCase()==='yaseen mulla')?'Yaseen Mulla already has an account.':'The first row is prepared for Yaseen Mulla; enter his unique email and set his password securely.'}</small></div><button type="button" className="button button-secondary button-small" onClick={addAdminRow} disabled={adminRows.length>=50}><Plus size={14}/> Add administrator</button></div>
    {adminRows.map((row,index)=><div className="portal-bulk-row admin-bulk-row" key={index}><div><b>Administrator {index+1}</b><small>Role: ADMIN</small></div><label>Full name<input required minLength="2" maxLength="120" value={row.name} onChange={e=>updateAdminRow(index,'name',e.target.value)}/></label><label>Email<input required type="email" maxLength="254" value={row.email} onChange={e=>updateAdminRow(index,'email',e.target.value)} autoComplete="off"/></label><label>Password<input required type="password" minLength="12" maxLength="128" value={row.password} onChange={e=>updateAdminRow(index,'password',e.target.value)} autoComplete="new-password"/></label><label>Confirm password<input required type="password" minLength="12" maxLength="128" value={row.confirmPassword} onChange={e=>updateAdminRow(index,'confirmPassword',e.target.value)} autoComplete="new-password"/></label><button type="button" className="button button-secondary button-small" onClick={()=>removeAdminRow(index)} disabled={adminRows.length===1}>Remove</button></div>)}
    <div className="portal-form-actions"><small>No additional SUPER_ADMIN accounts can be created here. Passwords are never returned by the API.</small><button className="button button-small" disabled={busy}>{busy?'Creating…':`Create ${adminRows.length} ADMIN account${adminRows.length===1?'':'s'}`}</button></div>
   </form>
   <div className="portal-filter portal-account-filters"><label>Search<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Administrator name or email"/></label><label>Status<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label></div>
   <div className="panel portal-table-wrap"><table><thead><tr><th>Admin ID</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th/></tr></thead><tbody>{admins.filter(row=>{const term=query.trim().toLowerCase(),matches=!term||[row.name,row.email,row.admin_id].some(value=>String(value||'').toLowerCase().includes(term));return matches&&(statusFilter==='ALL'||row.status===statusFilter)}).map(row=>{const self=Number(row.admin_id)===Number(user.id);return <tr key={row.admin_id}><td>#{row.admin_id}</td><td><b>{row.name}</b>{self&&<small>Current account</small>}</td><td>{row.email}</td><td><Status value={row.role}/></td><td><Status value={row.status}/></td><td>{date(row.created_at)}</td><td>{!self&&<button className="button button-secondary button-small" disabled={busy} onClick={()=>setAccountStatus('admins',row.admin_id,row.status)}>{row.status==='ACTIVE'?'Deactivate':'Activate'}</button>}</td></tr>})}{!loading&&!admins.length&&<tr><td colSpan="7" className="portal-empty">No administrator accounts are available.</td></tr>}{loading&&<tr><td colSpan="7" className="portal-empty">Loading administrators…</td></tr>}</tbody></table></div>
  </>}
  {results.length>0&&<div className="panel portal-batch-results"><h3>Batch results</h3>{results.map((row,index)=><div key={`${row.email}-${index}`} className={`portal-batch-result ${row.status==='CREATED'?'is-success':'is-error'}`}><span><b>{row.name||`Farmer #${row.farmerId}`||row.email}</b><small>{row.email}</small></span><Status value={row.status}/><span>{row.error||'Account created.'}</span></div>)}</div>}
 </section>
}
