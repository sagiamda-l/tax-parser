import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";

const API_URL = "http://192.168.0.241:3001";

function App() {
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({ documents: [], tags: [] });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  // 필터 상태
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
    setLoading(true);
    try {
      const [resRec, resStat] = await Promise.all([
        axios.get(`${API_URL}/records?year=${filters.year}`),
        axios.get(`${API_URL}/stats?year=${filters.year}`),
      ]);
      setRecords(resRec.data);
      setStats(resStat.data);
    } catch (err) {
      console.error("Data Load Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // 1. 이용자(Customer) 목록 추출 (필터 1번 요구사항 해결)
  const customerList = useMemo(() => {
    // records에서 직접 추출하여 데이터가 있는 이용자만 표시
    const names = records.map((r) => r.customer).filter(Boolean);
    return ["All", ...new Set(names)].sort();
  }, [records]);

  // 2. 연도(Year) 목록 계산 로직 (요구사항 3번 반영)
  const yearOptions = useMemo(() => {
    const yearsInDb = stats.documents.map((d) => d.target_year).filter(Boolean);
    const curr = new Date().getFullYear();
    let start, end;

    if (yearsInDb.length === 0) {
      start = curr - 3;
      end = curr + 3;
    } else {
      start = Math.min(...yearsInDb) - 3;
      end = Math.max(...yearsInDb) + 3;
    }

    const range = [];
    for (let i = start; i <= end; i++) range.push(i);
    return range.sort((a, b) => b - a);
  }, [stats.documents]);

  // 3. 필터링된 데이터 및 합계 (요구사항 4번 반영)
  const filteredData = useMemo(() => {
    return records.filter(
      (r) =>
        (filters.customer === "All" || r.customer === filters.customer) &&
        (filters.filename === "All" || r.filename === filters.filename) &&
        r.vendor.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [records, filters, searchTerm]);

  const totalAmount = filteredData.reduce((sum, r) => sum + r.amount, 0);

  // 4. 업로드 로직 구현 (반응 없음 문제 해결)
  const handleUpload = async () => {
    if (!file) return alert("파일을 선택해주세요.");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("target_year", filters.year); // 현재 선택된 연도로 저장

    setLoading(true);
    try {
      await axios.post(`${API_URL}/upload`, formData);
      alert("업로드가 완료되었습니다.");
      loadData();
    } catch (err) {
      alert("업로드 실패: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <h2>💎 세무 결산 마스터 v3.5</h2>
        <div style={summaryBadgeStyle}>
          선택 합계: {totalAmount.toLocaleString()}원 ({filteredData.length}건)
        </div>
      </header>

      {/* 카드형 요약 섹션 (요구사항 5번 반영) */}
      <div style={dashboardGridStyle}>
        <div style={cardStyle}>
          <h4>📄 문서별 검증 (Master)</h4>
          <div style={scrollAreaStyle}>
            {stats.documents.map((d, i) => (
              <div key={i} style={listItemStyle}>
                <span>
                  {d.customer} | {d.filename}
                </span>
                <strong>{d.total.toLocaleString()}원</strong>
              </div>
            ))}
          </div>
        </div>
        <div style={cardStyle}>
          <h4>📊 항목별 지출 비율</h4>
          {stats.tags.map((t) => (
            <div key={t.tag} style={{ marginBottom: "10px" }}>
              <div style={tagLabelStyle}>
                <span>{t.tag}</span>
                <span>{t.total.toLocaleString()}원</span>
              </div>
              <div style={progressBgStyle}>
                <div
                  style={{
                    ...progressFillStyle,
                    width: `${(t.total / totalAmount) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 필터 및 업로드 컨트롤 (요구사항 2, 3번 반영) */}
      <div style={filterBarStyle}>
        <div style={filterGroupStyle}>
          <span style={labelStyle}>📅 기준연도:</span>
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
        </div>
        <div style={filterGroupStyle}>
          <span style={labelStyle}>👤 이용자:</span>
          <select
            value={filters.customer}
            onChange={(e) =>
              setFilters({ ...filters, customer: e.target.value })
            }
          >
            {customerList.map((c) => (
              <option key={c} value={c}>
                {c === "All" ? "전체 이용자" : c}
              </option>
            ))}
          </select>
        </div>
        <div style={filterGroupStyle}>
          <span style={labelStyle}>🔍 검색:</span>
          <input
            type="text"
            placeholder="가맹점명..."
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
          <input type="file" onChange={(e) => setFile(e.target.files[0])} />
          <button
            onClick={handleUpload}
            style={uploadBtnStyle}
            disabled={loading}
          >
            {loading ? "처리중..." : "파싱 업로드"}
          </button>
        </div>
      </div>

      {/* 메인 테이블 */}
      <div style={tableCardStyle}>
        <table style={tableStyle}>
          <thead>
            <tr style={theadTrStyle}>
              <th>날짜</th>
              <th>이용자</th>
              <th>가맹점명</th>
              <th>금액</th>
              <th>태그</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((r) => (
              <tr key={r.id} style={trStyle}>
                <td>{r.pay_date}</td>
                <td>
                  <span style={userBadgeStyle}>{r.customer}</span>
                </td>
                <td style={{ textAlign: "left" }}>{r.vendor}</td>
                <td style={{ textAlign: "right", fontWeight: "bold" }}>
                  {r.amount.toLocaleString()}원
                </td>
                <td>{r.tag}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 스타일 객체 (가독성 및 반응형 고려)
const containerStyle = {
  padding: "30px",
  backgroundColor: "#f0f2f5",
  minHeight: "100vh",
  fontFamily: "Pretendard, sans-serif",
};
const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "25px",
};
const summaryBadgeStyle = {
  backgroundColor: "#2c3e50",
  color: "white",
  padding: "10px 20px",
  borderRadius: "30px",
  fontWeight: "bold",
};
const dashboardGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "20px",
  marginBottom: "25px",
};
const cardStyle = {
  backgroundColor: "white",
  padding: "20px",
  borderRadius: "12px",
  boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
};
const scrollAreaStyle = { maxHeight: "200px", overflowY: "auto" };
const listItemStyle = {
  display: "flex",
  justifyContent: "space-between",
  padding: "10px 0",
  borderBottom: "1px solid #f0f0f0",
  fontSize: "14px",
};
const filterBarStyle = {
  backgroundColor: "white",
  padding: "15px 25px",
  borderRadius: "12px",
  display: "flex",
  gap: "20px",
  alignItems: "center",
  marginBottom: "25px",
};
const filterGroupStyle = { display: "flex", alignItems: "center", gap: "8px" };
const labelStyle = { fontWeight: "bold", color: "#666", fontSize: "14px" };
const uploadBtnStyle = {
  backgroundColor: "#3498db",
  color: "white",
  border: "none",
  padding: "8px 18px",
  borderRadius: "6px",
  cursor: "pointer",
};
const tableCardStyle = {
  backgroundColor: "white",
  borderRadius: "12px",
  overflow: "hidden",
};
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const theadTrStyle = {
  backgroundColor: "#f8f9fa",
  borderBottom: "2px solid #dee2e6",
  textAlign: "center",
};
const trStyle = {
  borderBottom: "1px solid #eee",
  textAlign: "center",
  fontSize: "14px",
};
const userBadgeStyle = {
  backgroundColor: "#e1f5fe",
  color: "#01579b",
  padding: "3px 8px",
  borderRadius: "4px",
  fontSize: "12px",
};
const progressBgStyle = {
  width: "100%",
  height: "8px",
  backgroundColor: "#eee",
  borderRadius: "4px",
};
const progressFillStyle = {
  height: "100%",
  backgroundColor: "#3498db",
  borderRadius: "4px",
};
const tagLabelStyle = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: "12px",
  marginBottom: "4px",
};

export default App;
