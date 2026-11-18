"""Select ONE expression reference. Corporate coordinate/ER computation is not replaced."""
import json
import importlib.util
import streamlit as st
from er_reference import VIEWS, reference_svg, reference_spec, reference_brief, reference_source, sample_points, plotly_single_map_example
st.set_page_config(page_title='선그래프·ER 맵 레퍼런스',layout='wide')
st.title('선그래프·ER 맵 표현 고르기')
st.caption('가짜 데이터 · ER 맵 노치 9시 고정 · 보간/단위/균일도는 미정')
ident=st.selectbox('레퍼런스 번호',[v['id'] for v in VIEWS],format_func=lambda key:next(v['id']+' · '+v['title'] for v in VIEWS if v['id']==key))
# Conditional generation: do not render ten hidden Streamlit tabs on every rerun.
st.image(reference_svg(ident))
st.code(reference_brief(ident),language='markdown')
st.download_button('작업명세 내려받기',reference_brief(ident),file_name=ident+'.md',mime='text/markdown')
st.download_button('표현 설정 내려받기',json.dumps(reference_spec(ident),ensure_ascii=False,indent=2),file_name=ident+'.json',mime='application/json')
st.download_button('참고 코드 내려받기',reference_source(ident),file_name=ident+'.py',mime='text/plain')
if st.checkbox('이미 승인·설치된 Plotly로 단일 맵 참고 보기',value=False):
    if importlib.util.find_spec('plotly') is None or not hasattr(st,'plotly_chart'):
        st.info('현재 환경의 설치/승인 상태를 확인하세요. 이 키트는 패키지를 설치하지 않습니다.')
    else:st.plotly_chart(plotly_single_map_example(sample_points(),1.0,[90.0,110.0]))
