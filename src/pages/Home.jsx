 import React, { useState, useMemo, useEffect } from 'react';
// Firebase ইমপোর্ট (path ঠিক রেখো)
import { db } from '../firebase'; 
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, setDoc, query, orderBy } from 'firebase/firestore';

const MEMBERS_CONFIG = [
  { id: 1, name: 'Rahim', startDay: 1, endDay: 6 },
  { id: 2, name: 'Karim', startDay: 7, endDay: 12 },
  { id: 3, name: 'Suman', startDay: 13, endDay: 18 },
  { id: 4, name: 'Salam', startDay: 19, endDay: 24 },
  { id: 5, name: 'Jabbar', startDay: 25, endDay: 30 },
];

const Home = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Date Utilities
  const today = new Date();
  const currentMonthName = today.toLocaleString('default', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const currentDay = today.getDate();

  // --- STATE (FIREBASE DATA) ---
  const [bazaarList, setBazaarList] = useState([]);
  const [mealSheet, setMealSheet] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- 1. DATA FETCHING (REAL-TIME) ---
  useEffect(() => {
    // বাজার ডাটা আনা
    const q = query(collection(db, "bazaar"));
    const unsubscribeBazaar = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBazaarList(list);
    });

    // মিল শিট ডাটা আনা (আমরা পুরো শিট একটা ডকুমেন্টে রাখব 'meals' নামক কালেকশনে)
    const unsubscribeMeals = onSnapshot(doc(db, "settings", "mealSheet"), (docSnap) => {
      if (docSnap.exists()) {
        setMealSheet(docSnap.data().sheet);
      } else {
        // যদি ডাটা না থাকে (প্রথম বার), তাহলে নতুন তৈরি করে সেভ করো
        const initialSheet = [];
        for (let i = 1; i <= daysInMonth; i++) {
          const dailyStatus = {};
          MEMBERS_CONFIG.forEach(m => dailyStatus[m.id] = true);
          initialSheet.push({ day: i, status: dailyStatus });
        }
        setDoc(doc(db, "settings", "mealSheet"), { sheet: initialSheet });
      }
      setLoading(false);
    });

    return () => {
      unsubscribeBazaar();
      unsubscribeMeals();
    };
  }, [daysInMonth]);


  // --- INPUT STATES ---
  const [inputDate, setInputDate] = useState('');
  const [inputShopper, setInputShopper] = useState(1);
  const [currentItems, setCurrentItems] = useState([{ name: '', price: '' }]);
  const [expandedDateId, setExpandedDateId] = useState(null);

  // --- ACTIONS (FIREBASE WRITES) ---

  const addItemField = () => setCurrentItems([...currentItems, { name: '', price: '' }]);

  const handleItemChange = (index, field, value) => {
    const newItems = [...currentItems];
    newItems[index][field] = value;
    setCurrentItems(newItems);
  };

  const submitBazaar = async (e) => {
    e.preventDefault();
    const validItems = currentItems.filter(i => i.name && i.price);
    if (!inputDate || validItems.length === 0) return;

    const subTotal = validItems.reduce((acc, curr) => acc + parseFloat(curr.price), 0);

    // Firebase এ ডাটা পাঠানো
    await addDoc(collection(db, "bazaar"), {
      date: inputDate,
      shopperId: parseInt(inputShopper),
      items: validItems,
      subTotal: subTotal,
      timestamp: Date.now() // সর্টিং এর জন্য
    });

    setCurrentItems([{ name: '', price: '' }]);
    alert('Bazaar added online!');
  };

  const deleteBazaar = async (id) => {
    if(window.confirm('Delete this entry?')) {
      await deleteDoc(doc(db, "bazaar", id));
    }
  };

  const toggleMeal = async (dayIndex, memberId) => {
    const newSheet = [...mealSheet];
    newSheet[dayIndex].status[memberId] = !newSheet[dayIndex].status[memberId];
    
    // Firebase এ আপডেট করা
    await updateDoc(doc(db, "settings", "mealSheet"), {
      sheet: newSheet
    });
  };

  // --- CALCULATIONS (SAME AS BEFORE) ---
  const stats = useMemo(() => {
    let totalBazaarCost = 0;
    const memberStats = MEMBERS_CONFIG.map(m => ({ ...m, totalMeals: 0, totalCost: 0 }));

    bazaarList.forEach(entry => {
      totalBazaarCost += entry.subTotal;
      const shopper = memberStats.find(m => m.id === entry.shopperId);
      if (shopper) shopper.totalCost += entry.subTotal;
    });

    let grandTotalMeals = 0;
    mealSheet.forEach(day => {
      MEMBERS_CONFIG.forEach(m => {
        if (day.status && day.status[m.id]) {
          const member = memberStats.find(me => me.id === m.id);
          member.totalMeals += 1;
          grandTotalMeals += 1;
        }
      });
    });

    const mealRate = grandTotalMeals > 0 ? (totalBazaarCost / grandTotalMeals) : 0;

    const finalReport = memberStats.map(m => {
      const mealCost = m.totalMeals * mealRate;
      const balance = m.totalCost - mealCost;
      return { ...m, mealCost, balance };
    });

    return { totalBazaarCost, grandTotalMeals, mealRate, finalReport };
  }, [bazaarList, mealSheet]);


  if (loading) return <div className="text-center mt-5">Loading Data...</div>;

  return (
    <div className="container mt-4 mb-5 pb-5">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 bg-white p-3 rounded shadow-sm border-start border-5 border-success">
        <div>
           <h6 className="text-uppercase text-muted mb-1 small">Online Mess Manager 🟢</h6>
           <h2 className="fw-bold text-success m-0">{currentMonthName}</h2>
        </div>
      </div>

      {/* Tabs */}
      <div className="nav nav-pills nav-fill bg-white p-2 rounded shadow-sm mb-4">
        <button className={`nav-link ${activeTab === 'dashboard' ? 'active bg-success' : 'text-dark'}`} onClick={() => setActiveTab('dashboard')}>📊 Dashboard</button>
        <button className={`nav-link ${activeTab === 'meals' ? 'active bg-success' : 'text-dark'}`} onClick={() => setActiveTab('meals')}>🍛 Meal Sheet</button>
        <button className={`nav-link ${activeTab === 'bazaar' ? 'active bg-success' : 'text-dark'}`} onClick={() => setActiveTab('bazaar')}>🛒 Bazaar Entry</button>
      </div>

      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <div className="animate__animated animate__fadeIn">
          <div className="row g-3 mb-4">
             <div className="col-6">
                <div className="p-3 bg-success text-white rounded text-center shadow-sm">
                  <small>Total Cost</small>
                  <h2>৳{stats.totalBazaarCost}</h2>
                </div>
             </div>
             <div className="col-6">
                <div className="p-3 bg-dark text-white rounded text-center shadow-sm">
                  <small>Meal Rate</small>
                  <h2>৳{stats.mealRate.toFixed(2)}</h2>
                </div>
             </div>
          </div>
          <div className="card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table align-middle mb-0 table-hover">
                <thead className="table-light">
                  <tr>
                    <th>Member</th>
                    <th className="text-center">Meals</th>
                    <th className="text-end">Given</th>
                    <th className="text-end">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.finalReport.map(m => (
                    <tr key={m.id}>
                      <td><span className="fw-bold">{m.name}</span></td>
                      <td className="text-center">{m.totalMeals}</td>
                      <td className="text-end">৳{m.totalCost}</td>
                      <td className="text-end">
                        <span className={`badge ${m.balance >= 0 ? 'bg-success' : 'bg-danger'}`}>
                          {m.balance >= 0 ? 'Get' : 'Give'} ৳{Math.abs(m.balance).toFixed(0)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MEAL SHEET TAB */}
      {activeTab === 'meals' && (
        <div className="card shadow-sm border-0">
          <div className="table-responsive" style={{maxHeight: '70vh'}}>
            <table className="table table-bordered text-center table-hover mb-0">
              <thead className="table-dark sticky-top" style={{top: 0}}>
                <tr>
                  <th>Day</th>
                  {MEMBERS_CONFIG.map(m => <th key={m.id}>{m.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {mealSheet.map((dayRow, idx) => (
                  <tr key={dayRow.day} className={dayRow.day === currentDay ? "table-warning border-2 border-warning" : ""}>
                    <td className="fw-bold">{dayRow.day}</td>
                    {MEMBERS_CONFIG.map(m => (
                      <td key={m.id} className="p-0 align-middle">
                        <div 
                           onClick={() => toggleMeal(idx, m.id)}
                           className={`p-2 w-100 ${dayRow.status[m.id] ? 'text-success fw-bold' : 'bg-light text-danger'}`}
                           style={{cursor: 'pointer'}}
                        >
                            {dayRow.status[m.id] ? '1' : 'OFF'}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BAZAAR TAB */}
      {activeTab === 'bazaar' && (
        <div className="row g-4">
          <div className="col-lg-5">
            <div className="card shadow border-0">
              <div className="card-header bg-success text-white">Add Expense</div>
              <div className="card-body">
                <form onSubmit={submitBazaar}>
                  <input type="date" className="form-control mb-2" value={inputDate} onChange={e => setInputDate(e.target.value)} required />
                  <select className="form-select mb-2" value={inputShopper} onChange={e => setInputShopper(e.target.value)}>
                    {MEMBERS_CONFIG.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  {currentItems.map((item, idx) => (
                    <div key={idx} className="input-group mb-2">
                      <input placeholder="Item" className="form-control" value={item.name} onChange={e => handleItemChange(idx, 'name', e.target.value)} />
                      <input placeholder="৳" type="number" className="form-control" style={{maxWidth:'80px'}} value={item.price} onChange={e => handleItemChange(idx, 'price', e.target.value)} />
                    </div>
                  ))}
                  <button type="button" className="btn btn-sm text-success mb-2" onClick={addItemField}>+ Add Item</button>
                  <button type="submit" className="btn btn-success w-100">Save Online</button>
                </form>
              </div>
            </div>
          </div>
          <div className="col-lg-7">
            <div className="list-group shadow-sm">
              {bazaarList.map((entry) => (
                <div key={entry.id} className="list-group-item d-flex justify-content-between align-items-center">
                  <div>
                    <span className="fw-bold">{entry.date}: </span> 
                    {MEMBERS_CONFIG.find(m => m.id === entry.shopperId)?.name} (৳{entry.subTotal})
                  </div>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => deleteBazaar(entry.id)}>✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;