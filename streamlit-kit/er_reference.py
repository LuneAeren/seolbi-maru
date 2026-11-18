"""View references only: synthetic normalized coordinates, fixed 9-o'clock notch.
No DB/coordinate ingestion, spatial interpolation, ER-unit assumptions or uniformity formula.
"""
import html
import math
import json

VIEWS = [
 {"id":"ER-01","title":"측정값 중심 맵","kind":"er","goal":"각 측정점의 ER 값을 한눈에 읽기"},
 {"id":"ER-02","title":"맵과 측정점 목록","kind":"er","goal":"공간 위치와 수치 목록을 함께 확인"},
 {"id":"ER-03","title":"미측정 구분 맵","kind":"er","goal":"미측정 위치를 0과 구분해 확인"},
 {"id":"ER-04","title":"두 웨이퍼 나란히 비교","kind":"er","goal":"같은 색상 범위로 두 맵 비교"},
 {"id":"ER-05","title":"여러 웨이퍼 요약","kind":"er","goal":"같은 범례로 여러 맵을 빠르게 살펴보기"},
 {"id":"ER-06","title":"선택점 상세 보기","kind":"er","goal":"맵 한 점의 ID·좌표·값을 옆에서 읽기"},
 {"id":"LINE-01","title":"한 계열에 집중","kind":"line","goal":"단일 선과 누락 구간을 명확히 표시"},
 {"id":"LINE-02","title":"두 계열 겹쳐 비교","kind":"line","goal":"동일 축에서 두 계열의 차이 보기"},
 {"id":"LINE-03","title":"계열별 분리 비교","kind":"line","goal":"겹침을 줄이고 같은 축 범위로 비교"},
 {"id":"LINE-04","title":"추이와 선택값 상세","kind":"line","goal":"선그래프와 선택한 측정 기록을 함께 보기"}
]
COLOR_MIN, COLOR_MAX = 90.0, 110.0  # Synthetic display range; NOT a process specification.
PALETTE = [(68,1,84),(59,82,139),(33,145,140),(94,201,98),(253,231,37)]

def view_for(ident):
    for view in VIEWS:
        if view['id']==ident:return dict(view)
    raise ValueError('등록된 레퍼런스 번호를 선택하세요.')

def sample_points(offset=0.0):
    coords=[(0.0,0.0)]
    coords += [(0.43*math.cos(i*math.pi/2),0.43*math.sin(i*math.pi/2)) for i in range(4)]
    coords += [(0.78*math.cos(math.pi/8+i*math.pi/4),0.78*math.sin(math.pi/8+i*math.pi/4)) for i in range(8)]
    return [{'pointId':'P%02d'%(i+1),'x':round(x,4),'y':round(y,4),
             'er':None if i in (5,12) else round(100+4*x-3*y+offset,2)} for i,(x,y) in enumerate(coords)]

def sample_line():
    return [{'order':i+1,'a':None if i==6 else value,'b':None if i==6 else round(value+1.8-math.sin(i)*1.2,2)}
            for i,value in enumerate([99.1,100.4,100.0,102.2,103.1,101.8,100.0,99.8,100.7,101.1,99.5,100.3])]

def color_for(value, low=COLOR_MIN, high=COLOR_MAX):
    if value is None:return '#c3cbd2'
    if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value):raise ValueError('유한한 표시 값이 필요합니다.')
    if not math.isfinite(low) or not math.isfinite(high) or low>=high:raise ValueError('색상 범위를 확인하세요.')
    t=max(0.0,min(1.0,(value-low)/(high-low)))*(len(PALETTE)-1)
    index=min(int(t),len(PALETTE)-2);fraction=t-index
    rgb=[round(PALETTE[index][i]*(1-fraction)+PALETTE[index+1][i]*fraction) for i in range(3)]
    return '#%02x%02x%02x'%tuple(rgb)

def _text(x,y,text,size=18,color='#334e63',anchor='start',weight='normal'):
    return '<text x="%s" y="%s" text-anchor="%s" fill="%s" font-family="sans-serif" font-size="%s" font-weight="%s">%s</text>'%(x,y,anchor,color,size,weight,html.escape(str(text)))

