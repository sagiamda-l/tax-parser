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
    load();
  }, []);

  const load = async () => {
    try {
      const res = await axios.get(`${API_URL}/records?year=2025`);
      setRecords(res.data);
    } catch (e) {
      console.error("데이터 로드 실패");
    }
  };

  const upload = async (overwrite = false) => {
    if (!file) return alert("파일을 선택하세요.");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("overwrite", overwrite);

    try {
      const res = await axios.post(`${API_URL}/upload`, fd);
      alert(`${res.data.count}건의 데이터를 파싱했습니다.`);
      load();
    } catch (err) {
      if (
        err.response?.status === 409 &&
        window.confirm("동일 파일 존재. 덮어쓸까요?")
      ) {
        upload(true);
      }
    }
  };

  const save = async () => {
    const payload = Object.entries(modified).map(([id, tag]) => ({
      id: parseInt(id),
      tag,
    }));
    if (!payload.length) return;
    await axios.post(`${API_URL}/tags/bulk-save`, payload);
    alert("저장되었습니다.");
    setModified({});
    load();
  };

  const filtered = useMemo(
    () =>
      records.filter(
        (r) =>
          (filters.user === "All" || r.user === filters.user) &&
          (filters.filename === "All" || r.filename === filters.filename),
      ),
    [records, filters],
  );

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>📂 종합소득세 필요경비 분류</h1>

      <div
        style={{ marginBottom: "20px", padding: "15px", background: "#f8f9fa" }}
      >
        <input type="file" onChange={(e) => setFile(e.target.files[0])} />
        <button onClick={() => upload(false)}>업로드 시작</button>
      </div>

      <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
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
          onClick={save}
          style={{ marginLeft: "auto", background: "#339af0", color: "#fff" }}
        >
          태그 저장
        </button>
      </div>

      <table border="1" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead style={{ background: "#eee" }}>
          <tr>
            <th>문서명</th>
            <th>이용자</th>
            <th>날짜</th>
            <th>내역</th>
            <th>금액</th>
            <th>태그</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id}>
              <td style={{ fontSize: "11px" }}>{r.filename}</td>
              <td>{r.user}</td>
              <td>{r.pay_date}</td>
              <td>{r.vendor}</td>
              <td style={{ textAlign: "right" }}>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export default App;
