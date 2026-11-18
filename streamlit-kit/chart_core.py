"""Offline chart specifications and deterministic aggregation. Standard library only."""
import datetime as dt
import html
import json
import math
from collections import defaultdict

FIELDS = {"day": "날짜", "equipment": "설비", "temperature": "온도", "pressure": "압력", "downtime": "정지분", "work_count": "작업수"}
NUMERIC = ("temperature", "pressure", "downtime", "work_count")
DEVICES = ("MC-DEMO-01", "MC-DEMO-02", "MC-DEMO-03")
PRESETS = [
 {"id":"01-trend", "title":"설비 1의 일별 평균 온도", "chart":"line", "x":"day", "y":"temperature", "aggregate":"mean", "equipment":"MC-DEMO-01", "missing":"drop"},
 {"id":"02-downtime", "title":"설비별 정지분 합계", "chart":"bar", "x":"equipment", "y":"downtime", "aggregate":"sum", "equipment":"all", "missing":"drop"},
 {"id":"03-workload", "title":"설비별 작업수 합계", "chart":"bar", "x":"equipment", "y":"work_count", "aggregate":"sum", "equipment":"all", "missing":"drop"},
 {"id":"04-scatter", "title":"온도와 압력의 분포", "chart":"scatter", "x":"temperature", "y":"pressure", "aggregate":"none", "equipment":"all", "missing":"drop"},
 {"id":"05-daily", "title":"날짜별 작업수 합계", "chart":"line", "x":"day", "y":"work_count", "aggregate":"sum", "equipment":"all", "missing":"drop"},
 {"id":"06-table", "title":"설비별 평균 온도 표", "chart":"table", "x":"equipment", "y":"temperature", "aggregate":"mean", "equipment":"all", "missing":"drop"}
]

def validate_spec(value):
    allowed = {"version", "title", "chart", "x", "y", "aggregate", "equipment", "missing"}
    if not isinstance(value, dict) or set(value) != allowed:
        raise ValueError("명세는 정해진 8개 필드만 사용합니다. URL·SQL·코드를 넣지 않습니다.")
    s = dict(value)
    if type(s["version"]) is not int or s["version"] != 1:
        raise ValueError("지원 명세 버전은 1입니다.")
    if not isinstance(s["title"], str) or not 1 <= len(s["title"].strip()) <= 100 or any(ord(c)<32 for c in s["title"]):
        raise ValueError("제목은 제어문자 없는 1~100자입니다.")
    for key, options in {"chart":("line","bar","scatter","table"), "x":tuple(FIELDS), "y":NUMERIC,
                         "aggregate":("none","sum","mean"), "equipment":("all",)+DEVICES, "missing":("drop","error")}.items():
        if s[key] not in options:
            raise ValueError("허용되지 않은 설정: " + key)
    if s["chart"] == "bar" and s["aggregate"] == "none":
        raise ValueError("막대 차트의 집계는 sum 또는 mean을 명시하세요.")
    if s["chart"] == "scatter" and (s["x"] not in NUMERIC or s["aggregate"] != "none"):
        raise ValueError("산점도는 숫자 X축과 집계 없음으로 설정합니다.")
    s["title"] = s["title"].strip()
    return s

def preset_spec(preset):
    return validate_spec({"version":1, **{k:v for k,v in preset.items() if k != "id"}})

def sample_rows():
    rows = []
    for day in range(7):
        for device in range(3):
            rows.append({"day":(dt.date(2026,11,12)+dt.timedelta(days=day)).isoformat(),
                         "equipment":DEVICES[device], "temperature":round(40+device*2+(day%4)*0.7,1),
                         "pressure":round(100+device*3+day*0.5,1), "downtime":(day+device)%4*5, "work_count":3+(day+device)%5})
    return rows

def number(value):
    if isinstance(value, bool) or not isinstance(value, (int,float,str)):
        raise ValueError("숫자 값이 아닙니다.")
    result = float(value)
    if not math.isfinite(result):
        raise ValueError("유한한 숫자가 아닙니다.")
    return result

def x_value(row, key):
    value = row[key]
    if key in NUMERIC:
        return number(value)
    if key == "day":
        if not isinstance(value,str) or dt.date.fromisoformat(value).isoformat() != value:
            raise ValueError("유효한 YYYY-MM-DD 날짜가 아닙니다.")
        return value
    if value not in DEVICES:
        raise ValueError("허용되지 않은 설비입니다.")
    return value

def prepare_points(rows, spec):
    s = validate_spec(spec)
    if not isinstance(rows,list) or len(rows)>50000:
        raise ValueError("원본은 최대 50,000행입니다. 제한을 넘으면 서버에서 집계하세요.")
    points, dropped, filtered = [], 0, 0
    for row in rows:
        if not isinstance(row,dict):
            raise ValueError("각 행은 객체여야 합니다.")
        if s["equipment"] != "all" and row.get("equipment") != s["equipment"]:
            filtered += 1
            continue
        try:
            x, y = x_value(row,s["x"]), number(row[s["y"]])
        except (KeyError,TypeError,ValueError,OverflowError):
            if s["missing"] == "error":
                raise ValueError("누락·잘못된 축 값이 있습니다. 원본을 확인하세요.")
            dropped += 1
            continue
        points.append({"x":x,"value":y})
    if s["aggregate"] != "none":
        groups = defaultdict(list)
        for point in points:
            groups[point["x"]].append(point["value"])
        try:
            points = [{"x":key,"value":math.fsum(values)/(len(values) if s["aggregate"]=="mean" else 1)} for key,values in groups.items()]
        except OverflowError:
            raise ValueError("집계 결과가 숫자 범위를 넘었습니다. 원천 단위를 확인하세요.")
    points.sort(key=lambda point:point["x"])
    if len(points)>2000:
        raise ValueError("표시 점은 최대 2,000개입니다. 조용히 자르지 않고 집계를 요청합니다.")
    return {"points":points,"inputRows":len(rows),"filteredRows":filtered,"droppedRows":dropped}