def _map(points,cx,cy,r,labels=True,missing_focus=False,selected=None):
    # Cartesian +Y is drawn upwards; notch is fixed at negative X (9 o'clock).
    parts=['<circle cx="%s" cy="%s" r="%s" fill="#f3f7f9" stroke="#a9bcc9" stroke-width="2"/>'%(cx,cy,r)]
    left=cx-r;d=r*0.085
    parts+=['<polygon points="%s,%s %s,%s %s,%s" fill="#ffffff"/>'%(left-3,cy-d,left+d,cy,left-3,cy+d),
            '<path d="M %s %s L %s %s L %s %s" fill="none" stroke="#7893a5" stroke-width="2"/>'%(left,cy-d,left+d,cy,left,cy+d),
            _text(left-10,cy+5,'9시',15,'#617a8b','end')]
    for point in points:
        x=cx+point['x']*r;y=cy-point['y']*r;missing=point['er'] is None
        radius=max(8,min(25,r*.115));stroke='#d36e36' if point['pointId']==selected else ('#7c8a94' if missing else '#ffffff')
        fill='#f1f3f5' if missing else color_for(point['er'])
        parts.append('<circle cx="%.3f" cy="%.3f" r="%.3f" fill="%s" stroke="%s" stroke-width="%s"/>'%(x,y,radius,fill,stroke,3 if point['pointId']==selected else 1.5))
        if missing:
            parts.append('<path d="M %.3f %.3f l %.3f %.3f M %.3f %.3f l %.3f %.3f" stroke="#7c8a94" stroke-width="1.5"/>'%(x-radius*.5,y-radius*.5,radius,radius,x-radius*.5,y+radius*.5,radius,-radius))
        if labels and r>=155:
            if missing:
                parts.append(_text(x,y-radius-8,point['pointId'],16,'#526b7e','middle'))
            else:
                rgb=[int(fill[i:i+2],16)/255 for i in (1,3,5)]
                linear=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
                light=sum(v*w for v,w in zip(linear,(.2126,.7152,.0722)))
                parts.append(_text(x,y+5,point['pointId'],15,'#07131d' if light>.18 else '#ffffff','middle'))
            label='미측정' if missing else format(point['er'],'.1f')
            parts.append(_text(x,y+radius+20,label,17,'#526b7e' if missing else '#243d50','middle'))
        elif missing_focus and missing:
            parts.append(_text(x,y+radius+18,'미측정',16,'#526b7e','middle'))
    return ''.join(parts)

def _legend(x,y,width=360):
    parts=[]
    for i in range(60):parts.append('<rect x="%.2f" y="%s" width="%.2f" height="14" fill="%s"/>'%(x+i*width/60,y,width/60+0.3,color_for(COLOR_MIN+(COLOR_MAX-COLOR_MIN)*i/59)))
    parts.extend([_text(x,y+36,'90',17),_text(x+width/2,y+36,'100',17,anchor='middle'),_text(x+width,y+36,'110',17,anchor='end'),_text(x,y+62,'색상 범위는 모든 예제에서 동일 · ER 단위 미정',16,'#667f90')])
    return ''.join(parts)

def _line(rows,keys,x,y,width,height):
    colors={'a':'#357ca6','b':'#c38b38'};parts=[]
    parts.append('<path d="M %s %s V %s H %s" fill="none" stroke="#bbcad5"/>'%(x,y,y+height,x+width))
    for value in (90,100,110):
        yy=y+height-(value-90)/20*height
        parts.append('<path d="M %s %s H %s" stroke="#e1e8ed"/>'%(x,yy,x+width));parts.append(_text(x-12,yy+5,value,16,anchor='end'))
    for key in keys:
        segments=[];current=[]
        for row in rows:
            if row[key] is None:
                if current:segments.append(current);current=[]
                continue
            px=x+(row['order']-1)/(len(rows)-1)*width;py=y+height-(row[key]-90)/20*height
            current.append((px,py))
            parts.append('<circle cx="%.3f" cy="%.3f" r="4" fill="%s"/>'%(px,py,colors[key]))
        if current:segments.append(current)
        for segment in segments:parts.append('<polyline points="%s" fill="none" stroke="%s" stroke-width="3"/>'%(' '.join('%.3f,%.3f'%pair for pair in segment),colors[key]))
    for index in (1,4,7,10,12):parts.append(_text(x+(index-1)/(len(rows)-1)*width,y+height+28,index,16,anchor='middle'))
    parts.append(_text(x+width/2,y+height+56,'가짜 측정 순서',17,anchor='middle'))
    return ''.join(parts)

