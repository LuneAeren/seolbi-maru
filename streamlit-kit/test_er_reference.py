import ast
import math
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from er_reference import VIEWS, reference_svg, reference_spec, reference_brief, reference_source, sample_points, sample_line, color_for, plotly_single_map_example

class ERReferenceTests(unittest.TestCase):
    def test_ten_views_parse_and_keep_unconfirmed_rules_unset(self):
        self.assertEqual(len(VIEWS),10)
        for view in VIEWS:
            root=ET.fromstring(reference_svg(view['id']));self.assertTrue(root.tag.endswith('svg'))
            spec=reference_spec(view['id']);self.assertTrue(spec['useExistingCoordinates'])
            self.assertIsNone(spec['erUnit']);self.assertIsNone(spec['uniformityFormula'])
            self.assertEqual(spec['spatialInterpolation'],'not_requested')
            if view['kind']=='er':self.assertEqual(spec['notchClock'],9)
            self.assertIn('기존 X/Y',reference_brief(view['id']));ast.parse(reference_source(view['id']))
    def test_missing_and_zero_have_different_meanings(self):
        self.assertNotEqual(color_for(None),color_for(0))
        points=sample_points();self.assertEqual(sum(p['er'] is None for p in points),2)
        self.assertTrue(all(math.hypot(p['x'],p['y'])<=1 for p in points))
        points[0]['er']=0
        figure=plotly_single_map_example(points,1,[0,110])
        self.assertIn(0,figure['data'][0]['marker']['color']);self.assertEqual(len(figure['data'][1]['x']),2)
    def test_notch_is_negative_x_and_axis_units_are_equal(self):
        points=sample_points();figure=plotly_single_map_example(points,1,[90,110]);layout=figure['layout']
        self.assertEqual(layout['yaxis']['scaleanchor'],'x');self.assertEqual(layout['yaxis']['scaleratio'],1)
        self.assertIn('L -0.9 0',layout['shapes'][1]['path'])
        scaled=[dict(p,x=p['x']*150,y=p['y']*150) for p in points]
        actual=plotly_single_map_example(scaled,150,[90,110])
        self.assertEqual(actual['layout']['shapes'][0]['x0'],-150)
        self.assertEqual(actual['data'][0]['x'][1],scaled[1]['x'])
        self.assertEqual(actual['layout']['xaxis']['range'],[-172.5,172.5])
    def test_invalid_radius_duplicate_or_clipped_coordinates_are_rejected(self):
        for radius in [0,-1,float('nan'),True]:
            with self.assertRaises(ValueError):plotly_single_map_example(sample_points(),radius,[90,110])
        for points in [[dict(sample_points()[0],x=2)],sample_points()+[sample_points()[0]]]:
            with self.assertRaises(ValueError):plotly_single_map_example(points,1,[90,110])
        for bounds in [[100,90],[1,1],[0,float('inf')]]:
            with self.assertRaises(ValueError):plotly_single_map_example(sample_points(),1,bounds)
    def test_line_gap_and_selected_only_app_are_preserved(self):
        rows=sample_line();self.assertIsNone(rows[6]['a']);self.assertIsNone(rows[6]['b'])
        root=ET.fromstring(reference_svg('LINE-01'))
        paths=[el for el in root.iter() if el.tag.endswith('polyline')]
        self.assertEqual(len(paths),2)
        ast.parse(Path(__file__).with_name('er_reference_app.py').read_text())
        self.assertNotIn('st.tabs(',Path(__file__).with_name('er_reference_app.py').read_text())

if __name__=='__main__':unittest.main()
