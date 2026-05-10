import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";

const API_URL = "http://192.168.0.241:3001";
const TAG_COLORS = {
  기업업무추진비: "#ff8787",
  차량유지비: "#845ef7",
  여비교통비: "#fcc419",
  소모품비: "#22b8cf",
  기타: "#adb5bd",
};

function App() {
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({ documents: [], tags: [] });
  const [searchTerm, setSearchTerm] = useState("");
  const [modified, setModified] = useState({});

  useEffect(() => {
    refresh();
  }, []);

  const refresh = async () => {
    const [resRec, resStat] = await Promise.all([
      axios.get(`${API_URL}/records?year=2025`),
      axios.get(`${API_URL}/stats?year=2025`),
    ]);
    setRecords(resRec.data);
    setStats(resStat.data);
  };

  // 동일 가맹점 태그 일괄 변경 함수
  const handleBulkUpdate = async (vendor, newTag) => {
    if (
      !window.confirm(
        `'${vendor}' 가맹점의 모든 내역을 '${newTag}'(으)로 변경할까요?`,
      )
    )
      return;
    const fd = new FormData();
    fd.append("vendor", vendor);
    fd.append("new_tag", newTag);
    await axios.post(`${API_URL}/tags/bulk-vendor-update`, fd);
    refresh();
  };

  const filtered = records.filter((r) =>
    r.vendor.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div style={{ padding: "20px", fontFamily: "Pretendard, sans-serif" }}>
      <h2>📊 세무 결산 요약 (2025)</h2>

      {/* 1. 문서별/항목별 요약 섹션 */}
      <div style={{ display: "flex", gap: "20px", marginBottom: "30px" }}>
        <div
          style={{
            flex: 1,
            border: "1px solid #ddd",
            padding: "15px",
            borderRadius: "8px",
          }}
        >
          <h4>📄 문서별 합계 (검증용)</h4>
          {stats.documents.map((d) => (
            <div
              key={d.filename}
              style={{
                fontSize: "13px",
                marginBottom: "5px",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>{d.filename.substring(0, 15)}...</span>
              <strong>
                {d.count}건 / {d.total.toLocaleString()}원
              </strong>
            </div>
          ))}
        </div>
        <div
          style={{
            flex: 1,
            border: "1px solid #ddd",
            padding: "15px",
            borderRadius: "8px",
          }}
        >
          <h4>🏷️ 항목별 비율</h4>
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
                    width: `${(t.total / stats.tags.reduce((a, b) => a + b.total, 0)) * 100}%`,
                    height: "100%",
                    background: TAG_COLORS[t.tag] || "#339af0",
                    borderRadius: "4px",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. 가맹점 검색 및 리스트 */}
      <div style={{ marginBottom: "15px", display: "flex", gap: "10px" }}>
        <input
          type="text"
          placeholder="가맹점 내역 검색 (LIKE)..."
          style={{ flex: 1, padding: "10px" }}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <table border="1" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead style={{ background: "#f8f9fa" }}>
          <tr>
            <th>날짜</th>
            <th>가맹점명</th>
            <th>금액</th>
            <th>태그</th>
            <th>기능</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id}>
              <td>{r.pay_date}</td>
              <td style={{ fontWeight: "bold" }}>{r.vendor}</td>
              <td style={{ textAlign: "right" }}>
                {r.amount.toLocaleString()}원
              </td>
              <td>
                <select
                  value={modified[r.id] || r.tag}
                  onChange={(e) =>
                    setModified({ ...modified, [r.id]: e.target.value })
                  }
                >
                  {Object.keys(TAG_COLORS).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <button
                  onClick={() =>
                    handleBulkUpdate(r.vendor, modified[r.id] || r.tag)
                  }
                  style={{ fontSize: "11px", padding: "2px 5px" }}
                >
                  이 가맹점 일괄변경
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export default App;
