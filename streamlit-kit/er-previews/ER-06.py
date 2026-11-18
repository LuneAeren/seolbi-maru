# er_reference.py 옆에서 사용하는 가짜 데이터 표현 참고용 예제
import streamlit as st
from er_reference import reference_svg, reference_spec
reference_id = 'ER-06'
st.caption("가짜 데이터 표현 예제 · 실제 좌표/계산 규칙 미변경")
st.image(reference_svg(reference_id))
st.json(reference_spec(reference_id))
