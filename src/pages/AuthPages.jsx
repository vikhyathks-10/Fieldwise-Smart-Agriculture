import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Leaf, LockKeyhole, Sprout } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { getError } from '../services/api'

export function LoginChooser() {
  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><span><Sprout size={23}/></span><div><b>fieldwise</b><small>AGRICULTURE, IN FOCUS</small></div></div><p className="eyebrow">WELCOME TO FIELDWISE</p><h1>Choose your portal</h1><p className="auth-copy">Sign in using the account created for your role.</p><div className="auth-role-links"><Link to="/login/admin"><LockKeyhole size={18}/><span><b>Administrator</b><small>Manage farmers, records and updates</small></span></Link><Link to="/login/farmer"><Leaf size={18}/><span><b>Farmer</b><small>View your farms and share progress</small></span></Link></div></section></main>
}

export function LoginPage({ role }) {
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const {login}=useAuth(),navigate=useNavigate()
  const isAdmin=role==='admin'
  const submit=async event=>{
    event.preventDefault();setError('');setBusy(true)
    try { const user=await login(role,{email,password});navigate(user.type==='admin'?'/':'/farmer',{replace:true}) }
    catch (failure) { setError(getError(failure)) }
    finally { setBusy(false) }
  }
  return <main className="auth-page"><section className="auth-card"><Link to="/login" className="auth-back"><ArrowLeft size={15}/> Choose a different portal</Link><div className="auth-brand"><span>{isAdmin?<LockKeyhole size={22}/>:<Leaf size={22}/>}</span><div><b>fieldwise</b><small>{isAdmin?'ADMINISTRATOR PORTAL':'FARMER PORTAL'}</small></div></div><p className="eyebrow">{isAdmin?'SECURE ADMIN ACCESS':'YOUR FIELDWISE ACCOUNT'}</p><h1>{isAdmin?'Administrator sign in':'Farmer sign in'}</h1><p className="auth-copy">{isAdmin?'Use an administrator account created by the bootstrap process or another authorized administrator.':'Sign in with the account linked to your existing Farmer record.'}</p>{error&&<div className="auth-error" role="alert">{error}</div>}<form className="auth-form" onSubmit={submit}><label>Email address<input type="email" autoComplete="username" required maxLength="254" value={email} onChange={event=>setEmail(event.target.value)}/></label><label>Password<input type="password" autoComplete="current-password" required maxLength="128" value={password} onChange={event=>setPassword(event.target.value)}/></label><button className="button auth-submit" disabled={busy}>{busy?'Signing in…':'Sign in'}</button></form><p className="auth-footnote">Passwords are verified by the Fieldwise backend. Administrator self-registration is disabled.</p></section></main>
}
