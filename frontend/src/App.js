import React, { useState } from 'react';
import axios from 'axios';

function App() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');

  const onFileChange = (e) => setFile(e.target.files[0]);

  const onUpload = async () => {
    if (!file) return alert("파일을 선택해주세요.");
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      // 서버 내부 IP 주소와 변경하신 백엔드 외부 포트를 정확히 입력합니다.
      const res = await axios.post("http://${window.location.hostname}:3001/upload/tax-pdf", formData);
      setMessage(`${res.data.filename} 파싱 성공! (표 ${res.data.table_count}개 발견)`);
    } catch (err) {
      setMessage("업로드 중 오류가 발생했습니다.");
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>📊 Tax Parser - 개인 세무 관리</h2>
      <input type="file" onChange={onFileChange} accept=".pdf" />
      <button onClick={onUpload} style={{ marginLeft: '10px' }}>데이터 분석 시작</button>
      {message && <p>{message}</p>}
      <hr />
      <div style={{ color: '#666' }}>
        <small>* 근로/사업소득 원천징수영수증 및 간소화 PDF를 업로드하세요.</small>
      </div>
    </div>
  );
}

export default App;