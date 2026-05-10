import React, { useState, useEffect, useMemo } from "react";
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

// 9가지 필요경비 분류 체계 정의
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
  const [selectedFile, setSelectedFile] = useState(null);
  const [filters, setFilters] = useState({ user: "All", filename: "All" });
  const [modifiedTags, setModifiedTags] = useState({}); // { id: newTag }

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const res = await axios.get(`${API_URL}/records?year=2025`);
    setRecords(res.data);
  };

  const handleUpload = async (overwrite = false) => {
    if (!selectedFile) return alert("파일을 선택하세요.");
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("overwrite", overwrite);

    try {
      await axios.post(`${API_URL}/upload`, formData);
      alert("업로드 성공!");
      fetchData();
    } catch (err) {
      if (
        err.response?.status === 409 &&
        window.confirm("동일 파일명이 존재합니다. 덮어쓸까요?")
      ) {
        handleUpload(true);
      }
    }
  };

  const saveTags = async () => {
    const payload = Object.entries(modifiedTags).map(([id, tag]) => ({
      id: parseInt(id),
      tag,
    }));
    if (payload.length === 0) return;
    await axios.post(`${API_URL}/tags/bulk-save`, payload);
    alert("변경사항이 저장되었습니다.");
    setModifiedTags({});
    fetchData();
  };

  // 동적 필터 옵션 생성
  const options = useMemo(
    () => ({
      users: ["All", ...new Set(records.map((r) => r.user))],
      files: ["All", ...new Set(records.map((r) => r.filename))],
    }),
    [records],
  );

  // 필터링 적용 데이터
  const filtered = useMemo(() => {
    return records.filter(
      (r) =>
        (filters.user === "All" || r.user === filters.user) &&
        (filters.filename === "All" || r.filename === filters.filename),
    );
  }, [records, filters]);

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1>📂 필요경비 관리 시스템</h1>

      {/* 1. 업로드 영역 */}
      <div
        style={{
          marginBottom: "20px",
          border: "1px solid #ddd",
          padding: "15px",
        }}
      >
        <input
          type="file"
          onChange={(e) => setSelectedFile(e.target.files[0])}
        />
        <button onClick={() => handleUpload(false)}>파일 업로드</button>
      </div>

      {/* 2. 필터 및 저장 버튼 */}
      <div style={{ marginBottom: "10px", display: "flex", gap: "10px" }}>
        <select
          onChange={(e) => setFilters({ ...filters, user: e.target.value })}
        >
          {options.users.map((u) => (
            <option key={u} value={u}>
              {u === "All" ? "이용자(전체)" : u}
            </option>
          ))}
        </select>
        <select
          onChange={(e) => setFilters({ ...filters, filename: e.target.value })}
        >
          {options.files.map((f) => (
            <option key={f} value={f}>
              {f === "All" ? "문서명(전체)" : f}
            </option>
          ))}
        </select>
        <button
          onClick={saveTags}
          style={{ marginLeft: "auto", background: "#4c6ef5", color: "#fff" }}
        >
          태그변경사항 저장
        </button>
      </div>

      {/* 3. 내역 그리드 */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead style={{ background: "#f8f9fa" }}>
          <tr>
            <th>문서명</th>
            <th>이용자</th>
            <th>날짜</th>
            <th>금액</th>
            <th>비용분류(태그)</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ fontSize: "11px" }}>{r.filename}</td>
              <td>{r.user}</td>
              <td>{r.pay_date}</td>
              <td>{r.amount.toLocaleString()}원</td>
              <td>
                <select
                  value={modifiedTags[r.id] || r.tag}
                  style={{
                    backgroundColor:
                      (EXPENSE_TAGS[modifiedTags[r.id] || r.tag]?.color ||
                        "#eee") + "44",
                    padding: "3px",
                    borderRadius: "4px",
                  }}
                  onChange={(e) =>
                    setModifiedTags({ ...modifiedTags, [r.id]: e.target.value })
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