def render_brief(spec):
    s = validate_spec(spec)
    return "\n".join([
      "# 사내 AI용 차트 작업명세", "", "이 명세와 chart_core.py를 기준으로 기존 앱의 해당 부분만 수정하세요.",
      "- 목적: " + s["title"], "- 차트: " + s["chart"], "- X축: " + FIELDS[s["x"]] + " / " + s["x"],
      "- Y축: " + FIELDS[s["y"]] + " / " + s["y"], "- 집계: " + s["aggregate"], "- 설비 필터: " + s["equipment"],
      "- 잘못된 값: " + s["missing"] + "; 제외 행 수를 표시하고 0으로 채우지 마세요.",
      "- 기존 로그인·DB·사용자 권한 유지. 실제 원천 열 이름과 자료형은 회사 안에서 매핑하세요.",
      "- 실제 Streamlit/Python 버전과 사용 가능 API를 먼저 확인. 임의 패키지 설치·업그레이드 금지.",
      "- 외부 URL·CDN·웹폰트·AI API·HTML 실행을 추가하지 마세요.",
      "- 집계·빈 결과·날짜 정렬·누락 처리·사용자별 범위를 검사하세요.",
      "- 수정 파일 / 원천 필드 매핑 / 검증 / 미구현을 보고하세요.", ""])

def render_source(spec):
    s = validate_spec(spec)
    return '\n'.join([
      '# chart_core.py 옆에 두는 가짜 데이터 예제. 코드 내용을 검토한 후 실행하세요.',
      'import json', 'import streamlit as st', 'from chart_core import prepare_points, sample_rows',
      'spec = json.loads(' + repr(json.dumps(s,ensure_ascii=False)) + ')',
      'result = prepare_points(sample_rows(), spec)', 'st.subheader(spec["title"])',
      'st.caption("가짜 데이터 · 제외 행: " + str(result["droppedRows"]))',
      'points = result["points"]',
      'if not points:', '    st.info("조건에 맞는 값이 없습니다.")',
      'elif spec["chart"] == "table":', '    st.dataframe(points)',
      'else:', '    names = {"line":"line_chart", "bar":"bar_chart", "scatter":"scatter_chart"}',
      '    renderer = getattr(st, names[spec["chart"]], None)',
      '    if renderer is None:', '        st.error("사내 Streamlit 버전에서 해당 차트를 지원하는지 확인하세요.")',
      '    else:', '        try:', '            renderer(points, x="x", y="value")', '        except TypeError:', '            st.error("현재 버전의 축 지정/자료형을 확인하세요.")', '            st.dataframe(points)', ''])

def preview_svg(spec, result):
    """Small synthetic-data documentation preview, not a replacement plotting backend."""
    s = validate_spec(spec); points=result["points"]; esc=lambda value:html.escape(str(value),quote=True)
    parts=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 330" role="img" aria-label="'+esc(s["title"])+'">',
           '<rect width="720" height="330" fill="#f8fafc"/>', '<text x="24" y="32" fill="#243d50" font-family="sans-serif" font-size="26">'+esc(s["title"]+' · 가짜 데이터')+'</text>']
    if not points:
        parts.append('<text x="24" y="90" font-family="sans-serif" font-size="22">표시할 값 없음</text>')
    elif s["chart"]=='table':
        for i, point in enumerate(points[:10]):
            y=75+i*22;parts.append('<text x="30" y="'+str(y)+'" font-size="21" font-family="sans-serif">'+esc(str(point["x"])+'     '+format(point["value"],'.2f'))+'</text>')
    else:
        values=[point["value"] for point in points];low=min(0,min(values));high=max(values);span=high-low or 1
        xs=[float(p["x"]) for p in points] if s["chart"]=='scatter' else list(range(len(points)))
        x0=min(xs);xspan=max(xs)-x0 or 1
        coords=[(80+(x-x0)/xspan*540,270-(point["value"]-low)/span*200) for x,point in zip(xs,points)]
        parts+=['<path d="M50 65V275H690" fill="none" stroke="#b6c6d4"/>', '<text x="10" y="70" font-size="20">'+esc(format(high,'.1f'))+'</text>']
        if s["chart"]=='line':
            parts.append('<polyline points="'+' '.join(format(x,'.2f')+','+format(y,'.2f') for x,y in coords)+'" fill="none" stroke="#3c789c" stroke-width="3"/>')
        for i, ((x,y),point) in enumerate(zip(coords,points)):
            if s["chart"]=='bar':
                width=min(58,500/max(1,len(points)));parts.append('<rect x="'+str(x-width/2)+'" y="'+str(y)+'" width="'+str(width)+'" height="'+str(270-y)+'" fill="#507f9e"/>')
            else:parts.append('<circle cx="'+str(x)+'" cy="'+str(y)+'" r="4" fill="#3c789c"/>')
            if len(points)<=8:parts.append('<text x="'+str(x)+'" y="300" text-anchor="middle" font-family="sans-serif" font-size="20">'+esc(str(point['x'])[5:] if s["x"]=="day" else point['x'])+'</text>')
    parts.append('</svg>');return ''.join(parts)
