"""Generate a static offline reference from the SAME specs and aggregation as Streamlit."""
from pathlib import Path
import html
import json
from chart_core import PRESETS, preset_spec, sample_rows, prepare_points, render_source, render_brief, preview_svg

root=Path(__file__).resolve().parent / "previews"
root.mkdir(exist_ok=True)
parts=['<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>설비마루 · 오프라인 차트 선택</title><link rel="stylesheet" href="preview.css"></head><body><header><strong>설비마루 / 차트 레퍼런스</strong><span>가짜 데이터 · 외부 통신 없는 정적 예제</span></header><main><h1>말로 설명하는 대신, 예제를 고르세요.</h1><p>차트 번호 → 축·집계·필터 → 설정 JSON·사내 AI용 작업명세·참고 코드. 이 화면은 실제 Streamlit 렌더링이 아닌 동일 집계 결과의 SVG 미리보기입니다.</p><nav>']
for preset in PRESETS:parts.append('<a href="#'+preset['id']+'">'+html.escape(preset['id'])+'</a>')
parts.append('</nav><div class="grid">')
for preset in PRESETS:
    ident=preset['id'];spec=preset_spec(preset);result=prepare_points(sample_rows(),spec)
    (root/(ident+'.svg')).write_text(preview_svg(spec,result),encoding='utf-8')
    (root/(ident+'.json')).write_text(json.dumps(spec,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (root/(ident+'.py')).write_text(render_source(spec),encoding='utf-8')
    (root/(ident+'.md')).write_text(render_brief(spec),encoding='utf-8')
    parts.append('<section id="'+ident+'"><h2>'+html.escape(ident+' · '+spec['title'])+'</h2><img src="'+ident+'.svg" alt="'+html.escape(spec['title'])+'"><p class="meta">X: '+spec['x']+' / Y: '+spec['y']+' / 집계: '+spec['aggregate']+' / 설비: '+spec['equipment']+'</p><div class="links"><a download href="'+ident+'.json">설정 JSON</a><a download href="'+ident+'.md">AI 작업명세</a><a download href="'+ident+'.py">참고 Python</a></div><details><summary>명세 보기</summary><pre>'+html.escape(json.dumps(spec,ensure_ascii=False,indent=2))+'</pre></details></section>')
parts.append('</div><footer>실제 데이터 연결·Streamlit 버전 호환·사내 계정/권한은 회사 안에서 검증합니다. 원본 데이터를 이 저장소나 외부 AI에 보내지 마세요.</footer></main></body></html>')
(root/'index.html').write_text(''.join(parts),encoding='utf-8')
(root/'preview.css').write_text('''*{box-sizing:border-box}body{margin:0;background:#f2f5f7;color:#263c4e;font:16px/1.6 -apple-system,"Segoe UI","Malgun Gothic",sans-serif;min-width:1100px}header{padding:22px 36px;background:white;border-bottom:1px solid #dae3ea;display:flex;justify-content:space-between}header span,footer,.meta{font-size:14px;color:#617b8c}main{padding:30px 36px;max-width:1600px;margin:auto}h1{font-size:30px;margin:0 0 12px}h2{font-size:19px;margin:0 0 12px}main>p{color:#566f82;max-width:1100px}nav{display:flex;gap:12px;margin:22px 0}a{color:#306385;text-decoration:none;border:1px solid #c8d7e2;border-radius:7px;padding:6px 12px;background:white}a:focus-visible,summary:focus-visible{outline:3px solid #2879b0;outline-offset:3px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}section{background:white;border:1px solid #dce6ec;border-radius:12px;padding:22px;scroll-margin-top:24px}img{width:100%;height:auto;border:1px solid #edf1f4}.links{display:flex;gap:10px;margin:16px 0;font-size:14px}details{border-top:1px solid #e4ebf0;padding-top:12px}summary{cursor:pointer}pre{overflow:auto;font-size:14px}footer{margin-top:28px}''',encoding='utf-8')
print('Generated 6 offline chart examples with JSON, brief and Python source.')
