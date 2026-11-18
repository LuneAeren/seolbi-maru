"""Read installed public API signatures/docstrings locally. No installs or network calls."""
import argparse
import importlib.util
import importlib.metadata
import inspect
import json
import platform
import os

parser=argparse.ArgumentParser()
parser.add_argument('--docstrings',action='store_true',help='Include installed Streamlit public API docstrings for internal AI reference')
args=parser.parse_args()
report={'python':platform.python_version(),'streamlitAvailable':importlib.util.find_spec('streamlit') is not None,'packages':{},'apis':{}}
for name in ['streamlit','pandas','altair','plotly']:
    try:report['packages'][name]=importlib.metadata.version(name)
    except importlib.metadata.PackageNotFoundError:report['packages'][name]=None
if report['streamlitAvailable']:
    os.environ["STREAMLIT_BROWSER_GATHER_USAGE_STATS"]="false"
    import streamlit as st
    for name in ['line_chart','bar_chart','scatter_chart','dataframe','form','form_submit_button','download_button','cache_data','cache_resource','image','plotly_chart','selectbox','tabs']:
        function=getattr(st,name,None)
        entry={'available':function is not None}
        if function is not None:
            try:entry['signature']=str(inspect.signature(function))
            except (TypeError,ValueError):entry['signature']='unavailable'
            if args.docstrings:entry['documentation']=inspect.getdoc(function) or ''
        report['apis'][name]=entry
print(json.dumps(report,ensure_ascii=False,indent=2))
