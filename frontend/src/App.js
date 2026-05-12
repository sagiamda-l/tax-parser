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

// 지출 분류 및 테마별 컬러 정의
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

const themes = {
  light: {
    surface: "#fef7ff",
    surfaceContainer: "#f3edf7",
    primary: "#6750a4",
    onSurface: "#1d1b20",
    onSurfaceVariant: "#49454f",
    outline: "#79747e",
    tableHead: "#eaddff",
  },
  dark: {
    surface: "#141218",
    surfaceContainer: "#211f26",
    primary: "#d0bcff",
    onSurface: "#e6e1e5",
    onSurfaceVariant: "#cac4d0",
    outline: "#938f99",
    tableHead: "#332d41",
  },
};

function App() {
  const [themeMode, setThemeMode] = useState("system");
  const [currentTheme, setCurrentTheme] = useState(themes.light);
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({ documents: [], tags: [] });
  const [modified, setModified] = useState({});
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    year: new Date().getFullYear(),
    customer: "All",
    filename: "All",
  });
  const [searchTerm, setSearchTerm] = useState("");

  // 다크모드 시스템 설정 감지 및 적용
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      if (themeMode === "system") {
        setCurrentTheme(mediaQuery.matches ? themes.dark : themes.light);
      } else {
        setCurrentTheme(themes[themeMode]);
      }
    };
    applyTheme();
    mediaQuery.addEventListener("change", applyTheme);
    return () => mediaQuery.removeEventListener("change", applyTheme);
  }, [themeMode]);

  useEffect(() => {
    loadData();
  }, [filters.year]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resRec, resStat] = await Promise.all([
        axios.get(`${API_URL}/records?year=${filters.year}`),
        axios.get(`${API_URL}/stats?year=${filters.year}`),
      ]);
      setRecords(resRec.data);
      setStats(resStat.data);
      setModified({});
    } catch (err) {
      console.error("Data load failed", err);
    } finally {
      setLoading(false);
    }
  };

  // 데이터 계산 및 필터링
  const customerList = useMemo(
    () =>
      ["All", ...new Set(records.map((r) => r.customer))]
        .filter(Boolean)
        .sort(),
    [records],
  );
  const filenameList = useMemo(
    () => ["All", ...new Set(records.map((r) => r.filename))].filter(Boolean),
    [records],
  );

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

  // 주요 기능 핸들러
  const handleUpload = async () => {
    if (!file) return alert("파일을 선택하세요.");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("target_year", filters.year);
    try {
      await axios.post(`${API_URL}/upload`, formData);
      alert("업로드 성공!");
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || "업로드 중 오류 발생");
    }
  };

  const handleSaveAll = async () => {
    const updates = Object.entries(modified).map(([id, tag]) => ({
      id: parseInt(id),
      tag,
    }));
    if (updates.length === 0) return alert("수정사항이 없습니다.");
    await axios.post(`${API_URL}/update-tags`, updates);
    alert("저장되었습니다.");
    loadData();
  };

  const exportExcel = async () => {
    const res = await axios.post(`${API_URL}/export/excel`, filteredData, {
      responseType: "blob",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([res.data]));
    link.download = `세무결산_리포트_${filters.year}.xlsx`;
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
      {/* 상단 앱바 */}
      <header style={topAppBar}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "24px" }}>💎</span>
          <h2 style={{ margin: 0, fontWeight: 500, letterSpacing: "-0.5px" }}>
            Tax Settlement Master
          </h2>
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

      {/* 메인 레이아웃 */}
      <main style={mainLayout}>
        {/* 사이드바: 통계 및 요약 */}
        <section style={sideColumn}>
          <div
            style={{
              ...md3Card,
              backgroundColor: currentTheme.surfaceContainer,
            }}
          >
            <h4 style={cardTitle}>📊 지출 비율 합계</h4>
            <div style={{ padding: "4px 0" }}>
              {tagStats.map((item) => (
                <div
                  key={item.tag}
                  style={ratioRow}
                  title={`건수: ${item.count}건 / 금액: ${item.total.toLocaleString()}원`}
                >
                  <div style={ratioLabel}>
                    <span>
                      {EXPENSE_TAGS[item.tag]?.icon} {item.tag}
                    </span>
                    <strong>{item.percentage.toFixed(1)}%</strong>
                  </div>
                  <div style={progressBase}>
                    <div
                      style={{
                        ...progressFill,
                        width: `${item.percentage}%`,
                        backgroundColor:
                          EXPENSE_TAGS[item.tag]?.color || currentTheme.primary,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                marginTop: "20px",
                paddingTop: "15px",
                borderTop: `1px solid ${currentTheme.outline}33`,
              }}
            >
              <small style={{ opacity: 0.7 }}>총 합계 금액</small>
              <div
                style={{
                  fontSize: "20px",
                  fontWeight: "bold",
                  color: currentTheme.primary,
                }}
              >
                {totalAmount.toLocaleString()}원
              </div>
            </div>
          </div>

          <div
            style={{
              ...md3Card,
              backgroundColor: currentTheme.surfaceContainer,
              marginTop: "20px",
            }}
          >
            <h4 style={cardTitle}>📁 업로드 히스토리</h4>
            <div style={{ maxHeight: "250px", overflowY: "auto" }}>
              {stats.documents.map((d, i) => (
                <div key={i} style={docListItem}>
                  <div style={{ fontSize: "11px", opacity: 0.6 }}>
                    {d.customer}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "13px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "140px",
                      }}
                    >
                      {d.filename}
                    </span>
                    <strong style={{ fontSize: "13px" }}>
                      {d.total.toLocaleString()}원
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 메인 콘텐츠: 필터 및 테이블 */}
        <section style={mainColumn}>
          <div
            style={{
              ...md3Card,
              backgroundColor: currentTheme.surfaceContainer,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "16px",
                flexWrap: "wrap",
                alignItems: "flex-end",
              }}
            >
              <div style={filterSet}>
                <label style={filterLabel}>기준연도</label>
                <select
                  style={{ ...md3Select, color: currentTheme.onSurface }}
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
                <label style={filterLabel}>이용자</label>
                <select
                  style={{ ...md3Select, color: currentTheme.onSurface }}
                  value={filters.customer}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      customer: e.target.value,
                      filename: "All",
                    })
                  }
                >
                  {customerList.map((c) => (
                    <option key={c} value={c}>
                      {c === "All" ? "전체 이용자" : c}
                    </option>
                  ))}
                </select>
              </div>
              <div style={filterSet}>
                <label style={filterLabel}>파일명</label>
                <select
                  style={{ ...md3Select, color: currentTheme.onSurface }}
                  value={filters.filename}
                  onChange={(e) =>
                    setFilters({ ...filters, filename: e.target.value })
                  }
                >
                  {filenameList.map((f) => (
                    <option key={f} value={f}>
                      {f === "All" ? "전체 파일" : f}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: "200px" }}>
                <label style={filterLabel}>가맹점 검색</label>
                <input
                  style={{ ...md3Search, color: currentTheme.onSurface }}
                  placeholder="가맹점명을 입력하세요..."
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                marginTop: "20px",
                borderTop: `1px solid ${currentTheme.outline}33`,
                paddingTop: "20px",
              }}
            >
              <input
                type="file"
                onChange={(e) => setFile(e.target.files[0])}
                style={{ fontSize: "12px" }}
              />
              <button onClick={handleUpload} style={fabBtn}>
                파싱 업로드
              </button>
              <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
                <button
                  onClick={handleSaveAll}
                  style={{
                    ...fabBtn,
                    backgroundColor: currentTheme.primary,
                    color: currentTheme.surface,
                  }}
                >
                  일괄 저장
                </button>
                <button
                  onClick={exportExcel}
                  style={{
                    ...fabBtn,
                    backgroundColor: "#2e7d32",
                    color: "#fff",
                  }}
                >
                  Excel
                </button>
              </div>
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
            <div style={{ overflowX: "auto" }}>
              <table style={md3Table}>
                <thead>
                  <tr style={{ backgroundColor: currentTheme.tableHead }}>
                    <th style={md3Th}>날짜</th>
                    <th style={md3Th}>이용자</th>
                    <th style={md3Th}>가맹점명</th>
                    <th style={md3Th}>금액</th>
                    <th style={md3Th}>태그 분류</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((r) => (
                    <tr
                      key={r.id}
                      style={{
                        ...md3Tr,
                        borderBottom: `1px solid ${currentTheme.outline}22`,
                      }}
                    >
                      <td style={md3Td}>{r.pay_date}</td>
                      <td style={md3Td}>
                        <span style={userBadge}>{r.customer}</span>
                      </td>
                      <td
                        style={{ ...md3Td, textAlign: "left", fontWeight: 500 }}
                      >
                        {r.vendor}
                      </td>
                      <td
                        style={{
                          ...md3Td,
                          textAlign: "right",
                          fontWeight: "bold",
                        }}
                      >
                        {r.amount.toLocaleString()}원
                      </td>
                      <td style={md3Td}>
                        <select
                          value={modified[r.id] || r.tag}
                          onChange={(e) =>
                            setModified({ ...modified, [r.id]: e.target.value })
                          }
                          style={{
                            ...miniSelect,
                            color: currentTheme.onSurface,
                          }}
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
        </section>
      </main>
    </div>
  );
}

