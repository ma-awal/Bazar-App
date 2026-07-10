import React, { useState, useMemo, useEffect } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
  query,
  orderBy,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  FaHome,
  FaUtensils,
  FaWallet,
  FaSignOutAlt,
  FaCalendarAlt,
  FaUserShield,
  FaChartLine,
  FaPlus,
  FaClock,
} from "react-icons/fa";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// --- STYLING CONSTANTS ---
const THEME = {
  primary: "#4F46E5", // Indigo
  success: "#10B981", // Emerald
  danger: "#EF4444", // Rose
  warning: "#F59E0B", // Amber
  bg: "#F3F4F6",
  card: "#FFFFFF",
};

const MEMBERS_CONFIG = [
  { id: 1, name: "Amit", startDay: 1, endDay: 6, color: "#6366F1" },
  { id: 2, name: "Tofayel", startDay: 7, endDay: 12, color: "#EC4899" },
  { id: 3, name: "Abid", startDay: 13, endDay: 18, color: "#F59E0B" },
  { id: 4, name: "Awal", startDay: 19, endDay: 24, color: "#10B981" },
  { id: 5, name: "Guest", startDay: 25, endDay: 31, color: "#8B5CF6" },
];

const MEMBER_EMAILS = {
  "amit330@d.com": 1,
  "tofayel330@d.com": 2,
  "abid330@d.com": 3,
  "awal330@d.com": 4,
  "guest330@d.com": 5,
};

