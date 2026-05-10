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
  const [file, setFile] = useState(null);
  const [filters, setFilters] = useState({ user: "All", filename: "All" });
  const [modified, setModified] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await axios.get(`${API_URL}/records?year=2025`);
      setRecords(res.data || []);
    } catch (e) {
      console.error("데이터 로드 중 오류 발생");
    }
  };

  const onUpload = async (overwrite = false) => {
    if (!file) return alert("파일을 선택해주세요.");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("overwrite", overwrite);

    try {
      const res = await axios.post(`${API_URL}/upload`, fd);
      alert(`${res.data.count}건의 내역을 성공적으로 파싱했습니다.`);
      loadData();
    } catch (err) {
      if (
        err.response?.status === 409 &&
        window.confirm("동일 파일명이 존재합니다. 덮어쓸까요?")
      ) {
        onUpload(true);
      } else {
        alert("업로드 실패: 파일을 확인해주세요.");
      }
    }
  };

  const onSaveTags = async () => {
    const payload = Object.entries(modified).map(([id, tag]) => ({
      id: parseInt(id),
      tag,
    }));
    if (!payload.length) return;
    await axios.post(`${API_URL}/tags/bulk-save`, payload);
    alert("태그가 저장되었습니다.");
    setModified({});
    loadData();
  };

  const filteredData = useMemo(() => {
    return records.filter(
      (r) =>
        (filters.user === "All" || r.user === filters.user) &&
        (filters.filename === "All" || r.filename === filters.filename),
    );
  }, [records, filters]);

  return (
    <div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>
      <h1>📂 종합소득세 필요경비 분류 시스템</h1>

      {/* 업로드 섹션 */}
      <div
        style={{
          padding: "20px",
          background: "#f1f3f5",
          borderRadius: "8px",
          marginBottom: "20px",
        }}
      >
        <input type="file" onChange={(e) => setFile(e.target.files[0])} />
        <button
          onClick={() => onUpload(false)}
          style={{ padding: "5px 15px", cursor: "pointer" }}
        >
          파일 분석 및 업로드
        </button>
      </div>

      {/* 필터 및 저장 */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "15px",
          alignItems: "center",
        }}
      >
        <select
          onChange={(e) => setFilters({ ...filters, user: e.target.value })}
        >
          {["All", ...new Set(records.map((r) => r.user))].map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
        <select
          onChange={(e) => setFilters({ ...filters, filename: e.target.value })}
        >
          {["All", ...new Set(records.map((r) => r.filename))].map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        <button
          onClick={onSaveTags}
          style={{
            marginLeft: "auto",
            background: "#228be6",
            color: "white",
            border: "none",
            padding: "8px 20px",
            borderRadius: "4px",
          }}
        >
          태그 일괄 저장
        </button>
      </div>

      {/* 그리드 */}
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}
      >
        <thead>
          <tr style={{ background: "#343a40", color: "white" }}>
            <th style={{ padding: "10px" }}>문서명</th>
            <th>이용자</th>
            <th>날짜</th>
            <th>가맹점/내역</th>
            <th>금액</th>
            <th>경비분류(태그)</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #dee2e6" }}>
              <td style={{ fontSize: "11px", color: "#868e96" }}>
                {r.filename}
              </td>
              <td>{r.user}</td>
              <td>{r.pay_date}</td>
              <td style={{ textAlign: "left" }}>{r.vendor}</td>
              <td style={{ textAlign: "right", fontWeight: "bold" }}>
                {r.amount.toLocaleString()}원
              </td>
              <td>
                <select
                  value={modified[r.id] || r.tag}
                  style={{
                    padding: "4px",
                    borderRadius: "4px",
                    backgroundColor:
                      (EXPENSE_TAGS[modified[r.id] || r.tag]?.color || "#fff") +
                      "22",
                  }}
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
  );
}

export default App;
