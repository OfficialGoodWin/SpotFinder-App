import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// #region agent log
window.addEventListener('error', (event) => {
  try {
    const err = event?.error;
    fetch('http://127.0.0.1:7263/ingest/053377fc-69ae-42c1-8e31-75a19d8aad14',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1220c6'},body:JSON.stringify({sessionId:'1220c6',runId:'pre-fix',hypothesisId:'G',location:'src/main.jsx:11',message:'window.error',data:{message:String(event?.message||''),filename:String(event?.filename||''),lineno:event?.lineno,colno:event?.colno,stack:err?.stack?String(err.stack).slice(0,2000):null},timestamp:Date.now()})}).catch(()=>{});
  } catch (_) { }
});
window.addEventListener('unhandledrejection', (event) => {
  try {
    const r = event?.reason;
    fetch('http://127.0.0.1:7263/ingest/053377fc-69ae-42c1-8e31-75a19d8aad14',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1220c6'},body:JSON.stringify({sessionId:'1220c6',runId:'pre-fix',hypothesisId:'G',location:'src/main.jsx:18',message:'window.unhandledrejection',data:{reasonType:typeof r,reasonMessage:r?.message?String(r.message):String(r??''),reasonStack:r?.stack?String(r.stack).slice(0,2000):null},timestamp:Date.now()})}).catch(()=>{});
  } catch (_) { }
});
// #endregion

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
