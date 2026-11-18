# chart_core.py 옆에 두는 가짜 데이터 예제. 코드 내용을 검토한 후 실행하세요.
import json
import streamlit as st
from chart_core import prepare_points, sample_rows
spec = json.loads('{"version": 1, "title": "날짜별 작업수 합계", "chart": "line", "x": "day", "y": "work_count", "aggregate": "sum", "equipment": "all", "missing": "drop"}')
result = prepare_points(sample_rows(), spec)
st.subheader(spec["title"])
st.caption("가짜 데이터 · 제외 행: " + str(result["droppedRows"]))
points = result["points"]
if not points:
    st.info("조건에 맞는 값이 없습니다.")
elif spec["chart"] == "table":
    st.dataframe(points)
else:
    names = {"line":"line_chart", "bar":"bar_chart", "scatter":"scatter_chart"}
    renderer = getattr(st, names[spec["chart"]], None)
    if renderer is None:
        st.error("사내 Streamlit 버전에서 해당 차트를 지원하는지 확인하세요.")
    else:
        try:
            renderer(points, x="x", y="value")
        except TypeError:
            st.error("현재 버전의 축 지정/자료형을 확인하세요.")
            st.dataframe(points)
