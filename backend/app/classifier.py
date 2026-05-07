def assign_tag(name):
    if not name: return ""
    rules = {
        '유류비': ['에너지', '주유소', '충전소'],
        '업무추진비': ['식당', '아웃백', '횟집', '고기', '회식'],
        '세금/공과금': ['결정세액', '소득세', '지방소득세', '공과금'],
        '보장성보험': ['보험', '생명보험', '화재보험'],
        '의료비': ['병원', '약국', '치과'],
        '기부금': ['기부', '유니세프', '종교단체']
    }
    for tag, keywords in rules.items():
        if any(kw in name for kw in keywords):
            return tag
    return ""