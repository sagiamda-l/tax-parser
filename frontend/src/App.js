import axios from "axios";
import { AlertCircle, Search, Trash2, Upload } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API_BASE = "http://192.168.0.241:3001";

// 폰트 및 스타일 전역 설정 (App.css 또는 스타일 태그)
const globalStyle = `
  body { font-family: 'Pretendard', -apple-system, sans-serif; letter-spacing: -0.02em; }
  .recharts-text { font-size: 12px; fill: #666; }
`;

// 금액 단위 포맷터 (예: 1,200,000 -> 120만)
const formatYAxis = (value) => {
  if (value >= 10000) return `${(value / 10000).toLocaleString()}만`;
  return value.toLocaleString();
};

// 태그 수정용 상태 관리
// const [editedTags, setEditedTags] = useState({}); // { id_type: 'new_tag' }

const handleTagChange = (id, type, newTag) => {
  setEditedTags((prev) => ({ ...prev, [`${id}_${type}`]: newTag }));
};

const bulkSaveTags = async () => {
  const updates = Object.entries(editedTags).map(([key, tag]) => ({
    id: key.split("_")[0],
    type: key.split("_")[1],
    tag,
  }));
  await axios.post(`${API_BASE}/save-tags`, updates);
  alert("태그가 저장되었습니다.");
};

function App() {
  const [selectedYear, setSelectedYear] = useState("2025");
  const [records, setRecords] = useState({ cards: [], documents: [] });
  const [filterTag, setFilterTag] = useState("");
  const [loading, setLoading] = useState(false);

  // 1. 데이터 조회 및 필터링 (연도 기준)
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/records?year=${selectedYear}`);
      setRecords(res.data);
    } catch (err) {
      alert("데이터를 가져오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 2. 태그별 집계 데이터 생성 (그래프용)
  const getChartData = () => {
    const combined = [...records.cards, ...records.documents];
    const agg = combined.reduce((acc, curr) => {
      const tag = curr.tag || "미분류";
      acc[tag] = (acc[tag] || 0) + curr.amount;
      return acc;
    }, {});
    return Object.keys(agg).map((key) => ({ name: key, value: agg[key] }));
  };

  // 3. 파일 업로드 (덮어쓰기 체크 포함)
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 해당 연도 데이터 존재 여부 확인
    const check = await axios.get(`${API_BASE}/check-exists/${selectedYear}`);
    if (check.data.exists) {
      if (
        !window.confirm(
          `${selectedYear}년도 데이터가 이미 존재합니다. 기존 자료를 유지하고 추가하시겠습니까? (취소 시 기존 데이터는 유지됩니다)`,
        )
      ) {
        // 실제 '덮어쓰기'를 원할 경우 백엔드에서 해당 연도를 먼저 삭제하는 로직을 연동할 수 있습니다.
      }
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      await axios.post(`${API_BASE}/upload`, formData);
      alert("업로드 성공!");
      fetchData();
    } catch (err) {
      alert("업로드 실패");
    }
  };

  // 4. 해당 연도 자료 삭제
  const handleDeleteYear = async () => {
    if (window.confirm(`${selectedYear}년도 모든 자료를 삭제하시겠습니까?`)) {
      await axios.delete(`${API_BASE}/records/${selectedYear}`);
      fetchData();
    }
  };

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

  return (
    <div
      style={{
        padding: "20px",
        maxWidth: "1200px",
        margin: "0 auto",
        fontFamily: "sans-serif",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "2px solid #eee",
          paddingBottom: "20px",
        }}
      >
        <h2>📊 Tax Parser Dashboard</h2>
        <div style={{ display: "flex", gap: "10px" }}>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            style={{ padding: "8px" }}
          >
            {["2023", "2024", "2025", "2026"].map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
          <label
            style={{
              cursor: "pointer",
              padding: "8px 15px",
              background: "#007bff",
              color: "white",
              borderRadius: "4px",
            }}
          >
            <Upload size={16} /> 파일 업로드
            <input type="file" hidden onChange={handleFileUpload} />
          </label>
          <button
            onClick={handleDeleteYear}
            style={{
              padding: "8px 15px",
              background: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: "4px",
            }}
          >
            <Trash2 size={16} /> {selectedYear}년 삭제
          </button>
        </div>
      </header>

      {/* 통계 섹션 */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          marginTop: "30px",
        }}
      >
        <div
          style={{
            background: "#f8f9fa",
            padding: "20px",
            borderRadius: "8px",
            height: "350px",
          }}
        >
          <h4>태그별 지출 추이</h4>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={getChartData()}>
              <XAxis dataKey="name" />
              <YAxis tickFormatter={formatYAxis} width={60} />{" "}
              {/* 숫자 잘림 방지 width 확보 */}
              <Tooltip formatter={(val) => `${val.toLocaleString()}원`} />
              <Bar dataKey="value" fill="#4dabf7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div
          style={{
            background: "#f8f9fa",
            padding: "20px",
            borderRadius: "8px",
            height: "350px",
          }}
        >
          <h4>지출 비중</h4>
          <ResponsiveContainer width="100%" height="90%">
            <PieChart>
              <Pie
                data={getChartData()}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {getChartData().map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value) => value.toLocaleString() + "원"} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 데이터 테이블 섹션 */}
      <section style={{ marginTop: "40px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "10px",
          }}
        >
          <h4>
            상세 내역 (총 {records.cards.length + records.documents.length}건)
          </h4>
          <input
            type="text"
            placeholder="태그로 필터링..."
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            style={{ padding: "5px" }}
          />
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#eee" }}>
              <th style={{ padding: "10px", textAlign: "left" }}>날짜/분류</th>
              <th style={{ padding: "10px", textAlign: "left" }}>
                항목/업체명
              </th>
              <th style={{ padding: "10px", textAlign: "right" }}>금액</th>
              <th style={{ padding: "10px", textAlign: "center" }}>태그</th>
            </tr>
          </thead>
          <tbody>
            {[...records.cards, ...records.documents]
              .filter(
                (item) =>
                  !filterTag || (item.tag && item.tag.includes(filterTag)),
              )
              .map((item, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "10px" }}>
                    {item.pay_date || item.classification}
                  </td>
                  <td style={{ padding: "10px" }}>
                    {item.vendor || item.amount_type}
                  </td>
                  <td style={{ padding: "10px", textAlign: "right" }}>
                    {item.amount.toLocaleString()}원
                  </td>
                  <td style={{ padding: "10px", textAlign: "center" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        background: "#e2e3e5",
                        borderRadius: "12px",
                        fontSize: "12px",
                      }}
                    >
                      {item.tag || "미분류"}
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default App;
