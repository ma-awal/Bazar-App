import React, { useState, useMemo, useEffect } from 'react';
import { db, auth } from '../firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  FaHome,
  FaWallet,
  FaTrash,
  FaUtensils,
  FaSignOutAlt,
  FaExclamationCircle,
  FaChevronDown,
  FaChevronUp,
  FaExchangeAlt,
  FaUserCheck,
} from 'react-icons/fa';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// --- CONFIGURATION WITH SPECIFIC GRADIENTS ---
const APP_NAME = 'Smart Mess Pro';

// আপনার পছন্দের দুটি গ্রেডিয়েন্ট
const GRADIENT_AWAL = 'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)'; // Peach-Purple
const GRADIENT_GUEST = 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)'; // Light Purple-Blue

const MEMBERS_CONFIG = [
  // বিজোড় (Odd) আইডিতে Awal এর কালার, জোড় (Even) আইডিতে Guest এর কালার দেওয়া হলো সুন্দর কম্বিনেশনের জন্য
  { id: 1, name: 'Amit', startDay: 1, endDay: 6, gradient: GRADIENT_AWAL },
  { id: 2, name: 'Tofayel', startDay: 7, endDay: 12, gradient: GRADIENT_GUEST },
  { id: 3, name: 'Abid', startDay: 13, endDay: 18, gradient: GRADIENT_AWAL },
  { id: 4, name: 'Awal', startDay: 19, endDay: 24, gradient: GRADIENT_GUEST }, // Awal (Original owner of this color/style match)
  { id: 5, name: 'Guest', startDay: 25, endDay: 30, gradient: GRADIENT_AWAL },
];

const MEMBER_EMAILS = {
  'amit330@d.com': 1,
  'tofayel330@d.com': 2,
  'abid330@d.com': 3,
  'awal330@d.com': 4,
  'guest330@d.com': 5,
};