// --- MD3 Styles (정의 누락 수정 완료) ---
const appContainer = {
  minHeight: "100vh",
  paddingBottom: "40px",
  transition: "all 0.3s ease",
};
const topAppBar = {
  height: "80px",
  padding: "0 32px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};
const themeToggleGroup = {
  display: "flex",
  borderRadius: "100px",
  border: "1px solid #79747e",
  overflow: "hidden",
};
const toggleBtn = {
  border: "none",
  padding: "6px 16px",
  fontSize: "11px",
  cursor: "pointer",
  fontWeight: "bold",
};
const mainLayout = {
  display: "grid",
  gridTemplateColumns: "340px 1fr",
  gap: "24px",
  padding: "0 32px",
};

const sideColumn = { display: "flex", flexDirection: "column" };
const mainColumn = { display: "flex", flexDirection: "column" };

const md3Card = {
  padding: "24px",
  borderRadius: "28px",
  border: "1px solid rgba(0,0,0,0.05)",
};
const cardTitle = {
  margin: "0 0 20px 0",
  fontWeight: 500,
  fontSize: "15px",
  opacity: 0.8,
};
const ratioRow = { marginBottom: "18px", cursor: "help" };
const ratioLabel = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: "13px",
  marginBottom: "6px",
};
const progressBase = {
  height: "10px",
  width: "100%",
  backgroundColor: "rgba(0,0,0,0.08)",
  borderRadius: "100px",
  overflow: "hidden",
};
const progressFill = {
  height: "100%",
  transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
};
const docListItem = {
  padding: "12px 0",
  borderBottom: "1px solid rgba(0,0,0,0.05)",
};