def reference_svg(ident):
    view=view_for(ident);points=sample_points();rows=sample_line()
    parts=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" role="img" aria-label="'+html.escape(view['title'])+'">',
           '<rect width="1000" height="700" fill="#ffffff"/>',_text(34,40,view['id']+' · '+view['title'],26,weight='bold'),
           _text(34,70,'가짜 데이터 · 기존 좌표/계산 규칙을 바꾸지 않는 표현 레퍼런스',17,'#6d8291')]
    if ident=='ER-01':
        parts.extend([_map(points,390,330,205),_text(670,235,'측정점 기준 표시',22,weight='bold'),_text(670,280,'측정 11 / 미측정 2'),_text(670,316,'원형 웨이퍼'),_text(670,352,'노치 9시 고정'),_text(670,388,'공간 보간 없음'),_text(670,424,'단위·균일도 미정')])
    elif ident=='ER-02':
        parts.append(_map(points,330,330,190));parts.append(_text(620,150,'측정점 목록',22,weight='bold'))
        for i,point in enumerate(points):parts.append(_text(620,188+i*26,point['pointId']+'        '+('미측정' if point['er'] is None else format(point['er'],'.2f')),17))
    elif ident=='ER-03':
        parts.extend([_map(points,390,330,205,labels=False,missing_focus=True),_text(675,245,'미측정을 먼저 확인',22,weight='bold'),_text(675,295,'회색 + X : 미측정'),_text(675,335,'0과 다른 상태'),_text(675,375,'빈 위치는 채우지 않음'),_text(675,415,'유효 측정값만 색 표시')])
    elif ident=='ER-04':
        parts.extend([_text(285,130,'가짜 웨이퍼 A',21,anchor='middle'),_text(745,130,'가짜 웨이퍼 B',21,anchor='middle'),_map(points,285,345,167),_map(sample_points(1.5),745,345,167),_text(500,555,'좌표·색상 범위·노치 방향을 동일하게 유지',18,anchor='middle')])
    elif ident=='ER-05':
        for i,(cx,cy) in enumerate([(285,240),(735,240),(285,500),(735,500)]):
            parts.append(_text(cx,cy-118,'가짜 웨이퍼 '+str(i+1),19,anchor='middle'));parts.append(_map(sample_points(i*.7),cx,cy,102,labels=False))
        parts.append(_legend(300,620,400))
    elif ident=='ER-06':
        point=points[3]
        parts.extend([_map(points,350,330,190,selected=point['pointId']),_text(640,210,'선택점 '+point['pointId'],23,weight='bold'),_text(640,258,'ER : '+str(point['er'])),_text(640,298,'가짜 X : '+str(point['x'])),_text(640,338,'가짜 Y : '+str(point['y'])),_text(640,378,'실제 좌표는 기존 앱 사용'),_text(640,418,'방향 : 9시 노치 고정')])
    elif ident=='LINE-01':
        parts.extend([_line(rows,['a'],85,150,830,360),_text(85,610,'7번째는 누락 · 선을 이어 채우지 않는 예제',19)])
    elif ident=='LINE-02':
        parts.extend([_line(rows,['a','b'],85,150,830,360),_text(85,610,'파랑 A / 황토 B · 같은 X/Y 범위',19)])
    elif ident=='LINE-03':
        parts.extend([_text(270,130,'계열 A',21,anchor='middle'),_text(740,130,'계열 B',21,anchor='middle'),_line(rows,['a'],85,165,360,330),_line(rows,['b'],570,165,360,330),_text(85,615,'분리해도 축 범위는 90~110으로 공통',19)])
    else:
        row=rows[4]
        parts.extend([_line(rows,['a'],85,160,525,340),_text(690,225,'선택한 예제 기록',23,weight='bold'),_text(690,280,'가짜 순서 : '+str(row['order'])),_text(690,320,'가짜 ER : '+str(row['a'])),_text(690,360,'단위 : 미정'),_text(690,400,'원본 값 그대로 표시')])
    if view['kind']=='er' and ident!='ER-05':parts.append(_legend(240,580,410))

    parts.append('</svg>');return ''.join(parts)

def reference_spec(ident):
    view=view_for(ident)
    return {'version':1,'referenceId':ident,'title':view['title'],'purpose':view['goal'],
            'useExistingCoordinates':True,'notchClock':9 if view['kind']=='er' else None,
            'spatialInterpolation':'not_requested','erUnit':None,'uniformityFormula':None,
            'demoColorRange':[COLOR_MIN,COLOR_MAX],'productionColorRange':'confirm_in_company'}

def reference_brief(ident):
    view=view_for(ident)
    return '\n'.join(['# 사내 AI용 표현 변경 요청','',ident+' · '+view['title'],view['goal'],
        '- 기존 X/Y 좌표, 원천 값, SSO/DB 연결은 유지하고 표현 부분만 바꿉니다.',
        '- ER 맵 노치는 9시. 좌표를 임의 회전·반전하지 않습니다.',
        '- 보간·ER 단위·균일도 계산식은 아직 미정이므로 추가하거나 변경하지 않습니다.',
        '- 미측정은 0으로 채우지 않고 별도 표시합니다.',
        '- 비교할 때 색상 범위/축 비율을 맞춥니다. 예제 90~110을 실제 규격으로 사용하지 않습니다.',
        '- 필요한 그래프만 선택 후 생성하고 설치된 라이브러리 버전에 맞춥니다.',
        '- 수정 파일 / 기존 좌표 보존 / 검증 / 성능 실측 / 미구현을 보고합니다.',''])

