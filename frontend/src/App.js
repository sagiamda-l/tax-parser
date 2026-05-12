import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";

const API_URL = "http://192.168.0.241:3001";
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
  const [file, setFile] = useState(null);
  const [modified, setModified] = useState({});
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
  };

  // 이용자 및 연도 목록 자동 생성
  const customerList = useMemo(
    () => ["All", ...new Set(records.map((r) => r.customer))].filter(Boolean),
    [records],
  );
  const yearList = useMemo(() => {
    const years = stats.documents.map((d) => d.target_year).filter(Boolean);
    const curr = new Date().getFullYear();
    const start = years.length ? Math.min(...years, curr) - 3 : curr - 3;
    const end = years.length ? Math.max(...years, curr) + 3 : curr + 3;
    return Array.from({ length: end - start + 1 }, (_, i) => start + i).sort(
      (a, b) => b - a,
    );
  }, [stats.documents]);

  // 필터링 데이터
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

  // --- 기존 편집 기능 유지 ---
  const onUpload = async () => {
    /* 업로드 로직 동일 */
  };
  const onSaveTags = async () => {
    /* 일괄 저장 로직 동일 */
  };
  const onBulkVendorUpdate = async (vendor, tag) => {
    /* 가맹점 일괄 변경 로직 동일 */
  };

  return (
    <div
      style={{
        fontFamily: "Pretendard, sans-serif",
        padding: "20px",
        backgroundColor: "#f8f9fa",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <h2>💎 세무 통합 관리 시스템</h2>
        <div style={{ fontSize: "20px", fontWeight: "bold", color: "#2c3e50" }}>
          선택 합계: {totalAmount.toLocaleString()}원 ({filteredData.length}건)
        </div>
      </header>

      {/* 1. 통계 요약 영역 (기존 기능 복구) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          marginBottom: "20px",
        }}
      >
        {/* 문서별 검증 카드 */}
        <div style={cardStyle}>
          <h4>📄 문서별 검증 (건수/금액)</h4>
          <div style={{ maxHeight: "180px", overflowY: "auto" }}>
            {stats.documents.map((d) => (
              <div key={d.filename} style={statLineStyle}>
                <span>
                  {d.customer} | {d.filename}
                </span>
                <strong>
                  {d.count}건 / {d.total.toLocaleString()}원
                </strong>
              </div>
            ))}
          </div>
        </div>

        {/* 항목별 지출 비율 카드 */}
        <div style={cardStyle}>
          <h4>📊 항목별 지출 비율</h4>
          {stats.tags.map((t) => (
            <div key={t.tag} style={{ marginBottom: "10px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "12px",
                }}
              >
                <span>{t.tag}</span>
                <span>{t.total.toLocaleString()}원</span>
              </div>
              <div
                style={{
                  width: "100%",
                  height: "8px",
                  background: "#eee",
                  borderRadius: "4px",
                }}
              >
                <div
                  style={{
                    width: `${(t.total / (stats.tags.reduce((a, b) => a + b.total, 0) || 1)) * 100}%`,
                    height: "100%",
                    background: EXPENSE_TAGS[t.tag]?.color,
                    borderRadius: "4px",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. 필터 및 컨트롤 영역 */}
      <div
        style={{
          ...cardStyle,
          display: "flex",
          gap: "15px",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <strong>📅 연도:</strong>
        <select
          value={filters.year}
          onChange={(e) => setFilters({ ...filters, year: e.target.value })}
        >
          {yearList.map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </select>

        <strong>👤 이용자:</strong>
        <select
          value={filters.customer}
          onChange={(e) => setFilters({ ...filters, customer: e.target.value })}
        >
          {customerList.map((c) => (
            <option key={c} value={c}>
              {c === "All" ? "전체" : c}
            </option>
          ))}
        </select>

        <strong>🔍 검색:</strong>
        <input
          type="text"
          placeholder="가맹점명..."
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <input
          type="file"
          onChange={(e) => setFile(e.target.files[0])}
          style={{ marginLeft: "auto" }}
        />
        <button onClick={onUpload} style={btnStyle}>
          파싱 업로드
        </button>
        <button
          onClick={onSaveTags}
          style={{ ...btnStyle, backgroundColor: "#228be6" }}
        >
          변경사항 저장
        </button>
      </div>

      {/* 3. 데이터 테이블 */}
      <div style={{ ...cardStyle, padding: "0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f1f3f5" }}>
            <tr>
              <th style={thStyle}>날짜</th>
              <th style={thStyle}>이용자</th>
              <th style={thStyle}>가맹점명</th>
              <th style={thStyle}>금액</th>
              <th style={thStyle}>태그 분류</th>
              <th style={thStyle}>작업</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={tdStyle}>{r.pay_date}</td>
                <td style={tdStyle}>{r.customer}</td>
                <td style={{ ...tdStyle, textAlign: "left" }}>{r.vendor}</td>
                <td
                  style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}
                >
                  {r.amount.toLocaleString()}원
                </td>
                <td style={tdStyle}>
                  <select
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
                    style={{ fontSize: "11px" }}
                  >
                    일괄적용
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
  borderRadius: "10px",
  boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
};
const statLineStyle = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: "13px",
  padding: "8px 0",
  borderBottom: "1px solid #f8f9fa",
};
const thStyle = { padding: "12px", fontSize: "13px", color: "#868e96" };
const tdStyle = { padding: "12px", textAlign: "center", fontSize: "14px" };
const btnStyle = {
  padding: "8px 15px",
  border: "none",
  borderRadius: "5px",
  backgroundColor: "#495057",
  color: "#fff",
  cursor: "pointer",
};

export default App;
