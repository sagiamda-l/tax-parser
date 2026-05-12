import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const API_URL = "http://192.168.0.241:3001";

// MD3 Dynamic Palette
const MD3_THEME = {
  light: {
    primary: "#6750a4",
    onPrimary: "#ffffff",
    primaryContainer: "#eaddff",
    onPrimaryContainer: "#21005d",
    surface: "#fef7ff",
    onSurface: "#1d1b20",
    surfaceVariant: "#e7e0eb",
    onSurfaceVariant: "#49454f",
    outline: "#79747e",
    secondaryContainer: "#e8def8",
  },
  dark: {
    primary: "#d0bcff",
    onPrimary: "#381e72",
    primaryContainer: "#4f378b",
    onPrimaryContainer: "#eaddff",
    surface: "#141218",
    onSurface: "#e6e1e5",
    surfaceVariant: "#49454f",
    onSurfaceVariant: "#cac4d0",
    outline: "#938f99",
    secondaryContainer: "#4a4458",
  },
};

const EXPENSE_TAGS = {
  기업업무추진비: { color: "#ff8787", icon: "🤝" },
  기부금: { color: "#f06595", icon: "❤️" },
  차량유지비: { color: "#845ef7", icon: "🚗" },
  지급수수료: { color: "#5c7cfa", icon: "💸" },
  소모품비: { color: "#22b8cf", icon: "📎" },
  운반비: { color: "#20c997", icon: "🚚" },
  광고선전비: { color: "#94d82d", icon: "📢" },
  여비교통비: { color: "#fcc419", icon: "🚄" },
  기타: { color: "#adb5bd", icon: "📦" },
};

