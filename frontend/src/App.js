import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function App() {
  const [year, setYear] = useState('2025');
  const [data, setData] = useState({ cards: [], documents: [] });
  const [stats, setStats] = useState([]);

  // 데이터 로드 및 통계 계산
  const fetchData = async () => {
    const res = await axios.get(`http://192.168.0.241:3001/records?year=${year}`);
    setData(res.data);
    
    // 태그별 집계 (그래프용)
    const tagMap = res.data.cards.reduce((acc, curr) => {
      const tag = curr.tag || '기타';
      acc[tag] = (acc[tag] || 0) + curr.amount;
      return acc;
    }, {});
    
    setStats(Object.keys(tagMap).map(key => ({ name: key, total: tagMap[key] })));
  };

  const handleUpload = async (file) => {
    // 1. 중복 체크
    const check = await axios.get(`http://192.168.0.241:3001/check-exists/${year}`);
    if (check.data.exists && !window.confirm(`${year}년도 데이터가 이미 있습니다. 덮어쓰시겠습니까?`)) {
      return;
    }
    // 2. 업로드 진행 (생략)
  };

  return (
    <div className="p-5">
      <h1>Tax DashBoard</h1>
      
      {/* 연도 선택 및 삭제 */}
      <select value={year} onChange={(e) => setYear(e.target.value)}>
        <option value="2024">2024</option>
        <option value="2025">2025</option>
      </select>
      <button onClick={() => fetchData()}>조회</button>
      <button onClick={() => {/* 삭제 API 호출 */}} style={{color: 'red'}}>해당 연도 삭제</button>

      {/* 태그별 추이 그래프 */}
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <BarChart data={stats}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="total" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 내역 표 및 필터링 UI (추가 구현) */}
    </div>
  );
}