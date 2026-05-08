import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const API_BASE = "http://192.168.0.241:3001";

const TAG_CONFIG = {
  식비: { color: "#ff922b", icon: "🍴" },
  교통: { color: "#339af0", icon: "🚌" },
  의료: { color: "#ff6b6b", icon: "🏥" },
  기타: { color: "#94d82d", icon: "📦" },
};

function App() {
  const [file, setFile] = useState(null);
  const [records, setRecords] = useState([]);
  const [editedTags, setEditedTags] = useState({});
  const [filters, setFilters] = useState({ user: "All", filename: "All" });

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    const res = await axios.get(`${API_BASE}/records?year=2025`);
    setRecords(res.data.cards);
  };

  const handleUpload = async (overwrite = false) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("overwrite", overwrite);

    try {
      await axios.post(`${API_BASE}/upload`, formData);
      alert("업로드 성공!");
      fetchRecords();
    } catch (err) {
      if (
        err.response?.status === 409 &&
        window.confirm("중복 파일입니다. 덮어쓸까요?")
      ) {
        handleUpload(true);
      }
    }
  };

  const saveAllTags = async () => {
    const updates = Object.entries(editedTags).map(([id, tag]) => ({
      id: parseInt(id),
      tag,
    }));
    await axios.post(`${API_BASE}/tags/bulk-update`, updates);
    alert("태그가 저장되었습니다.");
    setEditedTags({});
    fetchRecords();
  };

  // 필터링된 데이터 계산
  const filteredData = useMemo(() => {
    return records.filter(
      (r) =>
        (filters.user === "All" || r.user === filters.user) &&
        (filters.filename === "All" || r.filename === filters.filename),
    );
  }, [records, filters]);

  return (
    <div className="container">
      <header>
        <h1>📊 Tax Parser 상세 내역</h1>
        <div className="upload-section">
          <input type="file" onChange={(e) => setFile(e.target.files[0])} />
          <button onClick={() => handleUpload(false)}>파일 업로드</button>
        </div>
      </header>

      <section className="filter-bar">
        <select
          onChange={(e) => setFilters({ ...filters, user: e.target.value })}
        >
          <option value="All">이용자 (전체)</option>
          {[...new Set(records.map((r) => r.user))].map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <button className="save-btn" onClick={saveAllTags}>
          태그 변경사항 저장
        </button>
      </section>

      <div className="grid-container">
        <table>
          <thead>
            <tr>
              <th>날짜</th>
              <th>이용자</th>
              <th>금액</th>
              <th>태그</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((r) => (
              <tr key={r.id}>
                <td>{r.pay_date}</td>
                <td>{r.user}</td>
                <td>{r.amount.toLocaleString()}원</td>
                <td>
                  <select
                    value={editedTags[r.id] || r.tag}
                    style={{ backgroundColor: TAG_CONFIG[r.tag]?.color + "22" }}
                    onChange={(e) =>
                      setEditedTags({ ...editedTags, [r.id]: e.target.value })
                    }
                  >
                    {Object.keys(TAG_CONFIG).map((t) => (
                      <option key={t} value={t}>
                        {TAG_CONFIG[t].icon} {t}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