def reference_source(ident):
    view_for(ident)
    return '\n'.join(['# er_reference.py 옆에서 사용하는 가짜 데이터 표현 참고용 예제',
        'import streamlit as st','from er_reference import reference_svg, reference_spec',
        'reference_id = '+repr(ident),'st.caption("가짜 데이터 표현 예제 · 실제 좌표/계산 규칙 미변경")',
        'st.image(reference_svg(reference_id))','st.json(reference_spec(reference_id))',''])

def plotly_single_map_example(points, coordinate_radius, color_range):
    """Figure dictionary example; Plotly/Streamlit execution must be verified in-company.
    Input here is the synthetic normalized sample. No package installation is performed.
    """
    radius=float(coordinate_radius)
    if isinstance(coordinate_radius,bool) or not math.isfinite(radius) or radius<=0:raise ValueError('기존 좌표계의 반경을 명시하세요.')
    if not isinstance(color_range,(list,tuple)) or len(color_range)!=2:raise ValueError('기존 색상 범위를 명시하세요.')
    low,high=map(float,color_range)
    if not math.isfinite(low) or not math.isfinite(high) or low>=high:raise ValueError('색상 범위를 확인하세요.')
    if not isinstance(points,list) or not 1<=len(points)<=2000:raise ValueError('표시 점은 1~2,000개입니다.')
    checked=[];ids=set();coordinates=set()
    for point in points:
        ident=str(point['pointId']);x=float(point['x']);y=float(point['y'])
        if not math.isfinite(x) or not math.isfinite(y) or math.hypot(x,y)>radius*(1+1e-9):raise ValueError('좌표와 반경을 확인하세요. 임의로 자르지 않습니다.')
        if ident in ids or (x,y) in coordinates:raise ValueError('중복 측정점입니다. 기존 분리/집계 규칙을 확인하세요.')
        ids.add(ident);coordinates.add((x,y));value=point['er']
        if value is not None and (isinstance(value,bool) or not math.isfinite(float(value))):raise ValueError('ER 값 또는 미측정 표기를 확인하세요.')
        checked.append({'pointId':html.escape(ident),'x':x,'y':y,'er':None if value is None else float(value)})
    valid=[p for p in checked if p['er'] is not None];missing=[p for p in checked if p['er'] is None]
    trace={'type':'scatter','mode':'markers+text','x':[p['x'] for p in valid],'y':[p['y'] for p in valid],
      'text':[p['pointId'] for p in valid],'textposition':'top center','customdata':[[p['pointId'],p['er']] for p in valid],
      'hovertemplate':'%{customdata[0]}<br>X=%{x}<br>Y=%{y}<br>ER=%{customdata[1]}<extra></extra>',
      'marker':{'size':26,'color':[p['er'] for p in valid],'colorscale':'Viridis','cmin':low,'cmax':high,
                'colorbar':{'title':{'text':'ER · 단위 미정'}},'line':{'color':'white','width':1}},'name':'가짜 측정값'}
    missing_trace={'type':'scatter','mode':'markers','x':[p['x'] for p in missing],'y':[p['y'] for p in missing],
      'text':[p['pointId']+' · 미측정' for p in missing],'hovertemplate':'%{text}<extra></extra>',
      'marker':{'size':24,'color':'#bec8cf','symbol':'x'},'name':'미측정'}
    return {'data':[trace,missing_trace], 'layout':{'title':{'text':'가짜 좌표 예제 · 노치 9시'},'height':600,
      'xaxis':{'range':[-1.15*radius,1.15*radius],'title':{'text':'가짜 X'},'zeroline':False},
      'yaxis':{'range':[-1.15*radius,1.15*radius],'title':{'text':'가짜 Y'},'scaleanchor':'x','scaleratio':1,'zeroline':False},
      'shapes':[{'type':'circle','x0':-radius,'y0':-radius,'x1':radius,'y1':radius,'line':{'color':'#7893a5'},'layer':'below'},
                {'type':'path','path':'M %s %s L %s 0 L %s %s Z'%(-1.02*radius,-.08*radius,-.9*radius,-1.02*radius,.08*radius),'fillcolor':'white','line':{'color':'white'}},
                {'type':'path','path':'M %s %s L %s 0 L %s %s'%(-radius,-.08*radius,-.9*radius,-radius,.08*radius),'line':{'color':'#7893a5'}}],
      'paper_bgcolor':'white','plot_bgcolor':'white','showlegend':True}}
