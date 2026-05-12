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
  Cell,
} from "recharts";

const API_URL = "http://192.168.0.241:3001";

// 지출 분류 정의
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
  // --- 상태 관리 ---
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({ documents: [], tags: [] });
  const [modified, setModified] = useState({}); // { id: 'new_tag' }
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    year: new Date().getFullYear(),
    customer: "All",
    filename: "All",
  });
  const [searchTerm, setSearchTerm] = useState("");

  // --- 데이터 로드 ---
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
      console.error("데이터 로드 실패", err);
    } finally {
      setLoading(false);
    }
  };

  // --- 필터 및 데이터 가공 (useMemo) ---
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

  const yearOptions = useMemo(() => {
    const years = stats.documents.map((d) => d.target_year).filter(Boolean);
    const curr = new Date().getFullYear();
    const start = years.length ? Math.min(...years, curr) - 3 : curr - 3;
    const end = years.length ? Math.max(...years, curr) + 3 : curr + 3;
    return Array.from({ length: end - start + 1 }, (_, i) => start + i).sort(
      (a, b) => b - a,
    );
  }, [stats.documents]);

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

  // [수정] 지출 비율 계산 (현재 필터링된 데이터 기준 분모 설정)
  const tagStats = useMemo(() => {
    const counts = {};
    filteredData.forEach((r) => {
      const tag = modified[r.id] || r.tag;
      counts[tag] = (counts[tag] || 0) + r.amount;
    });
    return Object.entries(counts)
      .map(([tag, total]) => ({
        tag,
        total,
        percentage: totalAmount > 0 ? (total / totalAmount) * 100 : 0,
        count: filteredData.filter((f) => (modified[f.id] || f.tag) === tag)
          .length,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredData, totalAmount, modified]);

  // [신규] 월별 지출 추이 데이터
  const monthlyTrend = useMemo(() => {
    const months = {};
    filteredData.forEach((r) => {
      const m = r.pay_date.substring(0, 7);
      if (!months[m]) months[m] = { month: m };
      const tag = modified[r.id] || r.tag;
      months[m][tag] = (months[m][tag] || 0) + r.amount;
    });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredData, modified]);

  // --- 주요 기능 로직 ---
  const onUpload = async () => {
    if (!file) return alert("파일을 선택해주세요.");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("target_year", filters.year);
    try {
      setLoading(true);
      await axios.post(`${API_URL}/upload`, formData);
      alert("업로드 완료!");
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || "업로드 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const onSaveAll = async () => {
    const updates = Object.entries(modified).map(([id, tag]) => ({
      id: parseInt(id),
      tag,
    }));
    if (updates.length === 0) return alert("변경사항이 없습니다.");
    await axios.post(`${API_URL}/update-tags`, updates);
    alert("모든 변경사항이 저장되었습니다.");
    loadData();
  };

  const onBulkVendorUpdate = async (vendor, tag) => {
    if (
      !window.confirm(`[${vendor}]의 모든 항목을 [${tag}]로 변경하시겠습니까?`)
    )
      return;
    await axios.post(`${API_URL}/bulk-vendor-update`, { vendor, tag });
    loadData();
  };

  const exportExcel = async () => {
    const res = await axios.post(`${API_URL}/export/excel`, filteredData, {
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `세무결산_${filters.year}_${filters.customer}.xlsx`,
    );
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div style={containerStyle}>
      {/* 헤더 섹션 */}
      <header style={headerStyle}>
        <div>
          <h1 style={{ margin: 0, fontSize: "24px", color: "#1a1a1a" }}>
            💎 세무 결산 마스터 v5.0
          </h1>
          <p style={{ color: "#666", margin: "5px 0 0 0" }}>
            데이터 분석 및 자동 분류 시스템
          </p>
        </div>
        <div style={summaryBadgeStyle}>
          필터 결과: {totalAmount.toLocaleString()}원 / {filteredData.length}건
        </div>
      </header>

      {/* 요약 대시보드 카드 */}
      <div style={dashboardGridStyle}>
        <div style={cardStyle}>
          <h4 style={cardTitleStyle}>📈 월별 지출 추이</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" fontSize={10} />
              <YAxis hide />
              <Tooltip formatter={(v) => v.toLocaleString() + "원"} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: "10px" }} />
              {Object.keys(EXPENSE_TAGS).map((tag) => (
                <Bar
                  key={tag}
                  dataKey={tag}
                  stackId="a"
                  fill={EXPENSE_TAGS[tag].color}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={cardStyle}>
          <h4 style={cardTitleStyle}>🥧 지출 비율</h4>
          <div style={{ maxHeight: "200px", overflowY: "auto" }}>
            {tagStats.map((item) => (
              <div
                key={item.tag}
                style={{ marginBottom: "12px" }}
                title={`${item.count}건 / ${item.total.toLocaleString()}원`}
              >
                <div style={tagLabelRow}>
                  <span>
                    {EXPENSE_TAGS[item.tag]?.icon} {item.tag}
                  </span>
                  <span style={{ fontWeight: "bold" }}>
                    {item.percentage.toFixed(1)}%
                  </span>
                </div>
                <div style={progressBg}>
                  <div
                    style={{
                      ...progressFill,
                      width: `${item.percentage}%`,
                      backgroundColor: EXPENSE_TAGS[item.tag]?.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={cardStyle}>
          <h4 style={cardTitleStyle}>📁 업로드 히스토리 / 문서 검증</h4>
          <div style={{ maxHeight: "200px", overflowY: "auto" }}>
            {stats.documents.map((d, i) => (
              <div key={i} style={docItemStyle}>
                <div style={{ fontSize: "12px", fontWeight: "bold" }}>
                  {d.customer}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "11px",
                    color: "#666",
                  }}
                >
                  <span>{d.filename}</span>
                  <strong>{d.total.toLocaleString()}원</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 컨트롤 및 필터 바 */}
      <div style={filterBarStyle}>
        <div style={filterGroup}>
          <span style={labelStyle}>📅 연도:</span>
          <select
            style={selectStyle}
            value={filters.year}
            onChange={(e) => setFilters({ ...filters, year: e.target.value })}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </div>
        <div style={filterGroup}>
          <span style={labelStyle}>👤 이용자:</span>
          <select
            style={selectStyle}
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
        <div style={filterGroup}>
          <span style={labelStyle}>📄 파일명:</span>
          <select
            style={selectStyle}
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
        <div style={filterGroup}>
          <span style={labelStyle}>🔍 검색:</span>
          <input
            style={inputStyle}
            type="text"
            placeholder="가맹점명 입력..."
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files[0])}
            style={{ fontSize: "12px" }}
          />
          <button onClick={onUpload} style={btnStyle} disabled={loading}>
            업로드
          </button>
          <button
            onClick={onSaveAll}
            style={{ ...btnStyle, backgroundColor: "#228be6" }}
          >
            일괄저장
          </button>
          <button
            onClick={exportExcel}
            style={{ ...btnStyle, backgroundColor: "#40c057" }}
          >
            Excel
          </button>
        </div>
      </div>

      {/* 데이터 상세 그리드 */}
      <div style={tableWrapperStyle}>
        <table style={tableStyle}>
          <thead>
            <tr style={theadStyle}>
              <th style={thStyle}>날짜</th>
              <th style={thStyle}>이용자</th>
              <th style={thStyle}>가맹점명</th>
              <th style={thStyle}>금액</th>
              <th style={thStyle}>태그 분류</th>
              <th style={thStyle}>관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((r) => (
              <tr key={r.id} style={trStyle}>
                <td style={tdStyle}>{r.pay_date}</td>
                <td style={tdStyle}>
                  <span style={userBadge}>{r.customer}</span>
                </td>
                <td
                  style={{ ...tdStyle, textAlign: "left", fontWeight: "500" }}
                >
                  {r.vendor}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    textAlign: "right",
                    fontWeight: "bold",
                    color: "#e03131",
                  }}
                >
                  {r.amount.toLocaleString()}원
                </td>
                <td style={tdStyle}>
                  <select
                    style={tagSelectStyle}
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
                <td style={tdStyle}>
                  <button
                    onClick={() =>
                      onBulkVendorUpdate(r.vendor, modified[r.id] || r.tag)
                    }
                    style={miniBtnStyle}
                  >
                    가맹점 일괄적용
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- 스타일 정의 (Professional UI) ---
const containerStyle = {
  padding: "30px",
  backgroundColor: "#f8f9fa",
  minHeight: "100vh",
  fontFamily: "'Pretendard', sans-serif",
};
const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "30px",
};
const summaryBadgeStyle = {
  backgroundColor: "#1a1c23",
  color: "#fff",
  padding: "12px 24px",
  borderRadius: "12px",
  fontWeight: "bold",
  fontSize: "15px",
  boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
};
const dashboardGridStyle = {
  display: "grid",
  gridTemplateColumns: "1.5fr 1fr 1fr",
  gap: "20px",
  marginBottom: "30px",
};
const cardStyle = {
  backgroundColor: "#fff",
  padding: "20px",
  borderRadius: "16px",
  boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
  border: "1px solid #eee",
};
const cardTitleStyle = {
  margin: "0 0 15px 0",
  fontSize: "14px",
  color: "#444",
  borderLeft: "4px solid #339af0",
  paddingLeft: "10px",
};
const filterBarStyle = {
  backgroundColor: "#fff",
  padding: "15px 20px",
  borderRadius: "16px",
  display: "flex",
  flexWrap: "wrap",
  gap: "20px",
  alignItems: "center",
  marginBottom: "20px",
  boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
};
const filterGroup = { display: "flex", alignItems: "center", gap: "8px" };
const labelStyle = { fontSize: "13px", fontWeight: "bold", color: "#666" };
const selectStyle = {
  padding: "6px 10px",
  borderRadius: "8px",
  border: "1px solid #ddd",
  fontSize: "13px",
};
const inputStyle = {
  padding: "6px 10px",
  borderRadius: "8px",
  border: "1px solid #ddd",
  fontSize: "13px",
};
const btnStyle = {
  padding: "8px 16px",
  borderRadius: "8px",
  border: "none",
  color: "#fff",
  backgroundColor: "#343a40",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: "bold",
};
const tableWrapperStyle = {
  backgroundColor: "#fff",
  borderRadius: "16px",
  overflow: "hidden",
  boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
};
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const theadStyle = {
  backgroundColor: "#f1f3f5",
  borderBottom: "2px solid #dee2e6",
};
const thStyle = {
  padding: "15px",
  fontSize: "12px",
  color: "#495057",
  fontWeight: "bold",
  textAlign: "center",
};
const trStyle = {
  borderBottom: "1px solid #f1f3f5",
  transition: "background 0.2s",
};
const tdStyle = {
  padding: "12px 15px",
  fontSize: "13px",
  color: "#343a40",
  textAlign: "center",
};
const userBadge = {
  backgroundColor: "#e7f5ff",
  color: "#1971c2",
  padding: "4px 8px",
  borderRadius: "6px",
  fontSize: "11px",
  fontWeight: "bold",
};
const tagSelectStyle = {
  padding: "5px",
  borderRadius: "6px",
  border: "1px solid #eee",
  fontSize: "12px",
};
const miniBtnStyle = {
  padding: "4px 8px",
  fontSize: "11px",
  backgroundColor: "#f1f3f5",
  border: "1px solid #dee2e6",
  borderRadius: "4px",
  cursor: "pointer",
};
const tagLabelRow = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: "12px",
  marginBottom: "5px",
};
const progressBg = {
  width: "100%",
  height: "6px",
  backgroundColor: "#f1f3f5",
  borderRadius: "3px",
};
const progressFill = {
  height: "100%",
  borderRadius: "3px",
  transition: "width 0.5s ease-in-out",
};
const docItemStyle = { padding: "10px 0", borderBottom: "1px solid #f8f9fa" };

export default App;
