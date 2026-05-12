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
  const [searchTerm, setSearchTerm] = useState(""); // 가맹점 검색용
  const [filters, setFilters] = useState({ customer: "All", filename: "All" });
  const [modified, setModified] = useState({});

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [resRec, resStat] = await Promise.all([
        axios.get(`${API_URL}/records?year=2025`),
        axios.get(`${API_URL}/stats?year=2025`),
      ]);
      setRecords(resRec.data || []);
      setStats(resStat.data || { documents: [], tags: [] });
    } catch (e) {
      console.error("데이터 로드 실패");
    }
  };

  const onUpload = async (overwrite = false) => {
    if (!file) return alert("파일을 선택하세요.");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("overwrite", overwrite);
    try {
      const res = await axios.post(`${API_URL}/upload`, fd);
      alert(`${res.data.count}건 파싱 완료`);
      loadAll();
    } catch (err) {
      if (
        err.response?.status === 409 &&
        window.confirm("중복 파일입니다. 덮어쓸까요?")
      )
        onUpload(true);
    }
  };

  const onSaveIndividualTags = async () => {
    const payload = Object.entries(modified).map(([id, tag]) => ({
      id: parseInt(id),
      tag,
    }));
    if (!payload.length) return;
    await axios.post(`${API_URL}/tags/bulk-save`, payload);
    alert("변경사항 저장됨");
    setModified({});
    loadAll();
  };

  const onBulkVendorUpdate = async (vendor, newTag) => {
    if (
      !window.confirm(
        `'${vendor}'의 모든 내역을 '${newTag}'로 변경하시겠습니까?`,
      )
    )
      return;
    const fd = new FormData();
    fd.append("vendor", vendor);
    fd.append("new_tag", newTag);
    await axios.post(`${API_URL}/tags/bulk-vendor-update`, fd);
    loadAll();
  };

  const customerList = useMemo(() => {
    const names = stats.documents.map((d) => d.customer).filter(Boolean);
    return ["All", ...new Set(names)];
  }, [stats.documents]);

  const filteredData = useMemo(() => {
    return records.filter(
      (r) =>
        (filters.customer === "All" || r.customer === filters.customer) &&
        (filters.filename === "All" || r.filename === filters.filename) &&
        r.vendor.toLowerCase().includes(searchTerm.toLowerCase()), // LIKE 검색 기능
    );
  }, [records, filters, searchTerm]);

  return (
    <div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>
      <h1>📂 세무 비용 통합 관리 시스템</h1>

      {/* 상단 통계 요약 섹션 (신규) */}
      <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
        <div
          style={{
            flex: 1,
            padding: "15px",
            background: "#f8f9fa",
            borderRadius: "8px",
            border: "1px solid #ddd",
          }}
        >
          <h3>📄 문서별 검증 (건수/금액)</h3>
          <div style={{ maxHeight: "150px", overflowY: "auto" }}>
            {stats.documents?.length > 0 ? (
              stats.documents.map((d) => (
                <div
                  key={d.filename}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "13px",
                    borderBottom: "1px solid #eee",
                    padding: "4px 0",
                  }}
                >
                  <span>
                    [{d.customer}] {d.filename}
                  </span>
                  <strong>
                    {d.count}건 / {Math.floor(d.total).toLocaleString()}원
                  </strong>
                </div>
              ))
            ) : (
              <div style={{ fontSize: "12px", color: "#999" }}>
                표시할 문서 데이터가 없습니다.
              </div>
            )}
          </div>
        </div>
        <div
          style={{
            flex: 1,
            padding: "15px",
            background: "#f8f9fa",
            borderRadius: "8px",
            border: "1px solid #ddd",
          }}
        >
          <h3>📊 항목별 지출 비율</h3>
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
                <span>{t.total?.toLocaleString()}원</span>
              </div>
              <div
                style={{
                  width: "100%",
                  height: "6px",
                  background: "#e9ecef",
                  borderRadius: "3px",
                }}
              >
                <div
                  style={{
                    width: `${(t.total / (stats.tags.reduce((a, b) => a + (b.total || 0), 0) || 1)) * 100}%`,
                    height: "100%",
                    background: EXPENSE_TAGS[t.tag]?.color || "#ced4da",
                    borderRadius: "3px",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 컨트롤 영역 (업로드 + 검색 + 필터) */}
      <div
        style={{
          background: "#e9ecef",
          padding: "20px",
          borderRadius: "8px",
          marginBottom: "20px",
        }}
      >
        <div style={{ marginBottom: "15px" }}>
          <input type="file" onChange={(e) => setFile(e.target.files[0])} />
          <button
            onClick={() => onUpload(false)}
            style={{ marginRight: "20px" }}
          >
            파일 파싱 업로드
          </button>

          <input
            type="text"
            placeholder="가맹점명 검색 (LIKE)..."
            style={{ width: "300px", padding: "6px" }}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <select
            onChange={(e) =>
              setFilters({ ...filters, customer: e.target.value })
            }
          >
            {["All", ...new Set(records.map((r) => r.customer))].map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
          <select
            onChange={(e) =>
              setFilters({ ...filters, filename: e.target.value })
            }
          >
            {["All", ...new Set(records.map((r) => r.filename))].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
          <button
            onClick={onSaveIndividualTags}
            style={{
              marginLeft: "auto",
              background: "#228be6",
              color: "white",
            }}
          >
            개별 태그 저장
          </button>
        </div>
      </div>

      {/* 데이터 그리드 */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead style={{ background: "#343a40", color: "white" }}>
          <tr>
            <th>날짜</th>
            <th>가맹점명</th>
            <th>금액</th>
            <th>태그 분류</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #dee2e6" }}>
              <td>{r.pay_date}</td>
              <td style={{ textAlign: "left", paddingLeft: "10px" }}>
                {r.vendor}
              </td>
              <td style={{ textAlign: "right", paddingRight: "10px" }}>
                {r.amount.toLocaleString()}원
              </td>
              <td>
                <select
                  value={modified[r.id] || r.tag}
                  onChange={(e) =>
                    setModified({ ...modified, [r.id]: e.target.value })
                  }
                  style={{
                    backgroundColor:
                      (EXPENSE_TAGS[modified[r.id] || r.tag]?.color || "#fff") +
                      "33",
                  }}
                >
                  {Object.keys(EXPENSE_TAGS).map((t) => (
                    <option key={t} value={t}>
                      {EXPENSE_TAGS[t].icon} {t}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <button
                  onClick={() =>
                    onBulkVendorUpdate(r.vendor, modified[r.id] || r.tag)
                  }
                  style={{ fontSize: "11px" }}
                >
                  이 가맹점 일괄적용
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
