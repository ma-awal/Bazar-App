 import React, { useState, useMemo, useEffect } from 'react';
import { db, auth } from '../firebase'; 
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, setDoc, query, orderBy } from 'firebase/firestore';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { FaHome, FaWallet, FaTrash, FaPlus, FaEdit, FaChevronDown, FaChevronUp, FaTimes, FaUserClock, FaLock, FaSignOutAlt, FaUserCheck } from 'react-icons/fa';
import { BiDish } from "react-icons/bi";

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

const Home = () => {
  // --- AUTH STATE ---
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // --- APP STATE ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const today = new Date();
  const currentMonthName = today.toLocaleString('default', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const currentDay = today.getDate();

  // --- IDENTIFY CURRENT MEMBER ---
  // লগিন করা ইউজারের ইমেইল দেখে মেম্বার আইডি বের করা হচ্ছে
  const loggedInMemberId = useMemo(() => {
    if (user && MEMBER_EMAILS[user.email]) {
      return MEMBER_EMAILS[user.email];
    }
    return null; // ইমেইল কনফিগে না থাকলে নাল রিটার্ন করবে
  }, [user]);

  // --- CHECK LOGIN STATUS ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- MANAGER LOGIC ---
  const activeManagerInfo = useMemo(() => {
    const manager = MEMBERS_CONFIG.find(m => currentDay >= m.startDay && currentDay <= m.endDay);
    if (!manager) return null;
    const totalShiftDays = manager.endDay - manager.startDay + 1;
    const daysPassed = currentDay - manager.startDay + 1;
    const daysLeft = manager.endDay - currentDay;
    const progressPercent = (daysPassed / totalShiftDays) * 100;
    return { ...manager, daysPassed, daysLeft, progressPercent };
  }, [currentDay]);

  // --- DATA FETCHING ---
  const [bazaarList, setBazaarList] = useState([]);
  const [mealSheet, setMealSheet] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

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

  // --- AUTH ACTIONS ---
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPass);
      setLoginError('');
    } catch (error) {
      setLoginError('Invalid Email or Password!');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  // --- CRUD ACTIONS ---
  const addItemField = () => setCurrentItems([...currentItems, { name: '', price: '' }]);
  const handleItemChange = (idx, field, val) => {
    const newItems = [...currentItems];
    newItems[idx][field] = val;
    setCurrentItems(newItems);
  };
  const removeItemField = (idx) => setCurrentItems(currentItems.filter((_, i) => i !== idx));
  
  const handleEdit = (entry) => {
    // নিরাপত্তা: যদি এন্ট্রিটা আমার না হয়, এডিট করতে দিব না
    if(entry.createdBy !== user.email) {
      alert("You can only edit your own items!");
      return;
    }
    setInputDate(entry.date);
    setCurrentItems(entry.items);
    setEditingId(entry.id);
    setShowAddModal(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitBazaar = async (e) => {
    e.preventDefault();
    if(!loggedInMemberId) {
       alert("System Error: Your email is not mapped to any member ID.");
       return;
    }

    const validItems = currentItems.filter(i => i.name && i.price);
    if (!inputDate || validItems.length === 0) return;
    const subTotal = validItems.reduce((acc, curr) => acc + parseFloat(curr.price), 0);
    
    // Payload: createdBy ফিল্ড অ্যাড করা হলো
    const payload = { 
      date: inputDate, 
      shopperId: loggedInMemberId, // অটোমেটিক নিজের আইডি যাবে
      items: validItems, 
      subTotal, 
      createdBy: user.email, // মালিকানা নিশ্চিত করার জন্য
      timestamp: editingId ? bazaarList.find(b => b.id === editingId).timestamp : Date.now() 
    };

    try {
      if (editingId) {
         // এডিটের সময় চেক করা হবে মালিকানা
         const entryToEdit = bazaarList.find(b => b.id === editingId);
         if(entryToEdit.createdBy !== user.email) {
            alert("Permission Denied: Not your entry.");
            return;
         }
         await updateDoc(doc(db, "bazaar", editingId), payload);
      } else {
         await addDoc(collection(db, "bazaar"), payload);
      }
      setEditingId(null); setCurrentItems([{ name: '', price: '' }]); setShowAddModal(false);
    } catch (error) { alert("Failed to save."); }
  };

  const deleteBazaar = async (entry) => {
    // ডিলিটের আগে মালিকানা চেক
    if (entry.createdBy !== user.email) {
       alert("You cannot delete others' entries!");
       return;
    }
    if(window.confirm('Delete this entry permanently?')) await deleteDoc(doc(db, "bazaar", entry.id));
  };

  const toggleMeal = async (dIdx, mId) => {
    // মিল শিট সবাই এডিট করতে পারবে, নাকি শুধু নিজেরটা?
    // মেস লাইফে সাধারণত ম্যানেজার সবার মিল দেয়, তাই এটা ওপেন রাখা হলো।
    // আপনি চাইলে এখানেও রেস্ট্রিকশন দিতে পারেন।
    const newSheet = [...mealSheet];
    newSheet[dIdx].status[mId] = !newSheet[dIdx].status[mId];
    await updateDoc(doc(db, "settings", "mealSheet"), { sheet: newSheet });
  };

  // --- CALCULATIONS ---
  const stats = useMemo(() => {
    let totalBazaarCost = 0;
    const memberStats = MEMBERS_CONFIG.map(m => ({ ...m, totalMeals: 0, totalCost: 0 }));
    bazaarList.forEach(e => {
      totalBazaarCost += e.subTotal;
      const s = memberStats.find(m => m.id === e.shopperId);
      if (s) s.totalCost += e.subTotal;
    });
    let grandTotalMeals = 0;
    mealSheet.forEach(d => {
      MEMBERS_CONFIG.forEach(m => {
        if (d.status && d.status[m.id]) {
          memberStats.find(me => me.id === m.id).totalMeals += 1;
          grandTotalMeals += 1;
        }
      });
    });
    const mealRate = grandTotalMeals > 0 ? (totalBazaarCost / grandTotalMeals) : 0;
    const finalReport = memberStats.map(m => ({ ...m, mealCost: m.totalMeals * mealRate, balance: m.totalCost - (m.totalMeals * mealRate) }));
    return { totalBazaarCost, mealRate, finalReport };
  }, [bazaarList, mealSheet]);


  // --- VIEW: LOGIN ---
  if (authLoading) return <div className="d-flex vh-100 justify-content-center align-items-center"><div className="spinner-border text-primary"></div></div>;

  if (!user) {
    return (
      <div className="d-flex vh-100 bg-light justify-content-center align-items-center px-3">
        <div className="card border-0 shadow-lg p-4" style={{maxWidth: '400px', width: '100%', borderRadius: '20px'}}>
          <div className="text-center mb-4">
            <div className="bg-primary bg-opacity-10 p-3 rounded-circle d-inline-block mb-3 text-primary"><FaLock size={30} /></div>
            <h4 className="fw-bold">Mess Member Login</h4>
            <p className="text-muted small">Access restricted to members only</p>
          </div>
          {loginError && <div className="alert alert-danger py-2 small">{loginError}</div>}
          <form onSubmit={handleLogin}>
            <div className="mb-3"><input type="email" className="form-control modern-input py-3" placeholder="Member Email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required /></div>
            <div className="mb-4"><input type="password" className="form-control modern-input py-3" placeholder="Password" value={loginPass} onChange={e => setLoginPass(e.target.value)} required /></div>
            <button type="submit" className="btn btn-primary w-100 py-3 rounded-pill fw-bold shadow-sm">Login</button>
          </form>
        </div>
      </div>
    );
  }

  // --- VIEW: DASHBOARD ---
  if (dataLoading) return <div className="d-flex vh-100 justify-content-center align-items-center"><div className="spinner-border text-primary"></div></div>;

  return (
    <div className="container-fluid px-0">
      
      {/* Header */}
      <div className="header-gradient">
        <div className="d-flex justify-content-between align-items-center container">
          <div>
            <h6 className="mb-0 text-white-50 small text-uppercase" style={{letterSpacing:'1px'}}>
              Hello, {loggedInMemberId ? MEMBERS_CONFIG.find(m=>m.id === loggedInMemberId)?.name : 'Member'}
            </h6>
            <h2 className="fw-bold mb-0">{currentMonthName}</h2>
          </div>
          <button onClick={handleLogout} className="btn btn-outline-light border-0 bg-white bg-opacity-10 rounded-circle p-2"><FaSignOutAlt size={20} /></button>
        </div>
      </div>

      <div className="container mt-5 pt-2">
        {/* TAB: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="animate__animated animate__fadeIn">
            {activeManagerInfo && (
               <div className="app-card p-3 mb-4 bg-primary text-white border-0 shadow-lg position-relative overflow-hidden">
                 <div className="position-absolute top-0 end-0 bg-white opacity-10 rounded-circle" style={{width:'100px', height:'100px', margin:'-20px'}}></div>
                 <div className="d-flex justify-content-between align-items-center mb-3">
                   <div className="d-flex align-items-center gap-3">
                      <div className="bg-white bg-opacity-25 p-2 rounded-circle"><FaUserClock size={24} /></div>
                      <div><small className="text-white-50 text-uppercase fw-bold" style={{fontSize:'0.7rem'}}>Manager</small><h4 className="fw-bold mb-0">{activeManagerInfo.name}</h4></div>
                   </div>
                   <div className="text-end"><span className="badge bg-white text-primary">Day {currentDay}</span></div>
                 </div>
                 <div><div className="d-flex justify-content-between small mb-1 text-white-50"><span>Done: {activeManagerInfo.daysPassed} Days</span><span>Left: {activeManagerInfo.daysLeft} Days</span></div><div className="progress" style={{height: '6px', backgroundColor: 'rgba(255,255,255,0.2)'}}><div className="progress-bar bg-white" style={{width: `${activeManagerInfo.progressPercent}%`}}></div></div></div>
               </div>
            )}
            <div className="row g-3 mb-4">
              <div className="col-6"><div className="app-card p-3 text-center h-100"><small className="text-muted d-block mb-1">Spent</small><h3 className="text-primary fw-bold mb-0">৳{stats.totalBazaarCost}</h3></div></div>
              <div className="col-6"><div className="app-card p-3 text-center h-100"><small className="text-muted d-block mb-1">Rate</small><h3 className="text-success fw-bold mb-0">৳{stats.mealRate.toFixed(1)}</h3></div></div>
            </div>
            <h6 className="text-muted ps-1 mb-3 small fw-bold">MEMBER STATUS</h6>
            <div className="row g-3">
              {stats.finalReport.map(m => (
                <div key={m.id} className="col-12 col-md-6 col-lg-4">
                  <div className={`app-card p-3 d-flex justify-content-between align-items-center ${loggedInMemberId === m.id ? 'border-primary border-2' : ''}`}>
                    <div>
                        <h6 className="fw-bold mb-1 text-dark d-flex align-items-center gap-2">
                            {m.name} 
                            {loggedInMemberId === m.id && <span className="badge bg-primary text-white" style={{fontSize:'0.6rem'}}>ME</span>}
                        </h6>
                        <div className="small text-muted"><span className="me-2">🍛 {m.totalMeals}</span><span>💸 ৳{m.totalCost}</span></div>
                    </div>
                    <div className={`px-3 py-1 rounded-pill small fw-bold ${m.balance >= 0 ? 'bg-success bg-opacity-10 text-success' : 'bg-danger bg-opacity-10 text-danger'}`}>{m.balance >= 0 ? '+' : '-'}{Math.abs(m.balance).toFixed(0)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: MEALS */}
        {activeTab === 'meals' && (
          <div className="animate__animated animate__fadeIn pb-5">
             <div className="app-card p-3 mb-3 d-flex justify-content-between align-items-center border-start border-4 border-warning"><span className="fw-bold text-dark">Today: {currentDay} {currentMonthName}</span><span className="badge bg-warning text-dark">Day {currentDay}</span></div>
             <div className="app-card overflow-hidden">
                <div className="table-responsive" style={{maxHeight: '75vh'}}>
                  <table className="table table-borderless text-center align-middle mb-0">
                    <thead className="bg-light sticky-top border-bottom"><tr><th className="py-3 text-muted small">DAY</th>{MEMBERS_CONFIG.map(m => <th key={m.id} className="small fw-bold text-dark">{m.name.slice(0,3)}</th>)}</tr></thead>
                    <tbody>
                      {mealSheet.map((d, idx) => (
                        <tr key={d.day} style={{backgroundColor: d.day === currentDay ? '#FFFBEB' : 'transparent', borderBottom: '1px solid #f3f4f6'}}>
                          <td className="fw-bold small text-muted">{d.day}</td>
                          {MEMBERS_CONFIG.map(m => (<td key={m.id} onClick={() => toggleMeal(idx, m.id)} className="p-2"><div className={`rounded mx-auto d-flex align-items-center justify-content-center transition-all ${d.status[m.id] ? 'bg-success text-white shadow-sm' : 'bg-light text-muted'}`} style={{width:'32px', height:'32px', fontSize:'12px', cursor:'pointer'}}>{d.status[m.id] ? '✓' : ''}</div></td>))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
             </div>
          </div>
        )}

        {/* TAB: BAZAAR */}
        {activeTab === 'bazaar' && (
          <div className="animate__animated animate__fadeIn pb-5">
            {/* ADD BUTTON */}
            <button 
                className={`btn w-100 rounded-pill py-3 shadow-sm mb-4 fw-bold d-flex align-items-center justify-content-center gap-2 ${showAddModal ? 'btn-danger' : 'btn-primary'}`} 
                onClick={() => { setShowAddModal(!showAddModal); if(!showAddModal) { setEditingId(null); setCurrentItems([{ name: '', price: '' }]); } }}
                disabled={!loggedInMemberId}
            >
                {showAddModal ? <><FaTimes /> Close Form</> : <><FaPlus /> Add My Expense</>}
            </button>

            {/* FORM */}
            {showAddModal && (
              <div className="app-card p-4 mb-4 border-start border-4 border-primary">
                <h6 className="fw-bold mb-3 text-primary">{editingId ? 'Edit Entry' : 'New Entry for Me'}</h6>
                <form onSubmit={submitBazaar}>
                  <div className="row g-2 mb-3">
                    <div className="col-6"><label className="small text-muted mb-1">Date</label><input type="date" className="form-control modern-input" value={inputDate} onChange={e => setInputDate(e.target.value)} required /></div>
                    
                    {/* SHOPPER LOCKED: ব্যবহারকারী পরিবর্তন করতে পারবে না */}
                    <div className="col-6">
                        <label className="small text-muted mb-1">Shopper</label>
                        <input 
                            type="text" 
                            className="form-control modern-input bg-light text-muted fw-bold" 
                            value={loggedInMemberId ? MEMBERS_CONFIG.find(m => m.id === loggedInMemberId)?.name : 'Unknown'} 
                            readOnly 
                        />
                    </div>
                  </div>
                  <label className="small text-muted mb-1">Items List</label>
                  {currentItems.map((item, idx) => (
                    <div key={idx} className="d-flex gap-2 mb-2"><input placeholder="Item Name" className="form-control modern-input" value={item.name} onChange={e => handleItemChange(idx, 'name', e.target.value)} /><input placeholder="Price" type="number" className="form-control modern-input" style={{width:'80px'}} value={item.price} onChange={e => handleItemChange(idx, 'price', e.target.value)} />{currentItems.length > 1 && <button type="button" className="btn btn-light text-danger px-2" onClick={() => removeItemField(idx)}>✕</button>}</div>
                  ))}
                  <div className="d-flex justify-content-between mt-2 mb-3"><button type="button" className="btn btn-sm text-primary p-0" onClick={addItemField}>+ Add another row</button></div>
                  <button type="submit" className="btn btn-primary w-100 rounded-pill fw-bold">{editingId ? 'Update Entry' : 'Save Entry'}</button>
                </form>
              </div>
            )}

            {/* LIST */}
            <div className="row">
              {bazaarList.map((e) => {
                // চেক করা হচ্ছে এটা কি লগিন করা ইউজারের এন্ট্রি কিনা
                const isMyEntry = e.createdBy === user.email;

                return (
                  <div key={e.id} className="col-12 col-lg-6 mb-3">
                    <div className={`app-card p-3 ${isMyEntry ? 'border-primary' : ''}`}>
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="d-flex gap-3 align-items-center">
                            <div className={`p-3 rounded-circle border ${isMyEntry ? 'bg-primary text-white' : 'bg-light text-muted'}`}>
                                <span className="fw-bold">{e.date.split('-')[2]}</span>
                            </div>
                            <div>
                                <h6 className="fw-bold mb-0 text-dark">
                                    {MEMBERS_CONFIG.find(m => m.id === e.shopperId)?.name}
                                    {isMyEntry && <small className="ms-2 badge bg-primary bg-opacity-10 text-primary">Me</small>}
                                </h6>
                                <small className="text-muted">{new Date(e.date).toDateString().slice(0,3)} • {e.items.length} Items</small>
                            </div>
                        </div>
                        <div className="text-end"><h5 className="fw-bold mb-1 text-primary">৳{e.subTotal}</h5></div>
                      </div>
                      
                      <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
                         <button className="btn btn-sm btn-light text-muted d-flex align-items-center gap-1" onClick={() => setExpandedDateId(expandedDateId === e.id ? null : e.id)}>{expandedDateId === e.id ? <FaChevronUp /> : <FaChevronDown />}{expandedDateId === e.id ? 'Hide' : 'View'}</button>
                         
                         {/* শুধুমাত্র আমার এন্ট্রি হলেই বাটন দেখাবে */}
                         {isMyEntry && (
                             <div className="d-flex gap-2">
                                <button className="btn btn-sm btn-outline-primary border-0 bg-primary bg-opacity-10" onClick={() => handleEdit(e)}><FaEdit /></button>
                                <button className="btn btn-sm btn-outline-danger border-0 bg-danger bg-opacity-10" onClick={() => deleteBazaar(e)}><FaTrash /></button>
                             </div>
                         )}
                      </div>
                      
                      {expandedDateId === e.id && (<div className="mt-3 bg-light p-3 rounded"><div className="d-flex flex-column gap-2">{e.items.map((it, i) => (<div key={i} className="item-row"><span className="text-dark">{it.name}</span><span className="fw-bold text-dark">৳{it.price}</span></div>))}</div></div>)}
                    </div>
                  </div>
                );
              })}
            </div>
            {bazaarList.length === 0 && <div className="text-center text-muted py-5"><p>No bazaar entries found.</p></div>}
          </div>
        )}
      </div>

      <div className="bottom-nav">
        <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}><FaHome className="nav-icon" /><span>Home</span></button>
        <button className={`nav-item ${activeTab === 'meals' ? 'active' : ''}`} onClick={() => setActiveTab('meals')}><BiDish className="nav-icon" /><span>Meals</span></button>
        <button className={`nav-item ${activeTab === 'bazaar' ? 'active' : ''}`} onClick={() => setActiveTab('bazaar')}><FaWallet className="nav-icon" /><span>Bazaar</span></button>
      </div>
    </div>
  );
};

export default Home;