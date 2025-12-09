 import React, { useState, useMemo, useEffect } from 'react';
import { db, auth } from '../firebase'; 
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, setDoc, query, orderBy } from 'firebase/firestore';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { FaHome, FaWallet, FaTrash, FaPlus, FaEdit, FaChevronDown, FaChevronUp, FaTimes, FaUserClock, FaLock, FaSignOutAlt, FaHistory, FaListAlt, FaUserShield, FaBolt, FaExchangeAlt } from 'react-icons/fa';
import { BiDish } from "react-icons/bi";

// ==========================================
// ⚙️ CLIENT CONFIGURATION SECTION (EDIT HERE)
// ==========================================
// বিক্রির সময় ক্লায়েন্ট শুধু এই অংশটুকু এডিট করবে
const APP_NAME = "Smart Mess Manager";
const CURRENCY = "৳";

// --- CONFIGURATION ---
const MEMBERS_CONFIG = [
  { id: 1, name: 'Amit', startDay: 1, endDay: 6 },
  { id: 2, name: 'Tofayel', startDay: 7, endDay: 12 },
  { id: 3, name: 'Abid', startDay: 13, endDay: 18 },
  { id: 4, name: 'Awal', startDay: 19, endDay: 24 },
  { id: 5, name: 'Guest', startDay: 25, endDay: 30 },
];

// 🔴 গুরত্বপূর্ণ: এখানে আপনার Firebase এর আসল ইমেইলগুলো বসান
// যেই ইমেইল যার আইডির সাথে মিলবে, সে শুধু তার ডাটাই এডিট করতে পারবে
const MEMBER_EMAILS = {
  'amit330@d.com': 1,  // Example Email -> ID 1 (Rahim)
  'tofayel330@d.com': 2,  // Example Email -> ID 2 (Karim)
  'abid330@d.com': 3,
  'awal330@d.com': 4,
  'jabbar@d.com': 5
};
// ==========================================

