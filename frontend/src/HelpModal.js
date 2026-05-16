const HelpModal = ({ show, onClose, theme }) => {
  if (!show) return null;

  return (
    <div style={modalOverlayStyle}>
      <div
        style={{
          ...modalContentStyle,
          backgroundColor: theme.surface,
          color: theme.onSurface,
        }}
      >
        <div style={modalHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: "1.5rem" }}>
            💡 종합소득세 신고 도움 가이드
          </h2>
          <button onClick={onClose} style={closeBtnStyle}>
            ✕
          </button>
        </div>

        <div style={modalBodyStyle}>
          <section style={sectionStyle}>
            <h3>1. 홈택스 로그인 및 서비스 이동</h3>
            <p>
              <a
                href="https://hometax.go.kr/"
                target="_blank"
                rel="noreferrer"
                style={{ color: theme.primary, fontWeight: "bold" }}
              >
                홈택스(hometax.go.kr)
              </a>{" "}
              로그인 후 <b>[종합소득세 신고도움 서비스]</b>로 이동하세요.
              미리보기를 누르면 한 장으로 요약된 필수 정보를 확인할 수 있습니다.
            </p>
          </section>

          <section style={sectionStyle}>
            <h3>2. 기장의무 확인</h3>
            <ul style={ulStyle}>
              <li>
                <b>복식부기의무자:</b> 재무제표(재무상태표, 손익계산서 등)를
                작성해야 합니다.
              </li>
              <li>
                <b>간편장부대상자:</b> 약식 장부(간편장부 명세서)로 작성이
                가능합니다.
              </li>
            </ul>
          </section>

          <section style={sectionStyle}>
            <h3>3. 소득 합산 및 자료 유무</h3>
            <p>
              사업소득 외에 근로소득이 있다면 합산 신고가 원칙입니다.
              타소득(합산대상) 자료유무 내 근로 부분에 해당 여부를 꼭
              확인하세요.
            </p>
          </section>

          <section style={{ ...sectionStyle, borderBottom: "none" }}>
            <h3>4. 간편장부명세서 필요경비 구분법</h3>
            <div style={expenseBoxStyle(theme)}>
              {/* ⚠️ 실제 DB/프론트엔드 태그명과 일치화 완료 */}
              <div style={itemStyle}>
                <b>🤝 기업업무추진비:</b> 선물, 식대 등(카카오 선물하기, 접대
                내역). 1,200만원 한도 내 권장.
              </div>
              <div style={itemStyle}>
                <b>❤️ 기부금:</b> 지정기부금 및 법정기부금 지출 내역.
              </div>
              <div style={itemStyle}>
                <b>🚗 차량유지비:</b> 업무용 차량 주유비, 수리비, 보험료 등.
              </div>
              <div style={itemStyle}>
                <b>💳 지급수수료:</b> 렌탈료, 서류 발급비, 계좌 이체 수수료 등.
              </div>
              <div style={itemStyle}>
                <b>📎 소모품비:</b> 문구류, 휴지, 종이컵 등 사무용 비품 구매
                내역.
              </div>
              <div style={itemStyle}>
                <b>📦 운반비:</b> 택배비, 퀵서비스, 우편 발송 비용 등.
              </div>
              <div style={itemStyle}>
                <b>📢 광고선전비:</b> 마케팅, 홍보물 인쇄, 포트폴리오 제작 비용
                등.
              </div>
              <div style={itemStyle}>
                <b>✈️ 여비교통비:</b> 출장 시 지출한 버스, 택시, 기차 등
                교통수단 비용.
              </div>
              <div style={itemStyle}>
                <b>etc 기타:</b> 위 항목 외에 업무와 직접적인 연관이 있는 경비.
              </div>
              <div
                style={{ ...itemStyle, color: "#ff4d4f", marginTop: "12px" }}
              >
                <b>❌ 불필요:</b> 종합소득세 세제 혜택 대상이 아닌 사적 지출
                (신고 제외 항목).
              </div>
            </div>
          </section>
        </div>

        <div style={modalFooterStyle}>
          <button
            onClick={onClose}
            style={{
              ...actionBtnStyle,
              backgroundColor: theme.primary,
              color: theme.onPrimary,
            }}
          >
            확인했습니다
          </button>
        </div>
      </div>
    </div>
  );
};
