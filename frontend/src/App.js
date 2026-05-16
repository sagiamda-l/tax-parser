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
    tooltipBg: "#313033", // 불투명 배경
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
    tooltipBg: "#e6e1e5", // 불투명 배경
    tooltipText: "#313033",
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
  불필요: { color: "#868e96", icon: "❌" },
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
  const [hoverData, setHoverData] = useState(null); // 지출 비율 툴팁용
  const fileInputRef = useRef(null);

  // 테마 시스템
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

  // 필터 및 통계 로직
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

  const filteredData = useMemo(
    () =>
      records.filter(
        (r) =>
          (filters.customer === "All" || r.customer === filters.customer) &&
          (filters.filename === "All" || r.filename === filters.filename) &&
          (filters.tag === "All" ||
            (modified[r.id] || r.tag) === filters.tag) &&
          r.vendor.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [records, filters, searchTerm, modified],
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

  // --- 핵심 기능: 일괄 태그 변환 ---
  const applyTagToAllSameVendor = (vendor, newTag) => {
    if (!vendor || !newTag) return;

    // 함수형 업데이트(prevModified)를 사용하면 항상 가장 최신의 상태를 보장받습니다.
    setModified((prevModified) => {
      const nextModified = { ...prevModified };
      const targetVendor = vendor.trim();

      records.forEach((r) => {
        // 가맹점명 앞뒤 공백을 제거하고 비교하여 매칭 정확도를 높입니다.
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

  // 커스텀 툴팁 컴포넌트 (불투명 배경)
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

  // --- App.js 내부에 추가할 핸들러 ---
  const syncToSheets = async () => {
    try {
      // 현재 UI에서 선택된 연도(filters.year)를 전송
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

  const [showHelp, setShowHelp] = useState(false);

  // 도움말 열기/닫기 함수
  const toggleHelp = () => setShowHelp(!showHelp);

  // 1. 상태 추가
  const [filterOperator, setFilterOperator] = useState("all"); // 전체, gt, lt, eq, gte, lte, ne
  const [filterAmount, setFilterAmount] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "pay_date",
    direction: "asc",
  }); // 기본값: 날짜 오름차순

  // 2. 정렬 변경 함수
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // 3. [핵심] 필터링 + 정렬이 적용된 최종 리스트 계산
  const processedRecords = useMemo(() => {
    // 3-1. 금액 필터링 적용
    let result = records.filter((r) => {
      if (filterOperator === "all" || !filterAmount) return true;

      const recordAmt = Number(r.amount) || 0;
      const targetAmt = Number(filterAmount) || 0;

      switch (filterOperator) {
        case "gt":
          return recordAmt > targetAmt; // 크다
        case "lt":
          return recordAmt < targetAmt; // 작다
        case "eq":
          return recordAmt === targetAmt; // 같다
        case "gte":
          return recordAmt >= targetAmt; // 같거나 크다
        case "lte":
          return recordAmt <= targetAmt; // 같거나 작다
        case "ne":
          return recordAmt !== targetAmt; // 다르다
        default:
          return true;
      }
    });

    // 3-2. 정렬 적용
    if (sortConfig.key) {
      result.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // 금액 정렬일 경우 숫자로 변환하여 비교
        if (sortConfig.key === "amount") {
          aValue = Number(aValue) || 0;
          bValue = Number(bValue) || 0;
        }

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [records, filterOperator, filterAmount, sortConfig]);

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
        // 상단 버튼 예시
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h1>종합소득세 신고 도우미</h1>
          <div>
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
              ❓ 도움말
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
                <div
                  key={i}
                  style={{
                    ...historyItem,
                    borderBottom: `1px solid ${theme.outlineVariant}`,
                  }}
                >
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
                        maxWidth: "140px",
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "15px",
              padding: "10px",
              backgroundColor: theme.surfaceVariant || "#f9f9f9",
              borderRadius: "12px",
            }}
          >
            <span style={{ fontSize: "0.9rem", fontWeight: "bold" }}>
              💰 금액 검색 :
            </span>

            {/* 조건 선택 Dropdown */}
            <select
              value={filterOperator}
              onChange={(e) => setFilterOperator(e.target.value)}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid #ccc",
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

            {/* 금액 입력란 ('전체'가 아닐 때만 노출) */}
            {filterOperator !== "all" && (
              <input
                type="number"
                placeholder="금액을 입력하세요"
                value={filterAmount}
                onChange={(e) => setFilterAmount(e.target.value)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "1px solid #ccc",
                  width: "150px",
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
                style={{ ...outlineBtn, borderColor: theme.outline }}
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
                style={{ ...outlineBtn, borderColor: theme.outline }}
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
                }} // 구글 녹색 테마
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
                  {/* 날짜 헤더 */}
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
                  {/* 가맹점 헤더 */}
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
                  {/* 금액 헤더 */}
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
                {filteredData.map((r) => (
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
                      {r.amount.toLocaleString()}원
                    </td>
                    <td style={tdStyle}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justify: "center",
                          gap: "4px",
                        }}
                      >
                        {/* 현재 행의 최종 태그 값을 명시적으로 정의 (선택 우선 -> 원본 백업) */}
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
const labelMedium = { fontSize: "12px", fontWeight: 600 };
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
const historyList = {
  marginTop: "16px",
  maxHeight: "250px",
  overflowY: "auto",
};
const historyItem = { padding: "12px 0" };
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
  background: "transparent",
  color: "inherit",
  fontWeight: "bold",
  cursor: "pointer",
};
const md3Table = { width: "100%", borderCollapse: "collapse" };
const thStyle = {
  padding: "14px",
  fontSize: "12px",
  textAlign: "center",
  fontWeight: "bold",
};
const tdStyle = { padding: "14px", fontSize: "13px", textAlign: "center" };
const badgeStyle = {
  padding: "4px 10px",
  borderRadius: "8px",
  fontSize: "11px",
};
const miniSelect = {
  border: "none",
  background: "transparent",
  fontSize: "13px",
  cursor: "pointer",
};
const magicBtn = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: "16px",
  padding: "0 4px",
  transition: "transform 0.2s",
};
const tooltipStyle = {
  padding: "12px",
  borderRadius: "16px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
  fontSize: "12px",
  zIndex: 100,
};

const modalOverlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.6)",
  backdropFilter: "blur(4px)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 2000,
};

const modalContentStyle = {
  width: "90%",
  maxWidth: "650px",
  maxHeight: "85vh",
  borderRadius: "24px",
  padding: "24px",
  display: "flex",
  flexDirection: "column",
  boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
};

const modalHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "20px",
  borderBottom: "1px solid rgba(0,0,0,0.1)",
  paddingBottom: "12px",
};

const modalBodyStyle = {
  overflowY: "auto",
  paddingRight: "8px",
};

const sectionStyle = {
  marginBottom: "24px",
  borderBottom: "1px solid rgba(0,0,0,0.05)",
  paddingBottom: "16px",
};

const ulStyle = {
  paddingLeft: "20px",
  lineHeight: "1.8",
};

const expenseBoxStyle = (theme) => ({
  backgroundColor: theme.surfaceVariant || "#f5f5f5",
  padding: "16px",
  borderRadius: "16px",
  fontSize: "0.95rem",
});

const itemStyle = {
  marginBottom: "8px",
};

const closeBtnStyle = {
  background: "none",
  border: "none",
  fontSize: "1.5rem",
  cursor: "pointer",
  color: "#999",
};

const actionBtnStyle = {
  padding: "12px 24px",
  borderRadius: "12px",
  border: "none",
  fontWeight: "bold",
  cursor: "pointer",
  width: "100%",
};

const modalFooterStyle = {
  marginTop: "20px",
};

export default App;