const filterSet = { display: "flex", flexDirection: "column", gap: "6px" };
const filterLabel = {
  fontSize: "12px",
  fontWeight: "bold",
  opacity: 0.7,
  marginLeft: "4px",
};
const md3Select = {
  padding: "10px 12px",
  borderRadius: "12px",
  border: "1px solid #79747e",
  background: "transparent",
  fontSize: "14px",
};
const md3Search = {
  width: "100%",
  padding: "10px 16px",
  borderRadius: "12px",
  border: "1px solid #79747e",
  background: "transparent",
  fontSize: "14px",
};
const fabBtn = {
  padding: "10px 24px",
  borderRadius: "100px",
  border: "none",
  backgroundColor: "#eaddff",
  color: "#21005d",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "13px",
};

const md3Table = { width: "100%", borderCollapse: "collapse" };
const md3Th = {
  padding: "16px",
  textAlign: "center",
  fontSize: "12px",
  fontWeight: "bold",
};
const md3Td = { padding: "16px", textAlign: "center", fontSize: "14px" };
const md3Tr = { transition: "background 0.2s" };
const userBadge = {
  padding: "4px 8px",
  backgroundColor: "rgba(0,0,0,0.05)",
  borderRadius: "6px",
  fontSize: "12px",
};
const miniSelect = {
  border: "1px solid rgba(0,0,0,0.1)",
  background: "transparent",
  padding: "4px",
  borderRadius: "4px",
};

export default App;
