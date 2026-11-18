from pathlib import Path
import html
import json
from er_reference import VIEWS, reference_svg, reference_spec, reference_brief, reference_source
root=Path(__file__).resolve().parent/'er-previews';root.mkdir(exist_ok=True)
css='''*{box-sizing:border-box}body{margin:0;background:#f1f4f7;color:#263d50;font:16px/1.6 -apple-system,"Segoe UI","Malgun Gothic",sans-serif;min-width:1200px}header{height:72px;padding:0 32px;display:flex;align-items:center;justify-content:space-between;background:white;border-bottom:1px solid #d9e2e9}header span,.note,.badges,footer{font-size:14px;color:#637b8d}.layout{display:grid;grid-template-columns:245px 1fr;min-height:calc(100vh - 72px)}aside{background:#e9eef3;padding:24px 16px}aside h2{font-size:16px;padding:0 10px;margin:0 0 12px}nav{display:grid;gap:6px;margin-bottom:24px}a{color:#315d7c;text-decoration:none}nav a{padding:9px 10px;border:1px solid transparent;border-radius:7px;font-size:14px}nav a.selected{background:white;border-color:#c8d8e3;color:#233f55;font-weight:700}main{padding:24px 30px;max-width:1350px;min-width:0}h1{font-size:28px;margin:0 0 8px}.badges{display:flex;gap:12px;margin:12px 0 20px}.badges span{border:1px solid #d5e0e8;background:white;border-radius:16px;padding:4px 12px}.canvas{background:white;border:1px solid #dbe5ed;border-radius:12px;padding:12px}.canvas img{width:100%;max-width:1100px;display:block;margin:auto}blockquote{background:#e8eff4;border-left:3px solid #7c9bb2;padding:14px 20px;margin:20px 0;font-size:16px}.links{display:flex;gap:12px}.links a{padding:9px 14px;background:white;border:1px solid #cad8e3;border-radius:7px}footer{margin-top:20px}a:focus-visible{outline:3px solid #2c7bad;outline-offset:3px}'''
(root/'style.css').write_text(css,encoding='utf-8')
for view in VIEWS:
    ident=view['id'];spec=reference_spec(ident)
    for suffix,value in [('svg',reference_svg(ident)),('json',json.dumps(spec,ensure_ascii=False,indent=2)+'\n'),('md',reference_brief(ident)),('py',reference_source(ident))]:
        (root/(ident+'.'+suffix)).write_text(value,encoding='utf-8')
    page=['<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+ident+' · ER·선그래프 레퍼런스</title><link rel="stylesheet" href="style.css"></head><body><header><strong>설비마루 / ER·선그래프 표현 레퍼런스</strong><span>기존 사내 좌표·원천 값·연결 유지</span></header><div class="layout"><aside>']
    for kind,label in [('er','ER 맵 6종'),('line','선그래프 4종')]:
        page.append('<h2>'+label+'</h2><nav>')
        for other in VIEWS:
            if other['kind']==kind:page.append('<a class="'+('selected' if ident==other['id'] else '')+'" href="'+other['id']+'.html">'+html.escape(other['id']+' '+other['title'])+'</a>')
        page.append('</nav>')
    page+=['<p class="note">다른 표현을 고르면 해당 SVG 한 개만 읽습니다. 정적 참고 화면이며 실제 Streamlit UI가 아닙니다.</p></aside><main><h1>'+html.escape(ident+' · '+view['title'])+'</h1><p>'+html.escape(view['goal'])+'</p><div class="badges"><span>노치 9시</span><span>보간 미추가</span><span>단위·균일도 미정</span><span>가짜 데이터</span></div><div class="canvas"><img src="'+ident+'.svg" alt="'+html.escape(view['title'])+'"></div><blockquote>사내 AI에게: '+html.escape(ident+'의 표현을 참고해 기존 사이트 그래프만 바꿔줘. 기존 좌표·원천 값·계산 규칙은 유지해줘.')+'</blockquote><div class="links"><a download href="'+ident+'.md">수정 요청서</a><a download href="'+ident+'.json">표현 설정 JSON</a><a download href="'+ident+'.py">Streamlit 참고 코드</a></div><footer>예제 색상 범위 90~110은 실제 규격/단위가 아닙니다. 미측정 위치를 0이나 보간값으로 채우지 않습니다.</footer></main></div></body></html>']
    rendered=''.join(page);(root/(ident+'.html')).write_text(rendered,encoding='utf-8')
    if ident=='ER-01':(root/'index.html').write_text(rendered,encoding='utf-8')
print('Generated ER 6 + line 4 expression references. Notch=9, no spatial interpolation.')