const Home = () => {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [bazaarList, setBazaarList] = useState([]);
  const [mealSheet, setMealSheet] = useState([]);

  // Date Logic
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonthKey = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}`;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setLoading(false);
    });
    if (user) {
      const unsubBazaar = onSnapshot(
        query(collection(db, "bazaar"), orderBy("timestamp", "desc")),
        (snap) => {
          setBazaarList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }
      );
      const unsubMeals = onSnapshot(
        doc(db, "meals", currentMonthKey),
        (snap) => {
          if (snap.exists()) setMealSheet(snap.data().sheet);
          setLoading(false);
        }
      );
      return () => {
        unsubBazaar();
        unsubMeals();
      };
    }
    return () => unsub();
  }, [user, currentMonthKey]);

  const loggedInMemberId = useMemo(
    () => (user ? MEMBER_EMAILS[user.email] : null),
    [user]
  );

  // 📢 CURRENT MANAGER LOGIC
  const currentManager = useMemo(() => {
    return MEMBERS_CONFIG.find(
      (m) => currentDay >= m.startDay && currentDay <= m.endDay
    );
  }, [currentDay]);

  const stats = useMemo(() => {
    const currentMonthBazaar = bazaarList.filter((b) =>
      b.date.startsWith(currentMonthKey)
    );
    const totalCost = currentMonthBazaar.reduce(
      (acc, b) => acc + b.subTotal,
      0
    );
    const mStats = MEMBERS_CONFIG.map((m) => ({ ...m, meals: 0, spent: 0 }));

    currentMonthBazaar.forEach((b) => {
      const m = mStats.find((ms) => ms.id === b.shopperId);
      if (m) m.spent += b.subTotal;
    });

    let totalMeals = 0;
    mealSheet.forEach((d) => {
      MEMBERS_CONFIG.forEach((m) => {
        if (d.status[m.id]) {
          mStats.find((ms) => ms.id === m.id).meals++;
          totalMeals++;
        }
      });
    });

    const mealRate = totalMeals > 0 ? totalCost / totalMeals : 0;
    return {
      totalCost,
      mealRate,
      mStats: mStats.map((m) => ({
        ...m,
        balance: m.spent - m.meals * mealRate,
      })),
    };
  }, [bazaarList, mealSheet, currentMonthKey]);

  if (loading)
    return (
      <div className="d-flex flex-column vh-100 align-items-center justify-content-center bg-light">
        <div className="spinner-grow text-primary mb-3"></div>
        <h6 className="fw-bold text-muted">Securing your data...</h6>
      </div>
    );

  return (
    <div
      className="premium-app"
      style={{ background: "#F8FAFC", minHeight: "100vh" }}
    >
      {/* --- DESKTOP SIDEBAR --- */}
      <aside className="sidebar d-none d-lg-flex">
        <div className="brand p-4">
          <h4 className="fw-bolder text-primary mb-0">
            SmartMess<span className="text-dark">Pro</span>
          </h4>
        </div>
        <nav className="flex-grow-1 px-3">
          <NavItem
            active={activeTab === "dashboard"}
            icon={<FaChartLine />}
            label="Dashboard"
            onClick={() => setActiveTab("dashboard")}
          />
          <NavItem
            active={activeTab === "meals"}
            icon={<FaUtensils />}
            label="Meal Sheet"
            onClick={() => setActiveTab("meals")}
          />
          <NavItem
            active={activeTab === "bazaar"}
            icon={<FaWallet />}
            label="Expenses"
            onClick={() => setActiveTab("bazaar")}
          />
        </nav>
        <div className="p-4 border-top">
          <div className="d-flex align-items-center gap-3 mb-3">
            <div className="avatar">
              {MEMBERS_CONFIG.find(
                (m) => m.id === loggedInMemberId
              )?.name.charAt(0)}
            </div>
            <div className="small fw-bold">
              {MEMBERS_CONFIG.find((m) => m.id === loggedInMemberId)?.name}
            </div>
          </div>
          <button
            onClick={() => signOut(auth)}
            className="btn btn-sm btn-outline-danger w-100 rounded-pill"
          >
            <FaSignOutAlt /> Logout
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="content-area">
        {/* Mobile Header */}
        <div className="mobile-header d-lg-none">
          <h5 className="fw-bold m-0 text-primary">SmartMess</h5>
          <button
            onClick={() => signOut(auth)}
            className="btn btn-link text-danger p-0"
          >
            <FaSignOutAlt size={20} />
          </button>
        </div>

        <div className="container py-lg-4 px-3 px-lg-5">
          {/* --- 👑 DYNAMIC MANAGER CARD (Premium Indicator) --- */}
          <section className="manager-banner mb-4">
            <div className="card-premium glass-effect p-4 border-0">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="badge-live mb-2">
                    <span className="pulse-dot"></span> Active Now
                  </div>
                  <h2 className="fw-bold text-white mb-1">
                    Manager: {currentManager?.name}
                  </h2>
                  <p className="text-white-50 mb-0">
                    <FaClock className="me-2" /> Duty:{" "}
                    {currentManager?.startDay} - {currentManager?.endDay} July
                  </p>
                </div>
                <div className="d-none d-md-block">
                  <div className="duty-progress">
                    <svg viewBox="0 0 36 36" className="circular-chart">
                      <path
                        className="circle-bg"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="circle"
                        strokeDasharray={`${
                          ((currentDay - currentManager.startDay + 1) /
                            (currentManager.endDay -
                              currentManager.startDay +
                              1)) *
                          100
                        }, 100`}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {activeTab === "dashboard" && (
            <div className="animate-fade-in">
              {/* Quick Stats */}
              <div className="row g-3 mb-4">
                <StatCard
                  label="Meal Rate"
                  value={`৳${stats.mealRate.toFixed(2)}`}
                  icon={<FaChartLine />}
                  color="#4F46E5"
                />
                <StatCard
                  label="Mess Cost"
                  value={`৳${stats.totalCost}`}
                  icon={<FaWallet />}
                  color="#10B981"
                />
              </div>

              {/* Members Grid */}
              <h6 className="fw-bold text-dark mb-3">Member Overview</h6>
              <div className="row g-3">
                {stats.mStats.map((m) => (
                  <div key={m.id} className="col-12 col-md-6 col-xl-4">
                    <div className="card-member shadow-sm">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <div className="d-flex align-items-center gap-3">
                          <div
                            className="member-icon"
                            style={{ background: m.color }}
                          >
                            {m.name.charAt(0)}
                          </div>
                          <span className="fw-bold">
                            {m.name} {loggedInMemberId === m.id && "(You)"}
                          </span>
                        </div>
                        <div
                          className={`status-pill ${
                            m.balance >= 0 ? "plus" : "minus"
                          }`}
                        >
                          {m.balance >= 0 ? "+" : ""}
                          {m.balance.toFixed(0)}
                        </div>
                      </div>
                      <div className="d-flex justify-content-between small text-muted">
                        <span>
                          Meals: <b>{m.meals}</b>
                        </span>
                        <span>
                          Paid: <b>৳{m.spent}</b>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "meals" && (
            <div className="card-premium bg-white p-0 overflow-hidden shadow-sm border-0">
              <div className="p-3 bg-light border-bottom d-flex justify-content-between align-items-center">
                <h6 className="fw-bold m-0">Daily Meal Sheet</h6>
                <span className="badge bg-indigo-soft text-primary">
                  {today.toLocaleString("default", { month: "long" })}
                </span>
              </div>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="bg-light">
                    <tr>
                      <th className="ps-4">Day</th>
                      {MEMBERS_CONFIG.map((m) => (
                        <th key={m.id} className="text-center">
                          {m.name.charAt(0)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mealSheet.map((d, idx) => (
                      <tr
                        key={idx}
                        className={
                          d.day === currentDay ? "table-active-row" : ""
                        }
                      >
                        <td className="ps-4 fw-bold text-muted">{d.day}</td>
                        {MEMBERS_CONFIG.map((m) => (
                          <td key={m.id} className="text-center">
                            <div
                              className={`meal-indicator ${
                                d.status[m.id] ? "on" : "off"
                              }`}
                            ></div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "bazaar" && (
            <div className="row g-4">
              <div className="col-lg-5">
                <div
                  className="card-premium bg-white p-4 shadow-sm border-0 sticky-lg-top"
                  style={{ top: "20px" }}
                >
                  <h5 className="fw-bold mb-4">Add New Entry</h5>
                  {loggedInMemberId === currentManager?.id ? (
                    <form>
                      <div className="mb-3">
                        <label className="form-label small fw-bold">Date</label>
                        <input
                          type="date"
                          className="form-control rounded-pill"
                          defaultValue={today.toISOString().split("T")[0]}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label small fw-bold">
                          Items & Prices
                        </label>
                        <div className="input-group mb-2">
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Potato, Chicken..."
                          />
                          <input
                            type="number"
                            className="form-control"
                            placeholder="৳"
                            style={{ maxWidth: "80px" }}
                          />
                        </div>
                      </div>
                      <button className="btn btn-primary w-100 rounded-pill py-2 fw-bold">
                        Save Expense
                      </button>
                    </form>
                  ) : (
                    <div className="p-3 bg-light rounded-4 text-center">
                      <FaUserShield size={30} className="text-muted mb-2" />
                      <p className="small text-muted m-0">
                        Only current manager <b>({currentManager?.name})</b> can
                        add expenses.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="col-lg-7">
                <h6 className="fw-bold mb-3">Recent Transactions</h6>
                {bazaarList.map((b) => (
                  <div
                    key={b.id}
                    className="card-premium bg-white p-3 mb-2 shadow-sm border-0 d-flex justify-content-between align-items-center"
                  >
                    <div className="d-flex align-items-center gap-3">
                      <div className="icon-box bg-light text-primary">
                        <FaCalendarAlt />
                      </div>
                      <div>
                        <div className="fw-bold">
                          {
                            MEMBERS_CONFIG.find((m) => m.id === b.shopperId)
                              ?.name
                          }
                        </div>
                        <small className="text-muted">{b.date}</small>
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="fw-bold text-dark">৳{b.subTotal}</div>
                      <div
                        className="small text-muted"
                        style={{ fontSize: "10px" }}
                      >
                        {b.items.map((i) => i.name).join(", ")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* --- MOBILE BOTTOM NAV --- */}
      <nav className="mobile-nav d-lg-none">
        <NavIcon
          active={activeTab === "dashboard"}
          icon={<FaHome />}
          label="Home"
          onClick={() => setActiveTab("dashboard")}
        />
        <NavIcon
          active={activeTab === "meals"}
          icon={<FaUtensils />}
          label="Meals"
          onClick={() => setActiveTab("meals")}
        />
        <NavIcon
          active={activeTab === "bazaar"}
          icon={<FaWallet />}
          label="History"
          onClick={() => setActiveTab("bazaar")}
        />
      </nav>

      <ToastContainer position="top-center" theme="colored" />

      {/* --- INLINE PREMIUM CSS --- */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        :root { --p: #4F46E5; }
        .premium-app { font-family: 'Inter', sans-serif; display: flex; }
        .sidebar { width: 260px; height: 100vh; background: #fff; position: sticky; top: 0; flex-direction: column; border-right: 1px solid #E5E7EB; }
        .content-area { flex-grow: 1; padding-bottom: 80px; }
        .card-premium { border-radius: 24px; }
        .glass-effect { background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%); color: white; box-shadow: 0 20px 25px -5px rgba(79, 70, 229, 0.2); }
        .badge-live { display: inline-flex; align-items: center; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: bold; letter-spacing: 1px; }
        .pulse-dot { width: 8px; height: 8px; background: #10B981; border-radius: 50%; margin-right: 8px; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.5); opacity: 0.5; } 100% { transform: scale(1); opacity: 1; } }
        .stat-card { background: white; padding: 20px; border-radius: 20px; border: none; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .card-member { background: white; padding: 16px; border-radius: 20px; transition: 0.3s; }
        .card-member:hover { transform: translateY(-5px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
        .member-icon { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; }
        .status-pill { padding: 4px 12px; border-radius: 10px; font-weight: bold; font-size: 13px; }
        .status-pill.plus { background: #D1FAE5; color: #065F46; }
        .status-pill.minus { background: #FEE2E2; color: #991B1B; }
        .mobile-header { background: white; padding: 15px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; position: sticky; top:0; z-index: 100; }
        .mobile-nav { position: fixed; bottom: 0; width: 100%; background: white; display: flex; justify-content: space-around; padding: 10px; border-top: 1px solid #eee; box-shadow: 0 -5px 15px rgba(0,0,0,0.05); z-index: 1000; }
        .nav-item-custom { display: flex; align-items: center; gap: 12px; padding: 12px 15px; border-radius: 12px; cursor: pointer; transition: 0.2s; color: #6B7280; font-weight: 500; }
        .nav-item-custom.active { background: #EEF2FF; color: #4F46E5; }
        .meal-indicator { width: 12px; height: 12px; border-radius: 50%; margin: auto; }
        .meal-indicator.on { background: #10B981; box-shadow: 0 0 8px #10B981; }
        .meal-indicator.off { background: #EF4444; }
        .table-active-row { background: #F5F7FF !important; }
        .avatar { width: 35px; height: 35px; background: #4F46E5; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; }
        .circular-chart { display: block; margin: 10px auto; max-width: 60px; max-height: 60px; }
        .circle-bg { fill: none; stroke: rgba(255,255,255,0.2); stroke-width: 3.8; }
        .circle { fill: none; stroke-width: 2.8; stroke-linecap: round; stroke: white; animation: progress 1s ease-out forwards; }
        @keyframes progress { 0% { stroke-dasharray: 0 100; } }
      `,
        }}
      />
    </div>
  );
};

// --- Sub-Components for Clean Code ---
const NavItem = ({ icon, label, active, onClick }) => (
  <div
    onClick={onClick}
    className={`nav-item-custom mb-1 ${active ? "active" : ""}`}
  >
    {icon} {label}
  </div>
);

const NavIcon = ({ icon, label, active, onClick }) => (
  <div
    onClick={onClick}
    className={`text-center ${active ? "text-primary" : "text-muted"}`}
  >
    <div style={{ fontSize: "20px" }}>{icon}</div>
    <div style={{ fontSize: "10px", fontWeight: "bold" }}>{label}</div>
  </div>
);

const StatCard = ({ label, value, icon, color }) => (
  <div className="col-6">
    <div className="stat-card">
      <div className="d-flex justify-content-between align-items-start mb-2">
        <div className="small fw-bold text-muted">{label}</div>
        <div style={{ color }}>{icon}</div>
      </div>
      <h4 className="fw-bold m-0">{value}</h4>
    </div>
  </div>
);

export default Home;
