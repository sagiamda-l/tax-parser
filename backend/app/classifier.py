def assign_tag(vendor_name):
    """업체명을 분석하여 자동 태깅"""
    rules = {
        '유류비': ['에너지', '주유소', '충전소'],
        '업무추진비': ['식당', '아웃백', '횟집', '고기'],
        '소모품비': ['다이소', '알파문구'],
        '통신비': ['LGUPLUS', 'SKT', 'KT'],
        '구독료': ['피클플러스', '넷플릭스', '쿠팡']
    }
    
    for tag, keywords in rules.items():
        if any(kw in vendor_name for kw in keywords):
            return tag
    return "" # 명확하지 않으면 빈칸