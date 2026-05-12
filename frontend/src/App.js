import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const API_URL = "http://192.168.0.241:3001";

// MD3 Color Palettes (Light / Dark)
const themes = {
  light: {
    surface: "#fef7ff",
    surfaceContainer: "#f3edf7",
    primary: "#6750a4",
    onSurface: "#1d1b20",
    onSurfaceVariant: "#49454f",
    outline: "#79747e",
    error: "#b3261e",
  },
  dark: {
    surface: "#141218",
    surfaceContainer: "#211f26",
    primary: "#d0bcff",
    onSurface: "#e6e1e5",
    onSurfaceVariant: "#cac4d0",
    outline: "#938f99",
    error: "#f2b8b5",
  },
};

function App() {
  const [themeMode, setThemeMode] = useState("system"); // system, light, dark
  const [currentTheme, setCurrentTheme] = useState(themes.light);
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({ documents: [], tags: [] });
  const [modified, setModified] = useState({});
  const [file, setFile] = useState(null);
  const [filters, setFilters] = useState({
    year: new Date().getFullYear(),
    customer: "All",
    filename: "All",
  });
  const [searchTerm, setSearchTerm] = useState("");

  // --- Theme Logic ---
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (themeMode === "system") {
        setCurrentTheme(mediaQuery.matches ? themes.dark : themes.light);
      }
    };

    if (themeMode === "system") handleChange();
    else setCurrentTheme(themes[themeMode]);

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [themeMode]);

  useEffect(() => {
    loadData();
  }, [filters.year]);

  const loadData = async () => {
    const [resRec, resStat] = await Promise.all([
      axios.get(`${API_URL}/records?year=${filters.year}`),
      axios.get(`${API_URL}/stats?year=${filters.year}`),
    ]);
    setRecords(resRec.data);
    setStats(resStat.data);
  };

  // --- Data Processing (Memoized) ---
  const filteredData = useMemo(
    () =>
      records.filter(
        (r) =>
          (filters.customer === "All" || r.customer === filters.customer) &&
          (filters.filename === "All" || r.filename === filters.filename) &&
          r.vendor.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [records, filters, searchTerm],
  );

  const totalAmount = filteredData.reduce((sum, r) => sum + r.amount, 0);

  const tagStats = useMemo(() => {
    const tags = {};
    filteredData.forEach((r) => {
      const t = modified[r.id] || r.tag;
      if (!tags[t]) tags[t] = { total: 0, count: 0 };
      tags[t].total += r.amount;
      tags[t].count += 1;
    });
    return Object.entries(tags)
      .map(([tag, val]) => ({
        tag,
        ...val,
        percentage: totalAmount > 0 ? (val.total / totalAmount) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredData, totalAmount, modified]);

  // --- Export Actions ---
  const handleExportExcel = async () => {
    const res = await axios.post(`${API_URL}/export/excel`, filteredData, {
      responseType: "blob",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([res.data]));
    link.download = `TaxReport_${filters.year}.xlsx`;
    link.click();
  };

  const handleExportPDF = async () => {
    const res = await axios.post(
      `${API_URL}/export/pdf`,
      {
        totalAmount,
        records: filteredData,
      },
      { responseType: "blob" },
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([res.data]));
    link.download = `Settlement_Report.pdf`;
    link.click();
  };

  return (
    <div
      style={{
        ...appContainer,
        backgroundColor: currentTheme.surface,
        color: currentTheme.onSurface,
      }}
    >
      {/* MD3 Top App Bar */}
      <header style={topAppBar}>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <span style={{ fontSize: "24px" }}>💎</span>
          <h2 style={{ margin: 0, fontWeight: 400 }}>세무 결산 마스터 v6.0</h2>
        </div>

        <div style={themeToggleGroup}>
          {["system", "light", "dark"].map((m) => (
            <button
              key={m}
              onClick={() => setThemeMode(m)}
              style={{
                ...toggleBtn,
                backgroundColor:
                  themeMode === m ? currentTheme.primary : "transparent",
                color:
                  themeMode === m
                    ? currentTheme.surface
                    : currentTheme.onSurface,
              }}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content Layout */}
      <main style={mainLayout}>
        {/* Left Column: Analytics */}
        <section style={sideColumn}>
          <div
            style={{
              ...md3Card,
              backgroundColor: currentTheme.surfaceContainer,
            }}
          >
            <h4 style={cardTitle}>📊 지출 비율 (Hover details)</h4>
            {tagStats.map((item) => (
              <div
                key={item.tag}
                style={ratioRow}
                title={`${item.count}건 / ${item.total.toLocaleString()}원`}
              >
                <div style={ratioLabel}>
                  <span>{item.tag}</span>
                  <strong>{item.percentage.toFixed(1)}%</strong>
                </div>
                <div style={progressBase}>
                  <div
                    style={{
                      ...progressFill,
                      width: `${item.percentage}%`,
                      backgroundColor: currentTheme.primary,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              ...md3Card,
              backgroundColor: currentTheme.surfaceContainer,
              marginTop: "20px",
            }}
          >
            <h4 style={cardTitle}>📑 문서 검증 내역</h4>
            <div style={{ maxHeight: "200px", overflowY: "auto" }}>
              {stats.documents.map((d, i) => (
                <div key={i} style={docListItem}>
                  <small>{d.customer}</small>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span style={{ fontSize: "12px" }}>
                      {d.filename.substring(0, 12)}..
                    </span>
                    <strong>{d.total.toLocaleString()}원</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right Column: Controls & Table */}
        <section style={mainColumn}>
          <div
            style={{
              ...md3Card,
              backgroundColor: currentTheme.surfaceContainer,
              display: "flex",
              gap: "15px",
              flexWrap: "wrap",
            }}
          >
            <div style={filterSet}>
              <span>📅 연도</span>
              <select
                style={md3Select}
                value={filters.year}
                onChange={(e) =>
                  setFilters({ ...filters, year: e.target.value })
                }
              >
                <option value="2026">2026년</option>
                <option value="2025">2025년</option>
              </select>
            </div>
            <div style={filterSet}>
              <span>👤 이용자</span>
              <select
                style={md3Select}
                value={filters.customer}
                onChange={(e) =>
                  setFilters({ ...filters, customer: e.target.value })
                }
              >
                {["All", ...new Set(records.map((r) => r.customer))].map(
                  (c) => (
                    <option key={c} value={c}>
                      {c === "All" ? "전체" : c}
                    </option>
                  ),
                )}
              </select>
            </div>
            <input
              style={md3Search}
              placeholder="가맹점 검색..."
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
              <button onClick={handleExportExcel} style={fabBtn}>
                Excel
              </button>
              <button onClick={handleExportPDF} style={fabBtn}>
                PDF Report
              </button>
            </div>
          </div>

          <div
            style={{
              ...md3Card,
              backgroundColor: currentTheme.surfaceContainer,
              marginTop: "20px",
              padding: 0,
              overflow: "hidden",
            }}
          >
            <table style={md3Table}>
              <thead>
                <tr
                  style={{ borderBottom: `1px solid ${currentTheme.outline}` }}
                >
                  <th style={md3Th}>날짜</th>
                  <th style={md3Th}>이용자</th>
                  <th style={md3Th}>가맹점</th>
                  <th style={md3Th}>금액</th>
                  <th style={md3Th}>태그</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((r) => (
                  <tr key={r.id} style={md3Tr}>
                    <td style={md3Td}>{r.pay_date}</td>
                    <td style={md3Td}>{r.customer}</td>
                    <td style={{ ...md3Td, textAlign: "left" }}>{r.vendor}</td>
                    <td style={{ ...md3Td, fontWeight: "bold" }}>
                      {r.amount.toLocaleString()}
                    </td>
                    <td style={md3Td}>
                      <select
                        value={modified[r.id] || r.tag}
                        onChange={(e) =>
                          setModified({ ...modified, [r.id]: e.target.value })
                        }
                        style={miniSelect}
                      >
                        {Object.keys(
                          stats.tags.length ? stats.tags : { 기타: 0 },
                        ).map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

// --- MD3 Styles ---
const appContainer = {
  minHeight: "100vh",
  padding: "0 0 40px 0",
  transition: "all 0.3s ease",
};
const topAppBar = {
  height: "64px",
  padding: "0 24px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};
const themeToggleGroup = {
  display: "flex",
  borderRadius: "20px",
  border: "1px solid #79747e",
  overflow: "hidden",
};
const toggleBtn = {
  border: "none",
  padding: "5px 12px",
  fontSize: "10px",
  cursor: "pointer",
};
const mainLayout = {
  display: "grid",
  gridTemplateColumns: "320px 1fr",
  gap: "24px",
  padding: "0 24px",
};
const md3Card = {
  padding: "24px",
  borderRadius: "28px",
  transition: "background 0.3s",
};
const cardTitle = { margin: "0 0 16px 0", fontWeight: 500, fontSize: "14px" };
const ratioRow = { marginBottom: "16px", cursor: "help" };
const ratioLabel = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: "12px",
  marginBottom: "4px",
};
const progressBase = {
  height: "8px",
  width: "100%",
  backgroundColor: "rgba(0,0,0,0.1)",
  borderRadius: "4px",
  overflow: "hidden",
};
const progressFill = {
  height: "100%",
  transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
};
const docListItem = {
  padding: "12px 0",
  borderBottom: "1px solid rgba(0,0,0,0.05)",
};
const filterSet = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  fontSize: "11px",
};
const md3Select = {
  padding: "8px",
  borderRadius: "8px",
  border: "1px solid #79747e",
  background: "transparent",
  color: "inherit",
};
const md3Search = {
  flex: 1,
  padding: "0 16px",
  borderRadius: "28px",
  border: "1px solid #79747e",
  background: "transparent",
  color: "inherit",
};
const fabBtn = {
  padding: "10px 20px",
  borderRadius: "16px",
  border: "none",
  backgroundColor: "#eaddff",
  color: "#21005d",
  fontWeight: 500,
  cursor: "pointer",
};
const md3Table = { width: "100%", borderCollapse: "collapse" };
const md3Th = {
  padding: "16px",
  textAlign: "center",
  fontSize: "12px",
  opacity: 0.7,
};
const md3Td = { padding: "16px", textAlign: "center", fontSize: "14px" };
const md3Tr = { borderBottom: "1px solid rgba(0,0,0,0.05)" };
const miniSelect = {
  border: "none",
  background: "transparent",
  color: "inherit",
  fontSize: "13px",
};

export default App;
