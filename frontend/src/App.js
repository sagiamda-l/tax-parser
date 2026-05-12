import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";

const API_URL = "http://192.168.0.241:3001";

// 태그 설정 (아이콘 포함)
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
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({ documents: [], tags: [] });
  const [modified, setModified] = useState({}); // { id: 'new_tag' }
  const [file, setFile] = useState(null);
  const [filters, setFilters] = useState({
    year: new Date().getFullYear(),
    customer: "All",
    filename: "All",
  });
  const [searchTerm, setSearchTerm] = useState("");

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
    setModified({}); // 로드 시 수정사항 초기화
  };

  // 필터 목록 계산
  const customerList = useMemo(
    () => ["All", ...new Set(records.map((r) => r.customer))].filter(Boolean),
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

  // 필터링 로직
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

  // 작업 함수
  const onUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("target_year", filters.year);
    await axios.post(`${API_URL}/upload`, formData);
    loadData();
  };

  const onSaveAll = async () => {
    const updates = Object.entries(modified).map(([id, tag]) => ({
      id: parseInt(id),
      tag,
    }));
    if (updates.length === 0) return;
    await axios.post(`${API_URL}/update-tags`, updates);
    alert("변경사항이 저장되었습니다.");
    loadData();
  };

  const onBulkVendorUpdate = async (vendor, tag) => {
    if (!window.confirm(`모든 [${vendor}] 항목을 [${tag}]으(로) 변경할까요?`))
      return;
    await axios.post(`${API_URL}/bulk-vendor-update`, { vendor, tag });
    loadData();
  };

  return (
    <div
      style={{
        padding: "25px",
        backgroundColor: "#f5f7fb",
        minHeight: "100vh",
        fontFamily: "Pretendard",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "25px",
        }}
      >
        <h2 style={{ margin: 0 }}>💎 세무 결산 마스터 v4.0</h2>
        <div
          style={{
            backgroundColor: "#2c3e50",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: "10px",
          }}
        >
          필터 합계: <strong>{totalAmount.toLocaleString()}원</strong> (
          {filteredData.length}건)
        </div>
      </header>

      {/* 요약 카드 그리드 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "20px",
          marginBottom: "25px",
        }}
      >
        <div style={cardStyle}>
          <h4>📅 업로드 히스토리</h4>
          <div style={{ maxHeight: "150px", overflowY: "auto" }}>
            {stats.documents.map((d, i) => (
              <div key={i} style={statItemStyle}>
                <span>{d.customer}</span>
                <small style={{ color: "#888" }}>
                  {d.filename.substring(0, 15)}...
                </small>
              </div>
            ))}
          </div>
        </div>
        <div style={cardStyle}>
          <h4>📑 문서별 검증</h4>
          {stats.documents.map((d) => (
            <div key={d.filename} style={statItemStyle}>
              <span>{d.filename}</span>
              <strong>{d.total.toLocaleString()}원</strong>
            </div>
          ))}
        </div>
        <div style={cardStyle}>
          <h4>📊 지출 비율</h4>
          {stats.tags.map((t) => (
            <div key={t.tag} style={{ marginBottom: "8px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "12px",
                }}
              >
                <span>{t.tag}</span>
                <span>{Math.round((t.total / totalAmount) * 100)}%</span>
              </div>
              <div
                style={{
                  height: "6px",
                  background: "#eee",
                  borderRadius: "3px",
                }}
              >
                <div
                  style={{
                    width: `${(t.total / totalAmount) * 100}%`,
                    height: "100%",
                    background: EXPENSE_TAGS[t.tag]?.color,
                    borderRadius: "3px",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 컨트롤 바 */}
      <div
        style={{
          ...cardStyle,
          display: "flex",
          flexWrap: "wrap",
          gap: "15px",
          alignItems: "center",
          marginBottom: "25px",
        }}
      >
        <strong>연도:</strong>
        <select
          value={filters.year}
          onChange={(e) => setFilters({ ...filters, year: e.target.value })}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </select>
        <strong>이용자:</strong>
        <select
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
              {c === "All" ? "전체" : c}
            </option>
          ))}
        </select>
        <strong>파일명:</strong>
        <select
          value={filters.filename}
          onChange={(e) => setFilters({ ...filters, filename: e.target.value })}
        >
          {filenameList.map((f) => (
            <option key={f} value={f}>
              {f === "All" ? "전체 파일" : f}
            </option>
          ))}
        </select>
        <strong>검색:</strong>
        <input
          type="text"
          placeholder="가맹점명..."
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ padding: "5px" }}
        />

        <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
          <input type="file" onChange={(e) => setFile(e.target.files[0])} />
          <button onClick={onUpload} style={btnStyle}>
            파싱 업로드
          </button>
          <button
            onClick={onSaveAll}
            style={{ ...btnStyle, backgroundColor: "#228be6" }}
          >
            변경사항 일괄저장
          </button>
        </div>
      </div>

      {/* 데이터 그리드 */}
      <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead
            style={{
              backgroundColor: "#f8f9fa",
              borderBottom: "2px solid #dee2e6",
            }}
          >
            <tr>
              <th style={thStyle}>날짜</th>
              <th style={thStyle}>이용자</th>
              <th style={thStyle}>가맹점명</th>
              <th style={thStyle}>금액</th>
              <th style={thStyle}>태그 분류</th>
              <th style={thStyle}>기능</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={tdStyle}>{r.pay_date}</td>
                <td style={tdStyle}>{r.customer}</td>
                <td
                  style={{ ...tdStyle, textAlign: "left", fontWeight: "bold" }}
                >
                  {r.vendor}
                </td>
                <td
                  style={{ ...tdStyle, textAlign: "right", color: "#e74c3c" }}
                >
                  {r.amount.toLocaleString()}원
                </td>
                <td style={tdStyle}>
                  <select
                    style={{ padding: "4px", borderRadius: "4px" }}
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
                    style={{ fontSize: "11px", padding: "2px 5px" }}
                  >
                    가맹점일괄적용
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

const cardStyle = {
  backgroundColor: "#fff",
  padding: "20px",
  borderRadius: "12px",
  boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
};
const statItemStyle = {
  display: "flex",
  justifyContent: "space-between",
  padding: "8px 0",
  borderBottom: "1px solid #f8f9fa",
  fontSize: "13px",
};
const thStyle = { padding: "12px", fontSize: "13px", color: "#666" };
const tdStyle = { padding: "12px", textAlign: "center", fontSize: "14px" };
const btnStyle = {
  padding: "8px 15px",
  border: "none",
  borderRadius: "6px",
  color: "#fff",
  backgroundColor: "#495057",
  cursor: "pointer",
};

export default App;
