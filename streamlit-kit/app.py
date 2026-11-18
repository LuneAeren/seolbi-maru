"""Local reference workbench. Uses only synthetic data; never executes generated code."""
import json
import streamlit as st
from chart_core import FIELDS, NUMERIC, DEVICES, PRESETS, preset_spec, validate_spec, sample_rows, prepare_points, render_brief, render_source

st.set_page_config(page_title="설비마루 차트 작업대", layout="wide")
st.title("보고 고르는 차트 작업대")
st.caption("가짜 데이터 · 실제 회사 자료/SSO 미연결 · 설정과 참고 코드를 사내에서 사용하세요.")
st.caption("현재 Streamlit: " + str(st.__version__))
st.info("예제나 옵션을 바꾼 뒤 설정 적용을 누르세요. 적용 전에는 이전 결과를 유지합니다.")
choice=st.selectbox("예제 선택", range(len(PRESETS)), format_func=lambda i:PRESETS[i]["id"]+" · "+PRESETS[i]["title"])
base=preset_spec(PRESETS[choice])
with st.form("chart-options"):
    title=st.text_input("제목",base["title"])
    chart=st.selectbox("차트",["line","bar","scatter","table"],index=["line","bar","scatter","table"].index(base["chart"]))
    x=st.selectbox("X축",list(FIELDS),index=list(FIELDS).index(base["x"]))
    y=st.selectbox("Y축",list(NUMERIC),index=list(NUMERIC).index(base["y"]))
    aggregate=st.selectbox("집계",["none","sum","mean"],index=["none","sum","mean"].index(base["aggregate"]))
    equipment=st.selectbox("설비",["all"]+list(DEVICES),index=(["all"]+list(DEVICES)).index(base["equipment"]))
    missing=st.selectbox("잘못된 값 처리",["drop","error"],index=["drop","error"].index(base["missing"]))
    submitted=st.form_submit_button("설정 적용")
if submitted:
    try:st.session_state["chart-spec"]=validate_spec(dict(version=1,title=title,chart=chart,x=x,y=y,aggregate=aggregate,equipment=equipment,missing=missing))
    except ValueError as error:st.error(str(error))
spec=st.session_state.get("chart-spec",base)
result=prepare_points(sample_rows(),spec)
st.subheader(spec["title"])
st.caption("입력 "+str(result["inputRows"])+"행 / 필터 제외 "+str(result["filteredRows"])+"행 / 잘못된 값 제외 "+str(result["droppedRows"])+"행")
if not result["points"]:st.info("조건에 맞는 값이 없습니다.")
elif spec["chart"]=="table":st.dataframe(result["points"])
else:
    renderer=getattr(st,{"line":"line_chart","bar":"bar_chart","scatter":"scatter_chart"}[spec["chart"]],None)
    if renderer is None:st.error("현재 사내 버전의 차트 API를 확인하세요. 임의로 패키지를 업그레이드하지 마세요.")
    else:
        try:renderer(result["points"],x="x",y="value")
        except TypeError:st.error("현재 버전의 축 지정/자료형을 inspect_environment.py로 확인하세요. 아래 표는 유지합니다.")
if spec["chart"] != "table":st.dataframe(result["points"])
# Downloads stay outside the form. No generated Python is imported or executed here.
st.download_button("설정 JSON 내려받기",json.dumps(spec,ensure_ascii=False,indent=2),file_name="chart-spec.json",mime="application/json")
st.download_button("사내 AI용 작업명세 내려받기",render_brief(spec),file_name="chart-request.md",mime="text/markdown")
st.download_button("참고 코드 내려받기",render_source(spec),file_name="chart-example.py",mime="text/plain")
st.code(render_source(spec),language="python")