const Home = () => {
  // --- AUTH & USER STATE ---
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // --- APP UTILS ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const today = new Date();
  const currentMonthName = today.toLocaleString('default', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const currentDay = today.getDate();

  // --- IDENTIFY CURRENT MEMBER ---
  const loggedInMemberId = useMemo(() => {
    return user && MEMBER_EMAILS[user.email] ? MEMBER_EMAILS[user.email] : null;
  }, [user]);

  const loggedInMemberInfo = useMemo(() => {
    return loggedInMemberId ? MEMBERS_CONFIG.find(m => m.id === loggedInMemberId) : null;
  }, [loggedInMemberId]);

  // Check if today is my shift
  const isMyShiftToday = useMemo(() => {
    if (!loggedInMemberInfo) return false;
    return currentDay >= loggedInMemberInfo.startDay && currentDay <= loggedInMemberInfo.endDay;
  }, [currentDay, loggedInMemberInfo]);

  // --- DATA FETCHING ---
  const [bazaarList, setBazaarList] = useState([]);
  const [mealSheet, setMealSheet] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "bazaar"), orderBy("timestamp", "desc"));
    const unsubscribeBazaar = onSnapshot(q, (snapshot) => {
      setBazaarList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubscribeMeals = onSnapshot(doc(db, "settings", "mealSheet"), (docSnap) => {
      if (docSnap.exists()) {
        setMealSheet(docSnap.data().sheet);
      } else {
        const initialSheet = [];
        for (let i = 1; i <= daysInMonth; i++) {
          const dailyStatus = {};
          MEMBERS_CONFIG.forEach(m => dailyStatus[m.id] = true);
          initialSheet.push({ day: i, status: dailyStatus });
        }
        setDoc(doc(db, "settings", "mealSheet"), { sheet: initialSheet });
      }
      setDataLoading(false);
    });
    return () => { unsubscribeBazaar(); unsubscribeMeals(); };
  }, [user, daysInMonth]);

  // --- FORM STATES ---
  const [inputDate, setInputDate] = useState(today.toISOString().split('T')[0]);
  const [currentItems, setCurrentItems] = useState([{ name: '', price: '' }]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedDateId, setExpandedDateId] = useState(null);
  
  // 🔥 New Features State
  const [expenseType, setExpenseType] = useState('Regular'); // 'Regular', 'Extra'
  const [isProxy, setIsProxy] = useState(false); // Proxy Toggle
  const [proxyForId, setProxyForId] = useState(''); // Car hoye bazar korche

  // --- ACTIONS ---
  const handleLogin = async (e) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, loginEmail, loginPass); setLoginError(''); } 
    catch (error) { setLoginError('Invalid Credentials'); }
  };
  const handleLogout = async () => await signOut(auth);

  const addItemField = () => setCurrentItems([...currentItems, { name: '', price: '' }]);
  const handleItemChange = (idx, field, val) => {
    const newItems = [...currentItems]; newItems[idx][field] = val; setCurrentItems(newItems);
  };
  const removeItemField = (idx) => setCurrentItems(currentItems.filter((_, i) => i !== idx));
  
  const openAddModal = () => {
      setShowAddModal(true);
      setEditingId(null);
      setCurrentItems([{ name: '', price: '' }]);
      setExpenseType('Regular');
      setIsProxy(!isMyShiftToday); // If not my shift, auto suggest proxy
      setProxyForId(isMyShiftToday ? loggedInMemberId : '');
  };

  const handleEdit = (entry) => {
    if(entry.createdBy !== user.email) { alert("Access Denied"); return; }
    setInputDate(entry.date); setCurrentItems(entry.items); setEditingId(entry.id);
    setExpenseType(entry.type || 'Regular');
    setIsProxy(entry.isProxy || false);
    setProxyForId(entry.originalShopperId || entry.shopperId);
    setShowAddModal(true); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitBazaar = async (e) => {
    e.preventDefault();
    
    // Proxy Validation
    let finalOriginalShopperId = loggedInMemberId;
    
    if (isProxy) {
        if(!proxyForId) { alert("Please select who you are shopping for."); return; }
        finalOriginalShopperId = parseInt(proxyForId);
    } else {
        // If not proxy, strict shift check logic
        if (!isMyShiftToday && expenseType === 'Regular') {
             if(!window.confirm("It's not your shift today. Are you sure this is a Regular Bazaar for YOURSELF? If you are shopping for someone else, use Proxy Mode.")) {
                 return;
             }
        }
    }

    const validItems = currentItems.filter(i => i.name && i.price);
    if (!inputDate || validItems.length === 0) return;
    
    const subTotal = validItems.reduce((acc, curr) => acc + parseFloat(curr.price), 0);
    
    const payload = { 
      date: inputDate, 
      shopperId: loggedInMemberId, // Who spent the money (Balance pabe)
      originalShopperId: finalOriginalShopperId, // Whose shift it was (Display te nam thakbe)
      items: validItems, 
      subTotal, 
      type: expenseType, // Regular or Extra
      isProxy: isProxy,
      createdBy: user.email, 
      timestamp: editingId ? bazaarList.find(b => b.id === editingId).timestamp : Date.now() 
    };

    try {
      if (editingId) await updateDoc(doc(db, "bazaar", editingId), payload);
      else await addDoc(collection(db, "bazaar"), payload);
      setShowAddModal(false);
    } catch (error) { alert("Failed to save."); }
  };

  const deleteBazaar = async (id) => { if(window.confirm('Delete entry?')) await deleteDoc(doc(db, "bazaar", id)); };
  
  const toggleMeal = async (dIdx, mId) => {
    const newSheet = [...mealSheet]; newSheet[dIdx].status[mId] = !newSheet[dIdx].status[mId];
    await updateDoc(doc(db, "settings", "mealSheet"), { sheet: newSheet });
  };

  // --- CALCULATIONS ---
  const stats = useMemo(() => {
    let totalBazaarCost = 0;
    const memberStats = MEMBERS_CONFIG.map(m => ({ ...m, totalMeals: 0, totalCost: 0 }));
    
    bazaarList.forEach(e => {
      totalBazaarCost += e.subTotal;
      // Money spent credit goes to the ACTUAL shopper (shopperId), not the proxy target
      const spender = memberStats.find(m => m.id === e.shopperId);
      if (spender) spender.totalCost += e.subTotal;
    });

    let grandTotalMeals = 0;
    mealSheet.forEach(d => { MEMBERS_CONFIG.forEach(m => { if (d.status && d.status[m.id]) { memberStats.find(me => me.id === m.id).totalMeals += 1; grandTotalMeals += 1; } }); });
    
    const mealRate = grandTotalMeals > 0 ? (totalBazaarCost / grandTotalMeals) : 0;
    const finalReport = memberStats.map(m => ({ ...m, mealCost: m.totalMeals * mealRate, balance: m.totalCost - (m.totalMeals * mealRate) }));
    return { totalBazaarCost, mealRate, finalReport };
  }, [bazaarList, mealSheet]);


  // --- VIEW: LOGIN ---
  if (authLoading) return <div className="vh-100 d-flex justify-content-center align-items-center"><div className="spinner-border text-primary"></div></div>;
  if (!user) return (
    <div className="vh-100 d-flex justify-content-center align-items-center bg-light px-3">
      <div className="card border-0 shadow-lg p-4" style={{maxWidth:'400px', width:'100%', borderRadius:'20px'}}>
        <div className="text-center mb-4"><div className="bg-primary bg-opacity-10 p-3 rounded-circle d-inline-block mb-3 text-primary"><FaLock size={30} /></div><h4 className="fw-bold">{APP_NAME}</h4><p className="text-muted small">Member Access Only</p></div>
        {loginError && <div className="alert alert-danger py-2 small">{loginError}</div>}
        <form onSubmit={handleLogin}><div className="mb-3"><input type="email" className="form-control modern-input py-3" placeholder="Email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} required /></div><div className="mb-4"><input type="password" className="form-control modern-input py-3" placeholder="Password" value={loginPass} onChange={e=>setLoginPass(e.target.value)} required /></div><button className="btn btn-primary w-100 py-3 rounded-pill fw-bold shadow-sm">Secure Login</button></form>
      </div>
    </div>
  );

  // --- VIEW: APP ---
  if (dataLoading) return <div className="vh-100 d-flex justify-content-center align-items-center"><div className="spinner-border text-primary"></div></div>;

  return (
    <div className="container-fluid px-0">
      
      {/* HEADER */}
      <div className="header-gradient">
        <div className="d-flex justify-content-between align-items-center container">
          <div>
            <h6 className="mb-0 text-white-50 small text-uppercase" style={{letterSpacing:'1px'}}>Welcome, {loggedInMemberInfo?.name}</h6>
            <h2 className="fw-bold mb-0">{currentMonthName}</h2>
          </div>
          <button onClick={handleLogout} className="btn btn-outline-light border-0 bg-white bg-opacity-10 rounded-circle p-2"><FaSignOutAlt size={20} /></button>
        </div>
      </div>

      <div className="container mt-5 pt-2 mb-5 pb-5">
        
        {/* --- TAB 1: DASHBOARD --- */}
        {activeTab === 'dashboard' && (
          <div className="animate__animated animate__fadeIn">
             <div className="row g-3 mb-4">
               <div className="col-6"><div className="app-card p-3 text-center h-100"><small className="text-muted d-block mb-1">Total Expenses</small><h3 className="text-primary fw-bold mb-0">{CURRENCY}{stats.totalBazaarCost}</h3></div></div>
               <div className="col-6"><div className="app-card p-3 text-center h-100"><small className="text-muted d-block mb-1">Meal Rate</small><h3 className="text-success fw-bold mb-0">{CURRENCY}{stats.mealRate.toFixed(1)}</h3></div></div>
             </div>
             
             {/* Current Shift Indicator */}
             {!isMyShiftToday && (
                 <div className="alert alert-warning border-0 shadow-sm d-flex align-items-center gap-2 small mb-4">
                    <FaUserClock />
                    <div>You are currently <strong>OFF-SHIFT</strong>. Use proxy mode if buying for others.</div>
                 </div>
             )}

             <h6 className="text-muted ps-1 mb-3 small fw-bold">FINANCIAL STATUS</h6>
             <div className="row g-3">
               {stats.finalReport.map(m => (
                 <div key={m.id} className="col-12 col-md-6">
                   <div className={`app-card p-3 d-flex justify-content-between align-items-center ${loggedInMemberId===m.id ? 'border-primary border-2':''}`}>
                     <div><h6 className="fw-bold mb-1 text-dark">{m.name} {loggedInMemberId===m.id && '(Me)'}</h6><div className="small text-muted">Meals: {m.totalMeals} | Spent: {CURRENCY}{m.totalCost}</div></div>
                     <div className={`px-3 py-1 rounded-pill small fw-bold ${m.balance >= 0 ? 'bg-success bg-opacity-10 text-success' : 'bg-danger bg-opacity-10 text-danger'}`}>{m.balance >= 0 ? 'Get' : 'Give'} {Math.abs(m.balance).toFixed(0)}</div>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        )}

        {/* --- TAB 2: MEALS --- */}
        {activeTab === 'meals' && (
          <div className="animate__animated animate__fadeIn">
             <div className="app-card p-3 mb-3 d-flex justify-content-between align-items-center border-start border-4 border-warning"><span className="fw-bold text-dark">Today: Day {currentDay}</span><span className="badge bg-warning text-dark">Active</span></div>
             <div className="app-card overflow-hidden">
                <div className="table-responsive" style={{maxHeight: '70vh'}}>
                  <table className="table table-borderless text-center align-middle mb-0">
                    <thead className="bg-light sticky-top border-bottom"><tr><th className="py-3 text-muted small">DAY</th>{MEMBERS_CONFIG.map(m => <th key={m.id} className="small fw-bold text-dark">{m.name.slice(0,3)}</th>)}</tr></thead>
                    <tbody>
                      {mealSheet.map((d, idx) => (
                        <tr key={d.day} style={{backgroundColor: d.day === currentDay ? '#FFFBEB' : 'transparent', borderBottom: '1px solid #f3f4f6'}}>
                          <td className="fw-bold small text-muted">{d.day}</td>
                          {MEMBERS_CONFIG.map(m => (<td key={m.id} onClick={() => toggleMeal(idx, m.id)} className="p-2"><div className={`rounded mx-auto d-flex align-items-center justify-content-center ${d.status[m.id] ? 'bg-success text-white' : 'bg-light text-muted'}`} style={{width:'30px', height:'30px', fontSize:'10px', cursor:'pointer'}}>{d.status[m.id] ? '✓' : ''}</div></td>))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
             </div>
          </div>
        )}

        {/* --- TAB 3: MY ZONE (ADD & MANAGE) --- */}
        {activeTab === 'my_zone' && (
          <div className="animate__animated animate__fadeIn">
            
            <button className={`btn w-100 rounded-pill py-3 shadow-sm mb-4 fw-bold d-flex align-items-center justify-content-center gap-2 ${showAddModal ? 'btn-danger' : 'btn-primary'}`} onClick={() => { setShowAddModal(!showAddModal); if(!showAddModal) openAddModal(); }}>{showAddModal ? <><FaTimes /> Close Form</> : <><FaPlus /> Add Expense</>}</button>

            {showAddModal && (
              <div className="app-card p-4 mb-4 border-start border-4 border-primary">
                <h6 className="fw-bold mb-3 text-primary">{editingId ? 'Edit Entry' : 'Add New Expense'}</h6>
                <form onSubmit={submitBazaar}>
                  
                  {/* EXPENSE TYPE SELECTOR */}
                  <div className="mb-3">
                     <label className="small text-muted mb-1 d-block">Expense Type</label>
                     <div className="btn-group w-100" role="group">
                        <button type="button" className={`btn btn-sm ${expenseType === 'Regular' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setExpenseType('Regular')}>🛒 Bazaar</button>
                        <button type="button" className={`btn btn-sm ${expenseType === 'Extra' ? 'btn-warning' : 'btn-outline-warning text-dark'}`} onClick={() => setExpenseType('Extra')}>⚡ Extra/Bill</button>
                     </div>
                  </div>

                  {/* PROXY SELECTOR */}
                  <div className="form-check form-switch mb-3 bg-light p-2 rounded border">
                    <input className="form-check-input" type="checkbox" id="proxySwitch" checked={isProxy} onChange={(e) => setIsProxy(e.target.checked)} />
                    <label className="form-check-label small fw-bold ms-2" htmlFor="proxySwitch">Shopping for someone else? (Proxy)</label>
                  </div>

                  {isProxy && (
                    <div className="mb-3 animate__animated animate__fadeIn">
                       <label className="small text-muted mb-1">Select Original Shift Owner</label>
                       <select className="form-select modern-input border-warning" value={proxyForId} onChange={e => setProxyForId(e.target.value)} required>
                          <option value="">-- Select Member --</option>
                          {MEMBERS_CONFIG.filter(m => m.id !== loggedInMemberId).map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                       </select>
                       <small className="text-warning" style={{fontSize: '0.7rem'}}>* Balance will be added to YOU, but history will show their name.</small>
                    </div>
                  )}

                  <div className="row g-2 mb-3">
                    <div className="col-6"><label className="small text-muted mb-1">Date</label><input type="date" className="form-control modern-input" value={inputDate} onChange={e => setInputDate(e.target.value)} required /></div>
                    <div className="col-6"><label className="small text-muted mb-1">Shopper (You)</label><input type="text" className="form-control modern-input bg-light fw-bold text-muted" value={loggedInMemberInfo?.name} readOnly /></div>
                  </div>

                  {currentItems.map((item, idx) => (
                    <div key={idx} className="d-flex gap-2 mb-2"><input placeholder="Item Name" className="form-control modern-input" value={item.name} onChange={e => handleItemChange(idx, 'name', e.target.value)} /><input placeholder="Price" type="number" className="form-control modern-input" style={{width:'80px'}} value={item.price} onChange={e => handleItemChange(idx, 'price', e.target.value)} />{currentItems.length > 1 && <button type="button" className="btn btn-light text-danger px-2" onClick={() => removeItemField(idx)}>✕</button>}</div>
                  ))}
                  <div className="d-flex justify-content-between mt-2 mb-3"><button type="button" className="btn btn-sm text-primary p-0" onClick={addItemField}>+ Add Row</button></div>
                  <button type="submit" className="btn btn-primary w-100 rounded-pill fw-bold">{editingId ? 'Update' : 'Save Entry'}</button>
                </form>
              </div>
            )}

            <h6 className="text-muted mb-3 small fw-bold">MY RECENT ADDS</h6>
            <div className="d-flex flex-column gap-3">
               {bazaarList.filter(item => item.createdBy === user.email).map((e) => (
                  <div key={e.id} className="app-card p-3 border-start border-4 border-primary">
                     <div className="d-flex justify-content-between align-items-center mb-2">
                        <div>
                            <span className="badge bg-light text-dark mb-1 me-2">{e.date}</span>
                            {e.type === 'Extra' && <span className="badge bg-warning text-dark me-2">⚡ Extra</span>}
                            {e.isProxy && <span className="badge bg-info text-dark">🛡 Proxy</span>}
                            <h6 className="fw-bold mb-0 text-dark mt-1">{CURRENCY}{e.subTotal}</h6>
                        </div>
                        <div className="d-flex gap-2"><button className="btn btn-sm btn-outline-primary border-0 bg-primary bg-opacity-10" onClick={() => handleEdit(e)}><FaEdit /></button><button className="btn btn-sm btn-outline-danger border-0 bg-danger bg-opacity-10" onClick={() => deleteBazaar(e.id)}><FaTrash /></button></div>
                     </div>
                     <div className="bg-light p-2 rounded small text-muted">
                        {e.items.map(i => i.name).join(', ')}
                     </div>
                  </div>
               ))}
               {bazaarList.filter(item => item.createdBy === user.email).length === 0 && <div className="text-center text-muted py-4"><small>You haven't added anything yet.</small></div>}
            </div>
          </div>
        )}

        {/* --- TAB 4: HISTORY (ALL) --- */}
        {activeTab === 'history' && (
          <div className="animate__animated animate__fadeIn">
             <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="text-muted small fw-bold m-0">FULL HISTORY</h6>
                <span className="badge bg-secondary">{bazaarList.length} Entries</span>
             </div>
             
             <div className="d-flex flex-column gap-3">
               {bazaarList.map((e) => {
                 const originalOwner = MEMBERS_CONFIG.find(m => m.id === (e.originalShopperId || e.shopperId));
                 const actualSpender = MEMBERS_CONFIG.find(m => m.id === e.shopperId);
                 const isProxyEntry = e.isProxy || (e.originalShopperId && e.originalShopperId !== e.shopperId);

                 return (
                 <div key={e.id} className="app-card p-0 overflow-hidden">
                   <div className="p-3 d-flex justify-content-between align-items-center" style={{cursor: 'pointer', backgroundColor: expandedDateId === e.id ? '#F3F4F6' : 'white'}} onClick={() => setExpandedDateId(expandedDateId === e.id ? null : e.id)}>
                      <div className="d-flex align-items-center gap-3">
                         <div className={`p-2 rounded text-center border ${e.type === 'Extra' ? 'bg-warning bg-opacity-10 border-warning' : 'bg-light'}`} style={{minWidth:'50px'}}>
                            <small className="d-block text-muted" style={{fontSize:'0.6rem'}}>DATE</small>
                            <span className="fw-bold text-dark">{e.date.split('-')[2]}</span>
                         </div>
                         <div>
                            <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-1">
                                {originalOwner?.name}
                                {e.type === 'Extra' && <FaBolt className="text-warning small" title="Extra Cost"/>}
                            </h6>
                            
                            {/* Proxy & Spender Info */}
                            <small className="text-muted d-block" style={{fontSize:'0.75rem'}}>
                                {isProxyEntry ? (
                                    <span className="text-info"><FaUserShield className="me-1"/>Paid by {actualSpender?.name}</span>
                                ) : (
                                    <span>{e.items.length} Items</span>
                                )}
                            </small>
                         </div>
                      </div>
                      <div className="text-end">
                         <h6 className="fw-bold text-primary mb-0">{CURRENCY}{e.subTotal}</h6>
                         <small className="text-muted">{expandedDateId === e.id ? <FaChevronUp /> : <FaChevronDown />}</small>
                      </div>
                   </div>
                   {expandedDateId === e.id && (
                     <div className="bg-light p-3 border-top">
                        {e.items.map((item, i) => (
                           <div key={i} className="d-flex justify-content-between py-1 border-bottom border-white">
                              <span className="small text-dark">{item.name}</span>
                              <span className="small fw-bold text-dark">{CURRENCY}{item.price}</span>
                           </div>
                        ))}
                        {/* Footer Info */}
                        <div className="mt-2 text-end">
                            <span className="badge bg-white border text-muted">Added by: {e.createdBy?.split('@')[0]}</span>
                        </div>
                     </div>
                   )}
                 </div>
               )})}
             </div>
          </div>
        )}

      </div>

      {/* BOTTOM NAV */}
      <div className="bottom-nav">
        <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}><FaHome className="nav-icon" /><span>Home</span></button>
        <button className={`nav-item ${activeTab === 'meals' ? 'active' : ''}`} onClick={() => setActiveTab('meals')}><BiDish className="nav-icon" /><span>Meals</span></button>
        <button className={`nav-item ${activeTab === 'my_zone' ? 'active' : ''}`} onClick={() => setActiveTab('my_zone')}><FaPlus className="nav-icon" /><span>My Zone</span></button>
        <button className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}><FaListAlt className="nav-icon" /><span>History</span></button>
      </div>
    </div>
  );
};

export default Home;