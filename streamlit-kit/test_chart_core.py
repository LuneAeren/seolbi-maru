import ast
import unittest
from chart_core import PRESETS, preset_spec, sample_rows, prepare_points, validate_spec, render_source, render_brief, preview_svg

class ChartTests(unittest.TestCase):
    def test_presets_and_generated_code(self):
        for preset in PRESETS:
            spec=preset_spec(preset);result=prepare_points(sample_rows(),spec)
            self.assertTrue(result["points"]);ast.parse(render_source(spec))
            self.assertIn("사내 AI",render_brief(spec));self.assertIn("<svg",preview_svg(spec,result))
    def test_aggregation_filter_and_date_order(self):
        spec=preset_spec(PRESETS[0]);spec.update(x="day",y="work_count",aggregate="sum",equipment="MC-DEMO-01")
        rows=[{"day":"2026-11-18","equipment":"MC-DEMO-01","work_count":2},{"day":"2026-11-17","equipment":"MC-DEMO-01","work_count":3},{"day":"2026-11-18","equipment":"MC-DEMO-01","work_count":4},{"day":"2026-11-18","equipment":"MC-DEMO-02","work_count":99}]
        result=prepare_points(rows,spec)
        self.assertEqual(result["points"],[{"x":"2026-11-17","value":3},{"x":"2026-11-18","value":6}]);self.assertEqual(result["filteredRows"],1)
        spec["aggregate"]="mean";self.assertEqual(prepare_points(rows,spec)["points"][1]["value"],3)
    def test_bad_missing_and_non_finite_are_not_zero(self):
        spec=preset_spec(PRESETS[4]);rows=[{"day":"2026-11-18","work_count":5},{"day":"2026-02-30","work_count":2},{"day":"2026-11-18","work_count":float("nan")},{"day":"2026-11-18","work_count":True}]
        result=prepare_points(rows,spec);self.assertEqual(result["droppedRows"],3);self.assertEqual(result["points"],[{"x":"2026-11-18","value":5}])
        spec["missing"]="error"
        with self.assertRaises(ValueError):prepare_points(rows,spec)
    def test_schema_code_injection_and_limits(self):
        spec=preset_spec(PRESETS[0])
        for invalid in [dict(spec,url="https://example.invalid"),dict(spec,chart="eval"),dict(spec,version=True)]:
            with self.assertRaises(ValueError):validate_spec(invalid)
        title="<script>bad</script> ' ";spec["title"]=title
        self.assertNotIn("<script>",preview_svg(spec,prepare_points(sample_rows(),spec)))
        ast.parse(render_source(spec))
        spec.update(chart="scatter",x="temperature",aggregate="none")
        with self.assertRaises(ValueError):prepare_points([{"temperature":i,"temperature_extra":0,"pressure":1} for i in range(2001)],dict(spec,y="pressure",equipment="all"))
    def test_app_parses_without_importing_streamlit(self):
        from pathlib import Path
        ast.parse(Path(__file__).with_name("app.py").read_text())

if __name__=="__main__":unittest.main()
