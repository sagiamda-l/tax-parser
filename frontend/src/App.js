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
  const [selectedFile, setSelectedFile] = useState(null);
  const [filters, setFilters] = useState({ user: "All", filename: "All" });
  const [pendingTags, setPendingTags] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const res = await axios.get(`${API_URL}/records?year=2025`);
    setRecords(res.data);
  };

  const handleUpload = async (overwrite = false) => {
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("overwrite", overwrite);

    try {
      const res = await axios.post(`${API_URL}/upload`, formData);
      alert(`${res.data.count}건의 내역이 파싱되었습니다.`);
      loadData();
    } catch (err) {
      if (
        err.response?.status === 409 &&
        window.confirm(
          "중복 파일입니다. 기존 데이터를 삭제하고 다시 파싱할까요?",
        )
      ) {
        handleUpload(true);
      }
    }
  };

  const onTagChange = (id, newTag) => {
    setPendingTags((prev) => ({ ...prev, [id]: newTag }));
  };

  const handleBulkSave = async () => {
    const updates = Object.entries(pendingTags).map(([id, tag]) => ({
      id: parseInt(id),
      tag,
    }));
    if (updates.length === 0) return;
    await axios.post(`${API_URL}/tags/bulk-save`, updates);
    alert("태그 변경사항이 저장되었습니다.");
    setPendingTags({});
    loadData();
  };

  const filtered = useMemo(() => {
    return records.filter(
      (r) =>
        (filters.user === "All" || r.user === filters.user) &&
        (filters.filename === "All" || r.filename === filters.filename),
    );
  }, [records, filters]);

  const userOptions = ["All", ...new Set(records.map((r) => r.user))];
  const fileOptions = ["All", ...new Set(records.map((r) => r.filename))];

  return (
    <div style={{ padding: "20px" }}>
      <h1>📂 세무 비용 분류 시스템</h1>

      {/* 업로드 */}
      <div style={{ marginBottom: "20px" }}>
        <input
          type="file"
          onChange={(e) => setSelectedFile(e.target.files[0])}
        />
        <button onClick={() => handleUpload(false)}>업로드 및 파싱</button>
      </div>

      {/* 필터 및 일괄저장 */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
        <select
          onChange={(e) => setFilters({ ...filters, user: e.target.value })}
        >
          {userOptions.map((u) => (
            <option key={u} value={u}>
              {u === "All" ? "이용자(전체)" : u}
            </option>
          ))}
        </select>
        <select
          onChange={(e) => setFilters({ ...filters, filename: e.target.value })}
        >
          {fileOptions.map((f) => (
            <option key={f} value={f}>
              {f === "All" ? "문서명(전체)" : f}
            </option>
          ))}
        </select>
        <button
          onClick={handleBulkSave}
          style={{ marginLeft: "auto", background: "#339af0", color: "white" }}
        >
          태그변경사항 일괄 저장
        </button>
      </div>

      {/* 그리드 */}
      <table
        border="1"
        style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}
      >
        <thead>
          <tr style={{ background: "#f8f9fa" }}>
            <th>문서명</th>
            <th>이용자</th>
            <th>날짜</th>
            <th>내역(가맹점)</th>
            <th>금액</th>
            <th>비용분류(태그)</th>
          </tr>
        </thead>
        // 상세 내역 테이블의 렌더링 부분 (상단 생략)
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ fontSize: "11px", color: "#666" }}>{r.filename}</td>
              <td style={{ fontWeight: "500" }}>{r.user}</td>
              <td>{r.pay_date}</td>
              <td style={{ textAlign: "left", paddingLeft: "10px" }}>
                {r.vendor}
              </td>
              <td style={{ textAlign: "right", fontWeight: "bold" }}>
                {r.amount.toLocaleString()}원
              </td>
              <td>
                <select
                  value={modifiedTags[r.id] || r.tag}
                  style={{
                    backgroundColor:
                      (EXPENSE_TAGS[modifiedTags[r.id] || r.tag]?.color ||
                        "#eee") + "33",
                    border: `1px solid ${EXPENSE_TAGS[modifiedTags[r.id] || r.tag]?.color || "#ddd"}`,
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