const Home = () => {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [authLoading, setAuthLoading] = useState(true);

  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Date & Time Logic
  const today = new Date();
  const currentDay = today.getDate();
  const currentHour = today.getHours();
  const currentMinute = today.getMinutes();
  const currentMonthName = today.toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });
  const daysInMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0
  ).getDate();

  // 🔒 TIME LIMITS
  const isRequestTimeOver =
    currentHour > 18 || (currentHour === 18 && currentMinute >= 30); // 6:30 PM
  const isManagerLocked = currentHour >= 22; // 10:00 PM (Entry Close)

  // Data State
  const [bazaarList, setBazaarList] = useState([]);
  const [mealSheet, setMealSheet] = useState([]);
  const [delegations, setDelegations] = useState({});
  const [loading, setLoading] = useState(true);

  // UI State
  const [expandedMemberId, setExpandedMemberId] = useState(null);
  const [delegateToId, setDelegateToId] = useState('');

  // Form State
  const [inputDate, setInputDate] = useState(today.toISOString().split('T')[0]);
  const [currentItems, setCurrentItems] = useState([{ name: '', price: '' }]);

  // Identity Logic
  const loggedInMemberId = useMemo(
    () =>
      user && MEMBER_EMAILS[user.email] ? MEMBER_EMAILS[user.email] : null,
    [user]
  );
  const loggedInMemberInfo = useMemo(
    () =>
      loggedInMemberId
        ? MEMBERS_CONFIG.find((m) => m.id === loggedInMemberId)
        : null,
    [loggedInMemberId]
  );

  const currentShiftManager = useMemo(() => {
    return MEMBERS_CONFIG.find(
      (m) => currentDay >= m.startDay && currentDay <= m.endDay
    );
  }, [currentDay]);

  const delegatedManagerId = delegations[inputDate];

  const hasAccess = useMemo(() => {
    if (delegatedManagerId) return loggedInMemberId === delegatedManagerId;
    return currentShiftManager?.id === loggedInMemberId; // Official manager access logic simplified for date matching in submit
  }, [delegatedManagerId, loggedInMemberId, currentShiftManager]);

  // Only allow official manager to delegate/revoke
  const isOfficialManager = loggedInMemberId === currentShiftManager?.id;

  // --- EFFECTS ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'bazaar'), orderBy('timestamp', 'desc'));
    const unsubBazaar = onSnapshot(q, (snap) =>
      setBazaarList(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    );

    const unsubMeals = onSnapshot(
      doc(db, 'settings', 'mealSheet'),
      (docSnap) => {
        if (docSnap.exists()) {
          setMealSheet(docSnap.data().sheet);
        } else {
          const sheet = Array.from({ length: daysInMonth }, (_, i) => ({
            day: i + 1,
            status: MEMBERS_CONFIG.reduce(
              (acc, m) => ({ ...acc, [m.id]: true }),
              {}
            ),
            requests: MEMBERS_CONFIG.reduce(
              (acc, m) => ({ ...acc, [m.id]: false }),
              {}
            ),
          }));
          setDoc(doc(db, 'settings', 'mealSheet'), { sheet });
        }
      }
    );

    const unsubDelegation = onSnapshot(
      doc(db, 'settings', 'delegations'),
      (docSnap) => {
        if (docSnap.exists()) setDelegations(docSnap.data());
        else setDoc(doc(db, 'settings', 'delegations'), {});
        setLoading(false);
      }
    );

    return () => {
      unsubBazaar();
      unsubMeals();
      unsubDelegation();
    };
  }, [user, daysInMonth]);

  // --- ACTIONS ---
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPass);
    } catch (err) {
      toast.error('Invalid Credentials');
    }
  };

  const submitBazaar = async (e) => {
    e.preventDefault();
    if (!hasAccess) {
      toast.error("⛔ You don't have permission for this date!");
      return;
    }
    if (isManagerLocked && inputDate === today.toISOString().split('T')[0]) {
      toast.error('⛔ Time Over!');
      return;
    }

    const validItems = currentItems.filter((i) => i.name && i.price);
    const subTotal = validItems.reduce(
      (acc, curr) => acc + parseFloat(curr.price),
      0
    );

    await addDoc(collection(db, 'bazaar'), {
      date: inputDate,
      shopperId: loggedInMemberId,
      items: validItems,
      subTotal,
      timestamp: Date.now(),
      createdBy: user.email,
    });
    setCurrentItems([{ name: '', price: '' }]);
    toast.success('Bazaar Added!');
  };

  const handleDelegation = async () => {
    if (!delegateToId) {
      toast.warning('Select a member first!');
      return;
    }
    const newDelegations = {
      ...delegations,
      [inputDate]: parseInt(delegateToId),
    };
    await updateDoc(doc(db, 'settings', 'delegations'), newDelegations);
    toast.success('Access Delegated Successfully');
    setDelegateToId('');
  };

  const cancelDelegation = async () => {
    const newDelegations = { ...delegations };
    delete newDelegations[inputDate];
    await setDoc(doc(db, 'settings', 'delegations'), newDelegations);
    toast.info('Access Taken Back!');
  };

  const handleSelfRequest = async (dIdx) => {
    const targetDay = mealSheet[dIdx].day;
    if (targetDay !== currentDay) {
      toast.warning('Only today!');
      return;
    }
    if (isRequestTimeOver) {
      toast.error('Time Over!');
      return;
    }
    const newSheet = [...mealSheet];
    const currentReq = newSheet[dIdx].requests[loggedInMemberId];
    newSheet[dIdx].requests[loggedInMemberId] = !currentReq;
    await updateDoc(doc(db, 'settings', 'mealSheet'), { sheet: newSheet });
    toast.info('Request Updated');
  };

  const handleManagerAction = async (dIdx, memberId) => {
    if (!isOfficialManager) {
      toast.error('Only Official Manager can change meals!');
      return;
    }
    const targetDay = mealSheet[dIdx].day;
    if (targetDay !== currentDay) {
      toast.error('Cannot modify past/future history!');
      return;
    }
    if (isManagerLocked) {
      toast.error('Manager time over (7:00 PM)!');
      return;
    }

    const newSheet = [...mealSheet];
    newSheet[dIdx].status[memberId] = !newSheet[dIdx].status[memberId];
    if (!newSheet[dIdx].status[memberId])
      newSheet[dIdx].requests[memberId] = false;
    await updateDoc(doc(db, 'settings', 'mealSheet'), { sheet: newSheet });
    toast.success('Updated');
  };

  const deleteBazaar = async (id) => {
    if (window.confirm('Delete?')) await deleteDoc(doc(db, 'bazaar', id));
  };

  // --- CALCULATIONS ---
  const stats = useMemo(() => {
    let totalBazaar = 0;
    const memberStats = MEMBERS_CONFIG.map((m) => ({
      ...m,
      totalMeals: 0,
      totalCost: 0,
      totalOffs: 0,
    }));
    bazaarList.forEach((e) => {
      totalBazaar += e.subTotal;
      const s = memberStats.find((m) => m.id === e.shopperId);
      if (s) s.totalCost += e.subTotal;
    });
    let grandTotalMeals = 0;
    mealSheet.forEach((d) => {
      MEMBERS_CONFIG.forEach((m) => {
        if (d.status[m.id]) {
          memberStats.find((me) => me.id === m.id).totalMeals += 1;
          grandTotalMeals += 1;
        } else {
          memberStats.find((me) => me.id === m.id).totalOffs += 1;
        }
      });
    });
    const mealRate = grandTotalMeals > 0 ? totalBazaar / grandTotalMeals : 0;
    const finalReport = memberStats.map((m) => ({
      ...m,
      mealCost: m.totalMeals * mealRate,
      balance: m.totalCost - m.totalMeals * mealRate,
    }));
    return { totalBazaar, mealRate, finalReport };
  }, [bazaarList, mealSheet]);

  if (authLoading)
    return (
      <div className="d-flex vh-100 justify-content-center align-items-center">
        Loading...
      </div>
    );
  if (!user)
    return (
      <div className="d-flex vh-100 justify-content-center align-items-center bg-light px-3">
        <div
          className="card-custom p-5 shadow-lg"
          style={{ maxWidth: '400px', width: '100%', background: 'white' }}
        >
          <h2 className="text-center text-primary-custom mb-4">{APP_NAME}</h2>
          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <input
                type="email"
                className="form-control"
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />
            </div>
            <div className="mb-4">
              <input
                type="password"
                className="form-control"
                onChange={(e) => setLoginPass(e.target.value)}
                required
              />
            </div>
            <button className="btn btn-primary-custom w-100">Login</button>
          </form>
        </div>
        <ToastContainer position="top-center" theme="colored" />
      </div>
    );

  return (
    <div className="dashboard-container">
      <div className="sidebar shadow-sm">
        <h3 className="mb-5 text-primary-custom px-2 fw-bold">{APP_NAME}</h3>
        <div className="d-flex flex-column gap-2">
          <button
            className={`btn-outline-custom ${
              activeTab === 'dashboard' ? 'active' : ''
            }`}
            onClick={() => setActiveTab('dashboard')}
          >
            {' '}
            <FaHome className="me-3" /> Dashboard
          </button>
          <button
            className={`btn-outline-custom ${
              activeTab === 'meals' ? 'active' : ''
            }`}
            onClick={() => setActiveTab('meals')}
          >
            {' '}
            <FaUtensils className="me-3" /> Meal Sheet
          </button>
          <button
            className={`btn-outline-custom ${
              activeTab === 'bazaar' ? 'active' : ''
            }`}
            onClick={() => setActiveTab('bazaar')}
          >
            {' '}
            <FaWallet className="me-3" /> Bazaar History
          </button>
        </div>
        <div className="mt-auto p-3 bg-light rounded">
          <span className="text-dark fw-bold small">
            {loggedInMemberInfo?.name}
          </span>
          <button
            onClick={() => signOut(auth)}
            className="btn btn-outline-danger w-100 btn-sm mt-2"
          >
            <FaSignOutAlt /> Logout
          </button>
        </div>
      </div>

      <div className="main-content">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="m-0 fw-bold text-dark">{currentMonthName}</h2>
          {isOfficialManager && (
            <span className="badge bg-primary px-3 py-2">
              👑 Official Manager
            </span>
          )}
        </div>

        {activeTab === 'dashboard' && (
          <div className="animate__animated animate__fadeIn">
            <div className="row g-4 mb-4">
              <div className="col-md-6">
                <div
                  className="card-custom p-4 text-white"
                  style={{ background: GRADIENT_GUEST }}
                >
                  <small className="text-dark opacity-75 fw-bold">
                    Meal Rate
                  </small>
                  <h1 className="fw-bold m-0 text-dark">
                    ৳{stats.mealRate.toFixed(2)}
                  </h1>
                </div>
              </div>
              <div className="col-md-6">
                <div
                  className="card-custom p-4 text-white"
                  style={{ background: GRADIENT_AWAL }}
                >
                  <small className="text-dark opacity-75 fw-bold">
                    Total Cost
                  </small>
                  <h1 className="fw-bold m-0 text-dark">
                    ৳{stats.totalBazaar}
                  </h1>
                </div>
              </div>
            </div>

            <h5 className="text-dark mb-3 fw-bold">Member Status</h5>
            <div className="row g-3">
              {stats.finalReport.map((m) => (
                <div key={m.id} className="col-12 col-md-4">
                  <div
                    className="card-custom p-3 border-0 text-dark"
                    style={{ background: m.gradient }}
                  >
                    <div className="d-flex justify-content-between">
                      <h5 className="m-0 fw-bold">
                        {m.name} {loggedInMemberId === m.id && '(Me)'}
                      </h5>
                      <span className="badge bg-white text-dark shadow-sm">
                        {m.balance >= 0 ? '+' : ''}
                        {Math.abs(m.balance).toFixed(0)}
                      </span>
                    </div>
                    <div className="mt-3 d-flex justify-content-between text-dark opacity-75 small fw-bold">
                      <span>Meals: {m.totalMeals}</span>
                      <span>Offs: {m.totalOffs}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'meals' && (
          <div className="animate__animated animate__fadeIn">
            <div className="card-custom p-3 mb-3 d-flex justify-content-between align-items-center bg-white">
              <div>
                <h5 className="m-0 text-primary-custom">Meal Sheet</h5>
                <small className="text-muted">
                  Manager: {currentShiftManager?.name}
                </small>
              </div>
              <div className="text-end">
                {mealSheet.find((d) => d.day === currentDay)?.requests?.[
                  loggedInMemberId
                ] ? (
                  <button
                    onClick={() => handleSelfRequest(currentDay - 1)}
                    className="btn btn-warning btn-sm fw-bold"
                  >
                    Pending...
                  </button>
                ) : (
                  <button
                    onClick={() => handleSelfRequest(currentDay - 1)}
                    disabled={isRequestTimeOver}
                    className="btn btn-outline-danger btn-sm"
                  >
                    Request OFF
                  </button>
                )}
              </div>
            </div>
            <div className="card-custom overflow-hidden bg-white border-0">
              <div className="table-responsive" style={{ maxHeight: '70vh' }}>
                <table className="table table-hover align-middle text-center m-0">
                  <thead
                    className="sticky-top"
                    style={{ background: '#F4F7FE' }}
                  >
                    <tr>
                      <th className="py-3 text-muted">Day</th>
                      {MEMBERS_CONFIG.map((m) => (
                        <th key={m.id} className="text-dark">
                          {m.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mealSheet.map((d, idx) => (
                      <tr
                        key={d.day}
                        className={d.day === currentDay ? 'table-active' : ''}
                      >
                        <td className="fw-bold text-muted">{d.day}</td>
                        {MEMBERS_CONFIG.map((m) => (
                          <td
                            key={m.id}
                            onClick={() =>
                              isOfficialManager &&
                              d.day === currentDay &&
                              !isManagerLocked &&
                              handleManagerAction(idx, m.id)
                            }
                            style={{ cursor: 'pointer' }}
                          >
                            {d.status[m.id] ? (
                              <span className="badge bg-success bg-opacity-10 text-success border border-success">
                                ON
                              </span>
                            ) : (
                              <span className="badge bg-danger bg-opacity-10 text-danger border border-danger">
                                OFF
                              </span>
                            )}
                            {d.day === currentDay &&
                              d.requests?.[m.id] &&
                              d.status[m.id] && (
                                <div className="mt-1">
                                  <span
                                    className="badge bg-warning text-dark"
                                    style={{ fontSize: '0.6rem' }}
                                  >
                                    Req OFF
                                  </span>
                                </div>
                              )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'bazaar' && (
          <div className="animate__animated animate__fadeIn">
            {isOfficialManager && (
              <div className="card-custom p-3 mb-4 bg-primary bg-opacity-10 border-primary">
                <div className="d-flex justify-content-between align-items-center">
                  <h6 className="m-0 text-primary-custom d-flex align-items-center">
                    <FaExchangeAlt className="me-2" /> Delegate Authority (
                    {inputDate})
                  </h6>
                  {delegatedManagerId ? (
                    <div className="d-flex align-items-center gap-2">
                      <span className="badge bg-primary">
                        Assigned:{' '}
                        {
                          MEMBERS_CONFIG.find(
                            (m) => m.id === delegatedManagerId
                          )?.name
                        }
                      </span>
                      <button
                        onClick={cancelDelegation}
                        className="btn btn-sm btn-outline-danger bg-white"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="d-flex gap-2">
                      <select
                        className="form-select form-select-sm"
                        style={{ width: '150px' }}
                        value={delegateToId}
                        onChange={(e) => setDelegateToId(e.target.value)}
                      >
                        <option value="">Select Member</option>
                        {MEMBERS_CONFIG.filter(
                          (m) => m.id !== loggedInMemberId
                        ).map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleDelegation}
                        className="btn btn-sm btn-primary-custom"
                      >
                        Assign
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {hasAccess ? (
              <div className="card-custom p-4 mb-4 border-0 bg-white shadow-sm border-top border-4 border-success">
                <div className="d-flex justify-content-between mb-3">
                  <h5 className="fw-bold text-success">
                    <FaUserCheck /> Add Expense
                  </h5>
                  {delegatedManagerId === loggedInMemberId && (
                    <span className="badge bg-info text-dark">
                      You are Delegated Manager
                    </span>
                  )}
                </div>
                <form onSubmit={submitBazaar}>
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <input
                        type="date"
                        className="form-control"
                        value={inputDate}
                        onChange={(e) => setInputDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-6">
                      <input
                        type="text"
                        className="form-control bg-light"
                        value={loggedInMemberInfo?.name}
                        readOnly
                      />
                    </div>
                  </div>
                  {currentItems.map((item, idx) => (
                    <div key={idx} className="d-flex gap-2 mb-2">
                      <input
                        placeholder="Item"
                        className="form-control"
                        value={item.name}
                        onChange={(e) => {
                          const n = [...currentItems];
                          n[idx].name = e.target.value;
                          setCurrentItems(n);
                        }}
                      />
                      <input
                        placeholder="Price"
                        type="number"
                        className="form-control"
                        style={{ width: '100px' }}
                        value={item.price}
                        onChange={(e) => {
                          const n = [...currentItems];
                          n[idx].price = e.target.value;
                          setCurrentItems(n);
                        }}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-sm text-primary mb-2"
                    onClick={() =>
                      setCurrentItems([
                        ...currentItems,
                        { name: '', price: '' },
                      ])
                    }
                  >
                    + Add Row
                  </button>
                  <button className="btn btn-primary-custom w-100">Save</button>
                </form>
              </div>
            ) : (
              <div className="alert alert-secondary text-center">
                Permission Denied for {inputDate}
              </div>
            )}

            <h5 className="text-dark mb-3 fw-bold">History</h5>
            <div className="d-flex flex-column gap-3">
              {MEMBERS_CONFIG.map((member) => {
                const mData = bazaarList.filter(
                  (b) => b.shopperId === member.id
                );
                const isOpen = expandedMemberId === member.id;
                return (
                  <div
                    key={member.id}
                    className="card-custom border-0 bg-white overflow-hidden shadow-sm"
                  >
                    <div
                      className="p-3 d-flex justify-content-between align-items-center"
                      style={{
                        background: isOpen ? '#F4F7FE' : 'white',
                        cursor: 'pointer',
                      }}
                      onClick={() =>
                        setExpandedMemberId(isOpen ? null : member.id)
                      }
                    >
                      <div className="d-flex align-items-center gap-3">
                        <div
                          className="rounded-circle text-dark d-flex align-items-center justify-content-center fw-bold border"
                          style={{
                            width: '40px',
                            height: '40px',
                            background: member.gradient,
                          }}
                        >
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <h6 className="m-0 fw-bold text-dark">
                            {member.name}
                          </h6>
                          <small className="text-muted">
                            {mData.length} Entries
                          </small>
                        </div>
                      </div>
                      <h5 className="text-primary-custom m-0 fw-bold">
                        ৳{mData.reduce((a, b) => a + b.subTotal, 0)}
                      </h5>
                    </div>
                    {isOpen && (
                      <div className="border-top border-light p-3 bg-light bg-opacity-25">
                        {mData.map((b) => (
                          <div
                            key={b.id}
                            className="bg-white p-3 rounded border border-light shadow-sm mb-2 position-relative"
                          >
                            <div className="d-flex justify-content-between border-bottom pb-1 mb-1">
                              <span className="badge bg-dark">{b.date}</span>
                              <span className="fw-bold">৳{b.subTotal}</span>
                            </div>
                            <div className="text-muted small">
                              {b.items.map((i, x) => (
                                <span key={x}>
                                  {i.name} ({i.price})
                                  {x !== b.items.length - 1 ? ', ' : ''}
                                </span>
                              ))}
                            </div>
                            {user.email === b.createdBy && (
                              <button
                                onClick={() => deleteBazaar(b.id)}
                                className="btn btn-sm text-danger position-absolute top-0 end-0 p-1"
                              >
                                <FaTrash />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className="bottom-nav">
        <FaHome
          className={`fs-4 ${
            activeTab === 'dashboard' ? 'text-primary-custom' : 'text-muted'
          }`}
          onClick={() => setActiveTab('dashboard')}
        />
        <FaUtensils
          className={`fs-4 ${
            activeTab === 'meals' ? 'text-primary-custom' : 'text-muted'
          }`}
          onClick={() => setActiveTab('meals')}
        />
        <FaWallet
          className={`fs-4 ${
            activeTab === 'bazaar' ? 'text-primary-custom' : 'text-muted'
          }`}
          onClick={() => setActiveTab('bazaar')}
        />
      </div>
      <ToastContainer position="top-center" theme="colored" />
    </div>
  );
};
export default Home;