function App() {
  const [themeMode, setThemeMode] = useState("system");
  const [theme, setTheme] = useState(MD3_THEME.light);
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
  const fileInputRef = useRef(null);

  // --- 테마 로직 ---
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => {
      const mode =
        themeMode === "system" ? (mq.matches ? "dark" : "light") : themeMode;
      setTheme(MD3_THEME[mode]);
    };
    updateTheme();
    mq.addEventListener("change", updateTheme);
    return () => mq.removeEventListener("change", updateTheme);
  }, [themeMode]);

  useEffect(() => {
    loadData();
  }, [filters.year]);

  const loadData = async () => {
    try {
      const [resRec, resStat] = await Promise.all([
        axios.get(`${API_URL}/records?year=${filters.year}`),
        axios.get(`${API_URL}/stats?year=${filters.year}`),
      ]);
      setRecords(resRec.data);
      setStats(resStat.data);
    } catch (err) {
      console.error(err);
    }
  };

  // --- 데이터 필터 및 통계 (useMemo 정교화) ---
  const customerList = useMemo(() => {
    return ["All", ...new Set(records.map((r) => r.customer))]
      .filter(Boolean)
      .sort();
  }, [records]);

  const filenameList = useMemo(() => {
    return ["All", ...new Set(records.map((r) => r.filename))].filter(Boolean);
  }, [records]);

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

  const monthlyTrend = useMemo(() => {
    const months = {};
    filteredData.forEach((r) => {
      const m = r.pay_date.substring(0, 7);
      if (!months[m]) months[m] = { month: m, total: 0, count: 0 };
      months[m].total += r.amount;
      months[m].count += 1;
    });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredData]);

  // --- 핸들러 ---
  const handleUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("target_year", filters.year);
    await axios.post(`${API_URL}/upload`, formData);
    loadData();
    setFile(null);
  };

  const handleSaveAll = async () => {
    const updates = Object.entries(modified).map(([id, tag]) => ({
      id: parseInt(id),
      tag,
    }));
    if (updates.length === 0) return alert("수정사항이 없습니다.");
    await axios.post(`${API_URL}/update-tags`, updates);
    alert("성공적으로 저장되었습니다.");
    loadData();
  };

  const exportExcel = () =>
    axios
      .post(`${API_URL}/export/excel`, filteredData, { responseType: "blob" })
      .then((res) => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([res.data]));
        link.download = `Settlement_${filters.year}.xlsx`;
        link.click();
      });

  const exportPDF = () =>
    axios
      .post(
        `${API_URL}/export/pdf`,
        { totalAmount, records: filteredData },
        { responseType: "blob" },
      )
      .then((res) => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([res.data]));
        link.download = `TaxReport_${filters.year}.pdf`;
        link.click();
      });

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div
          style={{
            ...tooltipCard,
            backgroundColor: theme.surfaceContainer,
            border: `1px solid ${theme.outline}`,
          }}
        >
          <p style={{ fontWeight: "bold", marginBottom: "4px" }}>{label}</p>
          <p style={{ color: theme.primary }}>
            {data.total.toLocaleString()}원
          </p>
          <small>{data.count}건</small>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      style={{
        ...appContainer,
        backgroundColor: theme.surface,
        color: theme.onSurface,
      }}
    >
      {/* Top App Bar */}
      <nav style={navBar}>
        <div style={brandSection}>
          <span style={{ fontSize: "28px" }}>💎</span>
          <h1 style={headlineMedium}>Tax Master v7.1</h1>
        </div>
        <div style={themeToggle}>
          {["system", "light", "dark"].map((m) => (
            <button
              key={m}
              onClick={() => setThemeMode(m)}
              style={{
                ...toggleBtn,
                backgroundColor:
                  themeMode === m ? theme.primary : "transparent",
                color: themeMode === m ? theme.onPrimary : theme.onSurface,
              }}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </nav>

      <main style={mainGrid}>
        {/* Left Column: Analytics & History */}
        <aside style={sideColumn}>
          <section
            style={{ ...md3Card, backgroundColor: theme.surfaceVariant }}
          >
            <h3 style={titleSmall}>📈 월별 추이</h3>
            <div style={{ height: "180px", marginTop: "16px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke={theme.outline}
                    opacity={0.1}
                  />
                  <XAxis dataKey="month" hide />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="total"
                    fill={theme.primary}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section
            style={{
              ...md3Card,
              backgroundColor: theme.surfaceVariant,
              marginTop: "24px",
            }}
          >
            <h3 style={titleSmall}>🥧 지출 비율</h3>
            <div style={{ marginTop: "16px" }}>
              {tagStats.map((item) => (
                <div
                  key={item.tag}
                  style={ratioContainer}
                  title={`합계: ${item.total.toLocaleString()}원 / 건수: ${item.count}건`}
                >
                  <div style={ratioHeader}>
                    <span style={labelMedium}>
                      {EXPENSE_TAGS[item.tag]?.icon} {item.tag}
                    </span>
                    <span style={labelMedium}>
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div style={progressBg}>
                    <div
                      style={{
                        ...progressFill,
                        width: `${item.percentage}%`,
                        backgroundColor:
                          EXPENSE_TAGS[item.tag]?.color || theme.primary,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 복구된 업로드 히스토리 */}
          <section
            style={{
              ...md3Card,
              backgroundColor: theme.surfaceVariant,
              marginTop: "24px",
              flex: 1,
            }}
          >
            <h3 style={titleSmall}>📁 업로드 히스토리</h3>
            <div style={historyList}>
              {stats.documents.map((d, i) => (
                <div key={i} style={historyItem}>
                  <div style={{ fontSize: "11px", opacity: 0.6 }}>
                    {d.customer}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "13px",
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "120px",
                      }}
                    >
                      {d.filename}
                    </span>
                    <strong>{d.total.toLocaleString()}원</strong>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>

        {/* Right Column: Grid & Filters */}
        <div style={contentColumn}>
          <div
            style={{
              ...md3Card,
              backgroundColor: theme.surfaceVariant,
              display: "flex",
              gap: "20px",
              flexWrap: "wrap",
            }}
          >
            <div style={inputGroup}>
              <label style={labelSmall}>기준연도</label>
              <select
                style={{ ...md3Select, color: theme.onSurface }}
                value={filters.year}
                onChange={(e) =>
                  setFilters({ ...filters, year: e.target.value })
                }
              >
                <option value="2026">2026년</option>
                <option value="2025">2025년</option>
              </select>
            </div>
            <div style={inputGroup}>
              <label style={labelSmall}>이용자</label>
              <select
                style={{ ...md3Select, color: theme.onSurface }}
                value={filters.customer}
                onChange={(e) =>
                  setFilters({ ...filters, customer: e.target.value })
                }
              >
                {customerList.map((c) => (
                  <option key={c} value={c}>
                    {c === "All" ? "전체" : c}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelSmall}>가맹점 검색</label>
              <input
                style={{ ...md3Input, color: theme.onSurface }}
                placeholder="검색어를 입력하세요..."
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div style={actionRow}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                style={tonalBtn}
                onClick={() => fileInputRef.current.click()}
              >
                📁 파일 선택
              </button>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={(e) => setFile(e.target.files[0])}
              />
              <span style={bodySmall}>
                {file ? file.name : "선택된 파일 없음"}
              </span>
              {file && (
                <button style={filledBtn} onClick={handleUpload}>
                  업로드
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button style={outlineBtn} onClick={exportExcel}>
                Excel
              </button>
              <button style={outlineBtn} onClick={exportPDF}>
                PDF 리포트
              </button>
              <button style={filledBtn} onClick={handleSaveAll}>
                일괄 저장
              </button>
            </div>
          </div>

          <div
            style={{
              ...md3Card,
              padding: 0,
              overflow: "hidden",
              marginTop: "20px",
            }}
          >
            <table style={md3Table}>
              <thead style={{ backgroundColor: theme.secondaryContainer }}>
                <tr>
                  <th style={thStyle}>날짜</th>
                  <th style={thStyle}>이용자</th>
                  <th style={thStyle}>가맹점</th>
                  <th style={thStyle}>금액</th>
                  <th style={thStyle}>태그</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((r) => (
                  <tr
                    key={r.id}
                    style={{ borderBottom: `1px solid ${theme.outline}22` }}
                  >
                    <td style={tdStyle}>{r.pay_date}</td>
                    <td style={tdStyle}>
                      <span style={badgeStyle}>{r.customer}</span>
                    </td>
                    <td
                      style={{ ...tdStyle, textAlign: "left", fontWeight: 500 }}
                    >
                      {r.vendor}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: "right",
                        fontWeight: "bold",
                      }}
                    >
                      {r.amount.toLocaleString()}
                    </td>
                    <td style={tdStyle}>
                      <select
                        style={miniSelect}
                        value={modified[r.id] || r.tag}
                        onChange={(e) =>
                          setModified({ ...modified, [r.id]: e.target.value })
                        }
                      >
                        {Object.keys(EXPENSE_TAGS).map((t) => (
                          <option key={t} value={t}>
                            {EXPENSE_TAGS[t].icon} {t}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

// --- 스타일 정의 (가독성 및 MD3 최적화) ---
const headlineMedium = {
  fontSize: "24px",
  fontWeight: 400,
  margin: 0,
  letterSpacing: "-0.5px",
  fontFamily: "Pretendard, sans-serif",
};
const titleSmall = {
  fontSize: "14px",
  fontWeight: 600,
  margin: 0,
  opacity: 0.8,
};
const bodySmall = { fontSize: "12px", fontWeight: 400, opacity: 0.7 };
const labelMedium = { fontSize: "12px", fontWeight: 500 };
const labelSmall = {
  fontSize: "11px",
  fontWeight: 600,
  marginBottom: "6px",
  display: "block",
  opacity: 0.6,
};

const appContainer = { minHeight: "100vh", transition: "background 0.3s" };
const navBar = {
  height: "80px",
  padding: "0 32px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};
const brandSection = { display: "flex", alignItems: "center", gap: "16px" };
const themeToggle = {
  display: "flex",
  borderRadius: "100px",
  border: "1px solid #79747e",
  overflow: "hidden",
};
const toggleBtn = {
  border: "none",
  padding: "6px 16px",
  fontSize: "10px",
  cursor: "pointer",
  fontWeight: "bold",
};

const mainGrid = {
  display: "grid",
  gridTemplateColumns: "320px 1fr",
  gap: "32px",
  padding: "0 32px 40px 32px",
};
const sideColumn = { display: "flex", flexDirection: "column" };
const contentColumn = { display: "flex", flexDirection: "column" };

const md3Card = {
  padding: "24px",
  borderRadius: "28px",
  border: "1px solid rgba(0,0,0,0.05)",
};
const ratioContainer = { marginBottom: "16px" };
const ratioHeader = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: "6px",
};
const progressBg = {
  height: "8px",
  width: "100%",
  backgroundColor: "rgba(0,0,0,0.08)",
  borderRadius: "100px",
  overflow: "hidden",
};
const progressFill = { height: "100%", transition: "width 0.8s ease" };

const historyList = {
  marginTop: "16px",
  maxHeight: "300px",
  overflowY: "auto",
};
const historyItem = {
  padding: "12px 0",
  borderBottom: "1px solid rgba(0,0,0,0.05)",
};

const inputGroup = { display: "flex", flexDirection: "column" };
const md3Select = {
  padding: "10px",
  borderRadius: "12px",
  border: "1px solid #79747e",
  background: "transparent",
};
const md3Input = {
  width: "100%",
  padding: "10px 16px",
  borderRadius: "12px",
  border: "1px solid #79747e",
  background: "transparent",
};

const actionRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: "24px",
};
const filledBtn = {
  padding: "10px 24px",
  borderRadius: "100px",
  border: "none",
  backgroundColor: "#6750a4",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
};
const tonalBtn = {
  padding: "10px 24px",
  borderRadius: "100px",
  border: "none",
  backgroundColor: "#eaddff",
  color: "#21005d",
  fontWeight: "bold",
  cursor: "pointer",
};
const outlineBtn = {
  padding: "10px 24px",
  borderRadius: "100px",
  border: "1px solid #79747e",
  background: "transparent",
  color: "inherit",
  fontWeight: "bold",
  cursor: "pointer",
};

const md3Table = { width: "100%", borderCollapse: "collapse" };
const thStyle = { padding: "16px", fontSize: "12px", textAlign: "center" };
const tdStyle = { padding: "16px", fontSize: "14px", textAlign: "center" };
const badgeStyle = {
  padding: "4px 8px",
  borderRadius: "8px",
  backgroundColor: "rgba(0,0,0,0.05)",
  fontSize: "11px",
};
const miniSelect = {
  border: "none",
  background: "transparent",
  color: "inherit",
  fontSize: "13px",
};
const tooltipCard = { padding: "12px", borderRadius: "16px", fontSize: "12px" };

export default App;
