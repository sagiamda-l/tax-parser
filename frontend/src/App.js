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
// 🤝 신규 추가: 분리되어 있는 신고도움말 모달 컴포넌트 임포트
import HelpModal from "./HelpModal";

const API_URL = "http://192.168.0.241:3001";

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
    outlineVariant: "#c9c4d0",
    secondaryContainer: "#e8def8",
    tooltipBg: "#313033",
    tooltipText: "#f4eff4",
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
    outlineVariant: "#49454f",
    secondaryContainer: "#332d41",
    tooltipBg: "#e6e1e5",
    tooltipText: "#313033",
  },
};

const EXPENSE_TAGS_ORDER = [
  "기업업무추진비",
  "기부금",
  "차량유지비",
  "지급수수료",
  "소모품비",
  "운반비",
  "광고선전비",
  "여비교통비",
  "기타",
  "불필요",
];

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
  불필요: { color: "#868e96", icon: "❌" },
};

const parseToNumber = (val) => {
  if (val === undefined || val === null) return 0;
  if (typeof val === "number") return val;
  const cleaned = String(val).replace(/[^0-9.-]/g, "");
  return Number(cleaned) || 0;
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
    tag: "All",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [hoverData, setHoverData] = useState(null);
  const fileInputRef = useRef(null);

  const [filterOperator, setFilterOperator] = useState("all");
  const [filterAmount, setFilterAmount] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "pay_date",
    direction: "asc",
  });

  // 📋 상태 관리 추가: 기존 도움말(사용법) 외에 종합소득세 신고도움말 팝업을 열기 위한 제어 상태
  const [showHelp, setShowHelp] = useState(false);
  const [showReportHelp, setShowReportHelp] = useState(false);

  const toggleHelp = () => setShowHelp(!showHelp);

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
      console.error("Data fetch error", err);
    }
  };

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
  const tagList = useMemo(() => ["All", ...Object.keys(EXPENSE_TAGS)], []);

  const filteredData = useMemo(() => {
    return records.filter((r) => {
      const matchesCustomer =
        filters.customer === "All" || r.customer === filters.customer;
      const matchesFilename =
        filters.filename === "All" || r.filename === filters.filename;
      const matchesTag =
        filters.tag === "All" || (modified[r.id] || r.tag) === filters.tag;
      const matchesSearch = r.vendor
        ? r.vendor.toLowerCase().includes(searchTerm.toLowerCase())
        : false;

      if (
        !matchesCustomer ||
        !matchesFilename ||
        !matchesTag ||
        !matchesSearch
      ) {
        return false;
      }

      if (filterOperator === "all" || !filterAmount) return true;
      const recordAmt = parseToNumber(r.amount);
      const targetAmt = parseToNumber(filterAmount);

      switch (filterOperator) {
        case "gt":
          return recordAmt > targetAmt;
        case "lt":
          return recordAmt < targetAmt;
        case "eq":
          return recordAmt === targetAmt;
        case "gte":
          return recordAmt >= targetAmt;
        case "lte":
          return recordAmt <= targetAmt;
        case "ne":
          return recordAmt !== targetAmt;
        default:
          return true;
      }
    });
  }, [records, filters, searchTerm, modified, filterOperator, filterAmount]);

  const totalAmount = useMemo(() => {
    return filteredData.reduce((sum, r) => sum + parseToNumber(r.amount), 0);
  }, [filteredData]);

  const tagStats = useMemo(() => {
    const tags = {};
    filteredData.forEach((r) => {
      const t = modified[r.id] || r.tag;
      if (!t) return;
      if (!tags[t]) tags[t] = { total: 0, count: 0 };
      tags[t].total += parseToNumber(r.amount);
      tags[t].count += 1;
    });

    return Object.entries(tags)
      .map(([tag, val]) => ({
        tag,
        ...val,
        percentage: totalAmount > 0 ? (val.total / totalAmount) * 100 : 0,
      }))
      .sort((a, b) => {
        const indexA = EXPENSE_TAGS_ORDER.indexOf(a.tag);
        const indexB = EXPENSE_TAGS_ORDER.indexOf(b.tag);
        const orderA = indexA === -1 ? 999 : indexA;
        const orderB = indexB === -1 ? 999 : indexB;
        return orderA - orderB;
      });
  }, [filteredData, totalAmount, modified]);

  const monthlyTrend = useMemo(() => {
    const months = {};
    filteredData.forEach((r) => {
      if (!r.pay_date) return;
      const m = r.pay_date.substring(0, 7);
      if (!months[m]) months[m] = { month: m, total: 0, count: 0 };
      months[m].total += parseToNumber(r.amount);
      months[m].count += 1;
    });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredData]);

  const processedRecords = useMemo(() => {
    let result = [...filteredData];

    if (sortConfig.key) {
      result.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (sortConfig.key === "amount") {
          aValue = parseToNumber(aValue);
          bValue = parseToNumber(bValue);
        }

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [filteredData, sortConfig]);

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const applyTagToAllSameVendor = (vendor, newTag) => {
    if (!vendor || !newTag) return;
    setModified((prevModified) => {
      const nextModified = { ...prevModified };
      const targetVendor = vendor.trim();
      records.forEach((r) => {
        if (r.vendor && r.vendor.trim() === targetVendor) {
          nextModified[r.id] = newTag;
        }
      });
      return nextModified;
    });
  };

  const handleSaveAll = async () => {
    const updates = Object.entries(modified).map(([id, tag]) => ({
      id: parseInt(id),
      tag,
    }));
    if (updates.length === 0) return alert("수정사항이 없습니다.");
    await axios.post(`${API_URL}/update-tags`, updates);
    alert("모든 수정사항이 서버에 저장되었습니다.");
    loadData();
    setModified({});
  };

  const handleUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("target_year", filters.year);
    await axios.post(`${API_URL}/upload`, formData);
    loadData();
    setFile(null);
  };

  const syncToSheets = async () => {
    try {
      const res = await axios.post(`${API_URL}/api/sync-sheets`, {
        year: filters.year,
      });
      if (res.data.status === "success") {
        alert(
          `${res.data.sheet_name} 시트에 ${res.data.count}건이 동기화되었습니다.`,
        );
      } else {
        alert(`에러: ${res.data.message}`);
      }
    } catch (err) {
      alert("서버 통신 중 오류가 발생했습니다.");
    }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div
          style={{
            ...tooltipStyle,
            backgroundColor: theme.tooltipBg,
            color: theme.tooltipText,
          }}
        >
          <p style={{ margin: "0 0 4px 0", fontWeight: "bold" }}>
            {label || data.tag}
          </p>
          <p style={{ margin: 0 }}>합계: {data.total.toLocaleString()}원</p>
          <p style={{ margin: 0, opacity: 0.8 }}>건수: {data.count}건</p>
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
      {/* 상단바 */}
      <nav style={navBar}>
        <div style={brandSection}>
          <span style={{ fontSize: "28px" }}>💎</span>
          <h1 style={headlineMedium}>Tax Master v8.1</h1>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "20px",
          }}
        >
          <h1>종합소득세 신고 도우미</h1>
          {/* 📋 도움말 -> 사용법 전환 및 우측 신고도움말 컴포넌트 호출 버튼 배치 구역 */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={toggleHelp}
              style={{
                background: "none",
                border: `1px solid ${theme.primary}`,
                color: theme.primary,
                borderRadius: "20px",
                padding: "5px 15px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              ❓ 사용법
            </button>
            <button
              onClick={() => setShowReportHelp(true)}
              style={{
                background: theme.primary,
                border: `1px solid ${theme.primary}`,
                color: theme.onPrimary,
                borderRadius: "20px",
                padding: "5px 15px",
                cursor: "pointer",
                fontWeight: "bold",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              💡 신고도움말
            </button>
          </div>
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
        {/* 사이드바 */}
        <aside style={sideColumn}>
          <section
            style={{ ...md3Card, backgroundColor: theme.surfaceVariant }}
          >
            <h3 style={titleSmall}>📈 월별 지출 추이</h3>
            <div style={{ height: "160px", marginTop: "16px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke={theme.outline}
                    opacity={0.2}
                  />
                  <XAxis dataKey="month" hide />
                  <YAxis hide />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: theme.onSurface, opacity: 0.05 }}
                  />
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
              position: "relative",
            }}
          >
            <h3 style={titleSmall}>🥧 지출 비율</h3>
            <div style={{ marginTop: "16px" }}>
              {tagStats.map((item) => (
                <div
                  key={item.tag}
                  style={ratioContainer}
                  onMouseEnter={() => setHoverData(item)}
                  onMouseLeave={() => setHoverData(null)}
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
              {hoverData && (
                <div
                  style={{
                    position: "absolute",
                    top: "40px",
                    right: "24px",
                    zIndex: 10,
                  }}
                >
                  <CustomTooltip
                    active={true}
                    payload={[{ payload: hoverData }]}
                  />
                </div>
              )}
            </div>
          </section>

          {/* 📊 리팩토링 구역: 업로드 히스토리를 데이터 그리드 테이블로 전환 및 자동 집계 행 구현 */}
          <section
            style={{
              ...md3Card,
              backgroundColor: theme.surfaceVariant,
              marginTop: "24px",
              flex: 1,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h3 style={titleSmall}>📁 업로드 히스토리</h3>
            <div style={{ ...historyList }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "12px",
                  marginTop: "12px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: `1px solid ${theme.outline}`,
                      color: theme.onSurfaceVariant,
                    }}
                  >
                    <th
                      style={{
                        textAlign: "left",
                        padding: "6px 2px",
                        fontWeight: "600",
                      }}
                    >
                      파일명
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        padding: "6px 2px",
                        fontWeight: "600",
                        width: "50px",
                      }}
                    >
                      건수
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        padding: "6px 2px",
                        fontWeight: "600",
                        width: "80px",
                      }}
                    >
                      금액
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.documents.length === 0 ? (
                    <tr>
                      <td
                        colSpan="3"
                        style={{
                          textAlign: "center",
                          padding: "20px 0",
                          color: theme.outline,
                        }}
                      >
                        업로드된 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    stats.documents.map((d, i) => (
                      <tr
                        key={i}
                        style={{
                          borderBottom: `1px solid ${theme.outlineVariant}`,
                        }}
                      >
                        <td
                          style={{
                            padding: "8px 2px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: "120px",
                          }}
                          title={d.filename}
                        >
                          <div
                            style={{
                              fontSize: "10px",
                              opacity: 0.5,
                              marginBottom: "2px",
                            }}
                          >
                            {d.customer}
                          </div>
                          {d.filename}
                        </td>
                        <td style={{ textAlign: "right", padding: "8px 2px" }}>
                          {(d.count !== undefined
                            ? d.count
                            : 0
                          ).toLocaleString()}
                          건
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            padding: "8px 2px",
                            fontWeight: "600",
                          }}
                        >
                          {(d.total || 0).toLocaleString()}원
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {/* 📊 파일 전체 건수 합계 및 전체 금액 합계 하단 푸터 고정 산출 */}
                {stats.documents.length > 0 && (
                  <tfoot>
                    <tr
                      style={{
                        borderTop: `2px solid ${theme.outline}`,
                        fontWeight: "bold",
                        backgroundColor: "rgba(0,0,0,0.04)",
                      }}
                    >
                      <td style={{ padding: "10px 2px" }}>전체 합계</td>
                      <td style={{ textAlign: "right", padding: "10px 2px" }}>
                        {stats.documents
                          .reduce((sum, d) => sum + (Number(d.count) || 0), 0)
                          .toLocaleString()}
                        건
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          padding: "10px 2px",
                          color: theme.primary,
                        }}
                      >
                        {stats.documents
                          .reduce((sum, d) => sum + (Number(d.total) || 0), 0)
                          .toLocaleString()}
                        원
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>
        </aside>

        {/* 메인 콘텐츠 */}
        <div style={contentColumn}>
          {/* 5단 필터 레이아웃 */}
          <div
            style={{
              ...md3Card,
              backgroundColor: theme.surfaceVariant,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "16px",
            }}
          >
            <div style={inputGroup}>
              <label style={labelSmall}>기준연도</label>
              <select
                style={{
                  ...md3Select,
                  color: theme.onSurface,
                  borderColor: theme.outline,
                }}
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
              <label style={labelSmall}>성명(이용자)</label>
              <select
                style={{
                  ...md3Select,
                  color: theme.onSurface,
                  borderColor: theme.outline,
                }}
                value={filters.customer}
                onChange={(e) =>
                  setFilters({ ...filters, customer: e.target.value })
                }
              >
                {customerList.map((c) => (
                  <option key={c} value={c}>
                    {c === "All" ? "전체 성명" : c}
                  </option>
                ))}
              </select>
            </div>
            <div style={inputGroup}>
              <label style={labelSmall}>파일명</label>
              <select
                style={{
                  ...md3Select,
                  color: theme.onSurface,
                  borderColor: theme.outline,
                }}
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
            <div style={inputGroup}>
              <label style={labelSmall}>태그명</label>
              <select
                style={{
                  ...md3Select,
                  color: theme.onSurface,
                  borderColor: theme.outline,
                }}
                value={filters.tag}
                onChange={(e) =>
                  setFilters({ ...filters, tag: e.target.value })
                }
              >
                {tagList.map((t) => (
                  <option key={t} value={t}>
                    {t === "All" ? "전체 태그" : t}
                  </option>
                ))}
              </select>
            </div>
            <div style={inputGroup}>
              <label style={labelSmall}>가맹점 검색</label>
              <input
                style={{
                  ...md3Input,
                  color: theme.onSurface,
                  borderColor: theme.outline,
                }}
                placeholder="검색어..."
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* 금액 검색 조건 바 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginTop: "15px",
              marginBottom: "15px",
              padding: "10px 16px",
              backgroundColor: theme.surfaceVariant || "#f9f9f9",
              borderRadius: "12px",
            }}
          >
            <span style={{ fontSize: "0.9rem", fontWeight: "bold" }}>
              💰 금액 검색 :
            </span>
            <select
              value={filterOperator}
              onChange={(e) => setFilterOperator(e.target.value)}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid #ccc",
                background: "transparent",
                color: "inherit",
              }}
            >
              <option value="all">전체</option>
              <option value="gt">크다 (&gt;)</option>
              <option value="lt">작다 (&lt;)</option>
              <option value="eq">같다 (=)</option>
              <option value="gte">같거나 크다 (&gt;=)</option>
              <option value="lte">같거나 작다 (&lt;=)</option>
              <option value="ne">다르다 (!=)</option>
            </select>

            {filterOperator !== "all" && (
              <input
                type="number"
                placeholder="금액 입력"
                value={filterAmount}
                onChange={(e) => setFilterAmount(e.target.value)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "1px solid #ccc",
                  width: "150px",
                  background: "transparent",
                  color: "inherit",
                }}
              />
            )}
          </div>

          <div style={actionRow}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                style={{
                  ...tonalBtn,
                  backgroundColor: theme.primaryContainer,
                  color: theme.onPrimaryContainer,
                }}
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
                <button
                  style={{
                    ...filledBtn,
                    backgroundColor: theme.primary,
                    color: theme.onPrimary,
                  }}
                  onClick={handleUpload}
                >
                  업로드
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                style={{
                  ...outlineBtn,
                  borderColor: theme.outline,
                  color: theme.primary,
                }}
                onClick={() =>
                  axios
                    .post(`${API_URL}/export/excel`, filteredData, {
                      responseType: "blob",
                    })
                    .then((res) => {
                      const link = document.createElement("a");
                      link.href = URL.createObjectURL(new Blob([res.data]));
                      link.download = `Tax_${filters.year}.xlsx`;
                      link.click();
                    })
                }
              >
                Excel
              </button>
              <button
                style={{
                  ...outlineBtn,
                  borderColor: theme.outline,
                  color: theme.primary,
                }}
                onClick={() =>
                  axios
                    .post(
                      `${API_URL}/export/pdf`,
                      { totalAmount, records: filteredData },
                      { responseType: "blob" },
                    )
                    .then((res) => {
                      const link = document.createElement("a");
                      link.href = URL.createObjectURL(new Blob([res.data]));
                      link.download = `Report_${filters.year}.pdf`;
                      link.click();
                    })
                }
              >
                PDF
              </button>
              <button
                style={{
                  ...filledBtn,
                  backgroundColor: "#34a853",
                  color: "#fff",
                }}
                onClick={syncToSheets}
              >
                📊 시트 동기화
              </button>
              <button
                style={{
                  ...filledBtn,
                  backgroundColor: theme.primary,
                  color: theme.onPrimary,
                }}
                onClick={handleSaveAll}
              >
                일괄 저장
              </button>
            </div>
          </div>

          {/* 데이터 테이블 구역 */}
          <div
            style={{
              ...md3Card,
              padding: 0,
              overflow: "hidden",
              marginTop: "20px",
              border: `1px solid ${theme.outlineVariant}`,
            }}
          >
            <table style={md3Table}>
              <thead style={{ backgroundColor: theme.secondaryContainer }}>
                <tr>
                  <th
                    onClick={() => handleSort("pay_date")}
                    style={{
                      ...thStyle,
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    날짜{" "}
                    {sortConfig.key === "pay_date"
                      ? sortConfig.direction === "asc"
                        ? "▲"
                        : "▼"
                      : "↕"}
                  </th>
                  <th style={thStyle}>이용자</th>
                  <th
                    onClick={() => handleSort("vendor")}
                    style={{
                      ...thStyle,
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    가맹점{" "}
                    {sortConfig.key === "vendor"
                      ? sortConfig.direction === "asc"
                        ? "▲"
                        : "▼"
                      : "↕"}
                  </th>
                  <th
                    onClick={() => handleSort("amount")}
                    style={{
                      ...thStyle,
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    금액{" "}
                    {sortConfig.key === "amount"
                      ? sortConfig.direction === "asc"
                        ? "▲"
                        : "▼"
                      : "↕"}
                  </th>
                  <th style={thStyle}>태그 변환</th>
                </tr>
              </thead>
              <tbody>
                {processedRecords.map((r) => (
                  <tr
                    key={r.id}
                    style={{
                      borderBottom: `1px solid ${theme.outlineVariant}`,
                    }}
                  >
                    <td style={tdStyle}>{r.pay_date}</td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          ...badgeStyle,
                          backgroundColor: theme.surfaceVariant,
                        }}
                      >
                        {r.customer}
                      </span>
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
                      {parseToNumber(r.amount).toLocaleString()}원
                    </td>
                    <td style={tdStyle}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "4px",
                        }}
                      >
                        {(() => {
                          const currentTag =
                            modified[r.id] !== undefined
                              ? modified[r.id]
                              : r.tag;
                          return (
                            <>
                              <select
                                style={{
                                  ...miniSelect,
                                  color: theme.onSurface,
                                }}
                                value={currentTag || ""}
                                onChange={(e) =>
                                  setModified({
                                    ...modified,
                                    [r.id]: e.target.value,
                                  })
                                }
                              >
                                {Object.keys(EXPENSE_TAGS).map((t) => (
                                  <option key={t} value={t}>
                                    {EXPENSE_TAGS[t].icon} {t}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() =>
                                  applyTagToAllSameVendor(r.vendor, currentTag)
                                }
                                style={magicBtn}
                                title="이 가맹점의 모든 항목에 동일 태그 적용"
                              >
                                🪄
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* 도움말(사용법) 모달 컴포넌트 */}
      {showHelp && (
        <div style={modalOverlay} onClick={toggleHelp}>
          <div
            style={{
              ...modalContent,
              backgroundColor: theme.surface,
              color: theme.onSurface,
              borderColor: theme.outlineVariant,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, fontSize: "20px" }}>
              💡 Tax Master 사용 가이드
            </h2>
            <hr
              style={{
                borderColor: theme.outlineVariant,
                margin: "16px 0",
                borderStyle: "solid",
                borderWidth: "0.5px",
              }}
            />
            <ul
              style={{
                paddingLeft: "20px",
                lineHeight: "1.8",
                fontSize: "14px",
              }}
            >
              <li>
                <strong>상단 필터:</strong> 연도, 성명, 파일, 태그를 다중
                선택하여 데이터를 세부 교차 분류합니다.
              </li>
              <li>
                <strong>가맹점 검색:</strong> 텍스트를 입력하면 가맹점 이름
                기준으로 실시간 매칭 필터링됩니다.
              </li>
              <li>
                <strong>금액 검색:</strong> 조건식 부호(크다, 같다 등)를
                지정하고 우측 필드에 숫자를 입력해 필터를 작동시킵니다.
              </li>
              <li>
                <strong>태그 변환 (🪄):</strong> 마술봉 클릭 시 현재 행에 선택된
                태그를 <em>동일한 가맹점 명칭을 가진 전체 내역</em>에 일괄
                할당합니다. 변경 후 우측 상단의 <strong>[일괄 저장]</strong>을
                눌러야 반영됩니다.
              </li>
            </ul>
            <div style={{ textAlign: "right", marginTop: "24px" }}>
              <button
                style={{
                  ...filledBtn,
                  backgroundColor: theme.primary,
                  color: theme.onPrimary,
                }}
                onClick={toggleHelp}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🤝 신규 배치: 신고도움말 외부 파일 링크 모달 렌더링 */}
      <HelpModal
        show={showReportHelp}
        onClose={() => setShowReportHelp(false)}
        theme={theme}
      />
    </div>
  );
}

// --- MD3 Style Objects ---
const headlineMedium = {
  fontSize: "22px",
  fontWeight: 600,
  margin: 0,
  letterSpacing: "-0.5px",
};
const titleSmall = {
  fontSize: "14px",
  fontWeight: 700,
  margin: 0,
  opacity: 0.9,
};
const bodySmall = { fontSize: "12px", opacity: 0.7 };
const labelMedium = {
  fontSize: "12px",
  fontWeight: 600,
  display: "inline-flex", // 📐 이모지와 텍스트를 한 라인으로 묶음
  alignItems: "center", // 📐 이모지 상단 잘림 방지
  gap: "6px", // 아이콘과 글자 사이 간격 확보
};
const labelSmall = {
  fontSize: "11px",
  fontWeight: 700,
  marginBottom: "6px",
  display: "block",
  opacity: 0.6,
};
const appContainer = { minHeight: "100vh", transition: "background 0.3s" };
const navBar = {
  height: "72px",
  padding: "0 32px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};
const brandSection = { display: "flex", alignItems: "center", gap: "12px" };
const themeToggle = {
  display: "flex",
  borderRadius: "100px",
  border: "1px solid rgba(128,128,128,0.3)",
  overflow: "hidden",
};
const toggleBtn = {
  border: "none",
  padding: "6px 14px",
  fontSize: "10px",
  cursor: "pointer",
  fontWeight: "bold",
};
const mainGrid = {
  display: "grid",
  gridTemplateColumns: "320px 1fr",
  gap: "24px",
  padding: "0 32px 40px 32px",
};
const sideColumn = { display: "flex", flexDirection: "column" };
const contentColumn = { display: "flex", flexDirection: "column" };
const md3Card = { padding: "24px", borderRadius: "28px" };
const ratioContainer = { marginBottom: "16px", cursor: "pointer" };
const ratioHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center", // 📐 위아래 정렬 수평 맞춤
  marginBottom: "6px",
};
const progressBg = {
  height: "10px",
  width: "100%",
  backgroundColor: "rgba(128,128,128,0.1)",
  borderRadius: "100px",
  overflow: "hidden",
};
const progressFill = { height: "100%", transition: "width 0.8s ease" };
const historyList = { marginTop: "16px" };
const inputGroup = { display: "flex", flexDirection: "column" };
const md3Select = {
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid",
  background: "transparent",
  fontSize: "13px",
};
const md3Input = {
  padding: "12px 16px",
  borderRadius: "12px",
  border: "1px solid",
  background: "transparent",
  fontSize: "13px",
  width: "calc(100% - 32px)",
};
const actionRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: "24px",
};
const filledBtn = {
  padding: "12px 24px",
  borderRadius: "100px",
  border: "none",
  fontWeight: "bold",
  cursor: "pointer",
};
const tonalBtn = {
  padding: "12px 24px",
  borderRadius: "100px",
  border: "none",
  fontWeight: "bold",
  cursor: "pointer",
};
const outlineBtn = {
  padding: "12px 24px",
  borderRadius: "100px",
  border: "1px solid",
  backgroundColor: "transparent",
  cursor: "pointer",
  fontWeight: "bold",
};
const thStyle = { padding: "16px 12px", fontSize: "13px", fontWeight: "600" };
const tdStyle = { padding: "14px 12px", fontSize: "13px" };
const badgeStyle = {
  padding: "4px 8px",
  borderRadius: "8px",
  fontSize: "12px",
};
const miniSelect = {
  padding: "6px 10px",
  borderRadius: "8px",
  border: "1px solid #ccc",
  background: "transparent",
  fontSize: "12px",
};
const magicBtn = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: "14px",
};
const tooltipStyle = {
  padding: "8px 12px",
  borderRadius: "8px",
  fontSize: "12px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
};
const md3Table = { width: "100%", borderCollapse: "collapse" };

const modalOverlay = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.4)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
};
const modalContent = {
  padding: "32px",
  borderRadius: "28px",
  border: "1px solid",
  maxWidth: "480px",
  width: "90%",
  boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
};

export default App;
